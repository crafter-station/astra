import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

const title = "Astra";
const description =
  "A WebGPU star field built with vgpu: a compute pass flows thousands of stars along procedural spiral strokes, into an HDR bloom, lens-flare and dirty-glass chain.";

export const metadata: Metadata = {
  metadataBase: new URL("https://astra.crafter.run"),
  title,
  description,
  applicationName: title,
  openGraph: {
    type: "website",
    url: "/",
    siteName: title,
    title,
    description,
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export const viewport: Viewport = {
  themeColor: "#05090d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
