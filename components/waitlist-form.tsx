"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Check, ArrowRight, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { getAttribution } from "@/lib/attribution";

import { Checkbox } from "@/components/ui/checkbox";
import type { BotMood } from "@/components/glance-bot";
import { cn } from "@/lib/utils";

const PHONE_RE = /^\+?[\d\s().-]{7,}$/;

const schema = z.object({
  firstName: z.string().trim().min(1, { message: "Add your first name." }).max(100, { message: "That first name is too long." }),
  lastName: z.string().trim().min(1, { message: "Add your last name." }).max(100, { message: "That last name is too long." }),
  phone: z
    .string()
    .trim()
    .max(32, { message: "That phone number doesn’t look right." })
    .refine((v) => !v || (PHONE_RE.test(v) && v.replace(/\D/g, "").length >= 7 && v.replace(/\D/g, "").length <= 15), {
      message: "That phone number doesn’t look right.",
    })
    .optional(),
  email: z
    .string()
    .trim()
    .min(1, { message: "Add your email to join." })
    .email({ message: "That email doesn’t look right." })
    .max(254, { message: "That email is too long." }),
  device: z.enum(["samsung", "android", "iphone"], {
    errorMap: () => ({ message: "Pick your phone so we send the right install steps." }),
  }),
  agreed: z.boolean().refine((v) => v, {
    message: "Tick the box so we can email your invite.",
  }),
  // Honeypot — hidden from real users; bots that fill it get a silent no-op.
  website: z.string().optional(),
});
type Values = z.infer<typeof schema>;
type Device = Values["device"];

const DEVICES: { value: Device; label: string }[] = [
  { value: "samsung", label: "Samsung" },
  { value: "android", label: "Other Android" },
  { value: "iphone", label: "iPhone" },
];

type Result = { duplicate: boolean; position: number; slots: number; status: string };

/**
 * The tester-list form: which phone, then the email field with its button
 * beside it (stacked on phones), consent on the line beneath. Signups go to
 * /api/waitlist, which writes the tester row in Convex. `onMood` tells the bot
 * above what the form is doing, so it listens while you type and thinks while
 * it submits. `onClosed` fires when the server says signups have just closed.
 */
