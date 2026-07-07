import { prisma } from "@/lib/db";
import { sendRewardToAddress, getRewardSats } from "@/lib/blink";
import { normalizeRewardAddress } from "@/lib/sanitize";

export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function hasClaimedRewardToday(rewardAddress: string): Promise<boolean> {
  const normalized = normalizeRewardAddress(rewardAddress);
  const row = await prisma.dailyReward.findUnique({
    where: {
      rewardAddress_rewardDate: {
        rewardAddress: normalized,
        rewardDate: todayUtc(),
      },
    },
  });
  return row != null;
}

export type RewardOutcome = {
  rewardSent: boolean;
  rewardSats: number;
  skippedReason?: string;
  error?: string;
};

export async function processReward(paymentId: string): Promise<RewardOutcome> {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) {
    return { rewardSent: false, rewardSats: 0, error: "Payment not found" };
  }

  if (payment.rewardSent) {
    return {
      rewardSent: true,
      rewardSats: payment.rewardSats ?? getRewardSats(),
    };
  }

  if (payment.rewardSkippedReason) {
    return {
      rewardSent: false,
      rewardSats: getRewardSats(),
      skippedReason: payment.rewardSkippedReason,
    };
  }

  const normalized = normalizeRewardAddress(payment.rewardAddress);
  const rewardDate = todayUtc();
  const rewardSats = getRewardSats();

  const existing = await prisma.dailyReward.findUnique({
    where: {
      rewardAddress_rewardDate: { rewardAddress: normalized, rewardDate },
    },
  });

  if (existing) {
    await prisma.payment.update({
      where: { id: paymentId },
      data: { rewardSkippedReason: "already_claimed_today" },
    });
    return {
      rewardSent: false,
      rewardSats,
      skippedReason: "already_claimed_today",
    };
  }

  const send = await sendRewardToAddress(payment.rewardAddress, rewardSats);
  if (!send.success) {
    return {
      rewardSent: false,
      rewardSats,
      error: send.error ?? "Reward failed",
    };
  }

  try {
    await prisma.dailyReward.create({
      data: {
        rewardAddress: normalized,
        rewardDate,
        paymentId,
        rewardSats,
      },
    });
  } catch {
    await prisma.payment.update({
      where: { id: paymentId },
      data: { rewardSkippedReason: "already_claimed_today" },
    });
    return {
      rewardSent: false,
      rewardSats,
      skippedReason: "already_claimed_today",
    };
  }

  await prisma.payment.update({
    where: { id: paymentId },
    data: { rewardSent: true, rewardSats },
  });

  return { rewardSent: true, rewardSats };
}
