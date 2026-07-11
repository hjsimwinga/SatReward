"use client";

type Props = {
  address: string;
};

export function RewardLoading({ address }: Props) {
  return (
    <div className="relative overflow-hidden rounded-[18px] bg-gradient-to-b from-[#f7f1e4] to-[#efe6d4] px-4 py-5 ring-1 ring-gold/25 shadow-[0_1px_0_rgb(255_255_255_/_0.7)_inset]">
      <div className="reward-shimmer pointer-events-none absolute inset-0 opacity-30" />
      <div className="relative flex flex-col items-center gap-2.5">
        <div className="flex items-center gap-1.5">
          <span className="reward-dot h-1.5 w-1.5 rounded-sm bg-accent" style={{ animationDelay: "0ms" }} />
          <span className="reward-dot h-1.5 w-1.5 rounded-sm bg-accent/70" style={{ animationDelay: "180ms" }} />
          <span className="reward-dot h-1.5 w-1.5 rounded-sm bg-accent/40" style={{ animationDelay: "360ms" }} />
        </div>
        <p className="text-sm font-semibold text-ink">Sending your reward…</p>
        <p className="max-w-[240px] truncate text-xs text-mute">{address}</p>
      </div>
    </div>
  );
}
