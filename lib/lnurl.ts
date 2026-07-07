/**
 * LNURL-pay (LUD-06) helpers — server-safe, no DOM.
 */

export type LnurlPayMetadata = {
  callback: string;
  minSendable: number;
  maxSendable: number;
  metadata: string;
  tag: string;
  allowsNostr?: boolean;
  nostrPubkey?: string;
};

export type SettlementHints = {
  checkingId?: string;
  invoiceId?: string;
  reference?: string;
};

export type InvoiceResponse = {
  pr: string;
  routes?: unknown[];
  successAction?: {
    tag: string;
    message?: string;
    url?: string;
    description?: string;
  };
  verify?: string;
  verifyUrls?: string[];
  settlementHints?: SettlementHints;
  disposable?: boolean | null;
};

const URL_PATH_HINT =
  /verify|check|status|invoice|settle|lnurl|poll|paid|payment|callback|lookup|query|lnurlp/i;

export function harvestSettlementUrls(raw: Record<string, unknown>): string[] {
  const acc = new Set<string>();

  function walk(v: unknown, depth: number): void {
    if (depth > 6 || acc.size > 45) return;
    if (typeof v === "string") {
      const s = v.trim();
      if (s.startsWith("https://") || s.startsWith("http://")) {
        try {
          const u = new URL(s);
          const hay = `${u.pathname}${u.search}`.toLowerCase();
          if (URL_PATH_HINT.test(hay) || URL_PATH_HINT.test(s.toLowerCase())) {
            acc.add(s.length > 4096 ? s.slice(0, 4096) : s);
          }
        } catch {
          /* ignore */
        }
      }
      return;
    }
    if (Array.isArray(v)) {
      for (const x of v.slice(0, 60)) walk(x, depth + 1);
      return;
    }
    if (v && typeof v === "object") {
      for (const x of Object.values(v as Record<string, unknown>).slice(0, 100)) {
        walk(x, depth + 1);
      }
    }
  }

  walk(raw, 0);
  return [...acc];
}

export function extractSettlementHints(raw: Record<string, unknown>): SettlementHints {
  const h: SettlementHints = {};
  const str = (v: unknown): string | null =>
    typeof v === "string" && v.length >= 2 && v.length <= 512 ? v : null;

  const cid =
    str(raw.checking_id) ||
    str(raw.checkingId) ||
    str(raw.check_id) ||
    str(raw.checkId) ||
    str(raw.checkingID);
  if (cid) h.checkingId = cid;

  const iid = str(raw.invoice_id) || str(raw.invoiceId) || str(raw.invoiceID);
  if (iid) h.invoiceId = iid;

  const ref =
    str(raw.reference) ||
    str(raw.ref) ||
    str(raw.external_id) ||
    str(raw.externalId) ||
    str(raw.payment_id) ||
    str(raw.paymentId);
  if (ref) h.reference = ref;

  return h;
}

export function collectVerifyUrlsFromInvoiceRaw(raw: Record<string, unknown>): string[] {
  const keys = [
    "verify",
    "verifyUrl",
    "verify_url",
    "check_url",
    "checkUrl",
    "check",
    "confirmationURL",
    "confirmation_url",
    "statusUrl",
    "status_url",
    "pollingUrl",
    "polling_url",
    "invoiceStatusUrl",
    "invoice_status_url",
  ];
  const urls: string[] = [];
  for (const k of keys) {
    const v = raw[k];
    if (typeof v === "string" && v.trim().startsWith("http")) urls.push(v.trim());
  }
  if (Array.isArray(raw.routes)) {
    for (const r of raw.routes) {
      if (r && typeof r === "object") {
        const o = r as Record<string, unknown>;
        for (const k of ["verify", "verify_url", "url", "statusUrl"]) {
          const v = o[k];
          if (typeof v === "string" && v.trim().startsWith("http")) urls.push(v.trim());
        }
      }
    }
  }
  return [...new Set(urls)];
}

const LNURLP_USER_AGENT = "SatReward/1.0";

function sanitizeDomain(domain: string): string {
  const d = domain.trim().toLowerCase();
  if (!/^[a-z0-9.-]+$/.test(d) || d.length > 253) {
    throw new Error("Invalid domain in Lightning Address");
  }
  return d;
}

function sanitizeUsername(user: string): string {
  const u = user.trim().toLowerCase();
  if (!/^[a-z0-9._-]{1,100}$/.test(u)) {
    throw new Error("Invalid username in Lightning Address");
  }
  return encodeURIComponent(u);
}

