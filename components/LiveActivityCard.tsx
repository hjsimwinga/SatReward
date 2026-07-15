"use client";

import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { apiPath } from "@/lib/apiPath";

const POLL_MS = 12_000;

type TodayStats = {
  payments: number;
  satsSpent: number;
  satsRewarded: number;
};

type Props = {
  refreshToken?: number;
};

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

export function LiveActivityCard({ refreshToken = 0 }: Props) {
  const [today, setToday] = useState<TodayStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await axios.get(apiPath("/api/activity"));
      if (!res.data?.ok) return;
      setToday(res.data.today as TodayStats);
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
    const t1 = window.setTimeout(() => void load(), 900);
    const t2 = window.setTimeout(() => void load(), 2800);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [refreshToken, load]);

  const showSkeleton = loading && today == null;

  return (
    <section className="card relative mb-0">
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
        <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-gold/15 blur-3xl" />
        <div className="absolute -bottom-12 -left-8 h-24 w-24 rounded-full bg-sky-200/20 blur-3xl" />
      </div>

      <div className="relative px-5 pb-5 pt-5">
        <p className="label-quiet text-center">Today</p>

        <div className="mt-5 flex items-start justify-between px-0.5">
          <Metric
            value={today?.satsSpent ?? 0}
            label="sats spent"
            loading={showSkeleton}
          />
          <Divider />
          <Metric
            value={today?.satsRewarded ?? 0}
            label="sats rewarded"
            loading={showSkeleton}
          />
          <Divider />
          <Metric
            value={today?.payments ?? 0}
            label="payments"
            loading={showSkeleton}
          />
        </div>
      </div>
    </section>
  );
}
