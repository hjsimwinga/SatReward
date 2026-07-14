import { prisma } from "@/lib/db";
import { sendRewardToAddress, getRewardSats, getPoolBalance } from "@/lib/blink";
import { normalizeRewardAddress } from "@/lib/sanitize";

/** Calendar day in Africa/Lusaka (UTC+2, no DST). */
export function todayInZambia(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lusaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** @deprecated use todayInZambia */
export function todayUtc(): string {
  return todayInZambia();
}

export function getMerchantDailyRewardLimit(): number {
  const n = parseInt(process.env.MERCHANT_DAILY_REWARD_LIMIT ?? "5", 10);
  if (!Number.isFinite(n) || n <= 0) return 5;
  return n;
}

function normalizeMerchantAddress(input: string): string {
  return input.trim().toLowerCase();
}

export async function hasClaimedFromMerchantToday(
  rewardAddress: string,
  merchantAddress: string
): Promise<boolean> {
  const row = await prisma.dailyReward.findUnique({
    where: {
      rewardAddress_merchantAddress_rewardDate: {
        rewardAddress: normalizeRewardAddress(rewardAddress),
        merchantAddress: normalizeMerchantAddress(merchantAddress),
        rewardDate: todayInZambia(),
      },
    },
  });
  return row != null;
}

/** @deprecated use hasClaimedFromMerchantToday */
export async function hasClaimedRewardToday(rewardAddress: string): Promise<boolean> {
  const count = await prisma.dailyReward.count({
    where: {
      rewardAddress: normalizeRewardAddress(rewardAddress),
      rewardDate: todayInZambia(),
    },
  });
  return count > 0;
}

export type RewardOutcome = {
  rewardSent: boolean;
  rewardSats: number;
  skippedReason?: string;
  error?: string;
};

function isUniqueConstraintError(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: string }).code === "P2002"
  );
}

async function markSkipped(
  paymentId: string,
  reason: string,
  amount: number
): Promise<RewardOutcome> {
  await prisma.payment.update({
    where: { id: paymentId },
    data: { rewardSkippedReason: reason },
  });
  return {
    rewardSent: false,
    rewardSats: amount,
    skippedReason: reason,
  };
}

export async function processReward(paymentId: string): Promise<RewardOutcome> {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) {
    return { rewardSent: false, rewardSats: 0, error: "Payment not found" };
  }

  const rewardSats = payment.rewardSats ?? getRewardSats(payment.amountSats);

  if (payment.rewardSent) {
    return { rewardSent: true, rewardSats };
  }

  if (payment.rewardSkippedReason) {
    return {
      rewardSent: false,
      rewardSats: getRewardSats(payment.amountSats),
      skippedReason: payment.rewardSkippedReason,
    };
  }

  const normalizedUser = normalizeRewardAddress(payment.rewardAddress);
  const normalizedMerchant = normalizeMerchantAddress(payment.merchantAddress);
  const rewardDate = todayInZambia();
  const amount = getRewardSats(payment.amountSats);
  const merchantLimit = getMerchantDailyRewardLimit();

  const existing = await prisma.dailyReward.findUnique({
    where: {
      rewardAddress_merchantAddress_rewardDate: {
        rewardAddress: normalizedUser,
        merchantAddress: normalizedMerchant,
        rewardDate,
      },
    },
  });

  // This payment already reserved / claimed today's shop reward.
  if (existing?.paymentId === paymentId) {
    await prisma.payment.update({
      where: { id: paymentId },
      data: { rewardSent: true, rewardSats: existing.rewardSats, rewardSkippedReason: null },
    });
    return { rewardSent: true, rewardSats: existing.rewardSats };
  }

  if (existing) {
    return markSkipped(paymentId, "already_claimed_merchant_today", amount);
  }

  if (amount < 1) {
    return markSkipped(paymentId, "reward_too_small", 0);
  }

  const merchantCount = await prisma.dailyReward.count({
    where: {
      merchantAddress: normalizedMerchant,
      rewardDate,
    },
  });

  if (merchantCount >= merchantLimit) {
    return markSkipped(paymentId, "merchant_daily_limit", amount);
  }

  // Reserve the user+shop daily slot first (race-safe).
  try {
    await prisma.dailyReward.create({
      data: {
        rewardAddress: normalizedUser,
        merchantAddress: normalizedMerchant,
        rewardDate,
        paymentId,
        rewardSats: amount,
      },
    });
  } catch (e) {
    if (!isUniqueConstraintError(e)) {
      return {
        rewardSent: false,
        rewardSats: amount,
        error: e instanceof Error ? e.message : "Could not claim daily reward",
      };
    }

    const raced = await prisma.dailyReward.findUnique({
      where: {
        rewardAddress_merchantAddress_rewardDate: {
          rewardAddress: normalizedUser,
          merchantAddress: normalizedMerchant,
          rewardDate,
        },
      },
    });

    if (raced?.paymentId === paymentId) {
      await prisma.payment.update({
        where: { id: paymentId },
        data: { rewardSent: true, rewardSats: raced.rewardSats, rewardSkippedReason: null },
      });
      return { rewardSent: true, rewardSats: raced.rewardSats };
    }

    return markSkipped(paymentId, "already_claimed_merchant_today", amount);
  }

  // Enforce shop daily cap after insert (handles concurrent claims).
  const merchantCountAfter = await prisma.dailyReward.count({
    where: {
      merchantAddress: normalizedMerchant,
      rewardDate,
    },
  });

  if (merchantCountAfter > merchantLimit) {
    await prisma.dailyReward.deleteMany({
      where: { rewardAddress: normalizedUser, merchantAddress: normalizedMerchant, rewardDate, paymentId },
    });
    return markSkipped(paymentId, "merchant_daily_limit", amount);
  }

  try {
    const pool = await getPoolBalance();
    if ((pool.sats ?? 0) < amount) {
      await prisma.dailyReward.deleteMany({
        where: {
          rewardAddress: normalizedUser,
          merchantAddress: normalizedMerchant,
          rewardDate,
          paymentId,
        },
      });
      return markSkipped(paymentId, "pool_empty", amount);
    }
  } catch {
    /* if balance check fails, still try to send */
  }

  const send = await sendRewardToAddress(payment.rewardAddress, amount);
  if (!send.success) {
    await prisma.dailyReward.deleteMany({
      where: { rewardAddress: normalizedUser, merchantAddress: normalizedMerchant, rewardDate, paymentId },
    });

    const err = (send.error ?? "Reward failed").toLowerCase();
    const poolEmpty =
      err.includes("insufficient") ||
      err.includes("balance") ||
      err.includes("not enough") ||
      err.includes("no funds") ||
      err.includes("funds");

    if (poolEmpty) {
      return markSkipped(paymentId, "pool_empty", amount);
    }

    return {
      rewardSent: false,
      rewardSats: amount,
      error: send.error ?? "Reward failed",
    };
  }

  await prisma.payment.update({
    where: { id: paymentId },
    data: { rewardSent: true, rewardSats: amount, rewardSkippedReason: null },
  });

  return { rewardSent: true, rewardSats: amount };
}
