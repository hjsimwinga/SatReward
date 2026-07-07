"use client";

import { useMemo, useState } from "react";

export type MerchantOption = {
  name: string;
  lightningAddress: string;
  tagline?: string;
};

type Props = {
  merchants: MerchantOption[];
  recentAddresses: string[];
  selected: string | null;
  onSelect: (lightningAddress: string) => void;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function MerchantAvatar({ name }: { name: string }) {
  return (
    <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-sm font-semibold tracking-tight text-white shadow-md shadow-blue-500/20 ring-2 ring-white">
      {initials(name)}
    </div>
  );
}

function ChevronRight() {
  return (
    <svg
      className="h-4 w-4 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export function MerchantPicker({ merchants, recentAddresses, selected, onSelect }: Props) {
  const [query, setQuery] = useState("");

  const recentSet = useMemo(
    () => new Set(recentAddresses.map((a) => a.toLowerCase())),
    [recentAddresses]
  );

  const sorted = useMemo(() => {
    const recentRank = new Map(recentAddresses.map((a, i) => [a.toLowerCase(), i]));
    return [...merchants].sort((a, b) => {
      const ar = recentRank.get(a.lightningAddress.toLowerCase());
      const br = recentRank.get(b.lightningAddress.toLowerCase());
      if (ar != null && br != null) return ar - br;
      if (ar != null) return -1;
      if (br != null) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [merchants, recentAddresses]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.lightningAddress.toLowerCase().includes(q) ||
        (m.tagline?.toLowerCase().includes(q) ?? false)
    );
  }, [sorted, query]);

  const showRecentLabel = recentAddresses.length > 0 && !query.trim();

  let lastRecentIndex = -1;
  if (showRecentLabel) {
    for (let i = filtered.length - 1; i >= 0; i--) {
      if (recentSet.has(filtered[i].lightningAddress.toLowerCase())) {
        lastRecentIndex = i;
        break;
      }
    }
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <svg
          className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-stone-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.75}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z"
          />
        </svg>
        <input
          type="search"
          placeholder="Search merchants"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-xl bg-stone-50 py-3.5 pl-11 pr-4 text-[15px] text-stone-900 outline-none ring-1 ring-stone-100 transition placeholder:text-stone-400 focus:bg-white focus:ring-2 focus:ring-blue-600/15"
        />
      </div>

      <div className="overflow-hidden rounded-2xl bg-stone-50/60 ring-1 ring-stone-100/80">
        {showRecentLabel && (
          <div className="border-b border-stone-100/80 px-4 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-400">
              Recently paid
            </p>
          </div>
        )}

        <div className="relative">
          <div className="scroll-premium max-h-[min(320px,52vh)] overflow-y-auto overscroll-contain px-1.5 py-1.5">
            {filtered.length === 0 && (
              <p className="py-10 text-center text-sm text-stone-400">No merchants found</p>
            )}

            {filtered.map((m, index) => {
              const isRecent = recentSet.has(m.lightningAddress.toLowerCase());
              const showDivider =
                showRecentLabel && index === lastRecentIndex + 1 && lastRecentIndex >= 0;

              return (
                <div key={m.lightningAddress}>
                  {showDivider && (
                    <div className="my-1.5 flex items-center gap-3 px-3">
                      <div className="h-px flex-1 bg-stone-200/70" />
                      <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-stone-400">
                        All merchants
                      </span>
                      <div className="h-px flex-1 bg-stone-200/70" />
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => onSelect(m.lightningAddress)}
                    className={`group flex w-full items-center gap-3.5 rounded-xl px-3 py-3.5 text-left transition-all duration-200 active:scale-[0.985] ${
                      selected === m.lightningAddress
                        ? "bg-white shadow-sm ring-1 ring-blue-600/20"
                        : "hover:bg-white/90"
                    }`}
                  >
                    <MerchantAvatar name={m.name} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[15px] font-semibold tracking-tight text-stone-900">
                          {m.name}
                        </p>
                        {isRecent && !query.trim() && (
                          <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-600">
                            Recent
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-[13px] text-stone-500">
                        {m.tagline ?? m.lightningAddress}
                      </p>
                    </div>
                    <span className="text-stone-300 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-blue-500">
                      <ChevronRight />
                    </span>
                  </button>
                </div>
              );
            })}
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-stone-50/95 to-transparent" />
        </div>
      </div>
    </div>
  );
}
