const LIGHTNING_ADDRESS_RE = /^[a-z0-9._-]{1,100}@[a-z0-9.-]+\.[a-z]{2,}$/i;
const LNURL_WELL_KNOWN_RE =
  /(?:https?:\/\/)?([^/\s?#]+)\/\.well-known\/lnurlp\/([^/?#\s]+)/i;
const BOLT11_RE = /^(lightning:)?(lnbc|lntb|lnbcrt|lnsb|lnb)[0-9a-z]+$/i;

function normalizeAddress(user: string, domain: string): string {
  return `${decodeURIComponent(user).toLowerCase()}@${domain.toLowerCase()}`;
}

function stripWrappers(raw: string): string {
  let text = raw.trim();
  if (!text) return "";

  // Common wallet wrappers
  text = text.replace(/^lightning:\/\//i, "");
  text = text.replace(/^lightning:/i, "");
  text = text.replace(/^mailto:/i, "");
  text = text.trim();

  return text;
}

function extractAddressCandidate(text: string): string | null {
  // Direct address
  const direct = text.split("?")[0].split("#")[0].trim();
  if (LIGHTNING_ADDRESS_RE.test(direct)) {
    return direct.toLowerCase();
  }

  // LNURL-pay well-known URL → address
  const lnurlMatch = text.match(LNURL_WELL_KNOWN_RE);
  if (lnurlMatch) {
    return normalizeAddress(lnurlMatch[2], lnurlMatch[1]);
  }

  // Address buried in longer text / URL path / query
  const embedded = text.match(/[a-z0-9._-]{1,100}@[a-z0-9.-]+\.[a-z]{2,}/i);
  if (embedded && LIGHTNING_ADDRESS_RE.test(embedded[0])) {
    return embedded[0].toLowerCase();
  }

  // Fallback: last @ chunk, strip trailing path junk
  const at = text.lastIndexOf("@");
  if (at > 0 && at < text.length - 1) {
    const left = text.slice(0, at).split(/[\s/"'=<>]/).pop() ?? "";
    const right = text.slice(at + 1).split(/[\s/:?#"'<>]/)[0];
    const candidate = `${left}@${right}`;
    if (LIGHTNING_ADDRESS_RE.test(candidate)) {
      return candidate.toLowerCase();
    }
  }

  return null;
}

export type ParseLightningResult =
  | { kind: "address"; address: string }
  | { kind: "invoice" }
  | { kind: "none" };

export function classifyMerchantQrPayload(raw: string): ParseLightningResult {
  const text = stripWrappers(raw);
  if (!text) return { kind: "none" };

  const cleaned = text.split("?")[0].split("#")[0].trim();
  if (BOLT11_RE.test(cleaned) || BOLT11_RE.test(text.replace(/\s+/g, ""))) {
    return { kind: "invoice" };
  }

  // BIP21 bitcoin:...?lightning=lnbc...
  if (/[?&]lightning=(lnbc|lntb|lnbcrt|lnsb|lnb)/i.test(text)) {
    return { kind: "invoice" };
  }

  const address = extractAddressCandidate(text);
  if (address) return { kind: "address", address };

  return { kind: "none" };
}

export function parseMerchantLightningAddress(raw: string): string | null {
  const result = classifyMerchantQrPayload(raw);
  return result.kind === "address" ? result.address : null;
}

export function findMerchantByLightningAddress<T extends { lightningAddress: string }>(
  merchants: T[],
  address: string
): T | undefined {
  const key = address.trim().toLowerCase();
  return merchants.find((m) => m.lightningAddress.toLowerCase() === key);
}
