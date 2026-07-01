"use client";

import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { Loader2, ShieldX } from "lucide-react";

import { api } from "@/convex/_generated/api";
import { AdminLogin } from "@/components/admin/admin-login";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function Unauthorized() {
  const { signOut } = useAuthActions();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <Card className="w-full max-w-sm text-center">
        <CardHeader className="items-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <ShieldX className="h-6 w-6" />
          </div>
          <CardTitle className="pt-2">Not authorized</CardTitle>
          <CardDescription>
            This account isn&rsquo;t on the admin allowlist.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="w-full" onClick={() => void signOut()}>
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminPage() {
  const me = useQuery(api.admin.whoAmI);

  if (me === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!me.authed) return <AdminLogin />;
  if (!me.isAdmin) return <Unauthorized />;

  return <AdminDashboard adminEmail={me.email ?? ""} />;
}
