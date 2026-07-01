import type { Metadata } from "next";
import { Inter, Lora, IBM_Plex_Mono, Poppins } from "next/font/google";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const lora = Lora({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

const poppins = Poppins({
  weight: ["300", "400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MyPA — Your voice-first AI personal assistant",
  description:
    "MyPA plans, schedules, and gets things done — just say \"Hey MyPA\". Join the early-access waitlist.",
  icons: { icon: "/favicon/favicon.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ConvexAuthNextjsServerProvider>
      <html lang="en" className="scroll-smooth" suppressHydrationWarning>
        <body
          className={`${inter.variable} ${lora.variable} ${ibmPlexMono.variable} ${poppins.variable} font-sans antialiased`}
        >
          <Providers>{children}</Providers>
        </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}
