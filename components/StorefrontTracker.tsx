"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export function StorefrontTracker() {
  const pathname = usePathname();
  const sessionId = useRef<string>("");

  useEffect(() => {
    // Ignore admin dashboard routes
    if (pathname && (pathname.startsWith("/admindashboard") || pathname.startsWith("/admin"))) {
      return;
    }

    // Get or create a stable session ID from sessionStorage
    if (!sessionId.current) {
      const stored = typeof window !== "undefined" ? sessionStorage.getItem("storefront_session_id") : null;
      if (stored) {
        sessionId.current = stored;
      } else {
        const newId =
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : "sess_" +
              Math.random().toString(36).substring(2, 15) +
              Math.random().toString(36).substring(2, 15);
        if (typeof window !== "undefined") {
          sessionStorage.setItem("storefront_session_id", newId);
        }
        sessionId.current = newId;
      }
    }

    const ping = () => {
      if (!sessionId.current) return;
      fetch("/api/analytics/ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionId.current,
          page: pathname || "/",
        }),
      }).catch(() => {});
    };

    // Ping immediately on page change
    ping();

    // Heartbeat every 20 seconds while active
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        ping();
      }
    }, 20000);

    // Instant ping when switching back to active tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        ping();
      } else {
        handleUnload();
      }
    };

    const handleUnload = () => {
      if (sessionId.current) {
        navigator.sendBeacon(
          "/api/analytics/ping-leave",
          JSON.stringify({
            sessionId: sessionId.current,
          })
        );
      }
    };

    window.addEventListener("beforeunload", handleUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", handleUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [pathname]);

  return null;
}
