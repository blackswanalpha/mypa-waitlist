"use client";

import { useState } from "react";
import { useAction, useConvex, useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { flexRender, type ColumnDef } from "@tanstack/react-table";
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ArrowUturnLeftIcon,
  CheckBadgeIcon,
  CheckCircleIcon,
  CloudArrowUpIcon,
  MagnifyingGlassIcon,
  ShieldCheckIcon,
} from "@heroicons/react/16/solid";
import { InboxIcon } from "@heroicons/react/24/outline";
import { toast } from "sonner";

import type { FunctionReturnType } from "convex/server";

import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataTablePagination } from "@/components/admin/data-table-pagination";
import { Avatar, EmptyState, Panel, Segmented, SkeletonRows, StatusPill, fmtDateTime } from "@/components/admin/kit";
import { useLiveTable } from "@/components/admin/use-live-table";
import { useAdminTable } from "@/lib/admin-table-store";
import { toCsv, downloadCsv } from "@/lib/csv";
import { cn } from "@/lib/utils";

type WaitlistStatus = "pending" | "invited" | "registered";

const STATUS_LABEL: Record<WaitlistStatus, string> = {
  pending: "Pending",
  invited: "Whitelisted",
  registered: "Registered",
};

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function StatusBadge({ status, synced }: { status: WaitlistStatus; synced: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <StatusPill tone={status === "invited" ? "brand" : status === "registered" ? "info" : "neutral"}>{STATUS_LABEL[status]}</StatusPill>
      {synced && <CheckBadgeIcon className="size-4 text-brand-ink" aria-label="Synced to backend" />}
    </span>
  );
}

type WaitlistRow = FunctionReturnType<typeof api.waitlist.listForAdmin>["page"][number];

const matchesSignup = (r: WaitlistRow, needle: string) =>
  (r.name ?? "").toLowerCase().includes(needle) || r.email.toLowerCase().includes(needle);

const COLUMNS: ColumnDef<WaitlistRow>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        aria-label="Select all rows in view"
        checked={table.getIsAllPageRowsSelected() ? true : table.getIsSomePageRowsSelected() ? "indeterminate" : false}
        onCheckedChange={(c) => table.toggleAllPageRowsSelected(c === true)}
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        aria-label={`Select ${row.original.name ?? row.original.email}`}
        checked={row.getIsSelected()}
        onCheckedChange={(c) => row.toggleSelected(c === true)}
      />
    ),
    meta: { className: "w-10" },
  },
  {
    id: "name",
    header: "Name",
    cell: ({ row: { original: r } }) => (
      <div className="flex items-center gap-3">
        <Avatar name={r.name} email={r.email} />
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{r.name ?? "—"}</p>
          <p className="truncate text-xs text-muted-foreground">{r.email}</p>
        </div>
      </div>
    ),
  },
  {
    id: "phone",
    header: "Phone",
    cell: ({ row: { original: r } }) => <span className="text-muted-foreground">{r.phone ?? "—"}</span>,
  },
  {
    id: "status",
    header: "Status",
    cell: ({ row: { original: r } }) => <StatusBadge status={r.status} synced={r.syncedAt !== undefined} />,
  },
  {
    id: "joined",
    header: () => <span className="block text-right">Joined</span>,
    cell: ({ row: { original: r } }) => (
      <span className="block whitespace-nowrap text-right text-sm text-muted-foreground">{fmtDateTime(r.createdAt)}</span>
    ),
  },
];

