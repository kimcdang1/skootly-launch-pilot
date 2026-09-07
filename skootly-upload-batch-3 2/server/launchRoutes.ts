import type { Express } from "express";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { launchProjects } from "../drizzle/schema";
import { z } from "zod";

export function registerLaunchRoutes(app: Express) {
  app.get("/p/:id", async (req, res) => {
    if (!z.string().uuid().safeParse(req.params.id).success)
      return res.status(404).send("Page not found.");
    try {
      const db = await getDb();
      if (!db)
        return res.status(503).send("This page is temporarily unavailable.");
      const [p] = await db
        .select({ html: launchProjects.publishedHtml })
        .from(launchProjects)
        .where(eq(launchProjects.id, req.params.id));
      if (!p?.html)
        return res
          .status(404)
          .send("This page has not been published or is no longer available.");
      res.setHeader(
        "Content-Security-Policy",
        "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; sandbox allow-top-navigation-by-user-activation"
      );
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Referrer-Policy", "no-referrer");
      res.setHeader("Cache-Control", "no-store");
      return res.type("html").send(p.html);
    } catch {
      return res
        .status(503)
        .send(
          "This page is temporarily unavailable. Please try again shortly."
        );
    }
  });
}
