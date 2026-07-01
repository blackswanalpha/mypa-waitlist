import type { Metadata } from "next";
import { Mail, MessageCircle } from "lucide-react";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { ContactForm } from "@/components/contact-form";
import { Reveal } from "@/components/reveal";

export const metadata: Metadata = {
  title: "Contact — MyPA",
  description: "Get in touch with the MyPA team.",
};

export default function ContactPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background selection:bg-fern/20">
      <Header />

      <main className="flex-1">
        <div className="container mx-auto grid items-start gap-10 px-6 py-16 lg:grid-cols-2 lg:gap-16 lg:px-12 lg:py-24">
          <Reveal>
            <p className="font-mono text-xs uppercase tracking-widest text-fern">
              Contact
            </p>
            <h1 className="mt-3 font-serif text-4xl font-light tracking-tight text-foreground md:text-5xl">
              Let&rsquo;s talk.
            </h1>
            <p className="mt-4 max-w-md text-muted-foreground">
              Whether it&rsquo;s a question about early access, a partnership, or
              press — we&rsquo;d love to hear from you.
            </p>

            <div className="mt-8 space-y-4">
              <div className="flex items-center gap-3 text-sm text-foreground/90">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Mail className="h-4 w-4" />
                </span>
                <a href="mailto:hello@mypa.app" className="hover:text-foreground">
                  hello@mypa.app
                </a>
              </div>
              <div className="flex items-center gap-3 text-sm text-foreground/90">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <MessageCircle className="h-4 w-4" />
                </span>
                We typically reply within 1&ndash;2 business days.
              </div>
            </div>
          </Reveal>

          <Reveal y={24}>
            <ContactForm />
          </Reveal>
        </div>
      </main>

      <Footer />
    </div>
  );
}
