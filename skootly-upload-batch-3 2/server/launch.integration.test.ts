// Runs against disposable MySQL in CI, with only the paid external providers mocked.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import superjson from "superjson";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { appRouter, type AppRouter } from "./routers";
import { createContext } from "./_core/context";
import { registerLaunchRoutes } from "./launchRoutes";
import { launchCheckouts, launchPacks, launchProjects, users, userCredentials } from "../drizzle/schema";
import { getDb } from "./db";

const provider = vi.hoisted(() => ({ response: {} as any, fail: false }));
vi.mock("./_core/llm", () => ({ invokeLLM: vi.fn(async () => {
  if (provider.fail) throw new Error("Simulated upstream failure");
  return { choices: [{ message: { content: JSON.stringify(provider.response) } }] };
}) }));

describe.skipIf(process.env.LAUNCH_INTEGRATION !== "1")("HTTP coach-to-client journey with real MySQL", () => {
  let server: Server;
  let origin: string;
  const userIds: number[] = [];
  const realFetch = globalThis.fetch;
  const sessions = new Map<string, any>();
  let paid = false;
  let stripeCreates = 0;
  const fixture = `integration-${randomUUID()}`;
  function client() {
    let cookie = "";
    return createTRPCProxyClient<AppRouter>({ links: [httpBatchLink({ url: `${origin}/api/trpc`, transformer: superjson, fetch: async (url, options) => {
      const headers = new Headers(options?.headers);
      if (cookie) headers.set("cookie", cookie);
      const response = await realFetch(url, { ...options, headers });
      const received = response.headers.get("set-cookie");
      if (received) cookie = received.split(";")[0];
      return response;
    } })] });
  }
  beforeAll(async () => {
    if (!process.env.DATABASE_URL?.endsWith("/skootly_test")) throw new Error("Integration suite requires the disposable skootly_test database.");
    const app = express(); app.use(express.json());
    app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
    registerLaunchRoutes(app);
    server = createServer(app);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No test port");
    origin = `http://127.0.0.1:${address.port}`;
    vi.stubGlobal("fetch", async (url: any, options?: RequestInit) => {
      if (!String(url).startsWith("https://api.stripe.com/")) return realFetch(url, options);
      if (options?.method === "POST") {
        stripeCreates++;
        const body = new URLSearchParams(String(options.body));
        const id = `cs_test_${stripeCreates}`;
        const session = { id, url: `https://checkout.stripe.com/${id}`, status: "open", payment_status: "unpaid", amount_total: Number(body.get("line_items[0][price_data][unit_amount]")), currency: "usd", client_reference_id: body.get("client_reference_id"), metadata: { orderId: body.get("metadata[orderId]"), packId: body.get("metadata[packId]") } };
        sessions.set(id, session);
        return Response.json(session);
      }
      const session = sessions.get(String(url).split("/").pop()!);
      return Response.json({ ...session, status: paid ? "complete" : "open", payment_status: paid ? "paid" : "unpaid" });
    });
  });
  afterAll(async () => {
    vi.unstubAllGlobals();
    if (userIds.length) {
      const db = (await getDb())!;
      await db.delete(launchCheckouts).where(inArray(launchCheckouts.userId, userIds));
      await db.delete(launchProjects).where(inArray(launchProjects.userId, userIds));
      await db.delete(launchPacks).where(inArray(launchPacks.ownerId, userIds));
      await db.delete(userCredentials).where(inArray(userCredentials.userId, userIds));
      await db.delete(users).where(inArray(users.id, userIds));
    }
    if (server) await new Promise<void>(resolve => server.close(() => resolve()));
  });

  it("registers two people, persists their progress, recovers a paid checkout, and publishes only reviewed copy", async () => {
    const coach = client(), student = client(), stranger = client();
    for (const [api, role] of [[coach, "coach"], [student, "student"]] as const) {
      await api.auth.register.mutate({ name: role, email: `${fixture}-${role}@example.com`, password: "integration-only-password-1234" });
      const me = await api.auth.me.query(); expect(me).toBeTruthy(); userIds.push(me!.id);
    }
    const source = { name: "Offer Page Pack", coach: "Integration Coach", promise: "Help clients choose an offer and create a clear offer page.", method: "Start with a real audience and one problem they want solved. Keep the promise specific. Never invent testimonials or guarantees. Ask five people for feedback.", priceCents: 0, communityUrl: "https://www.skool.com/example" };
    const draft = await coach.launch.createPack.mutate(source);
    await expect(stranger.launch.pack.query(draft)).rejects.toMatchObject({ data: { code: "NOT_FOUND" } });
    await coach.launch.savePack.mutate({ ...source, ...draft, published: true });
    expect(await stranger.launch.pack.query(draft)).not.toHaveProperty("method");
    const access = await student.launch.access.mutate(draft);
    expect(access.projectId).toBeTruthy();
    const id = access.projectId!;
    await expect(coach.launch.project.query({ id })).rejects.toMatchObject({ data: { code: "NOT_FOUND" } });
    await expect(stranger.launch.project.query({ id })).rejects.toMatchObject({ data: { code: "UNAUTHORIZED" } });
    await student.launch.saveProfile.mutate({ id, profile: { name: "Jo", business: "I help first-time coaches explain their offer.", audience: "First-time coaches", voice: "Warm and direct", socialBio: "Private bio example" } });
    provider.fail = true;
    await expect(student.launch.ideas.mutate({ id })).rejects.toMatchObject({ data: { code: "BAD_GATEWAY" } });
    expect((await student.launch.project.query({ id })).profile?.name).toBe("Jo");
    provider.fail = false;
    provider.response = { ideas: [1, 2, 3].map(n => ({ title: `Offer ${n}`, promise: "Clarify your first offer in a focused session.", reason: "Matches your coaching experience and audience." })) };
    await student.launch.ideas.mutate({ id });
    provider.response = { headline: "Make your offer clear", subheading: "A focused conversation to help you explain what you offer.", benefits: ["One clear audience", "A focused promise", "Your next step"], about: "I help first-time coaches explain their offer.", ctaLabel: "Book a conversation" };
    await student.launch.build.mutate({ id, ideaIndex: 0 });
    const project = await student.launch.project.query({ id });
    expect(project.website?.headline).toBe("Make your offer clear");
    expect((await realFetch(`${origin}/p/${id}`)).status).toBe(404);
    await expect(student.launch.publish.mutate({ id })).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } });
    await student.launch.saveWebsite.mutate({ id, website: project.website!, ctaUrl: "https://example.com/book" });
    await student.launch.publish.mutate({ id });
    const page = await realFetch(`${origin}/p/${id}`);
    expect(page.status).toBe(200); expect(page.headers.get("content-security-policy")).toContain("default-src 'none'");
    const html = await page.text(); expect(html).toContain('href="https://example.com/book"'); expect(html).not.toContain("Private bio example"); expect(html).not.toContain(source.method);
    await student.launch.saveWebsite.mutate({ id, website: { ...project.website!, headline: "Unpublished change" }, ctaUrl: "https://example.com/book" });
    expect(await (await realFetch(`${origin}/p/${id}`)).text()).not.toContain("Unpublished change");
    await student.launch.unpublish.mutate({ id }); expect((await realFetch(`${origin}/p/${id}`)).status).toBe(404);
    // A new client instance signs back in: recovery is database-backed, not browser storage.
    const returning = client(); await returning.auth.login.mutate({ email: `${fixture}-student@example.com`, password: "integration-only-password-1234" });
    expect((await returning.launch.project.query({ id })).website?.headline).toBe("Unpublished change");
    const paidPack = await coach.launch.createPack.mutate({ ...source, priceCents: 2700 });
    await coach.launch.savePack.mutate({ ...source, ...paidPack, priceCents: 2700, published: true });
    expect((await student.launch.access.mutate(paidPack)).projectId).toBeNull();
    const links = await Promise.all([student.launch.checkout.mutate(paidPack), returning.launch.checkout.mutate(paidPack)]);
    expect(links[0].url).toBe(links[1].url); expect(stripeCreates).toBe(1);
    expect((await student.launch.access.mutate(paidPack)).projectId).toBeNull();
    paid = true;
    const recovered = await returning.launch.access.mutate(paidPack);
    expect(recovered.projectId).toBeTruthy();
    expect((await student.launch.access.mutate(paidPack)).projectId).toBe(recovered.projectId);
    await expect(coach.launch.project.query({ id: recovered.projectId! })).rejects.toMatchObject({ data: { code: "NOT_FOUND" } });
    // Quota is durable and enforced before making an upstream request.
    const db = (await getDb())!; await db.update(launchProjects).set({ generationCount: 12 }).where(eq(launchProjects.id, id));
    await expect(returning.launch.ideas.mutate({ id })).rejects.toMatchObject({ data: { code: "CONFLICT" } });
  }, 60000);
});
