"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface LiveOrder {
  id: string;
  customer: string;
  city: string;
  itemName: string;
  itemCount: number;
  total: number;
  createdAt: string;
}

interface ToastItem {
  toastId: string; // unique per notification
  order: LiveOrder;
  addedAt: number;
}

const POLL_INTERVAL = 10_000; // 10 seconds
const AUTO_DISMISS = 5_000;  // 5 seconds

export default function LiveOrderToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  // Track the timestamp of the last check so we only get *new* orders
  const sinceRef = useRef<string>(new Date().toISOString());

  const dismiss = useCallback((toastId: string) => {
    setToasts((prev) => prev.filter((t) => t.toastId !== toastId));
  }, []);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/admin/live-orders?since=${encodeURIComponent(sinceRef.current)}`,
        { cache: "no-store" }
      );
      if (!res.ok) return;
      const json = await res.json();
      const orders: LiveOrder[] = json.orders || [];

      if (orders.length > 0) {
        // Advance the cursor to the most recent order's timestamp
        sinceRef.current = orders[0].createdAt;

        const newToasts: ToastItem[] = orders.map((o) => ({
          toastId: `${o.id}-${Date.now()}-${Math.random()}`,
          order: o,
          addedAt: Date.now(),
        }));

        setToasts((prev) => [...newToasts, ...prev].slice(0, 5)); // cap at 5 visible

        // Schedule auto-dismiss for each
        newToasts.forEach((t) => {
          setTimeout(() => dismiss(t.toastId), AUTO_DISMISS);
        });
      }
    } catch {
      // Silently ignore network errors
    }
  }, [dismiss]);

  useEffect(() => {
    // Initial poll after a short delay (let page settle)
    const initTimer = setTimeout(poll, 2000);
    const interval = setInterval(poll, POLL_INTERVAL);
    return () => {
      clearTimeout(initTimer);
      clearInterval(interval);
    };
  }, [poll]);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-label="New order notifications"
      className="fixed bottom-6 right-6 z-[9999] flex flex-col-reverse gap-3 pointer-events-none"
      style={{ maxWidth: "320px" }}
    >
      {toasts.map((t, i) => (
        <Toast
          key={t.toastId}
          item={t}
          index={i}
          onDismiss={() => dismiss(t.toastId)}
        />
      ))}
    </div>
  );
}

function Toast({
  item,
  index,
  onDismiss,
}: {
  item: ToastItem;
  index: number;
  onDismiss: () => void;
}) {
  const { order } = item;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Slight stagger so stacked toasts animate in nicely
    const t = setTimeout(() => setVisible(true), index * 80);
    return () => clearTimeout(t);
  }, [index]);

  const formatted = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(order.total);

  const shortId = order.id.startsWith("6K-") ? `#${order.id}` : `#${order.id.slice(0, 12)}`;

  return (
    <div
      style={{
        transform: visible ? "translateX(0)" : "translateX(calc(100% + 24px))",
        opacity: visible ? 1 : 0,
        transition: "transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.25s ease",
        pointerEvents: "all",
      }}
    >
      <div
        style={{
          background: "linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 100%)",
          border: "1px solid #2a2a2a",
          borderLeft: "3px solid #fed488",
          borderRadius: "12px",
          padding: "14px 16px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          minWidth: "280px",
          maxWidth: "320px",
          cursor: "default",
        }}
      >
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
            <span style={{ fontSize: "16px" }}>🛍️</span>
            <span
              style={{
                color: "#fed488",
                fontWeight: 700,
                fontSize: "12px",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              New Order!
            </span>
          </div>
          <button
            onClick={onDismiss}
            aria-label="Dismiss notification"
            style={{
              background: "none",
              border: "none",
              color: "#666",
              cursor: "pointer",
              fontSize: "16px",
              lineHeight: 1,
              padding: "0 2px",
              display: "flex",
              alignItems: "center",
            }}
          >
            ×
          </button>
        </div>

        {/* Customer + city */}
        <div
          style={{
            color: "#ffffff",
            fontSize: "14px",
            fontWeight: 600,
          }}
        >
          {order.customer}
          {order.city ? (
            <span style={{ color: "#999", fontWeight: 400 }}> from {order.city}</span>
          ) : null}
        </div>

        {/* Item + price */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ color: "#ccc", fontSize: "13px" }}>
            {order.itemName}
            {order.itemCount > 1 ? (
              <span style={{ color: "#666", fontSize: "11px" }}>
                {" "}+{order.itemCount - 1} more
              </span>
            ) : null}
          </span>
          <span style={{ color: "#fed488", fontWeight: 700, fontSize: "13px" }}>
            {formatted}
          </span>
        </div>

        {/* Order ID + timestamp */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: "2px",
          }}
        >
          <span style={{ color: "#555", fontSize: "11px", fontFamily: "monospace" }}>
            {shortId}
          </span>
          <span style={{ color: "#555", fontSize: "11px" }}>Just now</span>
        </div>

        {/* Progress bar */}
        <div
          style={{
            marginTop: "4px",
            height: "2px",
            borderRadius: "2px",
            background: "#2a2a2a",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              background: "#fed488",
              width: "100%",
              transformOrigin: "left",
              animation: `shrink ${AUTO_DISMISS}ms linear forwards`,
            }}
          />
        </div>
      </div>

      <style>{`
        @keyframes shrink {
          from { transform: scaleX(1); }
          to   { transform: scaleX(0); }
        }
      `}</style>
    </div>
  );
}
