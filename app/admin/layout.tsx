import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";

// The admin page itself is a client component, so the noindex directive lives
// on this route layout — the login screen has no business in search results.
export const metadata: Metadata = {
  title: "Admin — MyPA",
  robots: { index: false, follow: false },
};

// The console's heading and figure face, loaded here so the landing page
// never downloads it. DM Sans (the root layout's --font-display) is the body.
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

// `.admin-root` switches on the console's tokens and type (see globals.css).
export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className={`admin-root ${jakarta.variable} min-h-screen bg-background text-foreground antialiased`}>{children}</div>
  );
}
