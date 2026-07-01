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
 */
export function usePaginatedAdminTable<Query extends PaginatedQueryReference>(
  query: Query,
  key: AdminTableKey,
) {
  const { pageIndex, pageSize, setPageIndex, setPageSize } = useAdminTable(key);
  const { results, status, loadMore } = usePaginatedQuery(
    query,
    {} as PaginatedQueryArgs<Query>,
    { initialNumItems: pageSize },
  );

  const loaded = results.length;
  const needed = (pageIndex + 1) * pageSize;

  // Top up the cursor query until the current page is fully loaded.
  useEffect(() => {
    if (loaded < needed && status === "CanLoadMore") loadMore(pageSize);
  }, [loaded, needed, status, loadMore, pageSize]);

  // Clamp the page if the table shrank under us (live deletes / size change).
  useEffect(() => {
    if (status === "Exhausted" && pageIndex > 0 && pageIndex * pageSize >= loaded) {
      setPageIndex(Math.max(0, Math.ceil(loaded / pageSize) - 1));
    }
  }, [status, pageIndex, pageSize, loaded, setPageIndex]);

  const pageRows = results.slice(pageIndex * pageSize, needed);
  const exhausted = status === "Exhausted";
  const hasNext =
    needed < loaded || status === "CanLoadMore" || status === "LoadingMore";

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
  };
}
