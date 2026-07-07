"use client";

import { useState } from "react";

type Props = {
  value: string;
  onChange: (value: string) => void;
};

export function LightningAddressInput({ value, onChange }: Props) {
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState(false);

  async function handlePaste() {
    if (pasting) return;
    setPasting(true);
    try {
      const text = await navigator.clipboard.readText();
      const trimmed = text.trim();
      if (trimmed) {
        onChange(trimmed);
        setPasted(true);
        window.setTimeout(() => setPasted(false), 1600);
      }
    } catch {
      /* clipboard denied */
    } finally {
      window.setTimeout(() => setPasting(false), 280);
    }
  }

  return (
    <div className="relative">
        <input
          type="text"
          required
          autoComplete="off"
          placeholder="you@wallet.com"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border border-stone-200 bg-stone-50 py-3.5 pl-4 pr-[5.5rem] text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
        />

        <button
          type="button"
          onClick={() => void handlePaste()}
          className={`absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold tracking-wide transition-all duration-300 ease-out active:scale-[0.88] ${
            pasted
              ? "bg-green-500 text-white shadow-md shadow-green-200"
              : "bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md hover:shadow-blue-200/50"
          } ${pasting ? "scale-90" : "scale-100"}`}
        >
          {pasted ? (
            <>
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Pasted
            </>
          ) : (
            <>
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                />
              </svg>
              Paste
            </>
        )}
      </button>
    </div>
  );
}
