import { NextResponse } from "next/server";
import { createPoolDonationInvoice } from "@/lib/blink";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { amountSats?: unknown };
    const amountSats = Number(body.amountSats);

    if (!Number.isFinite(amountSats) || amountSats <= 0) {
      return NextResponse.json(
        { ok: false, error: "Enter how many sats you want to donate" },
        { status: 400 }
      );
    }

    const invoice = await createPoolDonationInvoice(amountSats);
    return NextResponse.json({ ok: true, ...invoice });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not create donation invoice";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
