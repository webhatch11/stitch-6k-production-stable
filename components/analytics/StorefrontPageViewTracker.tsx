"use client";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

export function StorefrontPageViewTracker() {
  const pathname = usePathname();

  // 1. Capture UTM parameters from URL and store in sessionStorage immediately
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("utm_source")) {
        sessionStorage.setItem("utm_source", params.get("utm_source") || "");
        sessionStorage.setItem("utm_medium", params.get("utm_medium") || "");
        sessionStorage.setItem("utm_campaign", params.get("utm_campaign") || "");
      }
    }
  }, [pathname]);

  // 2. Report storefront page view for active online visitors auditing
  useEffect(() => {
    if (typeof window === "undefined") return;

    let sessionId = sessionStorage.getItem("storefront_session_id");
    if (!sessionId) {
      sessionId = "sess_" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      sessionStorage.setItem("storefront_session_id", sessionId);
    }

    const reportPageView = async () => {
      try {
        await fetch("/api/analytics/pageview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path: pathname,
            sessionId,
          }),
        });
      } catch (err) {
        console.error("Failed to report page view:", err);
      }
    };

    reportPageView();
  }, [pathname]);

  return null;
}
