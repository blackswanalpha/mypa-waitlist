"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import {
  ArrowPathIcon,
  DocumentDuplicateIcon,
  EnvelopeIcon,
  ExclamationTriangleIcon,
  PaperAirplaneIcon,
  PlusIcon,
  StopIcon,
  TrashIcon,
} from "@heroicons/react/16/solid";
import { InboxStackIcon, NoSymbolIcon } from "@heroicons/react/24/outline";
import { toast } from "sonner";

import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  campaignHtml,
  waitlistConfirmationHtml,
} from "@/convex/emails/templates";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, Eyebrow, Panel, Segmented, SkeletonRows, StatusPill, type Tone } from "@/components/admin/kit";
import { cn } from "@/lib/utils";

type Campaign = Doc<"campaigns">;
type WaitlistStatus = "pending" | "invited" | "registered";
type Draft = Pick<
  Campaign,
  "name" | "subject" | "preheader" | "heading" | "body" | "ctaLabel" | "ctaUrl" | "audience"
>;

const BLANK: Draft = {
  name: "",
  subject: "",
  preheader: "",
  heading: "Hi {{name}},",
  body: "",
  ctaLabel: "",
  ctaUrl: "",
  audience: { waitlist: ["pending", "invited"], feedback: false, contact: false },
};

/** Only the editable fields — a stored campaign also carries _id, status, stats. */
function toDraft(c: Draft): Draft {
  return {
    name: c.name,
    subject: c.subject,
    preheader: c.preheader,
    heading: c.heading,
    body: c.body,
    ctaLabel: c.ctaLabel ?? "",
    ctaUrl: c.ctaUrl ?? "",
    audience: c.audience,
  };
}

const STATUS_LABEL: Record<WaitlistStatus, string> = {
  pending: "Pending",
  invited: "Whitelisted",
  registered: "Registered",
};

/** ConvexError carries its message in .data, which survives prod redaction. */
const errMsg = (e: unknown) =>
  e instanceof ConvexError && typeof e.data === "string"
    ? e.data
    : "Something went wrong — check the Convex logs.";

function fmt(ts?: number) {
  return ts
    ? new Date(ts).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
}

const CAMPAIGN_TONE: Record<Campaign["status"], Tone> = {
  draft: "neutral",
  sending: "info",
  sent: "brand",
  cancelled: "danger",
};

function statusBadge(status: Campaign["status"]) {
  return (
    <StatusPill tone={CAMPAIGN_TONE[status]} className="capitalize">
      {status}
    </StatusPill>
  );
}

const TABLE =
  "[&_td]:px-3 [&_td]:py-2.5 [&_th]:h-10 [&_th]:px-3 [&_th]:text-xs [&_th]:font-medium [&_th]:text-muted-foreground [&_td:first-child]:pl-4 [&_th:first-child]:pl-4 [&_td:last-child]:pr-4 [&_th:last-child]:pr-4";

/** Sandboxed render of an email exactly as the pipeline builds it, scaled down to fit its column. */
const EMAIL_W = 640;
const EMAIL_H = 680;

