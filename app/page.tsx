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

type Step = "address" | "merchant" | "pay" | "done";

type RewardState = "loading" | "sent" | "skipped" | "failed";

const POLL_MS = 2500;
const REWARD_POLL_MS = 2000;
const STEPS: Step[] = ["address", "merchant", "pay"];

function StepDots({ step }: { step: Step }) {
  if (step === "done") return null;
  const idx = STEPS.indexOf(step);
  return (
    <div className="mb-4 flex justify-center gap-2">
      {STEPS.map((s, i) => (
        <div
          key={s}
          className={`h-1.5 rounded-full transition-all ${
            i <= idx ? "w-6 bg-blue-600" : "w-1.5 bg-stone-200"
          }`}
        />
      ))}
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

  const [rewardSent, setRewardSent] = useState(false);
  const [rewardSats, setRewardSats] = useState(0);
  const [skippedReason, setSkippedReason] = useState<string | null>(null);
  const [rewardError, setRewardError] = useState<string | null>(null);
  const [rewardState, setRewardState] = useState<RewardState>("loading");

  const paidRef = useRef(false);

  useEffect(() => {
    const saved = getRecentRewardAddresses();
    if (saved[0]) setRewardAddress(saved[0]);
  }, []);

  useEffect(() => {
    axios
      .get("/api/merchants")
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
    setRewardSent(false);
    setRewardSats(0);
    setSkippedReason(null);
    setRewardError(null);
    setRewardState("loading");
    paidRef.current = false;
  }, []);

  function applyRewardPoll(d: Record<string, unknown>) {
    if (d.rewardSent) {
      setRewardSent(true);
      setRewardSats(Number(d.rewardSats ?? 0));
      setSkippedReason(null);
      setRewardError(null);
      setRewardState("sent");
      return;
    }
    if (d.rewardSkippedReason) {
      setRewardSent(false);
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
      const res = await axios.post("/api/pay/invoice", {
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
        const res = await axios.post("/api/pay/poll", { paymentId });
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
        const res = await axios.post("/api/pay/poll", { paymentId });
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
    <main className="flex min-h-[100dvh] items-center justify-center overflow-x-hidden p-4 pb-8">
      <div className="w-full max-w-md animate-fade-in">
        <header className="mb-5 text-center">
          <p className="mb-3 text-4xl">⚡</p>
          <h1 className="text-3xl font-bold tracking-tight text-stone-900">SatReward</h1>
          <p className="mt-1 text-stone-500">Spend sats. Get rewarded.</p>
        </header>

        <PoolBalanceCard />

        <StepDots step={step} />

        <div className="overflow-hidden rounded-3xl bg-white shadow-xl shadow-stone-200/60 ring-1 ring-stone-100">
          {step === "address" && (
            <form onSubmit={goToMerchants} className="px-5 py-6">
              <label className="mb-2 block text-xs font-semibold text-stone-700">
                Your Lightning address
              </label>
              <LightningAddressInput value={rewardAddress} onChange={setRewardAddress} />
              <p className="mt-2 text-xs text-stone-400">Your sat reward is sent here</p>

              {err && (
                <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-center text-sm text-red-700">
                  {err}
                </p>
              )}

              <button
                type="submit"
                disabled={!rewardAddress.trim()}
                className="mt-6 w-full rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 py-4 text-lg font-semibold text-white shadow-lg shadow-blue-200/50 transition hover:from-blue-700 hover:to-blue-800 disabled:opacity-50"
              >
                Continue
              </button>
            </form>
          )}

          {step === "merchant" && (
            <div className="px-5 pb-6 pt-4">
              <BackButton onClick={() => setStep("address")} />
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-400">
                    Step 2
                  </p>
                  <h2 className="mt-1 text-xl font-semibold tracking-tight text-stone-900">
                    Choose merchant
                  </h2>
                </div>
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
            <div className="px-5 pb-6 pt-4">
              <BackButton
                onClick={() => {
                  setPr(null);
                  setPaymentId(null);
                  setErr(null);
                  setStep("merchant");
                }}
              />

              <div className="mb-5 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-400">
                  Step 3 · Pay this merchant
                </p>
                <p className="mt-1 text-xl font-semibold tracking-tight text-stone-900">
                  {merchantName}
                </p>
              </div>

              {!pr ? (
                <form onSubmit={(e) => void createInvoice(e)}>
                  <AmountInput
                    value={amountZmw}
                    onChange={setAmountZmw}
                    disabled={loading}
                  />
                  {err && (
                    <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-center text-sm text-red-700">
                      {err}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={
                      loading || !amountZmw || parseFloat(amountZmw) <= 0
                    }
                    className="mt-5 w-full rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 py-4 text-lg font-semibold text-white shadow-lg shadow-blue-200/50 transition active:scale-[0.99] disabled:opacity-50"
                  >
                    {loading ? "Creating invoice…" : "Get invoice"}
                  </button>
                </form>
              ) : (
                <div className="flex flex-col items-center space-y-4">
                  <div className="text-center">
                    <p className="text-4xl font-bold text-stone-900">K{paidZmw.toFixed(2)}</p>
                    <p className="mt-1 text-sm text-stone-500">
                      {paidAmount.toLocaleString()} sats
                    </p>
                  </div>
                  <QRDisplay value={pr} copyOnTap />
                  <PayInWalletButton invoice={pr} />
                </div>
              )}
            </div>
          )}

          {step === "done" && (
            <div className="space-y-4 px-5 py-6 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl">
                ✅
              </div>

              <div>
                <p className="text-lg font-semibold text-stone-900">Payment successful!</p>
                <p className="mt-1 text-sm text-stone-500">
                  {merchantName} received K{paidZmw.toFixed(2)}
                </p>
              </div>

              {rewardState === "loading" && (
                <RewardLoading address={rewardAddress} />
              )}

              {rewardState === "sent" && (
                <div className="animate-fade-in rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100/80 px-4 py-3 ring-1 ring-blue-100">
                  <p className="text-sm font-medium text-stone-800">
                    🎁 {rewardSats.toLocaleString()} sats reward sent to
                  </p>
                  <p className="mt-1 text-sm font-semibold text-blue-600">{rewardAddress}</p>
                </div>
              )}

              {rewardState === "skipped" && skippedReason === "already_claimed_today" && (
                <div className="animate-fade-in rounded-2xl bg-stone-50 px-4 py-3 ring-1 ring-stone-100">
                  <p className="text-sm text-stone-600">
                    <span className="font-semibold text-stone-800">{rewardAddress}</span> already
                    received today&apos;s reward.
                  </p>
                </div>
              )}

              {rewardState === "failed" && rewardError && (
                <div className="animate-fade-in rounded-2xl bg-amber-50 px-4 py-3 ring-1 ring-amber-100">
                  <p className="text-sm text-amber-900">Reward pending: {rewardError}</p>
                </div>
              )}

              <button
                type="button"
                onClick={reset}
                className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 py-3.5 font-semibold text-white shadow-lg shadow-blue-200/50"
              >
                Start again
              </button>
            </div>
          )}
        </div>

        {step === "address" && <AboutSatReward />}
      </div>
    </main>
  );
}
