"use client";

import { useMemo, useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Loader2,
  Mail,
  Plus,
  Send,
  Square,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  campaignHtml,
  contactThanksHtml,
  feedbackThanksHtml,
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

function statusBadge(status: Campaign["status"]) {
  const tone = {
    draft: "bg-muted text-muted-foreground",
    sending: "bg-primary/15 text-primary",
    sent: "bg-fern/15 text-fern",
    cancelled: "bg-destructive/10 text-destructive",
  }[status];
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium capitalize", tone)}>
      {status}
    </span>
  );
}

/** Sandboxed render of an email exactly as the pipeline builds it. */
function EmailPreview({ html, className }: { html: string; className?: string }) {
  return (
    <iframe
      title="Email preview"
      sandbox=""
      srcDoc={html}
      className={cn("h-[640px] w-full rounded-lg border border-border bg-[#141b17]", className)}
    />
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
    <div className="border-b border-border p-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-muted-foreground">
        <span>
          From <span className="text-foreground">{cfg.from}</span>
        </span>
        <span>
          Replies to <span className="text-foreground">{cfg.replyTo}</span>
        </span>
        {issues.length === 0 && (
          <span className="flex items-center gap-1 text-fern">
            <CheckCircle2 className="h-3.5 w-3.5" /> Ready to send
          </span>
        )}
      </div>
      {issues.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {issues.map((i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-amber-500">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-none" />
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
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-light tabular-nums text-foreground">
        {value.toLocaleString()}
        {pct !== undefined && <span className="ml-1.5 text-xs text-muted-foreground">{pct}%</span>}
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
  if (status === "LoadingFirstPage")
    return <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>;
  if (results.length === 0)
    return <p className="py-6 text-center text-sm text-muted-foreground">No recipients yet.</p>;
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
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
                    r.status === "delivered" && "text-fern",
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
        <div className="flex justify-center py-3">
          <Button variant="outline" size="sm" onClick={() => loadMore(50)}>
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
            <h3 className="font-serif text-2xl text-foreground">{campaign.name}</h3>
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
              <Square className="h-3.5 w-3.5" /> Stop sending
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
            <Copy className="h-3.5 w-3.5" /> Duplicate
          </Button>
        </div>
      </div>

      {campaign.status === "sending" && (
        <p className="flex items-center gap-2 text-sm text-primary">
          <Loader2 className="h-4 w-4 animate-spin" /> Queuing recipients in batches of 100…
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
          <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Recipients</p>
          <div className="overflow-x-auto rounded-lg border border-border">
            <Recipients id={campaign._id} />
          </div>
        </div>
        <div className="min-w-0">
          <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">What was sent</p>
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
    <div className="grid gap-8 xl:grid-cols-2">
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

        <fieldset className="rounded-lg border border-border p-4">
          <legend className="px-1 text-sm font-medium">Audience</legend>
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
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={draft.audience.feedback}
                onCheckedChange={(c) => set("audience", { ...draft.audience, feedback: c === true })}
              />
              Feedback senders
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={draft.audience.contact}
                onCheckedChange={(c) => set("audience", { ...draft.audience, contact: c === true })}
              />
              Contact senders
            </label>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Up to <span className="text-foreground">{estimate ?? "…"}</span> recipients. Each address
            gets one copy; unsubscribed, bounced and spam-reporting addresses are skipped.
          </p>
        </fieldset>

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-5">
          <Button
            disabled={!dirty || busy !== null}
            onClick={() =>
              run("save", async () => {
                if (await save()) toast.success("Draft saved.");
              })
            }
          >
            {busy === "save" && <Loader2 className="h-4 w-4 animate-spin" />}
            Save draft
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
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          )}
        </div>

        <div className="space-y-3 rounded-lg border border-border p-4">
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
              {busy === "test" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Send test
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
            {!confirming ? (
              <Button disabled={busy !== null || !estimate} onClick={() => setConfirming(true)}>
                <Send className="h-4 w-4" /> Send to audience
              </Button>
            ) : (
              <>
                <span className="text-sm">
                  Send &ldquo;{draft.subject || "untitled"}&rdquo; to up to {estimate} people?
                </span>
                <Button
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
                  {busy === "send" && <Loader2 className="h-4 w-4 animate-spin" />}
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
        <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
          Live preview · as “Ada Lovelace”
        </p>
        <p className="mb-2 text-sm">
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
  feedback: { label: "Feedback thanks", html: () => feedbackThanksHtml("Ada") },
  contact: { label: "Contact receipt", html: () => contactThanksHtml("Ada") },
};

function TransactionalPreview() {
  const [which, setWhich] = useState<keyof typeof TRANSACTIONAL>("welcome");
  const html = useMemo(() => TRANSACTIONAL[which].html(), [which]);
  return (
    <div className="space-y-4 p-4">
      <p className="text-sm text-muted-foreground">
        Sent automatically on every submission. Copy lives in{" "}
        <code>convex/emails/templates.ts</code>.
      </p>
      <div className="flex gap-2">
        {(Object.keys(TRANSACTIONAL) as (keyof typeof TRANSACTIONAL)[]).map((k) => (
          <Button key={k} size="sm" variant={k === which ? "default" : "outline"} onClick={() => setWhich(k)}>
            {TRANSACTIONAL[k].label}
          </Button>
        ))}
      </div>
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
  if (status === "LoadingFirstPage")
    return <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>;
  if (results.length === 0)
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Nobody has unsubscribed, bounced or reported spam.
      </p>
    );
  return (
    <div className="p-2">
      <Table>
        <TableHeader>
          <TableRow>
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
        <div className="flex justify-center py-3">
          <Button variant="outline" size="sm" onClick={() => loadMore(50)}>
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
    <div>
      <ConfigStrip />
      <div className="flex gap-1 border-b border-border px-4 py-2">
        {(
          [
            ["campaigns", "Campaigns"],
            ["templates", "Automatic emails"],
            ["suppressions", "Unsubscribes"],
          ] as const
        ).map(([k, label]) => (
          <Button key={k} size="sm" variant={view === k ? "secondary" : "ghost"} onClick={() => setView(k)}>
            {label}
          </Button>
        ))}
      </div>

      {view === "templates" && <TransactionalPreview />}
      {view === "suppressions" && <Suppressions />}
      {view === "campaigns" && (
        <div className="grid lg:grid-cols-[260px_1fr]">
          <aside className="border-b border-border p-3 lg:border-b-0 lg:border-r">
            <Button className="w-full" size="sm" onClick={() => setSelected("new")}>
              <Plus className="h-4 w-4" /> New campaign
            </Button>
            <ul className="mt-3 space-y-1">
              {campaigns === undefined && (
                <li className="px-2 py-4 text-sm text-muted-foreground">Loading…</li>
              )}
              {campaigns?.map((c) => (
                <li key={c._id}>
                  <button
                    type="button"
                    onClick={() => setSelected(c._id)}
                    className={cn(
                      "w-full rounded-md px-3 py-2 text-left transition-colors hover:bg-muted",
                      active === c._id && "bg-muted",
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm text-foreground">{c.name}</span>
                      {statusBadge(c.status)}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {c.status === "draft"
                        ? `Edited ${fmt(c.updatedAt)}`
                        : `${c.stats.queued} sent · ${c.stats.opened} opened`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>
          <section className="min-w-0 p-5">
            {campaigns === undefined ? (
              <p className="py-16 text-center text-sm text-muted-foreground">Loading…</p>
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
    </div>
  );
}
