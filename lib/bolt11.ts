import { decode as decodeBolt11Lib } from "bolt11";

export type DecodedInvoice = {
  paymentHash: string | null;
  expiryUnix: number | null;
  amountMsats: bigint | null;
};

function tagDataToHex(data: unknown): string | null {
  if (data == null) return null;
  if (typeof data === "string") return data;
  if (Buffer.isBuffer(data)) return data.toString("hex");
  return String(data);
}

export function decodeBolt11(bolt11: string): DecodedInvoice {
  try {
    const d = decodeBolt11Lib(bolt11);
    const phTag = d.tags.find((t) => t.tagName === "payment_hash");
    const paymentHash = phTag ? tagDataToHex(phTag.data) : null;

    let expiryUnix: number | null = null;
    const expTag = d.tags.find((t) => t.tagName === "expire_time");
    const ts = d.timestamp ?? 0;
    if (expTag && typeof expTag.data === "number") {
      expiryUnix = ts + expTag.data;
    }

    const sat = d.satoshis;
    let amountMsats: bigint | null = null;
    if (sat != null) {
      const n =
        typeof sat === "string"
          ? parseInt(sat, 10)
          : typeof sat === "number"
            ? sat
            : Number(sat);
      if (!Number.isNaN(n) && n >= 0) amountMsats = BigInt(n) * 1000n;
    }
    if (amountMsats == null && d.millisatoshis != null) {
      amountMsats = BigInt(d.millisatoshis);
    }

    return { paymentHash, expiryUnix, amountMsats };
  } catch {
    return { paymentHash: null, expiryUnix: null, amountMsats: null };
  }
}
