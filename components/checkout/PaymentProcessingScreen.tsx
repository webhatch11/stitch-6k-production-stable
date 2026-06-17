"use client";

import { motion } from "framer-motion";

export function PaymentProcessingScreen() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm text-white">
      {/* Stitch 6K Logo Animation */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
        className="mb-8 relative flex items-center justify-center"
      >
        <h1 className="text-5xl md:text-7xl font-black tracking-tighter uppercase text-transparent bg-clip-text bg-gradient-to-r from-zinc-200 to-zinc-600">
          STITCH 6K
        </h1>
        {/* Subtle glow effect */}
        <div className="absolute inset-0 blur-2xl bg-white/10 rounded-full" />
      </motion.div>

      {/* Processing Text */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex flex-col items-center space-y-4"
      >
        <h2 className="text-xl md:text-2xl font-light tracking-widest uppercase">
          Processing your order...
        </h2>
        <p className="text-zinc-400 text-sm max-w-xs text-center">
          Please do not close this window or press back while we securely process your payment.
        </p>
      </motion.div>
      
      {/* Progress Bar Animation */}
      <div className="w-64 h-1 bg-zinc-800 rounded-full mt-10 overflow-hidden relative">
        <motion.div 
          className="absolute top-0 left-0 h-full bg-white rounded-full"
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        />
      </div>
    </div>
  );
}
