"use client";

import { useState } from "react";

const RULES = [
  "Pay a listed shop in sats.",
  "Spend at least 1,000 sats to earn a reward.",
  "Get 500 sats back as a reward.",
  "One reward per shop each day.",
  "Each shop can trigger 5 rewards per day.",
  "Rewards reset every day (Zambia time).",
] as const;

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-3 w-3 transition-transform duration-300 ease-out ${
        open ? "rotate-180" : "rotate-0"
      }`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.25}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

export function AboutSatReward() {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-7">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="tap-none group mx-auto flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-mute transition-colors hover:text-ink-soft"
      >
        <span
          className="h-px w-5 bg-gradient-to-r from-transparent to-gold/50 transition-all group-hover:w-7 group-hover:to-gold/70"
          aria-hidden
        />
        <span>Rules</span>
        <ChevronIcon open={open} />
        <span
          className="h-px w-5 bg-gradient-to-l from-transparent to-gold/50 transition-all group-hover:w-7 group-hover:to-gold/70"
          aria-hidden
        />
      </button>

      <div
        className={`grid transition-all duration-300 ease-out ${
          open ? "mt-4 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="relative overflow-hidden rounded-[22px] px-5 py-5 shadow-[0_1px_0_rgb(255_255_255)_inset,0_8px_24px_-12px_rgb(15_23_42/0.12)] ring-1 ring-line/90">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_80%_at_50%_0%,rgb(255_250_235/0.9),transparent_60%),linear-gradient(165deg,#ffffff_0%,#faf8f4_50%,#f4f6fa_100%)]" />
            <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent" />
            <div className="pointer-events-none absolute left-1/2 top-0 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/15 blur-2xl" />

            <div className="relative">
              <div className="mb-5 flex flex-col items-center text-center">
                <svg
                  className="mb-2.5 h-4 w-4 text-gold"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden
                >
                  <path d="M13.2 2.1 5.4 13.4c-.25.36 0 .85.43.85h5.02l-1.2 7.4c-.1.62.7.98 1.12.5l8.1-11.1c.27-.37.01-.9-.44-.9h-5.2l1.35-7.55c.1-.58-.66-.93-1.08-.5Z" />
                </svg>
                <p className="font-display text-[1.55rem] leading-none text-ink">SatReward</p>
                <p className="mt-2 text-[13px] leading-snug text-mute">
                  Pay a shop. Get sats back.
                </p>
              </div>

              <div className="mb-4 flex items-center gap-3" aria-hidden>
                <span className="h-px flex-1 bg-gradient-to-r from-transparent to-line" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-mute">
                  Rules
                </span>
                <span className="h-px flex-1 bg-gradient-to-l from-transparent to-line" />
              </div>

              <ol className="space-y-2.5">
                {RULES.map((rule, i) => (
                  <li key={rule} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-[#e8d19a] to-[#b8893d] text-[10px] font-semibold text-white shadow-[0_1px_0_rgb(255_255_255/0.3)_inset]">
                      {i + 1}
                    </span>
                    <p className="pt-0.5 text-[13px] leading-snug text-ink-soft">{rule}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
