"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

type Props = {
  value: string;
  size?: number;
  copyOnTap?: boolean;
};

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.4}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="8.5"
        y="8.5"
        width="11"
        height="11"
        rx="2.2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M6.5 15.5H6A2.5 2.5 0 0 1 3.5 13V6A2.5 2.5 0 0 1 6 3.5h7A2.5 2.5 0 0 1 15.5 6v.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function QRDisplay({ value, size = 260, copyOnTap = false }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!value) {
      setSrc(null);
      return;
    }
    QRCode.toDataURL(value, {
      width: size,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#0c1222", light: "#f7f9fa" },
    }).then((url) => {
      if (!cancelled) setSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  async function handleCopy() {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setPulse(true);
      window.setTimeout(() => setPulse(false), 420);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard denied */
    }
  }

  const qrBody = !src ? (
    <div
      className="flex items-center justify-center rounded-3xl bg-white shadow-inner ring-1 ring-line/80"
      style={{ width: size, height: size }}
    >
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent" />
    </div>
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="Lightning invoice QR"
      width={size}
      height={size}
      draggable={false}
      className="rounded-3xl bg-white p-3 shadow-lg"
    />
  );

  if (!copyOnTap) {
    return <div className="rounded-3xl ring-1 ring-line/80">{qrBody}</div>;
  }

  return (
    <div className="flex flex-col items-center gap-3.5">
      <button
        type="button"
        onClick={() => void handleCopy()}
        aria-label="Copy invoice"
        className={`tap-none group relative rounded-3xl transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/35 ${
          copied
            ? "ring-2 ring-rise/50 shadow-lg shadow-rise/15"
            : "ring-1 ring-line/80 hover:ring-gold/30 hover:shadow-md active:scale-[0.98]"
        } ${pulse ? "copy-qr-pulse" : ""}`}
      >
        {qrBody}

        <div
          className={`pointer-events-none absolute inset-0 flex flex-col items-center justify-center rounded-3xl bg-rise/90 backdrop-blur-[2px] transition-all duration-300 ${
            copied ? "scale-100 opacity-100" : "scale-95 opacity-0"
          }`}
        >
          <span className="copy-icon-pop text-white">
            <CheckIcon className="h-8 w-8" />
          </span>
          <span className="copy-icon-pop mt-1 text-sm font-semibold text-white">Copied!</span>
        </div>
      </button>

      <button
        type="button"
        onClick={() => void handleCopy()}
        className={`tap-none group relative inline-flex items-center gap-2 overflow-hidden rounded-full px-4 py-2.5 text-[12px] font-semibold tracking-wide transition duration-300 active:scale-[0.96] ${
          copied
            ? "bg-rise text-white shadow-[0_1px_0_rgb(255_255_255/0.2)_inset,0_8px_18px_-8px_rgb(16_185_129/0.55)]"
            : "bg-gradient-to-b from-white to-[#f4f2ee] text-ink-soft shadow-[0_1px_0_rgb(255_255_255)_inset,0_6px_16px_-10px_rgb(15_23_42/0.25)] ring-1 ring-line/80 hover:ring-gold/35 hover:text-ink"
        }`}
      >
        {!copied && (
          <span className="pointer-events-none absolute inset-0 bg-gradient-to-b from-gold/[0.08] to-transparent opacity-0 transition group-hover:opacity-100" />
        )}
        <span className="relative flex items-center gap-2">
          {copied ? (
            <CheckIcon className="h-3.5 w-3.5" />
          ) : (
            <CopyIcon className="h-3.5 w-3.5 text-accent transition group-hover:scale-110 group-active:scale-95" />
          )}
          {copied ? "Copied" : "Copy invoice"}
        </span>
      </button>
    </div>
  );
}
