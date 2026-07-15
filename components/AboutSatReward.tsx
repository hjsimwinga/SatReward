"use client";

import { useEffect, useRef, useState } from "react";

const STEPS = [
  {
    title: "Spend",
    body: "Pay a listed shop in sats.",
  },
  {
    title: "Earn",
    body: "Get 20% sats back, up to 2,000 sats.",
  },
  {
    title: "Once a day",
    body: "One reward per shop each day.",
  },
  {
    title: "Fair play",
    body: "Each shop can trigger 5 rewards per day.",
  },
  {
    title: "Fresh start",
    body: "Rewards reset every day (Zambia time).",
  },
] as const;

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 transition-transform duration-300 ease-out ${
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
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const root = rootRef.current;
      if (!root) return;
      if (e.target instanceof Node && !root.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className="mt-7">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="tap-none group mx-auto flex flex-col items-center gap-1 label-quiet transition-colors hover:text-ink-soft"
      >
        <span>How it works</span>
        <ChevronIcon open={open} />
      </button>

      <div
        className={`grid transition-all duration-300 ease-out ${
          open ? "mt-4 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <section className="card relative">
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
              <div className="absolute -right-10 -top-12 h-28 w-28 rounded-full bg-gold/15 blur-3xl" />
              <div className="absolute -bottom-12 -left-8 h-24 w-24 rounded-full bg-sky-200/20 blur-3xl" />
            </div>

            <div className="relative px-5 pb-5 pt-5 lg:px-6 lg:pb-6 lg:pt-6">
              <p className="font-display text-center text-[1.65rem] leading-none tracking-tight text-ink">
                Pay a shop. Get sats back.
              </p>

              {/* Mobile: stacked list */}
              <div className="mt-6 space-y-0 lg:hidden">
                {STEPS.map((step, i) => (
                  <div
                    key={step.title}
                    className={`flex gap-4 py-3.5 ${
                      i > 0 ? "border-t border-line-soft/90" : ""
                    }`}
                  >
                    <p className="tnum w-7 shrink-0 pt-0.5 text-[11px] font-semibold tracking-[0.08em] text-gold">
                      {String(i + 1).padStart(2, "0")}
                    </p>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-ink">{step.title}</p>
                      <p className="mt-0.5 text-[13px] leading-snug text-mute">{step.body}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop: one premium row */}
              <div className="mt-7 hidden lg:grid lg:grid-cols-5 lg:gap-0">
                {STEPS.map((step, i) => (
                  <div
                    key={step.title}
                    className={`px-3 text-center ${
                      i > 0 ? "border-l border-line-soft/90" : ""
                    }`}
                  >
                    <p className="tnum text-[11px] font-semibold tracking-[0.08em] text-gold">
                      {String(i + 1).padStart(2, "0")}
                    </p>
                    <p className="mt-2 text-[13px] font-semibold text-ink">{step.title}</p>
                    <p className="mt-1 text-[12px] leading-snug text-mute">{step.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
