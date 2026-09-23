"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Check, Copy, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { getAttribution } from "@/lib/attribution";

import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

/** Underline field — the form sits on the page, not in a card. */
const FIELD =
  "peer w-full border-0 border-b border-input bg-transparent px-0 pb-2.5 pt-5 text-base text-foreground outline-none transition-colors placeholder:text-transparent focus:border-primary aria-[invalid=true]:border-destructive";
const LABEL =
  "pointer-events-none absolute left-0 top-5 origin-left text-base text-muted-foreground transition-all peer-focus:top-0 peer-focus:text-[11px] peer-focus:uppercase peer-focus:tracking-[0.18em] peer-focus:text-primary peer-[:not(:placeholder-shown)]:top-0 peer-[:not(:placeholder-shown)]:text-[11px] peer-[:not(:placeholder-shown)]:uppercase peer-[:not(:placeholder-shown)]:tracking-[0.18em]";
const CHIP =
  "rounded-full border border-border px-3.5 py-1.5 text-xs text-foreground/80 transition-colors hover:border-primary hover:text-primary";

const schema = z.object({
  name: z
    .string()
    .min(2, { message: "Please enter your name" })
    .max(100, { message: "That name is too long" }),
  email: z
    .string()
    .email({ message: "Please enter a valid email address" })
    .max(254, { message: "That email is too long" }),
  phone: z.string().max(32, { message: "That phone number is too long" }).optional(),
  agreed: z.boolean().refine((v) => v, {
    message: "Please accept to continue",
  }),
  // Honeypot — hidden from real users; bots that fill it get a silent no-op.
  website: z.string().optional(),
});
type Values = z.infer<typeof schema>;

const SHARE_TEXT =
  "I just joined the waitlist for MyPA — a voice-first AI personal assistant. Grab a spot:";

function shareLink(referralCode: string): string {
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (typeof window !== "undefined" ? window.location.origin : "");
  return `${origin}/?ref=${referralCode}`;
}

