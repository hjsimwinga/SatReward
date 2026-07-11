"use client";

import { useCallback, useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  if (typeof window === "undefined") return true;
  const mq = window.matchMedia("(display-mode: standalone)").matches;
  const ios =
    "standalone" in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return mq || ios;
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function ZapMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M13.2 2.1 5.4 13.4c-.25.36 0 .85.43.85h5.02l-1.2 7.4c-.1.62.7.98 1.12.5l8.1-11.1c.27-.37.01-.9-.44-.9h-5.2l1.35-7.55c.1-.58-.66-.93-1.08-.5Z" />
    </svg>
  );
}

export function InstallAppFab() {
  const [ready, setReady] = useState(false);
  const [installed, setInstalled] = useState(true);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [hintOpen, setHintOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isStandalone()) {
      setInstalled(true);
      return;
    }

    setInstalled(false);

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
      setHintOpen(false);
    };

    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);

    // Soft entrance — don’t crowd first paint
    const t = window.setTimeout(() => setReady(true), 900);

    return () => {
      window.clearTimeout(t);
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (busy) return;

    if (deferred) {
      setBusy(true);
      try {
        await deferred.prompt();
        const choice = await deferred.userChoice;
        if (choice.outcome === "accepted") setInstalled(true);
      } finally {
        setDeferred(null);
        setBusy(false);
      }
      return;
    }

    setHintOpen((v) => !v);
  }, [busy, deferred]);

  if (installed || !ready) return null;

  return (
    <div
      className="pointer-events-none fixed z-[60] flex flex-col items-end gap-2"
      style={{
        right: "max(0.85rem, env(safe-area-inset-right))",
        bottom: "max(0.85rem, env(safe-area-inset-bottom))",
      }}
    >
      {hintOpen && (
        <div className="pointer-events-auto animate-soft-enter w-[min(220px,calc(100vw-1.75rem))] rounded-2xl border border-white/70 bg-white/85 px-3.5 py-3 shadow-[0_10px_30px_-16px_rgb(15_23_42/0.35)] backdrop-blur-md">
          <p className="text-[12px] font-semibold tracking-tight text-ink">Add to Home Screen</p>
          <p className="mt-1 text-[11px] leading-snug text-mute">
            {isIos() ? (
              <>
                Tap Share, then <span className="font-medium text-ink-soft">Add to Home Screen</span>.
              </>
            ) : (
              <>
                Open the browser menu and choose{" "}
                <span className="font-medium text-ink-soft">Install app</span>.
              </>
            )}
          </p>
          <button
            type="button"
            onClick={() => setHintOpen(false)}
            className="mt-2 text-[11px] font-semibold text-accent"
          >
            Close
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => void install()}
        disabled={busy}
        aria-label="Install SatReward"
        className="pointer-events-auto group flex h-9 items-center gap-1.5 rounded-full border border-white/80 bg-white/80 pl-2 pr-3 shadow-[0_8px_24px_-14px_rgb(15_23_42/0.4)] backdrop-blur-md transition duration-300 hover:bg-white hover:shadow-[0_10px_28px_-12px_rgb(15_23_42/0.45)] active:scale-[0.97] disabled:opacity-60"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-b from-[#e8d19a] to-[#b8893d] text-white shadow-[0_1px_0_rgb(255_255_255/0.35)_inset]">
          <ZapMark className="h-3 w-3" />
        </span>
        <span className="text-[11px] font-semibold tracking-[0.04em] text-ink-soft">
          Install
        </span>
      </button>
    </div>
  );
}
