import type { Metadata, Viewport } from "next";
import { Anek_Devanagari, Anek_Latin, Fraunces, Martian_Mono } from "next/font/google";
import Script from "next/script";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

// Anek (Ek Type, Mumbai) for display + body: signage-like semi-condensed headlines, Devanagari sister for Hindi.
// Fraunces only for the AirPool wordmark (brand sheet). Martian Mono strictly for data (times, fares, codes).
const anek = Anek_Latin({ variable: "--font-anek", subsets: ["latin"], axes: ["wdth"] });
const anekDeva = Anek_Devanagari({ variable: "--font-anek-deva", subsets: ["devanagari"], axes: ["wdth"] });
const serif = Fraunces({ variable: "--font-serif", subsets: ["latin"], weight: "700" });
const mono = Martian_Mono({ variable: "--font-plex-mono", subsets: ["latin"], axes: ["wdth"] });

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const DESCRIPTION = "Share your ride from Delhi Airport T3 to Gurugram with travellers heading the same way. One car, a fair share each. Join early access.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: "AirPool — Shared rides from Delhi Airport T3",
  description: DESCRIPTION,
  openGraph: { type: "website", siteName: "AirPool", title: "AirPool — Many travellers, one ride", description: DESCRIPTION, locale: "en_IN" },
  twitter: { card: "summary_large_image", title: "AirPool — Many travellers, one ride", description: DESCRIPTION },
};

export const viewport: Viewport = { themeColor: "#F4F1EA" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${anek.variable} ${anekDeva.variable} ${serif.variable} ${mono.variable}`}>
      <body className="min-h-screen overflow-x-clip">
        {children}
        {/* Privacy-friendly analytics (no cookies), only when configured */}
        {process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN && <Script defer data-domain={process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN} src="https://plausible.io/js/script.js" strategy="afterInteractive" />}
      </body>
    </html>
  );
}