function EmailPreview({ html, className }: { html: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setScale(Math.min(1, entry.contentRect.width / EMAIL_W)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={cn("overflow-hidden rounded-xl border border-border bg-[#141b17] shadow-float", className)}
      style={{ height: EMAIL_H * scale }}
    >
      <iframe
        title="Email preview"
        sandbox=""
        srcDoc={html}
        className="block border-0"
        style={{ width: EMAIL_W, height: EMAIL_H, transform: `scale(${scale})`, transformOrigin: "0 0" }}
      />
    </div>
  );
}

function ConfigStrip() {
  const cfg = useQuery(api.campaigns.config);
  if (!cfg) return null;
  const issues: string[] = [];
  if (!cfg.apiKey) issues.push("RESEND_API_KEY is not set — nothing can be sent.");
  if (cfg.testMode)
    issues.push(
      "Resend test mode is on — only @resend.dev test addresses receive mail, including signup confirmations. Set RESEND_TEST_MODE=false.",
    );
  if (!cfg.verifiedSender)
    issues.push("Sending from Resend's shared test sender. Set RESEND_FROM or EMAIL_DOMAIN to a verified domain.");
  if (!cfg.webhook)
    issues.push(
      `Delivery tracking is off. Add a Resend webhook to ${cfg.webhookUrl} and set RESEND_WEBHOOK_SECRET.`,
    );

  return (
    <div className="border-b border-border px-5 py-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 text-xs text-muted-foreground">
        <span>
          From <span className="font-medium text-foreground">{cfg.from}</span>
        </span>
        <span>
          Replies to <span className="font-medium text-foreground">{cfg.replyTo}</span>
        </span>
        {issues.length === 0 ? (
          <StatusPill tone="brand" className="ml-auto">
            Ready to send
          </StatusPill>
        ) : (
          <StatusPill tone="warn" className="ml-auto">
            {issues.length} setup issue{issues.length === 1 ? "" : "s"}
          </StatusPill>
        )}
      </div>
      {issues.length > 0 && (
        <ul className="mt-3 space-y-1.5 rounded-xl bg-warn/10 px-3.5 py-3 ring-1 ring-inset ring-warn/25">
          {issues.map((i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-foreground">
              <ExclamationTriangleIcon className="mt-0.5 size-3.5 flex-none text-warn" />
              {i}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value, of }: { label: string; value: number; of?: number }) {
  const pct = of ? Math.round((value / of) * 100) : undefined;
  return (
    <div className="rounded-xl border border-border bg-surface/60 p-3.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1.5 font-heading text-2xl font-semibold tabular-nums tracking-[-0.02em] text-foreground">
        {value.toLocaleString()}
        {pct !== undefined && <span className="ml-1.5 font-sans text-xs font-normal text-muted-foreground">{pct}%</span>}
      </p>
    </div>
  );
}

function Recipients({ id }: { id: Id<"campaigns"> }) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.campaigns.recipients,
    { id },
    { initialNumItems: 25 },
  );
  if (status === "LoadingFirstPage") return <SkeletonRows rows={3} />;
  if (results.length === 0)
    return <p className="py-8 text-center text-sm text-muted-foreground">No recipients yet.</p>;
  return (
    <>
      <Table className={TABLE}>
        <TableHeader className="bg-surface/60">
          <TableRow className="hover:bg-transparent">
            <TableHead>Recipient</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Engagement</TableHead>
            <TableHead>Queued</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {results.map((r) => (
            <TableRow key={r._id}>
              <TableCell>{r.email}</TableCell>
              <TableCell className="capitalize text-muted-foreground">{r.source}</TableCell>
              <TableCell>
                <span
                  className={cn(
                    "text-xs",
                    r.status === "delivered" && "text-brand-ink",
                    (r.status === "bounced" || r.status === "failed" || r.status === "complained") &&
                      "text-destructive",
                  )}
                  title={r.error}
                >
                  {r.status ?? "queued"}
                </span>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {[r.openedAt && "opened", r.clickedAt && "clicked"].filter(Boolean).join(" · ") || "—"}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">{fmt(r.sentAt)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {status === "CanLoadMore" && (
        <div className="flex justify-center border-t border-border py-3">
          <Button variant="ghost" size="sm" onClick={() => loadMore(50)}>
            Load more
          </Button>
        </div>
      )}
    </>
  );
}

function CampaignReport({ campaign }: { campaign: Campaign }) {
  const cancel = useMutation(api.campaigns.cancel);
  const duplicate = useMutation(api.campaigns.duplicate);
  const s = campaign.stats;
  const html = useMemo(() => campaignHtml(campaign, { name: "Ada Lovelace" }), [campaign]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-heading text-xl font-semibold tracking-[-0.02em] text-foreground">{campaign.name}</h3>
            {statusBadge(campaign.status)}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            “{campaign.subject}” · started {fmt(campaign.startedAt)}
            {campaign.finishedAt && ` · finished ${fmt(campaign.finishedAt)}`}
          </p>
        </div>
        <div className="flex gap-2">
          {campaign.status === "sending" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => cancel({ id: campaign._id }).catch((e) => toast.error(errMsg(e)))}
            >
              <StopIcon /> Stop sending
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              duplicate({ id: campaign._id })
                .then(() => toast.success("Copied to a new draft."))
                .catch((e) => toast.error(errMsg(e)))
            }
          >
            <DocumentDuplicateIcon /> Duplicate
          </Button>
        </div>
      </div>

      {campaign.status === "sending" && (
        <p className="flex items-center gap-2 text-sm text-viz-views">
          <ArrowPathIcon className="size-4 animate-spin" /> Queuing recipients in batches of 100…
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Queued" value={s.queued} />
        <Stat label="Delivered" value={s.delivered} of={s.queued} />
        <Stat label="Opened" value={s.opened} of={s.delivered || s.queued} />
        <Stat label="Clicked" value={s.clicked} of={s.delivered || s.queued} />
        <Stat label="Skipped" value={s.skipped} />
        <Stat label="Bounced" value={s.bounced} />
        <Stat label="Spam reports" value={s.complained} />
        <Stat label="Failed" value={s.failed} />
      </div>

      <div className="grid gap-6 2xl:grid-cols-2">
        <div className="min-w-0">
          <Eyebrow className="mb-2">Recipients</Eyebrow>
          <div className="overflow-x-auto rounded-xl border border-border">
            <Recipients id={campaign._id} />
          </div>
        </div>
        <div className="min-w-0">
          <Eyebrow className="mb-2">What was sent</Eyebrow>
          <EmailPreview html={html} />
        </div>
      </div>
    </div>
  );
}

function CampaignEditor({
  campaign,
  adminEmail,
  onSaved,
  onDeleted,
}: {
  campaign: Campaign | null;
  adminEmail: string;
  onSaved: (id: Id<"campaigns">) => void;
  onDeleted: () => void;
}) {
  const create = useMutation(api.campaigns.create);
  const update = useMutation(api.campaigns.update);
  const remove = useMutation(api.campaigns.remove);
  const sendTest = useMutation(api.campaigns.sendTest);
  const start = useMutation(api.campaigns.start);

  const [draft, setDraft] = useState<Draft>(() => (campaign ? toDraft(campaign) : BLANK));
  const [testTo, setTestTo] = useState(adminEmail);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const estimate = useQuery(api.campaigns.audienceEstimate, { audience: draft.audience });
  const html = useMemo(() => campaignHtml(draft, { name: "Ada Lovelace" }), [draft]);

  const dirty = !campaign || JSON.stringify(toDraft(campaign)) !== JSON.stringify(toDraft(draft));

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const payload = () => ({
    ...toDraft(draft),
    ctaLabel: draft.ctaLabel?.trim() || undefined,
    ctaUrl: draft.ctaUrl?.trim() || undefined,
  });

  const save = async (): Promise<Id<"campaigns"> | null> => {
    try {
      if (campaign) {
        await update({ id: campaign._id, ...payload() });
        return campaign._id;
      }
      const id = await create(payload());
      onSaved(id);
      return id;
    } catch (e) {
      toast.error(errMsg(e));
      return null;
    }
  };

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  const toggleStatus = (s: WaitlistStatus, on: boolean) =>
    set("audience", {
      ...draft.audience,
      waitlist: on
        ? [...draft.audience.waitlist, s]
        : draft.audience.waitlist.filter((x) => x !== s),
    });

  return (
    <div className="grid gap-8 2xl:grid-cols-2">
      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="c-name">Campaign name (internal)</Label>
          <Input id="c-name" value={draft.name} onChange={(e) => set("name", e.target.value)} placeholder="October progress update" />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="c-subject">Subject</Label>
            <Input id="c-subject" value={draft.subject} onChange={(e) => set("subject", e.target.value)} placeholder="What we built this month" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-pre">Preview text</Label>
            <Input id="c-pre" value={draft.preheader} onChange={(e) => set("preheader", e.target.value)} placeholder="Shown after the subject in the inbox" />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="c-heading">Heading</Label>
          <Input id="c-heading" value={draft.heading} onChange={(e) => set("heading", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="c-body">Body</Label>
          <Textarea
            id="c-body"
            rows={10}
            value={draft.body}
            onChange={(e) => set("body", e.target.value)}
            placeholder={"Blank line between paragraphs.\n\n**bold**, [a link](https://mypa.computer) and {{name}} work."}
          />
          <p className="text-xs text-muted-foreground">
            Blank line = new paragraph · <code>**bold**</code> · <code>[text](https://…)</code> ·{" "}
            <code>{"{{name}}"}</code> = recipient&rsquo;s first name. An unsubscribe link is added automatically.
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="c-cta">Button label (optional)</Label>
            <Input id="c-cta" value={draft.ctaLabel ?? ""} onChange={(e) => set("ctaLabel", e.target.value)} placeholder="Read the update" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-url">Button link</Label>
            <Input id="c-url" value={draft.ctaUrl ?? ""} onChange={(e) => set("ctaUrl", e.target.value)} placeholder="https://mypa.computer" />
          </div>
        </div>

        <fieldset className="rounded-xl border border-border p-4">
          <legend className="px-1 font-heading text-sm font-semibold">Audience</legend>
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            {(Object.keys(STATUS_LABEL) as WaitlistStatus[]).map((s) => (
              <label key={s} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={draft.audience.waitlist.includes(s)}
                  onCheckedChange={(c) => toggleStatus(s, c === true)}
                />
                Waitlist · {STATUS_LABEL[s]}
              </label>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Up to <span className="font-medium text-foreground tabular-nums">{estimate ?? "…"}</span> recipients. Each address
            gets one copy; unsubscribed, bounced and spam-reporting addresses are skipped.
          </p>
        </fieldset>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            disabled={!dirty || busy !== null}
            onClick={() =>
              run("save", async () => {
                if (await save()) toast.success("Draft saved.");
              })
            }
          >
            {busy === "save" && <ArrowPathIcon className="animate-spin" />}
            {dirty ? "Save draft" : "Saved"}
          </Button>
          {campaign && (
            <Button
              variant="ghost"
              disabled={busy !== null}
              className="text-muted-foreground hover:text-destructive"
              onClick={() =>
                run("delete", async () => {
                  try {
                    await remove({ id: campaign._id });
                    onDeleted();
                    toast.success("Draft deleted.");
                  } catch (e) {
                    toast.error(errMsg(e));
                  }
                })
              }
            >
              <TrashIcon /> Delete
            </Button>
          )}
        </div>

        <div className="space-y-4 rounded-xl border border-border bg-surface/60 p-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-56 flex-1 space-y-2">
              <Label htmlFor="c-test">Send a test to</Label>
              <Input id="c-test" type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
            </div>
            <Button
              variant="outline"
              disabled={busy !== null}
              onClick={() =>
                run("test", async () => {
                  const id = await save();
                  if (!id) return;
                  try {
                    const r = await sendTest({ id, to: testTo });
                    toast.success(`Test queued to ${r.to}.`);
                  } catch (e) {
                    toast.error(errMsg(e));
                  }
                })
              }
            >
              {busy === "test" ? <ArrowPathIcon className="animate-spin" /> : <EnvelopeIcon />}
              Send test
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
            {!confirming ? (
              <Button variant="brand" disabled={busy !== null || !estimate} onClick={() => setConfirming(true)}>
                <PaperAirplaneIcon /> Send to audience
              </Button>
            ) : (
              <>
                <span className="w-full text-sm text-foreground">
                  Send &ldquo;{draft.subject || "untitled"}&rdquo; to up to {estimate} people?
                </span>
                <Button
                  variant="brand"
                  disabled={busy !== null}
                  onClick={() =>
                    run("send", async () => {
                      const id = await save();
                      if (!id) return;
                      try {
                        await start({ id });
                        toast.success("Sending started.");
                      } catch (e) {
                        toast.error(errMsg(e));
                      }
                      setConfirming(false);
                    })
                  }
                >
                  {busy === "send" && <ArrowPathIcon className="animate-spin" />}
                  Yes, send now
                </Button>
                <Button variant="ghost" onClick={() => setConfirming(false)}>
                  Cancel
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div>
        <Eyebrow className="mb-2">Live preview · as “Ada Lovelace”</Eyebrow>
        <p className="mb-3 truncate text-sm">
          <span className="text-foreground">{draft.subject || "Subject"}</span>
          <span className="text-muted-foreground"> — {draft.preheader || "preview text"}</span>
        </p>
        <EmailPreview html={html} />
      </div>
    </div>
  );
}

const TRANSACTIONAL = {
  welcome: { label: "Waitlist welcome", html: () => waitlistConfirmationHtml("Ada Lovelace") },
};

function TransactionalPreview() {
  const [which, setWhich] = useState<keyof typeof TRANSACTIONAL>("welcome");
  const html = useMemo(() => TRANSACTIONAL[which].html(), [which]);
  return (
    <div className="space-y-4 p-5">
      <p className="text-sm text-muted-foreground">
        Sent automatically on every submission. Copy lives in{" "}
        <code className="rounded bg-surface px-1 py-0.5 font-mono text-xs text-foreground">convex/emails/templates.ts</code>.
      </p>
      <Segmented
        label="Automatic email"
        value={which}
        onChange={setWhich}
        items={(Object.keys(TRANSACTIONAL) as (keyof typeof TRANSACTIONAL)[]).map((k) => ({ value: k, label: TRANSACTIONAL[k].label }))}
      />
      <EmailPreview html={html} className="max-w-2xl" />
    </div>
  );
}

function Suppressions() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.unsubscribe.listForAdmin,
    {},
    { initialNumItems: 50 },
  );
  if (status === "LoadingFirstPage") return <SkeletonRows rows={3} />;
  if (results.length === 0)
    return <EmptyState icon={NoSymbolIcon} title="A clean list" body="Nobody has unsubscribed, bounced or reported spam." />;
  return (
    <div>
      <Table className={TABLE}>
        <TableHeader className="bg-surface/60">
          <TableRow className="hover:bg-transparent">
            <TableHead>Address</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead>When</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {results.map((r) => (
            <TableRow key={r._id}>
              <TableCell>{r.email}</TableCell>
              <TableCell className="capitalize text-muted-foreground">{r.reason}</TableCell>
              <TableCell className="text-muted-foreground">{fmt(r.createdAt)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {status === "CanLoadMore" && (
        <div className="flex justify-center border-t border-border py-3">
          <Button variant="ghost" size="sm" onClick={() => loadMore(50)}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}

export function EmailTab({ adminEmail }: { adminEmail: string }) {
  const campaigns = useQuery(api.campaigns.list);
  const [view, setView] = useState<"campaigns" | "templates" | "suppressions">("campaigns");
  const [selected, setSelected] = useState<Id<"campaigns"> | "new" | null>(null);

  // Default to the newest campaign, or a blank draft when there are none.
  const active = selected ?? (campaigns && campaigns.length > 0 ? campaigns[0]._id : "new");
  const activeCampaign =
    active === "new" ? null : campaigns?.find((c) => c._id === active) ?? null;

  return (
    <Panel className="overflow-hidden">
      <ConfigStrip />
      <div className="border-b border-border px-5 py-3">
        <Segmented
          label="Email section"
          value={view}
          onChange={setView}
          items={[
            { value: "campaigns", label: "Campaigns", count: campaigns?.length },
            { value: "templates", label: "Automatic emails" },
            { value: "suppressions", label: "Unsubscribes" },
          ]}
        />
      </div>

      {view === "templates" && <TransactionalPreview />}
      {view === "suppressions" && <Suppressions />}
      {view === "campaigns" && (
        <div className="grid lg:grid-cols-[272px_1fr]">
          <aside className="border-b border-border bg-surface/40 p-3 lg:border-b-0 lg:border-r">
            <Button className="w-full" size="sm" variant={active === "new" ? "secondary" : "outline"} onClick={() => setSelected("new")}>
              <PlusIcon /> New campaign
            </Button>
            <ul className="mt-3 space-y-1">
              {campaigns === undefined && (
                <li className="space-y-2 px-1 py-2">
                  <div className="h-12 animate-sheen rounded-lg bg-muted" />
                  <div className="h-12 animate-sheen rounded-lg bg-muted" />
                </li>
              )}
              {campaigns?.length === 0 && (
                <li className="flex items-center gap-2 px-3 py-3 text-xs text-muted-foreground">
                  <InboxStackIcon className="size-4" /> No campaigns yet.
                </li>
              )}
              {campaigns?.map((c) => (
                <li key={c._id}>
                  <button
                    type="button"
                    onClick={() => setSelected(c._id)}
                    aria-current={active === c._id ? "true" : undefined}
                    className={cn(
                      "w-full rounded-lg px-3 py-2.5 text-left outline-none transition-colors hover:bg-accent/60 focus-visible:ring-[3px] focus-visible:ring-ring/50",
                      active === c._id && "bg-card shadow-panel ring-1 ring-border",
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-foreground">{c.name}</span>
                      {statusBadge(c.status)}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {c.status === "draft"
                        ? `Edited ${fmt(c.updatedAt)}`
                        : `${c.stats.queued.toLocaleString()} sent · ${c.stats.opened.toLocaleString()} opened`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>
          <section className="min-w-0 p-5 lg:p-6">
            {campaigns === undefined ? (
              <SkeletonRows rows={4} />
            ) : activeCampaign && activeCampaign.status !== "draft" ? (
              <CampaignReport campaign={activeCampaign} />
            ) : (
              <CampaignEditor
                key={activeCampaign?._id ?? "new"}
                campaign={activeCampaign}
                adminEmail={adminEmail}
                onSaved={(id) => setSelected(id)}
                onDeleted={() => setSelected("new")}
              />
            )}
          </section>
        </div>
      )}
    </Panel>
  );
}
