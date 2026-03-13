import type { Metadata } from "next";
import {
  Manrope,
  IBM_Plex_Mono,
  Noto_Naskh_Arabic,
  Amiri,
} from "next/font/google";
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

const amiri = Amiri({
  weight: ["400", "700"],
  subsets: ["arabic"],
  variable: "--font-amiri",
});

export const metadata: Metadata = {
  title: "Ayah Studio — Quran Video Editor",
  description:
    "Create beautiful Quran video subtitles with synchronized Arabic text and translations. Browse surahs, select ayahs, customize styles, and export subtitle files.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${manrope.variable} ${ibmPlexMono.variable} ${notoNaskhArabic.variable} ${amiri.variable} min-h-screen antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
