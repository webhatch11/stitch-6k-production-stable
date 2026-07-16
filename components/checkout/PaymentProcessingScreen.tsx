"use client";

import React from "react";

export function PaymentProcessingScreen() {
  return (
    <div className="fixed inset-0 bg-white flex flex-col items-center justify-center z-50 px-6">
      {/* Spinner */}
      <div className="w-16 h-16 border-4 border-gray-200 border-t-black rounded-full animate-spin mb-8" />

      <h2 className="text-xl font-bold text-gray-900 mb-2">
        Processing Payment...
      </h2>
      <p className="text-gray-500 text-center mb-4">
        Please wait while we confirm your payment
      </p>

      {/* Warning */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 max-w-xs text-center">
        <p className="text-amber-700 text-sm font-medium">
          ⚠️ Please don't close or refresh this page
        </p>
      </div>
    </div>
  );
}
