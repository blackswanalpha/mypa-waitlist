"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FunctionReturnType } from "convex/server";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import {
  ArrowPathIcon,
  ArrowUturnLeftIcon,
  CheckCircleIcon,
  ClipboardDocumentIcon,
  EnvelopeIcon,
  EyeIcon,
  LinkIcon,
  MagnifyingGlassIcon,
  PaperAirplaneIcon,
  PlusIcon,
  SparklesIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/16/solid";
import {
  ChatBubbleLeftEllipsisIcon,
  Cog6ToothIcon,
  DevicePhoneMobileIcon,
  ExclamationTriangleIcon,
  InboxIcon,
  LockClosedIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";
import { flexRender, type ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { testerGuideHtml, type TesterDevice } from "@/convex/emails/testerTemplates";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Avatar,
  EmptyState,
  Eyebrow,
  NativeSelect,
  Panel,
  PanelHeader,
  Segmented,
  SkeletonRows,
  StatusPill,
  fmtDateTime,
  reveal,
  type IconType,
} from "@/components/admin/kit";
import { DataTablePagination } from "@/components/admin/data-table-pagination";
import { useLiveTable } from "@/components/admin/use-live-table";
import { useAdminTable } from "@/lib/admin-table-store";
import { cn } from "@/lib/utils";

const TABLE =
  "[&_td]:px-2.5 [&_td]:py-3 [&_th]:h-10 [&_th]:px-2.5 [&_th]:text-xs [&_th]:font-medium [&_th]:text-muted-foreground [&_td:first-child]:pl-5 [&_th:first-child]:pl-5 [&_td:last-child]:pr-5 [&_th:last-child]:pr-5";

type Status = "pending" | "approved" | "declined";
type TesterId = Id<"testers">;
type Overview = FunctionReturnType<typeof api.testers.overview>;

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

function MailState({ status, error, sentAt, sends }: { status: string | null; error: string | null; sentAt?: number; sends?: number }) {
  if (!sentAt) return <span className="text-muted-foreground/60">—</span>;
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
    <div className="leading-tight" title={error ?? undefined}>
      <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", failed ? "text-destructive" : status === "delivered" ? "text-brand-ink" : "text-foreground")}>
        <span aria-hidden className={cn("size-1.5 rounded-full", failed ? "bg-destructive" : status === "delivered" ? "bg-brand-ink" : "bg-muted-foreground/60")} />
        {label}
      </span>
      <span className="mt-0.5 block text-[11px] text-muted-foreground">
        {fmtDateTime(sentAt)}
        {sends && sends > 1 ? ` · ${sends} sends` : ""}
      </span>
    </div>
  );
}

/** One line on how close the program is to full. */
function finishLine(approved: number, slots: number): string {
  const left = Math.max(0, slots - approved);
  if (left === 0) return "Every slot is approved. The program is full.";
  if (approved === 0) return "The first approval opens the program.";
  if (left <= 5) return `Final stretch: ${left} spot${left === 1 ? "" : "s"} to go.`;
  if (approved * 2 >= slots) return `Past halfway. ${left} spots to go.`;
  return `${Math.ceil(slots / 2) - approved} more to reach halfway.`;
}

/** Celebrate the moments the program crosses halfway and full, once each, while the admin is watching. */
function useMilestones(overview: Overview | undefined) {
  const last = useRef<number | null>(null);
  useEffect(() => {
    if (!overview) return;
    const { approved } = overview.counts;
    const { slots } = overview.settings;
    const prev = last.current;
    last.current = approved;
    if (prev === null || approved <= prev) return;
    if (prev < slots && approved >= slots) {
      toast.success("All tester slots are filled.", { description: "Close signups when you are ready for the “spots filled” card." });
    } else if (prev * 2 < slots && approved * 2 >= slots) {
      toast.success("Halfway there.", { description: `${approved} of ${slots} testers approved.` });
    }
  }, [overview]);
}

type Recommendation = {
  tone: "warn" | "brand" | "done";
  icon: IconType;
  title: string;
  body: string;
  action?: { label: string; run: () => void; icon?: IconType };
};

