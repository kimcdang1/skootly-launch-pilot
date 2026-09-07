import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { readLaunchFile } from "@/lib/launchFile";
import {
  ClientProfile,
  LaunchWebsite,
  launchPackSchema,
  renderWebsite,
} from "@shared/launch";
import {
  ArrowRight,
  Check,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  Plus,
  Sparkles,
} from "lucide-react";
import { FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import type { z } from "zod";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import "./launch.css";

export function LaunchShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  return (
    <div className="launch">
      <header className="launch-header">
        <Link href="/" className="launch-wordmark">
          skootly<span>↗</span>
        </Link>
        <nav aria-label="Main navigation">
          <Link href="/">My workspace</Link>
          {user ? (
            <button onClick={() => logout()}>Sign out</button>
          ) : (
            <Link href="/login?next=/">Sign in</Link>
          )}
        </nav>
      </header>
      <main className="launch-main">{children}</main>
      <footer className="launch-footer">
        A little guidance. Something real to show for it.
      </footer>
    </div>
  );
}
function ErrorMessage({ message }: { message?: string }) {
  return message ? (
    <p className="launch-error" role="alert">
      {message}
    </p>
  ) : null;
}
function Loading() {
  return (
    <p className="launch-loading" role="status">
      <Loader2 className="animate-spin" /> Getting your workspace…
    </p>
  );
}
function SignIn() {
  return (
    <section className="launch-card">
      <h1>Let’s save your progress.</h1>
      <p>Create an account or sign in to continue with this pack.</p>
      <Button asChild>
        <Link
          href={`/login?next=${encodeURIComponent(location.pathname + location.search)}`}
        >
          Continue <ArrowRight />
        </Link>
      </Button>
    </section>
  );
}
async function copy(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success("Link copied");
  } catch {
    toast.error("Couldn’t copy automatically. Select and copy the link below.");
  }
}

export default function LaunchHome() {
  const { user, loading } = useAuth();
  const status = trpc.launch.status.useQuery();
  const home = trpc.launch.home.useQuery(undefined, {
    enabled: Boolean(user),
    retry: false,
  });
  return (
    <LaunchShell>
      {loading ? (
        <Loading />
      ) : (
        <>
          <section className="launch-hero">
            <span className="launch-eyebrow">
              YOUR COACH’S METHOD. YOUR NEXT MOVE.
            </span>
            <h1>
              From “I have an idea”
              <br />
              to <em>“here’s my page.”</em>
            </h1>
            <p>
              A little of your coach’s genius. A little of you. One offer
              website you can actually share.
            </p>
            {!user ? (
              <Button size="lg" asChild>
                <Link href="/login?next=/">
                  Create your coach pack <ArrowRight />
                </Link>
              </Button>
            ) : null}
          </section>
          {status.data && (!status.data.accounts || !status.data.ai) ? (
            <aside className="launch-notice">
              <b>Skootly setup is still in progress.</b>
              <p>
                {!status.data.accounts
                  ? "Account storage needs to be connected. "
                  : ""}
                {!status.data.ai
                  ? "AI creation needs to be connected before clients can build pages."
                  : ""}
              </p>
            </aside>
          ) : null}
          {user ? (
            <>
              <ErrorMessage message={home.error?.message} />
              {home.isLoading ? <Loading /> : null}
              {home.data?.projects.length ? (
                <section className="launch-section">
                  <h2>Pick up where you left off</h2>
                  <div className="launch-grid">
                    {home.data.projects.map(p => (
                      <Link
                        className="launch-card launch-link-card"
                        href={`/project/${p.id}`}
                        key={p.id}
                      >
                        <span className="launch-eyebrow">
                          {p.published ? "PAGE PUBLISHED" : "IN PROGRESS"}
                        </span>
                        <h3>{p.name}</h3>
                        <span>
                          Continue my next step <ArrowRight />
                        </span>
                      </Link>
                    ))}
                  </div>
                </section>
              ) : null}
              <section className="launch-section">
                <div className="launch-section-title">
                  <div>
                    <span className="launch-eyebrow">FOR COACHES</span>
                    <h2>Your website packs</h2>
                  </div>
                  <Button asChild>
                    <Link href="/pack/new">
                      <Plus /> Create a pack
                    </Link>
                  </Button>
                </div>
                <div className="launch-grid">
                  {home.data?.packs.map(p => (
                    <Link
                      key={p.id}
                      href={`/pack/${p.id}/edit`}
                      className="launch-card launch-link-card"
                    >
                      <span className="launch-eyebrow">
                        {p.published ? "OPEN TO CLIENTS" : "DRAFT"}
                      </span>
                      <h3>{p.name}</h3>
                      <p>{p.promise}</p>
                      <span>
                        Edit pack <ArrowRight />
                      </span>
                    </Link>
                  ))}
                </div>
                {home.data && !home.data.packs.length ? (
                  <div className="launch-empty">
                    <h3>Your method can do more than sit in a course.</h3>
                    <p>
                      Upload your notes, set access, and give clients a guided
                      way to create their offer page.
                    </p>
                  </div>
                ) : null}
              </section>
              <p className="launch-muted">
                Here as a client? Open the pack link your coach shared in your
                community.
              </p>
            </>
          ) : (
            <section className="launch-grid launch-steps">
              {[
                [
                  "01",
                  "Bring your method",
                  "Upload coaching notes or a transcript. Review what clients will use.",
                ],
                [
                  "02",
                  "Make it theirs",
                  "Clients describe their business and choose one focused offer idea.",
                ],
                [
                  "03",
                  "Build something real",
                  "Create, edit and publish an offer page with a working next-step link.",
                ],
              ].map(([n, title, text]) => (
                <article className="launch-card" key={n}>
                  <span className="launch-step-number">{n}</span>
                  <h2>{title}</h2>
                  <p>{text}</p>
                </article>
              ))}
            </section>
          )}
        </>
      )}
    </LaunchShell>
  );
}

