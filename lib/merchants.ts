import merchants from "@/data/merchants.json";

export type Merchant = {
  name: string;
  lightningAddress: string;
  tagline?: string;
};

export function getMerchants(): Merchant[] {
  return merchants as Merchant[];
}

export function findMerchant(lightningAddress: string): Merchant | undefined {
  const key = lightningAddress.trim().toLowerCase();
  return getMerchants().find((m) => m.lightningAddress.toLowerCase() === key);
}
