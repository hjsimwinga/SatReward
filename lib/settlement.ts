/**
 * Best-effort Lightning invoice settlement detection across LNURL providers.
 * Strategies: verify URLs (explicit + harvested from JSON), successAction.url,
 * callback variants (payment_hash, r_hash, checking_id, pr=…), POST fallbacks.
 */

import type { SettlementHints } from "@/lib/lnurl";

const MAX_POLL_URLS = 90;

const SETTLEMENT_HEADERS: Record<string, string> = {
  Accept: "application/json, text/plain;q=0.9, */*;q=0.8",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
};

/**
 * Only cryptographic payment preimage fields from settlement/verify APIs.
 * Do NOT use `payment_secret` — in BOLT11 decodes that is the invoice payment_secret tag
 * (route blinding), present on every invoice before payment; it is not the HTLC preimage.
 */
function extractPreimageFields(data: Record<string, unknown>): string | undefined {
  const keys = ["preimage", "payment_preimage", "paymentPreimage"] as const;
  for (const k of keys) {
    const v = data[k];
    if (typeof v === "string" && /^[0-9a-f]{64}$/i.test(v)) {
      return v.toLowerCase();
    }
  }
  return undefined;
}

/** Shape produced by bolt11 decoders (Wallet of Satoshi app, etc.) — not a payment-status API. */
function looksLikeDecodedBolt11(data: Record<string, unknown>): boolean {
  const pr = data.paymentRequest ?? data.payment_request;
  if (typeof pr !== "string" || !pr.toLowerCase().startsWith("ln")) return false;
  if (!Array.isArray(data.tags) || data.tags.length === 0) return false;
  const first = data.tags[0];
  return (
    first != null &&
    typeof first === "object" &&
    "tagName" in (first as object)
  );
}

