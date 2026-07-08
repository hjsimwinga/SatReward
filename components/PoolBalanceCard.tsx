"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { QRDisplay } from "@/components/QRDisplay";
import { apiPath } from "@/lib/apiPath";

const POOL_POLL_MS = 60_000;
const DONATE_POLL_MS = 3000;

function SkeletonLine({ className }: { className: string }) {
  return <div className={`skeleton-shimmer rounded-lg bg-stone-100 ${className}`} />;
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 transition-transform duration-300 ease-out ${
        open ? "rotate-180" : "rotate-0"
      }`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

export function PoolBalanceCard() {
  const [sats, setSats] = useState<number | null>(null);
  const [zmw, setZmw] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [balancePulse, setBalancePulse] = useState(false);

  const [donateOpen, setDonateOpen] = useState(false);
  const [invoice, setInvoice] = useState<string | null>(null);
  const [donateErr, setDonateErr] = useState<string | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [donated, setDonated] = useState(false);

  const lastSatsRef = useRef<number | null>(null);
  const donateBaselineRef = useRef<number | null>(null);

  const loadBalance = useCallback(async () => {
    try {
      const res = await axios.get(apiPath("/api/pool/balance"));
      if (res.data?.ok) {
        const nextSats = res.data.sats ?? null;
        const nextZmw = res.data.zmw ?? null;

        if (
          lastSatsRef.current != null &&
          nextSats != null &&
          nextSats > lastSatsRef.current
        ) {
          setBalancePulse(true);
          if (
            donateBaselineRef.current != null &&
            nextSats > donateBaselineRef.current
          ) {
            setDonated(true);
            donateBaselineRef.current = nextSats;
          }
          window.setTimeout(() => setBalancePulse(false), 1200);
        }

        if (nextSats != null) {
          lastSatsRef.current = Math.max(lastSatsRef.current ?? nextSats, nextSats);
        }
        setSats(nextSats);
        setZmw(nextZmw);
      }
    } catch {
      /* keep last values */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBalance();
    const id = window.setInterval(() => void loadBalance(), POOL_POLL_MS);
    return () => window.clearInterval(id);
  }, [loadBalance]);

  useEffect(() => {
    if (!donateOpen) return;
    void loadBalance();
    const id = window.setInterval(() => void loadBalance(), DONATE_POLL_MS);
    return () => window.clearInterval(id);
  }, [donateOpen, loadBalance]);

  useEffect(() => {
    if (!donateOpen) {
      setInvoice(null);
      setDonateErr(null);
      setDonated(false);
      donateBaselineRef.current = null;
      return;
    }

    let cancelled = false;
    setInvoiceLoading(true);
    setDonateErr(null);
    setInvoice(null);
    setDonated(false);

    axios
      .post(apiPath("/api/pool/donate-invoice"))
      .then((res) => {
        if (cancelled) return;
        if (res.data?.ok) {
          setInvoice(res.data.paymentRequest ?? null);
        } else {
          setDonateErr(res.data?.error ?? "Could not create invoice");
        }
      })
      .catch(() => {
        if (!cancelled) setDonateErr("Could not create invoice");
      })
      .finally(() => {
        if (!cancelled) setInvoiceLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [donateOpen]);

  useEffect(() => {
    if (!donateOpen) {
      donateBaselineRef.current = null;
      return;
    }
    if (donateBaselineRef.current == null && sats != null) {
      donateBaselineRef.current = sats;
    }
  }, [donateOpen, sats]);

  const showSkeleton = loading && sats == null;

  return (
    <div className="mb-4 overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-stone-100">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-1.5">
        <p className="text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-100">
          Reward pool
        </p>
      </div>

      <div className="px-4 py-3 text-center">
        {showSkeleton ? (
          <div className="flex flex-col items-center gap-2 py-0.5">
            <SkeletonLine className="h-8 w-44" />
            <SkeletonLine className="h-4 w-28" />
          </div>
        ) : (
          <>
            <p
              className={`text-2xl font-bold text-stone-900 tabular-nums transition-all duration-300 ${
                balancePulse ? "scale-105 text-blue-600" : ""
              }`}
            >
              {(sats ?? 0).toLocaleString()} sats
            </p>
            {zmw != null && (
              <p className="mt-0.5 text-sm text-stone-500 tabular-nums">≈ K{zmw.toFixed(2)}</p>
            )}
          </>
        )}
      </div>

      <div className="border-t border-stone-100">
        <button
          type="button"
          onClick={() => setDonateOpen((o) => !o)}
          className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-blue-50/50 active:bg-blue-50"
        >
          <span className="text-xs font-semibold text-stone-700">Donate to the pool</span>
          <ChevronIcon open={donateOpen} />
        </button>

        <div
          className={`grid transition-all duration-300 ease-out ${
            donateOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="overflow-hidden">
            <div className="border-t border-stone-50 bg-gradient-to-b from-blue-50/60 to-white px-4 pb-4 pt-3 text-center">
              <p className="text-xs text-stone-500">Scan and choose any amount</p>

              {donated && (
                <p className="mt-2 animate-fade-in text-xs font-semibold text-green-600">
                  Thank you! Donation received.
                </p>
              )}

              {donateErr && <p className="mt-3 text-sm text-red-600">{donateErr}</p>}

              {invoice && !donateErr && (
                <div className="mt-3 flex flex-col items-center gap-3 animate-fade-in">
                  <QRDisplay value={invoice} size={168} copyOnTap />
                </div>
              )}

              {invoiceLoading && !donateErr && (
                <div className="flex justify-center py-6">
                  <div className="h-7 w-7 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
