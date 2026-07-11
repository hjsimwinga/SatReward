import { findMerchant } from "@/lib/merchants";
import { getZmwRate, zmwToSats } from "@/lib/blink";
import { normalizeRewardAddress, sanitizeLightningAddress } from "@/lib/sanitize";
import {
  parseLightningAddress,
  requestLnurlInvoice,
  resolveLnurlPay,
  validateAmountMsats,
} from "@/lib/lnurl";
import { decodeBolt11 } from "@/lib/bolt11";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      rewardAddress?: string;
      merchantAddress?: string;
      amountZmw?: number;
    };

    const rewardAddress = normalizeRewardAddress(String(body.rewardAddress ?? ""));
    parseLightningAddress(rewardAddress);

    const merchantAddress = sanitizeLightningAddress(String(body.merchantAddress ?? ""));
    parseLightningAddress(merchantAddress);

    const merchant = findMerchant(merchantAddress);
    if (!merchant) {
      return NextResponse.json(
        { ok: false, error: "Unknown merchant" },
        { status: 400 }
      );
    }

    const amountZmw = Number(body.amountZmw ?? 0);
    if (!Number.isFinite(amountZmw) || amountZmw <= 0) {
      return NextResponse.json(
        { ok: false, error: "Enter a valid amount in Kwacha" },
        { status: 400 }
      );
    }

    const { zmwPerSat } = await getZmwRate();
    const amountSats = zmwToSats(amountZmw, zmwPerSat);
    if (amountSats <= 0) {
      return NextResponse.json(
        { ok: false, error: "Amount is too small" },
        { status: 400 }
      );
    }

    const amountMsats = BigInt(amountSats) * BigInt(1000);
    const resolved = await resolveLnurlPay(merchantAddress);
    validateAmountMsats(amountMsats, resolved.minSendable, resolved.maxSendable);

    const inv = await requestLnurlInvoice(resolved.callback, amountMsats);
    const decoded = decodeBolt11(inv.pr);

    const verifyUrlsJson =
      inv.verifyUrls && inv.verifyUrls.length > 0 ? JSON.stringify(inv.verifyUrls) : null;
    const settlementHintsJson =
      inv.settlementHints && Object.keys(inv.settlementHints).length > 0
        ? JSON.stringify(inv.settlementHints)
        : null;

    const payment = await prisma.payment.create({
      data: {
        rewardAddress,
        merchantAddress,
        merchantName: merchant.name,
        amountSats,
        amountZmw,
        paymentHash: decoded.paymentHash,
        bolt11: inv.pr,
        status: "pending",
        verifyUrl: inv.verify ?? null,
        verifyUrlsJson,
        callbackUrl: resolved.callback,
        successActionJson:
          inv.successAction != null ? JSON.stringify(inv.successAction) : null,
        settlementHintsJson,
      },
    });

    return NextResponse.json({
      ok: true,
      paymentId: payment.id,
      pr: inv.pr,
      merchantName: merchant.name,
      amountSats,
      amountZmw,
      paymentHash: decoded.paymentHash,
      expiryUnix: decoded.expiryUnix,
    });
  } catch (e) {
    let message = e instanceof Error ? e.message : "Invoice failed";
    const lower = message.toLowerCase();
    if (
      lower.includes("invoice creation failed") ||
      lower.includes("could not create invoice")
    ) {
      message =
        "This shop’s wallet could not create an invoice. Try another shop or amount.";
    }
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
