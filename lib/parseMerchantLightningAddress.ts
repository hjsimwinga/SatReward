const LIGHTNING_ADDRESS_RE = /^[a-z0-9._-]{1,100}@[a-z0-9.-]+\.[a-z]{2,}$/i;
const LNURL_WELL_KNOWN_RE =
  /^(?:https?:\/\/)?([^/]+)\/\.well-known\/lnurlp\/([^/?#]+)/i;

function normalizeAddress(user: string, domain: string): string {
  return `${decodeURIComponent(user).toLowerCase()}@${domain.toLowerCase()}`;
}

export function parseMerchantLightningAddress(raw: string): string | null {
  let text = raw.trim();
  if (!text) return null;

  if (/^lightning:/i.test(text)) {
    text = text.replace(/^lightning:/i, "").trim();
  }

  text = text.split("?")[0].split("#")[0].trim();

  if (LIGHTNING_ADDRESS_RE.test(text)) {
    return text.toLowerCase();
  }

  const lnurlMatch = text.match(LNURL_WELL_KNOWN_RE);
  if (lnurlMatch) {
    return normalizeAddress(lnurlMatch[2], lnurlMatch[1]);
  }

  const at = text.lastIndexOf("@");
  if (at > 0 && at < text.length - 1) {
    const candidate = text.slice(0, at + 1) + text.slice(at + 1).split(/[/:?#]/)[0];
    if (LIGHTNING_ADDRESS_RE.test(candidate)) {
      return candidate.toLowerCase();
    }
  }

  return null;
}

export function findMerchantByLightningAddress<T extends { lightningAddress: string }>(
  merchants: T[],
  address: string
): T | undefined {
  const key = address.trim().toLowerCase();
  return merchants.find((m) => m.lightningAddress.toLowerCase() === key);
}
