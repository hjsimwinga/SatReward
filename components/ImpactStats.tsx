"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { apiPath } from "@/lib/apiPath";

const POLL_MS = 60_000;

type PeriodStats = {
  payments: number;
  satsSpent: number;
  satsRewarded: number;
};

type MonthBucket = {
  month: string;
  payments: number;
  satsSpent: number;
};

type Props = {
  refreshToken?: number;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthLabel(yyyyMm: string): string {
  const y = yyyyMm.slice(0, 4);
  const m = Number(yyyyMm.slice(5, 7));
  if (!m || m < 1 || m > 12) return yyyyMm;
  return `${MONTHS[m - 1]} ${y}`;
}

function Metric({
  value,
  label,
  loading,
}: {
  value: number;
  label: string;
  loading: boolean;
}) {
  return (
    <div className="min-w-0 flex-1 text-center">
      {loading ? (
        <div className="skeleton-shimmer mx-auto h-7 w-16 rounded-md bg-slate-100/90" />
      ) : (
        <p className="tnum font-display text-[1.35rem] leading-none tracking-tight text-ink sm:text-[1.45rem]">
          <AnimatedNumber value={value} durationMs={700} />
        </p>
      )}
      <p className="mt-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-mute">
        {label}
      </p>
    </div>
  );
}

function Divider() {
  return (
    <div
      className="mx-1 h-8 w-px shrink-0 self-center bg-gradient-to-b from-transparent via-line to-transparent sm:mx-2"
      aria-hidden
    />
  );
}

function PaymentsByMonthChart({
  byMonth,
  loading,
}: {
  byMonth: MonthBucket[];
  loading: boolean;
}) {
  const [openMonth, setOpenMonth] = useState<string | null>(null);
  const max = useMemo(() => Math.max(0, ...byMonth.map((b) => b.payments)), [byMonth]);

  if (loading) {
    return <div className="skeleton-shimmer mt-5 h-[168px] w-full rounded-2xl bg-slate-100/90" />;
  }

  if (byMonth.length === 0 || max <= 0) {
    return (
      <div className="mt-5 flex h-[168px] items-center justify-center rounded-2xl bg-gradient-to-b from-[#fbfaf8] to-[#f5f6f9] ring-1 ring-line/70">
        <p className="text-xs font-medium text-mute">No payments yet</p>
      </div>
    );
  }

  return (
    <div className="relative mt-5 rounded-2xl bg-gradient-to-b from-[#fbfaf8] to-[#f4f5f8] ring-1 ring-line/75">
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl bg-[radial-gradient(ellipse_70%_80%_at_70%_20%,rgb(201_168_96/0.10),transparent_60%)]" />
      <div className="relative px-3.5 pb-3.5 pt-3.5">
        <div
          className="flex items-end justify-between gap-2 sm:gap-3"
          aria-label="Payments each month"
        >
          {byMonth.map((b) => {
            const h = Math.max(b.payments > 0 ? 12 : 4, Math.round((b.payments / max) * 72));
            const active = b.payments > 0;
            const showTip = openMonth === b.month;
            return (
              <div
                key={b.month}
                className="group relative flex min-w-0 flex-1 flex-col items-center"
                onMouseEnter={() => setOpenMonth(b.month)}
                onMouseLeave={() => setOpenMonth((m) => (m === b.month ? null : m))}
                onFocus={() => setOpenMonth(b.month)}
                onBlur={() => setOpenMonth((m) => (m === b.month ? null : m))}
              >
                <div
                  className={`pointer-events-none absolute bottom-[calc(100%-6px)] z-20 w-max max-w-[160px] -translate-y-1 px-1 transition duration-200 ${
                    showTip
                      ? "visible translate-y-0 opacity-100"
                      : "invisible opacity-0 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100"
                  }`}
                >
                  <div className="rounded-2xl bg-gradient-to-b from-white to-[#faf8f4] px-3.5 py-2.5 text-left shadow-[0_1px_0_rgb(255_255_255)_inset,0_12px_28px_-14px_rgb(15_23_42/0.35)] ring-1 ring-gold/20">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-mute">
                      {monthLabel(b.month)}
                    </p>
                    <div className="mt-1.5 space-y-1">
                      <p className="flex items-baseline justify-between gap-4 text-[12px]">
                        <span className="text-mute">Payments</span>
                        <span className="tnum font-semibold text-ink">{b.payments.toLocaleString()}</span>
                      </p>
                      <p className="flex items-baseline justify-between gap-4 text-[12px]">
                        <span className="text-mute">Sats spent</span>
                        <span className="tnum font-semibold text-ink">
                          {b.satsSpent.toLocaleString()}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  aria-label={`${monthLabel(b.month)}: ${b.payments} payments, ${b.satsSpent.toLocaleString()} sats spent`}
                  onClick={() =>
                    setOpenMonth((m) => (m === b.month ? null : b.month))
                  }
                  className="tap-none flex h-[72px] w-full items-end justify-center"
                >
                  <div
                    className={`w-full max-w-[36px] rounded-t-lg transition-all duration-300 ${
                      active
                        ? "bg-gradient-to-t from-accent-deep/90 to-gold shadow-[0_-4px_12px_-6px_rgb(148_112_52/0.45)] group-hover:brightness-105 group-hover:shadow-[0_-6px_16px_-6px_rgb(148_112_52/0.55)]"
                        : "bg-line/70"
                    }`}
                    style={{ height: `${h}px` }}
                  />
                </button>
                <p className="mt-2 text-[10px] font-medium tracking-wide text-mute">
                  {monthLabel(b.month)}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function ImpactStats({ refreshToken = 0 }: Props) {
  const [stats, setStats] = useState<PeriodStats | null>(null);
  const [byMonth, setByMonth] = useState<MonthBucket[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await axios.get(apiPath("/api/stats"));
      if (res.data?.ok) {
        setStats(res.data.allTime ?? null);
        setByMonth(res.data.byMonth ?? []);
      }
    } catch {
      /* keep last */
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
  }, [refreshToken, load]);

  const showSkeleton = loading && stats == null;

  return (
    <section className="card relative mb-0">
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
        <div className="absolute -right-10 -top-12 h-32 w-32 rounded-full bg-gold/15 blur-3xl" />
        <div className="absolute -bottom-14 -left-10 h-28 w-28 rounded-full bg-sky-200/20 blur-3xl" />
      </div>

      <div className="relative px-5 pb-5 pt-5">
        <p className="label-quiet text-center">All time statistics</p>

        <div className="mt-5 flex items-start justify-between px-0.5">
          <Metric value={stats?.satsSpent ?? 0} label="sats spent" loading={showSkeleton} />
          <Divider />
          <Metric
            value={stats?.satsRewarded ?? 0}
            label="sats rewarded"
            loading={showSkeleton}
          />
          <Divider />
          <Metric value={stats?.payments ?? 0} label="payments" loading={showSkeleton} />
        </div>

        <PaymentsByMonthChart byMonth={byMonth} loading={showSkeleton} />
      </div>
    </section>
  );
}
