import { randomUUID } from "node:crypto";
import { and, desc, eq, lt, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  launchCheckouts,
  launchPacks,
  launchProjects,
} from "../../drizzle/schema";
import {
  httpsUrl,
  ideaSchema,
  launchPackSchema,
  profileSchema,
  renderWebsite,
  websiteSchema,
} from "../../shared/launch";
import { getDb } from "../db";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import {
  appOrigin,
  generateCopy,
  serviceStatus,
  StripeCheckoutClient,
  verifyPurchase,
} from "../launchServices";

const idInput = z.object({ id: z.string().uuid() });
async function database() {
  const db = await getDb();
  if (!db)
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "Skootly’s database is not connected yet. Please contact the owner to finish setup.",
    });
  return db;
}
async function packById(id: string) {
  const db = await database();
  const [pack] = await db
    .select()
    .from(launchPacks)
    .where(eq(launchPacks.id, id));
  if (!pack)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "This pack could not be found.",
    });
  return pack;
}
async function ownedProject(userId: number, id: string) {
  const db = await database();
  const [project] = await db
    .select()
    .from(launchProjects)
    .where(and(eq(launchProjects.id, id), eq(launchProjects.userId, userId)));
  if (!project)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Your project could not be found. Open your pack to start.",
    });
  return project;
}
async function enroll(userId: number, packId: string) {
  const db = await database();
  await db
    .insert(launchProjects)
    .values({ id: randomUUID(), userId, packId, createdAt: Date.now() })
    .onDuplicateKeyUpdate({ set: { userId } });
  const [project] = await db
    .select()
    .from(launchProjects)
    .where(
      and(eq(launchProjects.userId, userId), eq(launchProjects.packId, packId))
    );
  return project;
}
async function recoverPurchase(userId: number, packId: string) {
  const db = await database();
  const orders = await db
    .select()
    .from(launchCheckouts)
    .where(
      and(
        eq(launchCheckouts.userId, userId),
        eq(launchCheckouts.packId, packId)
      )
    )
    .orderBy(desc(launchCheckouts.createdAt))
    .limit(10);
  const stripe = new StripeCheckoutClient();
  for (const order of orders) {
    if (!order.sessionId) continue;
    const session = await stripe.request(
      `/${encodeURIComponent(order.sessionId)}`
    );
    if (verifyPurchase(session, order)) return enroll(userId, packId);
  }
  return null;
}
async function reserveGeneration(project: typeof launchProjects.$inferSelect) {
  if (!serviceStatus().ai)
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "AI creation is not connected yet. Your progress is saved.",
    });
  const db = await database();
  const [result] = await db
    .update(launchProjects)
    .set({
      generationCount: sql`${launchProjects.generationCount} + 1`,
      revision: project.revision + 1,
    })
    .where(
      and(
        eq(launchProjects.id, project.id),
        eq(launchProjects.revision, project.revision),
        lt(launchProjects.generationCount, 12)
      )
    );
  if (!result.affectedRows)
    throw new TRPCError({
      code: "CONFLICT",
      message:
        "Another change is in progress, or this pack’s 12 AI attempts have been used. Refresh to continue; you can still edit your page.",
    });
  return project.revision + 1;
}
async function saveRevision(
  id: string,
  revision: number,
  values: Partial<typeof launchProjects.$inferInsert>
) {
  const db = await database();
  const [result] = await db
    .update(launchProjects)
    .set({ ...values, revision: revision + 1 })
    .where(
      and(eq(launchProjects.id, id), eq(launchProjects.revision, revision))
    );
  if (!result.affectedRows)
    throw new TRPCError({
      code: "CONFLICT",
      message:
        "Your project changed in another tab. Refresh before continuing.",
    });
}

