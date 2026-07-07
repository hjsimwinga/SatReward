"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { NumberPad } from "@/components/NumberPad";

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
      .get("/api/rate/zmw")
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
      <div className="rounded-2xl bg-stone-50/70 px-4 py-5 ring-1 ring-stone-100/80">
        <p className="text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-400">
          Amount to pay
        </p>

        <div className="mt-2 flex items-baseline justify-center gap-1">
          <span className="text-3xl font-bold text-stone-400">K</span>
          <p className="text-5xl font-bold tabular-nums tracking-tight text-stone-900">
            {displayAmount(value)}
          </p>
        </div>

        <p className="mt-1 text-center text-sm font-medium text-stone-400">Zambian Kwacha</p>

        {satsPreview != null && (
          <p className="mt-3 text-center text-sm text-stone-500">
            ≈{" "}
            <span className="font-semibold text-stone-700">
              {satsPreview.toLocaleString()} sats
            </span>
          </p>
        )}
      </div>

      <NumberPad value={value} onChange={onChange} disabled={disabled} />
    </div>
  );
}