/** The single next thing worth doing, in priority order. */
function recommend(o: Overview, actions: { focusInvite: () => void; showPending: () => void; closeSignups: () => void }): Recommendation {
  const { counts, settings: s } = o;
  if (!s.inviteLink) {
    return {
      tone: "warn",
      icon: LinkIcon,
      title: "Add the Firebase invite link",
      body: "Approving is off until the invite link is saved. It is the main button in the approval email.",
      action: { label: "Add invite link", run: actions.focusInvite, icon: LinkIcon },
    };
  }
  if (s.signupsOpen && counts.approved >= s.slots) {
    return {
      tone: "brand",
      icon: LockClosedIcon,
      title: "Every slot is approved",
      body: "Close signups so the landing page shows the “spots filled” card instead of the form.",
      action: { label: "Close signups", run: actions.closeSignups, icon: LockClosedIcon },
    };
  }
  if (counts.pending > 0) {
    return {
      tone: "brand",
      icon: UserGroupIcon,
      title: `${counts.pending} ${counts.pending === 1 ? "person is" : "people are"} waiting for approval`,
      body: "Approving emails each one the install guide for their phone.",
      action: { label: "Review waiting testers", run: actions.showPending },
    };
  }
  return {
    tone: "done",
    icon: CheckCircleIcon,
    title: "All caught up",
    body: "Nobody is waiting on you. New signups appear here the moment they land.",
  };
}

function NextUp({ rec }: { rec: Recommendation }) {
  const Icon = rec.icon;
  return (
    <Panel
      className={cn(
        "relative flex flex-col gap-4 overflow-hidden p-5 sm:flex-row sm:items-center",
        rec.tone === "warn" && "border-warn/30",
        rec.tone === "brand" && "border-brand-ink/30",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-0 w-1",
          rec.tone === "warn" ? "bg-warn" : rec.tone === "brand" ? "bg-brand" : "bg-border",
        )}
      />
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-xl",
          rec.tone === "warn" ? "bg-warn/12 text-warn" : rec.tone === "brand" ? "bg-brand/15 text-brand-ink" : "bg-surface text-brand-ink",
        )}
      >
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <Eyebrow>{rec.tone === "done" ? "Status" : "Next up"}</Eyebrow>
        <p className="mt-1 font-heading text-[15px] font-semibold text-foreground">{rec.title}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{rec.body}</p>
      </div>
      {rec.action && (
        <Button variant="brand" onClick={rec.action.run} className="shrink-0">
          {rec.action.icon && <rec.action.icon />}
          {rec.action.label}
        </Button>
      )}
    </Panel>
  );
}

/** The finish line: approved against slots, with pending stacked behind it. */
function ProgramHero({ overview, onToggle, toggling }: { overview: Overview; onToggle: () => void; toggling: boolean }) {
  const { counts, settings: s } = overview;
  const slots = Math.max(1, s.slots);
  const approvedPct = Math.min(100, (counts.approved / slots) * 100);
  const pendingPct = Math.min(100 - approvedPct, (counts.pending / slots) * 100);
  const left = Math.max(0, s.slots - counts.approved - counts.pending);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Panel className="p-6">
        <Eyebrow>Approved testers</Eyebrow>
        <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-heading text-5xl font-semibold leading-none tracking-[-0.04em] tabular-nums text-foreground">
            {counts.approved.toLocaleString()}
          </span>
          <span className="text-lg text-muted-foreground">of {s.slots.toLocaleString()} slots</span>
        </div>
        <p className="mt-2 text-sm text-foreground/80">{finishLine(counts.approved, s.slots)}</p>

        <div
          className="mt-6 flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-border/70"
          role="meter"
          aria-label="Tester slots approved"
          aria-valuemin={0}
          aria-valuemax={s.slots}
          aria-valuenow={counts.approved}
        >
          <div className="h-full rounded-full bg-brand transition-[width] duration-700 ease-out-quint" style={{ width: `${approvedPct}%` }} />
          {pendingPct > 0 && (
            <div className="h-full rounded-full bg-brand/35 transition-[width] duration-700 ease-out-quint" style={{ width: `${pendingPct}%` }} />
          )}
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { k: "Signups", v: counts.total, dot: "bg-foreground/70" },
            { k: "Waiting", v: counts.pending, dot: "bg-brand/40" },
            { k: "Open spots", v: left, dot: "bg-border" },
            { k: "Declined", v: counts.declined, dot: "bg-muted-foreground/40" },
          ].map((m) => (
            <div key={m.k}>
              <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span aria-hidden className={cn("size-1.5 rounded-full", m.dot)} />
                {m.k}
              </dt>
              <dd className="mt-1 font-heading text-xl font-semibold tabular-nums text-foreground">{m.v.toLocaleString()}</dd>
            </div>
          ))}
        </dl>
      </Panel>

      <Panel className="flex flex-col p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Eyebrow>Public signups</Eyebrow>
            <p className="mt-2 font-heading text-lg font-semibold text-foreground">{s.signupsOpen ? "Open" : "Closed"}</p>
          </div>
          <Switch
            checked={s.signupsOpen}
            disabled={toggling}
            onCheckedChange={onToggle}
            data-action="toggle-signups"
            aria-label={s.signupsOpen ? "Close signups" : "Open signups"}
          />
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          {s.signupsOpen
            ? "The landing page shows the blue tester card and the form."
            : "The landing page shows the amber “spots filled” card instead of the form."}
        </p>
        <div className="mt-auto flex items-center gap-2 pt-5 text-xs text-muted-foreground">
          <DevicePhoneMobileIcon className="size-4" />
          Android only. iPhone signups wait for an iOS build.
        </div>
      </Panel>
    </div>
  );
}

