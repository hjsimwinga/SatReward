"use client";

const ROW1 = ["1", "2", "3", "4", "5"];
const ROW2 = ["6", "7", "8", "9", "0"];

type Props = {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
};

export function NumberPad({ value, onChange, disabled }: Props) {
  function press(key: string) {
    if (disabled) return;

    if (key === "⌫") {
      onChange(value.slice(0, -1));
      return;
    }

    if (key === ".") {
      if (value.includes(".")) return;
      onChange(value === "" ? "0." : `${value}.`);
      return;
    }

    if (value === "0") {
      onChange(key);
      return;
    }

    const next = value + key;
    if (next.replace(".", "").length > 12) return;

    const parts = next.split(".");
    if (parts[1] && parts[1].length > 2) return;

    onChange(next);
  }

  const keys = [...ROW1, ...ROW2];

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-5 gap-2">
        {keys.map((k) => (
          <button
            key={k}
            type="button"
            disabled={disabled}
            onClick={() => press(k)}
            className="tap-none flex h-12 items-center justify-center rounded-xl bg-stone-50 text-lg font-semibold text-stone-900 ring-1 ring-stone-100 transition-all duration-150 hover:bg-white hover:shadow-sm hover:ring-stone-200/80 active:scale-[0.96] disabled:opacity-40"
          >
            {k}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => press(".")}
          className="tap-none flex h-11 items-center justify-center rounded-xl bg-stone-50 text-lg font-semibold text-stone-900 ring-1 ring-stone-100 transition-all duration-150 hover:bg-white hover:shadow-sm hover:ring-stone-200/80 active:scale-[0.96] disabled:opacity-40"
        >
          .
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => press("⌫")}
          className="tap-none flex h-11 items-center justify-center rounded-xl bg-stone-100/80 text-lg font-semibold text-stone-500 ring-1 ring-stone-200/60 transition-all duration-150 hover:bg-stone-200/60 active:scale-[0.96] disabled:opacity-40"
        >
          ⌫
        </button>
      </div>
    </div>
  );
}
