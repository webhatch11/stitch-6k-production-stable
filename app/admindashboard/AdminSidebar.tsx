"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

interface AdminSidebarProps {
  user: { id: string; email: string; role: string };
  children: React.ReactNode;
}

export default function AdminSidebar({ user, children }: AdminSidebarProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const navLinks = [
    {
      href: "/admindashboard",
      label: "Dashboard",
      icon: "dashboard",
      exact: true,
    },
    {
      href: "/admindashboard/inventory",
      label: "Inventory",
      icon: "inventory_2",
    },
    {
      href: "/admindashboard/orders",
      label: "Orders",
      icon: "shopping_basket",
    },
    {
      href: "/admindashboard/customers",
      label: "Customers",
      icon: "group",
    },
    {
      href: "/admindashboard/invoices",
      label: "Invoices",
      icon: "description",
    },
    {
      href: "/admindashboard/add-product",
      label: "Add Product",
      icon: "add_box",
    },
    {
      href: "/admindashboard/coupons",
      label: "Coupons",
      icon: "confirmation_number",
    },
    {
      href: "/admindashboard/settings",
      label: "Settings",
      icon: "settings",
    },
  ];

  const isActive = (link: (typeof navLinks)[0]) => {
    if (link.exact) {
      return pathname === link.href;
    }
    return pathname.startsWith(link.href);
  };

  const handleLogout = async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    } else {
      document.cookie = "mock_user_session=; path=/; max-age=0";
      document.cookie = "mock_user_role=; path=/; max-age=0";
      document.cookie = "mock_user_email=; path=/; max-age=0";
      document.cookie = "mock_user_name=; path=/; max-age=0";
      localStorage.removeItem("mock_user_session");
      localStorage.removeItem("mock_user_profile");
    }
    router.push("/login");
  };

  const emailInitial = user.email ? user.email.charAt(0).toUpperCase() : "A";
  const displayEmail =
    user.email.length > 24 ? user.email.slice(0, 22) + "…" : user.email;

  return (
    <div className="bg-[#f9fafb] text-[#111827] font-body min-h-screen flex antialiased">
      {/* Admin Sidebar Drawer */}
      <aside
        id="adminSidebar"
        className={`fixed inset-y-0 left-0 w-72 bg-[#0a0a0a] flex-col z-[60] transform -translate-x-full lg:translate-x-0 lg:sticky lg:top-0 lg:h-screen transition-transform duration-300 ease-in-out flex shrink-0 ${
          sidebarOpen ? "translate-x-0" : ""
        }`}
      >
        {/* Brand identity */}
        <div className="p-8 border-b border-white/10 mb-8 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="size-10 bg-[#fed488] text-[#0a0a0a] flex items-center justify-center font-headline font-black text-lg">
              6K
            </div>
            <div>
              <h1 className="font-headline font-bold text-sm uppercase tracking-widest text-white">Admin Portal</h1>
              <p className="text-[9px] text-white/40 uppercase tracking-[0.2em]">6K Designer Shirts Management</p>
            </div>
          </div>
          {/* Close Sidebar (Mobile only) */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 text-white bg-transparent border-none cursor-pointer flex items-center justify-center"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Navigation lists */}
        <nav className="flex-1 px-4 space-y-2">
          <p className="px-4 text-[10px] font-black uppercase tracking-[0.3em] text-white/60 mb-4">Management</p>
          {navLinks.map((link) => {
            const active = isActive(link);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-4 px-4 py-3.5 rounded-none transition-all ${
                  active
                    ? "bg-white/10 text-white border-l-3 border-[#fed488]"
                    : "text-white/50 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span className="material-symbols-outlined text-lg">{link.icon}</span>
                <span className="text-xs font-bold uppercase tracking-widest">{link.label}</span>
              </Link>
            );
          })}

          <div className="pt-4 border-t border-white/10 mt-4">
            <p className="px-4 text-[10px] font-black uppercase tracking-[0.3em] text-white/60 mb-4">Storefront</p>
            <Link
              href="/"
              className="flex items-center gap-4 px-4 py-3.5 text-white/50 hover:bg-white/5 hover:text-white rounded-none transition-all"
            >
              <span className="material-symbols-outlined text-lg">storefront</span>
              <span className="text-xs font-bold uppercase tracking-widest">View Store</span>
            </Link>
          </div>
        </nav>

        {/* Signed In User profile card */}
        <div className="p-6 bg-white/5 border-t border-white/10">
          <div className="flex items-center gap-4 mb-4">
            <div className="size-10 rounded-full border border-white/20 bg-[#fed488] text-[#0a0a0a] flex items-center justify-center font-headline font-black text-lg shrink-0">
              {emailInitial}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold font-headline text-white truncate">{displayEmail}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="size-1.5 bg-green-500 rounded-full animate-pulse"></span>
                <p className="text-[9px] text-white/40 uppercase tracking-widest">Signed In</p>
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 w-full py-3 bg-white/10 text-[10px] font-black uppercase tracking-widest text-white hover:bg-red-600/80 hover:text-white transition-all border-none cursor-pointer"
          >
            Sign Out <span className="material-symbols-outlined text-sm">logout</span>
          </button>
        </div>
      </aside>

      {/* Background Overlay (mobile menu) */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-[#0a0a0a]/40 z-[55] lg:hidden"
        ></div>
      )}

      {/* Main Administrative content wrapper */}
      <div className="flex-grow flex flex-col min-w-0">
        {/* Mobile Header bar */}
        <header className="lg:hidden bg-[#0a0a0a] text-white px-6 py-4 flex items-center justify-between z-50 shadow-md">
          <div className="flex items-center gap-3">
            <div className="size-8 bg-[#fed488] text-[#0a0a0a] flex items-center justify-center font-headline font-black text-sm">
              6K
            </div>
            <span className="font-headline font-bold text-xs uppercase tracking-widest">Admin Portal</span>
          </div>
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 text-white bg-transparent border-none cursor-pointer flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-2xl">menu</span>
          </button>
        </header>

        <main className="flex-grow overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
