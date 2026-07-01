"use client";

import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MyPALogo } from "@/components/mypa-logo";

export function AdminLogin() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSubmitting(true);
    try {
      await signIn("password", {
        email: String(fd.get("email") ?? ""),
        password: String(fd.get("password") ?? ""),
        flow,
      });
      // On success the provider updates auth state and the page re-renders.
    } catch {
      toast.error(
        flow === "signIn"
          ? "Invalid credentials, or this email isn't an admin."
          : "Couldn't create account — the email must be on the allowlist.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <MyPALogo />
          <CardTitle className="pt-2">Admin access</CardTitle>
          <CardDescription>
            {flow === "signIn"
              ? "Sign in to view submissions."
              : "Create the admin account (allowlisted emails only)."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-email">Email</Label>
              <Input
                id="admin-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-password">Password</Label>
              <Input
                id="admin-password"
                name="password"
                type="password"
                autoComplete={flow === "signIn" ? "current-password" : "new-password"}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="animate-spin" />}
              {flow === "signIn" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}
            className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground"
          >
            {flow === "signIn"
              ? "First time? Create the admin account"
              : "Already have an account? Sign in"}
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
