"use client";

import type { Table } from "@tanstack/react-table";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/16/solid";

import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/admin/kit";
import { PAGE_SIZE_OPTIONS } from "@/lib/admin-table-store";
import { cn } from "@/lib/utils";

/** Page numbers to show: first, last, and the current page's neighbours, with gaps as null. */
function pageList(current: number, count: number): (number | null)[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i);
  const keep = new Set([0, count - 1, current - 1, current, current + 1].filter((i) => i >= 0 && i < count));
  const out: (number | null)[] = [];
  [...keep]
    .sort((a, b) => a - b)
    .forEach((i, n, all) => {
      if (n > 0 && i - all[n - 1] > 1) out.push(null);
      out.push(i);
    });
  return out;
}

/**
 * Footer for the admin tables, driven by the TanStack table's pagination
 * state: rows per page, the range in view, and numbered pages once the total
 * is known.
 */
export function DataTablePagination<TData>({ table }: { table: Table<TData> }) {
  const { pageIndex, pageSize } = table.getState().pagination;
  const pageCount = table.getPageCount();
  const known = pageCount !== -1;
  const onPage = table.getRowModel().rows.length;
  const start = onPage === 0 ? 0 : pageIndex * pageSize + 1;
  const end = pageIndex * pageSize + onPage;

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border px-5 py-3 text-sm text-muted-foreground">
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2">
          <span>Rows</span>
          <NativeSelect aria-label="Rows per page" value={pageSize} onChange={(e) => table.setPageSize(Number(e.target.value))} className="w-[72px]">
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </NativeSelect>
        </label>
        <span className="tabular-nums" role="status">
          <span className="text-foreground">
            {start}–{end}
          </span>
          {known ? ` of ${table.getRowCount().toLocaleString()}` : ""}
        </span>
      </div>

      <nav aria-label="Pagination" className="flex items-center gap-1">
        <Button variant="ghost" size="icon-sm" aria-label="Previous page" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
          <ChevronLeftIcon />
        </Button>
        {known ? (
          pageList(pageIndex, pageCount).map((p, i) =>
            p === null ? (
              <span key={`gap-${i}`} aria-hidden className="w-6 text-center">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => table.setPageIndex(p)}
                aria-label={`Page ${p + 1}`}
                aria-current={p === pageIndex ? "page" : undefined}
                className={cn(
                  "grid h-8 min-w-8 place-items-center rounded-lg px-2 text-sm tabular-nums outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  p === pageIndex ? "bg-foreground font-medium text-background" : "hover:bg-accent hover:text-foreground",
                )}
              >
                {p + 1}
              </button>
            ),
          )
        ) : (
          <span className="px-2 tabular-nums">Page {pageIndex + 1}</span>
        )}
        <Button variant="ghost" size="icon-sm" aria-label="Next page" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
          <ChevronRightIcon />
        </Button>
      </nav>
    </div>
  );
}
