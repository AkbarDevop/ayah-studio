
import { describe, it, expect } from "vitest";
import { detectAyahRangesFromTranscript, normalizeArabicText } from "@/lib/ayah-detection";

const TEST_CASES = [
  {
    "name": "Surah Al-Ikhlas (112) - clean transcript",
    "transcript": "بسم الله الرحمن الرحيم قل هو الله احد الله الصمد لم يلد ولم يولد ولم يكن له كفوا احد",
    "expected": "Al-Ikhlaas"
  },
  {
    "name": "Surah Az-Zalzala (99) - the working test case from logs",
    "transcript": "بسم الله الرحمن الرحيم إذا زلزلت الأرض زلزالها وأخرجت الأرض أثقالها وقال الإنسان مالها يومئذ تحدث أخبارها بأن ربك أوحى لها يومئذ يصدر الناس أشكاة ليروا أعمالهم فمن يعمل مثقال ذرة خير يره ومن يعمل مثقال ذرة شر يره",
    "expected": "Az-Zalzala"
  },
  {
    "name": "Surah Al-Fatiha (1) - clean",
    "transcript": "بسم الله الرحمن الرحيم الحمد لله رب العالمين الرحمن الرحيم مالك يوم الدين إياك نعبد وإياك نستعين اهدنا الصراط المستقيم صراط الذين أنعمت عليهم غير المغضوب عليهم ولا الضالين",
    "expected": "Al-Faatiha"
  },
  {
    "name": "Surah Al-Qiyama (75:1-10) - the failing test from earlier sessions",
    "transcript": "لا أقسم بيوم القيامة ولا أقسم بالنفس اللوامة أيحسب الإنسان ألن نجمع عظامه بلى قادرين على أن نسوي بنانه بل يريد الإنسان ليفجر أمامه يسأل أيان يوم القيامة فإذا برق البصر وخسف القمر وجمع الشمس والقمر",
    "expected": "Al-Qiyaama"
  },
  {
    "name": "Surah An-Nasr (110) - very short",
    "transcript": "إذا جاء نصر الله والفتح ورأيت الناس يدخلون في دين الله أفواجا فسبح بحمد ربك واستغفره إنه كان توابا",
    "expected": "An-Nasr"
  },
  {
    "name": "Surah Al-Fatiha (1) - with Ameen at end",
    "transcript": "بسم الله الرحمن الرحيم الحمد لله رب العالمين الرحمن الرحيم مالك يوم الدين إياك نعبد وإياك نستعين اهدنا الصراط المستقيم صراط الذين أنعمت عليهم غير المغضوب عليهم ولا الضالين آمين",
    "expected": "Al-Faatiha"
  },
  {
    "name": "Surah Al-Fatiha (1) - with Istiadha + Ameen",
    "transcript": "أعوذ بالله من الشيطان الرجيم بسم الله الرحمن الرحيم الحمد لله رب العالمين الرحمن الرحيم مالك يوم الدين إياك نعبد وإياك نستعين اهدنا الصراط المستقيم صراط الذين أنعمت عليهم غير المغضوب عليهم ولا الضالين آمين",
    "expected": "Al-Faatiha"
  },
  {
    "name": "Surah Al-Fatiha (1) - garbled Whisper transcript",
    "transcript": "بسم الله الرحمن الرحيم الحمد لله رب العالمين الرحمن الرحيم ماللك يوم الدين اياك نعبد واياك نستعين اهدنا صراط المستقيم صراط الذين انعمت عليهم غير المغضوب عليهم ولا الضالين",
    "expected": "Al-Faatiha"
  },
];

const MULTI_SURAH_CASES = [
  {
    "name": "Surah Al-Fatiha (1) - followed by Al-Ikhlas",
    "transcript": "بسم الله الرحمن الرحيم الحمد لله رب العالمين الرحمن الرحيم مالك يوم الدين إياك نعبد وإياك نستعين اهدنا الصراط المستقيم صراط الذين أنعمت عليهم غير المغضوب عليهم ولا الضالين آمين بسم الله الرحمن الرحيم قل هو الله أحد الله الصمد لم يلد ولم يولد ولم يكن له كفوا أحد",
    "expectedAll": ["Al-Faatiha", "Al-Ikhlaas"]
  },
];

describe("detectAyahRangesFromTranscript - end-to-end", () => {
  for (const tc of TEST_CASES) {
    it(`matches ${tc.name}`, async () => {
      const results = await detectAyahRangesFromTranscript(tc.transcript, 3);
      console.log(`\n  [TEST] ${tc.name}`);
      console.log(`  Transcript (first 80 chars): ${tc.transcript.slice(0, 80)}...`);
      console.log(`  Normalized word count: ${normalizeArabicText(tc.transcript).split(" ").length}`);
      console.log(`  Results: ${results.length}`);
      for (const r of results) {
        console.log(`    - ${r.surahName} ${r.startAyah}-${r.endAyah} (${(r.score * 100).toFixed(1)}%)`);
      }

      // Check that the expected surah appears in top results
      const found = results.find(r => r.surahName === tc.expected);
      expect(found, `Expected ${tc.expected} in results: ${results.map(r => r.surahName).join(", ")}`).toBeTruthy();

      // It should be the top result
      expect(results[0]?.surahName).toBe(tc.expected);
    }, 30000);
  }
});

describe("detectAyahRangesFromTranscript - multi-surah", () => {
  for (const tc of MULTI_SURAH_CASES) {
    it(`detects all surahs in ${tc.name}`, async () => {
      const results = await detectAyahRangesFromTranscript(tc.transcript, 5);
      console.log(`\n  [TEST] ${tc.name}`);
      console.log(`  Results: ${results.length}`);
      for (const r of results) {
        console.log(`    - ${r.surahName} ${r.startAyah}-${r.endAyah} (${(r.score * 100).toFixed(1)}%)`);
      }

      // Both surahs should be found in results
      for (const expected of tc.expectedAll) {
        const found = results.find(r => r.surahName === expected);
        expect(found, `Expected ${expected} in results: ${results.map(r => r.surahName).join(", ")}`).toBeTruthy();
      }
    }, 30000);
  }
});
