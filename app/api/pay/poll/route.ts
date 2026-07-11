import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { decodeBolt11 } from "@/lib/bolt11";
import { pollSettlementCandidates } from "@/lib/settlement";
import { processReward } from "@/lib/rewards";
import { getRewardSats } from "@/lib/blink";

export const dynamic = "force-dynamic";

const DEFAULT_TIMEOUT_SEC = 120;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { paymentId?: string };
    const id = String(body.paymentId ?? "").trim();
    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Missing payment id" },
        { status: 400 }
      );
    }

    const payment = await prisma.payment.findUnique({ where: { id } });
    if (!payment) {
      return NextResponse.json(
        { ok: false, error: "Payment not found" },
        { status: 404 }
      );
    }

    if (payment.status === "paid") {
      let rewardSent = payment.rewardSent;
      let rewardSats = payment.rewardSats ?? getRewardSats();
      let rewardSkippedReason = payment.rewardSkippedReason;
      let rewardError: string | undefined;

      // Prefer a successful send over a stale skipped flag from a poll race.
      if (rewardSent) {
        rewardSkippedReason = null;
      } else if (!rewardSkippedReason) {
        const reward = await processReward(id);
        rewardSent = reward.rewardSent;
        rewardSats = reward.rewardSats;
        rewardSkippedReason = reward.skippedReason ?? null;
        rewardError = reward.error;
      }

      return NextResponse.json({
        ok: true,
        status: "paid",
        merchantName: payment.merchantName,
        amountSats: payment.amountSats,
        rewardAddress: payment.rewardAddress,
        rewardSent,
        rewardSats,
        rewardSkippedReason: rewardSent ? null : rewardSkippedReason,
        rewardError,
        rewardPending: !rewardSent && !rewardSkippedReason,
        paymentHash: payment.paymentHash,
      });
    }

    if (payment.status === "expired" || payment.status === "failed") {
      return NextResponse.json({
        ok: true,
        status: payment.status,
        paymentHash: payment.paymentHash,
      });
    }

    const bolt = payment.bolt11;
    const decoded = bolt ? decodeBolt11(bolt) : null;
    if (bolt && decoded?.expiryUnix && Date.now() / 1000 > decoded.expiryUnix + 30) {
      await prisma.payment.update({
        where: { id },
        data: { status: "expired" },
      });
      return NextResponse.json({
        ok: true,
        status: "expired",
        paymentHash: payment.paymentHash,
      });
    }

    const amountMsats = decoded?.amountMsats ?? null;

    const v = await pollSettlementCandidates({
      verifyUrl: payment.verifyUrl,
      verifyUrlsJson: payment.verifyUrlsJson,
      callbackUrl: payment.callbackUrl,
      successActionJson: payment.successActionJson,
      settlementHintsJson: payment.settlementHintsJson,
      paymentHash: payment.paymentHash,
      amountMsats,
      bolt11: payment.bolt11,
    });

    if (v.settled) {
      await prisma.payment.update({
        where: { id },
        data: {
          status: "paid",
          preimage: v.preimage ?? undefined,
        },
      });

      const reward = await processReward(id);

      return NextResponse.json({
        ok: true,
        status: "paid",
        merchantName: payment.merchantName,
        amountSats: payment.amountSats,
        rewardAddress: payment.rewardAddress,
        rewardSent: reward.rewardSent,
        rewardSats: reward.rewardSats,
        rewardSkippedReason: reward.rewardSent ? null : reward.skippedReason,
        rewardError: reward.error,
        rewardPending: !reward.rewardSent && !reward.skippedReason,
        paymentHash: payment.paymentHash,
      });
    }

    const created = payment.createdAt.getTime();
    const timeoutMs =
      (Number(process.env.PAYMENT_POLL_TIMEOUT_SEC) || DEFAULT_TIMEOUT_SEC) * 1000;
    if (Date.now() - created > timeoutMs) {
      return NextResponse.json({
        ok: true,
        status: "pending",
        paymentHash: payment.paymentHash,
        timedOut: true,
      });
    }

    return NextResponse.json({
      ok: true,
      status: "pending",
      paymentHash: payment.paymentHash,
      timedOut: false,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Poll failed";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
