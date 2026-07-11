"use client";

type Props = {
  onClick: () => void;
  className?: string;
};

export function BackButton({ onClick, className = "" }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Back"
      className={`tap-none inline-flex items-center text-ink-soft transition duration-200 hover:text-ink active:scale-95 ${className}`}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-gradient-to-b from-white to-[#f4f2ee] shadow-[0_1px_0_rgb(255_255_255)_inset,0_4px_12px_-6px_rgb(15_23_42/0.18)] ring-1 ring-line/80 transition hover:ring-gold/30">
        <svg
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.25}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M15 6l-6 6 6 6" />
        </svg>
      </span>
    </button>
  );
}
