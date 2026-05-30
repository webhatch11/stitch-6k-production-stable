"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function SignatureShirtBlack() {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);

  // Product page interactive state
  const [activeImg, setActiveImg] = useState(
    "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&q=80&w=1200"
  );
  const [imgAnimating, setImgAnimating] = useState(false);
  const [selectedSize, setSelectedSize] = useState("M");

  // Accordion open/close state
  const [accordionOpen, setAccordionOpen] = useState({
    details: true,
    material: false,
    care: false,
  });

  useEffect(() => {
    // Initial cart count
    const count = parseInt(localStorage.getItem("cartCount") || "0");
    setCartCount(count);

    // Storage listener for cross-tab cart updates
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "cartCount") {
        setCartCount(parseInt(e.newValue || "0"));
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const swapImage = (newSrc: string) => {
    if (newSrc === activeImg) return;
    setImgAnimating(true);
    setTimeout(() => {
      setActiveImg(newSrc);
      setImgAnimating(false);
    }, 300);
  };

  const toggleAccordion = (section: "details" | "material" | "care") => {
    setAccordionOpen((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const showToast = (message: string) => {
    let toast = document.getElementById("prototype-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "prototype-toast";
      toast.className = "active";
      document.body.appendChild(toast);
    }
    toast.innerText = message;
    toast.className = "active";
    setTimeout(() => {
      if (toast) {
        toast.className = "";
      }
    }, 3000);
  };

  const addToCart = (redirect = false) => {
    let cart = [];
    try {
      cart = JSON.parse(localStorage.getItem("cart_items") || "[]");
    } catch (e) {
      console.error(e);
    }

    cart.push({
      productName: "Signature Linen Shirt",
      price: 7250,
      size: selectedSize,
      image: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&q=80&w=400",
    });

    localStorage.setItem("cart_items", JSON.stringify(cart));
    const newCount = cartCount + 1;
    localStorage.setItem("cartCount", newCount.toString());
    setCartCount(newCount);

    showToast(`Signature Linen Shirt (Size ${selectedSize}) added to bag`);

    if (redirect) {
      router.push("/shoppingbag");
    }
  };

  return (
    <>
      {/* Announcement Marquee */}
      <div className="marquee-container overflow-hidden w-full bg-on-surface text-surface py-2.5 text-[10px] font-bold uppercase tracking-[0.2em] relative z-[60]">
        <div className="flex animate-marquee whitespace-nowrap">
          <div className="flex shrink-0 items-center gap-12 px-6">
            <span>FREE DELIVERY ACROSS INDIA</span>
            <span className="text-secondary-fixed-dim">•</span>
            <span>USE CODE <span className="text-secondary-fixed-dim font-extrabold">FESTIVE24</span> FOR 10% OFF</span>
            <span className="text-secondary-fixed-dim">•</span>
            <span>100% PREMIUM COTTON & LINEN</span>
            <span className="text-secondary-fixed-dim">•</span>
            <span>EASY 7-DAY RETURNS</span>
            <span className="text-secondary-fixed-dim">•</span>
          </div>
          <div className="flex shrink-0 items-center gap-12 px-6">
            <span>FREE DELIVERY ACROSS INDIA</span>
            <span className="text-secondary-fixed-dim">•</span>
            <span>USE CODE <span className="text-secondary-fixed-dim font-extrabold">FESTIVE24</span> FOR 10% OFF</span>
            <span className="text-secondary-fixed-dim">•</span>
            <span>100% PREMIUM COTTON & LINEN</span>
            <span className="text-secondary-fixed-dim">•</span>
            <span>EASY 7-DAY RETURNS</span>
            <span className="text-secondary-fixed-dim">•</span>
          </div>
        </div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-surface/80 backdrop-blur-xl border-b border-outline-variant/10 px-6 lg:px-20 py-2.5">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-12">
            <Link href="/" className="flex items-center group hover-scale">
              <div className="w-11 h-11 rounded-full bg-white p-1.5 flex items-center justify-center shadow-md border border-[#775a19]/15">
                <img 
                  src="/assets/logo.png" 
                  alt="6K Logo" 
                  className="max-w-full max-h-full object-contain" 
                  draggable={false}
                />
              </div>
            </Link>
            <nav className="hidden md:flex items-center gap-8">
              <Link className="text-[10px] font-black uppercase tracking-widest text-outline hover:text-primary transition-colors" href="/">
                Home
              </Link>
              <Link className="text-[10px] font-black uppercase tracking-widest text-outline hover:text-primary transition-colors" href="/shopallshirts">
                Shop All
              </Link>
              <Link className="text-[10px] font-black uppercase tracking-widest text-outline hover:text-primary transition-colors" href="/orderhistory">
                Order History
              </Link>
              <Link className="text-[10px] font-black uppercase tracking-widest text-outline hover:text-primary transition-colors" href="/ordertracking">
                Track Order
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/shoppingbag" className="material-symbols-outlined text-outline hover:text-primary transition-colors">
              shopping_bag
            </Link>
            <Link href="/myprofile" className="material-symbols-outlined text-outline hover:text-primary transition-colors">
              person
            </Link>
            <Link href="/admindashboard" className="material-symbols-outlined text-outline hover:text-primary transition-colors">
              admin_panel_settings
            </Link>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="material-symbols-outlined md:hidden">
              {mobileMenuOpen ? "close" : "menu"}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <div className="flex flex-col mt-4 space-y-4 md:hidden">
            <Link onClick={() => setMobileMenuOpen(false)} className="block text-[10px] font-black uppercase tracking-widest" href="/">
              Home
            </Link>
            <Link onClick={() => setMobileMenuOpen(false)} className="block text-[10px] font-black uppercase tracking-widest" href="/shopallshirts">
              Shop All
            </Link>
            <Link onClick={() => setMobileMenuOpen(false)} className="block text-[10px] font-black uppercase tracking-widest" href="/orderhistory">
              Order History
            </Link>
            <Link onClick={() => setMobileMenuOpen(false)} className="block text-[10px] font-black uppercase tracking-widest" href="/ordertracking">
              Track Order
            </Link>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="pt-20 md:pt-32 pb-24 px-6 md:px-12 max-w-[1440px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20">
          {/* Left Side: Product Gallery */}
          <div className="lg:col-span-7">
            <div className="grid grid-cols-12 gap-4">
              {/* Vertical Thumbnails */}
              <div className="hidden md:flex flex-col gap-4 col-span-2">
                {[
                  "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&q=80&w=1200",
                  "https://images.unsplash.com/photo-1589310243389-96a5483213a8?auto=format&fit=crop&q=80&w=1200",
                  "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&q=80&w=1200",
                  "https://images.unsplash.com/photo-1610652396593-60526715f3ac?auto=format&fit=crop&q=80&w=1200",
                ].map((src, idx) => (
                  <button
                    key={idx}
                    onClick={() => swapImage(src)}
                    className={`aspect-[3/4] bg-surface-container-low border overflow-hidden cursor-pointer transition-all duration-300 hover:scale-[1.03] ${
                      activeImg === src ? "border-secondary thumb-active" : "border-outline-variant/10 opacity-70 hover:opacity-100"
                    }`}
                  >
                    <img className="w-full h-full object-cover" src={src} alt="Thumbnail preview" />
                  </button>
                ))}
              </div>

              {/* Main Image Display */}
              <div className="col-span-12 md:col-span-10">
                <div className="aspect-[4/5] bg-surface-container-low border border-outline-variant/10 gallery-zoom-container cursor-zoom-in">
                  <img
                    className={`w-full h-full object-cover gallery-zoom-img transition-all duration-300 ${
                      imgAnimating ? "opacity-0 scale-[0.98]" : "opacity-100 scale-100"
                    }`}
                    src={activeImg}
                    alt="6K Signature Linen Shirt"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Side: Product Information */}
          <div className="lg:col-span-5 flex flex-col space-y-10 sticky top-32 h-fit">
            <header className="space-y-4">
              <div className="flex items-center space-x-2 text-[10px] uppercase tracking-[0.2em] text-outline font-black">
                <span>Premium Series</span>
                <span className="text-secondary">•</span>
                <span>Signature Series</span>
              </div>
              <h1 className="text-4xl sm:text-5xl font-black font-headline tracking-tighter text-on-surface leading-[1.05] uppercase">
                Signature Linen Shirt
              </h1>
              <div className="flex items-center gap-6 pt-2">
                <span className="text-3xl font-extrabold text-secondary tracking-tight">₹7,250</span>
                <span className="bg-secondary/10 border border-secondary/20 text-secondary text-[8px] font-black uppercase tracking-[0.2em] px-2.5 py-1">
                  Best Seller
                </span>
              </div>

              {/* Promotional Banner */}
              <div className="bg-surface-container-low border border-outline-variant/20 p-4 flex items-center space-x-4">
                <span className="material-symbols-outlined text-secondary animate-pulse">auto_awesome</span>
                <div className="flex-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface">
                    Limited Artisan Production
                  </p>
                  <p className="text-[8px] font-medium uppercase tracking-widest text-outline mt-0.5">
                    Only 100 units crafted per batch. Pre-washed for extreme softness.
                  </p>
                </div>
              </div>
            </header>

            {/* Size Selection */}
            <div className="space-y-6">
              <div className="flex justify-between items-end border-b border-outline-variant/10 pb-2">
                <label className="text-[10px] uppercase tracking-[0.2em] font-black text-on-surface-variant">
                  Select Size: <span className="text-secondary font-black">{selectedSize}</span>
                </label>
                <button
                  onClick={() =>
                    showToast("Size Guide (Inches) - S: 38 | M: 40 | L: 42 | XL: 44 | XXL: 46")
                  }
                  className="text-[10px] uppercase tracking-widest font-black text-secondary hover:text-primary transition-colors pb-0.5"
                >
                  Size Guide
                </button>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {["S", "M", "L", "XL", "XXL"].map((size) => {
                  const isOutOfStock = size === "XL"; // Map the out-of-stock XL button
                  return (
                    <button
                      key={size}
                      disabled={isOutOfStock}
                      onClick={() => setSelectedSize(size)}
                      className={`py-4 text-xs font-black uppercase tracking-widest btn-active-scale transition-all duration-300 ${
                        isOutOfStock
                          ? "border border-outline-variant/40 text-outline size-out-of-stock cursor-not-allowed opacity-35"
                          : selectedSize === size
                          ? "border-2 border-secondary bg-transparent text-secondary"
                          : "border border-outline-variant/60 hover:border-on-surface bg-transparent text-on-surface"
                      }`}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Main Actions */}
            <div className="flex flex-col space-y-4">
              <button
                onClick={() => addToCart(true)}
                className="w-full py-5 bg-gradient-to-r from-secondary to-secondary/80 text-white font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-secondary/15 hover:shadow-secondary/25 hover:scale-[1.02] transition-all duration-300 btn-active-scale"
              >
                Buy Now
              </button>
              <button
                onClick={() => addToCart(false)}
                className="w-full py-5 border border-on-surface text-on-surface font-black uppercase tracking-[0.2em] text-xs hover:bg-on-surface hover:text-surface transition-all duration-300 btn-active-scale"
              >
                Add to Cart
              </button>
            </div>

            {/* Trust Badges */}
            <div className="grid grid-cols-2 gap-4 py-6 border-t border-b border-outline-variant/30 text-outline">
              <div className="flex items-center space-x-3">
                <span className="material-symbols-outlined text-secondary text-lg">payments</span>
                <span className="text-[9px] uppercase tracking-widest font-black leading-tight">
                  Cash on Delivery Available
                </span>
              </div>
              <div className="flex items-center space-x-3">
                <span className="material-symbols-outlined text-secondary text-lg">assignment_return</span>
                <span className="text-[9px] uppercase tracking-widest font-black leading-tight">
                  Easy 7-day Returns
                </span>
              </div>
            </div>

            {/* Accordion drawers */}
            <div className="space-y-4">
              <div className="border-b border-outline-variant/20 pb-3">
                <button
                  onClick={() => toggleAccordion("details")}
                  className="flex justify-between items-center w-full text-left uppercase text-[10px] font-black tracking-widest text-on-surface"
                >
                  <span>Artisan Details</span>
                  <span className={`material-symbols-outlined transition-transform ${accordionOpen.details ? "rotate-180" : ""}`}>
                    expand_more
                  </span>
                </button>
                <div
                  className={`overflow-hidden transition-all duration-300 ${
                    accordionOpen.details ? "max-h-[200px] opacity-100 mt-3" : "max-h-0 opacity-0"
                  }`}
                >
                  <p className="text-xs text-on-surface-variant leading-relaxed uppercase tracking-wider">
                    Master-tailored in our workspace from the finest long-staple linen. Every seam is carefully finished by
                    hand to ensure a perfect fit and long-lasting quality. This is our signature shirt—uncompromising in
                    design and detail.
                  </p>
                </div>
              </div>

              <div className="border-b border-outline-variant/20 pb-3">
                <button
                  onClick={() => toggleAccordion("material")}
                  className="flex justify-between items-center w-full text-left uppercase text-[10px] font-black tracking-widest text-on-surface"
                >
                  <span>Material & Fit Specs</span>
                  <span className={`material-symbols-outlined transition-transform ${accordionOpen.material ? "rotate-180" : ""}`}>
                    expand_more
                  </span>
                </button>
                <div
                  className={`overflow-hidden transition-all duration-300 ${
                    accordionOpen.material ? "max-h-[200px] opacity-100 mt-3" : "max-h-0 opacity-0"
                  }`}
                >
                  <div className="grid grid-cols-2 gap-y-4 text-xs">
                    <div>
                      <h4 className="text-[9px] uppercase tracking-widest font-black text-outline">Material</h4>
                      <p className="font-bold text-on-surface mt-0.5">100% Pure Italian Linen</p>
                    </div>
                    <div>
                      <h4 className="text-[9px] uppercase tracking-widest font-black text-outline">Fit</h4>
                      <p className="font-bold text-on-surface mt-0.5">Modern Relaxed Fit</p>
                    </div>
                    <div>
                      <h4 className="text-[9px] uppercase tracking-widest font-black text-outline">Sleeve</h4>
                      <p className="font-bold text-on-surface mt-0.5">Full with MOP Buttons</p>
                    </div>
                    <div>
                      <h4 className="text-[9px] uppercase tracking-widest font-black text-outline">Collar</h4>
                      <p className="font-bold text-on-surface mt-0.5">Semi-Spread Luxury Collar</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-b border-outline-variant/20 pb-3">
                <button
                  onClick={() => toggleAccordion("care")}
                  className="flex justify-between items-center w-full text-left uppercase text-[10px] font-black tracking-widest text-on-surface"
                >
                  <span>Care Instructions</span>
                  <span className={`material-symbols-outlined transition-transform ${accordionOpen.care ? "rotate-180" : ""}`}>
                    expand_more
                  </span>
                </button>
                <div
                  className={`overflow-hidden transition-all duration-300 ${
                    accordionOpen.care ? "max-h-[200px] opacity-100 mt-3" : "max-h-0 opacity-0"
                  }`}
                >
                  <p className="text-xs text-on-surface-variant leading-relaxed uppercase tracking-wider">
                    Hand wash in cold water with mild detergent or dry clean to maintain the structure of the linen. Do not
                    bleach. Line dry in shade. Warm iron if necessary.
                  </p>
                </div>
              </div>
            </div>

            {/* WhatsApp Contact */}
            <a
              className="flex items-center justify-center space-x-3 py-4 bg-surface-container-low border border-outline-variant/20 hover:bg-surface-container transition-all duration-300"
              href="https://wa.me/919999999999"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="material-symbols-outlined text-secondary">chat</span>
              <span className="text-[10px] uppercase tracking-widest font-black text-on-surface">
                Need Sizing Help? Chat on WhatsApp
              </span>
            </a>
          </div>
        </div>

        {/* ARTISAN SECTION */}
        <section className="mt-24 pt-16 border-t border-outline-variant/10">
          <div className="text-center max-w-lg mx-auto mb-16">
            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-secondary">The Craft</span>
            <h2 className="text-3xl font-black font-headline tracking-tighter uppercase mt-2">Every Detail Accounted For</h2>
            <div className="w-12 h-[1px] bg-secondary mx-auto mt-4"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div className="bg-surface-container-lowest border border-outline-variant/10 p-8 hover:border-secondary/20 hover:shadow-lg transition-all duration-500">
              <span className="material-symbols-outlined text-secondary text-3xl mb-4">tsunami</span>
              <h3 className="text-xs font-black uppercase tracking-widest mb-3">Long-Staple Linen</h3>
              <p className="text-xs text-outline leading-relaxed uppercase tracking-wider">
                Crafted from selected long-staple linen fibers for a softer, more breathable texture and high resistance
                to wear.
              </p>
            </div>
            <div className="bg-surface-container-lowest border border-outline-variant/10 p-8 hover:border-secondary/20 hover:shadow-lg transition-all duration-500">
              <span className="material-symbols-outlined text-secondary text-3xl mb-4">settings_brightness</span>
              <h3 className="text-xs font-black uppercase tracking-widest mb-3">Mother of Pearl</h3>
              <p className="text-xs text-outline leading-relaxed uppercase tracking-wider">
                Equipped with hand-carved, genuine white Mother of Pearl buttons that catch the light with subtle, luxury
                luster.
              </p>
            </div>
            <div className="bg-surface-container-lowest border border-outline-variant/10 p-8 hover:border-secondary/20 hover:shadow-lg transition-all duration-500">
              <span className="material-symbols-outlined text-secondary text-3xl mb-4">architecture</span>
              <h3 className="text-xs font-black uppercase tracking-widest mb-3">Double-Needle Seams</h3>
              <p className="text-xs text-outline leading-relaxed uppercase tracking-wider">
                Executed by master tailors with double-needle stitching (16 stitches per inch) for clean profiles and
                lifetime seam durability.
              </p>
            </div>
          </div>
        </section>

        {/* RECOMMENDATIONS */}
        <section className="mt-24 pt-16 border-t border-outline-variant/10">
          <div className="flex justify-between items-end mb-12">
            <div>
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-secondary">Complete the Look</span>
              <h2 className="text-3xl font-black font-headline tracking-tighter uppercase mt-2">Recommended Items</h2>
            </div>
            <div className="flex gap-2">
              <span className="text-xs font-bold text-outline uppercase tracking-widest">Atelier Series</span>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {/* Card 1 */}
            <div className="group border border-outline-variant/10 p-2 bg-surface-container-lowest hover:shadow-xl hover:border-secondary/20 transition-all duration-500">
              <Link href="/signatureshirtblack" className="block relative aspect-[3/4] overflow-hidden bg-surface-container border border-outline-variant/10">
                <img
                  className="absolute inset-0 w-full h-full object-cover transition-all duration-[1000ms] group-hover:scale-105"
                  src="https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&q=80&w=800"
                  alt="Classic White Oxford"
                />
                <img
                  className="absolute inset-0 w-full h-full object-cover transition-all duration-[1200ms] scale-[1.05] opacity-0 group-hover:opacity-100 group-hover:scale-100"
                  src="https://images.unsplash.com/photo-1589310243389-96a5483213a8?auto=format&fit=crop&q=80&w=800"
                  alt="Classic White Oxford Detail"
                />
                <span className="absolute top-3 left-3 bg-surface-container-lowest/95 backdrop-blur-md text-secondary border border-secondary/20 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.15em] z-10 shadow-sm">
                  New Arrival
                </span>
              </Link>
              <div className="pt-4 px-2 pb-2">
                <div className="flex justify-between items-start gap-3">
                  <div className="space-y-1">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.15em] text-on-surface group-hover:text-secondary transition-colors leading-tight cursor-pointer">
                      Classic White Oxford
                    </h4>
                    <p className="text-[8px] text-outline uppercase tracking-[0.2em] font-semibold">Cotton • Atelier Series</p>
                  </div>
                  <p className="font-headline font-black text-secondary text-xs shrink-0">₹1,299</p>
                </div>
              </div>
            </div>

            {/* Card 2 */}
            <div className="group border border-outline-variant/10 p-2 bg-surface-container-lowest hover:shadow-xl hover:border-secondary/20 transition-all duration-500">
              <Link href="/signatureshirtblack" className="block relative aspect-[3/4] overflow-hidden bg-surface-container border border-outline-variant/10">
                <img
                  className="absolute inset-0 w-full h-full object-cover transition-all duration-[1000ms] group-hover:scale-105"
                  src="https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&q=80&w=800"
                  alt="Midnight Blue Poplin"
                />
                <img
                  className="absolute inset-0 w-full h-full object-cover transition-all duration-[1200ms] scale-[1.05] opacity-0 group-hover:opacity-100 group-hover:scale-100"
                  src="https://images.unsplash.com/photo-1610652396593-60526715f3ac?auto=format&fit=crop&q=80&w=800"
                  alt="Midnight Blue Poplin Detail"
                />
                <span className="absolute top-3 left-3 bg-surface-container-lowest/95 backdrop-blur-md text-secondary border border-secondary/20 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.15em] z-10 shadow-sm">
                  Atelier Exclusive
                </span>
              </Link>
              <div className="pt-4 px-2 pb-2">
                <div className="flex justify-between items-start gap-3">
                  <div className="space-y-1">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.15em] text-on-surface group-hover:text-secondary transition-colors leading-tight cursor-pointer">
                      Midnight Blue Poplin
                    </h4>
                    <p className="text-[8px] text-outline uppercase tracking-[0.2em] font-semibold">Cotton • Atelier Series</p>
                  </div>
                  <p className="font-headline font-black text-secondary text-xs shrink-0">₹1,450</p>
                </div>
              </div>
            </div>

            {/* Card 3 */}
            <div className="group border border-outline-variant/10 p-2 bg-surface-container-lowest hover:shadow-xl hover:border-secondary/20 transition-all duration-500">
              <Link href="/signatureshirtblack" className="block relative aspect-[3/4] overflow-hidden bg-surface-container border border-outline-variant/10">
                <img
                  className="absolute inset-0 w-full h-full object-cover transition-all duration-[1000ms] group-hover:scale-105"
                  src="https://images.unsplash.com/photo-1589310243389-96a5483213a8?auto=format&fit=crop&q=80&w=800"
                  alt="Sage Green Heritage"
                />
                <img
                  className="absolute inset-0 w-full h-full object-cover transition-all duration-[1200ms] scale-[1.05] opacity-0 group-hover:opacity-100 group-hover:scale-100"
                  src="https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&q=80&w=800"
                  alt="Sage Green Heritage Detail"
                />
                <span className="absolute top-3 left-3 bg-surface-container-lowest/95 backdrop-blur-md text-red-700 border border-red-200 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.15em] z-10 shadow-sm flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse"></span> Low Stock
                </span>
              </Link>
              <div className="pt-4 px-2 pb-2">
                <div className="flex justify-between items-start gap-3">
                  <div className="space-y-1">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.15em] text-on-surface group-hover:text-secondary transition-colors leading-tight cursor-pointer">
                      Sage Green Heritage
                    </h4>
                    <p className="text-[8px] text-outline uppercase tracking-[0.2em] font-semibold">Linen • Atelier Series</p>
                  </div>
                  <p className="font-headline font-black text-secondary text-xs shrink-0">₹1,699</p>
                </div>
              </div>
            </div>

            {/* Card 4 */}
            <div className="group border border-outline-variant/10 p-2 bg-surface-container-lowest hover:shadow-xl hover:border-secondary/20 transition-all duration-500">
              <Link href="/signatureshirtblack" className="block relative aspect-[3/4] overflow-hidden bg-surface-container border border-outline-variant/10">
                <img
                  className="absolute inset-0 w-full h-full object-cover transition-all duration-[1000ms] group-hover:scale-105"
                  src="https://images.unsplash.com/photo-1516826957135-700dedea698c?auto=format&fit=crop&q=80&w=800"
                  alt="Indigo Denim Shirt"
                />
                <img
                  className="absolute inset-0 w-full h-full object-cover transition-all duration-[1200ms] scale-[1.05] opacity-0 group-hover:opacity-100 group-hover:scale-100"
                  src="https://images.unsplash.com/photo-1610652396593-60526715f3ac?auto=format&fit=crop&q=80&w=800"
                  alt="Indigo Denim Shirt Detail"
                />
                <span className="absolute top-3 left-3 bg-surface-container-lowest/95 backdrop-blur-md text-secondary border border-secondary/20 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.15em] z-10 shadow-sm">
                  New Arrival
                </span>
              </Link>
              <div className="pt-4 px-2 pb-2">
                <div className="flex justify-between items-start gap-3">
                  <div className="space-y-1">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.15em] text-on-surface group-hover:text-secondary transition-colors leading-tight cursor-pointer">
                      Indigo Denim Shirt
                    </h4>
                    <p className="text-[8px] text-outline uppercase tracking-[0.2em] font-semibold">Denim • Atelier Series</p>
                  </div>
                  <p className="font-headline font-black text-secondary text-xs shrink-0">₹1,999</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Sticky Buy Bar for Mobile */}
      <div className="fixed bottom-0 left-0 w-full bg-surface-container-lowest/90 backdrop-blur-xl border-t border-outline-variant/10 px-6 py-4 flex items-center justify-between z-40 md:hidden">
        <div className="flex flex-col">
          <span className="text-xs font-extrabold text-secondary">₹7,250</span>
          <span className="text-[8px] uppercase tracking-widest text-outline font-black mt-0.5">Signature Linen</span>
        </div>
        <button
          onClick={() => addToCart(true)}
          className="bg-on-surface text-surface px-8 py-3.5 text-xs font-black uppercase tracking-[0.2em] btn-active-scale"
        >
          Buy Now
        </button>
      </div>

      {/* Footer */}
      <footer className="py-12 bg-[#0A0A0A] text-white px-6 lg:px-20 border-t-4 border-secondary pb-24 md:pb-12">
        <div className="max-w-7xl mx-auto">
          {/* Top Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 text-secondary">
                  <img 
                    src="/assets/logo.png" 
                    alt="6K Logo" 
                    className="h-8 w-auto object-contain"
                    draggable={false}
                  />
                </div>
                <span className="font-headline text-2xl font-black tracking-tighter uppercase text-white">6K Shirts</span>
              </div>
              <p className="text-[10px] text-white/60 leading-relaxed max-w-sm uppercase tracking-widest font-light mb-6">
                Premium menswear born from the looms of South India. Crafted with precision, shipped globally.
              </p>
              <Link
                href="/admindashboard"
                className="inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all duration-300"
              >
                <span className="material-symbols-outlined text-sm">admin_panel_settings</span>
                Admin Portal
              </Link>
            </div>

            <div className="lg:text-right flex flex-col lg:items-end justify-center">
              <h4 className="text-lg font-headline font-black uppercase tracking-tight mb-2 text-white">
                Join the Atelier
              </h4>
              <p className="text-[9px] font-bold uppercase tracking-widest text-white/50 mb-4">
                Early access to limited runs and private sales.
              </p>
              <div className="flex w-full lg:max-w-md border-b border-white/20 pb-2 focus-within:border-secondary transition-colors">
                <input
                  type="email"
                  placeholder="ENTER YOUR EMAIL"
                  className="bg-transparent border-none outline-none w-full text-[10px] uppercase tracking-widest text-white placeholder-white/30 px-2"
                />
                <button className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary hover:text-white transition-colors px-2">
                  Subscribe
                </button>
              </div>
            </div>
          </div>

          {/* Links Section */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10 pt-10 border-t border-white/10">
            <div className="col-span-1 md:col-span-2">
              <h4 className="text-[9px] font-black uppercase tracking-[0.3em] mb-4 text-white/40">Our Atelier</h4>
              <p className="text-[10px] font-light uppercase tracking-widest text-white/80 leading-loose flex items-start gap-4">
                <span className="material-symbols-outlined text-secondary mt-1">location_on</span>
                <span>
                  The Stitch 6K Workshop
                  <br />
                  Tiruppur Textile District
                  <br />
                  Tamil Nadu, India 641604
                  <br />
                  <span className="text-[8px] text-white/40 mt-1 block">Global Distribution Center</span>
                </span>
              </p>
            </div>
            <div>
              <h4 className="text-[9px] font-black uppercase tracking-[0.3em] mb-4 text-white/40">Client Services</h4>
              <ul className="space-y-3 text-[10px] font-light uppercase tracking-widest text-white/70">
                <li>
                  <Link href="/shipping-policy" className="hover:text-secondary hover:translate-x-1 inline-block transition-all">
                    Global Shipping
                  </Link>
                </li>
                <li>
                  <Link href="/return-policy" className="hover:text-secondary hover:translate-x-1 inline-block transition-all">
                    Returns & Exchanges
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="hover:text-secondary hover:translate-x-1 inline-block transition-all">
                    Size Guide
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="hover:text-secondary hover:translate-x-1 inline-block transition-all">
                    Contact Concierge
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-[9px] font-black uppercase tracking-[0.3em] mb-4 text-white/40">Legal</h4>
              <ul className="space-y-3 text-[10px] font-light uppercase tracking-widest text-white/70">
                <li>
                  <Link href="/terms" className="hover:text-white transition-colors">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="hover:text-white transition-colors">
                    Privacy Policy
                  </Link>
                </li>
              </ul>

              <div className="mt-6 flex gap-3">
                <div className="w-6 h-6 rounded-full border border-white/20 flex items-center justify-center text-white/50 hover:text-white hover:border-secondary transition-all cursor-pointer">
                  <span className="material-symbols-outlined text-[10px]">language</span>
                </div>
                <div className="w-6 h-6 rounded-full border border-white/20 flex items-center justify-center text-white/50 hover:text-white hover:border-secondary transition-all cursor-pointer">
                  <span className="material-symbols-outlined text-[10px]">flight</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Copyright */}
          <div className="pt-6 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-[9px] font-bold uppercase tracking-[0.4em] text-white/60">
              © 2026 6K Shirts. Crafted in Tamil Nadu.
            </p>
            <div className="flex items-center gap-4 text-white/60">
              <span className="text-[9px] uppercase tracking-widest font-bold">Shipping Worldwide</span>
              <div className="w-1 h-1 rounded-full bg-secondary"></div>
              <span className="text-[9px] uppercase tracking-widest font-bold">INR / USD / EUR / GBP</span>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
