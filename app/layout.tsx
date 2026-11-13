import type { Metadata } from "next";
import {
  Atkinson_Hyperlegible, Inter, Lato, Merriweather, Montserrat, Nunito_Sans, Open_Sans, Poppins, Roboto, Source_Sans_3,
} from "next/font/google";
import { Suspense } from "react";
import { SIDEBAR_PREPAINT_SCRIPT } from "@/lib/sidebar-width";
import { THEME_PREPAINT_SCRIPT } from "@/lib/theme/prepaint";
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
const roboto = Roboto({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-roboto", display: "swap", preload: false });
const openSans = Open_Sans({ subsets: ["latin"], variable: "--font-open-sans", display: "swap", preload: false });
const nunitoSans = Nunito_Sans({ subsets: ["latin"], variable: "--font-nunito-sans", display: "swap", preload: false });
const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-montserrat", display: "swap", preload: false });
const merriweather = Merriweather({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-merriweather", display: "swap", preload: false });
const atkinson = Atkinson_Hyperlegible({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-atkinson", display: "swap", preload: false });

// Every theme font's CSS variable, applied to <html> so any of them can be picked.
const FONT_VARIABLES = [inter, poppins, lato, sourceSans, roboto, openSans, nunitoSans, montserrat, merriweather, atkinson]
  .map((f) => f.variable)
  .join(" ");

export const metadata: Metadata = {
  title: "ACURIS - Advance Campus Unified Records & Information System",
  description: "School Management Platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={FONT_VARIABLES} suppressHydrationWarning>
      <head>
        {/* Sets --sidebar-w before first paint so the loading shell matches the saved sidebar. */}
        <script dangerouslySetInnerHTML={{ __html: SIDEBAR_PREPAINT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: THEME_PREPAINT_SCRIPT }} />
      </head>
      <body>
        {/* Route params and per-request data are read below this boundary. */}
        <Suspense fallback={null}>{children}</Suspense>
      </body>
    </html>
  );
}