export function WaitlistForm({
  onMood,
  onClosed,
}: {
  onMood?: (mood: BotMood) => void;
  onClosed?: () => void;
}) {
  const [done, setDone] = useState<(Result & { email: string; device: Device; firstName: string }) | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  // After a rejected submit the bot holds its reaction until you type again;
  // the form refocusing the field must not read as "listening".
  const holding = useRef(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { firstName: "", lastName: "", phone: "", email: "", device: undefined, agreed: true, website: "" },
  });

  const onSubmit = async (data: Values) => {
    setServerError(null);
    onMood?.("think");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone || undefined,
          email: data.email,
          device: data.device,
          source: "landing",
          agreed: data.agreed,
          website: data.website || undefined,
          ...getAttribution(),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as Partial<Result> & {
        error?: string;
        code?: string;
      };
      if (res.status === 409 && body.code === "closed") {
        toast.info(body.error ?? "Tester signups just closed.");
        onClosed?.();
        return;
      }
      if (!res.ok) {
        throw new Error(body.error ?? "Something went wrong. Please try again.");
      }
      if (body.duplicate) {
        toast.info("You're already on the list.");
      } else {
        toast.success("You're on the list!");
      }
      setDone({
        duplicate: !!body.duplicate,
        position: body.position ?? 0,
        slots: body.slots ?? 0,
        status: body.status ?? "pending",
        email: data.email.trim().toLowerCase(),
        firstName: data.firstName.trim(),
        device: data.device,
      });
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

  if (done) return <Saved {...done} />;

  const errors = form.formState.errors;
  const submitting = form.formState.isSubmitting;
  const message =
    errors.device?.message ??
    errors.firstName?.message ??
    errors.lastName?.message ??
    errors.email?.message ??
    errors.phone?.message ??
    errors.agreed?.message ??
    serverError;
  // Every field makes the bot listen while you type, like the email bar always did.
  const listening = {
    onFocus: () => !holding.current && onMood?.("listen"),
    onInput: () => {
      holding.current = false;
      onMood?.("listen");
    },
  };
  const fieldClass = (bad: boolean) =>
    cn(
      "h-12 w-full min-w-0 rounded-[8px] border bg-background px-4 text-[15px] text-foreground outline-none placeholder:text-muted-foreground",
      "transition-[border-color,box-shadow] duration-200 ease-out focus:border-foreground/60 focus:ring-4 focus:ring-secondary",
      bad ? "border-destructive/60" : "border-input hover:border-foreground/30",
    );
  const device = form.watch("device");
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
      <fieldset className="mb-2">
        <legend className="mb-2 flex w-full items-center justify-center gap-1.5 text-[13px] text-muted-foreground">
          <Smartphone className="h-3.5 w-3.5" aria-hidden />
          Which phone will you test on?
        </legend>
        <div
          role="radiogroup"
          aria-label="Your phone"
          aria-invalid={!!errors.device}
          aria-describedby={errors.device ? "waitlist-message" : undefined}
          className="grid grid-cols-3 gap-2"
        >
          {DEVICES.map((d) => {
            const on = device === d.value;
            return (
              <button
                key={d.value}
                type="button"
                role="radio"
                aria-checked={on}
                data-device={d.value}
                onClick={() => {
                  form.setValue("device", d.value, { shouldValidate: form.formState.isSubmitted });
                  holding.current = false;
                  onMood?.("listen");
                }}
                className={cn(
                  "inline-flex h-12 items-center justify-center gap-1.5 rounded-[6px] border px-2 text-[13px] transition-[border-color,background-color,color] duration-150 ease-out",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground",
                  on
                    ? "border-black bg-black/[0.04] font-medium text-foreground"
                    : errors.device
                      ? "border-destructive/60 text-foreground hover:border-foreground/40"
                      : "border-input text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                )}
              >
                {on && <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />}
                {d.label}
              </button>
            );
          })}
        </div>
        {device === "iphone" && (
          <p className="mt-2 text-[12.5px] text-muted-foreground">
            The test build is Android-only for now. Join anyway and you keep your place for iOS.
          </p>
        )}
      </fieldset>

      {/* Names, then email beside the optional phone, then consent beside the button. */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="firstName" className="sr-only">First name</label>
          <input
            id="firstName"
            autoComplete="given-name"
            placeholder="First name"
            className={fieldClass(!!errors.firstName)}
            aria-invalid={!!errors.firstName}
            aria-describedby={errors.firstName ? "waitlist-message" : undefined}
            {...form.register("firstName")}
            {...listening}
          />
        </div>
        <div>
          <label htmlFor="lastName" className="sr-only">Last name</label>
          <input
            id="lastName"
            autoComplete="family-name"
            placeholder="Last name"
            className={fieldClass(!!errors.lastName)}
            aria-invalid={!!errors.lastName}
            aria-describedby={errors.lastName ? "waitlist-message" : undefined}
            {...form.register("lastName")}
            {...listening}
          />
        </div>
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div>
          <label htmlFor="email" className="sr-only">Email address</label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="Your email"
            className={fieldClass(!!errors.email)}
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
        </div>
        <div>
          <label htmlFor="phone" className="sr-only">Phone number (optional)</label>
          <input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="Phone (optional)"
            className={fieldClass(!!errors.phone)}
            aria-invalid={!!errors.phone}
            aria-describedby={errors.phone ? "waitlist-message" : undefined}
            {...form.register("phone")}
            {...listening}
          />
        </div>
      </div>

      {/* Honeypot: visually hidden and skipped by keyboard/screen readers. */}
      <div className="sr-only" aria-hidden="true">
        <label htmlFor="website">Leave this field empty</label>
        <input id="website" type="text" tabIndex={-1} autoComplete="off" {...form.register("website")} />
      </div>

      <div className="mt-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <label
          htmlFor="agreed"
          className="flex min-h-11 cursor-pointer items-center gap-2.5 text-left text-[13px] leading-snug text-foreground"
        >
          <Checkbox
            id="agreed"
            className="shrink-0 shadow-none data-[state=checked]:border-fern data-[state=checked]:bg-fern data-[state=checked]:text-white"
            checked={form.watch("agreed")}
            aria-invalid={!!errors.agreed}
            aria-describedby={errors.agreed ? "waitlist-message" : undefined}
            onCheckedChange={(c) => form.setValue("agreed", c === true, { shouldValidate: form.formState.isSubmitted })}
          />
          Email me my tester invite and launch updates.
        </label>
        <button
          type="submit"
          disabled={submitting}
          className={cn(
            "group inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-[8px] bg-black px-6 text-sm font-medium text-white",
            "transition-transform duration-200 ease-out active:scale-[0.97]",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black disabled:cursor-progress",
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

/** The card that replaces the form once the signup is saved. */
function Saved({
  duplicate,
  position,
  slots,
  status,
  email,
  device,
  firstName,
}: Result & { email: string; device: Device; firstName: string }) {
  const tester = position > 0 && position <= slots;
  let badge: string;
  let title: string;
  let body: string;
  if (duplicate && status === "approved") {
    badge = "Already approved";
    title = "You’re already a tester.";
    body = `Your invite and install guide went to ${email}. Check spam if you can’t find it.`;
  } else if (device === "iphone") {
    badge = position ? `Place #${position} saved` : "Your place is saved";
    title = "You’re on the list.";
    body = `The test build is Android-only for now. We’ll email ${email} when iOS is ready.`;
  } else if (tester) {
    badge = `Spot #${position} of ${slots}`;
    title = duplicate ? "You’re already on the tester list." : "You’re on the tester list.";
    body = `We approve testers by hand. Watch ${email} for your invite and a picture-by-picture install guide.`;
  } else {
    badge = position ? `Place #${position} saved` : "Your place is saved";
    title = "You’re on the waitlist.";
    body = `All ${slots || "the"} tester spots are claimed. We’ll email ${email} when the next round opens.`;
  }

  return (
    <div className="animate-rise rounded-[6px] border border-border p-5 text-left sm:p-6" role="status">
      <div className="flex items-center gap-2.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-fern text-white">
          <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
        </span>
        <p className="text-[13px] font-medium text-fern">{badge}</p>
      </div>
      <h2 className="mt-3 text-[22px] font-medium leading-tight tracking-[-0.02em] text-foreground">
        {firstName ? `${firstName}, ${title[0].toLowerCase()}${title.slice(1)}` : title}
      </h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}
