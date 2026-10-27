"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { Tabs as TabsPrimitive } from "radix-ui";
import { useTheme } from "next-themes";
import {
  ArrowRightStartOnRectangleIcon,
  Bars3Icon,
  MoonIcon,
  SunIcon,
} from "@heroicons/react/20/solid";
import {
  ChartBarSquareIcon,
  EnvelopeIcon,
  MegaphoneIcon,
  QueueListIcon,
  ShareIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";

import { api } from "@/convex/_generated/api";
import { LimeLockup } from "@/components/lime-lockup";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { initials, type IconType } from "@/components/admin/kit";
import { TestersTab } from "@/components/admin/testers-tab";
import { WaitlistTab } from "@/components/admin/waitlist-tab";
import { AnalyticsTab } from "@/components/admin/analytics-tab";
import { AcquisitionTab } from "@/components/admin/acquisition-tab";
import { ReferralsTab } from "@/components/admin/referrals-tab";
import { EmailTab } from "@/components/admin/email-tab";
import { cn } from "@/lib/utils";

type View = "testers" | "waitlist" | "referrals" | "analytics" | "acquisition" | "email";

type NavItem = { value: View; label: string; icon: IconType; title: string; description: string };

// Tab names stay clear of the testers filter's names (All, Pending, Approved),
// which the e2e suite finds by role and substring.
const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: "Program",
    items: [
      {
        value: "testers",
        label: "Testers",
        icon: UserGroupIcon,
        title: "Tester program",
        description: "Approve early testers and send their install guide. Updates live as people sign up.",
      },
    ],
  },
  {
    group: "Audience",
    items: [
      {
        value: "waitlist",
        label: "Old waitlist",
        icon: QueueListIcon,
        title: "Old waitlist",
        description: "Signups from before the tester program. Whitelist, export or push them to the backend.",
      },
      {
        value: "referrals",
        label: "Referrals",
        icon: ShareIcon,
        title: "Referrals",
        description: "Who is bringing people in through their share link.",
      },
    ],
  },
  {
    group: "Growth",
    items: [
      {
        value: "analytics",
        label: "Analytics",
        icon: ChartBarSquareIcon,
        title: "Analytics",
        description: "First-party traffic and signups for the landing page.",
      },
      {
        value: "acquisition",
        label: "Acquisition",
        icon: MegaphoneIcon,
        title: "Acquisition",
        description: "Tag the links you share and see which sources convert.",
      },
    ],
  },
  {
    group: "Outreach",
    items: [
      {
        value: "email",
        label: "Email",
        icon: EnvelopeIcon,
        title: "Email",
        description: "Campaigns to the waitlist, the automatic emails, and who opted out.",
      },
    ],
  },
];

const ITEMS = NAV.flatMap((g) => g.items);
const isView = (v: string): v is View => ITEMS.some((i) => i.value === v);

function useView(): [View, (v: View) => void] {
  // The dashboard only mounts on the client (it waits on the auth query), so
  // the hash from a reload or a shared link can seed the first render.
  const [view, setView] = useState<View>(() => {
    const fromHash = typeof window === "undefined" ? "" : window.location.hash.slice(1);
    return isView(fromHash) ? fromHash : "testers";
  });
  const go = (v: View) => {
    setView(v);
    window.history.replaceState(null, "", v === "testers" ? window.location.pathname : `#${v}`);
    window.scrollTo({ top: 0 });
  };
  return [view, go];
}

