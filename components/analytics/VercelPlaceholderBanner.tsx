"use client";
import React from "react";

export function VercelPlaceholderBanner() {
  const isMockMode = !process.env.NEXT_PUBLIC_GTM_ID || 
    process.env.NEXT_PUBLIC_GTM_ID === '' ||
    process.env.NEXT_PUBLIC_GTM_ID === 'GTM-XXXXXX';

  if (!isMockMode) {
    return null;
  }

  return (
    <div className="bg-amber-950/40 border border-amber-500/30 rounded-lg p-6 mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 backdrop-blur-md">
      <div className="flex items-center gap-4">
        <span className="material-symbols-outlined text-amber-500 text-3xl shrink-0 animate-pulse">warning</span>
        <div>
          <h3 className="text-sm font-black text-white uppercase tracking-wider mb-1">Sandbox / Mock Mode Active</h3>
          <p className="text-xs text-white/60 leading-relaxed max-w-xl">
            Some analytics tracking IDs are currently using default placeholders. Configure tracking IDs in Vercel &rarr; Environment Variables to activate production tracking.
          </p>
        </div>
      </div>
      <a
        href="https://vercel.com/dashboard"
        target="_blank"
        rel="noopener noreferrer"
        className="px-5 py-2.5 bg-amber-500 text-[#0a0a0a] text-[10px] font-black uppercase tracking-widest hover:bg-amber-400 transition-colors flex items-center gap-2 shrink-0 select-none"
      >
        <span>Open Vercel &rarr;</span>
        <span className="material-symbols-outlined text-[12px] font-black">open_in_new</span>
      </a>
    </div>
  );
}