type PackDraft = z.infer<typeof launchPackSchema>;
export function LaunchPackEditor({ params }: { params?: { id?: string } }) {
  const { user, loading } = useAuth();
  const query = trpc.launch.editPack.useQuery(
    { id: params?.id || "" },
    { enabled: Boolean(user && params?.id), retry: false }
  );
  if (loading || (user && params?.id && query.isLoading))
    return (
      <LaunchShell>
        <Loading />
      </LaunchShell>
    );
  if (!user)
    return (
      <LaunchShell>
        <SignIn />
      </LaunchShell>
    );
  if (query.error)
    return (
      <LaunchShell>
        <ErrorMessage message={query.error.message} />
      </LaunchShell>
    );
  return (
    <LaunchShell>
      <PackForm
        key={params?.id || "new"}
        initial={query.data}
        onSaved={() => query.refetch()}
      />
    </LaunchShell>
  );
}
function PackForm({
  initial,
  onSaved,
}: {
  initial?: PackDraft & { id: string; published: boolean };
  onSaved: () => unknown;
}) {
  const [, navigate] = useLocation();
  const [draft, setDraft] = useState<PackDraft>(
    initial || {
      name: "",
      coach: "",
      promise: "",
      method: "",
      priceCents: 0,
      communityUrl: "",
    }
  );
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const create = trpc.launch.createPack.useMutation({
    onSuccess: p => navigate(`/pack/${p.id}/edit`),
  });
  const save = trpc.launch.savePack.useMutation({
    onSuccess: () => {
      onSaved();
      toast.success("Pack saved");
    },
  });
  const preview = trpc.launch.access.useMutation({
    onSuccess: p => p.projectId && navigate(`/project/${p.projectId}`),
  });
  const pending =
    create.isPending || save.isPending || reading || preview.isPending;
  function submit(e: FormEvent, published = initial?.published || false) {
    e.preventDefault();
    setError("");
    const result = launchPackSchema.safeParse(draft);
    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }
    if (initial) save.mutate({ ...result.data, id: initial.id, published });
    else create.mutate(result.data);
  }
  const field = (key: keyof PackDraft, value: string | number) =>
    setDraft(d => ({ ...d, [key]: value }));
  return (
    <>
      <Link className="launch-back" href="/">
        ← My workspace
      </Link>
      <div className="launch-editor-heading">
        <span className="launch-eyebrow">COACH PACK · ONE CLEAR OUTCOME</span>
        <h1>
          Your genius.
          <br />
          <em>Their launch page.</em>
        </h1>
        <p>
          Give Skoot the method you want your clients to use. They’ll leave with
          one offer website.
        </p>
      </div>
      <form className="launch-card launch-form" onSubmit={submit}>
        <h2>1. Give your pack a promise</h2>
        <div className="launch-two">
          <Label>
            Pack name
            <Input
              value={draft.name}
              onChange={e => field("name", e.target.value)}
              required
              minLength={3}
              maxLength={150}
              placeholder="Your First Offer Page"
            />
          </Label>
          <Label>
            Coach or brand name
            <Input
              value={draft.coach}
              onChange={e => field("coach", e.target.value)}
              required
              minLength={2}
              maxLength={120}
              placeholder="Soul"
            />
          </Label>
        </div>
        <Label>
          What should this pack help a client do?
          <Textarea
            value={draft.promise}
            onChange={e => field("promise", e.target.value)}
            required
            minLength={10}
            maxLength={1000}
            placeholder="Choose a simple offer and create a page you can share with your first five potential buyers."
          />
        </Label>
        <h2>2. Bring your method</h2>
        <p>
          Include your steps, examples, what makes a good offer, and what to
          avoid. This source stays behind pack access; it isn’t published on the
          offer page.
        </p>
        <Label>
          Upload PDF, TXT or Markdown (up to 2 MB)
          <Input
            type="file"
            accept=".pdf,.txt,.md"
            disabled={pending}
            onChange={async e => {
              const f = e.target.files?.[0];
              if (!f) return;
              setReading(true);
              setError("");
              try {
                field("method", await readLaunchFile(f));
              } catch (err) {
                setError((err as Error).message);
              } finally {
                setReading(false);
              }
            }}
          />
        </Label>
        <Label>
          Review and edit your coaching material
          <Textarea
            className="launch-source"
            value={draft.method}
            onChange={e => field("method", e.target.value)}
            required
            minLength={50}
            maxLength={20000}
            placeholder="Start by identifying a problem your audience already wants solved…"
          />
        </Label>
        <span className="launch-muted">
          {draft.method.length.toLocaleString()} / 20,000 characters. Use
          material you have permission to share.
        </span>
        <h2>3. Set client access</h2>
        <div className="launch-two">
          <Label>
            One-time price (USD)
            <Input
              type="number"
              min={0}
              max={1000}
              step="0.01"
              value={draft.priceCents / 100}
              onChange={e =>
                field("priceCents", Math.round(Number(e.target.value) * 100))
              }
              required
            />
            <span className="launch-muted">
              Use $0 for clients already enrolled in your coaching.
            </span>
          </Label>
          <Label>
            Skool community link (optional)
            <Input
              type="url"
              value={draft.communityUrl}
              onChange={e => field("communityUrl", e.target.value)}
              placeholder="https://www.skool.com/your-community"
            />
          </Label>
        </div>
        <p className="launch-muted">
          Each client gets one page and up to 12 AI attempts, plus manual
          editing. Payments go to Skootly’s configured Stripe account; coach
          payouts are not part of this pilot.
        </p>
        <ErrorMessage
          message={
            error ||
            create.error?.message ||
            save.error?.message ||
            preview.error?.message
          }
        />
        <div className="launch-actions">
          <Button disabled={pending} type="submit">
            {pending ? <Loader2 className="animate-spin" /> : <Check />} Save{" "}
            {initial ? "changes" : "my draft"}
          </Button>
          {initial ? (
            <>
              <Button
                disabled={pending}
                type="button"
                variant="outline"
                onClick={e => submit(e, !initial.published)}
              >
                {initial.published
                  ? "Close to new clients"
                  : "Open pack to clients"}
              </Button>
              <Button
                type="button"
                disabled={pending}
                variant="ghost"
                onClick={() => preview.mutate({ id: initial.id })}
              >
                Try as a client <ArrowRight />
              </Button>
            </>
          ) : null}
        </div>
      </form>
      {initial?.published ? (
        <section className="launch-card launch-success">
          <h2>Your pack is ready to share</h2>
          <p>
            Post this link in your community. Clients sign in and unlock their
            own private project.
          </p>
          <Input
            readOnly
            aria-label="Pack link"
            value={`${location.origin}/pack/${initial.id}`}
          />
          <Button onClick={() => copy(`${location.origin}/pack/${initial.id}`)}>
            <Copy /> Copy pack link
          </Button>
        </section>
      ) : null}
    </>
  );
}

