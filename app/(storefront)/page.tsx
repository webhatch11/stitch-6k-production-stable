import { db } from "@/lib/db";
import HomeClient from "./page-client";

export const dynamic = "force-dynamic";

export default async function Home() {
  const hero = await db.getSetting("hero");
  const business = await db.getSetting("business");
  const marquee = await db.getSetting("marquee");
  const offerBox = await db.getSetting("offer_box");

  const newArrivals = await db.getProducts({ display_section: "new_arrivals" });
  const exclusives = await db.getProducts({ display_section: "atelier_exclusives" });
  const bestsellers = await db.getProducts({ display_section: "bestsellers" });

  return (
    <HomeClient
      hero={hero}
      business={business}
      marquee={marquee}
      offerBox={offerBox}
      newArrivals={newArrivals}
      exclusives={exclusives}
      bestsellers={bestsellers}
    />
  );
}
