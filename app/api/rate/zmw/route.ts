import { NextResponse } from "next/server";
import { getZmwRate } from "@/lib/blink";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rate = await getZmwRate();
    return NextResponse.json({ ok: true, ...rate });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not load rate";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
