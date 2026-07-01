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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const schema = z.object({
  name: z.string().min(2, { message: "Please enter your name" }),
  email: z.string().email({ message: "Please enter a valid email address" }),
  phone: z.string().optional(),
  agreed: z.boolean().refine((v) => v, {
    message: "Please accept to continue",
  }),
});
type Values = z.infer<typeof schema>;

export function WaitlistForm() {
  const submit = useMutation(api.waitlist.submit);
  const [done, setDone] = useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", phone: "", agreed: false },
  });

  const onSubmit = async (data: Values) => {
    try {
      const res = await submit({
        name: data.name,
        email: data.email,
        phone: data.phone || undefined,
        source: "landing",
      });
      if (res.duplicate) {
        toast.info("You're already on the list — we'll be in touch.");
      } else {
        toast.success("You're on the waitlist!");
      }
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
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-fern/15 text-fern">
            <Check className="h-6 w-6" />
          </div>
          <h3 className="font-serif text-2xl font-light text-foreground">
            You&rsquo;re on the list.
          </h3>
          <p className="max-w-xs text-sm text-muted-foreground">
            Check your inbox for a confirmation. We&rsquo;ll email your invite
            the moment MyPA is ready.
          </p>
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
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" placeholder="Ada Lovelace" {...form.register("name")} />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              {...form.register("email")}
            />
            {errors.email && (
              <p className="text-sm text-red-500">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">
              Phone <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+1 555 000 0000"
              {...form.register("phone")}
            />
          </div>

          <div className="flex items-start gap-2 pt-1">
            <Checkbox
              id="agreed"
              checked={form.watch("agreed")}
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
            <p className="text-sm text-red-500">{errors.agreed.message}</p>
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
