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
  name: z.string().optional(),
  email: z
    .string()
    .email({ message: "Please enter a valid email address" })
    .optional()
    .or(z.literal("")),
  rating: z.number().min(1).max(5).optional(),
  message: z.string().min(5, { message: "Please share a little more detail" }),
});
type Values = z.infer<typeof schema>;

export function FeedbackForm() {
  const submit = useMutation(api.feedback.submit);
  const [done, setDone] = useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", rating: undefined, message: "" },
  });

  const rating = form.watch("rating");

  const onSubmit = async (data: Values) => {
    try {
      await submit({
        name: data.name || undefined,
        email: data.email || undefined,
        rating: data.rating,
        message: data.message,
      });
      toast.success("Thanks for the feedback!");
      setDone(true);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Something went wrong. Please try again.",
      );
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
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>How are we doing? <span className="text-muted-foreground">(optional)</span></Label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
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
                        : "text-muted-foreground/40",
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
              <Input id="fb-name" placeholder="Ada" {...form.register("name")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fb-email">
                Email <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="fb-email"
                type="email"
                placeholder="you@example.com"
                {...form.register("email")}
              />
              {errors.email && (
                <p className="text-sm text-red-500">{errors.email.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fb-message">Your feedback</Label>
            <Textarea
              id="fb-message"
              rows={4}
              placeholder="What would make MyPA a no-brainer for you?"
              {...form.register("message")}
            />
            {errors.message && (
              <p className="text-sm text-red-500">{errors.message.message}</p>
            )}
          </div>

          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
            Send feedback
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
