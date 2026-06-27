import { db } from "@/lib/db";
import HomeClient from "./page-client";

export const dynamic = "force-dynamic";

export default async function Home() {
  const hero = await db.getSetting("hero");
  const business = await db.getSetting("business");
  return <HomeClient hero={hero} business={business} />;
}
