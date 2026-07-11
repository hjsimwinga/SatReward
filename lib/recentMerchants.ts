import { prisma } from "@/lib/db";

export async function getRecentMerchantAddresses(limit = 3): Promise<string[]> {
  const paid = await prisma.payment.findMany({
    where: { status: "paid" },
    orderBy: { createdAt: "desc" },
    select: { merchantAddress: true },
    take: 100,
  });

  const seen = new Set<string>();
  const recent: string[] = [];

  for (const row of paid) {
    const key = row.merchantAddress.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    recent.push(row.merchantAddress);
    if (recent.length >= limit) break;
  }

  return recent;
}