export function LaunchPack({ params }: { params: { id: string } }) {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const pack = trpc.launch.pack.useQuery({ id: params.id }, { retry: false });
  const access = trpc.launch.access.useMutation({
    onSuccess: p => {
      if (p.projectId) navigate(`/project/${p.projectId}`);
    },
  });
  const checkout = trpc.launch.checkout.useMutation({
    onSuccess: p => {
      window.location.href = p.url;
    },
  });
  const checked = useRef("");
  useEffect(() => {
    const key = `${user?.id}:${params.id}`;
    if (user && pack.data && checked.current !== key) {
      checked.current = key;
      access.mutate({ id: params.id });
    }
  }, [user?.id, params.id, pack.data]);
  if (pack.isLoading || loading)
    return (
      <LaunchShell>
        <Loading />
      </LaunchShell>
    );
  if (!pack.data)
    return (
      <LaunchShell>
        <ErrorMessage message={pack.error?.message || "Pack unavailable"} />
      </LaunchShell>
    );
  const p = pack.data;
  return (
    <LaunchShell>
      <section className="launch-card launch-pack-intro">
        <span className="launch-eyebrow">A SKOOT PACK BY {p.coach}</span>
        <h1>{p.name}</h1>
        <p>{p.promise}</p>
        <ol className="launch-outline">
          <li>Tell Skoot about your business and voice.</li>
          <li>Pick one of three ideas shaped by your coach’s method.</li>
          <li>Create, edit and publish your offer page.</li>
        </ol>
        <strong className="launch-price">
          {p.priceCents
            ? `$${(p.priceCents / 100).toFixed(2)} USD`
            : "Included access"}
        </strong>
        <p className="launch-muted">
          {p.priceCents ? "One-time payment. " : ""}One website, 12 AI attempts,
          and manual editing.
        </p>
        {new URLSearchParams(location.search).get("payment") === "canceled" ? (
          <p>Checkout was canceled. You can try again when you’re ready.</p>
        ) : null}
        {!user ? (
          <Button asChild>
            <Link
              href={`/login?next=${encodeURIComponent(location.pathname + location.search)}`}
            >
              Sign in or create account <ArrowRight />
            </Link>
          </Button>
        ) : (
          <div className="launch-actions">
            <Button
              disabled={access.isPending || checkout.isPending}
              onClick={() =>
                p.priceCents
                  ? checkout.mutate({ id: p.id })
                  : access.mutate({ id: p.id })
              }
            >
              {access.isPending || checkout.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <ArrowRight />
              )}
              {p.priceCents ? "Unlock my pack" : "Start my page"}
            </Button>
            {p.priceCents ? (
              <Button
                variant="outline"
                disabled={access.isPending || checkout.isPending}
                onClick={() => access.mutate({ id: p.id })}
              >
                I already paid · check access
              </Button>
            ) : null}
          </div>
        )}
        {user &&
        access.isSuccess &&
        !access.data.projectId &&
        new URLSearchParams(location.search).get("payment") === "returned" ? (
          <p role="status">
            Payment is not confirmed yet. If your payment is processing, wait a
            moment and check access again.
          </p>
        ) : null}
        <ErrorMessage
          message={access.error?.message || checkout.error?.message}
        />
      </section>
    </LaunchShell>
  );
}

