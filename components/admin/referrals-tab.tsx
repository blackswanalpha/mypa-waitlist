"use client";

import { useQuery } from "convex/react";
import { Copy, Trophy, Users } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
    <div className="space-y-4 p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="gap-3 py-5">
          <div className="flex items-center justify-between px-6">
            <span className="text-sm text-muted-foreground">
              Signups via referral
            </span>
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="px-6">
            {board === undefined ? (
              <span className="my-1 block h-8 w-16 animate-pulse rounded bg-muted" />
            ) : (
              <span className="text-3xl font-light tabular-nums tracking-tight text-foreground">
                {board.totalReferred.toLocaleString()}
              </span>
            )}
          </div>
        </Card>
        <Card className="gap-3 py-5">
          <div className="flex items-center justify-between px-6">
            <span className="text-sm text-muted-foreground">Active referrers</span>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="px-6">
            {board === undefined ? (
              <span className="my-1 block h-8 w-16 animate-pulse rounded bg-muted" />
            ) : (
              <span className="text-3xl font-light tabular-nums tracking-tight text-foreground">
                {board.leaders.length.toLocaleString()}
              </span>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Referral leaderboard</CardTitle>
          <CardDescription>
            Every signup gets a share link (?ref=code); arrivals who sign up
            credit the sharer here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {board === undefined ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : board.leaders.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No referrals yet — they&rsquo;ll appear as soon as a shared link converts.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead className="text-right">Referrals</TableHead>
                  <TableHead className="text-right">Queue&nbsp;position</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {board.leaders.map((leader, i) => (
                  <TableRow key={leader._id}>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {i + 1}
                    </TableCell>
                    <TableCell className="font-medium">{leader.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {leader.email}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {leader.referralCode ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {leader.referralCount.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {leader.position ? `#${leader.position}` : "—"}
                    </TableCell>
                    <TableCell>
                      {leader.referralCode && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyLink(leader.referralCode!)}
                          aria-label={`Copy ${leader.name}'s referral link`}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
