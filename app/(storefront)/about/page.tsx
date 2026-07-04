import React from "react";
import type { Metadata } from "next";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "About Us | Stitch 6K",
  description: "The story of Stitch 6K — premium menswear born from the looms of South India.",
};

export default function AboutPage() {
  return (
    <main className="max-w-4xl mx-auto px-6 py-24 flex-grow w-full">
      <span className="text-[10px] font-black uppercase tracking-[0.4em] text-secondary">OUR STORY</span>
      <h1 className="font-headline text-5xl font-black uppercase tracking-tighter text-on-surface mt-4 mb-12">
        About 6K Brand
      </h1>
      <div className="space-y-8 text-sm text-outline leading-relaxed uppercase tracking-wider font-semibold">
        <section className="bg-surface-container-low p-8 border border-outline-variant/10">
          <h3 className="text-on-surface font-black text-lg mb-4">Welcome to 6K Brand</h3>
          <p>
            Welcome to 6K Brand, where style meets quality.
          </p>
        </section>
        <section className="bg-surface-container-low p-8 border border-outline-variant/10 space-y-4">
          <p>
            At 6K Brand, we believe clothing is more than just fabric—it's a reflection of your personality, confidence, and lifestyle. We are dedicated to creating premium-quality shirts that combine comfort, durability, and modern fashion for everyday wear.
          </p>
          <p>
            Our mission is to provide customers with stylish, high-quality apparel while delivering an exceptional online shopping experience. Every product is crafted with attention to quality, fit, and customer satisfaction.
          </p>
          <p>
            Our vision is to become one of India's most trusted fashion brands by offering premium clothing, outstanding customer service, and a seamless shopping experience.
          </p>
        </section>
        <section className="bg-surface-container-low p-8 border border-outline-variant/10 text-center">
          <h4 className="text-secondary font-black text-base uppercase tracking-[0.25em]">
            Be Original. Be 6K. Wear the Standard.
          </h4>
        </section>
      </div>
    </main>
  );
}
