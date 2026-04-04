import type { Metadata, Viewport } from "next";
import {
  Manrope,
  IBM_Plex_Mono,
  Noto_Naskh_Arabic,
  Noto_Nastaliq_Urdu,
  Amiri,
} from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import "./globals.css";

const manrope = Manrope({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-ui",
});

const ibmPlexMono = IBM_Plex_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-ibm-plex",
});

const notoNaskhArabic = Noto_Naskh_Arabic({
  weight: ["400", "500", "600", "700"],
  subsets: ["arabic"],
  variable: "--font-arabic",
});

const notoNastaliq = Noto_Nastaliq_Urdu({
  subsets: ["arabic"],
  variable: "--font-nastaliq",
  display: "swap",
});

const amiri = Amiri({
  weight: ["400", "700"],
  subsets: ["arabic"],
  variable: "--font-amiri",
});

export const metadata: Metadata = {
  title: "Ayah Studio — Quran Video Subtitle Editor",
  description:
    "Create beautiful Quran recitation videos with AI-detected ayah subtitles. Upload your recitation, auto-detect the surah, style Arabic subtitles, and export as SRT or ASS.",
  keywords: [
    "Quran",
    "subtitles",
    "ayah",
    "Arabic",
    "recitation",
    "video editor",
    "SRT",
    "ASS",
    "Islamic",
    "Quran video",
  ],
  openGraph: {
    title: "Ayah Studio — Quran Video Subtitle Editor",
    description:
      "Create beautiful Quran recitation videos with AI-detected ayah subtitles. Upload your recitation, auto-detect the surah, style Arabic subtitles, and export as SRT or ASS.",
    type: "website",
    siteName: "Ayah Studio",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ayah Studio — Quran Video Subtitle Editor",
    description:
      "Create beautiful Quran recitation videos with AI-detected ayah subtitles. Upload your recitation, auto-detect the surah, style Arabic subtitles, and export as SRT or ASS.",
  },
  metadataBase: new URL("https://ayahstudio.com"),
};

export const viewport: Viewport = {
  themeColor: "#0C0F14",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${manrope.variable} ${ibmPlexMono.variable} ${notoNaskhArabic.variable} ${notoNastaliq.variable} ${amiri.variable} min-h-screen antialiased`}
      >
        <ClerkProvider appearance={{ baseTheme: dark }}>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
