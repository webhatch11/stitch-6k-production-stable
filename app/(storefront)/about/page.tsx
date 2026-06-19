"use client";

import React from "react";

export default function AboutPage() {
  return (
    <main className="max-w-4xl mx-auto px-6 py-24 flex-grow w-full">
      <span className="text-[10px] font-black uppercase tracking-[0.4em] text-secondary">OUR STORY</span>
      <h1 className="font-headline text-5xl font-black uppercase tracking-tighter text-on-surface mt-4 mb-12">
        About Stitch 6K
      </h1>
      <div className="space-y-8 text-sm text-outline leading-relaxed uppercase tracking-wider font-semibold">
        <section className="bg-surface-container-low p-8 border border-outline-variant/10">
          <h3 className="text-on-surface font-black text-lg mb-4">Heritage Craftsmanship</h3>
          <p>
            Stitch 6K was founded with a single mission: to bridge the gap between ancient handloom weaving heritage and contemporary streetwear aesthetic. Every piece is designed and meticulously crafted in our Tiruppur facilities, honoring generations of craftsmanship.
          </p>
        </section>
        <section className="bg-surface-container-low p-8 border border-outline-variant/10">
          <h3 className="text-on-surface font-black text-lg mb-4">Sustainable Manufacturing</h3>
          <p>
            We operate at the highest standards of ethical manufacturing, paying fair living wages to our master weavers and sourcing 100% natural, locally grown organic cotton and premium linen fibers.
          </p>
        </section>
      </div>
    </main>
  );
}
