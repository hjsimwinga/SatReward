import axios from "axios";

const BLINK_API_URL = "https://api.blink.sv/graphql";

const SEND_LN_ADDRESS_PAYMENT_MUTATION = `
  mutation LnAddressPaymentSend($input: LnAddressPaymentSendInput!) {
    lnAddressPaymentSend(input: $input) {
      status
      errors {
        message
        path
      }
    }
  }
`;

function isStablesatsEnabled(): boolean {
  return process.env.BLINK_USE_STABLESATS === "true";
}

function getSendWalletId(): string {
  const walletId = isStablesatsEnabled()
    ? process.env.BLINK_USD_WALLET_ID
    : process.env.BLINK_BTC_WALLET_ID || process.env.BLINK_WALLET_ID;
  if (!walletId) throw new Error("Blink wallet ID not configured");
  return walletId;
}

function parsePriceAmount(price: { base?: number; offset?: number } | null | undefined): number | null {
  if (!price) return null;
  const base = Number(price.base);
  const offset = Number(price.offset);
  if (!Number.isFinite(base) || !Number.isFinite(offset)) return null;
  const value = base / Math.pow(10, offset);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function zmwPerSatFromBlinkPrice(btcSatPrice: { base?: number; offset?: number } | null | undefined): number | null {
  const ngweePerSat = parsePriceAmount(btcSatPrice);
  if (ngweePerSat == null) return null;
  return ngweePerSat / 100;
}

function getReceiveWalletId(): string {
  return getSendWalletId();
}

const BTC_INVOICE_MUTATION = `
  mutation LnInvoiceCreate($input: LnInvoiceCreateInput!) {
    lnInvoiceCreate(input: $input) {
      invoice {
        paymentRequest
        paymentHash
        paymentSecret
        satoshis
      }
      errors {
        message
      }
    }
  }
`;

const USD_SATS_INVOICE_MUTATION = `
  mutation LnUsdInvoiceBtcDenominatedCreateOnBehalfOfRecipient(
    $input: LnUsdInvoiceBtcDenominatedCreateOnBehalfOfRecipientInput!
  ) {
    lnUsdInvoiceBtcDenominatedCreateOnBehalfOfRecipient(input: $input) {
      invoice {
        paymentRequest
        paymentHash
        paymentSecret
        satoshis
      }
      errors {
        message
      }
    }
  }
`;

const INVOICE_STATUS_QUERY = `
  query LnInvoicePaymentStatus($input: LnInvoicePaymentStatusInput!) {
    lnInvoicePaymentStatus(input: $input) {
      status
      errors {
        message
      }
    }
  }
`;

export type DonationInvoice = {
  paymentRequest: string;
  paymentHash: string;
  amountSats: number;
};

const ABS_MIN_DONATION_SATS = 1;
const MAX_DONATION_SATS = 10_000_000;

/** Blink USD wallets reject invoices below ~1 US cent. */
export async function getMinDonationSats(): Promise<number> {
  if (!isStablesatsEnabled()) return ABS_MIN_DONATION_SATS;

  const apiKey = process.env.BLINK_API_KEY;
  if (!apiKey) return 21;

  try {
    const response = await axios.post(
      BLINK_API_URL,
      {
        query: `
          query UsdPrice {
            realtimePrice(currency: "USD") {
              btcSatPrice { base offset }
            }
          }
        `,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": apiKey,
        },
        timeout: 10_000,
      }
    );

    const centsPerSat = parsePriceAmount(response.data?.data?.realtimePrice?.btcSatPrice);
    if (centsPerSat == null || centsPerSat <= 0) return 21;
    return Math.max(ABS_MIN_DONATION_SATS, Math.ceil(1 / centsPerSat));
  } catch {
    return 21;
  }
}

