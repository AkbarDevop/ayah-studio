import Link from "next/link";
import { SignInButton, SignUpButton, UserButton, Show } from "@clerk/nextjs";
import {
  Upload,
  Sparkles,
  Download,
  Mic,
  Languages,
  Palette,
  Image,
  ArrowRight,
  ChevronRight,
  Play,
  Github,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] font-[family-name:var(--font-ui)]">
      {/* ── Nav ─────────────────────────────────────────────────── */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-[var(--border)]/40 bg-[var(--bg)]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="text-[var(--gold)] text-lg font-bold tracking-tight">
              Ayah Studio
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Show
              when="signed-in"
              fallback={
                <>
                  <SignInButton mode="modal">
                    <button className="text-sm font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text)] cursor-pointer">
                      Sign in
                    </button>
                  </SignInButton>
                  <SignUpButton mode="modal">
                    <button className="rounded-lg bg-[var(--gold)]/12 px-4 py-2 text-sm font-semibold text-[var(--gold)] transition-colors hover:bg-[var(--gold)]/20 cursor-pointer">
                      Get Started
                    </button>
                  </SignUpButton>
                </>
              }
            >
              <Link
                href="/dashboard"
                className="text-sm font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
              >
                Dashboard
              </Link>
              <UserButton />
            </Show>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-28 px-5">
        <div className="mx-auto max-w-4xl text-center">
          <p className="font-mono-ui text-[0.68rem] font-semibold tracking-[0.18em] uppercase text-[var(--text-dim)] mb-5">
            Quran Subtitle Editor
          </p>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-tight tracking-tight">
            Beautiful Quran Subtitles
            <br />
            <span className="text-[var(--gold)]">in Minutes</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base sm:text-lg text-[var(--text-muted)] leading-relaxed">
            Upload a recitation, auto-detect the ayahs, style Arabic subtitles
            with translations, and export. Built for Quran content creators.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/editor"
              className="inline-flex items-center gap-2.5 rounded-xl bg-[var(--gold)] px-7 py-3.5 text-sm font-semibold text-[var(--bg)] transition-all hover:brightness-110 hover:shadow-[0_0_24px_rgba(212,168,83,0.25)]"
            >
              Start Creating
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/dashboard/x"
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--gold)]/35 bg-[var(--gold)]/8 px-7 py-3.5 text-sm font-medium text-[var(--gold-light)] transition-colors hover:bg-[var(--gold)]/14"
            >
              Try X Studio
              <Sparkles className="h-4 w-4" />
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] px-7 py-3.5 text-sm font-medium text-[var(--text-muted)] transition-colors hover:border-[var(--border-light)] hover:text-[var(--text)]"
            >
              See How It Works
              <ChevronRight className="h-4 w-4" />
            </a>
          </div>
        </div>

        {/* ── Hero mockup ─────────────────────────────────────── */}
        <div className="mx-auto mt-16 max-w-3xl">
          <div className="preview-stage-frame aspect-video relative overflow-hidden">
            {/* Dark video-like background */}
            <div className="absolute inset-0 preview-canvas-bg" />
            {/* Subtle gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

            {/* Play button hint */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/5 border border-white/10 backdrop-blur-sm">
                <Play className="h-6 w-6 text-white/40 ml-1" />
              </div>
            </div>

            {/* Subtitle overlay */}
            <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 pb-8 sm:pb-12">
              <div className="rounded-lg bg-black/65 backdrop-blur-sm px-5 py-3 sm:px-8 sm:py-4">
                <p
                  className="font-amiri-ui text-xl sm:text-2xl md:text-3xl text-[var(--gold)] text-center leading-loose"
                  dir="rtl"
                >
                  بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
                </p>
                <p className="text-xs sm:text-sm text-[var(--text)]/80 text-center mt-1">
                  In the name of God, the Most Gracious, the Most Merciful
                </p>
              </div>
            </div>

            {/* Surah label */}
            <div className="absolute top-4 left-4 sm:top-6 sm:left-6 metric-pill">
              Al-Fatihah 1:1
            </div>
          </div>
        </div>

        {/* Background glow */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-[var(--gold)]/[0.04] blur-[120px]" />
        </div>
      </section>

      {/* ── Trust bar ───────────────────────────────────────────── */}
      <section className="border-y border-[var(--border)]/40 py-8 px-5">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {[
            "43 Languages",
            "114 Surahs",
            "7 Subtitle Styles",
            "Free to Use",
          ].map((stat) => (
            <span
              key={stat}
              className="font-mono-ui text-[0.72rem] font-medium tracking-[0.14em] uppercase text-[var(--text-dim)]"
            >
              {stat}
            </span>
          ))}
        </div>
      </section>

      {/* ── How It Works ────────────────────────────────────────── */}
      <section id="how-it-works" className="scroll-mt-20 py-20 sm:py-28 px-5">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-14">
            <p className="font-mono-ui text-[0.68rem] font-semibold tracking-[0.18em] uppercase text-[var(--gold-dim)] mb-3">
              Workflow
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              How It Works
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              {
                icon: Upload,
                step: "01",
                title: "Upload",
                desc: "Drop a video or paste a YouTube link",
              },
              {
                icon: Sparkles,
                step: "02",
                title: "Detect",
                desc: "AI identifies the surah and ayah range in seconds",
              },
              {
                icon: Download,
                step: "03",
                title: "Export",
                desc: "Style your subtitles and download SRT, ASS, or rendered video",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="studio-panel-soft p-6 sm:p-8 flex flex-col items-center text-center"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--gold)]/10 mb-5">
                  <item.icon className="h-5 w-5 text-[var(--gold)]" />
                </div>
                <span className="font-mono-ui text-[0.62rem] font-semibold tracking-[0.2em] uppercase text-[var(--text-dim)] mb-2">
                  Step {item.step}
                </span>
                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features Grid ───────────────────────────────────────── */}
      <section className="py-20 sm:py-28 px-5 border-t border-[var(--border)]/40">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-14">
            <p className="font-mono-ui text-[0.68rem] font-semibold tracking-[0.18em] uppercase text-[var(--gold-dim)] mb-3">
              Features
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Everything You Need
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {[
              {
                icon: Mic,
                title: "AI Ayah Detection",
                desc: "Whisper-powered transcription matches your recitation to the exact surah and ayah range",
              },
              {
                icon: Languages,
                title: "43 Translations",
                desc: "Arabic text with translations in Uzbek, Russian, Urdu, Persian, Turkish, and 38 more languages",
              },
              {
                icon: Palette,
                title: "Tajweed Colors",
                desc: "Optional tajweed color coding highlights pronunciation rules in the Arabic text",
              },
              {
                icon: Image,
                title: "Share as Image",
                desc: "Generate beautiful ayah card images for Instagram, Stories, and Twitter",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="studio-panel p-6 sm:p-7 group"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--emerald)]/10 mb-4 transition-colors group-hover:bg-[var(--emerald)]/16">
                  <feature.icon className="h-5 w-5 text-[var(--emerald-light)]" />
                </div>
                <h3 className="text-base font-semibold mb-1.5">
                  {feature.title}
                </h3>
                <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Feature Showcase ────────────────────────────────────── */}
      <section className="py-20 sm:py-28 px-5 border-t border-[var(--border)]/40">
        <div className="mx-auto max-w-3xl text-center">
          <p className="font-mono-ui text-[0.68rem] font-semibold tracking-[0.18em] uppercase text-[var(--gold-dim)] mb-3">
            Subtitle Styling
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-12">
            Make It Yours
          </h2>

          <div className="studio-panel overflow-hidden">
            {/* Showcase card */}
            <div className="relative aspect-video flex flex-col items-center justify-center preview-canvas-bg p-8">
              {/* Arabic text */}
              <p
                className="font-amiri-ui text-2xl sm:text-3xl md:text-4xl text-[var(--gold)] leading-loose"
                dir="rtl"
              >
                بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
              </p>
              <p className="text-sm sm:text-base text-[var(--text)]/70 mt-3">
                In the name of God, the Most Gracious, the Most Merciful
              </p>
            </div>

            {/* Capability strip */}
            <div className="border-t border-[var(--border)]/60 px-6 py-4 flex flex-wrap items-center justify-center gap-3 text-[0.72rem] text-[var(--text-dim)]">
              {[
                "7 preset styles",
                "Custom fonts",
                "Background blur",
                "Tajweed colors",
                "RTL support",
              ].map((cap) => (
                <span
                  key={cap}
                  className="font-mono-ui tracking-wide uppercase"
                >
                  {cap}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────── */}
      <section className="py-20 sm:py-28 px-5 border-t border-[var(--border)]/40">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Ready to create?
          </h2>
          <p className="text-[var(--text-muted)] mb-10">
            No sign-up required. Just open the editor and start building.
          </p>
          <Link
            href="/editor"
            className="inline-flex items-center gap-2.5 rounded-xl bg-[var(--gold)] px-8 py-4 text-base font-semibold text-[var(--bg)] transition-all hover:brightness-110 hover:shadow-[0_0_32px_rgba(212,168,83,0.3)]"
          >
            Start Creating &mdash; It&apos;s Free
            <ArrowRight className="h-4.5 w-4.5" />
          </Link>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="border-t border-[var(--border)]/40 py-8 px-5">
        <div className="mx-auto flex max-w-6xl flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--text-dim)]">
          <span className="font-semibold text-[var(--text-muted)]">
            Ayah Studio
          </span>
          <div className="flex items-center gap-5">
            <span>Built by Akbar</span>
            <a
              href="https://github.com/AkbarDevop/ayah-studio"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 hover:text-[var(--text-muted)] transition-colors"
            >
              <Github className="h-3.5 w-3.5" />
              GitHub
            </a>
            <span>Deployed on Netlify</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
