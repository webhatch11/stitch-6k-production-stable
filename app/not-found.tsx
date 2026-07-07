"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";

export default function NotFound() {
  return (
    <div className="bg-[#0a0a0a] text-white min-h-screen flex flex-col items-center justify-center p-8 text-center font-body">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="max-w-md w-full relative space-y-6"
      >
        {/* Glow backdrop */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-[#BA7517]/5 rounded-full blur-3xl -z-10"></div>

        <h1 className="text-[120px] font-bold text-[#BA7517] leading-none mb-4 tracking-tighter">
          404
        </h1>

        <h2 className="text-2xl font-medium tracking-widest uppercase text-white mb-4">
          PAGE NOT FOUND
        </h2>

        <p className="text-gray-400 text-sm leading-relaxed max-w-sm mx-auto mb-8">
          The page you are looking for does not exist or has been moved.
        </p>

        <div className="flex flex-col gap-4 max-w-[240px] mx-auto pt-4">
          <Link
            href="/"
            className="bg-[#BA7517] text-white py-3.5 px-8 text-xs font-black tracking-widest uppercase hover:bg-[#fed488] hover:text-black transition-all active:scale-95 shadow-md flex items-center justify-center rounded-[4px]"
          >
            BACK TO HOME
          </Link>

          <Link
            href="/shopallshirts"
            className="text-[#BA7517] hover:text-white transition-colors text-xs font-bold tracking-wider"
          >
            Browse our collection →
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
