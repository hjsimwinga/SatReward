"use client";

import { useState } from "react";

type Props = {
  value: string;
  onChange: (value: string) => void;
};

function PasteIcon() {
  return (
    <svg
      className="h-[18px] w-[18px] shrink-0 drop-shadow-[0_1px_1px_rgb(0_0_0/0.18)]"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <rect
        x="5"
        y="7"
        width="14"
        height="14"
        rx="3"
        fill="currentColor"
        fillOpacity="0.22"
      />
      <rect
        x="5"
        y="7"
        width="14"
        height="14"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M9 7.25V6.2A2.2 2.2 0 0 1 11.2 4h1.6A2.2 2.2 0 0 1 15 6.2v1.05"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <rect
        x="9.25"
        y="4.75"
        width="5.5"
        height="3.1"
        rx="1.2"
        fill="currentColor"
        fillOpacity="0.95"
      />
      <path
        d="M9 12.25h6M9 15.5h4.25"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        opacity="0.9"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      className="h-[18px] w-[18px] shrink-0 drop-shadow-[0_1px_1px_rgb(0_0_0/0.18)]"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" fill="currentColor" fillOpacity="0.22" />
      <path
        d="M7.5 12.4 10.6 15.5 16.5 8.8"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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
        inputMode="email"
        placeholder="you@wallet.com"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="field pr-[7.75rem] text-[13px] font-medium tracking-wide text-mute"
      />

      <button
        type="button"
        onClick={() => void handlePaste()}
        className={`absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-2 rounded-[13px] px-3.5 py-2 text-xs font-semibold tracking-wide text-white transition-all duration-300 ease-out active:scale-[0.92] ${
          pasted
            ? "bg-rise shadow-[0_1px_0_rgb(255_255_255/0.2)_inset,0_4px_10px_-4px_rgb(16_185_129/0.45)]"
            : "bg-gradient-to-b from-[#d4b56a] to-accent-deep shadow-[0_1px_0_rgb(255_255_255/0.3)_inset,0_6px_14px_-6px_rgb(148_112_52/0.5)] hover:brightness-105"
        } ${pasting ? "scale-90" : "scale-100"}`}
      >
        {pasted ? <CheckIcon /> : <PasteIcon />}
        {pasted ? "Pasted" : "Paste"}
      </button>
    </div>
  );
}
