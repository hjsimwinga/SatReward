"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { QRDisplay } from "@/components/QRDisplay";
import { MerchantPicker, type MerchantOption } from "@/components/MerchantPicker";
import { MerchantQrScanButton } from "@/components/MerchantQrScanner";
import { AmountInput } from "@/components/AmountInput";
import { LightningAddressInput } from "@/components/LightningAddressInput";
import { PoolBalanceCard } from "@/components/PoolBalanceCard";
import { AboutSatReward } from "@/components/AboutSatReward";
import { BackButton } from "@/components/BackButton";
import { PayInWalletButton } from "@/components/PayInWalletSheet";
import { RewardLoading } from "@/components/RewardLoading";
import {
  getRecentRewardAddresses,
  saveRecentRewardAddress,
} from "@/lib/recentRewardAddresses";
import { apiPath } from "@/lib/apiPath";

type Step = "address" | "merchant" | "pay" | "done";
type RewardState = "loading" | "sent" | "skipped" | "failed";

const POLL_MS = 2500;
const REWARD_POLL_MS = 2000;
const STEPS: Step[] = ["address", "merchant", "pay"];

function StepDots({ step }: { step: Step }) {
  if (step === "done") return null;
  const idx = STEPS.indexOf(step);
  return (
    <div className="mb-5 flex items-center justify-center gap-2.5" aria-hidden>
      {STEPS.map((s, i) => (
        <div
          key={s}
          className={`h-1 rounded-full transition-all duration-500 ease-out ${
            i < idx
              ? "w-7 bg-gold/40"
              : i === idx
                ? "w-9 bg-gold"
                : "w-7 bg-line"
          }`}
        />
      ))}
    </div>
  );
}

function SuccessMark() {
  return (
    <div className="mx-auto flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-[20px] bg-gradient-to-b from-rise/15 to-rise/5 ring-1 ring-rise/20 shadow-[0_8px_24px_-12px_rgb(15_140_125_/_0.45)]">
      <svg
        className="h-8 w-8 text-rise"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </div>
  );
}

