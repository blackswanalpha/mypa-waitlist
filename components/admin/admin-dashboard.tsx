"use client";

import { useQuery, useMutation } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { LogOut, Check, Inbox, Users, MessageSquare, Mail } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MyPALogo } from "@/components/mypa-logo";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatCard } from "@/components/admin/stat-card";
import { DataTablePagination } from "@/components/admin/data-table-pagination";
import { usePaginatedAdminTable } from "@/components/admin/use-paginated-admin-table";

function fmt(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
      <Inbox className="h-8 w-8 opacity-50" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

function WaitlistTab() {
  const t = usePaginatedAdminTable(api.waitlist.listForAdmin, "waitlist");

  if (t.isFirstLoad) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Loading…</div>;
  }
  if (t.isEmpty) return <EmptyState label="No signups yet." />;

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Joined</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {t.pageRows.map((r) => (
            <TableRow key={r._id}>
              <TableCell className="font-medium">{r.name}</TableCell>
              <TableCell>{r.email}</TableCell>
              <TableCell className="text-muted-foreground">{r.phone ?? "—"}</TableCell>
              <TableCell>
                <Badge variant="secondary" className="capitalize">
                  {r.status}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">{fmt(r.createdAt)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {t.isPageLoading && (
        <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
      )}
      <DataTablePagination {...t} />
    </>
  );
}

function FeedbackTab() {
  const t = usePaginatedAdminTable(api.feedback.listForAdmin, "feedback");

  if (t.isFirstLoad) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Loading…</div>;
  }
  if (t.isEmpty) return <EmptyState label="No feedback yet." />;

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Rating</TableHead>
            <TableHead>Message</TableHead>
            <TableHead>From</TableHead>
            <TableHead>When</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {t.pageRows.map((r) => (
            <TableRow key={r._id}>
              <TableCell>{r.rating ? `${r.rating}/5` : "—"}</TableCell>
              <TableCell className="max-w-md whitespace-normal">{r.message}</TableCell>
              <TableCell className="text-muted-foreground">
                {r.name || r.email || "Anonymous"}
              </TableCell>
              <TableCell className="text-muted-foreground">{fmt(r.createdAt)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {t.isPageLoading && (
        <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
      )}
      <DataTablePagination {...t} />
    </>
  );
}

function ContactTab() {
  const t = usePaginatedAdminTable(api.contact.listForAdmin, "contact");
  const markHandled = useMutation(api.contact.markHandled);

  if (t.isFirstLoad) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Loading…</div>;
  }
  if (t.isEmpty) return <EmptyState label="No messages yet." />;

  const toggle = async (id: Id<"contactMessages">, handled: boolean) => {
    try {
      await markHandled({ id, handled: !handled });
    } catch {
      toast.error("Couldn't update. Try again.");
    }
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Subject</TableHead>
            <TableHead>From</TableHead>
            <TableHead>Message</TableHead>
            <TableHead>When</TableHead>
            <TableHead className="text-right">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {t.pageRows.map((r) => (
            <TableRow key={r._id}>
              <TableCell className="font-medium">{r.subject}</TableCell>
              <TableCell className="text-muted-foreground">
                <div>{r.name}</div>
                <div className="text-xs">{r.email}</div>
              </TableCell>
              <TableCell className="max-w-sm whitespace-normal">{r.message}</TableCell>
              <TableCell className="text-muted-foreground">{fmt(r.createdAt)}</TableCell>
              <TableCell className="text-right">
                <Button
                  variant={r.handled ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => toggle(r._id, r.handled)}
                >
                  {r.handled && <Check className="h-3.5 w-3.5" />}
                  {r.handled ? "Handled" : "Mark handled"}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {t.isPageLoading && (
        <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
      )}
      <DataTablePagination {...t} />
    </>
  );
}

export function AdminDashboard({ adminEmail }: { adminEmail: string }) {
  const { signOut } = useAuthActions();
  const waitlistCount = useQuery(api.waitlist.count);
  const feedbackCount = useQuery(api.feedback.count);
  const contactCount = useQuery(api.contact.count);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-6 lg:px-12">
          <div className="flex items-center gap-3">
            <MyPALogo showText />
            <Badge variant="outline" className="font-mono">admin</Badge>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {adminEmail}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void signOut()}
              className="gap-2 transition-colors hover:border-destructive hover:bg-destructive/5 hover:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-10 lg:px-12">
        <h1 className="font-serif text-3xl font-light tracking-tight text-foreground">
          Submissions
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Live — updates as people sign up.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <StatCard icon={Users} label="Signups" value={waitlistCount} />
          <StatCard icon={MessageSquare} label="Feedback" value={feedbackCount} />
          <StatCard
            icon={Mail}
            label="Contact"
            value={contactCount?.total}
            hint={
              contactCount && contactCount.unhandled > 0
                ? `${contactCount.unhandled} new`
                : undefined
            }
          />
        </div>

        <Tabs defaultValue="waitlist" className="mt-8 gap-4">
          <TabsList>
            <TabsTrigger value="waitlist">
              Waitlist
              {waitlistCount !== undefined && (
                <Badge variant="secondary">{waitlistCount}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="feedback">
              Feedback
              {feedbackCount !== undefined && (
                <Badge variant="secondary">{feedbackCount}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="contact">
              Contact
              {contactCount !== undefined && (
                <Badge variant="secondary">
                  {contactCount.unhandled > 0
                    ? `${contactCount.unhandled} new`
                    : contactCount.total}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="waitlist">
            <div className="rounded-xl border border-border bg-card p-2">
              <WaitlistTab />
            </div>
          </TabsContent>
          <TabsContent value="feedback">
            <div className="rounded-xl border border-border bg-card p-2">
              <FeedbackTab />
            </div>
          </TabsContent>
          <TabsContent value="contact">
            <div className="rounded-xl border border-border bg-card p-2">
              <ContactTab />
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
