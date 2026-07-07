"use client";

import { useState, useEffect } from "react";

export function useToast() {
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const showToast = (
    message: string,
    type: "success" | "error" = "success"
  ) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  return { toast, showToast };
}

export function Toast({
  message,
  type
}: {
  message: string;
  type: "success" | "error";
}) {
  return (
    <div style={{
      position: "fixed",
      bottom: "24px",
      right: "24px",
      background: type === "success" ? "#1a1a1a" : "#dc2626",
      color: "#ffffff",
      padding: "12px 20px",
      borderRadius: "4px",
      fontSize: "13px",
      fontWeight: "500",
      zIndex: 9999,
      display: "flex",
      alignItems: "center",
      gap: "8px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
      animation: "slideUp 0.2s ease"
    }}>
      {type === "success" ? "✓" : "✗"}
      {message}
      <style>{`
        @keyframes slideUp {
          from {
            transform: translateY(8px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
