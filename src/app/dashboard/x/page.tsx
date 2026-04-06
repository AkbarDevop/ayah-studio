import type { Metadata } from "next";
import { XStudioClient } from "@/components/x/x-studio-client";

export const metadata: Metadata = {
  title: "X Studio | Ayah Studio",
  description:
    "Generate researched X posting plans, threads, and scheduler handoffs from a single topic.",
};

export default function XStudioPage() {
  return <XStudioClient />;
}