export function TestersTab() {
  const overview = useQuery(api.testers.overview);
  const update = useMutation(api.testers.updateSettings);
  const { statusFilter, setStatusFilter } = useAdminTable("testers");
  const filter = statusFilter as Status | undefined;
  const setFilter = (s: Status | undefined) => setStatusFilter(s);
  const [toggling, setToggling] = useState(false);
  useMilestones(overview);

  const toggleSignups = async () => {
    if (!overview) return;
    const open = overview.settings.signupsOpen;
    setToggling(true);
    try {
      await update({ signupsOpen: !open });
      toast.success(open ? "Signups closed." : "Signups open.");
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setToggling(false);
    }
  };

  if (!overview) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-[104px] rounded-2xl" />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Skeleton className="h-[248px] rounded-2xl" />
          <Skeleton className="h-[248px] rounded-2xl" />
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  const rec = recommend(overview, {
    focusInvite: () => reveal("invite"),
    showPending: () => {
      setFilter("pending");
      reveal("testers-table");
    },
    closeSignups: () => void toggleSignups(),
  });

  return (
    <div className="space-y-4">
      <NextUp rec={rec} />
      <ProgramHero overview={overview} onToggle={() => void toggleSignups()} toggling={toggling} />
      <TestersTable overview={overview} filter={filter} setFilter={setFilter} />
      <div className="pt-6">
        <div className="mb-4 flex items-center gap-2">
          <Cog6ToothIcon className="size-4 text-muted-foreground" />
          <h2 className="font-heading text-base font-semibold text-foreground">Program settings</h2>
        </div>
        <ProgramEditor key={`${overview.settings.slots}|${overview.settings.inviteLink ?? ""}|${JSON.stringify(overview.settings.socials)}`} overview={overview} />
      </div>
    </div>
  );
}

type Tester = FunctionReturnType<typeof api.testers.list>["page"][number];

const matchesTester = (r: Tester, needle: string) =>
  r.email.toLowerCase().includes(needle) ||
  [r.firstName, r.lastName].filter(Boolean).join(" ").toLowerCase().includes(needle) ||
  (r.phone ?? "").replace(/\s/g, "").includes(needle.replace(/\s/g, ""));

