"use client";

import React from "react";

export default function Loading() {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#0a0a0a"
    }}>
      <div className="animate-spin rounded-full h-10 w-10 border-2 border-white/20 border-t-[#BA7517]" />
    </div>
  );
}
