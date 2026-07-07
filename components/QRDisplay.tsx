"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

type Props = {
  value: string;
  size?: number;
  copyOnTap?: boolean;
};

function CheckIcon() {
  return (
    <svg
      className="h-8 w-8"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
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
      color: { dark: "#1a1208", light: "#fffaf3" },
    }).then((url) => {
      if (!cancelled) setSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  async function handleCopy() {
    if (!copyOnTap || !value) return;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setPulse(true);
    window.setTimeout(() => setPulse(false), 450);
    window.setTimeout(() => setCopied(false), 2200);
  }

  const qrBody = !src ? (
    <div
      className="flex items-center justify-center rounded-3xl bg-white shadow-inner ring-1 ring-blue-100"
      style={{ width: size, height: size }}
    >
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
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
    return (
      <div className="rounded-3xl ring-1 ring-blue-100">{qrBody}</div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        onClick={() => void handleCopy()}
        aria-label="Copy invoice"
        className={`tap-none group relative rounded-3xl transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${
          copied
            ? "ring-2 ring-green-400 shadow-lg shadow-green-200/50"
            : "ring-1 ring-blue-100 hover:ring-blue-200 hover:shadow-md active:scale-[0.97]"
        } ${pulse ? "copy-qr-pulse" : ""}`}
      >
        {qrBody}

        <div
          className={`pointer-events-none absolute inset-0 flex flex-col items-center justify-center rounded-3xl bg-green-500/90 backdrop-blur-[2px] transition-all duration-300 ${
            copied ? "scale-100 opacity-100" : "scale-95 opacity-0"
          }`}
        >
          <span className="copy-icon-pop text-white">
            <CheckIcon />
          </span>
          <span className="copy-icon-pop mt-1 text-sm font-semibold text-white">Copied!</span>
        </div>
      </button>

      <p
        className={`mt-2.5 text-xs font-medium transition-colors duration-300 ${
          copied ? "text-green-600" : "text-stone-400"
        }`}
      >
        {copied ? "Invoice copied" : "Tap QR to copy invoice"}
      </p>
    </div>
  );
}
