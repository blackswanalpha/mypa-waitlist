"use client";

import { useQuery } from "convex/react";
import { ClipboardDocumentIcon } from "@heroicons/react/16/solid";
import { ShareIcon, TrophyIcon, UsersIcon } from "@heroicons/react/24/outline";
import { toast } from "sonner";

import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, EmptyState, Metric, Panel, PanelHeader, SkeletonRows } from "@/components/admin/kit";
import { cn } from "@/lib/utils";

function referralLink(code: string): string {
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (typeof window !== "undefined" ? window.location.origin : "");
  return `${origin}/?ref=${code}`;
}

export function ReferralsTab() {
  const board = useQuery(api.waitlist.referralLeaderboard);

  const copyLink = async (code: string) => {
    try {
      await navigator.clipboard.writeText(referralLink(code));
      toast.success("Referral link copied.");
    } catch {
      toast.error("Couldn't copy the link.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Metric icon={UsersIcon} label="Signups via referral" value={board?.totalReferred.toLocaleString()} />
        <Metric icon={TrophyIcon} label="Active referrers" value={board?.leaders.length.toLocaleString()} />
      </div>

      <Panel className="overflow-hidden">
        <PanelHeader
          icon={ShareIcon}
          title="Referral leaderboard"
          description="Every signup gets a share link (?ref=code). Arrivals who sign up credit the sharer here."
        />
        <div className="mt-4 border-t border-border">
          {board === undefined ? (
            <SkeletonRows rows={4} />
          ) : board.leaders.length === 0 ? (
            <EmptyState icon={ShareIcon} title="No referrals yet" body="They appear as soon as a shared link converts." />
          ) : (
            <Table className="[&_td]:px-3 [&_td]:py-3 [&_th]:h-10 [&_th]:px-3 [&_th]:text-xs [&_th]:font-medium [&_th]:text-muted-foreground [&_td:first-child]:pl-5 [&_th:first-child]:pl-5 [&_td:last-child]:pr-5 [&_th:last-child]:pr-5">
              <TableHeader className="bg-surface/60">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Referrer</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead className="text-right">Referrals</TableHead>
                  <TableHead className="text-right">Queue&nbsp;position</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {board.leaders.map((leader, i) => (
                  <TableRow key={leader._id} className="hover:bg-accent/40">
                    <TableCell>
                      {/* First place is the one difference on the board. */}
                      <span
                        className={cn(
                          "grid size-7 place-items-center rounded-full font-heading text-xs font-semibold tabular-nums",
                          i === 0 ? "bg-brand text-brand-foreground" : "text-muted-foreground",
                        )}
                      >
                        {i + 1}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar name={leader.name} email={leader.email} />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{leader.name ?? "—"}</p>
                          <p className="truncate text-xs text-muted-foreground">{leader.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{leader.referralCode ?? "—"}</TableCell>
                    <TableCell className="text-right font-heading font-semibold tabular-nums">{leader.referralCount.toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{leader.position ? `#${leader.position}` : "—"}</TableCell>
                    <TableCell>
                      {leader.referralCode && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => copyLink(leader.referralCode!)}
                              aria-label={`Copy ${leader.name ?? leader.email}'s referral link`}
                            >
                              <ClipboardDocumentIcon />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Copy referral link</TooltipContent>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </Panel>
    </div>
  );
}
