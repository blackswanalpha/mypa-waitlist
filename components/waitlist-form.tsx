"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { getAttribution } from "@/lib/attribution";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-fern/15 text-fern">
            <Check className="h-6 w-6" />
          </div>
          <h3 className="font-serif text-2xl font-light text-foreground">
            {referral.position
              ? `You're #${referral.position} on the list.`
              : "You’re on the list."}
          </h3>
          <p className="max-w-xs text-sm text-muted-foreground">
            Check your inbox for a confirmation. We&rsquo;ll email your invite
            the moment MyPA is ready.
          </p>

          {link && (
            <div className="mt-2 w-full space-y-3">
              <p className="text-sm font-medium text-foreground">
                Share your link — bring friends along:
              </p>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={link}
                  onFocus={(e) => e.currentTarget.select()}
                  className="font-mono text-xs"
                  aria-label="Your referral link"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={copyLink}
                  aria-label="Copy referral link"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button asChild variant="outline" size="sm">
                  <a
                    href={`https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedLink}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Share on X
                  </a>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <a
                    href={`https://wa.me/?text=${encodedText}%20${encodedLink}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    WhatsApp
                  </a>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <a
                    href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodedLink}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    LinkedIn
                  </a>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  const errors = form.formState.errors;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reserve your spot</CardTitle>
        <CardDescription>Name and email — that&rsquo;s all it takes.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="name">Full name</Label>
            <Input
              id="name"
              placeholder="Ada Lovelace"
              autoComplete="name"
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "name-error" : undefined}
              {...form.register("name")}
            />
            {errors.name && (
              <p id="name-error" role="alert" className="text-sm text-destructive">
                {errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "email-error" : undefined}
              {...form.register("email")}
            />
            {errors.email && (
              <p id="email-error" role="alert" className="text-sm text-destructive">
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">
              Phone <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+1 555 000 0000"
              aria-invalid={!!errors.phone}
              aria-describedby={errors.phone ? "phone-error" : undefined}
              {...form.register("phone")}
            />
            {errors.phone && (
              <p id="phone-error" role="alert" className="text-sm text-destructive">
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

          <div className="flex items-start gap-2 pt-1">
            <Checkbox
              id="agreed"
              checked={form.watch("agreed")}
              aria-invalid={!!errors.agreed}
              aria-describedby={errors.agreed ? "agreed-error" : undefined}
              onCheckedChange={(c) => form.setValue("agreed", c === true, { shouldValidate: true })}
            />
            <label
              htmlFor="agreed"
              className="text-sm leading-relaxed text-muted-foreground"
            >
              I agree to be contacted about MyPA early access.
            </label>
          </div>
          {errors.agreed && (
            <p id="agreed-error" role="alert" className="text-sm text-destructive">
              {errors.agreed.message}
            </p>
          )}

          {serverError && (
            <p role="alert" className="text-sm text-destructive">
              {serverError}
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
            Join the waitlist
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
