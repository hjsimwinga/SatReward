import { prisma } from "@/lib/db";
import { todayInZambia } from "@/lib/rewards";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type PeriodStats = {
  payments: number;
  satsSpent: number;
  satsRewarded: number;
};

/** One bar: payments in that calendar month. `month` = YYYY-MM */
export type MonthBucket = {
  month: string;
  payments: number;
  satsSpent: number;
};

function dateInZambia(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lusaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function monthKeyInZambia(d: Date): string {
  return dateInZambia(d).slice(0, 7);
}

function startOfLastNDaysInZambia(days: number): Date {
  const today = todayInZambia();
  const end = new Date(`${today}T00:00:00+02:00`);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return start;
}

function addMonths(yyyyMm: string, delta: number): string {
  const [y, m] = yyyyMm.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${yy}-${mm}`;
}

function eachMonthInclusive(from: string, to: string): string[] {
  const out: string[] = [];
  let cur = from;
  let guard = 0;
  while (cur <= to && guard < 120) {
    out.push(cur);
    cur = addMonths(cur, 1);
    guard += 1;
  }
  return out;
}

async function aggregatePaid(since?: Date): Promise<PeriodStats> {
  const where = {
    status: "paid" as const,
    ...(since ? { createdAt: { gte: since } } : {}),
  };

  const [count, spent, rewarded] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.aggregate({
      where,
      _sum: { amountSats: true },
    }),
    prisma.payment.aggregate({
      where: { ...where, rewardSent: true },
      _sum: { rewardSats: true },
    }),
  ]);

  return {
    payments: count,
    satsSpent: spent._sum.amountSats ?? 0,
    satsRewarded: rewarded._sum.rewardSats ?? 0,
  };
}

async function buildMonthlyPayments(): Promise<MonthBucket[]> {
  const rows = await prisma.payment.findMany({
    where: { status: "paid" },
    select: { createdAt: true, amountSats: true },
    orderBy: { createdAt: "asc" },
  });

  if (rows.length === 0) return [];

  const first = monthKeyInZambia(rows[0].createdAt);
  const last = monthKeyInZambia(new Date());
  const months = eachMonthInclusive(first, last);
  const map = new Map<string, { payments: number; satsSpent: number }>();
  for (const m of months) map.set(m, { payments: 0, satsSpent: 0 });

  for (const row of rows) {
    const key = monthKeyInZambia(row.createdAt);
    const bucket = map.get(key);
    if (!bucket) continue;
    bucket.payments += 1;
    bucket.satsSpent += row.amountSats;
  }

  return months.map((month) => ({
    month,
    payments: map.get(month)?.payments ?? 0,
    satsSpent: map.get(month)?.satsSpent ?? 0,
  }));
}

export async function GET() {
  try {
    const since30 = startOfLastNDaysInZambia(30);

    const [allTime, days30, byMonth] = await Promise.all([
      aggregatePaid(),
      aggregatePaid(since30),
      buildMonthlyPayments(),
    ]);

    return NextResponse.json({
      ok: true,
      allTime,
      days30,
      byMonth,
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Stats failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
