"use client";

import { motion } from "framer-motion";
import { XCircle, RefreshCw, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface PaymentFailureScreenProps {
  onRetry: () => void;
  errorMsg?: string;
}

export function PaymentFailureScreen({ onRetry, errorMsg }: PaymentFailureScreenProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 backdrop-blur-md text-white px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-8 flex flex-col items-center text-center shadow-2xl"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", bounce: 0.5, delay: 0.2 }}
          className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mb-6"
        >
          <XCircle className="w-10 h-10 text-red-500" />
        </motion.div>

        <h2 className="text-3xl font-bold tracking-tight mb-3 text-white">Payment Failed</h2>
        
        <p className="text-zinc-400 mb-8 text-sm leading-relaxed">
          {errorMsg || "We couldn't process your payment. Your account has not been charged. Please try again or use a different payment method."}
        </p>

        <div className="flex flex-col w-full space-y-3">
          <button
            onClick={onRetry}
            className="w-full py-4 bg-white text-black font-semibold rounded-xl flex items-center justify-center space-x-2 hover:bg-zinc-200 transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
            <span>Retry Payment</span>
          </button>
          
          <Link href="/shoppingbag" className="w-full py-4 bg-transparent border border-zinc-800 text-white font-medium rounded-xl hover:bg-zinc-800 transition-colors flex items-center justify-center">
            <ArrowLeft className="w-4 h-4 mr-2" /> Return to Cart
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
