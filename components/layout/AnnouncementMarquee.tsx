"use client";

import React from "react";

export default function AnnouncementMarquee() {
  return (
    <div className="marquee-container overflow-hidden w-full bg-on-surface text-surface py-2.5 text-[10px] font-bold uppercase tracking-[0.2em] relative z-[60]">
      <div className="flex animate-marquee whitespace-nowrap">
        <div className="flex shrink-0 items-center gap-12 px-6">
          <span>FREE DELIVERY ACROSS INDIA</span>
          <span className="text-secondary-fixed-dim">•</span>
          <span>USE CODE <span className="text-secondary-fixed-dim font-extrabold">FESTIVE24</span> FOR 10% OFF</span>
          <span className="text-secondary-fixed-dim">•</span>
          <span>100% PREMIUM COTTON & LINEN</span>
          <span className="text-secondary-fixed-dim">•</span>
          <span>EASY 7-DAY RETURNS</span>
          <span className="text-secondary-fixed-dim">•</span>
        </div>
        <div className="flex shrink-0 items-center gap-12 px-6">
          <span>FREE DELIVERY ACROSS INDIA</span>
          <span className="text-secondary-fixed-dim">•</span>
          <span>USE CODE <span className="text-secondary-fixed-dim font-extrabold">FESTIVE24</span> FOR 10% OFF</span>
          <span className="text-secondary-fixed-dim">•</span>
          <span>100% PREMIUM COTTON & LINEN</span>
          <span className="text-secondary-fixed-dim">•</span>
          <span>EASY 7-DAY RETURNS</span>
          <span className="text-secondary-fixed-dim">•</span>
        </div>
      </div>
    </div>
  );
}
