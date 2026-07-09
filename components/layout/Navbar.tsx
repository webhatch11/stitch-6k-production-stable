"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useCartStore } from "@/stores/cartStore";
import { createBrowserClient } from "@supabase/ssr";
import { User } from "@supabase/supabase-js";

export default function Navbar() {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const cartItems = useCartStore((state) => state.cartItems);
  const cartCount = cartItems.length;

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );

  // Monitor auth state
  useEffect(() => {
    const getUser = async () => {
      if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        setUser(currentUser);
      }
    };
    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  // Sync mock user in development if Supabase not configured
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      const mockSession = localStorage.getItem("mock_user_session");
      if (mockSession) {
        const mockProfile = localStorage.getItem("mock_user_profile");
        if (mockProfile) {
          const parsed = JSON.parse(mockProfile);
          setUser({
            id: parsed.id,
            email: parsed.email,
            user_metadata: { full_name: parsed.name },
          } as any);
        }
      } else {
        setUser(null);
      }
    }
  }, [pathname]);

  const handleSignOut = async () => {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      await supabase.auth.signOut();
    } else {
      localStorage.removeItem("mock_user_session");
      localStorage.removeItem("mock_user_profile");
      document.cookie = "mock_user_session=; path=/; max-age=0";
      setUser(null);
    }
    useCartStore.getState().clearCart();
    setDropdownOpen(false);
    router.push("/");
    router.refresh();
  };

  const initial = user?.user_metadata?.full_name?.[0] || user?.email?.[0] || "U";
  const displayInitial = initial.toUpperCase();

  // Monitor scroll height to handle dynamic navbar transitions
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    handleScroll(); // Initial run
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const isHome = pathname === "/";
  const isGenz = pathname.startsWith("/genz");

  // Determine navbar styles based on page theme & scroll status
  let headerClass = "fixed top-0 left-0 right-0 z-[100] transition-all duration-500 pt-[calc(0.5rem+env(safe-area-inset-top,0px))] pb-2.5 ";
  let linkClass = "text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 relative after:absolute after:-bottom-1 after:left-0 after:w-0 after:h-[1px] after:transition-all after:duration-300 ";
  let logoBgClass = "w-11 h-11 rounded-full p-1.5 flex items-center justify-center shadow-md transition-all duration-500 ";
  let iconClass = "material-symbols-outlined hover:text-[#fed488] hover-scale transition-all duration-300 ";

  if (isHome) {
    if (isScrolled) {
      headerClass += "bg-[#faf9f8]/95 backdrop-blur-md border-b border-[#775a19]/10 shadow-sm";
      linkClass += "text-on-surface/60 hover:text-on-surface after:bg-on-surface hover:after:w-full";
      logoBgClass += "bg-white border border-[#775a19]/15 shadow-[0_0_12px_rgba(119,90,25,0.08)]";
      iconClass += "text-on-surface";
    } else {
      headerClass += "bg-transparent border-transparent";
      linkClass += "text-white/70 hover:text-white after:bg-white hover:after:w-full";
      logoBgClass += "bg-black/45 backdrop-blur-md border border-white/20 shadow-[0_0_12px_rgba(255,255,255,0.05)]";
      iconClass += "text-white";
    }
  } else if (isGenz) {
    headerClass += "bg-black/60 backdrop-blur-md border-b border-[#fed488]/10 shadow-sm";
    linkClass += "text-white/70 hover:text-[#fed488] after:bg-[#fed488] hover:after:w-full";
    logoBgClass += "bg-black border border-[#fed488]/20 shadow-[0_0_12px_rgba(254,212,136,0.1)]";
    iconClass += "text-white";
  } else {
    // Standard storefront pages
    headerClass += "bg-[#faf9f8]/95 backdrop-blur-md border-b border-[#775a19]/10 shadow-sm";
    linkClass += "text-outline hover:text-primary after:bg-primary hover:after:w-full";
    logoBgClass += "bg-white border border-[#775a19]/15 shadow-[0_0_12px_rgba(119,90,25,0.08)]";
    iconClass += "text-on-surface";
  }

  const isLinkActive = (path: string) => {
    if (path === "/") return pathname === "/";
    return pathname === path || pathname.startsWith(path);
  };

  return (
    <>
      {/* Desktop Navigation Header */}
      <header className={headerClass}>
        <div className="flex items-center justify-between max-w-[1400px] mx-auto px-4 md:px-8 lg:px-12 transition-all duration-500 relative min-h-[48px] md:min-h-0">
          <div className="flex items-center gap-12 w-full md:w-auto">
            {/* Logo */}
            <Link href="/" className="flex items-center group hover-scale z-10">
              <div className={logoBgClass}>
                <Image
                  src="/assets/logo.png"
                  alt="6K Logo"
                  width={48}
                  height={48}
                  priority
                  className="max-w-full max-h-full object-contain"
                  draggable={false}
                />
              </div>
            </Link>

            {/* Desktop Menu links */}
            <nav className="hidden md:flex items-center gap-8">
              <Link 
                className={`${linkClass} ${isLinkActive("/") ? "after:w-full text-primary font-bold" : ""}`} 
                href="/"
              >
                Home
              </Link>
              <Link 
                className={`${linkClass} ${isLinkActive("/genz") ? "after:w-full text-[#fed488] font-bold" : ""}`} 
                href="/genz"
              >
                GEN-Z
              </Link>
              <Link 
                className={`${linkClass} ${isLinkActive("/shopallshirts") ? "after:w-full text-primary font-bold" : ""}`} 
                href="/shopallshirts"
              >
                Shop All
              </Link>
              <Link 
                className={`${linkClass} ${isLinkActive("/orderhistory") ? "after:w-full text-primary font-bold" : ""}`} 
                href="/orderhistory"
              >
                Order History
              </Link>
              <Link 
                className={`${linkClass} ${isLinkActive("/ordertracking") ? "after:w-full text-primary font-bold" : ""}`} 
                href="/ordertracking"
              >
                Track Order
              </Link>
            </nav>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-5 z-10">
            <Link
              href="/shoppingbag"
              className={`${iconClass} relative`}
            >
              shopping_bag
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center border bg-secondary text-white border-surface">
                  {cartCount}
                </span>
              )}
            </Link>
            {user ? (
              <div className="relative hidden md:block">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="w-8 h-8 rounded-full bg-[#BA7517] text-white flex items-center justify-center text-xs font-black uppercase border border-white/20 shadow-md focus:outline-none cursor-pointer hover:scale-105 transition-transform"
                >
                  {displayInitial}
                </button>
                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-100 shadow-xl rounded-none py-2 z-50 animate-in fade-in duration-200">
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Signed in as</p>
                      <p className="text-[10px] text-black font-black truncate">{user.user_metadata?.full_name || user.email}</p>
                    </div>
                    <Link
                      href="/myprofile"
                      onClick={() => setDropdownOpen(false)}
                      className="block px-4 py-2 text-xs font-bold uppercase tracking-wider text-gray-700 hover:bg-gray-50 hover:text-black"
                    >
                      My Profile
                    </Link>
                    <Link
                      href="/orderhistory"
                      onClick={() => setDropdownOpen(false)}
                      className="block px-4 py-2 text-xs font-bold uppercase tracking-wider text-gray-700 hover:bg-gray-50 hover:text-black"
                    >
                      Order History
                    </Link>
                    <button
                      onClick={handleSignOut}
                      className="w-full text-left block px-4 py-2 text-xs font-bold uppercase tracking-wider text-red-600 hover:bg-gray-50 hover:text-red-700 border-none bg-transparent cursor-pointer"
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href="/login"
                className={`hidden md:block text-[10px] font-black uppercase tracking-[0.2em] px-4 py-2 border transition-all duration-300 ${
                  isHome && !isScrolled
                    ? "text-white border-white/30 hover:border-white hover:bg-white/10"
                    : "text-on-surface border-on-surface/20 hover:border-on-surface hover:bg-on-surface/5"
                }`}
              >
                Sign In
              </Link>
            )}
            <Link
              href="/admindashboard/login"
              className={`hidden md:block ${iconClass}`}
            >
              admin_panel_settings
            </Link>
          </div>
        </div>
      </header>

      {/* Modern Mobile Bottom Navigation Capsule */}
      <div className="md:hidden fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 w-[92%] max-w-[400px] z-[115] bg-black/60 backdrop-blur-md border border-white/10 rounded-full py-2.5 px-6 shadow-[0_12px_40px_rgba(0,0,0,0.5)] flex items-center justify-between text-[#eae8e4] transition-all duration-300">
        {/* Home */}
        <Link 
          href="/" 
          className={`flex flex-col items-center gap-0.5 transition-all duration-300 active:scale-95 group focus:outline-none ${
            isLinkActive("/") ? "text-[#fed488] font-bold scale-105" : "text-[#eae8e4]/60 hover:text-white"
          }`}
        >
          <span className="material-symbols-outlined text-[20px] transition-transform duration-300 group-hover:scale-110">home</span>
          <span className="text-[8px] font-bold uppercase tracking-wider">Home</span>
          <span className={`w-1 h-1 rounded-full bg-[#fed488] transition-all duration-300 mt-0.5 ${isLinkActive("/") ? "scale-100 opacity-100 animate-pulse" : "scale-0 opacity-0"}`} />
        </Link>

        {/* Shop */}
        <Link 
          href="/shopallshirts" 
          className={`flex flex-col items-center gap-0.5 transition-all duration-300 active:scale-95 group focus:outline-none ${
            isLinkActive("/shopallshirts") ? "text-[#fed488] font-bold scale-105" : "text-[#eae8e4]/60 hover:text-white"
          }`}
        >
          <span className="material-symbols-outlined text-[20px] transition-transform duration-300 group-hover:scale-110">storefront</span>
          <span className="text-[8px] font-bold uppercase tracking-wider">Shop</span>
          <span className={`w-1 h-1 rounded-full bg-[#fed488] transition-all duration-300 mt-0.5 ${isLinkActive("/shopallshirts") ? "scale-100 opacity-100 animate-pulse" : "scale-0 opacity-0"}`} />
        </Link>

        {/* Bag */}
        <Link 
          href="/shoppingbag" 
          className={`flex flex-col items-center gap-0.5 transition-all duration-300 active:scale-95 group relative focus:outline-none ${
            isLinkActive("/shoppingbag") ? "text-[#fed488] font-bold scale-105" : "text-[#eae8e4]/60 hover:text-white"
          }`}
        >
          <span className="material-symbols-outlined text-[20px] transition-transform duration-300 group-hover:scale-110">shopping_bag</span>
          {cartCount > 0 && (
            <span className="absolute -top-1.5 -right-2 bg-secondary text-white text-[9px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center border border-[#0c0c0e] animate-pulse">
              {cartCount}
            </span>
          )}
          <span className="text-[8px] font-bold uppercase tracking-wider">Bag</span>
          <span className={`w-1 h-1 rounded-full bg-[#fed488] transition-all duration-300 mt-0.5 ${isLinkActive("/shoppingbag") ? "scale-100 opacity-100 animate-pulse" : "scale-0 opacity-0"}`} />
        </Link>

        {/* GEN-Z */}
        <Link 
          href="/genz" 
          className={`flex flex-col items-center gap-0.5 transition-all duration-300 active:scale-95 group focus:outline-none ${
            isLinkActive("/genz") ? "text-[#fed488] font-bold scale-105" : "text-[#eae8e4]/60 hover:text-white"
          }`}
        >
          <span className="material-symbols-outlined text-[20px] transition-transform duration-300 group-hover:scale-110">style</span>
          <span className="text-[8px] font-bold uppercase tracking-wider">GEN-Z</span>
          <span className={`w-1 h-1 rounded-full bg-[#fed488] transition-all duration-300 mt-0.5 ${isLinkActive("/genz") ? "scale-100 opacity-100 animate-pulse" : "scale-0 opacity-0"}`} />
        </Link>

        {/* Menu Toggle */}
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)} 
          className={`flex flex-col items-center gap-0.5 transition-all duration-300 active:scale-95 group focus:outline-none bg-transparent border-none ${
            mobileMenuOpen ? "text-[#fed488] font-bold scale-105" : "text-[#eae8e4]/60 hover:text-white"
          }`}
        >
          <span className="material-symbols-outlined text-[20px] transition-transform duration-300">
            {mobileMenuOpen ? "close" : "menu"}
          </span>
          <span className="text-[8px] font-bold uppercase tracking-wider">
            {mobileMenuOpen ? "Close" : "Menu"}
          </span>
          <span className={`w-1 h-1 rounded-full bg-[#fed488] transition-all duration-300 mt-0.5 ${mobileMenuOpen ? "scale-100 opacity-100 animate-pulse" : "scale-0 opacity-0"}`} />
        </button>
      </div>

      {/* Mobile Drawer Menu Overlay */}
      <div
        className={`fixed inset-0 z-[105] bg-surface flex flex-col items-center justify-center p-6 pb-20 md:hidden transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] ${
          mobileMenuOpen ? "clip-path-circle-open" : "clip-path-circle-closed"
        }`}
        style={{
          clipPath: mobileMenuOpen ? "circle(150% at bottom right)" : "circle(0% at bottom right)",
          transition: "clip-path 0.5s cubic-bezier(0.25, 1, 0.5, 1)",
        }}
      >
        <nav className="flex flex-col items-center gap-10 text-center">
          <Link
            onClick={() => setMobileMenuOpen(false)}
            style={{
              minHeight: '44px',
              padding: '12px 16px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            className="text-3xl font-headline font-black uppercase tracking-tight text-on-surface hover:text-secondary transition-colors"
            href="/"
          >
            Home
          </Link>
          <Link
            onClick={() => setMobileMenuOpen(false)}
            style={{
              minHeight: '44px',
              padding: '12px 16px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            className="text-3xl font-headline font-black uppercase tracking-tight text-on-surface hover:text-secondary transition-colors"
            href="/genz"
          >
            GEN-Z
          </Link>
          <Link
            onClick={() => setMobileMenuOpen(false)}
            style={{
              minHeight: '44px',
              padding: '12px 16px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            className="text-3xl font-headline font-black uppercase tracking-tight text-secondary transition-colors"
            href="/shopallshirts"
          >
            Shop All
          </Link>
          <Link
            onClick={() => setMobileMenuOpen(false)}
            style={{
              minHeight: '44px',
              padding: '12px 16px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            className="text-3xl font-headline font-black uppercase tracking-tight text-on-surface hover:text-secondary transition-colors"
            href="/orderhistory"
          >
            Order History
          </Link>
          <Link
            onClick={() => setMobileMenuOpen(false)}
            style={{
              minHeight: '44px',
              padding: '12px 16px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            className="text-3xl font-headline font-black uppercase tracking-tight text-on-surface hover:text-secondary transition-colors"
            href="/ordertracking"
          >
            Track Order
          </Link>
          {user ? (
            <>
              <Link
                onClick={() => setMobileMenuOpen(false)}
                style={{
                  minHeight: '44px',
                  padding: '12px 16px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                className="text-3xl font-headline font-black uppercase tracking-tight text-on-surface hover:text-secondary transition-colors"
                href="/myprofile"
              >
                Profile
              </Link>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleSignOut();
                }}
                style={{
                  minHeight: '44px',
                  padding: '12px 16px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                className="text-3xl font-headline font-black uppercase tracking-tight text-red-600 hover:text-red-700 transition-colors border-none bg-transparent cursor-pointer"
              >
                Sign Out
              </button>
            </>
          ) : (
            <Link
              onClick={() => setMobileMenuOpen(false)}
              style={{
                minHeight: '44px',
                padding: '12px 16px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              className="text-3xl font-headline font-black uppercase tracking-tight text-on-surface hover:text-secondary transition-colors"
              href="/login"
            >
              Sign In
            </Link>
          )}
        </nav>
        <div className="absolute bottom-28 flex gap-6 border-t border-outline/10 pt-6 w-full justify-center px-10">
          <Link
            onClick={() => setMobileMenuOpen(false)}
            className="text-xs font-bold uppercase tracking-widest text-outline hover:text-on-surface"
            href="/admindashboard/login"
          >
            Admin Dashboard
          </Link>
        </div>
      </div>
    </>
  );
}
