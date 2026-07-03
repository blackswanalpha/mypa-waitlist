"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  subject: z
    .string()
    .min(2, { message: "Please add a subject" })
    .max(200, { message: "Please shorten the subject" }),
  message: z
    .string()
    .min(5, { message: "Please add a message" })
    .max(5000, { message: "Please keep the message under 5000 characters" }),
  website: z.string().optional(), // honeypot
});
type Values = z.infer<typeof schema>;

export function ContactForm() {
  const submit = useMutation(api.contact.submit);
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", subject: "", message: "", website: "" },
  });

  const onSubmit = async (data: Values) => {
    setServerError(null);
    try {
      await submit({
        name: data.name,
        email: data.email,
        subject: data.subject,
        message: data.message,
        website: data.website || undefined,
      });
      toast.success("Message sent — we'll be in touch.");
      setDone(true);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Something went wrong. Please try again.";
      setServerError(message);
      toast.error(message);
    }
  };

  if (done) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-fern/15 text-fern">
            <Check className="h-6 w-6" />
          </div>
          <h3 className="font-serif text-2xl font-light text-foreground">
            Message sent.
          </h3>
          <p className="max-w-xs text-sm text-muted-foreground">
            Thanks for reaching out. A human will reply within 1&ndash;2 business
            days.
          </p>
        </CardContent>
      </Card>
    );
  }

  const errors = form.formState.errors;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Get in touch</CardTitle>
        <CardDescription>
          Questions, partnerships, or press — send us a note.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="c-name">Name</Label>
              <Input
                id="c-name"
                placeholder="Ada Lovelace"
                autoComplete="name"
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? "c-name-error" : undefined}
                {...form.register("name")}
              />
              {errors.name && (
                <p id="c-name-error" role="alert" className="text-sm text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-email">Email</Label>
              <Input
                id="c-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "c-email-error" : undefined}
                {...form.register("email")}
              />
              {errors.email && (
                <p id="c-email-error" role="alert" className="text-sm text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="c-subject">Subject</Label>
            <Input
              id="c-subject"
              placeholder="How can we help?"
              aria-invalid={!!errors.subject}
              aria-describedby={errors.subject ? "c-subject-error" : undefined}
              {...form.register("subject")}
            />
            {errors.subject && (
              <p id="c-subject-error" role="alert" className="text-sm text-destructive">
                {errors.subject.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="c-message">Message</Label>
            <Textarea
              id="c-message"
              rows={5}
              placeholder="Tell us a bit more…"
              aria-invalid={!!errors.message}
              aria-describedby={errors.message ? "c-message-error" : undefined}
              {...form.register("message")}
            />
            {errors.message && (
              <p id="c-message-error" role="alert" className="text-sm text-destructive">
                {errors.message.message}
              </p>
            )}
          </div>

          {/* Honeypot: visually hidden and skipped by keyboard/screen readers. */}
          <div className="sr-only" aria-hidden="true">
            <label htmlFor="c-website">Leave this field empty</label>
            <input
              id="c-website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              {...form.register("website")}
            />
          </div>

          {serverError && (
            <p role="alert" className="text-sm text-destructive">
              {serverError}
            </p>
          )}

          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
            Send message
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
