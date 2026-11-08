import type { Metadata } from "next";
import { Inter, Lato, Poppins, Source_Sans_3 } from "next/font/google";
import { Suspense } from "react";
import { SIDEBAR_PREPAINT_SCRIPT } from "@/lib/sidebar-width";
import "./globals.css";

// Self-hosted by Next at build time; exposed as a CSS variable for the theme.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// The other brand fonts only download when a school picks them (preload: false).
const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-poppins", display: "swap", preload: false });
const lato = Lato({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-lato", display: "swap", preload: false });
const sourceSans = Source_Sans_3({ subsets: ["latin"], variable: "--font-source-sans-3", display: "swap", preload: false });

export const metadata: Metadata = {
  title: "ACURIS - Advance Campus Unified Records & Information System",
  description: "School Management Platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${poppins.variable} ${lato.variable} ${sourceSans.variable}`} suppressHydrationWarning>
      <head>
        {/* Sets --sidebar-w before first paint so the loading shell matches the saved sidebar. */}
        <script dangerouslySetInnerHTML={{ __html: SIDEBAR_PREPAINT_SCRIPT }} />
      </head>
      <body>
        {/* Route params and per-request data are read below this boundary. */}
        <Suspense fallback={null}>{children}</Suspense>
      </body>
    </html>
  );
}