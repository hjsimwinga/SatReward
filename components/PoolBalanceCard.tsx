"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { QRDisplay } from "@/components/QRDisplay";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { apiPath } from "@/lib/apiPath";

const POOL_POLL_MS = 60_000;
const DONATE_POLL_MS = 3000;
const PRESETS = [100, 500, 1000, 5000, 10000] as const;

type DeltaFlash = {
  id: number;
  amount: number;
  dir: "up" | "down";
};

function SkeletonLine({ className }: { className: string }) {
  return <div className={`skeleton-shimmer rounded-lg bg-slate-100/90 ${className}`} />;
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 text-mute transition-transform duration-300 ease-out ${
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

function SatsPad({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

  function press(key: string) {
    if (disabled) return;
    if (key === "⌫") {
      onChange(value.slice(0, -1));
      return;
    }
    if (value === "0") {
      onChange(key);
      return;
    }
    if (value.length >= 8) return;
    onChange(value + key);
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-5 gap-2">
        {keys.map((k) => (
          <button
            key={k}
            type="button"
            disabled={disabled}
            onClick={() => press(k)}
            className="tap-none flex h-12 items-center justify-center rounded-2xl bg-gradient-to-b from-white to-[#f7f5f1] text-lg font-semibold text-ink shadow-[0_1px_0_rgb(255_255_255)_inset,0_1px_2px_rgb(15_23_42/0.04)] ring-1 ring-line/80 transition duration-150 hover:from-white hover:to-[#faf8f4] hover:ring-gold/25 active:scale-[0.96] disabled:opacity-40"
          >
            {k}
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => press("⌫")}
        className="tap-none flex h-11 w-full items-center justify-center rounded-2xl bg-gradient-to-b from-[#faf8f4] to-[#f0eeea] text-mute shadow-[0_1px_0_rgb(255_255_255)_inset] ring-1 ring-line/80 transition hover:text-ink-soft active:scale-[0.98] disabled:opacity-40"
        aria-label="Delete"
      >
        <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M9.5 6.5H19a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9.5L4.2 12.9a1.5 1.5 0 0 1 0-1.8L9.5 6.5Z"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinejoin="round"
          />
          <path
            d="m12.5 10 4 4m0-4-4 4"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}

function invoiceErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const msg = err.response?.data?.error;
    if (typeof msg === "string" && msg.trim()) return msg;
  }
  return "Could not create invoice";
}

type Props = {
  refreshToken?: number;
  spendSats?: number | null;
};

export function PoolBalanceCard({ refreshToken = 0, spendSats = null }: Props) {
  const [sats, setSats] = useState<number | null>(null);
  const [zmw, setZmw] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [mood, setMood] = useState<"idle" | "up" | "down">("idle");
  const [deltas, setDeltas] = useState<DeltaFlash[]>([]);
  const [rippleKey, setRippleKey] = useState(0);

  const [donateOpen, setDonateOpen] = useState(false);
  const [amountSats, setAmountSats] = useState("");
  const [invoice, setInvoice] = useState<string | null>(null);
  const [invoiceSats, setInvoiceSats] = useState<number | null>(null);
  const [donateErr, setDonateErr] = useState<string | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [donated, setDonated] = useState(false);
  const [zmwPerSat, setZmwPerSat] = useState<number | null>(null);
  const [minDonationSats, setMinDonationSats] = useState(1);

  const lastSatsRef = useRef<number | null>(null);
  const donateBaselineRef = useRef<number | null>(null);
  const awaitingPaymentRef = useRef(false);
  const lastSpendTokenRef = useRef(0);
  const rateRef = useRef<number | null>(null);
  const ignoreAboveRef = useRef<number | null>(null);
  const deltaIdRef = useRef(0);

  const parsedSats = useMemo(() => {
    const n = parseInt(amountSats, 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [amountSats]);

  const zmwPreview = useMemo(() => {
    if (!zmwPerSat || parsedSats <= 0) return null;
    return parsedSats * zmwPerSat;
  }, [parsedSats, zmwPerSat]);

  const belowMin = parsedSats > 0 && parsedSats < minDonationSats;

  const pushDelta = useCallback((amount: number, dir: "up" | "down") => {
    const id = ++deltaIdRef.current;
    setDeltas((prev) => [...prev.slice(-2), { id, amount, dir }]);
    window.setTimeout(() => {
      setDeltas((prev) => prev.filter((d) => d.id !== id));
    }, 1600);
  }, []);

  const applyBalance = useCallback(
    (nextSats: number | null, nextZmw: number | null, fromApi = false) => {
      if (nextSats == null) return;

      if (fromApi && ignoreAboveRef.current != null) {
        if (nextSats > ignoreAboveRef.current) return;
        ignoreAboveRef.current = null;
      }

      const prev = lastSatsRef.current;
      if (prev != null && nextSats !== prev) {
        const dir = nextSats > prev ? "up" : "down";
        const diff = Math.abs(nextSats - prev);
        setMood(dir);
        setRippleKey((k) => k + 1);
        pushDelta(diff, dir);

        if (
          dir === "up" &&
          awaitingPaymentRef.current &&
          donateBaselineRef.current != null &&
          nextSats > donateBaselineRef.current
        ) {
          setDonated(true);
          awaitingPaymentRef.current = false;
          setInvoice(null);
          setInvoiceSats(null);
          donateBaselineRef.current = nextSats;
        }

        window.setTimeout(() => setMood("idle"), 1400);
      }

      lastSatsRef.current = nextSats;
      setSats(nextSats);
      if (nextZmw != null) setZmw(nextZmw);
    },
    [pushDelta]
  );

  const loadBalance = useCallback(async () => {
    try {
      const res = await axios.get(apiPath("/api/pool/balance"));
      if (res.data?.ok) {
        applyBalance(res.data.sats ?? null, res.data.zmw ?? null, true);
      }
    } catch {
      /* keep last values */
    } finally {
      setLoading(false);
    }
  }, [applyBalance]);

  useEffect(() => {
    void loadBalance();
    const id = window.setInterval(() => void loadBalance(), POOL_POLL_MS);
    return () => window.clearInterval(id);
  }, [loadBalance]);

  useEffect(() => {
    axios
      .get(apiPath("/api/rate/zmw"))
      .then((res) => {
        if (res.data?.ok) {
          setZmwPerSat(res.data.zmwPerSat ?? null);
          if (typeof res.data.minDonationSats === "number" && res.data.minDonationSats > 0) {
            setMinDonationSats(res.data.minDonationSats);
          }
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!donateOpen) return;
    void loadBalance();
    const id = window.setInterval(() => void loadBalance(), DONATE_POLL_MS);
    return () => window.clearInterval(id);
  }, [donateOpen, loadBalance]);

  useEffect(() => {
    if (!refreshToken || refreshToken === lastSpendTokenRef.current) return;
    lastSpendTokenRef.current = refreshToken;

    if (spendSats != null && spendSats > 0 && lastSatsRef.current != null) {
      const next = Math.max(0, lastSatsRef.current - spendSats);
      const rate =
        rateRef.current ?? (zmw != null && sats != null && sats > 0 ? zmw / sats : null);
      const nextZmw = rate != null ? next * rate : zmw;
      ignoreAboveRef.current = next;
      applyBalance(next, nextZmw, false);
    }

    void loadBalance();
    const t1 = window.setTimeout(() => void loadBalance(), 800);
    const t2 = window.setTimeout(() => void loadBalance(), 2500);
    const t3 = window.setTimeout(() => void loadBalance(), 6000);
    const clearIgnore = window.setTimeout(() => {
      ignoreAboveRef.current = null;
      void loadBalance();
    }, 12000);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      window.clearTimeout(clearIgnore);
    };
  }, [refreshToken, spendSats, applyBalance, loadBalance, sats, zmw]);

  useEffect(() => {
    rateRef.current = zmwPerSat;
  }, [zmwPerSat]);

  useEffect(() => {
    if (zmw != null && sats != null && sats > 0) {
      rateRef.current = zmw / sats;
    }
  }, [zmw, sats]);

  useEffect(() => {
    if (!donateOpen) {
      setInvoice(null);
      setInvoiceSats(null);
      setDonateErr(null);
      setDonated(false);
      setAmountSats("");
      setInvoiceLoading(false);
      donateBaselineRef.current = null;
      awaitingPaymentRef.current = false;
      return;
    }

    axios
      .get(apiPath("/api/rate/zmw"))
      .then((res) => {
        if (res.data?.ok) {
          setZmwPerSat(res.data.zmwPerSat ?? null);
          if (typeof res.data.minDonationSats === "number" && res.data.minDonationSats > 0) {
            setMinDonationSats(res.data.minDonationSats);
          }
        }
      })
      .catch(() => {});
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

  async function createInvoice() {
    if (parsedSats <= 0 || invoiceLoading) return;
    if (parsedSats < minDonationSats) {
      setDonateErr(`Minimum donation is ${minDonationSats.toLocaleString()} sats`);
      return;
    }

    setInvoiceLoading(true);
    setDonateErr(null);
    setDonated(false);
    setInvoice(null);
    setInvoiceSats(null);
    awaitingPaymentRef.current = false;

    try {
      const res = await axios.post(apiPath("/api/pool/donate-invoice"), {
        amountSats: parsedSats,
      });
      if (res.data?.ok) {
        setInvoice(res.data.paymentRequest ?? null);
        setInvoiceSats(res.data.amountSats ?? parsedSats);
        awaitingPaymentRef.current = true;
        if (sats != null) donateBaselineRef.current = sats;
      } else {
        setDonateErr(res.data?.error ?? "Could not create invoice");
      }
    } catch (err) {
      setDonateErr(invoiceErrorMessage(err));
    } finally {
      setInvoiceLoading(false);
    }
  }

  function resetToAmount() {
    setInvoice(null);
    setInvoiceSats(null);
    setDonateErr(null);
    awaitingPaymentRef.current = false;
  }

  function onAmountChange(next: string) {
    setAmountSats(next);
    setDonateErr(null);
    if (donated) setDonated(false);
  }

  const showSkeleton = loading && sats == null;
  const moodText =
    mood === "up" ? "text-rise" : mood === "down" ? "text-fall" : "text-ink";

  return (
    <div className="card-vault relative mb-6">
      <div className="vault-sheen pointer-events-none absolute -right-8 -top-12 h-40 w-40 rounded-full bg-gold/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-8 h-36 w-36 rounded-full bg-sky-200/30 blur-3xl" />
      <div
        key={rippleKey}
        className={`pointer-events-none absolute left-1/2 top-[38%] h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full ${
          mood === "up"
            ? "bg-rise/20 pool-ripple"
            : mood === "down"
              ? "bg-fall/20 pool-ripple"
              : "opacity-0"
        }`}
      />

      <div className="relative px-6 pb-5 pt-6 text-center">
        <p className="label-quiet">Reward pool</p>

        {showSkeleton ? (
          <div className="mt-4 flex flex-col items-center gap-2.5 py-1">
            <SkeletonLine className="h-12 w-52" />
            <SkeletonLine className="h-4 w-28" />
          </div>
        ) : (
          <div className="relative mt-3">
            <div className="pointer-events-none absolute inset-x-0 -top-2 flex justify-center">
              {deltas.map((d) => (
                <span
                  key={d.id}
                  className={`pool-delta absolute text-[13px] font-semibold tabular-nums tracking-tight ${
                    d.dir === "up" ? "text-rise" : "text-fall"
                  }`}
                >
                  {d.dir === "up" ? "+" : "−"}
                  {d.amount.toLocaleString()}
                </span>
              ))}
            </div>

            <p
              className={`font-display text-[3.35rem] leading-none tnum transition-colors duration-500 ${moodText}`}
            >
              <AnimatedNumber value={sats ?? 0} durationMs={mood === "idle" ? 350 : 1350} />
            </p>
            <p className="mt-2.5 text-[13px] font-semibold tracking-[0.08em] text-mute">SATS</p>

            {zmw != null && (
              <p className="mt-3 text-sm tabular-nums text-mute transition-opacity duration-500">
                ≈ K{zmw.toFixed(2)}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="relative border-t border-line-soft">
        <button
          type="button"
          onClick={() => setDonateOpen((o) => !o)}
          className="tap-none flex w-full items-center justify-between px-6 py-4 text-left transition-colors hover:bg-gold/[0.04] active:bg-gold/[0.06]"
        >
          <span className="text-sm font-semibold text-ink-soft">Donate to the pool</span>
          <ChevronIcon open={donateOpen} />
        </button>

        <div
          className={`grid transition-all duration-300 ease-out ${
            donateOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="overflow-hidden">
            <div className="relative overflow-hidden border-t border-line-soft px-4 pb-5 pt-5 sm:px-5">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgb(255_248_230/0.85),transparent_55%),linear-gradient(180deg,#fbfaf7_0%,#f6f4ef_55%,#f3f5f9_100%)]" />
              <div className="pointer-events-none absolute -right-10 top-0 h-28 w-28 rounded-full bg-gold/15 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-12 -left-8 h-24 w-24 rounded-full bg-sky-200/25 blur-3xl" />

              <div className="relative">
                {donated && !invoice && (
                  <p className="mb-4 animate-fade-in rounded-2xl bg-rise/10 px-3 py-2.5 text-center text-xs font-medium text-rise ring-1 ring-rise/15">
                    Thank you. Your gift arrived.
                  </p>
                )}

                {!invoice ? (
                  <div className="animate-fade-in space-y-4">
                    <div className="relative overflow-hidden rounded-[22px] px-4 py-5 text-center shadow-[0_1px_0_rgb(255_255_255)_inset,0_8px_24px_-12px_rgb(15_23_42/0.12)] ring-1 ring-line/90">
                      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_80%_at_50%_0%,rgb(255_250_235/0.95),transparent_60%),linear-gradient(165deg,#ffffff_0%,#faf8f4_50%,#f4f6fa_100%)]" />
                      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent" />
                      <div className="relative">
                        <p className="label-quiet">Your gift</p>
                        <div className="mt-2 flex items-baseline justify-center gap-2">
                          <p className="font-display text-[2.75rem] leading-none tabular-nums tracking-tight text-ink">
                            {parsedSats > 0 ? parsedSats.toLocaleString() : "0"}
                          </p>
                          <span className="text-[13px] font-semibold tracking-[0.06em] text-mute">
                            sats
                          </span>
                        </div>
                        {zmwPreview != null && (
                          <p className="mt-2 text-sm tabular-nums text-mute">
                            ≈ K{zmwPreview.toFixed(2)}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap justify-center gap-2">
                      {PRESETS.map((n) => {
                        const active = parsedSats === n;
                        return (
                          <button
                            key={n}
                            type="button"
                            disabled={invoiceLoading}
                            onClick={() => onAmountChange(String(n))}
                            className={`tap-none rounded-xl px-3.5 py-2 text-xs font-semibold transition active:scale-[0.97] disabled:opacity-40 ${
                              active
                                ? "bg-gradient-to-b from-[#d4b56a] to-accent-deep text-white shadow-[0_1px_0_rgb(255_255_255/0.25)_inset,0_6px_14px_-6px_rgb(148_112_52/0.5)]"
                                : "bg-gradient-to-b from-white to-[#f7f5f1] text-ink-soft shadow-[0_1px_0_rgb(255_255_255)_inset] ring-1 ring-line/80 hover:ring-gold/30"
                            }`}
                          >
                            {n.toLocaleString()}
                          </button>
                        );
                      })}
                    </div>

                    <SatsPad
                      value={amountSats}
                      onChange={onAmountChange}
                      disabled={invoiceLoading}
                    />

                    {(donateErr || belowMin) && (
                      <p className="rounded-xl bg-red-50 px-3 py-2 text-center text-sm text-red-600 ring-1 ring-red-100">
                        {donateErr ??
                          `Minimum donation is ${minDonationSats.toLocaleString()} sats`}
                      </p>
                    )}

                    <button
                      type="button"
                      disabled={invoiceLoading || parsedSats <= 0 || belowMin}
                      onClick={() => void createInvoice()}
                      className="btn-primary"
                    >
                      {invoiceLoading ? "Creating invoice…" : "Create invoice"}
                    </button>
                  </div>
                ) : (
                  <div className="animate-fade-in flex flex-col items-center gap-3.5">
                    <div className="relative w-full text-center">
                      <p className="label-quiet">Scan to donate</p>
                      <div className="mt-1.5 flex items-center justify-center gap-2.5">
                        <p className="font-display text-[1.85rem] tabular-nums text-ink">
                          {(invoiceSats ?? parsedSats).toLocaleString()}{" "}
                          <span className="font-sans text-sm font-medium text-mute">sats</span>
                        </p>
                        <button
                          type="button"
                          onClick={resetToAmount}
                          aria-label="Change amount"
                          className="tap-none group relative flex h-9 w-9 items-center justify-center rounded-[12px] bg-gradient-to-b from-white to-[#f4f2ee] text-mute shadow-[0_1px_0_rgb(255_255_255)_inset,0_4px_12px_-6px_rgb(15_23_42/0.18)] ring-1 ring-line/80 transition duration-200 hover:text-accent hover:ring-gold/35 active:scale-90"
                        >
                          <span className="pointer-events-none absolute inset-0 rounded-[12px] bg-gold/0 transition group-hover:bg-gold/[0.06] group-active:bg-gold/10" />
                          <svg
                            className="relative h-[15px] w-[15px] transition duration-200 group-hover:scale-110 group-active:scale-95"
                            viewBox="0 0 24 24"
                            fill="none"
                            aria-hidden
                          >
                            <path
                              d="M4.5 19.5 9 18l9.4-9.4a2.1 2.1 0 0 0 0-3L16.4 3.6a2.1 2.1 0 0 0-3 0L4 13l-1.5 5.5Z"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinejoin="round"
                            />
                            <path
                              d="m12.8 5.2 4 4"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>

                    <QRDisplay value={invoice} size={300} copyOnTap />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