export function LaunchProject({ params }: { params: { id: string } }) {
  const { user, loading } = useAuth();
  const project = trpc.launch.project.useQuery(
    { id: params.id },
    { enabled: Boolean(user), retry: false }
  );
  if (loading || (user && project.isLoading))
    return (
      <LaunchShell>
        <Loading />
      </LaunchShell>
    );
  if (!user)
    return (
      <LaunchShell>
        <SignIn />
      </LaunchShell>
    );
  if (!project.data)
    return (
      <LaunchShell>
        <ErrorMessage
          message={project.error?.message || "Project unavailable"}
        />
      </LaunchShell>
    );
  return (
    <LaunchShell>
      <ProjectFlow
        key={params.id}
        project={project.data}
        refresh={async () => {
          await project.refetch();
        }}
      />
    </LaunchShell>
  );
}
type Project = inferRouterOutputs<AppRouter>["launch"]["project"];
function ProjectFlow({
  project: p,
  refresh,
}: {
  project: Project;
  refresh: () => Promise<void>;
}) {
  const [stage, setStage] = useState(p.website ? 3 : p.profile ? 2 : 1);
  const [profile, setProfile] = useState<ClientProfile>(
    p.profile || {
      name: "",
      business: "",
      audience: "",
      voice: "",
      socialBio: "",
    }
  );
  const [selected, setSelected] = useState<number | null>(null);
  const saveProfile = trpc.launch.saveProfile.useMutation({
    onSuccess: async () => {
      await refresh();
      setStage(2);
    },
  });
  const ideas = trpc.launch.ideas.useMutation({ onSettled: refresh });
  const build = trpc.launch.build.useMutation({
    onSuccess: async () => {
      await refresh();
      setStage(3);
    },
    onError: refresh,
  });
  const busy = saveProfile.isPending || ideas.isPending || build.isPending;
  return (
    <>
      <Link className="launch-back" href="/">
        ← My workspace
      </Link>
      <div className="launch-editor-heading">
        <span className="launch-eyebrow">
          {p.pack.name} · WITH {p.pack.coach}
        </span>
        <h1>
          Let’s make your
          <br />
          <em>next move real.</em>
        </h1>
      </div>
      <ol className="launch-progress" aria-label="Your progress">
        {["A little about you", "Pick your idea", "Create & share"].map(
          (label, i) => (
            <li key={label} aria-current={stage === i + 1 ? "step" : undefined}>
              <span>{i + 1}</span>
              {label}
            </li>
          )
        )}
      </ol>
      {stage === 1 ? (
        <form
          className="launch-card launch-form"
          onSubmit={e => {
            e.preventDefault();
            saveProfile.mutate({ id: p.id, profile });
          }}
        >
          <h2>Meet your Skoot.</h2>
          <p>
            This small profile helps Skoot create in your voice. You can review
            and change every detail.
          </p>
          <div className="launch-two">
            <Label>
              Your name or brand
              <Input
                required
                minLength={2}
                maxLength={120}
                value={profile.name}
                onChange={e =>
                  setProfile(v => ({ ...v, name: e.target.value }))
                }
              />
            </Label>
            <Label>
              Who do you want to help?
              <Input
                required
                minLength={3}
                maxLength={1000}
                placeholder="New coaches with an audience but no clear offer"
                value={profile.audience}
                onChange={e =>
                  setProfile(v => ({ ...v, audience: e.target.value }))
                }
              />
            </Label>
          </div>
          <Label>
            What do you do, and what can you help someone achieve?
            <Textarea
              required
              minLength={10}
              maxLength={2000}
              value={profile.business}
              onChange={e =>
                setProfile(v => ({ ...v, business: e.target.value }))
              }
            />
          </Label>
          <Label>
            How should your page sound?
            <Input
              required
              minLength={3}
              maxLength={1000}
              placeholder="Warm, direct, a little playful"
              value={profile.voice}
              onChange={e => setProfile(v => ({ ...v, voice: e.target.value }))}
            />
          </Label>
          <Label>
            Paste your social bio or a few posts (optional)
            <Textarea
              maxLength={4000}
              value={profile.socialBio}
              onChange={e =>
                setProfile(v => ({ ...v, socialBio: e.target.value }))
              }
            />
          </Label>
          <p className="launch-muted">
            Paste the actual text you want Skoot to learn from. This version
            does not automatically read social profile links.
          </p>
          {p.website ? (
            <p>
              Your current page stays saved. Changing your profile resets the
              idea suggestions for your next draft.
            </p>
          ) : null}
          <ErrorMessage message={saveProfile.error?.message} />
          <Button disabled={busy}>
            Save my profile <ArrowRight />
          </Button>
        </form>
      ) : null}
      {stage === 2 ? (
        <section className="launch-card">
          <span className="launch-eyebrow">ONE IDEA IS ENOUGH TO START</span>
          <h2>What would you like to put into the world?</h2>
          <p>
            Skoot combines your profile with {p.pack.coach}’s method to suggest
            three offers. Pick the one you’d actually want to talk to a buyer
            about.
          </p>
          <div className="launch-actions">
            <Button
              disabled={busy || p.generationCount >= 12}
              onClick={() => {
                setSelected(null);
                ideas.mutate({ id: p.id });
              }}
            >
              {ideas.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Sparkles />
              )}
              {p.ideas ? "Suggest three new ideas" : "Find my three ideas"}
            </Button>
            <Button disabled={busy} variant="ghost" onClick={() => setStage(1)}>
              Edit my profile
            </Button>
            {p.website ? (
              <Button
                disabled={busy}
                variant="ghost"
                onClick={() => setStage(3)}
              >
                Back to my saved page
              </Button>
            ) : null}
          </div>
          <div
            className="launch-grid launch-idea-grid"
            role="group"
            aria-label="Choose an offer"
          >
            {p.ideas?.map((idea, i) => (
              <button
                disabled={busy}
                aria-pressed={selected === i}
                className={`launch-idea ${selected === i ? "selected" : ""}`}
                key={`${idea.title}-${i}`}
                onClick={() => setSelected(i)}
              >
                <span className="launch-eyebrow">IDEA 0{i + 1}</span>
                <h3>{idea.title}</h3>
                <p>{idea.promise}</p>
                <small>{idea.reason}</small>
                <strong>
                  {selected === i ? "Selected ✓" : "Choose this idea"}
                </strong>
              </button>
            ))}
          </div>
          <ErrorMessage
            message={ideas.error?.message || build.error?.message}
          />
          {selected !== null ? (
            <Button
              size="lg"
              disabled={busy || p.generationCount >= 12}
              onClick={() => build.mutate({ id: p.id, ideaIndex: selected })}
            >
              {build.isPending ? (
                <>
                  <Loader2 className="animate-spin" /> Creating your page…
                </>
              ) : (
                <>
                  <Sparkles /> Create my website
                </>
              )}
            </Button>
          ) : null}
          <p className="launch-muted">
            {Math.max(0, 12 - p.generationCount)} AI attempts remaining. Each
            set of ideas or page draft uses one attempt. Failed requests may
            also count.
          </p>
        </section>
      ) : null}
      {stage === 3 && p.website && p.profile ? (
        <WebsiteEditor project={p} refresh={refresh} back={() => setStage(2)} />
      ) : null}
    </>
  );
}