export async function createPoolDonationInvoice(amountSats: number): Promise<DonationInvoice> {
  const apiKey = process.env.BLINK_API_KEY;
  if (!apiKey) throw new Error("Blink API key not configured");

  const sats = Math.floor(Number(amountSats));
  if (!Number.isFinite(sats) || sats < ABS_MIN_DONATION_SATS) {
    throw new Error("Enter a valid amount in sats");
  }
  if (sats > MAX_DONATION_SATS) {
    throw new Error("Amount is too large");
  }

  const minSats = await getMinDonationSats();
  if (sats < minSats) {
    throw new Error(`Minimum donation is ${minSats.toLocaleString()} sats`);
  }

  const useStable = isStablesatsEnabled();
  const walletId = getReceiveWalletId();
  const memo = `SatReward pool donation · ${sats.toLocaleString()} sats`;

  const query = useStable ? USD_SATS_INVOICE_MUTATION : BTC_INVOICE_MUTATION;
  const variables = useStable
    ? {
        input: {
          recipientWalletId: walletId,
          amount: sats,
          memo,
          expiresIn: 15,
        },
      }
    : {
        input: {
          walletId,
          amount: sats,
          memo,
          expiresIn: 60,
        },
      };

  const response = await axios.post(
    BLINK_API_URL,
    { query, variables },
    {
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
      timeout: 15_000,
    }
  );

  if (response.data.errors?.length) {
    throw new Error(response.data.errors[0]?.message ?? "Failed to create donation invoice");
  }

  const payload = useStable
    ? response.data.data?.lnUsdInvoiceBtcDenominatedCreateOnBehalfOfRecipient
    : response.data.data?.lnInvoiceCreate;

  if (payload?.errors?.length) {
    throw new Error(payload.errors[0]?.message ?? "Donation invoice failed");
  }

  const invoice = payload?.invoice;
  if (!invoice?.paymentRequest || !invoice?.paymentHash) {
    throw new Error("No donation invoice returned");
  }

  return {
    paymentRequest: invoice.paymentRequest,
    paymentHash: invoice.paymentHash,
    amountSats: Number(invoice.satoshis) || sats,
  };
}

export async function isBlinkInvoicePaid(paymentHash: string): Promise<boolean> {
  const apiKey = process.env.BLINK_API_KEY;
  if (!apiKey) return false;

  try {
    const response = await axios.post(
      BLINK_API_URL,
      {
        query: INVOICE_STATUS_QUERY,
        variables: { input: { paymentHash } },
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": apiKey,
        },
        timeout: 10_000,
      }
    );

    const status = response.data?.data?.lnInvoicePaymentStatus?.status;
    return status === "PAID" || status === "SETTLED";
  } catch {
    return false;
  }
}

export type PoolBalance = {
  sats: number;
  zmw: number | null;
  updatedAt: string;
};

export async function getPoolBalance(): Promise<PoolBalance> {
  const apiKey = process.env.BLINK_API_KEY;
  if (!apiKey) throw new Error("Blink API key not configured");

  const query = `
    query Me {
      zmwPrice: realtimePrice(currency: "ZMW") {
        btcSatPrice { base offset }
      }
      realtimePrice(currency: "USD") {
        btcSatPrice { base offset }
      }
      me {
        defaultAccount {
          wallets {
            id
            walletCurrency
            balance
          }
        }
      }
    }
  `;

  const response = await axios.post(
    BLINK_API_URL,
    { query },
    {
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
      timeout: 15_000,
    }
  );

  if (response.data.errors?.length) {
    throw new Error(response.data.errors[0]?.message ?? "Failed to fetch pool balance");
  }

  const wallets = response.data?.data?.me?.defaultAccount?.wallets ?? [];
  const configuredWalletId = getSendWalletId();
  const configuredWallet = configuredWalletId
    ? wallets.find((w: { id: string }) => w.id === configuredWalletId)
    : null;
  const btcWallet = wallets.find(
    (w: { walletCurrency: string }) => String(w.walletCurrency).toUpperCase() === "BTC"
  );
  const targetWallet =
    configuredWallet ||
    btcWallet ||
    wallets.find((w: { balance: unknown }) => typeof w.balance === "number");

  if (!targetWallet || typeof targetWallet.balance !== "number") {
    throw new Error("No wallet balance available");
  }

  const walletCurrency = String(targetWallet.walletCurrency).toUpperCase();
  const centsPerSat = parsePriceAmount(response.data?.data?.realtimePrice?.btcSatPrice);
  const zmwPerSat = zmwPerSatFromBlinkPrice(response.data?.data?.zmwPrice?.btcSatPrice);

  let sats: number;
  if (walletCurrency === "USD") {
    const usdCents = Number(targetWallet.balance) || 0;
    if (!centsPerSat) throw new Error("Unable to convert USD balance to sats");
    sats = Math.floor(usdCents / centsPerSat);
  } else {
    sats = Number(targetWallet.balance) || 0;
  }

  const zmw = zmwPerSat != null ? sats * zmwPerSat : null;

  return {
    sats,
    zmw,
    updatedAt: new Date().toISOString(),
  };
}

