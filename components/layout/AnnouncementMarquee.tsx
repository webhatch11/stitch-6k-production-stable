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
      <div className="marquee-container overflow-hidden w-full bg-on-surface text-surface py-4.5 text-[11px] font-black uppercase tracking-[0.25em] relative z-20 border-y border-white/5">
        <div className="flex animate-marquee whitespace-nowrap">
          <div className="flex shrink-0 items-center justify-around min-w-full gap-12 px-6">
            {items.map((item, idx) => (
              <React.Fragment key={idx}>
                <span>{item}</span>
                <span className="text-secondary-fixed-dim font-extrabold">•</span>
              </React.Fragment>
            ))}
          </div>
          <div className="flex shrink-0 items-center justify-around min-w-full gap-12 px-6">
            {items.map((item, idx) => (
              <React.Fragment key={idx}>
                <span>{item}</span>
                <span className="text-secondary-fixed-dim font-extrabold">•</span>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="marquee-container overflow-hidden w-full bg-[#1a1c1c] text-[#faf9f8] py-1.5 text-[9px] font-black uppercase tracking-[0.3em] relative z-[60] border-y border-[#7f7667]/20">
      <div className="flex animate-marquee whitespace-nowrap">
        <div className="flex shrink-0 items-center gap-12 px-6">
          {items.map((item, idx) => (
            <React.Fragment key={idx}>
              <span>{item}</span>
              <span className="text-[#775a19] font-black">•</span>
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
