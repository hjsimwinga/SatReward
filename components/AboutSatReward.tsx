"use client";

import { useState } from "react";

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-4 w-4 transition-transform duration-300 ease-out ${
        open ? "rotate-180" : "rotate-0"
      }`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

export function AboutSatReward() {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mx-auto flex items-center gap-1.5 text-xs font-medium text-stone-400 transition-colors hover:text-stone-600"
      >
        <span>What is SatReward?</span>
        <ChevronIcon open={open} />
      </button>

      <div
        className={`grid transition-all duration-300 ease-out ${
          open ? "mt-3 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="rounded-2xl border border-stone-100 bg-white/70 px-5 py-4 text-center shadow-sm backdrop-blur-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-600">
              Bitcoin Victoria Falls
            </p>
            <p className="mt-3 text-sm leading-relaxed text-stone-600">
              SatReward helps our community spend Bitcoin at local merchants.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-stone-600">
              You pay a merchant in sats. You get a small reward back once per day.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-stone-500">
              More spending. Stronger local Bitcoin economy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
