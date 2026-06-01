"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Product } from "@/lib/registry";
import { db } from "@/lib/db";

export default function ShopAllShirts() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  const isActiveTab = (path: string) => {
    if (path === "/") {
      return pathname === "/";
    }
    return pathname === path || pathname.startsWith(path);
  };

  // Filter & Sort state
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>(["cotton"]); // Default seed-checked in prototype
  const [selectedSize, setSelectedSize] = useState<string>("S"); // Default seed-selected S
  const [maxPrice, setMaxPrice] = useState<number>(12000);
  const [sortBy, setSortBy] = useState<string>("popularity");

  // Monitor scroll height to handle dynamic navbar transitions
  const [isScrolled, setIsScrolled] = useState(false);
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

  // Load products and initialize cart count
  useEffect(() => {
    const fetchProducts = async () => {
      const allProducts = await db.getProducts();
      setProducts(allProducts);
    };
    fetchProducts();

    const updateCartCount = () => {
      try {
        const currentCart = JSON.parse(localStorage.getItem("cart_items") || "[]");
        setCartCount(currentCart.length);
      } catch (e) {
        console.error(e);
      }
    };

    updateCartCount();

    window.addEventListener("storage", updateCartCount);
    return () => window.removeEventListener("storage", updateCartCount);
  }, []);

  // Filter products logic
  useEffect(() => {
    let result = [...products];

    // 1. Search Query Filter
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(query) ||
          p.category.toLowerCase().includes(query)
      );
    }

    // 2. Material/Category Filter
    if (selectedMaterials.length > 0) {
      result = result.filter((p) => {
        const category = p.category ? p.category.toLowerCase() : "";
        return selectedMaterials.some((m) => category.includes(m));
      });
    }

    // 2.5 Size Filter
    if (selectedSize) {
      result = result.filter((p) => {
        if (p.sizeStock) {
          const qty = p.sizeStock[selectedSize as keyof typeof p.sizeStock];
          return qty !== undefined && qty > 0;
        }
        return true;
      });
    }

    // 3. Price Filter
    result = result.filter((p) => p.price <= maxPrice);

    // 4. Sort products
    if (sortBy === "low-high") {
      result.sort((a, b) => a.price - b.price);
    } else if (sortBy === "high-low") {
      result.sort((a, b) => b.price - a.price);
    } else if (sortBy === "newest") {
      result.sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0));
    }

    setFilteredProducts(result);
  }, [products, searchQuery, selectedMaterials, selectedSize, maxPrice, sortBy]);

  const handleMaterialChange = (material: string) => {
    const lowerMaterial = material.toLowerCase();
    if (selectedMaterials.includes(lowerMaterial)) {
      setSelectedMaterials(selectedMaterials.filter((m) => m !== lowerMaterial));
    } else {
      setSelectedMaterials([...selectedMaterials, lowerMaterial]);
    }
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

  const handleAddToCart = (product: Product, size: string) => {
    let cart = [];
    try {
      cart = JSON.parse(localStorage.getItem("cart_items") || "[]");
    } catch (e) {
      console.error(e);
    }
    cart.push({
      productName: product.title,
      price: product.price,
      size: size,
      image: product.image,
    });
    localStorage.setItem("cart_items", JSON.stringify(cart));
    localStorage.setItem("cartCount", cart.length.toString());
    setCartCount(cart.length);

    // Notify count updates
    window.dispatchEvent(new Event("storage"));

    showToast(`Size ${size} added to bag`);
  };

  return (
    <>
      {/* Top Announcement Scrolling Marquee */}
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

      {/* Dynamic Responsive Top Header (Brand Identity Anchor) */}
      <header 
        className="fixed top-0 left-0 right-0 z-[100] transition-all duration-500 pt-[calc(0.5rem+env(safe-area-inset-top,0px))] pb-2.5 bg-[#faf9f8]/95 backdrop-blur-md border-b border-[#775a19]/10 shadow-sm"
      >
        <div className="flex items-center justify-between max-w-[1400px] mx-auto px-4 md:px-8 lg:px-12 transition-all duration-500 relative min-h-[48px] md:min-h-0">
          <div className="flex items-center gap-12 w-full md:w-auto">
            {/* Logo - Left-aligned on both Mobile & Desktop to clear notch and visual crowding */}
            <Link href="/" className="flex items-center group hover-scale z-10">
              <div className="w-11 h-11 md:w-11 md:h-11 rounded-full p-1.5 flex items-center justify-center shadow-md transition-all duration-500 bg-white border border-[#775a19]/15 shadow-[0_0_12px_rgba(119,90,25,0.08)]">
                <img 
                  src="/assets/logo.png" 
                  alt="6K Logo" 
                  className="max-w-full max-h-full object-contain" 
                  draggable={false}
                />
              </div>
            </Link>

            {/* Desktop Menu (Hidden on Mobile) */}
            <nav className="hidden md:flex items-center gap-8">
              <Link className="text-[10px] font-black uppercase tracking-widest text-outline hover:text-primary transition-colors" href="/">
                Home
              </Link>
              <Link className="text-[10px] font-black uppercase tracking-widest text-primary font-bold" href="/shopallshirts">
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

          {/* Right Icons / Actions (Visible on Desktop, simplified on Mobile to prevent duplicate utility icons) */}
          <div className="flex items-center gap-5 z-10">
            <Link
              href="/shoppingbag"
              className="material-symbols-outlined hover:text-secondary hover-scale hover:-rotate-6 transition-all duration-300 relative text-on-surface"
            >
              shopping_bag
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center border bg-secondary text-white border-surface">
                  {cartCount}
                </span>
              )}
            </Link>
            <Link
              href="/myprofile"
              className="hidden md:block material-symbols-outlined hover:text-secondary hover-scale transition-all duration-300 text-on-surface"
            >
              person
            </Link>
          </div>
        </div>
      </header>

      {/* Modern Mobile Bottom Navigation Capsule */}
      <div className="md:hidden fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 w-[92%] max-w-[400px] z-[115] bg-black/60 backdrop-blur-md border border-white/10 rounded-full py-2.5 px-6 shadow-[0_12px_40px_rgba(0,0,0,0.5)] flex items-center justify-between text-[#eae8e4] transition-all duration-300">
        {/* Home Tab */}
        <Link 
          href="/" 
          className={`flex flex-col items-center gap-0.5 transition-all duration-300 active:scale-95 group focus:outline-none ${
            isActiveTab("/") ? "text-[#fed488] font-bold scale-105" : "text-[#eae8e4]/60 hover:text-white"
          }`}
        >
          <span className="material-symbols-outlined text-[20px] transition-transform duration-300 group-hover:scale-110">home</span>
          <span className="text-[8px] font-bold uppercase tracking-wider">Home</span>
          <span className={`w-1 h-1 rounded-full bg-[#fed488] transition-all duration-300 mt-0.5 ${isActiveTab("/") ? "scale-100 opacity-100 animate-pulse" : "scale-0 opacity-0"}`} />
        </Link>

        {/* Shop Tab */}
        <Link 
          href="/shopallshirts" 
          className={`flex flex-col items-center gap-0.5 transition-all duration-300 active:scale-95 group focus:outline-none ${
            isActiveTab("/shopallshirts") ? "text-[#fed488] font-bold scale-105" : "text-[#eae8e4]/60 hover:text-white"
          }`}
        >
          <span className="material-symbols-outlined text-[20px] transition-transform duration-300 group-hover:scale-110">storefront</span>
          <span className="text-[8px] font-bold uppercase tracking-wider">Shop</span>
          <span className={`w-1 h-1 rounded-full bg-[#fed488] transition-all duration-300 mt-0.5 ${isActiveTab("/shopallshirts") ? "scale-100 opacity-100 animate-pulse" : "scale-0 opacity-0"}`} />
        </Link>

        {/* Bag Tab (with real-time count badge) */}
        <Link 
          href="/shoppingbag" 
          className={`flex flex-col items-center gap-0.5 transition-all duration-300 active:scale-95 group relative focus:outline-none ${
            isActiveTab("/shoppingbag") ? "text-[#fed488] font-bold scale-105" : "text-[#eae8e4]/60 hover:text-white"
          }`}
        >
          <span className="material-symbols-outlined text-[20px] transition-transform duration-300 group-hover:scale-110">shopping_bag</span>
          {cartCount > 0 && (
            <span className="absolute -top-1.5 -right-2 bg-secondary text-white text-[9px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center border border-[#0c0c0e] animate-pulse">
              {cartCount}
            </span>
          )}
          <span className="text-[8px] font-bold uppercase tracking-wider">Bag</span>
          <span className={`w-1 h-1 rounded-full bg-[#fed488] transition-all duration-300 mt-0.5 ${isActiveTab("/shoppingbag") ? "scale-100 opacity-100 animate-pulse" : "scale-0 opacity-0"}`} />
        </Link>

        {/* Profile Tab */}
        <Link 
          href="/myprofile" 
          className={`flex flex-col items-center gap-0.5 transition-all duration-300 active:scale-95 group focus:outline-none ${
            isActiveTab("/myprofile") ? "text-[#fed488] font-bold scale-105" : "text-[#eae8e4]/60 hover:text-white"
          }`}
        >
          <span className="material-symbols-outlined text-[20px] transition-transform duration-300 group-hover:scale-110">person</span>
          <span className="text-[8px] font-bold uppercase tracking-wider">Profile</span>
          <span className={`w-1 h-1 rounded-full bg-[#fed488] transition-all duration-300 mt-0.5 ${isActiveTab("/myprofile") ? "scale-100 opacity-100 animate-pulse" : "scale-0 opacity-0"}`} />
        </Link>

        {/* Menu drawer trigger */}
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)} 
          className={`flex flex-col items-center gap-0.5 transition-all duration-300 active:scale-95 group focus:outline-none ${
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

      {/* Mobile Drawer Menu (z-[105] under Capsule navigation z-[115]) */}
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
            className="text-3xl font-headline font-black uppercase tracking-tight text-on-surface hover:text-secondary transition-colors"
            href="/"
          >
            Home
          </Link>
          <Link
            onClick={() => setMobileMenuOpen(false)}
            className="text-3xl font-headline font-black uppercase tracking-tight text-secondary transition-colors"
            href="/shopallshirts"
          >
            Shop All
          </Link>
          <Link
            onClick={() => setMobileMenuOpen(false)}
            className="text-3xl font-headline font-black uppercase tracking-tight text-on-surface hover:text-secondary transition-colors"
            href="/orderhistory"
          >
            Order History
          </Link>
          <Link
            onClick={() => setMobileMenuOpen(false)}
            className="text-3xl font-headline font-black uppercase tracking-tight text-on-surface hover:text-secondary transition-colors"
            href="/ordertracking"
          >
            Track Order
          </Link>
          <Link
            onClick={() => setMobileMenuOpen(false)}
            className="text-3xl font-headline font-black uppercase tracking-tight text-on-surface hover:text-secondary transition-colors"
            href="/myprofile"
          >
            Profile
          </Link>
        </nav>
        <div className="absolute bottom-28 flex gap-6 border-t border-outline/10 pt-6 w-full justify-center px-10">
          <Link
            onClick={() => setMobileMenuOpen(false)}
            className="text-xs font-bold uppercase tracking-widest text-outline hover:text-on-surface"
            href="/admindashboard"
          >
            Admin
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <main className="pt-[calc(3.5rem+env(safe-area-inset-top,0px))] md:pt-20 pb-16 md:pb-24 px-4 sm:px-6 md:px-10 lg:px-12 min-h-screen">
        {/* HEADER */}
        <header className="mb-4 md:mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
          <div className="max-w-xl">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black uppercase tracking-[0.05em] text-on-surface mb-1 leading-tight">
              The Heritage Shirt
            </h1>
            <p className="text-[10px] md:text-xs text-on-surface/60 leading-relaxed max-w-lg font-medium tracking-wide">
              Premium handcrafted shirts blending traditional Indian textiles with modern style.
            </p>
            <div className="mt-2.5 max-w-sm">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search SKU or name..."
                className="w-full text-[10px] uppercase tracking-widest border border-outline-variant/20 bg-white/30 px-4 py-2.5 outline-none focus:border-[#fed488]/60 font-bold rounded-full backdrop-blur-md transition-all focus:bg-white/60 focus:shadow-[0_0_15px_rgba(254,212,136,0.05)] text-on-surface placeholder-on-surface/40"
              />
            </div>
          </div>

          {/* SORT */}
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-outline/60 mt-2 sm:mt-0 select-none bg-white/30 backdrop-blur-md border border-outline-variant/15 px-3 py-1.5 rounded-full shadow-sm hover:border-[#fed488]/40 transition-colors">
            <span>Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-transparent text-on-surface font-black cursor-pointer border-none outline-none uppercase tracking-widest text-[9px]"
            >
              <option value="popularity">Popularity</option>
              <option value="newest">Newest</option>
              <option value="low-high">Low → High</option>
              <option value="high-low">High → Low</option>
            </select>
          </div>
        </header>

        {/* MAIN GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* FILTER */}
          <aside id="shop-filters" className="lg:col-span-1">
            <div className="bg-white/40 backdrop-blur-lg border border-white/20 p-5 lg:p-6 shadow-[0_8px_32px_rgba(119,90,25,0.03)] rounded-[1.5rem] relative overflow-hidden">
              <div className="absolute -top-16 -left-16 w-36 h-36 bg-[#fed488]/5 rounded-full blur-3xl"></div>
              <div className="absolute -bottom-16 -right-16 w-36 h-36 bg-[#775a19]/5 rounded-full blur-3xl"></div>
              
              {/* Header Toggle for Mobile */}
              <div 
                className="flex justify-between items-center lg:cursor-default cursor-pointer relative z-10"
                onClick={() => {
                  if (window.innerWidth < 1024) {
                    setFiltersExpanded(!filtersExpanded);
                  }
                }}
              >
                <h2 className="text-[11px] font-black uppercase tracking-[0.25em] text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] text-[#fed488]">tune</span>
                  Filter & Sort
                </h2>
                <span className="material-symbols-outlined lg:hidden text-on-surface/60 transition-transform duration-300" style={{ transform: filtersExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                  expand_more
                </span>
              </div>

              {/* Collapsible Content */}
              <div className={`space-y-6 transition-all duration-500 ease-in-out overflow-hidden lg:block lg:max-h-none lg:opacity-100 relative z-10 ${filtersExpanded ? 'max-h-[1000px] opacity-100 mt-5' : 'max-h-0 opacity-0 lg:mt-5'}`}>
                {/* Separator */}
                <div className="h-[1px] bg-gradient-to-r from-[#fed488]/20 via-outline-variant/10 to-transparent"></div>

                {/* MATERIAL */}
                <div>
                  <h3 className="text-[9px] font-bold uppercase tracking-[0.25em] text-on-surface/40 mb-3 select-none">Material</h3>
                  <div className="space-y-3">
                    {["Linen", "Cotton", "Silk", "Denim"].map((material) => (
                      <label key={material} className="flex items-center gap-3 cursor-pointer group select-none text-on-surface/70 hover:text-[#fed488] transition-colors font-bold uppercase tracking-wider text-[10px]">
                        <div className="relative flex items-center justify-center">
                          <input
                            type="checkbox"
                            checked={selectedMaterials.includes(material.toLowerCase())}
                            onChange={() => handleMaterialChange(material)}
                            className="sr-only peer"
                          />
                          <div className="w-4 h-4 border border-outline-variant/30 rounded transition-all duration-300 bg-white/50 backdrop-blur-sm peer-checked:bg-[#fed488] peer-checked:border-[#fed488] group-hover:border-[#fed488]/70 flex items-center justify-center">
                            <span className="material-symbols-outlined text-[10px] text-neutral-950 font-black opacity-0 peer-checked:opacity-100 transition-opacity duration-300 select-none">
                              check
                            </span>
                          </div>
                        </div>
                        <span>{material === "Silk" ? "Silk Blend" : material}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Separator */}
                <div className="h-[1px] bg-gradient-to-r from-[#fed488]/20 via-outline-variant/10 to-transparent"></div>

                {/* SIZE */}
                <div>
                  <h3 className="text-[9px] font-bold uppercase tracking-[0.25em] text-on-surface/40 mb-3 select-none">Size</h3>
                  <div className="grid grid-cols-4 gap-2">
                    {["S", "M", "L", "XL"].map((size) => (
                      <button
                        key={size}
                        onClick={() => setSelectedSize(size)}
                        className={`py-2 text-[10px] font-bold uppercase tracking-widest transition-all duration-300 rounded-lg shadow-sm border ${
                          selectedSize === size
                            ? "border-[#fed488] text-[#fed488] bg-[#fed488]/10 font-bold"
                            : "border-outline-variant/20 text-on-surface/60 bg-transparent hover:border-[#fed488]/40 hover:text-on-surface active:scale-95 cursor-pointer"
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Separator */}
                <div className="h-[1px] bg-gradient-to-r from-[#fed488]/20 via-outline-variant/10 to-transparent"></div>

                {/* PRICE */}
                <div>
                  <h3 className="text-[9px] font-bold uppercase tracking-[0.25em] text-on-surface/40 mb-3 select-none flex justify-between items-center">
                    <span>Max Price</span>
                    <span className="font-black text-[#fed488]">₹{maxPrice.toLocaleString("en-IN")}</span>
                  </h3>
                  <input
                    type="range"
                    min="1000"
                    max="12000"
                    step="500"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(parseInt(e.target.value))}
                    className="w-full accent-[#fed488] cursor-pointer bg-neutral-200 rounded-lg appearance-none h-1"
                  />
                  <div className="flex justify-between text-[8px] font-bold uppercase tracking-widest mt-2 text-on-surface/40 select-none">
                    <span>₹1,000</span>
                    <span>₹12,000</span>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          {/* PRODUCTS SECTION */}
          <section className="lg:col-span-3">
            {filteredProducts.length === 0 ? (
              <div className="py-20 text-center">
                <p className="text-gray-400 text-sm uppercase tracking-widest">No products match your filters.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6 md:gap-8">
                {filteredProducts.map((product, index) => {
                  // Dynamic Badges - Sleek, capsule-style, semi-transparent
                  let badgeElement = null;
                  if (product.isNew) {
                    badgeElement = (
                      <span className="absolute top-2.5 left-2.5 bg-black/70 backdrop-blur-md text-[#fed488] border border-[#fed488]/30 px-2 py-0.5 text-[7px] font-black uppercase tracking-[0.18em] z-10 shadow-md rounded-full">
                        New Arrival
                      </span>
                    );
                  } else if (product.stock && product.stock < 30) {
                    badgeElement = (
                      <span className="absolute top-2.5 left-2.5 bg-black/70 backdrop-blur-md text-red-400 border border-red-400/30 px-2 py-0.5 text-[7px] font-black uppercase tracking-[0.18em] z-10 shadow-md rounded-full flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span> Only {product.stock} Left
                      </span>
                    );
                  } else if (product.price > 8000) {
                    badgeElement = (
                      <span className="absolute top-2.5 left-2.5 bg-black/70 backdrop-blur-md text-[#fed488] border border-[#fed488]/30 px-2 py-0.5 text-[7px] font-black uppercase tracking-[0.18em] z-10 shadow-md rounded-full">
                        Atelier Exclusive
                      </span>
                    );
                  }

                  const secondaryImg = product.images && product.images.length > 1 ? product.images[1] : product.image;

                  return (
                    <React.Fragment key={product.id}>
                      {/* Dynamic Trust Signal Card every 5th item */}
                      {index > 0 && index % 5 === 0 && (
                        <motion.div 
                          initial={{ opacity: 0, y: 15 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: (index % 3) * 0.08 }}
                          className="aspect-[3/4] bg-[#0c0c0e] flex flex-col items-center justify-center text-center p-6 text-white select-none border border-[#fed488]/15 rounded-[1.5rem] shadow-xl relative overflow-hidden group hover:shadow-[0_15px_30px_rgba(254,212,136,0.05)] hover:-translate-y-1 transition-all duration-500 ease-out"
                        >
                          <div className="absolute -top-12 -left-12 w-28 h-28 bg-[#fed488]/5 rounded-full blur-2xl transition-all duration-1000 group-hover:scale-110"></div>
                          <div className="absolute -bottom-12 -right-12 w-28 h-28 bg-[#775a19]/5 rounded-full blur-2xl transition-all duration-1000 group-hover:scale-110"></div>
                          <span className="material-symbols-outlined text-[#fed488] text-3xl mb-4 animate-pulse">local_shipping</span>
                          <h4 className="text-xs font-headline font-black uppercase tracking-[0.2em] mb-2 text-[#fed488] group-hover:text-white transition-colors">Global Shipping</h4>
                          <p className="text-[9px] text-[#eae8e4]/70 uppercase tracking-[0.18em] leading-relaxed max-w-[200px]">
                            Free 2-day delivery across India.
                            <br />
                            DHL Express worldwide.
                          </p>
                          <div className="mt-4 w-12 h-[1px] bg-gradient-to-r from-transparent via-[#fed488]/40 to-transparent group-hover:w-16 transition-all duration-500"></div>
                        </motion.div>
                      )}

                      <motion.div 
                        initial={{ opacity: 0, y: 15 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: (index % 3) * 0.08 }}
                        className="group relative border border-outline-variant/10 p-2 bg-surface-container-lowest hover:shadow-[0_20px_40px_rgba(119,90,25,0.06),0_0_20px_rgba(254,212,136,0.04)] hover:-translate-y-1.5 hover:border-[#fed488]/40 active:scale-[0.98] active:translate-y-0 transition-all duration-500 ease-out rounded-[1.5rem] flex flex-col justify-between"
                      >
                        <Link
                          href={`/product/${product.slug}`}
                          className="block relative aspect-[3/4] overflow-hidden bg-surface-container border border-outline-variant/10 rounded-[1.2rem] select-none"
                        >
                          {/* Primary Image */}
                          <img
                            className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1.5s] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-108"
                            src={product.image}
                            alt={product.title}
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&q=80&w=800";
                            }}
                          />

                          {/* Secondary Image */}
                          <img
                            className="absolute inset-0 w-full h-full object-cover transition-all duration-[1200ms] cubic-bezier(0.25, 1, 0.5, 1) scale-[1.08] opacity-0 group-hover:opacity-100 group-hover:scale-100"
                            src={secondaryImg}
                            alt={`${product.title} Lifestyle`}
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                "https://images.unsplash.com/photo-1503342394128-c104d54dba01?auto=format&fit=crop&q=80&w=800";
                            }}
                          />

                          {badgeElement}

                          {/* Quick Add Menu */}
                          <div className="absolute bottom-0 left-0 w-full bg-surface-container-lowest/80 backdrop-blur-md border-t border-outline-variant/10 p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] z-25 rounded-b-[1.2rem]">
                            <p className="text-[9px] font-bold uppercase tracking-widest text-center mb-3 text-outline">
                              Quick Add - Select Size
                            </p>
                            <div className="grid grid-cols-4 gap-2">
                              {["S", "M", "L", "XL"].map((size) => (
                                <button
                                  key={size}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleAddToCart(product, size);
                                  }}
                                  className="border border-outline-variant/50 text-on-surface hover:bg-[#fed488] hover:text-primary hover:border-secondary py-2 text-[10px] font-black uppercase tracking-widest transition-all duration-300 rounded-lg active:scale-95 cursor-pointer"
                                >
                                  {size}
                                </button>
                              ))}
                            </div>
                          </div>
                        </Link>

                        <div className="pt-4 px-2 pb-2">
                          <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
                            <div className="space-y-1 text-left">
                              <Link href={`/product/${product.slug}`}>
                                <h4 className="text-[10px] font-black uppercase tracking-[0.15em] text-on-surface group-hover:text-[#fed488] transition-colors leading-tight">
                                  {product.title}
                                </h4>
                              </Link>
                              <p className="text-[8px] text-outline uppercase tracking-[0.2em] font-bold">
                                {product.category} • Atelier Series
                              </p>
                            </div>
                            <p className="font-headline font-black text-secondary text-xs shrink-0 self-start">
                              ₹{product.price.toLocaleString("en-IN")}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    </React.Fragment>
                  );
                })}
              </div>
            )}

            {/* PAGINATION */}
            <div className="mt-12 md:mt-20 flex flex-wrap justify-center gap-6 text-xs uppercase">
              <button className="text-gray-300">Prev</button>
              <div className="flex gap-4">
                <span className="border-b border-black">01</span>
                <span>02</span>
                <span>03</span>
              </div>
              <button>Next</button>
            </div>
          </section>
        </div>
      </main>

      {/* Floating Sticky Cart Count Button */}
      <div className="fixed bottom-8 right-8 z-50 flex flex-col gap-4">
        <Link
          href="/shoppingbag"
          className="bg-on-surface text-surface w-14 h-14 flex flex-col items-center justify-center group relative hover:bg-secondary transition-colors rounded-full shadow-2xl hover-scale"
        >
          <span className="material-symbols-outlined text-xl">shopping_cart</span>
          {cartCount > 0 && (
            <span className="text-[8px] font-black absolute top-1 right-1 bg-tertiary w-4 h-4 flex items-center justify-center rounded-full text-white">
              {cartCount}
            </span>
          )}
        </Link>
      </div>

      {/* Mobile Sticky Filter Pill */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[90] lg:hidden">
        <button
          onClick={() => {
            const filtersEl = document.getElementById("shop-filters");
            if (filtersEl) {
              window.scrollTo({
                top: filtersEl.offsetTop - 100,
                behavior: "smooth",
              });
            }
          }}
          className="bg-surface/90 backdrop-blur-md border border-outline/20 text-on-surface px-8 py-3.5 rounded-full flex items-center gap-3 shadow-2xl hover:scale-105 transition-transform"
        >
          <span className="material-symbols-outlined text-[18px]">tune</span>
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">Filter & Sort</span>
        </button>
      </div>

      {/* Footer */}
      <footer className="py-12 bg-[#0A0A0A] text-white px-6 lg:px-20 border-t-4 border-secondary">
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
