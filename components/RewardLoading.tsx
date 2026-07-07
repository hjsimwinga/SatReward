"use client";

type Props = {
  address: string;
};

export function RewardLoading({ address }: Props) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 px-4 py-5 ring-1 ring-blue-500/40">
      <div className="reward-shimmer pointer-events-none absolute inset-0 opacity-30" />
      <div className="relative flex flex-col items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="reward-dot h-2 w-2 rounded-full bg-white" style={{ animationDelay: "0ms" }} />
          <span className="reward-dot h-2 w-2 rounded-full bg-blue-100" style={{ animationDelay: "180ms" }} />
          <span className="reward-dot h-2 w-2 rounded-full bg-white/80" style={{ animationDelay: "360ms" }} />
        </div>
        <p className="text-sm font-medium text-blue-50">Sending your reward…</p>
        <p className="max-w-[240px] truncate text-xs text-blue-100/80">{address}</p>
      </div>
    </div>
  );
}
