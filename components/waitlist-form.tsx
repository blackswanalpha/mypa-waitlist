"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Check, Copy, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { getAttribution } from "@/lib/attribution";

import { Checkbox } from "@/components/ui/checkbox";
import type { BotMood } from "@/components/glance-bot";
import { cn } from "@/lib/utils";

const CHIP =
  "inline-flex h-11 items-center rounded-full border border-border px-4 text-[13px] text-foreground/80 transition-colors duration-200 hover:border-foreground/40 hover:text-foreground";

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

const SHARE_TEXT =
  "I just joined the waitlist for MyPA — a voice-first AI personal assistant. Grab a spot:";

function shareLink(referralCode: string): string {
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (typeof window !== "undefined" ? window.location.origin : "");
  return `${origin}/?ref=${referralCode}`;
}

/**
 * The waitlist as one input bar: email and the button share a single pill,
 * consent sits on the line beneath it. `onMood` tells the bot above what the
 * form is doing, so it listens while you type and thinks while it submits.
 */
export function WaitlistForm({ onMood }: { onMood?: (mood: BotMood) => void }) {
  const submit = useMutation(api.waitlist.submit);
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  // After a rejected submit the bot holds its reaction until you type again;
  // the form refocusing the field must not read as "listening".
  const holding = useRef(false);
  const [referral, setReferral] = useState<{
    referralCode?: string;
    position?: number;
  }>({});

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", agreed: true, website: "" },
  });

  const onSubmit = async (data: Values) => {
    setServerError(null);
    onMood?.("think");
    try {
      const res = await submit({
        email: data.email,
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
      <div className="animate-rise rounded-[1.75rem] border border-border p-5 text-left sm:p-6" role="status">
        <div className="flex items-center gap-2.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-fern text-white">
            <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
          </span>
          <p className="text-[13px] font-medium text-fern">Your place is saved</p>
        </div>
        <h2 className="mt-3 text-[22px] font-medium leading-tight tracking-[-0.02em] text-foreground">
          {referral.position
            ? <>You&rsquo;re N&deg;&nbsp;{referral.position} on the list.</>
            : "You’re on the list."}
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          A confirmation is on its way to your inbox. Your invite follows the
          moment MyPA is ready.
        </p>

        {link && (
          <div className="mt-5">
            <p className="text-[13px] text-foreground">Bring someone along</p>
            <div className="mt-2 flex h-14 items-center gap-2 rounded-full border border-input pl-4 pr-1.5">
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
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-colors duration-200 hover:bg-foreground/85"
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
      <div
        className={cn(
          "flex h-14 items-center rounded-[8px] border bg-background pl-5 pr-1.5",
          "transition-[border-color,box-shadow] duration-200 ease-out",
          "focus-within:border-foreground/60 focus-within:ring-4 focus-within:ring-secondary",
          errors.email ? "border-destructive/60" : "border-input hover:border-foreground/30",
        )}
      >
        <label htmlFor="email" className="sr-only">Email address</label>
        <input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="Your email"
          className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
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
            "group inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-[8px] bg-foreground px-5 text-sm font-medium text-background",
            "transition-[background-color,transform] duration-200 ease-out hover:bg-foreground/85 active:scale-[0.97]",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:cursor-progress",
          )}
        >
          <span>{submitting ? "Joining" : <>Join<span className="max-[359px]:hidden"> the waitlist</span></>}</span>
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
