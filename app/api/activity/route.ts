import { prisma } from "@/lib/db";
import { todayInZambia } from "@/lib/rewards";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Start of calendar day in Africa/Lusaka (UTC+2, no DST). */
function startOfTodayInZambia(): Date {
  return new Date(`${todayInZambia()}T00:00:00+02:00`);
}

export async function GET() {
  try {
    const dayStart = startOfTodayInZambia();
    const rewardDate = todayInZambia();

    const [paymentsAgg, rewardsTodayAgg] = await Promise.all([
      prisma.payment.aggregate({
        where: { status: "paid", createdAt: { gte: dayStart } },
        _count: { _all: true },
        _sum: { amountSats: true },
      }),
      prisma.dailyReward.aggregate({
        where: { rewardDate },
        _sum: { rewardSats: true },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      today: {
        payments: paymentsAgg._count._all,
        satsSpent: paymentsAgg._sum.amountSats ?? 0,
        satsRewarded: rewardsTodayAgg._sum.rewardSats ?? 0,
      },
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Activity failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
