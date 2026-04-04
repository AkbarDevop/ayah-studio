import type { Translation, SubtitleStyle, ReciterEdition } from "@/types";

export const QURAN_API = "https://api.alquran.cloud/v1";

export const TRANSLATIONS: Translation[] = [
  // Arabic only
  { code: "none", label: "Arabic Only (No Translation)" },

  // English
  { code: "en.asad", label: "English — Muhammad Asad" },
  { code: "en.sahih", label: "English — Sahih Int'l" },
  { code: "en.pickthall", label: "English — Pickthall" },

  // Central Asian (Uzbek, Tajik, Azerbaijani)
  { code: "uz.sodik", label: "Uzbek — Muhammad Sodik" },
  { code: "tg.ayati", label: "Tajik — Ayati" },
  { code: "az.mammadaliyev", label: "Azerbaijani — Mammadaliyev" },

  // South Asian (Urdu, Hindi, Bengali)
  { code: "ur.jalandhry", label: "Urdu — Jalandhry" },
  { code: "ur.ahmedali", label: "Urdu — Ahmed Ali" },
  { code: "ur.maududi", label: "Urdu — Maududi" },
  { code: "hi.hindi", label: "Hindi — Suhel Farooq Khan" },
  { code: "bn.bengali", label: "Bengali — Muhiuddin Khan" },

  // Southeast Asian (Indonesian, Malay, Thai)
  { code: "id.indonesian", label: "Indonesian" },
  { code: "ms.basmeih", label: "Malay — Basmeih" },
  { code: "th.thai", label: "Thai" },

  // Middle Eastern (Turkish, Persian)
  { code: "tr.diyanet", label: "Turkish — Diyanet" },
  { code: "fa.fooladvand", label: "Persian — Fooladvand" },
  { code: "fa.makarem", label: "Persian — Makarem" },

  // Russian
  { code: "ru.kuliev", label: "Russian — Kuliev" },
  { code: "ru.osmanov", label: "Russian — Osmanov" },

  // African (Somali, Swahili, Hausa)
  { code: "so.abduh", label: "Somali — Mahmud Abduh" },
  { code: "sw.barwani", label: "Swahili — Al-Barwani" },
  { code: "ha.gumi", label: "Hausa — Abubakar Gumi" },

  // European (French, German, Spanish, Portuguese, Italian, Dutch, Swedish, Norwegian, Polish, Bosnian, Albanian)
  { code: "fr.hamidullah", label: "French — Hamidullah" },
  { code: "de.bubenheim", label: "German — Bubenheim" },
  { code: "es.cortes", label: "Spanish — Cortes" },
  { code: "pt.elhayek", label: "Portuguese — El-Hayek" },
  { code: "it.piccardo", label: "Italian — Piccardo" },
  { code: "nl.keyzer", label: "Dutch — Keyzer" },
  { code: "sv.bernstrom", label: "Swedish — Bernström" },
  { code: "no.berg", label: "Norwegian — Berg" },
  { code: "pl.bielawskiego", label: "Polish — Bielawski" },
  { code: "bs.korkut", label: "Bosnian — Korkut" },
  { code: "sq.ahmeti", label: "Albanian — Ahmeti" },

  // East Asian (Chinese, Korean, Japanese)
  { code: "zh.jian", label: "Chinese — Ma Jian" },
  { code: "ko.korean", label: "Korean" },
  { code: "ja.japanese", label: "Japanese" },
];

export const TRANSLATION_GROUP_MAP: Record<string, string> = {
  none: "Settings",
  en: "English",
  uz: "Central Asian",
  tg: "Central Asian",
  az: "Central Asian",
  ur: "South Asian",
  hi: "South Asian",
  bn: "South Asian",
  id: "Southeast Asian",
  ms: "Southeast Asian",
  th: "Southeast Asian",
  tr: "Middle Eastern",
  fa: "Middle Eastern",
  ru: "Russian & Eastern European",
  bs: "Russian & Eastern European",
  sq: "Russian & Eastern European",
  pl: "Russian & Eastern European",
  fr: "European",
  de: "European",
  es: "European",
  pt: "European",
  it: "European",
  nl: "European",
  sv: "European",
  no: "European",
  so: "African",
  sw: "African",
  ha: "African",
  zh: "East Asian",
  ko: "East Asian",
  ja: "East Asian",
};

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
  {
    id: "clean",
    label: "No Background",
    arabicColor: "#FFFFFF",
    transColor: "#CCCCCC",
    bg: "transparent",
    font: "Amiri",
  },
  {
    id: "shadow",
    label: "Shadow Text",
    arabicColor: "#FFFFFF",
    transColor: "#E0E0E0",
    bg: "transparent",
    font: "Noto Naskh Arabic",
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
  { id: "alafasy", name: "Mishary Rashid Alafasy", identifier: "ar.alafasy", quranComId: 7 },
  { id: "abdulsamad", name: "Abdulbasit Abdulsamad", identifier: "ar.abdulsamad", quranComId: 2 },
  { id: "sudais", name: "Abdul Rahman Al-Sudais", identifier: "ar.abdurrahmaansudais", quranComId: 3 },
  { id: "minshawi", name: "Mohamed Siddiq El-Minshawi", identifier: "ar.minshawi", quranComId: 9 },
  { id: "husary", name: "Mahmoud Khalil Al-Husary", identifier: "ar.husary", quranComId: 6 },
  { id: "shatri", name: "Abu Bakr al-Shatri", identifier: "ar.abudawud", quranComId: 4 },
  { id: "rifai", name: "Hani Ar-Rifai", identifier: "ar.hanirifai", quranComId: 5 },
];
