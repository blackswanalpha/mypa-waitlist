"use client";

import { create } from "zustand";

/** Identifies which admin table a piece of UI state belongs to. */
export type AdminTableKey = "waitlist" | "feedback" | "contact";

/** Rows-per-page choices offered in the pagination control. */
export const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

const DEFAULT_PAGE_SIZE = 25;

type TableState = { pageIndex: number; pageSize: number };

type Store = {
  tables: Record<AdminTableKey, TableState>;
  setPageIndex: (key: AdminTableKey, pageIndex: number) => void;
  setPageSize: (key: AdminTableKey, pageSize: number) => void;
};

/**
 * Holds per-table pagination state (current page + rows-per-page) for the
 * admin dashboard. Each tab keeps its own page independently. Changing the
 * page size resets that table back to the first page.
 */
export const useAdminTableStore = create<Store>((set) => ({
  tables: {
    waitlist: { pageIndex: 0, pageSize: DEFAULT_PAGE_SIZE },
    feedback: { pageIndex: 0, pageSize: DEFAULT_PAGE_SIZE },
    contact: { pageIndex: 0, pageSize: DEFAULT_PAGE_SIZE },
  },
  setPageIndex: (key, pageIndex) =>
    set((s) => ({
      tables: {
        ...s.tables,
        [key]: { ...s.tables[key], pageIndex: Math.max(0, pageIndex) },
      },
    })),
  setPageSize: (key, pageSize) =>
    set((s) => ({
      tables: { ...s.tables, [key]: { pageSize, pageIndex: 0 } },
    })),
}));

/** Convenience selector hook bound to a single table. */
export function useAdminTable(key: AdminTableKey) {
  const state = useAdminTableStore((s) => s.tables[key]);
  const setPageIndex = useAdminTableStore((s) => s.setPageIndex);
  const setPageSize = useAdminTableStore((s) => s.setPageSize);
  return {
    pageIndex: state.pageIndex,
    pageSize: state.pageSize,
    setPageIndex: (i: number) => setPageIndex(key, i),
    setPageSize: (n: number) => setPageSize(key, n),
  };
}
