"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader, IScannerControls } from "@zxing/browser";
import type { MerchantOption } from "@/components/MerchantPicker";
import {
  findMerchantByLightningAddress,
  parseMerchantLightningAddress,
} from "@/lib/parseMerchantLightningAddress";

type Props = {
  open: boolean;
  merchants: MerchantOption[];
  onClose: () => void;
  onMatch: (lightningAddress: string) => void;
};

function ScanIcon() {
  return (
    <svg
      className="h-7 w-7"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.75}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 7V5a1 1 0 011-1h2M4 17v2a1 1 0 001 1h2M16 3h2a1 1 0 011 1v2M20 17v2a1 1 0 01-1 1h-2M7 12h10"
      />
    </svg>
  );
}

export function MerchantQrScanButton({
  merchants,
  onMatch,
}: {
  merchants: MerchantOption[];
  onMatch: (lightningAddress: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Scan merchant QR code"
        className="tap-none flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-blue-600 transition hover:bg-blue-50/80 hover:text-blue-700 active:scale-95"
      >
        <ScanIcon />
      </button>

      {open && (
        <MerchantQrScanner
          open={open}
          merchants={merchants}
          onClose={() => setOpen(false)}
          onMatch={(address) => {
            setOpen(false);
            onMatch(address);
          }}
        />
      )}
    </>
  );
}

function MerchantQrScanner({ open, merchants, onClose, onMatch }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const handledRef = useRef(false);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<"starting" | "scanning" | "error">("starting");
  const [message, setMessage] = useState("Starting camera…");

  const stopCamera = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    const video = videoRef.current;
    const stream = video?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((track) => track.stop());
    if (video) video.srcObject = null;
  }, []);

  const handleScan = useCallback(
    (raw: string) => {
      if (handledRef.current) return;

      const address = parseMerchantLightningAddress(raw);
      if (!address) {
        setMessage("Not a Lightning address. Keep scanning…");
        return;
      }

      const merchant = findMerchantByLightningAddress(merchants, address);
      if (!merchant) {
        setMessage("No matching merchant. Keep scanning…");
        return;
      }

      handledRef.current = true;
      stopCamera();
      onMatch(merchant.lightningAddress);
    },
    [merchants, onMatch, stopCamera]
  );

  useEffect(() => {
    if (!open) return;

    handledRef.current = false;
    setStatus("starting");
    setMessage("Starting camera…");

    const reader = new BrowserQRCodeReader(undefined, {
      delayBetweenScanAttempts: 250,
    });

    let cancelled = false;

    void (async () => {
      const video = videoRef.current;
      if (!video) return;

      try {
        const controls = await reader.decodeFromVideoDevice(undefined, video, (result) => {
          if (result) handleScan(result.getText());
        });

        if (cancelled) {
          controls.stop();
          return;
        }

        controlsRef.current = controls;
        setStatus("scanning");
        setMessage("Point at a merchant Lightning address QR");
      } catch {
        if (!cancelled) {
          setStatus("error");
          setMessage("Camera access failed. Allow camera permission and try again.");
        }
      }
    })();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [open, attempt, handleScan, stopCamera]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/50 p-4 sm:items-center">
      <div
        className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-stone-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="merchant-scan-title"
      >
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
          <div>
            <p
              id="merchant-scan-title"
              className="text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-400"
            >
              Scan merchant
            </p>
            <p className="mt-0.5 text-base font-semibold text-stone-900">Lightning address QR</p>
          </div>
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="rounded-xl px-3 py-1.5 text-sm font-medium text-stone-500 transition hover:bg-stone-100 hover:text-stone-800"
          >
            Close
          </button>
        </div>

        <div className="relative mx-5 mt-5 overflow-hidden rounded-2xl bg-stone-950 ring-1 ring-stone-200">
          <video
            ref={videoRef}
            className="aspect-[4/3] w-full object-cover"
            playsInline
            muted
          />

          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-44 w-44 rounded-2xl border-2 border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
          </div>

          {status === "starting" && (
            <div className="absolute inset-0 flex items-center justify-center bg-stone-950/70">
              <p className="text-sm font-medium text-white">{message}</p>
            </div>
          )}
        </div>

        <div className="px-5 py-4">
          <p
            className={`text-center text-sm ${
              status === "error"
                ? "font-medium text-red-600"
                : message.includes("Keep scanning")
                  ? "font-medium text-amber-700"
                  : "text-stone-500"
            }`}
          >
            {message}
          </p>

          {status === "error" && (
            <button
              type="button"
              onClick={() => {
                handledRef.current = false;
                setStatus("starting");
                setMessage("Starting camera…");
                stopCamera();
                setAttempt((n) => n + 1);
              }}
              className="mt-4 w-full rounded-2xl bg-stone-100 py-3 text-sm font-semibold text-stone-700 transition hover:bg-stone-200"
            >
              Try again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export { MerchantQrScanner };
