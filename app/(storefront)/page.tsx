import { db } from "@/lib/db";
import { Metadata } from "next";
import dynamic from "next/dynamic";

const HomeClient = dynamic(() => import("./page-client"), { ssr: true });

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://the6k.com"
  ),
  title: "6K Brand — Premium Streetwear",
  description: "Heritage craftsmanship meets Gen-Z streetwear. Premium cotton and linen shirts from Tamil Nadu, India.",
  openGraph: {
    title: "6K Brand — Premium Streetwear",
    description: "Heritage craftsmanship meets Gen-Z streetwear.",
    url: "https://the6k.com",
    siteName: "6K Brand",
    images: [{
      url: "/og-default.jpg",
      width: 1200,
      height: 630,
      alt: "6K Brand — Premium Streetwear"
    }],
    type: "website",
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "6K Brand — Premium Streetwear",
    description: "Heritage craftsmanship meets Gen-Z streetwear.",
    images: ["/og-default.jpg"],
  }
};

// ISR: serve cached HTML, regenerate at most every 60s. Admin saves also
// trigger on-demand revalidation via revalidatePath.
export const revalidate = 60;

export default async function Home() {
  // Run all DB queries in parallel; any individual failure returns a safe fallback
  // instead of crashing the entire page render.
  const [
    hero,
    business,
    marquee,
    offerBox,
    trustBadges,
    categories,
    approvedReviews,
    newArrivals,
    exclusives,
    bestsellers,
  ] = await Promise.allSettled([
    db.getSetting("hero"),
    db.getSetting("business"),
    db.getSetting("marquee"),
    db.getSetting("offer_box"),
    db.getSetting("trust_badges"),
    db.getSetting("categories"),
    db.getReviews({ approved: true }),
    db.getProducts({ display_section: "new_arrivals" }),
    db.getProducts({ display_section: "atelier_exclusives" }),
    db.getProducts({ display_section: "bestsellers" }),
  ]).then((results) => results.map((r, i) => {
    if (r.status === "rejected") {
      console.error(`[Home] DB query ${i} failed:`, r.reason);
      // Return safe defaults: arrays for lists, null for settings
      return [6, 7, 8, 9].includes(i) ? [] : null;
    }
    return r.value;
  }));

  return (
    <HomeClient
      hero={hero}
      business={business}
      marquee={marquee}
      offerBox={offerBox}
      trustBadges={trustBadges}
      categories={categories}
      approvedReviews={approvedReviews ?? []}
      newArrivals={newArrivals ?? []}
      exclusives={exclusives ?? []}
      bestsellers={bestsellers ?? []}
    />
  );
}