export function parseLightningAddress(address: string): { user: string; domain: string } {
  const trimmed = address.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || at === trimmed.length - 1) {
    throw new Error("Lightning Address must look like user@domain.com");
  }
  const user = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  return { user, domain: sanitizeDomain(domain) };
}

export function lnurlPayWellKnownUrl(address: string): string {
  const { user, domain } = parseLightningAddress(address);
  const enc = sanitizeUsername(user);
  return `https://${domain}/.well-known/lnurlp/${enc}`;
}

export function validateAmountMsats(
  amountMsats: bigint,
  minSendable: number,
  maxSendable: number
): void {
  if (amountMsats < BigInt(minSendable) || amountMsats > BigInt(maxSendable)) {
    throw new Error(
      `Amount must be between ${minSendable} and ${maxSendable} millisatoshis`
    );
  }
}

export async function fetchJson<T>(
  url: string,
  opts: { timeoutMs?: number; maxBytes?: number } = {}
): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? 25_000;
  const maxBytes = opts.maxBytes ?? 512_000;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": LNURLP_USER_AGENT,
      },
      cache: "no-store",
    });
    const buf = await res.arrayBuffer();
    if (buf.byteLength > maxBytes) {
      throw new Error("LNURL response too large");
    }
    const text = new TextDecoder().decode(buf);
    if (!res.ok) {
      throw new Error(`LNURL HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    return JSON.parse(text) as T;
  } finally {
    clearTimeout(t);
  }
}

export type LnurlResolveResult = LnurlPayMetadata & { raw: unknown };

export async function resolveLnurlPay(address: string): Promise<LnurlResolveResult> {
  const wellKnown = lnurlPayWellKnownUrl(address);
  const raw = await fetchJson<Record<string, unknown>>(wellKnown);

  if (raw.status === "ERROR" && typeof raw.reason === "string") {
    throw new Error(raw.reason);
  }

  const tag = raw.tag;
  if (tag !== "payRequest") {
    throw new Error("This address does not support LNURL-pay");
  }

  const callback = raw.callback;
  if (typeof callback !== "string" || !callback.startsWith("http")) {
    throw new Error("Invalid LNURL callback URL");
  }

  const minSendable = raw.minSendable;
  const maxSendable = raw.maxSendable;
  const metadata = raw.metadata;

  if (typeof minSendable !== "number" || typeof maxSendable !== "number") {
    throw new Error("Invalid LNURL send limits");
  }
  if (typeof metadata !== "string") {
    throw new Error("Invalid LNURL metadata");
  }

  return {
    callback,
    minSendable,
    maxSendable,
    metadata,
    tag: "payRequest",
    allowsNostr: typeof raw.allowsNostr === "boolean" ? raw.allowsNostr : undefined,
    nostrPubkey: typeof raw.nostrPubkey === "string" ? raw.nostrPubkey : undefined,
    raw,
  };
}

export async function requestLnurlInvoice(
  callbackBase: string,
  amountMsats: bigint
): Promise<InvoiceResponse> {
  const u = new URL(callbackBase);
  u.searchParams.set("amount", amountMsats.toString());

  const raw = await fetchJson<Record<string, unknown>>(u.toString());

  if (raw.status === "ERROR" && typeof raw.reason === "string") {
    throw new Error(raw.reason);
  }

  const pr = raw.pr;
  if (typeof pr !== "string" || !pr.toLowerCase().startsWith("ln")) {
    throw new Error("LNURL did not return a valid BOLT11 invoice");
  }

  const out: InvoiceResponse = {
    pr,
    disposable: typeof raw.disposable === "boolean" ? raw.disposable : null,
  };

  if (raw.routes !== undefined) out.routes = raw.routes as unknown[];

  if (raw.successAction && typeof raw.successAction === "object") {
    const sa = raw.successAction as Record<string, unknown>;
    const tag = sa.tag != null ? String(sa.tag).toLowerCase() : "";
    if (tag === "message" || tag === "url" || tag === "aes") {
      out.successAction = {
        tag,
        message: typeof sa.message === "string" ? sa.message : undefined,
        url: typeof sa.url === "string" ? sa.url : undefined,
        description: typeof sa.description === "string" ? sa.description : undefined,
      };
    }
  }

  const manual = collectVerifyUrlsFromInvoiceRaw(raw);
  const harvested = harvestSettlementUrls(raw);
  const verifyUrls = [...new Set([...manual, ...harvested])];
  if (verifyUrls.length > 0) {
    out.verifyUrls = verifyUrls;
    out.verify = verifyUrls[0];
  }

  const hints = extractSettlementHints(raw);
  if (hints.checkingId || hints.invoiceId || hints.reference) {
    out.settlementHints = hints;
  }

  return out;
}
