"use client";

import { useEffect, useState } from "react";
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
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/45 p-0 sm:items-end">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pay-wallet-title"
        className="relative w-full max-w-md animate-slide-up rounded-t-3xl bg-[#fdfdfe] shadow-2xl ring-1 ring-stone-200"
      >
        <div className="flex justify-center pt-3">
          <div className="h-1 w-11 rounded-full bg-stone-300/80" />
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

        <div className="scroll-premium max-h-[min(52vh,420px)] overflow-y-auto px-2 pb-2 pt-1">
          {PAY_SHEET_WALLETS.map((wallet) => (
            <WalletRow
              key={wallet.id}
              wallet={wallet}
              onClick={() => {
                openInWallet(invoice, wallet);
                onClose();
              }}
            />
          ))}
        </div>

        <div className="mx-5 border-t border-stone-100" />

        <div className="px-2 pb-6 pt-2">
          <button
            type="button"
            onClick={() => {
              openWalletUri(genericLightningUri(invoice));
              onClose();
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
    </div>
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
