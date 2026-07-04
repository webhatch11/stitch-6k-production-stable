import { db } from "@/lib/db";
import HomeClient from "./page-client";

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

