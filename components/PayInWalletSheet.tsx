"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type TransitionEvent,
} from "react";
import { createPortal } from "react-dom";
import { apiPath } from "@/lib/apiPath";
import {
  genericLightningUri,
  openInWallet,
  openWalletUri,
  PAY_SHEET_WALLETS,
  type LightningWalletOption,
} from "@/lib/lightningWalletHandoff";

type SheetProps = {
  invoice: string;
  open: boolean;
  onClose: () => void;
};

const CLOSE_DISTANCE = 88;
const CLOSE_VELOCITY = 0.45;

function ChevronRight() {
  return (
    <svg
      className="h-5 w-5 shrink-0 text-stone-300"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
    </svg>
  );
}

function WalletLogo({ wallet }: { wallet: LightningWalletOption }) {
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-stone-200/80 bg-white shadow-sm">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={apiPath(wallet.logoPath)}
        alt=""
        width={44}
        height={44}
        className="h-full w-full object-contain p-1"
      />
    </div>
  );
}

function WalletRow({
  wallet,
  onClick,
}: {
  wallet: LightningWalletOption;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tap-none flex w-full items-center gap-3.5 rounded-2xl px-3 py-3 text-left transition hover:bg-stone-50 active:scale-[0.99]"
    >
      <WalletLogo wallet={wallet} />
      <span className="min-w-0 flex-1 text-[15px] font-medium tracking-tight text-stone-900">
        {wallet.label}
      </span>
      <ChevronRight />
    </button>
  );
}

export function PayInWalletSheet({ invoice, open, onClose }: SheetProps) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);

  const closingRef = useRef(false);
  const draggingRef = useRef(false);
  const dragStartY = useRef(0);
  const dragStartAt = useRef(0);
  const dragYRef = useRef(0);
  const pointerIdRef = useRef<number | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const ignoreClickRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setVisible(false);
      setClosing(false);
      closingRef.current = false;
      setDragY(0);
      setDragging(false);
      draggingRef.current = false;
      return;
    }
    setVisible(true);
    setClosing(false);
    closingRef.current = false;
    setDragY(0);
    dragYRef.current = 0;
  }, [open]);

  const finishClose = useCallback(() => {
    setVisible(false);
    setClosing(false);
    closingRef.current = false;
    setDragY(0);
    dragYRef.current = 0;
    setDragging(false);
    draggingRef.current = false;
    onClose();
  }, [onClose]);

  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    setDragging(false);
    draggingRef.current = false;
  }, []);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [visible, requestClose]);

  const onSheetTransitionEnd = (e: TransitionEvent<HTMLDivElement>) => {
    if (e.target !== sheetRef.current) return;
    if (e.propertyName !== "transform") return;
    if (closingRef.current) finishClose();
  };

  const endDrag = useCallback(() => {
    if (!draggingRef.current || closingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    pointerIdRef.current = null;

    const delta = dragYRef.current;
    const elapsed = Math.max(1, Date.now() - dragStartAt.current);
    const velocity = delta / elapsed;

    if (delta >= CLOSE_DISTANCE || velocity >= CLOSE_VELOCITY) {
      ignoreClickRef.current = true;
      requestClose();
      return;
    }
    setDragY(0);
    dragYRef.current = 0;
  }, [requestClose]);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (closingRef.current) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;

    // Let real button taps work; still allow drag from empty areas & rows via move threshold
    pointerIdRef.current = e.pointerId;
    dragStartY.current = e.clientY;
    dragStartAt.current = Date.now();
    dragYRef.current = 0;
    draggingRef.current = true;
    setDragging(true);
    ignoreClickRef.current = false;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || closingRef.current) return;
    if (pointerIdRef.current != null && e.pointerId !== pointerIdRef.current) return;

    const delta = Math.max(0, e.clientY - dragStartY.current);
    if (delta > 6) {
      ignoreClickRef.current = true;
      e.preventDefault();
    }
    dragYRef.current = delta;
    setDragY(delta);
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current != null && e.pointerId !== pointerIdRef.current) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    endDrag();
  };

  if (!mounted || !visible) return null;

  const sheetTransform = closing
    ? "translateY(110%)"
    : `translateY(${dragY}px)`;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-stone-900/45 transition-opacity duration-300"
        style={{
          opacity: closing ? 0 : Math.max(0.15, 1 - dragY / 280),
        }}
        onClick={requestClose}
      />

      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pay-wallet-title"
        className={`relative z-[1] w-full max-w-md touch-none select-none rounded-t-3xl bg-[#fdfdfe] shadow-2xl ring-1 ring-stone-200 ${
          dragging ? "" : "transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
        } ${!closing && dragY === 0 && !dragging ? "animate-slide-up" : ""}`}
        style={{ transform: sheetTransform }}
        onTransitionEnd={onSheetTransitionEnd}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="flex justify-center pt-3">
          <div className="h-1.5 w-12 rounded-full bg-stone-300/90" />
        </div>

        <div className="px-5 pb-2 pt-5 text-center">
          <h3
            id="pay-wallet-title"
            className="text-xl font-semibold tracking-tight text-stone-900"
          >
            Pay in Wallet
          </h3>
          <p className="mt-1 text-sm text-stone-500">Choose your Lightning wallet</p>
        </div>

        <div
          className="px-2 pb-2 pt-1"
          onClickCapture={(e) => {
            if (ignoreClickRef.current || dragYRef.current > 8) {
              e.preventDefault();
              e.stopPropagation();
              ignoreClickRef.current = false;
            }
          }}
        >
          {PAY_SHEET_WALLETS.map((wallet) => (
            <WalletRow
              key={wallet.id}
              wallet={wallet}
              onClick={() => {
                if (ignoreClickRef.current || dragYRef.current > 8) return;
                openInWallet(invoice, wallet);
                requestClose();
              }}
            />
          ))}
        </div>

        <div className="mx-5 border-t border-stone-100" />

        <div className="px-2 pb-6 pt-2">
          <button
            type="button"
            onClick={() => {
              if (ignoreClickRef.current || dragYRef.current > 8) return;
              openWalletUri(genericLightningUri(invoice));
              requestClose();
            }}
            className="tap-none flex w-full items-center gap-3.5 rounded-2xl px-3 py-3 text-left transition hover:bg-stone-50 active:scale-[0.99]"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-stone-200/80 bg-gradient-to-br from-white to-stone-100 shadow-sm">
              <svg
                className="h-5 w-5 text-stone-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.75}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                />
              </svg>
            </div>
            <span className="min-w-0 flex-1 text-[15px] font-medium tracking-tight text-stone-900">
              Open in Lightning Wallet
            </span>
            <ChevronRight />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function PayInWalletButton({ invoice }: { invoice: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="tap-none flex w-full max-w-xs items-center justify-center gap-2 rounded-[16px] bg-gradient-to-b from-[#d4b56a] to-accent-deep px-5 py-3.5 text-sm font-semibold text-white transition hover:brightness-105 active:scale-[0.97]"
        style={{
          boxShadow:
            "0 1px 0 rgb(255 255 255 / 0.3) inset, 0 12px 28px -10px rgb(148 112 52 / 0.4)",
        }}
      >
        <svg
          className="h-4 w-4 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
          />
        </svg>
        Pay in wallet
      </button>

      <PayInWalletSheet invoice={invoice} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
