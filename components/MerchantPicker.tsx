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

const AVATAR_THEMES = [
  { from: "#1f2a37", to: "#334155", ink: "#f8fafc" },
  { from: "#1e3a3a", to: "#2f5d50", ink: "#f4faf7" },
  { from: "#2c2419", to: "#5c4a32", ink: "#faf6ef" },
  { from: "#1e293b", to: "#3b4f6b", ink: "#f1f5f9" },
  { from: "#3b1f2b", to: "#6b3a4d", ink: "#fdf4f7" },
  { from: "#1a2e28", to: "#355e4f", ink: "#f0faf5" },
  { from: "#2a2118", to: "#7a6238", ink: "#fff8eb" },
] as const;

function themeFor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_THEMES[hash % AVATAR_THEMES.length];
}

function StoreMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3.8 9.4 5.7 5.5A1.8 1.8 0 0 1 7.3 4.5h9.4a1.8 1.8 0 0 1 1.6 1l1.9 3.9"
        fill="currentColor"
        fillOpacity="0.18"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3.8 9.4h16.4v1.7a2.5 2.5 0 0 1-2.5 2.5H6.3A2.5 2.5 0 0 1 3.8 11.1V9.4Z"
        fill="currentColor"
        fillOpacity="0.28"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M5.8 13.6V18.6a1.2 1.2 0 0 0 1.2 1.2h10a1.2 1.2 0 0 0 1.2-1.2v-5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M10 19.8v-3.6a1.4 1.4 0 0 1 1.4-1.4h1.2a1.4 1.4 0 0 1 1.4 1.4v3.6"
        fill="currentColor"
        fillOpacity="0.35"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M8.2 16.2h1.4M14.4 16.2h1.4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.85"
      />
    </svg>
  );
}

function MerchantAvatar({ name }: { name: string }) {
  const theme = themeFor(name);

  return (
    <div
      className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[14px] shadow-[0_1px_0_rgb(255_255_255/0.22)_inset,0_8px_16px_-10px_rgb(15_23_42/0.45)] ring-1 ring-black/10"
      style={{
        background: `linear-gradient(165deg, ${theme.from} 0%, ${theme.to} 100%)`,
        color: theme.ink,
      }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/25" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgb(255_255_255/0.16),transparent_55%)]" />
      <StoreMark className="relative h-7 w-7 drop-shadow-[0_1px_2px_rgb(0_0_0/0.25)]" />
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
  const recentTop = useMemo(
    () => recentAddresses.slice(0, 3),
    [recentAddresses]
  );

  const recentSet = useMemo(
    () => new Set(recentTop.map((a) => a.toLowerCase())),
    [recentTop]
  );

  const sorted = useMemo(() => {
    const recentRank = new Map(recentTop.map((a, i) => [a.toLowerCase(), i]));
    return [...merchants].sort((a, b) => {
      const ar = recentRank.get(a.lightningAddress.toLowerCase());
      const br = recentRank.get(b.lightningAddress.toLowerCase());
      if (ar != null && br != null) return ar - br;
      if (ar != null) return -1;
      if (br != null) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [merchants, recentTop]);

  const filtered = useMemo(() => {
    let q = query.trim().toLowerCase();
    if (!q) return sorted;
    q = q.replace(/^lightning:\/\//, "").replace(/^lightning:/, "");
    return sorted.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.lightningAddress.toLowerCase().includes(q)
    );
  }, [sorted, query]);

  const showRecentLabel = recentTop.length > 0 && !query.trim();

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
          className="pointer-events-none absolute left-4 top-1/2 z-[1] h-[18px] w-[18px] -translate-y-1/2 text-mute"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.75}
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z"
          />
        </svg>
        <input
          type="search"
          placeholder="Search name or address"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="field !pl-12"
        />
      </div>

      <div className="overflow-hidden rounded-[22px] bg-[#f7f9fa] ring-1 ring-line">
        {showRecentLabel && (
          <div className="border-b border-line/80 px-4 py-2.5">
            <p className="label-quiet">Recently paid</p>
          </div>
        )}

        <div className="relative">
          <div className="scroll-premium max-h-[min(320px,52vh)] overflow-y-auto overscroll-contain px-1.5 py-1.5">
            {filtered.length === 0 && (
              <p className="py-10 text-center text-sm text-mute">No shops found</p>
            )}

            {filtered.map((m, index) => {
              const isRecent = recentSet.has(m.lightningAddress.toLowerCase());
              const showDivider =
                showRecentLabel && index === lastRecentIndex + 1 && lastRecentIndex >= 0;

              return (
                <div key={m.lightningAddress}>
                  {showDivider && (
                    <div className="my-1.5 flex items-center gap-3 px-3">
                      <div className="h-px flex-1 bg-line" />
                      <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-mute">
                        All shops
                      </span>
                      <div className="h-px flex-1 bg-line" />
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => onSelect(m.lightningAddress)}
                    className={`group flex w-full items-center gap-3.5 rounded-[16px] px-3 py-3.5 text-left transition-all duration-200 active:scale-[0.985] ${
                      selected === m.lightningAddress
                        ? "bg-white ring-1 ring-vault/15"
                        : "hover:bg-white/90"
                    }`}
                  >
                    <MerchantAvatar name={m.name} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[15px] font-semibold tracking-tight text-ink">
                          {m.name}
                        </p>
                        {isRecent && !query.trim() && (
                          <span className="shrink-0 rounded-md bg-gold/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#8a6b28]">
                            Recent
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-[13px] text-mute">
                        {m.lightningAddress}
                      </p>
                    </div>
                    <span className="text-line transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-gold">
                      <ChevronRight />
                    </span>
                  </button>
                </div>
              );
            })}
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-[#f7f9fa] to-transparent" />
        </div>
      </div>
    </div>
  );
}
