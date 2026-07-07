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
      className={`group mb-4 inline-flex items-center gap-1.5 rounded-full py-1.5 pl-1 pr-3 text-sm font-semibold text-stone-500 transition-all duration-200 hover:bg-stone-100 hover:text-stone-800 active:scale-95 ${className}`}
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-100 transition-colors group-hover:bg-white group-hover:shadow-sm">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path stroke="none" d="M0 0h24v24H0z" fill="none" />
          <path d="M5 12l14 0" />
          <path d="M5 12l4 4" />
          <path d="M5 12l4 -4" />
        </svg>
      </span>
      Back
    </button>
  );
}