function dig(obj: unknown, path: string[]): unknown {
  let cur: unknown = obj;
  for (const p of path) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

export function parseSettlementJson(data: Record<string, unknown>): {
  settled: boolean;
  preimage?: string;
} {
  if (data.status === "ERROR" && typeof data.reason === "string") {
    return { settled: false };
  }
  if (typeof data.status === "string" && data.status.toUpperCase() === "ERROR") {
    return { settled: false };
  }

  if (looksLikeDecodedBolt11(data)) {
    const topPre =
      (typeof data.preimage === "string" && /^[0-9a-f]{64}$/i.test(data.preimage)
        ? data.preimage.toLowerCase()
        : undefined) ||
      (typeof data.payment_preimage === "string" &&
      /^[0-9a-f]{64}$/i.test(data.payment_preimage)
        ? data.payment_preimage.toLowerCase()
        : undefined) ||
      extractPreimageFields(data);
    if (topPre) {
      return { settled: true, preimage: topPre };
    }
    const explicit =
      data.paid === true ||
      data.settled === true ||
      data.is_paid === true ||
      data.isPaid === true ||
      data.paid === 1 ||
      data.settled === 1;
    if (!explicit) {
      return { settled: false };
    }
  }

  const directPre = extractPreimageFields(data);
  if (directPre) {
    return { settled: true, preimage: directPre };
  }

  const stRaw = data.status ?? data.state;
  const st = typeof stRaw === "string" ? stRaw.toLowerCase() : "";

  const nestedPaid =
    dig(data, ["data", "paid"]) === true ||
    dig(data, ["data", "settled"]) === true ||
    dig(data, ["result", "paid"]) === true ||
    dig(data, ["result", "settled"]) === true ||
    dig(data, ["invoice", "settled"]) === true ||
    dig(data, ["invoice", "paid"]) === true ||
    dig(data, ["payment", "settled"]) === true ||
    dig(data, ["payload", "paid"]) === true ||
    dig(data, ["payload", "settled"]) === true;

  const stateStr = typeof data.state === "string" ? data.state.toUpperCase() : "";
  const invState =
    typeof dig(data, ["invoice", "state"]) === "string"
      ? String(dig(data, ["invoice", "state"])).toUpperCase()
      : "";
  const lndLike =
    stateStr === "SETTLED" ||
    stateStr === "PAID" ||
    invState === "SETTLED" ||
    invState === "PAID";

  const settled =
    data.settled === true ||
    data.paid === true ||
    data.is_paid === true ||
    data.isPaid === true ||
    data.success === true ||
    nestedPaid ||
    lndLike ||
    data.paid === 1 ||
    data.settled === 1 ||
    (typeof data.paid === "string" && data.paid.toLowerCase() === "true") ||
    (st && ["paid", "settled", "success", "paid_out"].includes(st)) ||
    (typeof data.invoice === "object" &&
      data.invoice !== null &&
      ((data.invoice as Record<string, unknown>).settled === true ||
        (data.invoice as Record<string, unknown>).paid === true)) ||
    (typeof data.payment === "object" &&
      data.payment !== null &&
      ((data.payment as Record<string, unknown>).settled === true ||
        (data.payment as Record<string, unknown>).paid === true));

  if (!settled) {
    return { settled: false };
  }

  const loosePre =
    (typeof data.preimage === "string" && /^[0-9a-f]{64}$/i.test(data.preimage)
      ? data.preimage.toLowerCase()
      : undefined) ||
    (typeof data.payment_preimage === "string" && /^[0-9a-f]{64}$/i.test(data.payment_preimage)
      ? data.payment_preimage.toLowerCase()
      : undefined) ||
    extractPreimageFields(data);

  return { settled: true, preimage: loosePre };
}

function tryParseJsonObject(text: string): Record<string, unknown> | null {
  const t = text.trim();
  if (!t) return null;
  try {
    const j = JSON.parse(t) as unknown;
    if (j && typeof j === "object" && !Array.isArray(j)) return j as Record<string, unknown>;
    if (Array.isArray(j) && j[0] && typeof j[0] === "object") {
      return j[0] as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return null;
}

/** Lenient HTTP read — do not require res.ok; many custodians use 4xx while unpaid. */
async function readSettlementBody(
  url: string,
  init: RequestInit
): Promise<{ status: number; text: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal, cache: "no-store" });
    const buf = await res.arrayBuffer();
    if (buf.byteLength > 256_000) {
      return { status: res.status, text: "" };
    }
    const text = new TextDecoder().decode(buf);
    return { status: res.status, text };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchSettlementStatus(url: string): Promise<{
  settled: boolean;
  preimage?: string;
  error?: string;
}> {
  try {
    const { status, text } = await readSettlementBody(url, {
      method: "GET",
      headers: SETTLEMENT_HEADERS,
    });

    const parsed = tryParseJsonObject(text);
    if (parsed) {
      const r = parseSettlementJson(parsed);
      if (r.settled) return r;
      if (status >= 200 && status < 300) return r;
      if (status === 404 || status === 400 || status === 402) return { settled: false };
      return { settled: false };
    }

    if (status >= 200 && status < 300) {
      const low = text.toLowerCase();
      if (
        low.includes('"settled":true') ||
        low.includes('"paid":true') ||
        low.includes('"status":"paid"') ||
        low.includes('"state":"settled"')
      ) {
        const again = tryParseJsonObject(
          text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1) || text
        );
        if (again) return parseSettlementJson(again);
      }
    }

    return { settled: false };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Request failed";
    return { settled: false, error: msg };
  }
}

async function fetchSettlementPost(
  url: string,
  paymentHashHex: string,
  hints: SettlementHints | null
): Promise<{ settled: boolean; preimage?: string }> {
  try {
    const hash = paymentHashHex.replace(/^0x/i, "").toLowerCase();
    const body: Record<string, unknown> = {
      payment_hash: hash,
      paymentHash: hash,
      payment_hash_hex: hash,
    };
    if (hints?.checkingId) {
      body.checking_id = hints.checkingId;
      body.checkingId = hints.checkingId;
    }
    if (hints?.invoiceId) {
      body.invoice_id = hints.invoiceId;
      body.invoiceId = hints.invoiceId;
    }
    if (hints?.reference) {
      body.reference = hints.reference;
    }
    const { status, text } = await readSettlementBody(url, {
      method: "POST",
      headers: {
        ...SETTLEMENT_HEADERS,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const parsed = tryParseJsonObject(text);
    if (parsed) {
      const r = parseSettlementJson(parsed);
      if (r.settled) return r;
    }
    if (status >= 200 && status < 300 && parsed) {
      return parseSettlementJson(parsed);
    }
    return { settled: false };
  } catch {
    return { settled: false };
  }
}

function normalizeHash(h: string): string {
  return h.replace(/^0x/i, "").toLowerCase();
}

function expandVerifyUrls(base: string, paymentHash: string | null): string[] {
  const out: string[] = [base];
  if (!paymentHash) return [...new Set(out)];
  const hash = normalizeHash(paymentHash);
  const hashUpper = hash.toUpperCase();

  const addParams = (u: URL) => {
    const copies: string[] = [];
    if (!u.searchParams.has("payment_hash")) {
      const a = new URL(u.toString());
      a.searchParams.set("payment_hash", hash);
      copies.push(a.toString());
    }
    if (!u.searchParams.has("paymentHash")) {
      const b = new URL(u.toString());
      b.searchParams.set("paymentHash", hash);
      copies.push(b.toString());
    }
    const c = new URL(u.toString());
    if (!c.searchParams.has("payment_hash")) {
      c.searchParams.set("payment_hash", hashUpper);
      copies.push(c.toString());
    }
    return copies;
  };

  try {
    const u = new URL(base);
    out.push(...addParams(u));
  } catch {
    /* ignore */
  }

  return [...new Set(out)];
}

function callbackLookupUrls(
  callbackBase: string,
  paymentHash: string,
  amountMsats: bigint | null,
  hints: SettlementHints | null,
  bolt11: string | null
): string[] {
  const hash = normalizeHash(paymentHash);
  const hashUpper = hash.toUpperCase();
  const urls: string[] = [];

  const pushVariant = (mutate: (u: URL) => void) => {
    try {
      const u = new URL(callbackBase);
      mutate(u);
      urls.push(u.toString());
    } catch {
      /* ignore */
    }
  };

  const hashKeys = ["payment_hash", "paymentHash", "r_hash", "hash"] as const;
  for (const key of hashKeys) {
    pushVariant((u) => {
      u.searchParams.delete("amount");
      u.searchParams.set(key, hash);
    });
    pushVariant((u) => {
      u.searchParams.delete("amount");
      u.searchParams.set(key, hashUpper);
    });
    if (amountMsats != null && amountMsats > 0n) {
      pushVariant((u) => {
        u.searchParams.set("amount", amountMsats.toString());
        u.searchParams.set(key, hash);
      });
    }
  }

  if (hints?.checkingId) {
    for (const key of ["checking_id", "checkingId", "check_id"]) {
      pushVariant((u) => {
        u.searchParams.delete("amount");
        u.searchParams.set(key, hints.checkingId!);
      });
      if (amountMsats != null && amountMsats > 0n) {
        pushVariant((u) => {
          u.searchParams.set("amount", amountMsats.toString());
          u.searchParams.set(key, hints.checkingId!);
        });
      }
    }
  }

  if (hints?.invoiceId) {
    for (const key of ["invoice_id", "invoiceId"]) {
      pushVariant((u) => {
        u.searchParams.delete("amount");
        u.searchParams.set(key, hints.invoiceId!);
      });
    }
  }

  if (hints?.reference) {
    pushVariant((u) => {
      u.searchParams.delete("amount");
      u.searchParams.set("reference", hints.reference!);
    });
  }

  if (bolt11 && bolt11.length > 10 && bolt11.length < 3500) {
    pushVariant((u) => {
      u.searchParams.delete("amount");
      u.searchParams.set("pr", bolt11);
    });
  }

  return [...new Set(urls)];
}

function parseVerifyUrlsJson(json: string | null): string[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.filter((u): u is string => typeof u === "string" && u.startsWith("http"));
  } catch {
    return [];
  }
}

function parseSettlementHintsJson(json: string | null): SettlementHints | null {
  if (!json) return null;
  try {
    const j = JSON.parse(json) as SettlementHints;
    if (!j || typeof j !== "object") return null;
    return j;
  } catch {
    return null;
  }
}

export async function pollSettlementCandidates(opts: {
  verifyUrl: string | null;
  verifyUrlsJson: string | null;
  callbackUrl: string | null;
  successActionJson: string | null;
  settlementHintsJson: string | null;
  paymentHash: string | null;
  amountMsats: bigint | null;
  bolt11: string | null;
}): Promise<{ settled: boolean; preimage?: string }> {
  const {
    verifyUrl,
    verifyUrlsJson,
    callbackUrl,
    successActionJson,
    settlementHintsJson,
    paymentHash,
    amountMsats,
    bolt11,
  } = opts;
  const hints = parseSettlementHintsJson(settlementHintsJson);
  const candidates: string[] = [];

  const verifyList = [
    ...parseVerifyUrlsJson(verifyUrlsJson),
    ...(verifyUrl ? [verifyUrl] : []),
  ];
  const uniqueVerifyBases = [...new Set(verifyList)];

  for (const v of uniqueVerifyBases) {
    candidates.push(...expandVerifyUrls(v, paymentHash));
  }

  if (successActionJson) {
    try {
      const sa = JSON.parse(successActionJson) as { tag?: string; url?: string };
      const tag = sa.tag != null ? String(sa.tag).toLowerCase() : "";
      if (tag === "url" && typeof sa.url === "string" && sa.url.startsWith("http")) {
        candidates.push(...expandVerifyUrls(sa.url, paymentHash));
      }
    } catch {
      /* ignore */
    }
  }

  if (callbackUrl && paymentHash) {
    candidates.push(
      ...callbackLookupUrls(callbackUrl, paymentHash, amountMsats, hints, bolt11)
    );
  }

  const unique = [
    ...new Set(candidates.filter((u) => u.startsWith("http"))),
  ].slice(0, MAX_POLL_URLS);

  for (const url of unique) {
    const r = await fetchSettlementStatus(url);
    if (r.settled) {
      return { settled: true, preimage: r.preimage };
    }
  }

  if (paymentHash) {
    const hash = normalizeHash(paymentHash);
    const postCap = Math.min(24, unique.length);
    for (let i = 0; i < postCap; i++) {
      const r = await fetchSettlementPost(unique[i], hash, hints);
      if (r.settled) {
        return { settled: true, preimage: r.preimage };
      }
    }
  }

  return { settled: false };
}