function TestersTable({ overview, filter, setFilter }: { overview: Overview; filter: Status | undefined; setFilter: (s: Status | undefined) => void }) {
  const { results, status, loadMore } = usePaginatedQuery(api.testers.list, { status: filter }, { initialNumItems: 50 });

  const approve = useMutation(api.testers.approve);
  const resendGuide = useMutation(api.testers.resendGuide);
  const setStatus = useMutation(api.testers.setStatus);
  const setDevice = useMutation(api.testers.setDevice);
  const remove = useMutation(api.testers.remove);

  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<TesterId | null>(null);
  const { setPageIndex } = useAdminTable("testers");

  const { counts, settings } = overview;
  const noLink = !settings.inviteLink;

  const run = useCallback(async (key: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(key);
    try {
      await fn();
      if (ok) toast.success(ok);
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(null);
    }
  }, []);

  const columns = useMemo<ColumnDef<Tester>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            aria-label="Select all"
            checked={table.getIsAllPageRowsSelected() ? true : table.getIsSomePageRowsSelected() ? "indeterminate" : false}
            onCheckedChange={(c) => table.toggleAllPageRowsSelected(c === true)}
          />
        ),
        cell: ({ row }) => (
          <Checkbox aria-label={`Select ${row.original.email}`} checked={row.getIsSelected()} onCheckedChange={(c) => row.toggleSelected(c === true)} />
        ),
        meta: { className: "w-10" },
      },
      {
        id: "position",
        header: "#",
        cell: ({ row: { original: r } }) => {
          const inSlots = r.position <= settings.slots;
          return (
            <span className={cn("text-sm tabular-nums", inSlots ? "font-medium text-foreground" : "text-muted-foreground/60")} title={inSlots ? "Inside the tester slots" : "Past the tester slots"}>
              {r.position}
            </span>
          );
        },
        meta: { className: "w-12" },
      },
      {
        id: "tester",
        header: "Tester",
        cell: ({ row: { original: r } }) => {
          const name = [r.firstName, r.lastName].filter(Boolean).join(" ");
          return (
            <div className="flex items-center gap-3">
              <Avatar name={name} email={r.email} />
              <div className="min-w-0 max-w-[200px] xl:max-w-[240px]">
                <p className="truncate font-medium text-foreground">{name || "—"}</p>
                <p className="truncate text-xs text-muted-foreground">{r.email}</p>
                {r.phone && (
                  <a href={`tel:${r.phone.replace(/[^\d+]/g, "")}`} className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
                    {r.phone}
                  </a>
                )}
              </div>
            </div>
          );
        },
      },
      {
        id: "device",
        header: "Phone",
        cell: ({ row: { original: r } }) => (
          <NativeSelect
            aria-label={`Phone for ${r.email}`}
            value={r.device}
            disabled={busy !== null}
            onChange={(e) => void run(`device-${r._id}`, () => setDevice({ id: r._id, device: e.target.value as TesterDevice }))}
            className="w-[104px]"
          >
            {(Object.keys(DEVICE_LABEL) as TesterDevice[]).map((d) => (
              <option key={d} value={d}>
                {DEVICE_LABEL[d]}
              </option>
            ))}
          </NativeSelect>
        ),
      },
      {
        id: "joined",
        header: "Joined",
        cell: ({ row: { original: r } }) => (
          <div className="whitespace-nowrap text-sm leading-tight text-muted-foreground">
            <span className="block text-foreground/90">{new Date(r.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
            <span className="text-xs">{new Date(r.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
        ),
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row: { original: r } }) =>
          r.status === "approved" ? (
            <StatusPill tone="brand">Approved</StatusPill>
          ) : r.status === "pending" ? (
            <StatusPill tone="warn">Pending</StatusPill>
          ) : (
            <StatusPill tone="neutral" className="line-through">
              Declined
            </StatusPill>
          ),
      },
      {
        id: "guide",
        header: "Guide email",
        cell: ({ row: { original: r } }) => <MailState status={r.guideStatus} error={r.guideError} sentAt={r.guideSentAt} sends={r.guideSends} />,
      },
      {
        id: "actions",
        header: () => <span className="block text-right">Actions</span>,
        cell: ({ row: { original: r } }) => (
          <div className="flex items-center justify-end gap-1">
            {r.status !== "approved" ? (
              r.device === "iphone" ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0} className="rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                      <Button size="sm" variant="secondary" disabled>
                        <PaperAirplaneIcon />
                        Approve &amp; email
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>The test build is Android-only.</TooltipContent>
                </Tooltip>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy !== null || noLink}
                  onClick={() => void run(`approve-${r._id}`, () => approve({ id: r._id }), `Approved ${r.email}. Guide email queued.`)}
                >
                  {busy === `approve-${r._id}` ? <ArrowPathIcon className="animate-spin" /> : <PaperAirplaneIcon />}
                  Approve &amp; email
                </Button>
              )
            ) : (
              <Button
                size="sm"
                variant="ghost"
                disabled={busy !== null || noLink}
                onClick={() => void run(`resend-${r._id}`, () => resendGuide({ id: r._id }), `Guide sent again to ${r.email}.`)}
              >
                {busy === `resend-${r._id}` ? <ArrowPathIcon className="animate-spin" /> : <EnvelopeIcon />}
                Resend guide
              </Button>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                {r.status === "pending" ? (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Decline"
                    className="text-muted-foreground"
                    disabled={busy !== null}
                    onClick={() => void run(`s-${r._id}`, () => setStatus({ id: r._id, status: "declined" }))}
                  >
                    <XMarkIcon />
                  </Button>
                ) : (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Back to pending"
                    className="text-muted-foreground"
                    disabled={busy !== null}
                    onClick={() => void run(`s-${r._id}`, () => setStatus({ id: r._id, status: "pending" }))}
                  >
                    <ArrowUturnLeftIcon />
                  </Button>
                )}
              </TooltipTrigger>
              <TooltipContent>{r.status === "pending" ? "Decline. Sends nothing." : "Back to pending. Sends nothing."}</TooltipContent>
            </Tooltip>
            {confirmDelete === r._id ? (
              <Button
                size="sm"
                variant="destructive"
                autoFocus
                onBlur={() => setConfirmDelete(null)}
                onClick={() => {
                  setConfirmDelete(null);
                  void run(`del-${r._id}`, () => remove({ id: r._id }), `Deleted ${r.email}.`);
                }}
              >
                Confirm delete
              </Button>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Delete ${r.email}`}
                    className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setConfirmDelete(r._id)}
                  >
                    <TrashIcon />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete</TooltipContent>
              </Tooltip>
            )}
          </div>
        ),
      },
    ],
    [busy, confirmDelete, noLink, settings.slots, run, approve, resendGuide, setStatus, setDevice, remove],
  );

  const t = useLiveTable({
    tableKey: "testers",
    data: results,
    status,
    loadMore,
    columns,
    total: filter ? counts[filter] : counts.total,
    search,
    matches: matchesTester,
  });

  // The test build is Android-only, so iPhone rows are never approvable.
  const approvable = t.selectedRows.filter((r) => r.status !== "approved" && r.device !== "iphone");

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
    t.clearSelection();
    if (done) toast.success(`Approved ${done} tester${done === 1 ? "" : "s"}. Their install guide is on its way.`);
  }

  return (
    <Panel id="testers-table" className="scroll-mt-6 overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 px-4 pt-4 sm:px-5">
        <Segmented
          semantics="tabs"
          label="Filter testers"
          value={filter}
          onChange={(v) => {
            setFilter(v);
            setPageIndex(0);
            t.clearSelection();
          }}
          items={FILTERS.map((f) => ({ ...f, count: f.value ? counts[f.value] : counts.total }))}
        />
        <div className="relative ml-auto w-full sm:w-60">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPageIndex(0);
            }}
            placeholder="Search testers"
            aria-label="Search testers"
            className="pl-9"
          />
        </div>
        <CopyApproved />
      </div>

      {/* Selection bar: appears only while rows are picked, so the default view stays quiet. */}
      {t.selectedRows.length > 0 && (
        <div className="mx-4 mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-brand/10 px-3.5 py-2.5 ring-1 ring-inset ring-brand/25 animate-in fade-in-0 slide-in-from-top-1 duration-200 motion-reduce:animate-none sm:mx-5">
          <span className="text-sm font-medium text-foreground">
            {t.selectedRows.length} selected
            {approvable.length !== t.selectedRows.length && <span className="font-normal text-muted-foreground"> · {approvable.length} can be approved</span>}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={t.clearSelection} disabled={busy !== null}>
              Clear
            </Button>
            <Button size="sm" variant="brand" disabled={approvable.length === 0 || busy !== null || noLink} onClick={() => void approveMany(approvable.map((r) => r._id))}>
              {busy === "bulk" ? <ArrowPathIcon className="animate-spin" /> : <CheckCircleIcon />}
              Approve {approvable.length || ""} and email
            </Button>
          </div>
        </div>
      )}

      <div className="mt-4 border-t border-border">
        {t.isFirstLoad ? (
          <SkeletonRows />
        ) : t.isEmpty && !t.searching ? (
          filter === "pending" ? (
            <EmptyState icon={CheckCircleIcon} title="Nobody is waiting" body="Every signup has an answer. New ones land here first." />
          ) : (
            <EmptyState icon={InboxIcon} title="No testers here yet" body="Signups from the landing page appear the moment they arrive." />
          )
        ) : t.searching && t.exhausted && t.rows.length === 0 ? (
          <EmptyState icon={MagnifyingGlassIcon} title="No matches" body={`Nobody's name, email or phone contains “${search.trim()}”.`} />
        ) : (
          <>
            <Table className={TABLE}>
              <TableHeader className="bg-surface/60">
                {t.table.getHeaderGroups().map((hg) => (
                  <TableRow key={hg.id} className="hover:bg-transparent">
                    {hg.headers.map((h) => (
                      <TableHead key={h.id} className={(h.column.columnDef.meta as { className?: string } | undefined)?.className}>
                        {flexRender(h.column.columnDef.header, h.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {t.table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-email={row.original.email}
                    data-state={row.getIsSelected() ? "selected" : undefined}
                    className="transition-colors hover:bg-accent/40 data-[state=selected]:bg-brand/[0.06]"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {t.isPageLoading && <SkeletonRows rows={3} />}
            {t.searching && !t.exhausted ? (
              <p className="flex items-center gap-2 border-t border-border px-5 py-3 text-xs text-muted-foreground" role="status">
                <ArrowPathIcon className="size-3.5 animate-spin" /> Searching every tester…
              </p>
            ) : (
              <DataTablePagination table={t.table} />
            )}
          </>
        )}
      </div>
    </Panel>
  );
}

function CopyApproved() {
  const emails = useQuery(api.testers.approvedEmails);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={emails?.length ? -1 : 0} className="rounded-md">
          <Button
            size="sm"
            variant="outline"
            disabled={!emails?.length}
            onClick={() => {
              if (!emails) return;
              void navigator.clipboard.writeText(emails.join(", ")).then(
                () => toast.success(`Copied ${emails.length} approved email${emails.length === 1 ? "" : "s"}.`),
                () => toast.error("Couldn't reach the clipboard."),
              );
            }}
          >
            <ClipboardDocumentIcon />
            Copy approved
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>Comma-separated, for Firebase console → App Distribution → Testers &amp; Groups</TooltipContent>
    </Tooltip>
  );
}

/** Slots, the Firebase invite link, socials, and the email preview. */
function ProgramEditor({ overview }: { overview: Overview }) {
  const update = useMutation(api.testers.updateSettings);
  const sendTest = useMutation(api.testers.sendTestGuide);
  const { settings: s } = overview;

  const [slots, setSlots] = useState(String(s.slots));
  const [link, setLink] = useState(s.inviteLink ?? "");
  const [socials, setSocials] = useState(s.socials);
  const [saving, setSaving] = useState<string | null>(null);
  const [preview, setPreview] = useState<TesterDevice | null>(null);
  const [testTo, setTestTo] = useState("");

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

  const socialsDirty = JSON.stringify(socials) !== JSON.stringify(s.socials);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel className="pb-5">
        <PanelHeader icon={LinkIcon} title="Access" description="How many testers, and the link that installs the build." />
        <form
          className="mt-5 px-5"
          onSubmit={(e) => {
            e.preventDefault();
            void save("slots", { slots: Number(slots) }, "Tester slots saved.");
          }}
        >
          <Label htmlFor="slots">Tester slots</Label>
          <div className="mt-2 flex gap-2">
            <Input id="slots" type="number" min={1} max={10000} value={slots} onChange={(e) => setSlots(e.target.value)} className="tabular-nums" />
            <Button type="submit" variant="outline" disabled={saving !== null || slots === String(s.slots)}>
              {saving === "slots" && <ArrowPathIcon className="animate-spin" />}
              Save
            </Button>
          </div>
        </form>

        <form
          className="mt-5 px-5"
          onSubmit={(e) => {
            e.preventDefault();
            void save("link", { inviteLink: link }, link ? "Invite link saved." : "Invite link cleared.");
          }}
        >
          <Label htmlFor="invite">Firebase invite link</Label>
          <div className="mt-2 flex gap-2">
            <Input
              id="invite"
              placeholder="https://appdistribution.firebase.dev/i/…"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              className="scroll-mt-24"
            />
            <Button type="submit" variant="outline" disabled={saving !== null || link === (s.inviteLink ?? "")}>
              {saving === "link" && <ArrowPathIcon className="animate-spin" />}
              Save
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Firebase console → App Distribution → Invite links, for the <span className="font-mono">testers</span> group.
          </p>
        </form>
      </Panel>

      <section className="order-last rounded-2xl border border-border bg-card pb-5 text-card-foreground shadow-panel lg:col-span-2">
        <PanelHeader icon={ChatBubbleLeftEllipsisIcon} title="Social links" description="Shown on the “spots filled” card, so people know where new spots are announced." />
        <div className="mt-5 grid gap-2 px-5 md:grid-cols-2">
          {socials.length === 0 && <p className="text-sm text-muted-foreground">No links yet.</p>}
          {socials.map((so, i) => (
            <div key={i} className="flex gap-2">
              <Input
                aria-label="Label"
                placeholder="Instagram"
                value={so.label}
                className="w-28 shrink-0"
                onChange={(e) => setSocials(socials.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
              />
              <Input
                aria-label="URL"
                placeholder="https://…"
                value={so.url}
                onChange={(e) => setSocials(socials.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
              />
              <Button
                size="icon"
                variant="ghost"
                aria-label="Remove link"
                className="shrink-0 text-muted-foreground"
                onClick={() => setSocials(socials.filter((_, j) => j !== i))}
              >
                <XMarkIcon />
              </Button>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 px-5">
          <Button size="sm" variant="ghost" disabled={socials.length >= 6} onClick={() => setSocials([...socials, { label: "", url: "" }])}>
            <PlusIcon />
            Add link
          </Button>
          <Button size="sm" variant="outline" disabled={saving !== null || !socialsDirty} onClick={() => void save("socials", { socials }, "Social links saved.")}>
            {saving === "socials" && <ArrowPathIcon className="animate-spin" />}
            Save links
          </Button>
        </div>
      </section>

      <Panel className="pb-5">
        <PanelHeader
          icon={EnvelopeIcon}
          title="Approval email"
          description="What an approved tester receives. Samsung phones get the Auto Blocker steps."
        />
        {overview.testMode && (
          <p className="mx-5 mt-4 flex items-start gap-2 rounded-lg bg-warn/10 px-3 py-2 text-xs text-foreground ring-1 ring-inset ring-warn/25">
            <ExclamationTriangleIcon className="size-4 shrink-0 text-warn" />
            Resend is in test mode here, so mail only reaches @resend.dev test addresses.
          </p>
        )}
        <div className="mt-5 px-5">
          <Label htmlFor="test-to">Send a test to</Label>
          <Input
            id="test-to"
            type="email"
            className="mt-2"
            placeholder="An inbox on a phone you can check"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 px-5">
          {(["android", "samsung"] as const).map((d) => (
            <Button
              key={`t-${d}`}
              size="sm"
              variant="outline"
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
            >
              {saving === `test-${d}` ? <ArrowPathIcon className="animate-spin" /> : <PaperAirplaneIcon />}
              Send {DEVICE_LABEL[d]} test
            </Button>
          ))}
          {(["android", "samsung"] as const).map((d) => (
            <Button key={d} size="sm" variant="ghost" aria-pressed={preview === d} onClick={() => setPreview(preview === d ? null : d)} className={cn(preview === d && "bg-accent")}>
              <EyeIcon />
              Preview {DEVICE_LABEL[d]}
            </Button>
          ))}
        </div>
      </Panel>

      {preview && (
        <Panel className="order-last overflow-hidden lg:col-span-2 animate-in fade-in-0 slide-in-from-top-1 duration-200 motion-reduce:animate-none">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <p className="flex items-center gap-2 text-sm font-medium">
              <SparklesIcon className="size-4 text-muted-foreground" />
              Preview · {DEVICE_LABEL[preview]}
            </p>
            <Button size="icon-sm" variant="ghost" aria-label="Close preview" onClick={() => setPreview(null)}>
              <XMarkIcon />
            </Button>
          </div>
          <div className="bg-surface p-4 sm:p-6">
            <iframe
              title="Approval email preview"
              className="mx-auto block h-[720px] w-full max-w-[680px] rounded-xl border border-border bg-white shadow-float"
              srcDoc={testerGuideHtml({
                device: preview,
                inviteLink: s.inviteLink ?? "https://appdistribution.firebase.dev/i/your-invite-link",
                email: "tester@example.com",
                origin: typeof window === "undefined" ? undefined : window.location.origin,
              })}
            />
          </div>
        </Panel>
      )}
    </div>
  );
}
