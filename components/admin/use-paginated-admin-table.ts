"use client";

import { useEffect } from "react";
import { usePaginatedQuery } from "convex/react";
import type {
  PaginatedQueryArgs,
  PaginatedQueryReference,
} from "convex/react";

import { useAdminTable, type AdminTableKey } from "@/lib/admin-table-store";

/**
 * Bridges Convex's cursor-based `usePaginatedQuery` with the zustand-backed
 * page state so the admin tables get real page-number navigation while staying
 * live. Results accumulate via `loadMore`; the current page is sliced
 * client-side, the cursor query is auto-topped-up when the user advances, and
 * the page index is clamped if the underlying data shrinks.
 *
 * `extraArgs` is forwarded to the query (e.g. a status filter); changing it
 * resets the cursor pagination automatically.
 */
export function usePaginatedAdminTable<Query extends PaginatedQueryReference>(
  query: Query,
  key: AdminTableKey,
  extraArgs?: PaginatedQueryArgs<Query>,
) {
  const { pageIndex, pageSize, setPageIndex, setPageSize } = useAdminTable(key);
  const { results, status, loadMore } = usePaginatedQuery(
    query,
    (extraArgs ?? {}) as PaginatedQueryArgs<Query>,
    { initialNumItems: pageSize },
  );

  const loaded = results.length;
  const needed = (pageIndex + 1) * pageSize;

  // Top up the cursor query until the current page is fully loaded, PLUS one
  // row of lookahead (<=): when the loaded rows are an exact page multiple,
  // Convex still reports CanLoadMore even if nothing is left, which used to
  // light up "Next" on the last page. The lookahead settles the question —
  // either extra rows arrive or the query flips to Exhausted.
  useEffect(() => {
    if (loaded <= needed && status === "CanLoadMore") loadMore(pageSize);
  }, [loaded, needed, status, loadMore, pageSize]);

  // Clamp the page if the table shrank under us (live deletes / size change).
  useEffect(() => {
    if (status === "Exhausted" && pageIndex > 0 && pageIndex * pageSize >= loaded) {
      setPageIndex(Math.max(0, Math.ceil(loaded / pageSize) - 1));
    }
  }, [status, pageIndex, pageSize, loaded, setPageIndex]);

  const pageRows = results.slice(pageIndex * pageSize, needed);
  const exhausted = status === "Exhausted";
  const hasNext = needed < loaded || !exhausted;

  return {
    pageRows,
    pageIndex,
    pageSize,
    setPageIndex,
    setPageSize,
    hasPrev: pageIndex > 0,
    hasNext,
    // Exact total is only known once the cursor query is exhausted.
    total: exhausted ? loaded : undefined,
    rangeStart: loaded === 0 ? 0 : pageIndex * pageSize + 1,
    rangeEnd: pageIndex * pageSize + pageRows.length,
    isFirstLoad: status === "LoadingFirstPage",
    isPageLoading:
      pageRows.length === 0 &&
      status !== "Exhausted" &&
      status !== "LoadingFirstPage",
    isEmpty: exhausted && loaded === 0,
    /** All rows loaded so far (newest first) — used by client-side search. */
    loadedRows: results,
    status,
    loadMore,
  };
}
