import type { Translation, SubtitleStyle, ReciterEdition } from "@/types";

export const QURAN_API = "https://api.alquran.cloud/v1";

export const TRANSLATIONS: Translation[] = [
  { code: "en.asad", label: "English — Muhammad Asad" },
  { code: "en.sahih", label: "English — Sahih Int'l" },
  { code: "en.pickthall", label: "English — Pickthall" },
  { code: "fr.hamidullah", label: "French — Hamidullah" },
  { code: "tr.diyanet", label: "Turkish — Diyanet" },
  { code: "ur.jalandhry", label: "Urdu — Jalandhry" },
  { code: "id.indonesian", label: "Indonesian" },
  { code: "ru.kuliev", label: "Russian — Kuliev" },
  { code: "de.bubenheim", label: "German — Bubenheim" },
  { code: "es.cortes", label: "Spanish — Cortes" },
];

export const SUBTITLE_STYLES: SubtitleStyle[] = [
  {
    id: "classic",
    label: "Classic Gold",
    arabicColor: "#D4A853",
    transColor: "#E8E4DC",
    bg: "rgba(0,0,0,0.7)",
    font: "Amiri",
  },
  {
    id: "modern",
    label: "Modern White",
    arabicColor: "#FFFFFF",
    transColor: "#B0B0B0",
    bg: "rgba(0,0,0,0.6)",
    font: "Noto Naskh Arabic",
  },
  {
    id: "emerald",
    label: "Emerald Glow",
    arabicColor: "#3DAE8A",
    transColor: "#E8E4DC",
    bg: "rgba(10,20,18,0.8)",
    font: "Amiri",
  },
  {
    id: "minimal",
    label: "Minimal",
    arabicColor: "#FFFFFF",
    transColor: "#999999",
    bg: "transparent",
    font: "Noto Naskh Arabic",
  },
  {
    id: "cinematic",
    label: "Cinematic",
    arabicColor: "#F5E6C8",
    transColor: "#C0B8A8",
    bg: "rgba(0,0,0,0.85)",
    font: "Amiri",
  },
];

export const RECITERS = [
  "Mishary Rashid Alafasy",
  "Abdul Rahman Al-Sudais",
  "Saud Al-Shuraim",
  "Maher Al-Muaiqly",
  "Abu Bakr al-Shatri",
  "Hani Ar-Rifai",
  "Yasser Al-Dosari",
  "Abdulbasit Abdulsamad",
  "Saad Al-Ghamdi",
  "Ahmed Al-Ajmi",
];

export const RECITER_EDITIONS: ReciterEdition[] = [
  { id: "alafasy", name: "Mishary Rashid Alafasy", identifier: "ar.alafasy" },
  { id: "abdulsamad", name: "Abdulbasit Abdulsamad", identifier: "ar.abdulsamad" },
  { id: "sudais", name: "Abdul Rahman Al-Sudais", identifier: "ar.abdurrahmaansudais" },
  { id: "minshawi", name: "Mohamed Siddiq El-Minshawi", identifier: "ar.minshawi" },
  { id: "husary", name: "Mahmoud Khalil Al-Husary", identifier: "ar.husary" },
  { id: "ajamy", name: "Ahmed Al-Ajmi", identifier: "ar.ahmedajamy" },
  { id: "mahermuaiqly", name: "Maher Al-Muaiqly", identifier: "ar.mahermuaiqly" },
];