export const launchRouter = router({
  status: publicProcedure.query(() => serviceStatus()),
  home: protectedProcedure.query(async ({ ctx }) => {
    const db = await database();
    const [packs, projects] = await Promise.all([
      db
        .select()
        .from(launchPacks)
        .where(eq(launchPacks.ownerId, ctx.user.id))
        .orderBy(desc(launchPacks.createdAt)),
      db
        .select({
          id: launchProjects.id,
          name: launchPacks.name,
          published: launchProjects.publishedHtml,
        })
        .from(launchProjects)
        .innerJoin(launchPacks, eq(launchPacks.id, launchProjects.packId))
        .where(eq(launchProjects.userId, ctx.user.id)),
    ]);
    return {
      packs,
      projects: projects.map(p => ({ ...p, published: Boolean(p.published) })),
    };
  }),
  createPack: protectedProcedure
    .input(launchPackSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await database();
      const id = randomUUID();
      await db
        .insert(launchPacks)
        .values({ id, ownerId: ctx.user.id, ...input, createdAt: Date.now() });
      return { id };
    }),
  editPack: protectedProcedure.input(idInput).query(async ({ ctx, input }) => {
    const pack = await packById(input.id);
    if (pack.ownerId !== ctx.user.id)
      throw new TRPCError({ code: "NOT_FOUND" });
    return pack;
  }),
  savePack: protectedProcedure
    .input(
      launchPackSchema.extend({ id: z.string().uuid(), published: z.boolean() })
    )
    .mutation(async ({ ctx, input }) => {
      const pack = await packById(input.id);
      if (pack.ownerId !== ctx.user.id)
        throw new TRPCError({ code: "NOT_FOUND" });
      if (input.published && !serviceStatus().ai)
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Connect AI creation before opening this pack to clients.",
        });
      if (input.published && input.priceCents > 0 && !serviceStatus().payments)
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Connect Stripe and the app’s HTTPS address before selling this pack.",
        });
      const { id, ...values } = input;
      const db = await database();
      if (input.priceCents !== pack.priceCents) {
        const [order] = await db
          .select({ id: launchCheckouts.id })
          .from(launchCheckouts)
          .where(eq(launchCheckouts.packId, id))
          .limit(1);
        if (order)
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "A checkout has already started at this price. Create a new pack to offer a different price.",
          });
      }
      await db.update(launchPacks).set(values).where(eq(launchPacks.id, id));
      return { id };
    }),
  pack: publicProcedure.input(idInput).query(async ({ input }) => {
    const p = await packById(input.id);
    if (!p.published)
      throw new TRPCError({
        code: "NOT_FOUND",
        message:
          "This pack is not open yet. Ask your coach for the current link.",
      });
    return {
      id: p.id,
      name: p.name,
      coach: p.coach,
      promise: p.promise,
      priceCents: p.priceCents,
    };
  }),
  access: protectedProcedure.input(idInput).mutation(async ({ ctx, input }) => {
    const db = await database();
    const [existing] = await db
      .select()
      .from(launchProjects)
      .where(
        and(
          eq(launchProjects.userId, ctx.user.id),
          eq(launchProjects.packId, input.id)
        )
      );
    if (existing) return { projectId: existing.id };
    const pack = await packById(input.id);
    if (pack.ownerId === ctx.user.id)
      return { projectId: (await enroll(ctx.user.id, pack.id)).id };
    if (!pack.published)
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "This pack is not open yet.",
      });
    if (!pack.priceCents)
      return { projectId: (await enroll(ctx.user.id, pack.id)).id };
    const recovered = await recoverPurchase(ctx.user.id, pack.id);
    return { projectId: recovered?.id || null };
  }),
  checkout: protectedProcedure
    .input(idInput)
    .mutation(async ({ ctx, input }) => {
      const pack = await packById(input.id);
      if (!pack.published || !pack.priceCents)
        throw new TRPCError({ code: "BAD_REQUEST" });
      const origin = appOrigin();
      if (!origin || !serviceStatus().ai)
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "This pack is not ready for payments. Please contact your coach.",
        });
      const db = await database();
      const [existing] = await db
        .select()
        .from(launchProjects)
        .where(
          and(
            eq(launchProjects.userId, ctx.user.id),
            eq(launchProjects.packId, pack.id)
          )
        );
      if (existing) return { url: `${origin}/project/${existing.id}` };
      const recovered = await recoverPurchase(ctx.user.id, pack.id);
      if (recovered) return { url: `${origin}/project/${recovered.id}` };
      // A unique order row plus a database lock serializes checkout across tabs/servers.
      await db
        .insert(launchCheckouts)
        .values({
          id: randomUUID(),
          packId: pack.id,
          userId: ctx.user.id,
          amount: pack.priceCents,
          createdAt: Date.now(),
        })
        .onDuplicateKeyUpdate({ set: { userId: ctx.user.id } });
      const result = await db.transaction(async tx => {
        const [order] = await tx
          .select()
          .from(launchCheckouts)
          .where(
            and(
              eq(launchCheckouts.userId, ctx.user.id),
              eq(launchCheckouts.packId, pack.id)
            )
          )
          .for("update");
        const stripe = new StripeCheckoutClient();
        if (order.sessionId) {
          const session = await stripe.request(
            `/${encodeURIComponent(order.sessionId)}`
          );
          if (verifyPurchase(session, order)) return { paid: true as const };
          if (session.status === "complete")
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message:
                "Your payment is still processing. Check access again shortly; do not pay a second time.",
            });
          if (session.status === "open" && session.url)
            return { url: session.url };
        }
        const session = await stripe.request(
          "",
          new URLSearchParams({
            mode: "payment",
            "line_items[0][price_data][currency]": "usd",
            "line_items[0][price_data][unit_amount]": String(order.amount),
            "line_items[0][price_data][product_data][name]": pack.name,
            "line_items[0][quantity]": "1",
            client_reference_id: String(ctx.user.id),
            "metadata[orderId]": order.id,
            "metadata[packId]": pack.id,
            success_url: `${origin}/pack/${pack.id}?payment=returned`,
            cancel_url: `${origin}/pack/${pack.id}?payment=canceled`,
            integration_identifier: "skootly_packs_mqbrtwaz",
            ...(ctx.user.email ? { customer_email: ctx.user.email } : {}),
          }),
          `skootly-${order.id}-${order.sessionId || "first"}`
        );
        await tx
          .update(launchCheckouts)
          .set({ sessionId: session.id })
          .where(eq(launchCheckouts.id, order.id));
        if (!session.url)
          throw new TRPCError({
            code: "BAD_GATEWAY",
            message: "Checkout did not return a link. Please retry.",
          });
        return { url: session.url };
      });
      if ("paid" in result)
        return {
          url: `${origin}/project/${(await enroll(ctx.user.id, pack.id)).id}`,
        };
      return result;
    }),
  project: protectedProcedure.input(idInput).query(async ({ ctx, input }) => {
    const project = await ownedProject(ctx.user.id, input.id);
    const pack = await packById(project.packId);
    return {
      ...project,
      publishedHtml: undefined,
      published: Boolean(project.publishedHtml),
      pack: {
        name: pack.name,
        coach: pack.coach,
        promise: pack.promise,
        communityUrl: pack.communityUrl,
      },
    };
  }),
  saveProfile: protectedProcedure
    .input(idInput.extend({ profile: profileSchema }))
    .mutation(async ({ ctx, input }) => {
      const p = await ownedProject(ctx.user.id, input.id);
      await saveRevision(p.id, p.revision, {
        profile: input.profile,
        ideas: null,
        selectedIdea: null,
      });
      return { success: true };
    }),
  ideas: protectedProcedure.input(idInput).mutation(async ({ ctx, input }) => {
    const p = await ownedProject(ctx.user.id, input.id);
    if (!p.profile)
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Save your profile first.",
      });
    const pack = await packById(p.packId);
    const revision = await reserveGeneration(p);
    const result = await generateCopy(
      z.object({ ideas: z.array(ideaSchema).length(3) }),
      'Return {"ideas":[{"title":"...","promise":"...","reason":"..."}]} with exactly three realistic offer ideas for this client, grounded in the coach method. Explain why each fits.',
      { method: pack.method, outcome: pack.promise, profile: p.profile }
    );
    await saveRevision(p.id, revision, {
      ideas: result.ideas,
      selectedIdea: null,
    });
    return result;
  }),
  build: protectedProcedure
    .input(idInput.extend({ ideaIndex: z.number().int().min(0).max(2) }))
    .mutation(async ({ ctx, input }) => {
      const p = await ownedProject(ctx.user.id, input.id);
      const idea = p.ideas?.[input.ideaIndex];
      if (!p.profile || !idea)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Create your ideas first.",
        });
      const pack = await packById(p.packId);
      const revision = await reserveGeneration(p);
      const website = await generateCopy(
        websiteSchema,
        'Write the website copy as {"headline":"...","subheading":"...","benefits":["...","...","..."],"about":"...","ctaLabel":"..."}. Use the client’s voice. Exactly three benefits. Do not invent facts.',
        { method: pack.method, profile: p.profile, idea }
      );
      await saveRevision(p.id, revision, { selectedIdea: idea, website });
      return { success: true };
    }),
  saveWebsite: protectedProcedure
    .input(
      idInput.extend({
        website: websiteSchema,
        ctaUrl: httpsUrl.or(z.literal("")),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const p = await ownedProject(ctx.user.id, input.id);
      if (!p.website) throw new TRPCError({ code: "BAD_REQUEST" });
      await saveRevision(p.id, p.revision, {
        website: input.website,
        ctaUrl: input.ctaUrl,
      });
      return { success: true };
    }),
  publish: protectedProcedure
    .input(idInput)
    .mutation(async ({ ctx, input }) => {
      const p = await ownedProject(ctx.user.id, input.id);
      if (!p.website || !p.profile || !p.ctaUrl)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Save your page and its booking or checkout link before publishing.",
        });
      await saveRevision(p.id, p.revision, {
        publishedHtml: renderWebsite(p.website, p.profile.name, p.ctaUrl),
      });
      return { path: `/p/${p.id}` };
    }),
  unpublish: protectedProcedure
    .input(idInput)
    .mutation(async ({ ctx, input }) => {
      const p = await ownedProject(ctx.user.id, input.id);
      await saveRevision(p.id, p.revision, { publishedHtml: null });
      return { success: true };
    }),
});
