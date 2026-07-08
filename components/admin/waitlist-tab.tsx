"use client";

import { useEffect, useMemo, useState } from "react";
import { useAction, useConvex, useMutation, useQuery } from "convex/react";
import {
  CheckCircle2,
  CloudUpload,
  Download,
  Inbox,
  Loader2,
  Search,
  ShieldCheck,
  Undo2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import type { FunctionReturnType } from "convex/server";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
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
import { usePaginatedAdminTable } from "@/components/admin/use-paginated-admin-table";
import { useAdminTable } from "@/lib/admin-table-store";
import { toCsv, downloadCsv } from "@/lib/csv";
import { cn } from "@/lib/utils";

type WaitlistStatus = "pending" | "invited" | "registered";
type WaitlistId = Id<"waitlist">;

const STATUS_LABEL: Record<WaitlistStatus, string> = {
  pending: "Pending",
  invited: "Whitelisted",
  registered: "Registered",
};

function fmt(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function StatusBadge({
  status,
  synced,
}: {
  status: WaitlistStatus;
  synced: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge
        variant="secondary"
        className={cn(
          status === "invited" && "bg-fern/15 text-fern",
          status === "registered" && "bg-primary/15 text-primary",
        )}
      >
        {STATUS_LABEL[status]}
      </Badge>
      {synced && (
        <CheckCircle2
          className="h-3.5 w-3.5 text-fern"
          aria-label="Synced to backend"
        />
      )}
    </span>
  );
}

export function WaitlistTab() {
  const { statusFilter, setStatusFilter } = useAdminTable("waitlist");
  const t = usePaginatedAdminTable(
    api.waitlist.listForAdmin,
    "waitlist",
    statusFilter ? { status: statusFilter as WaitlistStatus } : {},
  );
  const counts = useQuery(api.waitlist.countByStatus);
  const setStatus = useMutation(api.waitlist.setStatus);
  const whitelistAllPending = useMutation(api.waitlist.whitelistAllPending);
  const syncToBackend = useAction(api.sync.syncToBackend);
  const convex = useConvex();

  const [selected, setSelected] = useState<Set<WaitlistId>>(new Set());
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [syncSummary, setSyncSummary] = useState<string | null>(null);

  // While searching, keep loading the cursor so the search sees every row.
  const searching = search.trim().length > 0;
  useEffect(() => {
    if (searching && t.status === "CanLoadMore") t.loadMore(200);
  }, [searching, t]);

  const searchRows = useMemo(() => {
    if (!searching) return null;
    const needle = search.trim().toLowerCase();
    return t.loadedRows.filter(
      (r) =>
        r.name.toLowerCase().includes(needle) ||
        r.email.toLowerCase().includes(needle),
    );
  }, [searching, search, t.loadedRows]);

  const rows = searchRows ?? t.pageRows;
  const allOnViewSelected =
    rows.length > 0 && rows.every((r) => selected.has(r._id));

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnViewSelected) rows.forEach((r) => next.delete(r._id));
      else rows.forEach((r) => next.add(r._id));
      return next;
    });
  };

  const toggleOne = (id: WaitlistId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const bulkSetStatus = async (status: WaitlistStatus) => {
    const ids = [...selected];
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
      setSelected(new Set());
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
          r.name,
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
      setSyncSummary(summary);
      if (res.failed > 0) {
        toast.error(`${summary} ${res.errors[0] ?? ""}`);
      } else {
        toast.success(summary);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Sync failed.";
      setSyncSummary(message);
      toast.error(message);
    } finally {
      setBusy(null);
    }
  };

  if (t.isFirstLoad) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">Loading…</div>
    );
  }

  const chips: { label: string; value?: WaitlistStatus; count?: number }[] = [
    { label: "All", value: undefined, count: counts?.total },
    { label: "Pending", value: "pending", count: counts?.pending },
    { label: "Whitelisted", value: "invited", count: counts?.invited },
    { label: "Registered", value: "registered", count: counts?.registered },
  ];

  return (
    <div className="space-y-3">
      {/* Toolbar: filter chips, search, export, sync */}
      <div className="flex flex-wrap items-center gap-2 px-2 pt-2">
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Filter by status">
          {chips.map((c) => (
            <Button
              key={c.label}
              size="sm"
              variant={statusFilter === c.value || (!statusFilter && !c.value) ? "secondary" : "ghost"}
              onClick={() => setStatusFilter(c.value)}
              aria-pressed={statusFilter === c.value || (!statusFilter && !c.value)}
            >
              {c.label}
              {c.count !== undefined && (
                <span className="ml-1 text-xs text-muted-foreground">{c.count}</span>
              )}
            </Button>
          ))}
        </div>
        <div className="relative ml-auto w-full sm:w-56">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or email…"
            aria-label="Search waitlist by name or email"
            className="pl-8"
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={exportCsv}
          disabled={busy !== null}
        >
          {busy === "export" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          CSV
        </Button>
        <Button size="sm" variant="outline" onClick={runSync} disabled={busy !== null}>
          {busy === "sync" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CloudUpload className="h-4 w-4" />
          )}
          Sync to backend
        </Button>
      </div>

      {syncSummary && (
        <p role="status" className="px-2 text-xs text-muted-foreground">
          {syncSummary}
        </p>
      )}

      {/* Bulk bar */}
      <div className="flex flex-wrap items-center gap-2 px-2">
        {selected.size > 0 ? (
          <>
            <span className="text-sm text-muted-foreground">
              {selected.size} selected
            </span>
            <Button
              size="sm"
              onClick={() => bulkSetStatus("invited")}
              disabled={busy !== null}
            >
              {busy === "whitelist" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
              Whitelist selected
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => bulkSetStatus("pending")}
              disabled={busy !== null}
            >
              <Undo2 className="h-4 w-4" />
              Mark pending
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelected(new Set())}
              disabled={busy !== null}
            >
              <X className="h-4 w-4" />
              Clear
            </Button>
          </>
        ) : confirmAll ? (
          <>
            <span className="text-sm text-muted-foreground">
              Whitelist all {counts?.pending ?? ""} pending signups?
            </span>
            <Button size="sm" onClick={whitelistAll} disabled={busy !== null}>
              Confirm
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setConfirmAll(false)}
              disabled={busy !== null}
            >
              Cancel
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setConfirmAll(true)}
            disabled={busy !== null || (counts !== undefined && counts.pending === 0)}
          >
            {busy === "all" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
            Whitelist all pending
          </Button>
        )}
      </div>

      {t.isEmpty && !searching ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
          <Inbox className="h-8 w-8 opacity-50" />
          <p className="text-sm">
            {statusFilter ? "Nothing with this status yet." : "No signups yet."}
          </p>
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allOnViewSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Select all rows in view"
                  />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow
                  key={r._id}
                  data-state={selected.has(r._id) ? "selected" : undefined}
                >
                  <TableCell>
                    <Checkbox
                      checked={selected.has(r._id)}
                      onCheckedChange={() => toggleOne(r._id)}
                      aria-label={`Select ${r.name}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{r.email}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.phone ?? "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      status={r.status}
                      synced={r.syncedAt !== undefined}
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {fmt(r.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {searching ? (
            <p className="px-2 pb-2 text-xs text-muted-foreground" role="status">
              {t.status === "Exhausted"
                ? `${rows.length} match${rows.length === 1 ? "" : "es"}.`
                : "Searching…"}
            </p>
          ) : (
            <>
              {t.isPageLoading && (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Loading…
                </div>
              )}
              <DataTablePagination {...t} />
            </>
          )}
        </>
      )}
    </div>
  );
}
