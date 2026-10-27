"use client";

import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { ArrowPathIcon, ArrowRightIcon, EyeIcon, EyeSlashIcon, LockClosedIcon } from "@heroicons/react/16/solid";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LimeLockup } from "@/components/lime-lockup";

export function AdminLogin() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSubmitting(true);
    setError(null);
    try {
      await signIn("password", {
        email: String(fd.get("email") ?? ""),
        password: String(fd.get("password") ?? ""),
        flow,
      });
      // On success the provider updates auth state and the page re-renders.
    } catch {
      const message =
        flow === "signIn"
          ? "Invalid credentials, or this email isn't an admin."
          : "Couldn't create account — sign-up must be enabled (ALLOW_ADMIN_SIGNUP) and the email allowlisted.";
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-5 py-12">
      {/* One soft lime glow behind the card; still, so the eye goes to the form. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-18rem] h-[36rem] w-[56rem] -translate-x-1/2 rounded-full opacity-[0.16] blur-3xl dark:opacity-[0.10]"
        style={{ background: "radial-gradient(closest-side, var(--brand), transparent)" }}
      />

      <div className="relative w-full max-w-[400px] animate-view-in">
        <div className="flex justify-center">
          <LimeLockup descriptor="admin" size={44} />
        </div>

        <div className="mt-8 rounded-2xl border border-border bg-card p-7 shadow-float">
          <h1 className="font-heading text-2xl font-semibold tracking-[-0.025em] text-foreground">
            {flow === "signIn" ? "Welcome back" : "Create the admin account"}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {flow === "signIn" ? "Sign in to review testers and send updates." : "Allowlisted emails only, while sign-up is switched on."}
          </p>

          <form onSubmit={onSubmit} className="mt-7 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="admin-email">Email</Label>
              <Input id="admin-email" name="email" type="email" autoComplete="email" placeholder="you@mypa.computer" className="h-10" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-password">Password</Label>
              <div className="relative">
                <Input
                  id="admin-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={flow === "signIn" ? "current-password" : "new-password"}
                  className="h-10 pr-11"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  aria-controls="admin-password"
                  className="absolute right-1 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
                >
                  {showPassword ? <EyeSlashIcon className="size-4" /> : <EyeIcon className="size-4" />}
                </button>
              </div>
            </div>
            {error && (
              <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive ring-1 ring-inset ring-destructive/20 animate-in fade-in-0 duration-200">
                {error}
              </p>
            )}

            <Button type="submit" variant="brand" className="h-10 w-full" disabled={submitting}>
              {submitting ? <ArrowPathIcon className="animate-spin" /> : null}
              {flow === "signIn" ? "Sign in" : "Create account"}
              {!submitting && <ArrowRightIcon />}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => {
              setFlow(flow === "signIn" ? "signUp" : "signIn");
              setError(null);
            }}
            className="mt-5 w-full text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {flow === "signIn" ? "First time? Create the admin account" : "Already have an account? Sign in"}
          </button>
        </div>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <LockClosedIcon className="size-3.5" />
          Restricted to allowlisted admins
        </p>
      </div>
    </div>
  );
}
