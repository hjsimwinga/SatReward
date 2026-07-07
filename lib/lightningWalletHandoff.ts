export type LightningWalletOption = {
  id: string;
  label: string;
  accent: string;
  logoPath: string;
  uriPrefix: string;
};

export const PAY_SHEET_WALLETS: LightningWalletOption[] = [
  {
    id: "blink",
    label: "Blink Wallet",
    accent: "#F26522",
    logoPath: "/wallets/walletsblink.png",
    uriPrefix: "blink:lightning:",
  },
  {
    id: "walletofsatoshi",
    label: "Wallet of Satoshi",
    accent: "#FFC107",
    logoPath: "/wallets/walletswalletofsatoshi.png",
    uriPrefix: "walletofsatoshi:lightning:",
  },
  {
    id: "phoenix",
    label: "Phoenix",
    accent: "#00C853",
    logoPath: "/wallets/walletsphoenix.png",
    uriPrefix: "phoenix:lightning:",
  },
  {
    id: "muun",
    label: "Muun",
    accent: "#1976D2",
    logoPath: "/wallets/walletsmuun.png",
    uriPrefix: "muun:lightning:",
  },
  {
    id: "fedi",
    label: "Fedi",
    accent: "#7C4DFF",
    logoPath: "/wallets/walletsfedi.png",
    uriPrefix: "fedi:lightning:",
  },
];

export function bolt11PaymentRequest(invoice: string): string {
  let s = invoice.trim();
  if (s.toLowerCase().startsWith("lightning:")) {
    s = s.slice("lightning:".length).trim();
  }
  return s;
}

export function walletHandoffUri(wallet: LightningWalletOption, invoice: string): string {
  return `${wallet.uriPrefix}${bolt11PaymentRequest(invoice)}`;
}

export function genericLightningUri(invoice: string): string {
  return `lightning:${bolt11PaymentRequest(invoice)}`;
}

export function openWalletUri(uri: string): void {
  const link = document.createElement("a");
  link.href = uri;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    window.location.href = uri;
  }
}

export function openInWallet(invoice: string, wallet?: LightningWalletOption): void {
  const uri = wallet ? walletHandoffUri(wallet, invoice) : genericLightningUri(invoice);
  openWalletUri(uri);
}