function WebsiteEditor({
  project: p,
  refresh,
  back,
}: {
  project: Project;
  refresh: () => Promise<void>;
  back: () => void;
}) {
  const [site, setSite] = useState<LaunchWebsite>(p.website!);
  const [ctaUrl, setCtaUrl] = useState(p.ctaUrl || "");
  const [savedMessage, setSavedMessage] = useState("");
  const dirty =
    JSON.stringify(site) !== JSON.stringify(p.website) ||
    ctaUrl !== (p.ctaUrl || "");
  const save = trpc.launch.saveWebsite.useMutation({
    onSuccess: async () => {
      await refresh();
      setSavedMessage(
        "Draft saved. Publish when you’re ready to share this version."
      );
    },
  });
  const publish = trpc.launch.publish.useMutation({
    onSuccess: async () => {
      await refresh();
      setSavedMessage(
        "Your page is live. Send it to five potential buyers and ask what’s clear—or missing."
      );
    },
  });
  const unpublish = trpc.launch.unpublish.useMutation({
    onSuccess: async () => {
      await refresh();
      setSavedMessage("Your public page is offline. Your draft is saved.");
    },
  });
  const busy = save.isPending || publish.isPending || unpublish.isPending;
  // Preview links are inert inside the sandbox. The published page contains the real CTA.
  const html = renderWebsite(
    site,
    p.profile!.name,
    /^https:\/\//.test(ctaUrl)
      ? (() => {
          try {
            const u = new URL(ctaUrl);
            return u.username || u.password ? "" : u.href;
          } catch {
            return "";
          }
        })()
      : ""
  );
  function download() {
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "my-skootly-offer-page.html";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <>
      <section className="launch-card">
        <div className="launch-section-title">
          <div>
            <span className="launch-eyebrow">YOUR IDEA, MADE REAL</span>
            <h2>Give it your final touch.</h2>
          </div>
          <Button variant="ghost" disabled={busy || dirty} onClick={back}>
            Revisit my idea
          </Button>
        </div>
        <p>
          Review the copy, add your booking or checkout link, then publish. Your
          page is hosted right here in Skootly.
        </p>
        <div className="launch-workbench">
          <form
            className="launch-form"
            onSubmit={e => {
              e.preventDefault();
              setSavedMessage("");
              save.mutate({ id: p.id, website: site, ctaUrl });
            }}
          >
            <Label>
              Headline
              <Input
                required
                minLength={3}
                maxLength={180}
                value={site.headline}
                onChange={e =>
                  setSite(s => ({ ...s, headline: e.target.value }))
                }
              />
            </Label>
            <Label>
              Your promise
              <Textarea
                required
                minLength={10}
                maxLength={800}
                value={site.subheading}
                onChange={e =>
                  setSite(s => ({ ...s, subheading: e.target.value }))
                }
              />
            </Label>
            {site.benefits.map((benefit, i) => (
              <Label key={i}>
                Benefit {i + 1}
                <Textarea
                  required
                  minLength={3}
                  maxLength={300}
                  value={benefit}
                  onChange={e =>
                    setSite(s => ({
                      ...s,
                      benefits: s.benefits.map((b, n) =>
                        i === n ? e.target.value : b
                      ),
                    }))
                  }
                />
              </Label>
            ))}
            <Label>
              About you
              <Textarea
                required
                minLength={10}
                maxLength={1500}
                value={site.about}
                onChange={e => setSite(s => ({ ...s, about: e.target.value }))}
              />
            </Label>
            <Label>
              Button text
              <Input
                required
                minLength={2}
                maxLength={80}
                value={site.ctaLabel}
                onChange={e =>
                  setSite(s => ({ ...s, ctaLabel: e.target.value }))
                }
              />
            </Label>
            <Label>
              Where should the button take visitors?
              <Input
                type="url"
                placeholder="https://your-booking-or-checkout-link.com"
                value={ctaUrl}
                onChange={e => setCtaUrl(e.target.value)}
                maxLength={2000}
              />
            </Label>
            <p className="launch-muted">
              Use your real booking, checkout or contact page. An HTTPS link is
              required to publish.
            </p>
            <Button disabled={busy} type="submit">
              {save.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Check />
              )}{" "}
              Save page
            </Button>
          </form>
          <div className="launch-preview">
            <span>LIVE DRAFT PREVIEW · links activate after publishing</span>
            <iframe title="Your offer page preview" sandbox="" srcDoc={html} />
          </div>
        </div>
        <ErrorMessage
          message={
            save.error?.message ||
            publish.error?.message ||
            unpublish.error?.message
          }
        />
        {savedMessage ? (
          <p role="status" className="launch-notice">
            {savedMessage}
          </p>
        ) : null}
        <div className="launch-publish">
          <div>
            <h3>
              {dirty
                ? "Save your changes first."
                : "Ready for someone to see this?"}
            </h3>
            <p>
              Publishing makes this page public. Review your claims and contact
              link before sharing.
            </p>
          </div>
          <Button
            size="lg"
            disabled={busy || dirty || !p.ctaUrl}
            onClick={() => publish.mutate({ id: p.id })}
          >
            {publish.isPending ? (
              <Loader2 className="animate-spin" />
            ) : (
              <ExternalLink />
            )}
            {p.published ? "Publish this version" : "Publish my page"}
          </Button>
          <Button
            disabled={busy || dirty || !p.ctaUrl}
            variant="outline"
            onClick={download}
          >
            <Download /> Download HTML
          </Button>
        </div>
      </section>
      {p.published ? (
        <section className="launch-card launch-success">
          <span className="launch-eyebrow">YOU HAVE SOMETHING TO SHARE</span>
          <h2>Your next Skoot: get it in front of five people.</h2>
          <p>
            Send your page to five potential buyers. Ask: “Is it clear who this
            is for and what you’d get?”
          </p>
          <Input
            readOnly
            aria-label="Published page link"
            value={`${location.origin}/p/${p.id}`}
          />
          <div className="launch-actions">
            <Button onClick={() => copy(`${location.origin}/p/${p.id}`)}>
              <Copy /> Copy my page link
            </Button>
            <Button asChild variant="outline">
              <a href={`/p/${p.id}`} target="_blank" rel="noreferrer">
                Open page <ExternalLink />
              </a>
            </Button>
            {p.pack.communityUrl ? (
              <Button asChild variant="outline">
                <a href={p.pack.communityUrl} target="_blank" rel="noreferrer">
                  Back to my community
                </a>
              </Button>
            ) : null}
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => unpublish.mutate({ id: p.id })}
            >
              Take page offline
            </Button>
          </div>
        </section>
      ) : null}
    </>
  );
}
