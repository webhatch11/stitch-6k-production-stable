import React from "react";
import AnnouncementMarquee from "@/components/layout/AnnouncementMarquee";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

export default function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen">
      <AnnouncementMarquee />
      <Navbar />
      <div className="flex-grow">{children}</div>
      <Footer />
    </div>
  );
}
