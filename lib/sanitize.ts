const MAX_LA_LEN = 200;

export function sanitizeLightningAddress(input: string): string {
  const s = input.trim().slice(0, MAX_LA_LEN);
  if (s.length < 3) throw new Error("Lightning Address is too short");
  return s;
}

export function normalizeRewardAddress(input: string): string {
  return sanitizeLightningAddress(input).toLowerCase();
}
