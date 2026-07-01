"use client";

import type { LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

type StatCardProps = {
  icon: LucideIcon;
  label: string;
  /** Undefined while the underlying count query is loading. */
  value: number | undefined;
  /** Optional secondary note, e.g. "3 new". */
  hint?: string;
};

/**
 * Compact metric card for the admin dashboard header. Reuses the shadcn Card;
 * shows a skeleton bar while the count is still loading.
 */
export function StatCard({ icon: Icon, label, value, hint }: StatCardProps) {
  return (
    <Card className="gap-3 py-5">
      <div className="flex items-center justify-between px-6">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex items-end gap-2 px-6">
        {value === undefined ? (
          <span className="my-1 h-8 w-16 animate-pulse rounded bg-muted" />
        ) : (
          <span className="text-3xl font-light tabular-nums tracking-tight text-foreground">
            {value.toLocaleString()}
          </span>
        )}
        {hint && (
          <Badge variant="secondary" className="mb-1.5">
            {hint}
          </Badge>
        )}
      </div>
    </Card>
  );
}
