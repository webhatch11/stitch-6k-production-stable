"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export function StorefrontTracker() {
  const pathname = usePathname();
  const sessionId = useRef<string>("");

  useEffect(() => {
    // Get or create a stable session ID from sessionStorage
    if (!sessionId.current) {
      const stored = sessionStorage.getItem("storefront_session_id");
      if (stored) {
        sessionId.current = stored;
      } else {
        const newId =
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : "sess_" +
              Math.random().toString(36).substring(2, 15) +
              Math.random().toString(36).substring(2, 15);
        sessionStorage.setItem("storefront_session_id", newId);
        sessionId.current = newId;
      }
    }

    const ping = () => {
      fetch("/api/analytics/ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionId.current,
          page: pathname,
        }),
      }).catch(() => {});
    };

    // Ping immediately on page change
    ping();

    // Keep session "active" by pinging every 45s
    const interval = setInterval(ping, 45000);

    // Add unload handler
    const handleUnload = () => {
      if (sessionId.current) {
        navigator.sendBeacon(
          '/api/analytics/ping-leave',
          JSON.stringify({ 
            sessionId: sessionId.current 
          })
        )
      }
    }

    window.addEventListener(
      'beforeunload', 
      handleUnload
    )

    return () => {
      clearInterval(interval)
      window.removeEventListener(
        'beforeunload',
        handleUnload
      )
      // Ping on unmount too
      handleUnload()
    }
  }, [pathname]);

  return null;
}
