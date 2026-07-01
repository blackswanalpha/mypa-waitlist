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
  name: z.string().min(2, { message: "Please enter your name" }),
  email: z.string().email({ message: "Please enter a valid email address" }),
  subject: z.string().min(2, { message: "Please add a subject" }),
  message: z.string().min(5, { message: "Please add a message" }),
});
type Values = z.infer<typeof schema>;

export function ContactForm() {
  const submit = useMutation(api.contact.submit);
  const [done, setDone] = useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", subject: "", message: "" },
  });

  const onSubmit = async (data: Values) => {
    try {
      await submit(data);
      toast.success("Message sent — we'll be in touch.");
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
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="c-name">Name</Label>
              <Input id="c-name" placeholder="Ada Lovelace" {...form.register("name")} />
              {errors.name && (
                <p className="text-sm text-red-500">{errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-email">Email</Label>
              <Input
                id="c-email"
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
            <Label htmlFor="c-subject">Subject</Label>
            <Input
              id="c-subject"
              placeholder="How can we help?"
              {...form.register("subject")}
            />
            {errors.subject && (
              <p className="text-sm text-red-500">{errors.subject.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="c-message">Message</Label>
            <Textarea
              id="c-message"
              rows={5}
              placeholder="Tell us a bit more…"
              {...form.register("message")}
            />
            {errors.message && (
              <p className="text-sm text-red-500">{errors.message.message}</p>
            )}
          </div>

          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
            Send message
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