/** Approved against slots, as a thin bar: the program's finish line, visible from every view. */
function ProgramMeter() {
  const overview = useQuery(api.testers.overview);
  if (!overview) return <div className="h-[74px] rounded-xl border border-border bg-surface" />;
  const { counts, settings } = overview;
  const pct = Math.min(100, (counts.approved / Math.max(1, settings.slots)) * 100);
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Tester slots</span>
        <span className={cn("inline-flex items-center gap-1.5 font-medium", settings.signupsOpen ? "text-brand-ink" : "text-muted-foreground")}>
          <span aria-hidden className={cn("size-1.5 rounded-full", settings.signupsOpen ? "bg-brand-ink" : "bg-muted-foreground/60")} />
          {settings.signupsOpen ? "Open" : "Closed"}
        </span>
      </div>
      <p className="mt-1.5 font-heading text-sm font-semibold tabular-nums text-foreground">
        {counts.approved.toLocaleString()} <span className="font-normal text-muted-foreground">of {settings.slots.toLocaleString()} approved</span>
      </p>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-border">
        <div className="h-full rounded-full bg-brand-ink transition-[width] duration-700 ease-out-quint" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function NavLabel({ item, waiting }: { item: NavItem; waiting?: number }) {
  const Icon = item.icon;
  return (
    <>
      <Icon className="size-[18px] shrink-0 opacity-80 group-data-[state=active]:opacity-100" />
      <span className="flex-1 truncate text-left">{item.label}</span>
      {waiting ? (
        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1.5 text-[11px] font-semibold tabular-nums text-brand-foreground">
          {waiting}
          <span className="sr-only"> waiting</span>
        </span>
      ) : null}
    </>
  );
}

const NAV_ITEM =
  "group relative flex h-9 w-full items-center gap-3 rounded-lg px-2.5 text-sm font-medium text-muted-foreground outline-none transition-colors duration-150 hover:bg-accent/60 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50";
const NAV_ACTIVE = "bg-accent text-foreground";

/** Light is the default; the choice is remembered by next-themes. */
function ThemeSwitch() {
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
          onClick={() => setTheme(dark ? "light" : "dark")}
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          {dark ? <SunIcon /> : <MoonIcon />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{dark ? "Light theme" : "Dark theme"}</TooltipContent>
    </Tooltip>
  );
}

function UserMenu({ adminEmail, compact }: { adminEmail: string; compact?: boolean }) {
  const { signOut } = useAuthActions();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-2.5 rounded-lg text-left outline-none transition-colors hover:bg-accent/60 focus-visible:ring-[3px] focus-visible:ring-ring/50",
            compact ? "p-1" : "w-full p-2",
          )}
          aria-label="Account"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-foreground font-heading text-[11px] font-semibold text-background">
            {initials(undefined, adminEmail)}
          </span>
          {!compact && (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-foreground">{adminEmail.split("@")[0]}</span>
              <span className="block truncate text-xs text-muted-foreground">{adminEmail}</span>
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={compact ? "end" : "start"} side={compact ? "bottom" : "top"} className="w-60">
        <DropdownMenuLabel>
          <span className="block text-muted-foreground">Signed in as</span>
          <span className="mt-0.5 block truncate text-sm font-medium text-foreground">{adminEmail}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => void signOut()}>
          <ArrowRightStartOnRectangleIcon />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AdminDashboard({ adminEmail }: { adminEmail: string }) {
  const [view, go] = useView();
  const [menuOpen, setMenuOpen] = useState(false);
  const overview = useQuery(api.testers.overview);
  const waiting = overview?.counts.pending;
  const current = ITEMS.find((i) => i.value === view)!;

  return (
    <TooltipProvider>
      <TabsPrimitive.Root value={view} onValueChange={(v) => go(v as View)} orientation="vertical" className="min-h-screen bg-background">
        {/* Sidebar (desktop). The nav is the tablist; content panels sit in main. */}
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-surface/60 lg:flex">
          <div className="flex h-16 items-center px-5">
            <LimeLockup descriptor="admin" size={32} />
          </div>
          <TabsPrimitive.List aria-label="Admin sections" className="flex-1 space-y-6 overflow-y-auto px-3 pt-4">
            {NAV.map((g) => (
              <div key={g.group} role="presentation">
                <p role="presentation" className="px-2.5 pb-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">
                  {g.group}
                </p>
                <div className="space-y-0.5">
                  {g.items.map((item) => (
                    <TabsPrimitive.Trigger key={item.value} value={item.value} className={cn(NAV_ITEM, "data-[state=active]:bg-accent data-[state=active]:text-foreground")}>
                      <NavLabel item={item} waiting={item.value === "testers" ? waiting : undefined} />
                    </TabsPrimitive.Trigger>
                  ))}
                </div>
              </div>
            ))}
          </TabsPrimitive.List>
          <div className="space-y-2 border-t border-border p-3">
            <ProgramMeter />
            <div className="flex items-center gap-1">
              <div className="min-w-0 flex-1">
                <UserMenu adminEmail={adminEmail} />
              </div>
              <ThemeSwitch />
            </div>
          </div>
        </aside>

        {/* Top bar (mobile and tablet). */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-xl lg:hidden">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon-sm" aria-label="Open menu" onClick={() => setMenuOpen(true)}>
              <Bars3Icon className="size-5" />
            </Button>
            <LimeLockup descriptor="admin" size={28} />
          </div>
          <div className="flex items-center gap-1">
            <ThemeSwitch />
            <UserMenu adminEmail={adminEmail} compact />
          </div>
        </header>

        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetContent side="left" className="bg-background">
            <div className="flex h-14 items-center px-5">
              <LimeLockup descriptor="admin" size={28} />
            </div>
            <SheetTitle className="sr-only">Admin sections</SheetTitle>
            <SheetDescription className="sr-only">Move between the console&rsquo;s sections.</SheetDescription>
            {/* Plain buttons, not tabs: the sidebar already owns the tablist. */}
            <nav className="flex-1 space-y-6 overflow-y-auto px-3 pt-2">
              {NAV.map((g) => (
                <div key={g.group}>
                  <p className="px-2.5 pb-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">{g.group}</p>
                  <div className="space-y-0.5">
                    {g.items.map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        data-state={view === item.value ? "active" : "inactive"}
                        aria-current={view === item.value ? "page" : undefined}
                        onClick={() => {
                          go(item.value);
                          setMenuOpen(false);
                        }}
                        className={cn(NAV_ITEM, view === item.value && NAV_ACTIVE)}
                      >
                        <NavLabel item={item} waiting={item.value === "testers" ? waiting : undefined} />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </nav>
            <div className="border-t border-border p-3">
              <ProgramMeter />
            </div>
          </SheetContent>
        </Sheet>

        <main className="lg:pl-64">
          <div className="mx-auto w-full max-w-[1240px] px-4 pb-24 pt-8 sm:px-6 lg:px-10 lg:pt-10">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <span aria-hidden className="size-1.5 rounded-full bg-brand-ink" />
                  Live
                </p>
                <h1 className="mt-2 font-heading text-[28px] font-semibold leading-tight tracking-[-0.025em] text-foreground sm:text-[32px]">
                  {current.title}
                </h1>
                <p className="mt-1.5 max-w-2xl text-[15px] text-muted-foreground">{current.description}</p>
              </div>
            </div>

            {ITEMS.map((item) => (
              <TabsPrimitive.Content key={item.value} value={item.value} className="animate-view-in outline-none">
                {item.value === "testers" && <TestersTab />}
                {item.value === "waitlist" && <WaitlistTab />}
                {item.value === "email" && <EmailTab adminEmail={adminEmail} />}
                {item.value === "analytics" && <AnalyticsTab />}
                {item.value === "acquisition" && <AcquisitionTab />}
                {item.value === "referrals" && <ReferralsTab />}
              </TabsPrimitive.Content>
            ))}
          </div>
        </main>
      </TabsPrimitive.Root>
    </TooltipProvider>
  );
}
