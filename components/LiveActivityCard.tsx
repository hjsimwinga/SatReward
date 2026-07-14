"use client";

import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { apiPath } from "@/lib/apiPath";

const POLL_MS = 12_000;

type TodayStats = {
  payments: number;
  rewards: number;
  rewardSats: number;
};

type ActivityItem = {
  id: string;
  kind: "payment" | "reward";
  merchantName: string;
  amountSats: number;
  rewardSats: number | null;
  rewardSent: boolean;
  createdAt: string;
  addressHint: string;
};

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

function relativeTime(iso: string, nowMs: number): string {
  const diffSec = Math.max(0, Math.round((nowMs - new Date(iso).getTime()) / 1000));
  if (diffSec < 45) return "Just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

function ActivityIcon({ rewardSent }: { rewardSent: boolean }) {
  if (rewardSent) {
    return (
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-gradient-to-b from-rise/15 to-rise/5 text-rise ring-1 ring-rise/15 shadow-[0_4px_12px_-8px_rgb(15_140_125_/_0.45)]">
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M13.2 2.1 5.4 13.4c-.25.36 0 .85.43.85h5.02l-1.2 7.4c-.1.62.7.98 1.12.5l8.1-11.1c.27-.37.01-.9-.44-.9h-5.2l1.35-7.55c.1-.58-.66-.93-1.08-.5Z" />
        </svg>
      </span>
    );
  }

  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-gradient-to-b from-gold/20 to-gold/5 text-accent ring-1 ring-gold/20 shadow-[0_4px_12px_-8px_rgb(148_112_52_/_0.35)]">
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.9}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M7.5 7.5h9m-9 4.5h6M6 3.75h12A2.25 2.25 0 0 1 20.25 6v12A2.25 2.25 0 0 1 18 20.25H6A2.25 2.25 0 0 1 3.75 18V6A2.25 2.25 0 0 1 6 3.75Z"
        />
      </svg>
    </span>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5 rounded-full bg-gradient-to-b from-white/90 to-[#f7f5f1]/90 px-2.5 py-1 shadow-[0_1px_0_rgb(255_255_255)_inset] ring-1 ring-line/70">
      <span className="tnum text-[13px] font-semibold tracking-tight text-ink">{value}</span>
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-mute">
        {label}
      </span>
    </span>
  );
}

type Props = {
  refreshToken?: number;
};

export function LiveActivityCard({ refreshToken = 0 }: Props) {
  const [open, setOpen] = useState(false);
  const [today, setToday] = useState<TodayStats | null>(null);
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      const res = await axios.get(apiPath("/api/activity"));
      if (!res.data?.ok) return;

      setToday(res.data.today as TodayStats);
      setItems((res.data.items ?? []) as ActivityItem[]);
    } catch {
      /* keep last snapshot */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (!refreshToken) return;
    void load();
    const t1 = window.setTimeout(() => void load(), 900);
    const t2 = window.setTimeout(() => void load(), 2800);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [refreshToken, load]);

  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [open]);

  const payments = today?.payments ?? 0;
  const rewards = today?.rewards ?? 0;
  const rewardSats = today?.rewardSats ?? 0;

  return (
    <div className="card relative mb-6 overflow-hidden">
      <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-gold/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-12 -left-8 h-24 w-24 rounded-full bg-sky-200/20 blur-3xl" />

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="tap-none relative flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-gold/[0.035] active:bg-gold/[0.055]"
      >
        <div className="min-w-0 flex-1">
          <p className="mb-2.5 label-quiet">Recent activity</p>

          {loading && today == null ? (
            <div className="flex gap-2">
              <div className="skeleton-shimmer h-7 w-24 rounded-full bg-slate-100/90" />
              <div className="skeleton-shimmer h-7 w-28 rounded-full bg-slate-100/90" />
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <StatPill label="payments" value={payments.toLocaleString()} />
              <StatPill label="rewards" value={rewards.toLocaleString()} />
              {rewardSats > 0 && (
                <StatPill label="sats" value={rewardSats.toLocaleString()} />
              )}
            </div>
          )}
        </div>

        <ChevronIcon open={open} />
      </button>

      <div
        className={`grid transition-all duration-300 ease-out ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="relative border-t border-line-soft px-4 pb-4 pt-3 sm:px-5">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_55%_at_50%_0%,rgb(255_248_230/0.55),transparent_55%),linear-gradient(180deg,#fbfaf8_0%,#f5f6f9_100%)]" />

            <div className="relative space-y-2">
              {items.length === 0 ? (
                <div className="rounded-[18px] bg-white/70 px-4 py-5 text-center ring-1 ring-line/70">
                  <p className="text-sm font-medium text-ink-soft">No activity yet</p>
                  <p className="mt-1 text-xs text-mute">
                    Today&apos;s payments and rewards will appear here.
                  </p>
                </div>
              ) : (
                items.map((item, i) => (
                  <div
                    key={item.id}
                    className="animate-fade-in flex items-start gap-3 rounded-[18px] bg-gradient-to-b from-white to-[#faf8f4] px-3.5 py-3 shadow-[0_1px_0_rgb(255_255_255)_inset,0_6px_16px_-12px_rgb(15_23_42/0.14)] ring-1 ring-line/75"
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <ActivityIcon rewardSent={item.rewardSent} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-ink">
                          {item.merchantName}
                        </p>
                        <p className="shrink-0 text-[11px] font-medium text-mute">
                          {relativeTime(item.createdAt, nowMs)}
                        </p>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-mute">
                        {item.addressHint}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="tnum rounded-lg bg-wash px-2 py-0.5 text-[11px] font-semibold text-ink-soft ring-1 ring-line/60">
                          {item.amountSats.toLocaleString()} sats spent
                        </span>
                        {item.rewardSent && item.rewardSats != null && item.rewardSats > 0 && (
                          <span className="tnum rounded-lg bg-rise/10 px-2 py-0.5 text-[11px] font-semibold text-rise ring-1 ring-rise/15">
                            +{item.rewardSats.toLocaleString()} reward
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
