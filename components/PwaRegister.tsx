"use client";

import { useEffect } from "react";
import { apiPath } from "@/lib/apiPath";

export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const swUrl = apiPath("/sw.js");
    void navigator.serviceWorker.register(swUrl).catch(() => {
      /* ignore register failures in unsupported contexts */
    });
  }, []);

  return null;
}
