"use client";

import React from "react";
import { usePathname } from "next/navigation";

interface AnnouncementMarqueeProps {
  marquee?: {
    enabled: boolean;
    items: string[];
  };
  isHomepage?: boolean;
}

export default function AnnouncementMarquee({ marquee, isHomepage = false }: AnnouncementMarqueeProps) {
  const pathname = usePathname();

  // If isHomepage is false, but we are on the homepage, don't show the global/header one.
  if (!isHomepage && pathname === "/") return null;

  // If no settings are passed, or it is disabled, don't show it.
  if (!marquee || !marquee.enabled || !marquee.items || marquee.items.length === 0) {
    return null;
  }

  const items = marquee.items;

  if (isHomepage) {
    return (
      <div className="marquee-container overflow-hidden w-full bg-[#1a1c1c] text-[#775a19] py-4 md:py-5 text-[11px] md:text-[12px] font-black uppercase tracking-[0.3em] relative z-20 border-y border-[#775a19]/30 shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
        <div className="flex animate-marquee whitespace-nowrap">
          <div className="flex shrink-0 items-center justify-around min-w-full gap-12 px-6">
            {items.map((item, idx) => (
              <React.Fragment key={idx}>
                <span className="drop-shadow-[0_0_8px_rgba(119,90,25,0.4)]">{item}</span>
                <span className="text-white/20 font-black px-4">•</span>
              </React.Fragment>
            ))}
          </div>
          <div className="flex shrink-0 items-center justify-around min-w-full gap-12 px-6">
            {items.map((item, idx) => (
              <React.Fragment key={idx}>
                <span className="drop-shadow-[0_0_8px_rgba(119,90,25,0.4)]">{item}</span>
                <span className="text-white/20 font-black px-4">•</span>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="marquee-container overflow-hidden w-full bg-[#1a1c1c] text-[#775a19] py-2 text-[9px] font-black uppercase tracking-[0.3em] relative z-[60] border-y border-[#775a19]/30 shadow-md">
      <div className="flex animate-marquee whitespace-nowrap">
        <div className="flex shrink-0 items-center gap-12 px-6">
          {items.map((item, idx) => (
            <React.Fragment key={idx}>
              <span className="drop-shadow-[0_0_5px_rgba(119,90,25,0.4)]">{item}</span>
              <span className="text-white/20 font-black px-4">•</span>
            </React.Fragment>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-12 px-6">
          {items.map((item, idx) => (
            <React.Fragment key={idx}>
              <span>{item}</span>
              <span className="text-[#775a19] font-black">•</span>
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
