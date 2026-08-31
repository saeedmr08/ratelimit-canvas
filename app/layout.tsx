import type { CSSProperties, ReactNode } from "react";
import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Mono, Source_Sans_3 } from "next/font/google";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex",
  display: "swap",
});

const ui = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-source",
  display: "swap",
});

export const metadata: Metadata = {
  title: "RateLimit Canvas — Saeed Rumaneh",
  description:
    "Interactive Fixed Window, Sliding Window, and Token Bucket rate-limit simulation with SVG timeline and fairness notes.",
  authors: [{ name: "Saeed Rumaneh" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const bodyStyle = {
    ["--font-display"]: "var(--font-fraunces), Georgia, serif",
    ["--font-mono"]: "var(--font-plex), ui-monospace, monospace",
    ["--font-ui"]: "var(--font-source), system-ui, sans-serif",
  } as CSSProperties;

  return (
    <html lang="en" className={`${display.variable} ${mono.variable} ${ui.variable}`}>
      <body style={bodyStyle}>{children}</body>
    </html>
  );
}
