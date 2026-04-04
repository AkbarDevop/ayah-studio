import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Editor | Ayah Studio",
  description:
    "Create beautiful Quran recitation videos with styled Arabic subtitles and translations.",
};

export default function EditorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
