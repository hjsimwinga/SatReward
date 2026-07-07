const STORAGE_KEY = "satreward_recent_reward_addresses";
const MAX = 5;

export function getRecentRewardAddresses(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string" && x.includes("@"));
  } catch {
    return [];
  }
}

export function saveRecentRewardAddress(address: string): void {
  if (typeof window === "undefined") return;
  const trimmed = address.trim();
  if (!trimmed.includes("@")) return;

  const key = trimmed.toLowerCase();
  const rest = getRecentRewardAddresses().filter((a) => a.toLowerCase() !== key);
  const updated = [trimmed, ...rest].slice(0, MAX);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export function shortAddress(address: string): string {
  const at = address.indexOf("@");
  if (at <= 0) return address;
  const user = address.slice(0, at);
  const domain = address.slice(at);
  if (user.length <= 10) return address;
  return `${user.slice(0, 8)}…${domain}`;
}
