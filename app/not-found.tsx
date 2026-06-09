"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export default function NotFound() {
  return (
    <div className="bg-surface text-on-surface min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="max-w-md w-full relative"
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-outline-variant/5 rounded-full blur-3xl -z-10"></div>
        
        <h1 className="text-[120px] leading-none font-headline font-black tracking-tighter text-[#fed488]/20 select-none mb-4 relative">
          404
          <span className="absolute inset-0 flex items-center justify-center text-4xl text-on-surface tracking-tight uppercase">
            Not Found
          </span>
        </h1>
        
        <p className="text-xs uppercase tracking-widest text-outline/80 mb-10 leading-relaxed max-w-sm mx-auto">
          The collection or piece you are looking for has been moved or does not exist in our current registry.
        </p>

        <div className="flex flex-col gap-4 max-w-[200px] mx-auto">
          <Link 
            href="/shopallshirts"
            className="bg-[#775a19] text-white px-8 py-3 rounded-lg text-[10px] font-black tracking-[0.2em] uppercase hover:bg-[#fed488] hover:text-primary transition-all active:scale-95 shadow-md flex items-center justify-center gap-2"
          >
            Explore Collections
          </Link>
          
          <Link 
            href="/"
            className="border border-outline-variant/30 text-on-surface px-8 py-3 rounded-lg text-[10px] font-black tracking-[0.2em] uppercase hover:bg-white/10 transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            Return to Atrium
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
