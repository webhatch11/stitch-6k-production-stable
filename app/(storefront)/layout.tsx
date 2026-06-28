import React from "react";
import AnnouncementMarquee from "@/components/layout/AnnouncementMarquee";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const business = await db.getSetting("business");
  return (
    <div className="flex flex-col min-h-screen">
      <AnnouncementMarquee />
      <Navbar />
      <div className="flex-grow">{children}</div>
      <Footer business={business} />
    </div>
  );
}
