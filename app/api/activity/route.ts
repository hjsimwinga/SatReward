import { prisma } from "@/lib/db";
import { todayInZambia } from "@/lib/rewards";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Start of calendar day in Africa/Lusaka (UTC+2, no DST). */
function startOfTodayInZambia(): Date {
  return new Date(`${todayInZambia()}T00:00:00+02:00`);
}

function maskAddress(address: string): string {
  const at = address.indexOf("@");
  if (at <= 0) return "••••";
  const user = address.slice(0, at);
  const domain = address.slice(at + 1);
  const tip = user.slice(0, Math.min(2, user.length));
  return `${tip}•••@${domain}`;
}

export type ActivityItem = {
  id: string;
  kind: "payment" | "reward";
  merchantName: string;
  amountSats: number;
  rewardSats: number | null;
  rewardSent: boolean;
  createdAt: string;
  addressHint: string;
};

export async function GET() {
  try {
    const dayStart = startOfTodayInZambia();
    const rewardDate = todayInZambia();

    const [paymentsToday, rewardsTodayAgg, recentPaid] = await Promise.all([
      prisma.payment.count({
        where: { status: "paid", createdAt: { gte: dayStart } },
      }),
      prisma.dailyReward.aggregate({
        where: { rewardDate },
        _count: { _all: true },
        _sum: { rewardSats: true },
      }),
      prisma.payment.findMany({
        where: { status: "paid" },
        orderBy: { createdAt: "desc" },
        take: 3,
        select: {
          id: true,
          merchantName: true,
          amountSats: true,
          rewardSats: true,
          rewardSent: true,
          rewardAddress: true,
          createdAt: true,
        },
      }),
    ]);

    const items: ActivityItem[] = recentPaid.map((p) => ({
      id: p.id,
      kind: p.rewardSent ? "reward" : "payment",
      merchantName: p.merchantName,
      amountSats: p.amountSats,
      rewardSats: p.rewardSats,
      rewardSent: p.rewardSent,
      createdAt: p.createdAt.toISOString(),
      addressHint: maskAddress(p.rewardAddress),
    }));

    return NextResponse.json({
      ok: true,
      today: {
        payments: paymentsToday,
        rewards: rewardsTodayAgg._count._all,
        rewardSats: rewardsTodayAgg._sum.rewardSats ?? 0,
      },
      items,
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Activity failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
