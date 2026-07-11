"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { NumberPad } from "@/components/NumberPad";
import { apiPath } from "@/lib/apiPath";

type Props = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

function displayAmount(value: string): string {
  if (!value) return "0";
  return value;
}

export function AmountInput({ value, onChange, disabled }: Props) {
  const [zmwPerSat, setZmwPerSat] = useState<number | null>(null);

  useEffect(() => {
    axios
      .get(apiPath("/api/rate/zmw"))
      .then((res) => {
        if (res.data?.ok) setZmwPerSat(res.data.zmwPerSat ?? null);
      })
      .catch(() => {});
  }, []);

  const amountZmw = parseFloat(value);
  const satsPreview = useMemo(() => {
    if (!zmwPerSat || !Number.isFinite(amountZmw) || amountZmw <= 0) return null;
    return Math.max(1, Math.floor(amountZmw / zmwPerSat));
  }, [amountZmw, zmwPerSat]);

  return (
    <div className="space-y-5">
      <div className="rounded-[20px] bg-gradient-to-b from-wash to-[#eef3f7] px-4 py-6 text-center ring-1 ring-line shadow-[0_1px_0_rgb(255_255_255_/_0.8)_inset]">
        <p className="label-quiet">Amount</p>
        <div className="mt-2 flex items-baseline justify-center gap-1">
          <span className="font-display text-3xl text-mute/60">K</span>
          <p className="font-display text-5xl tnum text-ink">{displayAmount(value)}</p>
        </div>
        <p className="mt-1.5 text-sm font-medium text-mute">Zambian Kwacha</p>
        {satsPreview != null && (
          <p className="mt-3 text-sm text-mute">
            ≈{" "}
            <span className="font-semibold tnum text-ink-soft">
              {satsPreview.toLocaleString()} sats
            </span>
          </p>
        )}
      </div>

      <NumberPad value={value} onChange={onChange} disabled={disabled} />
    </div>
  );
}
