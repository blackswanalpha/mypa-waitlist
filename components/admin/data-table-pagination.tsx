"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PAGE_SIZE_OPTIONS } from "@/lib/admin-table-store";

type DataTablePaginationProps = {
  pageIndex: number;
  pageSize: number;
  setPageIndex: (i: number) => void;
  setPageSize: (n: number) => void;
  hasPrev: boolean;
  hasNext: boolean;
  rangeStart: number;
  rangeEnd: number;
  /** Exact total once known (cursor query exhausted); otherwise undefined. */
  total?: number;
};

/**
 * Pagination footer for the admin tables: rows-per-page selector, a range
 * indicator, and Prev/Next buttons. Reads/writes the zustand-backed page state
 * via the props threaded from `usePaginatedAdminTable`.
 */
export function DataTablePagination({
  pageIndex,
  pageSize,
  setPageIndex,
  setPageSize,
  hasPrev,
  hasNext,
  rangeStart,
  rangeEnd,
  total,
}: DataTablePaginationProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 px-2 py-3 text-sm text-muted-foreground">
      <label className="flex items-center gap-2">
        <span>Rows</span>
        <select
          aria-label="Rows per page"
          value={pageSize}
          onChange={(e) => setPageSize(Number(e.target.value))}
          className="border-input h-8 rounded-md border bg-transparent px-2 pr-7 text-sm text-foreground shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
        >
          {PAGE_SIZE_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>

      <div className="flex items-center gap-4">
        <span className="tabular-nums">
          {rangeStart}–{rangeEnd}
          {total !== undefined ? ` of ${total}` : ""}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPageIndex(pageIndex - 1)}
            disabled={!hasPrev}
          >
            <ChevronLeft className="h-4 w-4" />
            Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPageIndex(pageIndex + 1)}
            disabled={!hasNext}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
