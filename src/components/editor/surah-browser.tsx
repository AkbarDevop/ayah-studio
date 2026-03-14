"use client";

import { Search, BookOpen, ChevronDown, BookMarked } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import type { Surah } from "@/types";
import { TRANSLATIONS } from "@/lib/constants";

interface SurahBrowserProps {
  surahs: Surah[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelect: (surah: Surah) => void;
  translationEdition: string;
  onTranslationChange: (edition: string) => void;
}

export default function SurahBrowser({
  surahs,
  searchQuery,
  onSearchChange,
  onSelect,
  translationEdition,
  onTranslationChange,
}: SurahBrowserProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedTranslation = TRANSLATIONS.find(
    (t) => t.code === translationEdition
  );

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard shortcut: "/" to focus search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.key === "/" &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(
          (e.target as HTMLElement).tagName
        )
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleDropdownKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        setDropdownOpen(false);
      }
    },
    []
  );

  const filteredSurahs = surahs.filter((surah) => {
    const q = searchQuery.toLowerCase();
    return (
      surah.englishName.toLowerCase().includes(q) ||
      surah.englishNameTranslation.toLowerCase().includes(q) ||
      surah.name.includes(searchQuery) ||
      surah.number.toString().includes(q)
    );
  });

  return (
    <div className="flex h-full flex-col animate-fade-in">
      {/* Translation Selector */}
      <div className="px-4 pb-2 pt-4" ref={dropdownRef}>
        <label
          id="translation-label"
          className="font-mono-ui mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)]"
        >
          Translation
        </label>
        <div className="relative" onKeyDown={handleDropdownKeyDown}>
          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            aria-haspopup="listbox"
            aria-expanded={dropdownOpen}
            aria-labelledby="translation-label"
            className="w-full flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] transition-all duration-200 hover:border-[var(--border-light)] focus:outline-none focus:border-[var(--gold-dim)] focus:ring-1 focus:ring-[var(--gold-dim)]/30"
          >
            <span className="truncate">
              {selectedTranslation?.label ?? "Select translation"}
            </span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform duration-200 ${
                dropdownOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {dropdownOpen && (
            <div
              role="listbox"
              aria-labelledby="translation-label"
              className="animate-slide-down absolute z-50 mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-black/30 max-h-60 overflow-y-auto"
            >
              {TRANSLATIONS.map((t) => (
                <button
                  key={t.code}
                  type="button"
                  role="option"
                  aria-selected={t.code === translationEdition}
                  onClick={() => {
                    onTranslationChange(t.code);
                    setDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2.5 text-sm transition-colors duration-150 hover:bg-[var(--surface-alt)] ${
                    t.code === translationEdition
                      ? "text-[var(--gold)] bg-[var(--surface-alt)]"
                      : "text-[var(--text)]"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Search Input */}
      <div className="px-4 py-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-dim)]" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search surahs... (press /)"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="Search surahs"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] py-2.5 pl-10 pr-4 text-sm text-[var(--text)] placeholder:text-[var(--text-dim)] transition-all duration-200 focus:outline-none focus:border-[var(--gold-dim)] focus:ring-1 focus:ring-[var(--gold-dim)]/30"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-[var(--text-dim)] transition-colors hover:text-[var(--text)]"
              aria-label="Clear search"
            >
              <span className="text-xs font-medium">&times;</span>
            </button>
          )}
        </div>
      </div>

      {/* Surah Count */}
      <div className="px-4 py-1">
        <span className="font-mono-ui text-[11px] uppercase tracking-wider text-[var(--text-dim)]">
          {filteredSurahs.length} surah{filteredSurahs.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Surah List */}
      <div className="flex-1 space-y-2 overflow-y-auto px-4 pb-4" role="list">
        {filteredSurahs.map((surah, index) => (
          <button
            key={surah.number}
            type="button"
            role="listitem"
            onClick={() => onSelect(surah)}
            className="group w-full rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] p-3.5 text-left transition-all duration-200 hover:border-[var(--gold-dim)] hover:shadow-lg hover:shadow-black/20 active:scale-[0.99]"
            style={{ animationDelay: `${Math.min(index * 20, 200)}ms` }}
          >
            <div className="flex items-center gap-3">
              {/* Number Badge */}
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border-light)] bg-[var(--surface)] text-xs font-semibold text-[var(--text-muted)] transition-all duration-200 group-hover:border-[var(--gold-dim)] group-hover:text-[var(--gold)] group-hover:shadow-[0_0_12px_rgba(212,168,83,0.12)]">
                {surah.number}
              </div>

              {/* Name & Translation */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-[var(--text)] truncate transition-colors duration-200 group-hover:text-[var(--gold-light)]">
                    {surah.englishName}
                  </span>
                  <span className="font-arabic-ui shrink-0 text-base text-[var(--gold)]">
                    {surah.name}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <span className="text-xs text-[var(--text-muted)] truncate">
                    {surah.englishNameTranslation}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <BookOpen className="h-3 w-3 text-[var(--text-dim)]" />
                    <span className="font-mono-ui text-[11px] text-[var(--text-dim)]">
                      {surah.numberOfAyahs} ayahs
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </button>
        ))}

        {filteredSurahs.length === 0 && (
          <div className="animate-fade-in flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-[var(--border-light)] bg-[var(--surface)]">
              <Search className="h-6 w-6 text-[var(--text-dim)]" />
            </div>
            <p className="text-sm font-medium text-[var(--text-muted)]">
              No surahs found
            </p>
            <p className="mt-1 text-xs text-[var(--text-dim)]">
              No results for &ldquo;{searchQuery}&rdquo;. Try a different name or number.
            </p>
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="mt-3 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-muted)] transition-colors hover:border-[var(--border-light)] hover:text-[var(--text)]"
            >
              Clear search
            </button>
          </div>
        )}

        {surahs.length === 0 && !searchQuery && (
          <div className="animate-fade-in flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-dashed border-[var(--border-light)]">
              <BookMarked className="h-7 w-7 text-[var(--text-dim)]" />
            </div>
            <p className="text-sm font-medium text-[var(--text-muted)]">
              Loading the Quran library...
            </p>
            <div className="mt-4 h-1 w-32 overflow-hidden rounded-full bg-[var(--surface)]">
              <div className="skeleton-shimmer h-full w-full rounded-full" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