export function WaitlistTab() {
  const { statusFilter, setStatusFilter, setPageIndex } = useAdminTable("waitlist");
  const filter = statusFilter as WaitlistStatus | undefined;
  const { results, status, loadMore } = usePaginatedQuery(
    api.waitlist.listForAdmin,
    filter ? { status: filter } : {},
    { initialNumItems: 25 },
  );
  const counts = useQuery(api.waitlist.countByStatus);
  const setStatus = useMutation(api.waitlist.setStatus);
  const whitelistAllPending = useMutation(api.waitlist.whitelistAllPending);
  const syncToBackend = useAction(api.sync.syncToBackend);
  const convex = useConvex();

  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [syncSummary, setSyncSummary] = useState<{ text: string; ok: boolean } | null>(null);

  const t = useLiveTable({
    tableKey: "waitlist",
    data: results,
    status,
    loadMore,
    columns: COLUMNS,
    total: counts ? (filter ? counts[filter] : counts.total) : undefined,
    search,
    matches: matchesSignup,
  });
  const searching = t.searching;
  const rows = t.rows;
  const selected = t.selectedRows;

  const bulkSetStatus = async (status: WaitlistStatus) => {
    const ids = selected.map((r) => r._id);
    setBusy(status === "invited" ? "whitelist" : "pending");
    try {
      let updated = 0;
      for (const batch of chunk(ids, 200)) {
        const res = await setStatus({ ids: batch, status });
        updated += res.updated;
      }
      toast.success(
        status === "invited"
          ? `Whitelisted ${updated} signup${updated === 1 ? "" : "s"}.`
          : `Moved ${updated} back to pending.`,
      );
      t.clearSelection();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bulk update failed.");
    } finally {
      setBusy(null);
    }
  };

  const whitelistAll = async () => {
    setConfirmAll(false);
    setBusy("all");
    try {
      let total = 0;
      // Each call flips ≤200 rows in its own transaction; loop until dry.
      for (;;) {
        const res = await whitelistAllPending({});
        total += res.updated;
        if (!res.remaining) break;
      }
      toast.success(`Whitelisted ${total} pending signup${total === 1 ? "" : "s"}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Whitelist-all failed.");
    } finally {
      setBusy(null);
    }
  };

  const exportCsv = async () => {
    setBusy("export");
    try {
      const all: FunctionReturnType<typeof api.waitlist.exportPage>["page"] = [];
      let cursor: string | null = null;
      for (;;) {
        const page: FunctionReturnType<typeof api.waitlist.exportPage> =
          await convex.query(api.waitlist.exportPage, {
            cursor,
            status: statusFilter as WaitlistStatus | undefined,
          });
        all.push(...page.page);
        if (page.isDone) break;
        cursor = page.continueCursor;
      }
      const csv = toCsv(
        [
          "name",
          "email",
          "phone",
          "status",
          "source",
          "createdAt",
          "consentAt",
          "whitelistedAt",
          "syncedAt",
          "position",
          "referralCode",
          "referredBy",
          "referralCount",
          "utmSource",
          "utmMedium",
          "utmCampaign",
          "referrerDomain",
          "landingPath",
        ],
        all.map((r) => [
          r.name ?? "",
          r.email,
          r.phone ?? "",
          r.status,
          r.source ?? "",
          new Date(r.createdAt).toISOString(),
          r.consentAt ? new Date(r.consentAt).toISOString() : "",
          r.whitelistedAt ? new Date(r.whitelistedAt).toISOString() : "",
          r.syncedAt ? new Date(r.syncedAt).toISOString() : "",
          r.position ?? "",
          r.referralCode ?? "",
          r.referredBy ?? "",
          r.referralCount ?? "",
          r.utmSource ?? "",
          r.utmMedium ?? "",
          r.utmCampaign ?? "",
          r.referrerDomain ?? "",
          r.landingPath ?? "",
        ]),
      );
      const suffix = statusFilter ? `-${statusFilter}` : "";
      downloadCsv(
        `waitlist${suffix}-${new Date().toISOString().slice(0, 10)}.csv`,
        csv,
      );
      toast.success(`Exported ${all.length} rows.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setBusy(null);
    }
  };

  const runSync = async () => {
    setBusy("sync");
    setSyncSummary(null);
    try {
      const res = await syncToBackend({});
      const summary =
        res.attempted === 0
          ? "Nothing to sync — every whitelisted signup is already pushed."
          : `Synced ${res.synced} of ${res.attempted}${res.failed ? `, ${res.failed} failed` : ""}.`;
      setSyncSummary({ text: summary, ok: res.failed === 0 });
      if (res.failed > 0) {
        toast.error(`${summary} ${res.errors[0] ?? ""}`);
      } else {
        toast.success(summary);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Sync failed.";
      setSyncSummary({ text: message, ok: false });
      toast.error(message);
    } finally {
      setBusy(null);
    }
  };

  const chips: { label: string; value?: WaitlistStatus; count?: number }[] = [
    { label: "All", value: undefined, count: counts?.total },
    { label: "Pending", value: "pending", count: counts?.pending },
    { label: "Whitelisted", value: "invited", count: counts?.invited },
    { label: "Registered", value: "registered", count: counts?.registered },
  ];

  return (
    <div className="space-y-4">
      {/* Bulk-whitelist the backlog: the one action this list exists for. */}
      {counts !== undefined && counts.pending > 0 && selected.length === 0 && (
        <Panel className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand/15 text-brand-ink">
            <ShieldCheckIcon className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-heading text-[15px] font-semibold text-foreground">
              {counts.pending.toLocaleString()} signup{counts.pending === 1 ? "" : "s"} not yet whitelisted
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {confirmAll
                ? `Whitelist all ${counts.pending.toLocaleString()} pending signups? Nothing is emailed.`
                : "Whitelisting marks them ready for the backend. Sync pushes them there."}
            </p>
          </div>
          {confirmAll ? (
            <div className="flex shrink-0 gap-2">
              <Button variant="ghost" onClick={() => setConfirmAll(false)} disabled={busy !== null}>
                Cancel
              </Button>
              <Button variant="brand" onClick={whitelistAll} disabled={busy !== null}>
                {busy === "all" ? <ArrowPathIcon className="animate-spin" /> : <ShieldCheckIcon />}
                Confirm
              </Button>
            </div>
          ) : (
            <Button variant="brand" className="shrink-0" onClick={() => setConfirmAll(true)} disabled={busy !== null}>
              <ShieldCheckIcon />
              Whitelist all pending
            </Button>
          )}
        </Panel>
      )}

      <Panel className="overflow-hidden">
        {/* Toolbar: filter, search, export, sync */}
        <div className="flex flex-wrap items-center gap-2 px-4 pt-4 sm:px-5">
          <Segmented
            label="Filter by status"
            value={statusFilter as WaitlistStatus | undefined}
            onChange={(v) => {
              setStatusFilter(v);
              t.clearSelection();
            }}
            items={chips.map((c) => ({ value: c.value, label: c.label, count: c.count }))}
          />
          <div className="relative ml-auto w-full sm:w-60">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              type="search"
              onChange={(e) => {
                setSearch(e.target.value);
                setPageIndex(0);
              }}
              placeholder="Search name or email"
              aria-label="Search waitlist by name or email"
              className="pl-9"
            />
          </div>
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={busy !== null}>
            {busy === "export" ? <ArrowPathIcon className="animate-spin" /> : <ArrowDownTrayIcon />}
            CSV
          </Button>
          <Button size="sm" variant="outline" onClick={runSync} disabled={busy !== null}>
            {busy === "sync" ? <ArrowPathIcon className="animate-spin" /> : <CloudArrowUpIcon />}
            Sync to backend
          </Button>
        </div>

        {syncSummary && (
          <p role="status" className={cn("mx-4 mt-3 flex items-center gap-2 text-xs sm:mx-5", syncSummary.ok ? "text-brand-ink" : "text-destructive")}>
            {syncSummary.ok && <CheckCircleIcon className="size-4" />}
            {syncSummary.text}
          </p>
        )}

        {/* Selection bar */}
        {selected.length > 0 && (
          <div className="mx-4 mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-brand/10 px-3.5 py-2.5 ring-1 ring-inset ring-brand/25 animate-in fade-in-0 slide-in-from-top-1 duration-200 motion-reduce:animate-none sm:mx-5">
            <span className="text-sm font-medium text-foreground">{selected.length} selected</span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Button size="sm" variant="ghost" onClick={t.clearSelection} disabled={busy !== null}>
                Clear
              </Button>
              <Button size="sm" variant="outline" onClick={() => bulkSetStatus("pending")} disabled={busy !== null}>
                {busy === "pending" ? <ArrowPathIcon className="animate-spin" /> : <ArrowUturnLeftIcon />}
                Mark pending
              </Button>
              <Button size="sm" variant="brand" onClick={() => bulkSetStatus("invited")} disabled={busy !== null}>
                {busy === "whitelist" ? <ArrowPathIcon className="animate-spin" /> : <ShieldCheckIcon />}
                Whitelist selected
              </Button>
            </div>
          </div>
        )}

        <div className="mt-4 border-t border-border">
          {t.isFirstLoad ? (
            <SkeletonRows />
          ) : t.isEmpty && !searching ? (
            <EmptyState
              icon={InboxIcon}
              title={statusFilter ? "Nothing with this status" : "No signups yet"}
              body={statusFilter ? "Pick another filter, or wait for the next signup." : "Signups from the old form appear here."}
            />
          ) : searching && t.exhausted && rows.length === 0 ? (
            <EmptyState icon={MagnifyingGlassIcon} title="No matches" body={`Nobody's name or email contains “${search.trim()}”.`} />
          ) : (
            <>
              <Table className="[&_td]:px-3 [&_td]:py-3 [&_th]:h-10 [&_th]:px-3 [&_th]:text-xs [&_th]:font-medium [&_th]:text-muted-foreground [&_td:first-child]:pl-5 [&_th:first-child]:pl-5 [&_td:last-child]:pr-5 [&_th:last-child]:pr-5">
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
              {searching && !t.exhausted ? (
                <p className="flex items-center gap-2 border-t border-border px-5 py-3 text-xs text-muted-foreground" role="status">
                  <ArrowPathIcon className="size-3.5 animate-spin" /> Searching every signup…
                </p>
              ) : (
                <DataTablePagination table={t.table} />
              )}
            </>
          )}
        </div>
      </Panel>
    </div>
  );
}
