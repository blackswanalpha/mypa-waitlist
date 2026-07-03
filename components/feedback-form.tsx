"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Check, Star } from "lucide-react";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";

const schema = z.object({
  name: z.string().max(100, { message: "That name is too long" }).optional(),
  email: z
    .string()
    .email({ message: "Please enter a valid email address" })
    .max(254, { message: "That email is too long" })
    .optional()
    .or(z.literal("")),
  rating: z.number().min(1).max(5).optional(),
  message: z
    .string()
    .min(5, { message: "Please share a little more detail" })
    .max(5000, { message: "Please keep the message under 5000 characters" }),
  website: z.string().optional(), // honeypot
});
type Values = z.infer<typeof schema>;

export function FeedbackForm() {
  const submit = useMutation(api.feedback.submit);
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      email: "",
      rating: undefined,
      message: "",
      website: "",
    },
  });

  const rating = form.watch("rating");

  const onSubmit = async (data: Values) => {
    setServerError(null);
    try {
      await submit({
        name: data.name || undefined,
        email: data.email || undefined,
        rating: data.rating,
        message: data.message,
        website: data.website || undefined,
      });
      toast.success("Thanks for the feedback!");
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
            Thank you.
          </h3>
          <p className="max-w-xs text-sm text-muted-foreground">
            Your feedback went straight to the team.
          </p>
        </CardContent>
      </Card>
    );
  }

  const errors = form.formState.errors;

  return (
    <Card>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label id="fb-rating-label">
              How are we doing? <span className="text-muted-foreground">(optional)</span>
            </Label>
            <div
              role="radiogroup"
              aria-labelledby="fb-rating-label"
              className="flex items-center gap-1"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={rating === n}
                  aria-label={`${n} star${n > 1 ? "s" : ""}`}
                  onClick={() =>
                    form.setValue("rating", rating === n ? undefined : n)
                  }
                  className="rounded p-1 transition-transform hover:scale-110"
                >
                  <Star
                    className={cn(
                      "h-6 w-6",
                      rating && n <= rating
                        ? "fill-primary text-primary"
                        : "text-muted-foreground/70",
                    )}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fb-name">
                Name <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="fb-name"
                placeholder="Ada"
                autoComplete="name"
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? "fb-name-error" : undefined}
                {...form.register("name")}
              />
              {errors.name && (
                <p id="fb-name-error" role="alert" className="text-sm text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="fb-email">
                Email <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="fb-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "fb-email-error" : undefined}
                {...form.register("email")}
              />
              {errors.email && (
                <p id="fb-email-error" role="alert" className="text-sm text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fb-message">Your feedback</Label>
            <Textarea
              id="fb-message"
              rows={4}
              placeholder="What would make MyPA a no-brainer for you?"
              aria-invalid={!!errors.message}
              aria-describedby={errors.message ? "fb-message-error" : undefined}
              {...form.register("message")}
            />
            {errors.message && (
              <p id="fb-message-error" role="alert" className="text-sm text-destructive">
                {errors.message.message}
              </p>
            )}
          </div>

          {/* Honeypot: visually hidden and skipped by keyboard/screen readers. */}
          <div className="sr-only" aria-hidden="true">
            <label htmlFor="fb-website">Leave this field empty</label>
            <input
              id="fb-website"
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
            Send feedback
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
