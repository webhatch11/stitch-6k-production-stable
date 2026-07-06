import { db } from "@/lib/db";
import HomeClient from "./page-client";
import { Metadata } from "next";

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
  const hero = await db.getSetting("hero");
  const business = await db.getSetting("business");
  const marquee = await db.getSetting("marquee");
  const offerBox = await db.getSetting("offer_box");
  const trustBadges = await db.getSetting("trust_badges");
  const categories = await db.getSetting("categories");
  const approvedReviews = await db.getReviews({ approved: true });

  const newArrivals = await db.getProducts({ display_section: "new_arrivals" });
  const exclusives = await db.getProducts({ display_section: "atelier_exclusives" });
  const bestsellers = await db.getProducts({ display_section: "bestsellers" });

  return (
    <HomeClient
      hero={hero}
      business={business}
      marquee={marquee}
      offerBox={offerBox}
      trustBadges={trustBadges}
      categories={categories}
      approvedReviews={approvedReviews}
      newArrivals={newArrivals}
      exclusives={exclusives}
      bestsellers={bestsellers}
    />
  );
}

