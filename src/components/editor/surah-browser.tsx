"use client";

import { Search, BookOpen, ChevronDown, Globe } from "lucide-react";
import { useState, useRef, useEffect, useMemo } from "react";
import type { Surah } from "@/types";
import { TRANSLATIONS, TRANSLATION_GROUP_MAP } from "@/lib/constants";

interface SurahBrowserProps {
  surahs: Surah[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelect: (surah: Surah) => void;
  translationEdition: string;
  onTranslationChange: (edition: string) => void;
  loading?: boolean;
}

function SurahSkeleton() {
  return (
    <div className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] p-3.5">
      <div className="flex items-center gap-3">
        <div className="skeleton h-9 w-9 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="skeleton h-4 w-24" />
            <div className="skeleton h-5 w-16" />
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="skeleton h-3 w-32" />
            <div className="skeleton h-3 w-16" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SurahBrowser({
  surahs,
  searchQuery,
  onSearchChange,
  onSelect,
  translationEdition,
  onTranslationChange,
  loading,
}: SurahBrowserProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [translationFilter, setTranslationFilter] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const filterInputRef = useRef<HTMLInputElement>(null);

  const selectedTranslation = TRANSLATIONS.find(
    (t) => t.code === translationEdition
  );

  // Group translations by region, filtered by search
  const groupedTranslations = useMemo(() => {
    const q = translationFilter.toLowerCase();
    const filtered = TRANSLATIONS.filter(
      (t) =>
        !q ||
        t.label.toLowerCase().includes(q) ||
        t.code.toLowerCase().includes(q)
    );

    // Build ordered groups preserving the order translations appear in
    const groupOrder: string[] = [];
    const groups: Record<string, typeof TRANSLATIONS> = {};

    for (const t of filtered) {
      const prefix = t.code === "none" ? "none" : t.code.split(".")[0];
      const groupName = TRANSLATION_GROUP_MAP[prefix] ?? "Other";
      if (!groups[groupName]) {
        groups[groupName] = [];
        groupOrder.push(groupName);
      }
      groups[groupName].push(t);
    }

    return groupOrder.map((name) => ({ name, items: groups[name] }));
  }, [translationFilter]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
        setTranslationFilter("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus filter input when dropdown opens
  useEffect(() => {
    if (dropdownOpen) {
      // Delay to let the DOM render
      requestAnimationFrame(() => filterInputRef.current?.focus());
    }
  }, [dropdownOpen]);

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
    <div className="flex h-full flex-col">
      {/* Translation Selector */}
      <div className="px-4 pb-2 pt-4" ref={dropdownRef}>
        <label className="font-mono-ui mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-[var(--text-dim)]">
          Translation
        </label>
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setDropdownOpen(!dropdownOpen);
              if (dropdownOpen) setTranslationFilter("");
            }}
            className="w-full flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] transition-colors hover:border-[var(--border-light)] focus:outline-none focus:border-[var(--gold-dim)]"
          >
            <span className="flex items-center gap-2 truncate">
              <Globe className="h-3.5 w-3.5 shrink-0 text-[var(--text-dim)]" />
              {selectedTranslation?.label ?? "Select translation"}
            </span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform ${
                dropdownOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {dropdownOpen && (
            <div className="absolute z-50 mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-black/30 overflow-hidden">
              {/* Search filter */}
              <div className="sticky top-0 border-b border-[var(--border)] bg-[var(--surface)] p-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-dim)]" />
                  <input
                    ref={filterInputRef}
                    type="text"
                    placeholder="Filter translations..."
                    value={translationFilter}
                    onChange={(e) => setTranslationFilter(e.target.value)}
                    className="w-full rounded-md border border-[var(--border)] bg-[var(--surface-alt)] py-1.5 pl-8 pr-3 text-xs text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--gold-dim)]"
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setDropdownOpen(false);
                        setTranslationFilter("");
                      }
                    }}
                  />
                </div>
              </div>

              {/* Grouped translation list */}
              <div className="max-h-64 overflow-y-auto">
                {groupedTranslations.length === 0 && (
                  <div className="px-3 py-4 text-center text-xs text-[var(--text-dim)]">
                    No translations match &ldquo;{translationFilter}&rdquo;
                  </div>
                )}
                {groupedTranslations.map((group) => (
                  <div key={group.name}>
                    <div className="font-mono-ui sticky top-0 bg-[var(--surface-alt)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-dim)]">
                      {group.name}
                    </div>
                    {group.items.map((t) => (
                      <button
                        key={t.code}
                        type="button"
                        onClick={() => {
                          onTranslationChange(t.code);
                          setDropdownOpen(false);
                          setTranslationFilter("");
                        }}
                        className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-[var(--surface-alt)] ${
                          t.code === translationEdition
                            ? "text-[var(--gold)] bg-[var(--surface-alt)]/60"
                            : "text-[var(--text)]"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Search Input */}
      <div className="px-4 py-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-dim)]" />
          <input
            type="text"
            placeholder="Search surahs..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] py-2.5 pl-10 pr-4 text-sm text-[var(--text)] placeholder:text-[var(--text-dim)] transition-colors focus:outline-none focus:border-[var(--gold-dim)]"
          />
        </div>
      </div>

      {/* Surah Count */}
      <div className="px-4 py-1">
        <span className="font-mono-ui text-[11px] uppercase tracking-wider text-[var(--text-dim)]">
          {filteredSurahs.length} surah{filteredSurahs.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Surah List */}
      <div className="flex-1 space-y-2 overflow-y-auto px-4 pb-4">
        {loading && surahs.length === 0 && (
          <>
            {Array.from({ length: 8 }).map((_, i) => (
              <SurahSkeleton key={`skeleton-${i}`} />
            ))}
          </>
        )}

        {filteredSurahs.map((surah) => (
          <button
            key={surah.number}
            type="button"
            onClick={() => onSelect(surah)}
            className="group w-full rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] p-3.5 text-left transition-all hover:border-[var(--gold-dim)] hover:shadow-lg hover:shadow-black/20"
          >
            <div className="flex items-center gap-3">
              {/* Number Badge */}
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border-light)] bg-[var(--surface)] text-xs font-semibold text-[var(--text-muted)] transition-colors group-hover:border-[var(--gold-dim)] group-hover:text-[var(--gold)]">
                {surah.number}
              </div>

              {/* Name & Translation */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-[var(--text)] truncate">
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
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Search className="mb-3 h-8 w-8 text-[var(--text-dim)]" />
            <p className="text-sm text-[var(--text-muted)]">
              No surahs found for &ldquo;{searchQuery}&rdquo;
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
