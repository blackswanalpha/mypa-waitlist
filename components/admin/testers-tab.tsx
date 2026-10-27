"use client";

import { useMemo, useState } from "react";
import type { FunctionReturnType } from "convex/server";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import {
  CheckCircle2,
  Copy,
  Eye,
  Inbox,
  Loader2,
  Lock,
  Mail,
  Plus,
  Send,
  Trash2,
  Undo2,
  Unlock,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { testerGuideHtml, type TesterDevice } from "@/convex/emails/testerTemplates";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type Status = "pending" | "approved" | "declined";
type TesterId = Id<"testers">;

const DEVICE_LABEL: Record<TesterDevice, string> = {
  samsung: "Samsung",
  android: "Android",
  iphone: "iPhone",
};

const FILTERS: { value: Status | undefined; label: string }[] = [
  { value: undefined, label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "declined", label: "Declined" },
];

/** ConvexError messages are written for people; anything else gets a generic line. */
function errorText(e: unknown): string {
  if (e instanceof ConvexError) {
    const d = e.data as { message?: string } | string;
    return typeof d === "string" ? d : (d.message ?? "Something went wrong.");
  }
  return "Something went wrong. Try again.";
}

function fmt(ts: number): string {
  return new Date(ts).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function MailState({ status, error, sentAt, sends }: { status: string | null; error: string | null; sentAt?: number; sends?: number }) {
  if (!sentAt) return <span className="text-muted-foreground">—</span>;
  const failed = status === "failed" || status === "bounced" || status === "cancelled";
  const label =
    status === "delivered"
      ? "Delivered"
      : status === "sent"
        ? "Sent to Resend"
        : status === "waiting" || status === "queued"
          ? "Queued"
          : status === "delivery_delayed"
            ? "Delayed"
            : status
              ? status[0].toUpperCase() + status.slice(1)
              : "Queued";
  return (
    <div className="leading-tight">
      <span className={cn("text-xs font-medium", failed ? "text-destructive" : "text-foreground")} title={error ?? undefined}>
        {label}
      </span>
      <span className="block text-[11px] text-muted-foreground">
        {fmt(sentAt)}
        {sends && sends > 1 ? ` · ${sends} sends` : ""}
      </span>
    </div>
  );
}

export function TestersTab() {
  const overview = useQuery(api.testers.overview);
  const [filter, setFilter] = useState<Status | undefined>(undefined);
  const { results, status, loadMore } = usePaginatedQuery(api.testers.list, { status: filter }, { initialNumItems: 50 });

  const approve = useMutation(api.testers.approve);
  const resendGuide = useMutation(api.testers.resendGuide);
  const setStatus = useMutation(api.testers.setStatus);
  const setDevice = useMutation(api.testers.setDevice);
  const remove = useMutation(api.testers.remove);

  const [selected, setSelected] = useState<Set<TesterId>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<TesterId | null>(null);

  const pendingSelected = useMemo(
    () => results.filter((r) => selected.has(r._id) && r.status !== "approved"),
    [results, selected],
  );

  async function run(key: string, fn: () => Promise<unknown>, ok?: string) {
    setBusy(key);
    try {
      await fn();
      if (ok) toast.success(ok);
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  async function approveMany(ids: TesterId[]) {
    setBusy("bulk");
    let done = 0;
    for (const id of ids) {
      try {
        const r = await approve({ id });
        if (!r.alreadyApproved) done++;
      } catch (e) {
        toast.error(errorText(e));
      }
    }
    setBusy(null);
    setSelected(new Set());
    if (done) toast.success(`Approved ${done} tester${done === 1 ? "" : "s"}. Their install guide is on its way.`);
  }

  const counts = overview?.counts;
  const settings = overview?.settings;
  const noLink = settings && !settings.inviteLink;

  return (
    <div className="space-y-6">
      <ProgramPanel />

      <div className="rounded-xl border border-border bg-card p-2">
        <div className="flex flex-wrap items-center justify-between gap-3 p-2">
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter testers">
            {FILTERS.map((f) => {
              const n = f.value ? counts?.[f.value] : counts?.total;
              return (
                <button
                  key={f.label}
                  role="tab"
                  aria-selected={filter === f.value}
                  onClick={() => {
                    setFilter(f.value);
                    setSelected(new Set());
                  }}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-[6px] border px-3 text-sm transition-colors",
                    filter === f.value ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {f.label}
                  {n !== undefined && <span className="tabular-nums opacity-70">{n}</span>}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            <CopyApproved />
            <Button
              size="sm"
              disabled={pendingSelected.length === 0 || busy !== null || noLink}
              onClick={() => void approveMany(pendingSelected.map((r) => r._id))}
              className="gap-1.5"
            >
              {busy === "bulk" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Approve selected{pendingSelected.length ? ` (${pendingSelected.length})` : ""}
            </Button>
          </div>
        </div>

        {noLink && (
          <p className="mx-2 mb-2 rounded-[6px] border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
            Approving is off until the Firebase invite link is saved in Program settings. The approval email&rsquo;s main button is that link.
          </p>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  className="h-4 w-4 accent-foreground"
                  checked={results.length > 0 && results.every((r) => selected.has(r._id))}
                  onChange={(e) => setSelected(e.target.checked ? new Set(results.map((r) => r._id)) : new Set())}
                />
              </TableHead>
              <TableHead className="w-14">#</TableHead>
              <TableHead>Tester</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Guide email</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {status === "LoadingFirstPage" ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : results.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                  <Inbox className="mx-auto mb-2 h-6 w-6" />
                  No testers here yet.
                </TableCell>
              </TableRow>
            ) : (
              results.map((r) => {
                const inSlots = settings ? r.position <= settings.slots : true;
                return (
                  <TableRow key={r._id} data-email={r.email} data-state={selected.has(r._id) ? "selected" : undefined}>
                    <TableCell>
                      <input
                        type="checkbox"
                        aria-label={`Select ${r.email}`}
                        className="h-4 w-4 accent-foreground"
                        checked={selected.has(r._id)}
                        onChange={(e) => {
                          const next = new Set(selected);
                          if (e.target.checked) next.add(r._id);
                          else next.delete(r._id);
                          setSelected(next);
                        }}
                      />
                    </TableCell>
                    <TableCell className="tabular-nums">
                      <span className={cn(inSlots ? "text-foreground" : "text-muted-foreground")} title={inSlots ? "Inside the tester slots" : "Past the tester slots"}>
                        {r.position}
                      </span>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-foreground">
                        {[r.firstName, r.lastName].filter(Boolean).join(" ") || "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">{r.email}</p>
                      {r.phone && (
                        <a href={`tel:${r.phone.replace(/[^\d+]/g, "")}`} className="text-xs text-muted-foreground underline-offset-2 hover:underline">
                          {r.phone}
                        </a>
                      )}
                    </TableCell>
                    <TableCell>
                      <select
                        aria-label={`Phone for ${r.email}`}
                        value={r.device}
                        disabled={r.status === "approved" && busy !== null}
                        onChange={(e) => void run(`device-${r._id}`, () => setDevice({ id: r._id, device: e.target.value as TesterDevice }))}
                        className="h-8 rounded-[6px] border border-input bg-background px-2 text-sm"
                      >
                        {(Object.keys(DEVICE_LABEL) as TesterDevice[]).map((d) => (
                          <option key={d} value={d}>
                            {DEVICE_LABEL[d]}
                          </option>
                        ))}
                      </select>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{fmt(r.createdAt)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={r.status === "approved" ? "default" : "secondary"}
                        className={cn(r.status === "declined" && "text-muted-foreground line-through")}
                      >
                        {r.status === "approved" ? "Approved" : r.status === "pending" ? "Pending" : "Declined"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <MailState status={r.guideStatus} error={r.guideError} sentAt={r.guideSentAt} sends={r.guideSends} />
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1.5">
                        {r.status !== "approved" ? (
                          <Button
                            size="sm"
                            disabled={busy !== null || noLink || r.device === "iphone"}
                            title={r.device === "iphone" ? "The test build is Android-only" : undefined}
                            onClick={() => void run(`approve-${r._id}`, () => approve({ id: r._id }), `Approved ${r.email}. Guide email queued.`)}
                            className="gap-1.5"
                          >
                            {busy === `approve-${r._id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            Approve &amp; email
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy !== null || noLink}
                            onClick={() => void run(`resend-${r._id}`, () => resendGuide({ id: r._id }), `Guide sent again to ${r.email}.`)}
                            className="gap-1.5"
                          >
                            {busy === `resend-${r._id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                            Resend guide
                          </Button>
                        )}
                        {r.status === "pending" ? (
                          <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => void run(`s-${r._id}`, () => setStatus({ id: r._id, status: "declined" }))}>
                            <X className="h-4 w-4" />
                            Decline
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy !== null}
                            title="Back to pending. Sends nothing."
                            onClick={() => void run(`s-${r._id}`, () => setStatus({ id: r._id, status: "pending" }))}
                          >
                            <Undo2 className="h-4 w-4" />
                            Pending
                          </Button>
                        )}
                        {confirmDelete === r._id ? (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              setConfirmDelete(null);
                              void run(`del-${r._id}`, () => remove({ id: r._id }), `Deleted ${r.email}.`);
                            }}
                          >
                            Confirm delete
                          </Button>
                        ) : (
                          <Button size="icon-sm" variant="ghost" aria-label={`Delete ${r.email}`} onClick={() => setConfirmDelete(r._id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        {status === "CanLoadMore" && (
          <div className="flex justify-center p-3">
            <Button variant="outline" size="sm" onClick={() => loadMore(50)}>
              Load more
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function CopyApproved() {
  const emails = useQuery(api.testers.approvedEmails);
  return (
    <Button
      size="sm"
      variant="outline"
      className="gap-1.5"
      disabled={!emails?.length}
      title="Comma-separated, for Firebase console → App Distribution → Testers & Groups"
      onClick={() => {
        if (!emails) return;
        void navigator.clipboard.writeText(emails.join(", ")).then(
          () => toast.success(`Copied ${emails.length} approved email${emails.length === 1 ? "" : "s"}.`),
          () => toast.error("Couldn't reach the clipboard."),
        );
      }}
    >
      <Copy className="h-4 w-4" />
      Copy approved
    </Button>
  );
}

/** Open/close, slots, the Firebase invite link, socials, and the email preview. */
function ProgramPanel() {
  const overview = useQuery(api.testers.overview);
  if (!overview) {
    return <div className="h-48 animate-pulse rounded-xl border border-border bg-card" />;
  }
  const s = overview.settings;
  // Keyed on the saved values, so the inputs reset whenever the server's change.
  return <ProgramEditor key={`${s.slots}|${s.inviteLink ?? ""}|${JSON.stringify(s.socials)}`} overview={overview} />;
}

function ProgramEditor({ overview }: { overview: FunctionReturnType<typeof api.testers.overview> }) {
  const update = useMutation(api.testers.updateSettings);
  const sendTest = useMutation(api.testers.sendTestGuide);
  const { counts, settings: s } = overview;

  const [slots, setSlots] = useState(String(s.slots));
  const [link, setLink] = useState(s.inviteLink ?? "");
  const [socials, setSocials] = useState(s.socials);
  const [saving, setSaving] = useState<string | null>(null);
  const [preview, setPreview] = useState<TesterDevice | null>(null);
  const [testTo, setTestTo] = useState("");

  const claimed = counts.pending + counts.approved;

  async function save(key: string, args: Parameters<typeof update>[0], ok: string) {
    setSaving(key);
    try {
      await update(args);
      toast.success(ok);
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-medium text-foreground">Signups</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {s.signupsOpen
                ? "Open. The landing page shows the blue tester card and the form."
                : "Closed. The landing page shows the amber “spots filled” card instead of the form."}
            </p>
          </div>
          <Button
            variant={s.signupsOpen ? "outline" : "default"}
            disabled={saving !== null}
            onClick={() =>
              void save("open", { signupsOpen: !s.signupsOpen }, s.signupsOpen ? "Signups closed." : "Signups open.")
            }
            className="shrink-0 gap-1.5"
            data-action="toggle-signups"
          >
            {saving === "open" ? <Loader2 className="h-4 w-4 animate-spin" /> : s.signupsOpen ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
            {s.signupsOpen ? "Close signups" : "Open signups"}
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            ["Approved", `${counts.approved} / ${s.slots}`],
            ["Pending", String(counts.pending)],
            ["Spots left", String(Math.max(0, s.slots - claimed))],
          ].map(([k, v]) => (
            <div key={k} className="rounded-[6px] border border-border px-2 py-2.5">
              <p className="text-lg font-light tabular-nums text-foreground">{v}</p>
              <p className="text-xs text-muted-foreground">{k}</p>
            </div>
          ))}
        </div>
        {s.signupsOpen && counts.approved >= s.slots && (
          <p className="mt-3 rounded-[6px] border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
            Every tester slot is approved. Close signups to show the “spots filled” card.
          </p>
        )}

        <form
          className="mt-5 flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void save("slots", { slots: Number(slots) }, "Tester slots saved.");
          }}
        >
          <div className="grid flex-1 gap-1.5">
            <Label htmlFor="slots">Tester slots</Label>
            <Input id="slots" type="number" min={1} max={10000} value={slots} onChange={(e) => setSlots(e.target.value)} />
          </div>
          <Button type="submit" variant="outline" disabled={saving !== null || slots === String(s.slots)}>
            Save
          </Button>
        </form>

        <form
          className="mt-4 flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void save("link", { inviteLink: link }, link ? "Invite link saved." : "Invite link cleared.");
          }}
        >
          <div className="grid flex-1 gap-1.5">
            <Label htmlFor="invite">Firebase invite link</Label>
            <Input
              id="invite"
              placeholder="https://appdistribution.firebase.dev/i/…"
              value={link}
              onChange={(e) => setLink(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Firebase console → App Distribution → Invite links, for the <span className="font-mono">testers</span> group.
            </p>
          </div>
          <Button type="submit" variant="outline" disabled={saving !== null || link === (s.inviteLink ?? "")} className="mb-5">
            Save
          </Button>
        </form>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-base font-medium text-foreground">Social links</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">Shown on the “spots filled” card so people know where new spots are announced.</p>
        <div className="mt-3 space-y-2">
          {socials.map((so, i) => (
            <div key={i} className="flex gap-2">
              <Input
                aria-label="Label"
                placeholder="Instagram"
                value={so.label}
                className="w-32"
                onChange={(e) => setSocials(socials.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
              />
              <Input
                aria-label="URL"
                placeholder="https://…"
                value={so.url}
                onChange={(e) => setSocials(socials.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
              />
              <Button size="icon" variant="ghost" aria-label="Remove link" onClick={() => setSocials(socials.filter((_, j) => j !== i))}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            disabled={socials.length >= 6}
            onClick={() => setSocials([...socials, { label: "", url: "" }])}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Add link
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={saving !== null || JSON.stringify(socials) === JSON.stringify(s.socials)}
            onClick={() => void save("socials", { socials }, "Social links saved.")}
          >
            Save links
          </Button>
        </div>

        <h2 className="mt-6 text-base font-medium text-foreground">Approval email</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          What an approved tester receives. Samsung phones get the Auto Blocker steps.
          {overview.testMode && " Resend is in test mode here, so mail only reaches @resend.dev test addresses."}
        </p>
        <div className="mt-3 grid gap-1.5">
          <Label htmlFor="test-to">Send a test to</Label>
          <Input
            id="test-to"
            type="email"
            placeholder="Your admin email, or any inbox on a phone you can check"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["android", "samsung"] as const).map((d) => (
            <Button key={d} size="sm" variant="outline" onClick={() => setPreview(preview === d ? null : d)} className="gap-1.5">
              <Eye className="h-4 w-4" />
              Preview {DEVICE_LABEL[d]}
            </Button>
          ))}
          {(["android", "samsung"] as const).map((d) => (
            <Button
              key={`t-${d}`}
              size="sm"
              variant="ghost"
              disabled={saving !== null || !s.inviteLink}
              onClick={async () => {
                setSaving(`test-${d}`);
                try {
                  const r = await sendTest({ device: d, to: testTo.trim() || undefined });
                  toast.success(`Test ${DEVICE_LABEL[d]} guide sent to ${r.to}.`);
                } catch (e) {
                  toast.error(errorText(e));
                } finally {
                  setSaving(null);
                }
              }}
              className="gap-1.5"
            >
              {saving === `test-${d}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send {DEVICE_LABEL[d]} test
            </Button>
          ))}
        </div>
      </section>

      {preview && (
        <section className="rounded-xl border border-border bg-card p-2 lg:col-span-2">
          <div className="flex items-center justify-between px-3 py-2">
            <p className="text-sm font-medium">Preview · {DEVICE_LABEL[preview]}</p>
            <Button size="icon-sm" variant="ghost" aria-label="Close preview" onClick={() => setPreview(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <iframe
            title="Approval email preview"
            className="h-[720px] w-full rounded-[6px] border border-border bg-white"
            srcDoc={testerGuideHtml({
              device: preview,
              inviteLink: s.inviteLink ?? "https://appdistribution.firebase.dev/i/your-invite-link",
              email: "tester@example.com",
              origin: typeof window === "undefined" ? undefined : window.location.origin,
            })}
          />
        </section>
      )}
    </div>
  );
}