export default function HomePage() {
  const [merchants, setMerchants] = useState<MerchantOption[]>([]);
  const [recentAddresses, setRecentAddresses] = useState<string[]>([]);
  const [rewardAddress, setRewardAddress] = useState("");
  const [merchantAddress, setMerchantAddress] = useState<string | null>(null);
  const [merchantName, setMerchantName] = useState("");
  const [amountZmw, setAmountZmw] = useState("");
  const [step, setStep] = useState<Step>("address");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [pr, setPr] = useState<string | null>(null);
  const [paidAmount, setPaidAmount] = useState(0);
  const [paidZmw, setPaidZmw] = useState(0);

  const [rewardSats, setRewardSats] = useState(0);
  const [skippedReason, setSkippedReason] = useState<string | null>(null);
  const [rewardError, setRewardError] = useState<string | null>(null);
  const [rewardState, setRewardState] = useState<RewardState>("loading");
  const [poolRefreshToken, setPoolRefreshToken] = useState(0);
  const [poolSpendSats, setPoolSpendSats] = useState<number | null>(null);

  const paidRef = useRef(false);
  const poolSpendAppliedRef = useRef(false);

  useEffect(() => {
    const saved = getRecentRewardAddresses();
    if (saved[0]) setRewardAddress(saved[0]);
  }, []);

  useEffect(() => {
    axios
      .get(apiPath("/api/merchants"))
      .then((res) => {
        setMerchants((res.data?.merchants ?? []) as MerchantOption[]);
        setRecentAddresses((res.data?.recentAddresses ?? []) as string[]);
      })
      .catch(() => setErr("Could not load merchants"));
  }, []);

  const reset = useCallback(() => {
    setStep("address");
    setMerchantAddress(null);
    setMerchantName("");
    setAmountZmw("");
    setPaymentId(null);
    setPr(null);
    setErr(null);
    setRewardSats(0);
    setSkippedReason(null);
    setRewardError(null);
    setRewardState("loading");
    paidRef.current = false;
    poolSpendAppliedRef.current = false;
    setPoolSpendSats(null);
  }, []);

  function applyRewardPoll(d: Record<string, unknown>) {
    if (d.rewardSent) {
      const sent = Number(d.rewardSats ?? 0);
      setRewardSats(sent);
      setSkippedReason(null);
      setRewardError(null);
      setRewardState("sent");
      if (sent > 0 && !poolSpendAppliedRef.current) {
        poolSpendAppliedRef.current = true;
        setPoolSpendSats(sent);
        setPoolRefreshToken((n) => n + 1);
      }
      return;
    }
    if (d.rewardSkippedReason) {
      setSkippedReason(String(d.rewardSkippedReason));
      setRewardError(null);
      setRewardState("skipped");
      return;
    }
    if (d.rewardError) {
      setRewardError(String(d.rewardError));
      setRewardState("failed");
      return;
    }
    setRewardState("loading");
  }

  function pickMerchant(address: string) {
    const m = merchants.find(
      (x) => x.lightningAddress.toLowerCase() === address.toLowerCase()
    );
    setMerchantAddress(m?.lightningAddress ?? address);
    setMerchantName(m?.name ?? "");
    setAmountZmw("");
    setPr(null);
    setPaymentId(null);
    setErr(null);
    setStep("pay");
  }

  function goToMerchants(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = rewardAddress.trim();
    if (!trimmed.includes("@")) {
      setErr("Enter a valid Lightning address");
      return;
    }
    saveRecentRewardAddress(trimmed);
    setErr(null);
    setStep("merchant");
  }

  async function createInvoice(e: React.FormEvent) {
    e.preventDefault();
    if (!merchantAddress) return;
    const zmw = parseFloat(amountZmw);
    if (!Number.isFinite(zmw) || zmw <= 0) {
      setErr("Enter an amount in Kwacha");
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const res = await axios.post(apiPath("/api/pay/invoice"), {
        rewardAddress: rewardAddress.trim(),
        merchantAddress,
        amountZmw: zmw,
      });
      if (!res.data?.ok) {
        setErr(res.data?.error ?? "Could not create invoice");
        return;
      }
      setPaymentId(res.data.paymentId);
      setPr(res.data.pr);
      setMerchantName(res.data.merchantName);
      setPaidAmount(res.data.amountSats);
      setPaidZmw(res.data.amountZmw ?? zmw);
    } catch (e: unknown) {
      const msg =
        axios.isAxiosError(e) && e.response?.data?.error
          ? String(e.response.data.error)
          : "Could not create invoice";
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (step !== "pay" || !paymentId || !pr) return;

    const poll = async () => {
      try {
        const res = await axios.post(apiPath("/api/pay/poll"), { paymentId });
        const d = res.data;
        if (d?.status === "paid" && !paidRef.current) {
          paidRef.current = true;
          applyRewardPoll(d);
          setStep("done");
        } else if (d?.status === "paid" && paidRef.current && rewardState === "loading") {
          applyRewardPoll(d);
        } else if (d?.status === "expired") {
          setErr("Invoice expired. Try again.");
          setPr(null);
          setPaymentId(null);
        }
      } catch {
        /* keep polling */
      }
    };

    void poll();
    const id = window.setInterval(() => void poll(), POLL_MS);
    return () => window.clearInterval(id);
  }, [step, paymentId, pr, rewardState]);

  useEffect(() => {
    if (step !== "done" || !paymentId || rewardState !== "loading") return;

    const pollReward = async () => {
      try {
        const res = await axios.post(apiPath("/api/pay/poll"), { paymentId });
        const d = res.data;
        if (d?.status === "paid") applyRewardPoll(d);
      } catch {
        /* keep polling */
      }
    };

    void pollReward();
    const id = window.setInterval(() => void pollReward(), REWARD_POLL_MS);
    return () => window.clearInterval(id);
  }, [step, paymentId, rewardState]);

  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-x-hidden px-4 py-10 pb-14">
      <div className="w-full max-w-[440px]">
        <header className="animate-soft-enter mb-8 text-center">
          <h1 className="font-display text-[3.25rem] leading-[0.95] text-ink">SatReward</h1>
          <p className="mt-3 text-[15px] font-medium text-mute">Spend sats. Get rewarded.</p>
        </header>

        <div className="animate-soft-enter-delay">
          <PoolBalanceCard refreshToken={poolRefreshToken} spendSats={poolSpendSats} />
        </div>

        <div className="animate-soft-enter-delay-2">
          <StepDots step={step} />

          <div className="card">
            {step !== "done" && (
              <div className="relative z-[1] px-6 pb-2 pt-6">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-gold/[0.08] to-transparent" />
                <p className="relative label-quiet text-center">Get sats back for spending</p>
              </div>
            )}

            {step === "address" && (
              <form onSubmit={goToMerchants} className="relative z-[1] px-6 py-6">
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-sky-100/30 to-transparent" />
                <label className="relative mb-2.5 flex items-center gap-2">
                  <svg
                    className="h-3.5 w-3.5 shrink-0 text-gold"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden
                  >
                    <path d="M13.2 2.1 5.4 13.4c-.25.36 0 .85.43.85h5.02l-1.2 7.4c-.1.62.7.98 1.12.5l8.1-11.1c.27-.37.01-.9-.44-.9h-5.2l1.35-7.55c.1-.58-.66-.93-1.08-.5Z" />
                  </svg>
                  <span className="text-[12px] font-semibold tracking-[0.04em] text-ink-soft">
                    Your Lightning address
                  </span>
                </label>
                <div className="relative">
                  <LightningAddressInput value={rewardAddress} onChange={setRewardAddress} />
                </div>

                {err && (
                  <p className="relative mt-4 rounded-[14px] bg-red-50 px-3.5 py-2.5 text-center text-sm text-red-700 ring-1 ring-red-100">
                    {err}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={!rewardAddress.trim()}
                  className="btn-primary relative mt-7"
                >
                  Continue
                </button>
              </form>
            )}

            {step === "merchant" && (
              <div className="relative z-[1] px-6 pb-6 pt-3">
                <div className="mb-4 flex items-center justify-between">
                  <BackButton onClick={() => setStep("address")} />
                  <MerchantQrScanButton merchants={merchants} onMatch={pickMerchant} />
                </div>
                <MerchantPicker
                  merchants={merchants}
                  recentAddresses={recentAddresses}
                  selected={null}
                  onSelect={pickMerchant}
                />
              </div>
            )}

            {step === "pay" && (
              <div className="relative z-[1] px-6 pb-6 pt-3">
                <BackButton
                  onClick={() => {
                    setPr(null);
                    setPaymentId(null);
                    setErr(null);
                    setStep("merchant");
                  }}
                />

                <p className="mb-5 text-center text-sm font-medium text-mute">
                  Paying <span className="font-semibold text-ink">{merchantName}</span>
                </p>

                {!pr ? (
                  <form onSubmit={(e) => void createInvoice(e)}>
                    <AmountInput value={amountZmw} onChange={setAmountZmw} disabled={loading} />
                    {err && (
                      <p className="mt-4 rounded-[14px] bg-red-50 px-3.5 py-2.5 text-center text-sm text-red-700 ring-1 ring-red-100">
                        {err}
                      </p>
                    )}
                    <button
                      type="submit"
                      disabled={loading || !amountZmw || parseFloat(amountZmw) <= 0}
                      className="btn-primary mt-6"
                    >
                      {loading ? "Creating invoice…" : "Get invoice"}
                    </button>
                  </form>
                ) : (
                  <div className="flex flex-col items-center space-y-5 animate-fade-in">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-2.5">
                        <p className="font-display text-[2.85rem] leading-none text-ink tnum">
                          K{paidZmw.toFixed(2)}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setPr(null);
                            setPaymentId(null);
                            setErr(null);
                            paidRef.current = false;
                          }}
                          aria-label="Change amount"
                          className="tap-none group relative flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-gradient-to-b from-white to-[#f4f2ee] text-mute shadow-[0_1px_0_rgb(255_255_255)_inset,0_4px_12px_-6px_rgb(15_23_42/0.18)] ring-1 ring-line/80 transition duration-200 hover:text-accent hover:ring-gold/35 active:scale-90"
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
                      <p className="mt-2 text-sm text-mute tnum">
                        {paidAmount.toLocaleString()} sats
                      </p>
                    </div>
                    <QRDisplay value={pr} copyOnTap />
                    <PayInWalletButton invoice={pr} />
                    <p className="text-xs font-medium text-mute">Open your wallet and scan</p>
                  </div>
                )}
              </div>
            )}

            {step === "done" && (
              <div className="relative z-[1] space-y-5 px-6 py-9 text-center animate-fade-in">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-rise/[0.06] to-transparent" />
                <SuccessMark />

                <div className="relative">
                  <p className="font-display text-[2.15rem] text-ink">Payment done</p>
                  <p className="mt-2 text-sm text-mute">
                    {merchantName} received K{paidZmw.toFixed(2)}
                  </p>
                </div>

                {rewardState === "loading" && <RewardLoading address={rewardAddress} />}

                {rewardState === "sent" && (
                  <div className="relative animate-fade-in rounded-[18px] bg-gradient-to-b from-[#f2faf8] to-[#eef7f5] px-4 py-4 ring-1 ring-rise/15">
                    <p className="text-sm font-medium text-ink-soft">
                      {rewardSats.toLocaleString()} sats sent to
                    </p>
                    <p className="mt-1 truncate text-sm font-semibold text-ink">{rewardAddress}</p>
                  </div>
                )}

                {rewardState === "skipped" &&
                  (skippedReason === "already_claimed_merchant_today" ||
                    skippedReason === "already_claimed_today") && (
                  <div className="relative animate-fade-in rounded-[18px] bg-wash px-4 py-4 ring-1 ring-line">
                    <p className="text-sm text-mute">
                      <span className="font-semibold text-ink">{rewardAddress}</span> already got
                      a reward from this shop today.
                    </p>
                  </div>
                )}

                {rewardState === "skipped" && skippedReason === "merchant_daily_limit" && (
                  <div className="relative animate-fade-in overflow-hidden rounded-[18px] px-4 py-4 ring-1 ring-line/90">
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_70%_at_50%_0%,rgb(255_248_230/0.9),transparent_60%),linear-gradient(165deg,#ffffff_0%,#faf8f4_100%)]" />
                    <div className="relative text-center">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-mute">
                        Reward
                      </p>
                      <p className="mt-2 text-sm font-semibold text-ink">
                        This shop can’t trigger more rewards today.
                      </p>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-mute">
                        Try another shop.
                      </p>
                    </div>
                  </div>
                )}

                {rewardState === "skipped" && skippedReason === "below_min_spend" && (
                  <div className="relative animate-fade-in overflow-hidden rounded-[18px] px-4 py-4 ring-1 ring-line/90">
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_70%_at_50%_0%,rgb(255_248_230/0.9),transparent_60%),linear-gradient(165deg,#ffffff_0%,#faf8f4_100%)]" />
                    <div className="relative text-center">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-mute">
                        Reward
                      </p>
                      <p className="mt-2 text-sm font-semibold text-ink">Spend a bit more</p>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-mute">
                        Spend at least 1,000 sats to earn a reward.
                      </p>
                    </div>
                  </div>
                )}

                {rewardState === "skipped" && skippedReason === "pool_empty" && (
                  <div className="relative animate-fade-in overflow-hidden rounded-[18px] px-4 py-4 ring-1 ring-line/90">
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_70%_at_50%_0%,rgb(255_248_230/0.9),transparent_60%),linear-gradient(165deg,#ffffff_0%,#faf8f4_100%)]" />
                    <div className="relative text-center">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-mute">
                        Reward
                      </p>
                      <p className="mt-2 text-sm font-semibold text-ink">Reward pool is empty</p>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-mute">
                        No sats reward this time.
                        <br />
                        Come back later.
                      </p>
                    </div>
                  </div>
                )}

                {rewardState === "skipped" &&
                  skippedReason &&
                  skippedReason !== "already_claimed_merchant_today" &&
                  skippedReason !== "already_claimed_today" &&
                  skippedReason !== "merchant_daily_limit" &&
                  skippedReason !== "below_min_spend" &&
                  skippedReason !== "pool_empty" && (
                  <div className="relative animate-fade-in rounded-[18px] bg-wash px-4 py-4 ring-1 ring-line">
                    <p className="text-sm text-mute">No reward this time.</p>
                  </div>
                )}

                {rewardState === "failed" && rewardError && (
                  <div className="relative animate-fade-in overflow-hidden rounded-[18px] px-4 py-4 ring-1 ring-line/90">
                    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(165deg,#ffffff_0%,#faf8f4_100%)]" />
                    <div className="relative text-center">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-mute">
                        Reward
                      </p>
                      <p className="mt-2 text-sm font-semibold text-ink">Reward not sent yet</p>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-mute">
                        Come back later and try again.
                      </p>
                    </div>
                  </div>
                )}

                <button type="button" onClick={reset} className="btn-primary relative">
                  Start again
                </button>
              </div>
            )}
          </div>

          {step === "address" && <AboutSatReward />}
        </div>
      </div>
    </main>
  );
}
