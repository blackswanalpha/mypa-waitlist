import type { Metadata } from "next";

// The admin page itself is a client component, so the noindex directive lives
// on this route layout — the login screen has no business in search results.
export const metadata: Metadata = {
  title: "Admin — MyPA",
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
