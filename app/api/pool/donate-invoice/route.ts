import { NextResponse } from "next/server";
import { createPoolDonationInvoice } from "@/lib/blink";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const invoice = await createPoolDonationInvoice();
    return NextResponse.json({ ok: true, ...invoice });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not create donation invoice";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
