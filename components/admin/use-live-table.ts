"use client";

import { useEffect, useMemo, useState } from "react";
import type { PaginationStatus } from "convex/react";
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
} from "@tanstack/react-table";

import { useAdminTable, type AdminTableKey } from "@/lib/admin-table-store";

/**
 * A TanStack table over a live Convex cursor. Convex pages by cursor, so this
 * runs TanStack in manual-pagination mode: rows accumulate through
 * `loadMore`, the current page is sliced out of them, and the cursor is topped
 * up whenever the reader moves past what has loaded. Page state lives in the
 * zustand store so a table keeps its page when its tab unmounts.
 *
 * `total` is the exact row count when the server keeps one (the status
 * counters); without it the page count is unknown until the cursor runs dry.
 * While `search` is set every row is loaded and filtered client-side.
 */
export function useLiveTable<TData extends { _id: string }>({
  tableKey,
  data,
  status,
  loadMore,
  columns,
  total,
  search = "",
  matches,
}: {
  tableKey: AdminTableKey;
  data: TData[];
  status: PaginationStatus;
  loadMore: (numItems: number) => void;
  columns: ColumnDef<TData>[];
  total?: number;
  search?: string;
  matches?: (row: TData, needle: string) => boolean;
}) {
  const { pageIndex, pageSize, setPageIndex, setPageSize } = useAdminTable(tableKey);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const needle = search.trim().toLowerCase();
  const searching = needle.length > 0;
  const exhausted = status === "Exhausted";

  const rows = useMemo(
    () => (searching && matches ? data.filter((r) => matches(r, needle)) : data),
    [data, searching, matches, needle],
  );
  const rowCount = searching ? (exhausted ? rows.length : undefined) : (total ?? (exhausted ? rows.length : undefined));
  const pageRows = useMemo(() => rows.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize), [rows, pageIndex, pageSize]);

  // Searching needs every row; paging needs the current page plus one row of
  // lookahead, which settles whether a last page that ends exactly on a page
  // boundary has anything after it.
  useEffect(() => {
    if (status !== "CanLoadMore") return;
    if (searching) loadMore(200);
    else if (data.length <= (pageIndex + 1) * pageSize) loadMore(pageSize);
  }, [status, searching, data.length, pageIndex, pageSize, loadMore]);

  // Live deletes or a narrower filter can leave the page past the end.
  useEffect(() => {
    if (rowCount === undefined) return;
    const last = Math.max(0, Math.ceil(rowCount / pageSize) - 1);
    if (pageIndex > last) setPageIndex(last);
  }, [rowCount, pageIndex, pageSize, setPageIndex]);

  const table = useReactTable({
    data: pageRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row._id,
    manualPagination: true,
    ...(rowCount !== undefined ? { rowCount } : { pageCount: -1 }),
    state: { pagination: { pageIndex, pageSize }, rowSelection },
    onPaginationChange: (updater) => {
      const next = typeof updater === "function" ? updater({ pageIndex, pageSize }) : updater;
      if (next.pageSize !== pageSize) setPageSize(next.pageSize);
      else setPageIndex(next.pageIndex);
    },
    onRowSelectionChange: setRowSelection,
    enableRowSelection: true,
  });

  return {
    table,
    /** Every loaded row that passes the search, across pages. */
    rows,
    /** Selected rows across pages, not only the visible one. */
    selectedRows: rows.filter((r) => rowSelection[r._id]),
    clearSelection: () => setRowSelection({}),
    rowCount,
    searching,
    exhausted,
    isFirstLoad: status === "LoadingFirstPage",
    isPageLoading: pageRows.length === 0 && !exhausted && status !== "LoadingFirstPage",
    isEmpty: exhausted && rows.length === 0,
  };
}
