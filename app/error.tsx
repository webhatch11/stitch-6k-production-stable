"use client";

import { useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import * as Sentry from '@sentry/nextjs';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service in production
    console.error("Global Error Caught:", error);
    if (error) {
      Sentry.captureException(error, {
        tags: { 
          component: 'ErrorBoundary',
          type: 'unhandled_error'
        }
      });
    }
  }, [error]);

  return (
    <div className="bg-surface text-on-surface min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="max-w-md w-full relative"
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-[#fed488]/10 rounded-full blur-3xl -z-10"></div>
        <span className="material-symbols-outlined text-6xl text-[#775a19] mb-6">warning</span>
        
        <h1 className="text-3xl font-headline font-black uppercase tracking-tight mb-4">
          Atelier Interruption
        </h1>
        
        <p className="text-xs uppercase tracking-widest text-outline/80 mb-10 leading-relaxed">
          Our systems encountered an unexpected thread anomaly. We apologize for the inconvenience in your bespoke experience.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => reset()}
            className="bg-[#775a19] text-white px-8 py-3 rounded-lg text-[10px] font-black tracking-[0.2em] uppercase hover:bg-[#fed488] hover:text-primary transition-all active:scale-95 shadow-md flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            Attempt Recovery
          </button>
          
          <Link 
            href="/"
            className="border border-outline-variant/30 text-on-surface px-8 py-3 rounded-lg text-[10px] font-black tracking-[0.2em] uppercase hover:bg-white/10 transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">home</span>
            Return Home
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
