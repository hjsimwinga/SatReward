"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader, IScannerControls } from "@zxing/browser";
import { DecodeHintType, BarcodeFormat } from "@zxing/library";
import type { MerchantOption } from "@/components/MerchantPicker";
import {
  findMerchantByLightningAddress,
  classifyMerchantQrPayload,
} from "@/lib/parseMerchantLightningAddress";

type Props = {
  open: boolean;
  merchants: MerchantOption[];
  onClose: () => void;
  onMatch: (lightningAddress: string) => void;
};

type Tone = "idle" | "reject" | "error";

function ScanIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 7V5a1 1 0 011-1h2M4 17v2a1 1 0 001 1h2M16 3h2a1 1 0 011 1v2M20 17v2a1 1 0 01-1 1h-2M7 12h10"
      />
    </svg>
  );
}

function prepareVideoEl(video: HTMLVideoElement) {
  video.setAttribute("playsinline", "true");
  video.setAttribute("webkit-playsinline", "true");
  video.setAttribute("muted", "true");
  video.setAttribute("autoplay", "true");
  video.playsInline = true;
  video.muted = true;
  video.autoplay = true;
  // Avoid mirrored preview — better for QR on both platforms
  video.style.transform = "none";
}

async function startScanner(
  reader: BrowserQRCodeReader,
  video: HTMLVideoElement,
  onResult: (text: string) => void
): Promise<IScannerControls> {
  const callback = (result: { getText(): string } | undefined) => {
    if (result) onResult(result.getText());
  };

  // 1) Rear camera via facingMode — best for iOS + Android
  try {
    return await reader.decodeFromConstraints(
      {
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      },
      video,
      callback
    );
  } catch {
    /* fall through */
  }

  // 2) Any camera
  try {
    return await reader.decodeFromConstraints(
      { audio: false, video: true },
      video,
      callback
    );
  } catch {
    /* fall through */
  }

  // 3) Device list after permission (labels work after first grant)
  const devices = await BrowserQRCodeReader.listVideoInputDevices();
  if (!devices.length) {
    throw new Error("No camera found");
  }

  const back = devices.find((d) => /back|rear|environment|world/i.test(d.label));
  const deviceId = back?.deviceId ?? devices[0].deviceId;

  return reader.decodeFromVideoDevice(deviceId, video, callback);
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
        className="tap-none inline-flex items-center text-accent transition duration-200 hover:text-accent-deep active:scale-95"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-gradient-to-b from-white to-[#f4f2ee] shadow-[0_1px_0_rgb(255_255_255)_inset,0_4px_12px_-6px_rgb(15_23_42/0.18)] ring-1 ring-line/80 transition hover:ring-gold/35">
          <ScanIcon />
        </span>
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
  const merchantsRef = useRef(merchants);
  const onMatchRef = useRef(onMatch);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<"starting" | "scanning" | "error">("starting");
  const [message, setMessage] = useState("Starting camera…");
  const [tone, setTone] = useState<Tone>("idle");

  merchantsRef.current = merchants;
  onMatchRef.current = onMatch;

  const stopCamera = useCallback(() => {
    try {
      controlsRef.current?.stop();
    } catch {
      /* ignore */
    }
    controlsRef.current = null;

    const video = videoRef.current;
    const stream = video?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch {
        /* ignore */
      }
    });
    if (video) {
      video.srcObject = null;
      try {
        video.pause();
      } catch {
        /* ignore */
      }
    }
  }, []);

  const reject = useCallback((text: string) => {
    setTone("reject");
    setMessage(text);
  }, []);

  const handleScan = useCallback(
    (raw: string) => {
      if (handledRef.current) return;

      const parsed = classifyMerchantQrPayload(raw);
      if (parsed.kind === "invoice") {
        reject("This is an invoice, not a shop address.");
        return;
      }
      if (parsed.kind === "none") {
        reject("Not a Lightning address.");
        return;
      }

      const merchant = findMerchantByLightningAddress(
        merchantsRef.current,
        parsed.address
      );
      if (!merchant) {
        reject("Shop not listed on SatReward.");
        return;
      }

      handledRef.current = true;
      stopCamera();
      onMatchRef.current(merchant.lightningAddress);
    },
    [reject, stopCamera]
  );

  useEffect(() => {
    if (!open) return;

    handledRef.current = false;
    setStatus("starting");
    setTone("idle");
    setMessage("Starting camera…");

    if (typeof window !== "undefined" && !window.isSecureContext) {
      setStatus("error");
      setTone("error");
      setMessage("Camera needs HTTPS. Open SatReward on a secure link.");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("error");
      setTone("error");
      setMessage("This browser cannot use the camera.");
      return;
    }

    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
    hints.set(DecodeHintType.TRY_HARDER, true);

    const reader = new BrowserQRCodeReader(hints, {
      delayBetweenScanAttempts: 150,
      delayBetweenScanSuccess: 400,
      tryPlayVideoTimeout: 10000,
    });

    let cancelled = false;

    void (async () => {
      // Let the modal + video mount fully (important on iOS)
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
      if (cancelled) return;

      const video = videoRef.current;
      if (!video) {
        setStatus("error");
        setTone("error");
        setMessage("Camera view failed to load. Try again.");
        return;
      }

      prepareVideoEl(video);

      try {
        const controls = await startScanner(reader, video, (text) => {
          if (!cancelled) handleScan(text);
        });

        if (cancelled) {
          controls.stop();
          return;
        }

        controlsRef.current = controls;

        // Kick playback again for stubborn iOS Safari cases
        try {
          await video.play();
        } catch {
          /* zxing usually already playing */
        }

        setStatus("scanning");
        setTone("idle");
        setMessage("Scan a listed shop Lightning address");
      } catch {
        if (!cancelled) {
          setStatus("error");
          setTone("error");
          setMessage("Camera blocked. Allow access and try again.");
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#1a1f2a]/55 p-4 backdrop-blur-[2px] sm:items-center">
      <div
        className="relative w-full max-w-md overflow-hidden rounded-[28px] shadow-[0_1px_0_rgb(255_255_255)_inset,0_28px_56px_-24px_rgb(15_23_42/0.35)] ring-1 ring-line/90"
        role="dialog"
        aria-modal="true"
        aria-labelledby="merchant-scan-title"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgb(255_248_230/0.95),transparent_55%),linear-gradient(165deg,#ffffff_0%,#faf8f4_48%,#f4f6fa_100%)]" />
        <div className="pointer-events-none absolute -right-10 -top-8 h-32 w-32 rounded-full bg-gold/15 blur-3xl" />

        <div className="relative">
          <div className="flex items-center justify-between px-5 pb-3 pt-5">
            <div>
              <p id="merchant-scan-title" className="label-quiet">
                Scan shop
              </p>
              <p className="mt-1.5 font-display text-[1.35rem] leading-none text-ink">
                Lightning address
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className="tap-none rounded-xl px-3 py-2 text-sm font-semibold text-mute transition hover:bg-black/[0.04] hover:text-ink"
            >
              Close
            </button>
          </div>

          <div className="relative mx-5 overflow-hidden rounded-[22px] bg-[#0f141c] shadow-[0_12px_28px_-16px_rgb(15_23_42/0.55)] ring-1 ring-black/20">
            <video
              ref={videoRef}
              className="aspect-[4/3] w-full object-cover"
              playsInline
              muted
              autoPlay
            />

            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="relative h-48 w-48">
                <div className="absolute inset-0 rounded-[20px] shadow-[0_0_0_9999px_rgba(8,10,14,0.45)]" />
                <div className="absolute inset-0 rounded-[20px] ring-1 ring-white/35" />
                <span className="absolute left-0 top-0 h-5 w-5 rounded-tl-[10px] border-l-2 border-t-2 border-[#d4b56a]" />
                <span className="absolute right-0 top-0 h-5 w-5 rounded-tr-[10px] border-r-2 border-t-2 border-[#d4b56a]" />
                <span className="absolute bottom-0 left-0 h-5 w-5 rounded-bl-[10px] border-b-2 border-l-2 border-[#d4b56a]" />
                <span className="absolute bottom-0 right-0 h-5 w-5 rounded-br-[10px] border-b-2 border-r-2 border-[#d4b56a]" />
              </div>
            </div>

            {status === "starting" && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#0f141c]/75">
                <p className="text-sm font-medium text-white/90">{message}</p>
              </div>
            )}
          </div>

          <div className="px-5 pb-5 pt-4">
            <p
              className={`text-center text-sm leading-relaxed ${
                tone === "error"
                  ? "font-semibold text-red-600"
                  : tone === "reject"
                    ? "font-semibold text-[#9a6b1f]"
                    : "text-mute"
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
                  setTone("idle");
                  setMessage("Starting camera…");
                  stopCamera();
                  setAttempt((n) => n + 1);
                }}
                className="btn-primary mt-4"
              >
                Try again
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export { MerchantQrScanner };
