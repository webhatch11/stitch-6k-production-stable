"use client";

import React from "react";
import { usePathname } from "next/navigation";
import AnnouncementMarquee from "@/components/layout/AnnouncementMarquee";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

export default function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() || "/";
  const isHome = pathname === "/";

  return (
    <div className="flex flex-col min-h-screen">
      {!isHome && <AnnouncementMarquee />}
      <Navbar />
      <div className="flex-grow">{children}</div>
      <Footer />
    </div>
  );
}