export type ZmwRate = {
  zmwPerSat: number;
  satsPerZmw: number;
  minDonationSats: number;
  updatedAt: string;
};

export async function getZmwRate(): Promise<ZmwRate> {
  const apiKey = process.env.BLINK_API_KEY;
  if (!apiKey) throw new Error("Blink API key not configured");

  const query = `
    query Rate {
      zmwPrice: realtimePrice(currency: "ZMW") {
        btcSatPrice { base offset }
      }
      usdPrice: realtimePrice(currency: "USD") {
        btcSatPrice { base offset }
      }
    }
  `;

  const response = await axios.post(
    BLINK_API_URL,
    { query },
    {
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
      timeout: 15_000,
    }
  );

  if (response.data.errors?.length) {
    throw new Error(response.data.errors[0]?.message ?? "Failed to fetch rate");
  }

  const zmwPerSat = zmwPerSatFromBlinkPrice(
    response.data?.data?.zmwPrice?.btcSatPrice
  );
  if (zmwPerSat == null || zmwPerSat <= 0) {
    throw new Error("Invalid ZMW rate");
  }

  let minDonationSats = ABS_MIN_DONATION_SATS;
  if (useStablesats()) {
    const centsPerSat = parsePriceAmount(response.data?.data?.usdPrice?.btcSatPrice);
    if (centsPerSat != null && centsPerSat > 0) {
      minDonationSats = Math.max(ABS_MIN_DONATION_SATS, Math.ceil(1 / centsPerSat));
    } else {
      minDonationSats = 21;
    }
  }

  return {
    zmwPerSat,
    satsPerZmw: 1 / zmwPerSat,
    minDonationSats,
    updatedAt: new Date().toISOString(),
  };
}

export function zmwToSats(amountZmw: number, zmwPerSat: number): number {
  if (!Number.isFinite(amountZmw) || amountZmw <= 0) return 0;
  return Math.max(1, Math.floor(amountZmw / zmwPerSat));
}

export function satsToZmw(sats: number, zmwPerSat: number): number {
  return sats * zmwPerSat;
}

export function getRewardSats(): number {
  const n = parseInt(process.env.REWARD_SATS ?? "500", 10);
  if (!Number.isFinite(n) || n <= 0) return 500;
  return n;
}

export type BlinkSendResult = {
  success: boolean;
  error?: string;
};

export async function sendRewardToAddress(
  lightningAddress: string,
  amountSats: number
): Promise<BlinkSendResult> {
  const apiKey = process.env.BLINK_API_KEY;
  const walletId = getSendWalletId();

  if (!apiKey) {
    return { success: false, error: "Blink API key not configured" };
  }

  const trimmedAddress = lightningAddress.trim();

  try {
    const response = await axios.post(
      BLINK_API_URL,
      {
        query: SEND_LN_ADDRESS_PAYMENT_MUTATION,
        variables: {
          input: {
            walletId,
            lnAddress: trimmedAddress,
            amount: amountSats,
          },
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": apiKey,
        },
        timeout: 30_000,
      }
    );

    if (response.data.errors?.length) {
      return {
        success: false,
        error: response.data.errors[0]?.message ?? "Blink API error",
      };
    }

    const paymentData = response.data.data?.lnAddressPaymentSend;
    if (paymentData?.errors?.length) {
      return {
        success: false,
        error: paymentData.errors[0]?.message ?? "Reward payment failed",
      };
    }

    const status = String(paymentData?.status ?? "").toUpperCase();
    if (status === "SUCCESS" || status === "ALREADY_PAID") {
      return { success: true };
    }

    return { success: false, error: `Unexpected status: ${status || "unknown"}` };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Reward send failed",
    };
  }
}
