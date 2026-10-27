"use client";

import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { ShieldExclamationIcon } from "@heroicons/react/24/outline";

import { api } from "@/convex/_generated/api";
import { AdminLogin } from "@/components/admin/admin-login";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { LimeLockup } from "@/components/lime-lockup";
import { Button } from "@/components/ui/button";

function Unauthorized() {
  const { signOut } = useAuthActions();
  return (
    <div className="flex min-h-screen items-center justify-center px-5">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-7 text-center shadow-float animate-view-in">
        <span className="mx-auto grid size-12 place-items-center rounded-xl bg-destructive/10 text-destructive">
          <ShieldExclamationIcon className="size-6" />
        </span>
        <h1 className="mt-4 font-heading text-xl font-semibold tracking-[-0.02em] text-foreground">Not authorized</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">This account isn&rsquo;t on the admin allowlist.</p>
        <Button variant="outline" className="mt-6 w-full" onClick={() => void signOut()}>
          Sign out
        </Button>
      </div>
    </div>
  );
}

/** Convex Auth settling: the mark and a thin indeterminate line, nothing else. */
function Settling() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6" aria-busy="true" aria-label="Loading">
      <LimeLockup descriptor="admin" size={40} />
      <div className="h-0.5 w-24 overflow-hidden rounded-full bg-border">
        <div className="h-full w-full animate-sheen rounded-full" />
      </div>
    </div>
  );
}

export default function AdminPage() {
  const me = useQuery(api.admin.whoAmI);

  if (me === undefined) return <Settling />;
  if (!me.authed) return <AdminLogin />;
  if (!me.isAdmin) return <Unauthorized />;

  return <AdminDashboard adminEmail={me.email ?? ""} />;
}
