import { afterEach, describe, expect, it, vi } from "vitest";
import {
  profileSchema,
  renderWebsite,
  websiteSchema,
  httpsUrl,
} from "../shared/launch";
import { getSessionCookieOptions } from "./_core/cookies";
import {
  verifyPurchase,
  StripeCheckoutClient,
  type CheckoutSession,
  appOrigin,
} from "./launchServices";

const site = {
  headline: "Launch your first offer",
  subheading: "Create a clear offer for the people you want to help.",
  benefits: ["A focused promise", "A simple page", "A clear next step"],
  about: "I help coaches explain their work clearly.",
  ctaLabel: "Book a conversation",
};
const order = {
  id: "order-1",
  packId: "pack-1",
  userId: 42,
  amount: 2700,
  sessionId: "cs_test_1",
};
const paid: CheckoutSession = {
  id: "cs_test_1",
  url: null,
  status: "complete",
  payment_status: "paid",
  amount_total: 2700,
  currency: "usd",
  client_reference_id: "42",
  metadata: { orderId: "order-1", packId: "pack-1" },
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("website pack payment gate", () => {
  it("unlocks only a settled purchase matching the stored order, user, pack, currency and amount", () => {
    expect(verifyPurchase(paid, order)).toBe(true);
    for (const change of [
      { payment_status: "unpaid" },
      { status: "open" },
      { amount_total: 1 },
      { currency: "eur" },
      { client_reference_id: "43" },
      { id: "cs_other" },
      { metadata: { orderId: "wrong", packId: "pack-1" } },
      { metadata: { orderId: "order-1", packId: "wrong" } },
    ])
      expect(verifyPurchase({ ...paid, ...change }, order)).toBe(false);
  });
  it("never turns Stripe failures into successful payments or exposes provider error bodies", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response("secret-provider-debug", { status: 401 })
        )
    );
    await expect(
      new StripeCheckoutClient("test-only-key").request("/cs_test_1")
    ).rejects.toMatchObject({ code: "BAD_GATEWAY" });
  });
  it("does not start checkout without a configured key", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(
      new StripeCheckoutClient().request("", new URLSearchParams())
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("uses only the configured HTTPS origin, not a request Host header", () => {
    vi.stubEnv("APP_BASE_URL", "https://skootly.example/something");
    expect(appOrigin()).toBe("https://skootly.example");
    vi.stubEnv("APP_BASE_URL", "http://skootly.example");
    expect(appOrigin()).toBeNull();
    vi.stubEnv("APP_BASE_URL", "https://user:pass@skootly.example");
    expect(appOrigin()).toBeNull();
  });
});
describe("safe, usable offer pages", () => {
  it("escapes model and client content while preserving the HTTPS call to action", () => {
    const html = renderWebsite(
      {
        ...site,
        headline: '<script>alert("x")</script>',
        about: "<img src=x onerror=alert(1)>",
      },
      "Name <iframe>",
      "https://example.com/book?a=1&b=2"
    );
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<iframe");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain('href="https://example.com/book?a=1&amp;b=2"');
  });
  it.each([
    "javascript:alert(1)",
    "data:text/html,test",
    "http://example.com",
    "https://user:pass@example.com",
  ])("rejects unsafe CTA %s", url => {
    expect(httpsUrl.safeParse(url).success).toBe(false);
    expect(() => renderWebsite(site, "Coach", url)).toThrow();
  });
  it("lets a draft render during empty-field editing without inventing a working CTA", () => {
    const html = renderWebsite({ ...site, headline: "" }, "Coach", "");
    expect(html).toContain(
      "Add your booking or checkout link before publishing"
    );
    expect(html).not.toContain('href="#"');
  });
  it("requires complete, bounded copy at the save boundary", () => {
    expect(websiteSchema.safeParse(site).success).toBe(true);
    expect(websiteSchema.safeParse({ ...site, headline: "" }).success).toBe(
      false
    );
    expect(websiteSchema.safeParse({ ...site, benefits: [] }).success).toBe(
      false
    );
    expect(
      profileSchema.safeParse({
        name: "Jo",
        business: "",
        audience: "Everyone",
        voice: "Warm",
      }).success
    ).toBe(false);
  });
  it("sets a usable local cookie and a secure HTTPS cookie", () => {
    expect(
      getSessionCookieOptions({ protocol: "http", headers: {} } as any)
    ).toMatchObject({ sameSite: "lax", secure: false, httpOnly: true });
    expect(
      getSessionCookieOptions({ protocol: "https", headers: {} } as any)
    ).toMatchObject({ sameSite: "none", secure: true, httpOnly: true });
  });
});
