import { NextResponse } from "next/server";
import { getPoolBalance } from "@/lib/blink";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const balance = await getPoolBalance();
    return NextResponse.json({ ok: true, ...balance });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not load pool balance";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
