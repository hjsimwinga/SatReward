import { NextResponse } from "next/server";
import { getMerchants } from "@/lib/merchants";
import { getRecentMerchantAddresses } from "@/lib/recentMerchants";

export const dynamic = "force-dynamic";

export async function GET() {
  const [merchants, recentAddresses] = await Promise.all([
    Promise.resolve(getMerchants()),
    getRecentMerchantAddresses(),
  ]);

  return NextResponse.json({ ok: true, merchants, recentAddresses });
}
