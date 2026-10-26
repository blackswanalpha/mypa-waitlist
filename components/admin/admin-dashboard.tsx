"use client";

import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { LogOut, Users } from "lucide-react";

import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MyPALogo } from "@/components/mypa-logo";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StatCard } from "@/components/admin/stat-card";
import { WaitlistTab } from "@/components/admin/waitlist-tab";
import { AnalyticsTab } from "@/components/admin/analytics-tab";
import { AcquisitionTab } from "@/components/admin/acquisition-tab";
import { ReferralsTab } from "@/components/admin/referrals-tab";
import { EmailTab } from "@/components/admin/email-tab";

export function AdminDashboard({ adminEmail }: { adminEmail: string }) {
  const { signOut } = useAuthActions();
  const waitlistCount = useQuery(api.waitlist.count);

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
        </div>

        <Tabs defaultValue="waitlist" className="mt-8 gap-4">
          <TabsList>
            <TabsTrigger value="waitlist">
              Waitlist
              {waitlistCount !== undefined && (
                <Badge variant="secondary">{waitlistCount}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="email">Email</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="acquisition">Acquisition</TabsTrigger>
            <TabsTrigger value="referrals">Referrals</TabsTrigger>
          </TabsList>

          <TabsContent value="waitlist">
            <div className="rounded-xl border border-border bg-card p-2">
              <WaitlistTab />
            </div>
          </TabsContent>
          <TabsContent value="email">
            <div className="rounded-xl border border-border bg-card">
              <EmailTab adminEmail={adminEmail} />
            </div>
          </TabsContent>
          <TabsContent value="analytics">
            <div className="rounded-xl border border-border bg-card">
              <AnalyticsTab />
            </div>
          </TabsContent>
          <TabsContent value="acquisition">
            <div className="rounded-xl border border-border bg-card">
              <AcquisitionTab />
            </div>
          </TabsContent>
          <TabsContent value="referrals">
            <div className="rounded-xl border border-border bg-card">
              <ReferralsTab />
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
