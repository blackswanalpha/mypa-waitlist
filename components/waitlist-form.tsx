"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Check, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { getAttribution } from "@/lib/attribution";

import { Checkbox } from "@/components/ui/checkbox";
import type { BotMood } from "@/components/glance-bot";
import { cn } from "@/lib/utils";

const schema = z.object({
  email: z
    .string()
    .trim()
    .min(1, { message: "Add your email to join." })
    .email({ message: "That email doesn’t look right." })
    .max(254, { message: "That email is too long." }),
  agreed: z.boolean().refine((v) => v, {
    message: "Tick the box so we can email your invite.",
  }),
  // Honeypot — hidden from real users; bots that fill it get a silent no-op.
  website: z.string().optional(),
});
type Values = z.infer<typeof schema>;

/**
 * The waitlist: the email field with its button beside it (stacked on phones),
 * consent on the line beneath. Signups go to /api/waitlist, which forwards
 * them to the product backend. `onMood` tells the bot above what the form is
 * doing, so it listens while you type and thinks while it submits.
 */
export function WaitlistForm({ onMood }: { onMood?: (mood: BotMood) => void }) {
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  // After a rejected submit the bot holds its reaction until you type again;
  // the form refocusing the field must not read as "listening".
  const holding = useRef(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", agreed: true, website: "" },
  });

  const onSubmit = async (data: Values) => {
    setServerError(null);
    onMood?.("think");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.email,
          source: "landing",
          agreed: data.agreed,
          website: data.website || undefined,
          ...getAttribution(),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        duplicate?: boolean;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(body.error ?? "Something went wrong. Please try again.");
      }
      if (body.duplicate) {
        toast.info("You're already on the list — we'll be in touch.");
      } else {
        toast.success("You're on the waitlist!");
      }
      setDone(true);
      onMood?.("done");
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Something went wrong. Please try again.";
      setServerError(message);
      toast.error(message);
      holding.current = true;
      onMood?.("failed");
    }
  };

  if (done) {
    return (
      <div className="animate-rise rounded-[1.75rem] border border-border p-5 text-left sm:p-6" role="status">
        <div className="flex items-center gap-2.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-fern text-white">
            <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
          </span>
          <p className="text-[13px] font-medium text-fern">Your place is saved</p>
        </div>
        <h2 className="mt-3 text-[22px] font-medium leading-tight tracking-[-0.02em] text-foreground">
          You&rsquo;re on the list.
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Your invite follows the moment MyPA is ready.
        </p>
      </div>
    );
  }

  const errors = form.formState.errors;
  const submitting = form.formState.isSubmitting;
  const message = errors.email?.message ?? errors.agreed?.message ?? serverError;
  const email = form.register("email");

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit, () => {
        holding.current = true;
        onMood?.("unsure");
      })}
      noValidate
      aria-label="Join the MyPA waitlist"
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="email" className="sr-only">Email address</label>
        <input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="Your email"
          className={cn(
            "h-14 min-w-0 rounded-[8px] sm:flex-1 border bg-background px-5 text-[15px] text-foreground outline-none placeholder:text-muted-foreground",
            "transition-[border-color,box-shadow] duration-200 ease-out",
            "focus:border-foreground/60 focus:ring-4 focus:ring-secondary",
            errors.email ? "border-destructive/60" : "border-input hover:border-foreground/30",
          )}
          aria-invalid={!!errors.email}
          aria-describedby={message ? "waitlist-message" : undefined}
          {...email}
          onFocus={() => !holding.current && onMood?.("listen")}
          onChange={(e) => {
            email.onChange(e);
            holding.current = false;
            onMood?.("listen");
          }}
          onBlur={(e) => {
            email.onBlur(e);
            if (!submitting && !holding.current) onMood?.("idle");
          }}
        />
        <button
          type="submit"
          disabled={submitting}
          className={cn(
            "group inline-flex h-14 shrink-0 items-center justify-center gap-2 rounded-[8px] bg-foreground px-6 text-sm font-medium text-background",
            "transition-[background-color,transform] duration-200 ease-out hover:bg-foreground/85 active:scale-[0.97]",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:cursor-progress",
          )}
        >
          <span>{submitting ? "Joining" : "Join the waitlist"}</span>
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowRight className="h-4 w-4 transition-transform duration-300 ease-out group-hover:translate-x-0.5" />
          )}
        </button>
      </div>

      {/* Honeypot: visually hidden and skipped by keyboard/screen readers. */}
      <div className="sr-only" aria-hidden="true">
        <label htmlFor="website">Leave this field empty</label>
        <input id="website" type="text" tabIndex={-1} autoComplete="off" {...form.register("website")} />
      </div>

      <div className="mt-2 flex justify-center">
        <label
          htmlFor="agreed"
          className="flex min-h-11 cursor-pointer items-center gap-2.5 px-2 text-[13px] text-foreground"
        >
          <Checkbox
            id="agreed"
            className="shadow-none data-[state=checked]:border-fern data-[state=checked]:bg-fern data-[state=checked]:text-white"
            checked={form.watch("agreed")}
            aria-invalid={!!errors.agreed}
            aria-describedby={errors.agreed ? "waitlist-message" : undefined}
            onCheckedChange={(c) => form.setValue("agreed", c === true, { shouldValidate: form.formState.isSubmitted })}
          />
          Email me about early access.
        </label>
      </div>

      <p
        id="waitlist-message"
        role="alert"
        aria-live="polite"
        className={cn(
          "min-h-5 text-center text-[13px] text-destructive transition-opacity duration-200",
          message ? "opacity-100" : "opacity-0",
        )}
      >
        {message}
      </p>
    </form>
  );
}
