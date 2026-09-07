# Focused coach-pack release

This branch changes the main UI to one outcome: a coach provides their method, a client unlocks the pack, and the client creates and publishes an offer website. Existing account records and older business tables remain intact. Old product navigation routes lead to the focused workspace; existing older packs are not automatically converted. The new pack has one source document (PDF/TXT/Markdown or pasted text), one-time USD access or included access, and one website per client.

## What is implemented

- Existing email/password accounts and MySQL database are reused.
- Coach draft, review, publish/close, shareable enrollment link, and owner trial.
- Editable client profile, pasted social content, three AI ideas grounded in the coach method, one selected idea, generated structured website copy.
- Durable progress, manual copy editing, safe sandboxed preview, real HTTPS CTA, HTML download, public `/p/:id` page, and unpublish.
- Publishing snapshots the page. Draft edits do not change the live page until the client republishes.
- Stripe-hosted Checkout, server-side purchase verification, account-bound access, recovery on return or later re-entry. Never trust a success query parameter as payment proof.
- Unique checkout rows, transactional locks, and Stripe idempotency keys prevent concurrent tabs from creating duplicate checkouts. A completed-but-unsettled checkout does not create a second charge.
- Twelve AI attempts per project, atomic quota reservation, bounded input/output, a 60-second provider deadline, and concurrency checks. Failed upstream attempts count. This is a project allowance, not a complete platform abuse/usage-billing system.

## Configure in the hosting provider, not in GitHub or chat

Retain the current Node/Express deployment; this is not a Cloudflare Worker migration. A connected Stripe app in ChatGPT does **not** inject a runtime API credential into this application.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Existing MySQL/TiDB database; back up before migration |
| `JWT_SECRET` | Existing stable session secret, at least 32 characters; changing it signs users out |
| `VITE_APP_ID` | Existing app identifier used for signed sessions |
| `BUILT_IN_FORGE_API_KEY` | Existing Manus AI gateway runtime credential |
| `BUILT_IN_FORGE_API_URL` | Existing Manus AI gateway base URL, if configured |
| `APP_BASE_URL` | Trusted public HTTPS origin, e.g. `https://skootly.com` |
| `STRIPE_SECRET_KEY` | Server-only Stripe credential; start with a test-mode restricted key with Checkout Sessions permissions and permissions required for inline price/product creation |

The Stripe connection inspected during development exposed Group Convert LLC in live mode. Merchant selection remains unconfirmed. No Stripe products, payments, account settings, live charges, or secrets were created or changed through that connection.

## Release procedure

1. Configure the variables in a staging instance using the current Manus hosting setup. Do not copy production secrets into this repository.
2. Apply committed migrations with `pnpm exec drizzle-kit migrate`. Migrations 0017 and 0018 add the focused pack tables and unique checkout constraint; they do not drop or rewrite existing records.
3. Run `pnpm check`, `pnpm test`, `pnpm build`. Use pnpm 10.4.1, matching the repository package-manager declaration.
4. The GitHub workflow starts disposable MySQL, applies **all** committed migrations, and runs the HTTP journey with real registration, cookie sessions, persistence, ownership checks, payment recovery, draft/public separation, and quota checks. AI and Stripe are deterministic provider fixtures. This does not prove the real provider accounts are configured correctly.
5. Before production, perform the human acceptance run below using real AI and **Stripe test mode**. Then confirm merchant account and production pricing before enabling live payments.

## Human acceptance run (required before calling this live-ready)

1. Create a coach account. Upload a real method document. Save and reopen the draft; verify the text is intact.
2. Open the pack with included access. Copy the link into a separate browser session.
3. Register as a client. Complete the profile, request ideas, choose one, and generate a page. Confirm the coach method influences the suggestions without invented claims.
4. Reload and sign out/in; verify the profile, ideas and website return. Verify another account cannot open the private project.
5. Edit copy, add a real booking link, save, publish, and open the public URL logged out. Click the CTA. Check on phone and desktop.
6. Edit without publishing; the public page must remain unchanged. Unpublish; the public URL must return 404.
7. Repeat using a newly created paid pack with Stripe test credentials. Cancel checkout, retry, complete payment, and verify access. Reopen the link after signing in again and confirm no second payment is required. Exercise delayed/unsettled payments and concurrent checkout tabs.
8. Verify network/AI failures show a recoverable error and preserve saved work.

## Explicit pilot limits

- Produces a structured one-page offer website, not arbitrary executable mini-app code.
- Social content is pasted and reviewed, not automatically scraped from social platforms.
- Only text-based PDFs are supported; scans require pasted transcripts. Files over 2 MB, over 30 pages, or over 20,000 extracted characters are rejected without silent truncation.
- New pack format is separate from the older milestone packs; there is no automatic migration of older student enrollments.
- All pack revenue goes to the single runtime Stripe account. No Stripe Connect/creator payouts, subscriptions, affiliate commissions, or tax automation.
- Payment recovery verifies Checkout directly when the client returns/checks access. There is no background webhook fulfillment; refunds/disputes do not yet revoke previously granted access automatically. Operate this as an owner-managed pilot, with access adjustments handled administratively.
- Once checkout has begun for a pack, its price is fixed; create a new pack to change the price.
- Owner trials use the coach's private project. They are not student impersonation and do not verify paid checkout.
- No password-reset email flow; existing password-change and legacy Manus recovery remain available where configured.
- API tests and a successful build do not replace a live browser acceptance run.