export function WaitlistForm() {
  const submit = useMutation(api.waitlist.submit);
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [referral, setReferral] = useState<{
    referralCode?: string;
    position?: number;
  }>({});

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", phone: "", agreed: false, website: "" },
  });

  const onSubmit = async (data: Values) => {
    setServerError(null);
    try {
      const res = await submit({
        name: data.name,
        email: data.email,
        phone: data.phone || undefined,
        source: "landing",
        agreed: data.agreed,
        website: data.website || undefined,
        ...getAttribution(),
      });
      if (res.duplicate) {
        toast.info("You're already on the list — we'll be in touch.");
      } else {
        toast.success("You're on the waitlist!");
      }
      setReferral({ referralCode: res.referralCode, position: res.position });
      setDone(true);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Something went wrong. Please try again.";
      setServerError(message);
      toast.error(message);
    }
  };

  if (done) {
    const link = referral.referralCode ? shareLink(referral.referralCode) : null;
    const copyLink = async () => {
      if (!link) return;
      try {
        await navigator.clipboard.writeText(link);
        toast.success("Link copied — share it anywhere.");
      } catch {
        toast.error("Couldn't copy — select the link and copy it manually.");
      }
    };
    const encodedLink = link ? encodeURIComponent(link) : "";
    const encodedText = encodeURIComponent(SHARE_TEXT);

    return (
      <div className="rounded-3xl border border-primary/25 bg-primary/[0.06] p-6 sm:p-7">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="h-4 w-4" />
          </span>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-primary">
            Your place is saved
          </p>
        </div>
        <h3 className="mt-4 font-serif text-3xl leading-tight text-foreground">
          {referral.position
            ? <>You&rsquo;re <em className="text-primary">N&deg;&nbsp;{referral.position}</em> on the list.</>
            : "You\u2019re on the list."}
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          A confirmation is on its way to your inbox. Your invite follows the
          moment MyPA is ready.
        </p>

        {link && (
          <div className="mt-6">
            <p className="text-sm text-foreground">Bring someone along:</p>
            <div className="mt-2 flex items-center gap-2 rounded-full border border-border bg-background/60 py-1 pl-4 pr-1">
              <input
                readOnly
                value={link}
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 bg-transparent font-mono text-xs text-foreground/80 outline-none"
                aria-label="Your referral link"
              />
              <button
                type="button"
                onClick={copyLink}
                aria-label="Copy referral link"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-90"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <a className={CHIP} target="_blank" rel="noopener noreferrer" href={`https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedLink}`}>
                Share on X
              </a>
              <a className={CHIP} target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodedText}%20${encodedLink}`}>
                WhatsApp
              </a>
              <a className={CHIP} target="_blank" rel="noopener noreferrer" href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodedLink}`}>
                LinkedIn
              </a>
            </div>
          </div>
        )}
      </div>
    );
  }

  const errors = form.formState.errors;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="relative">
          <input
            id="name"
            placeholder="Full name"
            autoComplete="name"
            className={FIELD}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "name-error" : undefined}
            {...form.register("name")}
          />
          <label htmlFor="name" className={LABEL}>Full name</label>
          {errors.name && (
            <p id="name-error" role="alert" className="mt-1.5 text-xs text-destructive">
              {errors.name.message}
            </p>
          )}
        </div>

        <div className="relative">
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="Email"
            className={FIELD}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "email-error" : undefined}
            {...form.register("email")}
          />
          <label htmlFor="email" className={LABEL}>Email</label>
          {errors.email && (
            <p id="email-error" role="alert" className="mt-1.5 text-xs text-destructive">
              {errors.email.message}
            </p>
          )}
        </div>
      </div>

      <div className="relative">
        <input
          id="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="Phone (optional)"
          className={FIELD}
          aria-invalid={!!errors.phone}
          aria-describedby={errors.phone ? "phone-error" : undefined}
          {...form.register("phone")}
        />
        <label htmlFor="phone" className={LABEL}>
          Phone <span className="normal-case tracking-normal opacity-70">(optional)</span>
        </label>
        {errors.phone && (
          <p id="phone-error" role="alert" className="mt-1.5 text-xs text-destructive">
            {errors.phone.message}
          </p>
        )}
      </div>

      {/* Honeypot: visually hidden and skipped by keyboard/screen readers. */}
      <div className="sr-only" aria-hidden="true">
        <label htmlFor="website">Leave this field empty</label>
        <input
          id="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          {...form.register("website")}
        />
      </div>

      <div className="flex flex-col gap-5 pt-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-start gap-2.5">
            <Checkbox
              id="agreed"
              className="mt-0.5"
              checked={form.watch("agreed")}
              aria-invalid={!!errors.agreed}
              aria-describedby={errors.agreed ? "agreed-error" : undefined}
              onCheckedChange={(c) => form.setValue("agreed", c === true, { shouldValidate: true })}
            />
            <label htmlFor="agreed" className="text-sm leading-snug text-muted-foreground">
              Email me about early access.
            </label>
          </div>
          {errors.agreed && (
            <p id="agreed-error" role="alert" className="mt-1.5 text-xs text-destructive">
              {errors.agreed.message}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={form.formState.isSubmitting}
          className={cn(
            // Tactile, raised key: a soft top-to-bottom tone, a lit top edge,
            // a darker lip underneath and a short cast shadow. Pressing sinks
            // it one pixel and swaps the lift for an inset shadow.
            "group inline-flex h-12 items-center justify-center gap-2 rounded-full px-7 text-sm font-medium text-primary-foreground",
            "border border-[color-mix(in_oklch,var(--primary)_65%,black)]",
            "bg-[linear-gradient(to_bottom,color-mix(in_oklch,var(--primary)_92%,white),color-mix(in_oklch,var(--primary)_92%,black))]",
            "shadow-[inset_0_1px_0_rgb(255_255_255/0.28),inset_0_-2px_0_rgb(0_0_0/0.14),0_2px_0_color-mix(in_oklch,var(--primary)_55%,black),0_4px_8px_-2px_rgb(0_0_0/0.35)]",
            "[text-shadow:0_-1px_0_rgb(0_0_0/0.25)] dark:[text-shadow:0_1px_0_rgb(255_255_255/0.3)]",
            "transition-[transform,box-shadow] duration-100 hover:brightness-[1.04]",
            "active:translate-y-[2px] active:shadow-[inset_0_2px_4px_rgb(0_0_0/0.25),0_0_0_color-mix(in_oklch,var(--primary)_55%,black)]",
            "disabled:opacity-60",
          )}
        >
          {form.formState.isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Reserve my place
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 [filter:drop-shadow(0_-1px_0_rgb(0_0_0/0.2))]" />
        </button>
      </div>

      {serverError && (
        <p role="alert" className="text-sm text-destructive">
          {serverError}
        </p>
      )}
    </form>
  );
}
