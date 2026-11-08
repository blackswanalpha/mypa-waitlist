"use client";

import { flexRender, type Table as TanTable } from "@tanstack/react-table";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SkeletonRows } from "@/components/admin/kit";
import { DataTablePagination } from "@/components/admin/data-table-pagination";

/**
 * The body of a read-only admin table driven by useLiveTable: header, rows,
 * a skeleton while a page loads, and the numbered pagination footer.
 */
export function LiveDataTable<TData>({
  table,
  isPageLoading,
}: {
  table: TanTable<TData>;
  isPageLoading: boolean;
}) {
  return (
    <>
      <div className="overflow-x-auto">
        <Table className="[&_td]:px-3 [&_td]:py-3 [&_th]:h-10 [&_th]:px-3 [&_th]:text-xs [&_th]:font-medium [&_th]:text-muted-foreground [&_td:first-child]:pl-5 [&_th:first-child]:pl-5 [&_td:last-child]:pr-5 [&_th:last-child]:pr-5">
          <TableHeader className="bg-surface/60">
            {table.getHeaderGroups().map((hg) => (
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
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} className="transition-colors hover:bg-accent/40">
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className={(cell.column.columnDef.meta as { className?: string } | undefined)?.className}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {isPageLoading && <SkeletonRows rows={3} />}
      <DataTablePagination table={table} />
    </>
  );
}
