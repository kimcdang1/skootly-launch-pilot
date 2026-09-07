import { z } from "zod";

export const profileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  business: z.string().trim().min(10).max(2000),
  audience: z.string().trim().min(3).max(1000),
  voice: z.string().trim().min(3).max(1000),
  socialBio: z.string().trim().max(4000).default(""),
});
export const ideaSchema = z.object({
  title: z.string().min(3).max(150),
  promise: z.string().min(10).max(600),
  reason: z.string().min(10).max(600),
});
export const websiteSchema = z.object({
  headline: z.string().trim().min(3).max(180),
  subheading: z.string().trim().min(10).max(800),
  benefits: z.array(z.string().trim().min(3).max(300)).min(3).max(3),
  about: z.string().trim().min(10).max(1500),
  ctaLabel: z.string().trim().min(2).max(80),
});
export const httpsUrl = z
  .string()
  .trim()
  .url()
  .max(2000)
  .refine(s => {
    try {
      const u = new URL(s);
      return u.protocol === "https:" && !u.username && !u.password;
    } catch {
      return false;
    }
  }, "Use a full HTTPS link.");
export const launchPackSchema = z.object({
  name: z.string().trim().min(3).max(150),
  coach: z.string().trim().min(2).max(120),
  promise: z.string().trim().min(10).max(1000),
  method: z.string().trim().min(50).max(20000),
  priceCents: z.number().int().min(0).max(100000),
  communityUrl: httpsUrl.or(z.literal("")).default(""),
});
export type ClientProfile = z.infer<typeof profileSchema>;
export type LaunchIdea = z.infer<typeof ideaSchema>;
export type LaunchWebsite = z.infer<typeof websiteSchema>;

export function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    char =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!
  );
}

// AI returns validated copy, never executable HTML or JavaScript.
export function renderWebsite(
  site: LaunchWebsite,
  name: string,
  ctaUrl: string
) {
  const url = ctaUrl ? httpsUrl.parse(ctaUrl) : "";
  const e = escapeHtml;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(site.headline)}</title><meta name="description" content="${e(site.subheading)}"><style>*{box-sizing:border-box}body{margin:0;background:#fffaf0;color:#191919;font:18px/1.65 system-ui,sans-serif}main{max-width:1000px;margin:auto;padding:40px 24px 80px}header{font-weight:800;border-bottom:2px solid;padding-bottom:20px}.hero{padding:70px 0}small{text-transform:uppercase;letter-spacing:.15em}h1{font-size:clamp(40px,7vw,76px);line-height:1.08;letter-spacing:-.05em;max-width:900px}p{max-width:700px}.cta{display:inline-block;margin-top:20px;background:#242424;color:white;border-radius:12px;padding:16px 26px;text-decoration:none;font-weight:700}.benefits{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.benefits p{background:#ded3ff;border:2px solid;border-radius:18px;padding:24px;margin:0}section{margin-bottom:50px}footer{font-size:14px;border-top:1px solid;padding-top:24px}@media(max-width:650px){.benefits{grid-template-columns:1fr}.hero{padding:35px 0}}</style></head><body><main><header>${e(name)}</header><section class="hero"><small>A clear next step</small><h1>${e(site.headline)}</h1><p>${e(site.subheading)}</p>${url ? `<a class="cta" rel="noopener noreferrer" href="${e(url)}">${e(site.ctaLabel)}</a>` : "<p><em>Add your booking or checkout link before publishing.</em></p>"}</section><section><h2>What you’ll work toward</h2><div class="benefits">${site.benefits.map(b => `<p>${e(b)}</p>`).join("")}</div></section><section><h2>Meet ${e(name)}</h2><p>${e(site.about)}</p></section><footer>Created with Skootly</footer></main></body></html>`;
}
