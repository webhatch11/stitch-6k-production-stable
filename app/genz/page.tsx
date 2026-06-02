"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Product } from "@/lib/registry";
import { db } from "@/lib/db";

export default function GenZStreetwear() {
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
  
  // Custom categories for Streetwear
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedSize, setSelectedSize] = useState<string>("S"); // Default seed-selected S
  const [maxPrice, setMaxPrice] = useState<number>(12000);
  const [sortBy, setSortBy] = useState<string>("popularity");

  // Load products and initialize cart count
  useEffect(() => {
    const fetchProducts = async () => {
      const allProducts = await db.getProducts();
      // Only Gen-Z products on this page
      const genzProducts = allProducts.filter((p) => p.isGenz);
      setProducts(genzProducts);
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

    // 2. Category Filter
    if (selectedCategories.length > 0) {
      result = result.filter((p) => {
        const cat = p.category ? p.category.toLowerCase() : "";
        return selectedCategories.some((c) => cat.includes(c.toLowerCase()));
      });
    }

    // 3. Size Filter
    if (selectedSize) {
      result = result.filter((p) => {
        if (p.sizeStock) {
          const qty = p.sizeStock[selectedSize as keyof typeof p.sizeStock];
          return qty !== undefined && qty > 0;
        }
        return true;
      });
    }

    // 4. Price Filter
    result = result.filter((p) => p.price <= maxPrice);

    // 5. Sort products
    if (sortBy === "low-high") {
      result.sort((a, b) => a.price - b.price);
    } else if (sortBy === "high-low") {
      result.sort((a, b) => b.price - a.price);
    } else if (sortBy === "newest") {
      result.sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0));
    }

    setFilteredProducts(result);
  }, [products, searchQuery, selectedCategories, selectedSize, maxPrice, sortBy]);

  const handleCategoryChange = (category: string) => {
    const lowerCat = category.toLowerCase();
    if (selectedCategories.includes(lowerCat)) {
      setSelectedCategories(selectedCategories.filter((c) => c !== lowerCat));
    } else {
      setSelectedCategories([...selectedCategories, lowerCat]);
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
    toast.className = "active text-[10px] tracking-widest font-black uppercase";
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
    <div className="min-h-screen bg-[#0f0f11] text-[#eae8e4] flex flex-col font-sans">
      {/* Top Announcement Scrolling Marquee */}
      <div className="marquee-container overflow-hidden w-full bg-neutral-900 text-[#fed488] py-2.5 text-[9px] font-black uppercase tracking-[0.25em] relative z-[60] border-b border-[#fed488]/10">
        <div className="flex animate-marquee whitespace-nowrap">
          <div className="flex shrink-0 items-center gap-12 px-6">
            <span>6K ATELIER STREET: THE STREETWEAR DROP</span>
            <span className="text-secondary-fixed-dim">•</span>
            <span>OVERSIZED FITS & CO-ORD SETS ONLY</span>
            <span className="text-secondary-fixed-dim">•</span>
            <span>LIMITED RUN OF 100 PIECES PER DROP</span>
            <span className="text-secondary-fixed-dim">•</span>
            <span>SHIPPING WORLDWIDE</span>
            <span className="text-secondary-fixed-dim">•</span>
          </div>
          <div className="flex shrink-0 items-center gap-12 px-6">
            <span>6K ATELIER STREET: THE STREETWEAR DROP</span>
            <span className="text-secondary-fixed-dim">•</span>
            <span>OVERSIZED FITS & CO-ORD SETS ONLY</span>
            <span className="text-secondary-fixed-dim">•</span>
            <span>LIMITED RUN OF 100 PIECES PER DROP</span>
            <span className="text-secondary-fixed-dim">•</span>
            <span>SHIPPING WORLDWIDE</span>
            <span className="text-secondary-fixed-dim">•</span>
          </div>
        </div>
      </div>

      {/* Dynamic Responsive Top Header (Brand Identity Anchor) */}
      <header className="fixed top-0 left-0 right-0 z-[100] transition-all duration-500 pt-[calc(0.5rem+env(safe-area-inset-top,0px))] pb-2.5 bg-black/60 backdrop-blur-md border-b border-[#fed488]/10 shadow-sm">
        <div className="flex items-center justify-between max-w-[1400px] mx-auto px-4 md:px-8 lg:px-12 transition-all duration-500 relative min-h-[48px] md:min-h-0">
          <div className="flex items-center gap-12 w-full md:w-auto">
            {/* Logo */}
            <Link href="/" className="flex items-center group hover-scale z-10">
              <div className="w-11 h-11 rounded-full p-1.5 flex items-center justify-center shadow-md bg-white border border-[#fed488]/30">
                <img 
                  src="/assets/logo.png" 
                  alt="6K Logo" 
                  className="max-w-full max-h-full object-contain" 
                  draggable={false}
                />
              </div>
            </Link>

            {/* Desktop Menu */}
            <nav className="hidden md:flex items-center gap-8">
              <Link className="text-[10px] font-black uppercase tracking-widest text-[#eae8e4]/60 hover:text-white transition-colors" href="/">
                Home
              </Link>
              <Link className="text-[10px] font-black uppercase tracking-widest text-[#fed488] font-bold" href="/genz">
                GEN-Z
              </Link>
              <Link className="text-[10px] font-black uppercase tracking-widest text-[#eae8e4]/60 hover:text-white transition-colors" href="/shopallshirts">
                Shop All
              </Link>
              <Link className="text-[10px] font-black uppercase tracking-widest text-[#eae8e4]/60 hover:text-white transition-colors" href="/orderhistory">
                Order History
              </Link>
              <Link className="text-[10px] font-black uppercase tracking-widest text-[#eae8e4]/60 hover:text-white transition-colors" href="/ordertracking">
                Track Order
              </Link>
            </nav>
          </div>

          {/* Right Icons */}
          <div className="flex items-center gap-5 z-10">
            <Link
              href="/shoppingbag"
              className="material-symbols-outlined hover:text-[#fed488] hover-scale hover:-rotate-6 transition-all duration-300 relative text-[#eae8e4]"
            >
              shopping_bag
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center border bg-[#fed488] text-black border-black">
                  {cartCount}
                </span>
              )}
            </Link>
            <Link
              href="/myprofile"
              className="hidden md:block material-symbols-outlined hover:text-[#fed488] hover-scale transition-all duration-300 text-[#eae8e4]"
            >
              person
            </Link>
          </div>
        </div>
      </header>

      {/* Modern Mobile Bottom Navigation Capsule */}
      <div className="md:hidden fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 w-[92%] max-w-[400px] z-[115] bg-black/80 backdrop-blur-md border border-white/10 rounded-full py-2.5 px-6 shadow-[0_12px_40px_rgba(0,0,0,0.8)] flex items-center justify-between text-[#eae8e4] transition-all duration-300">
        <Link href="/" className="flex flex-col items-center gap-0.5 text-[#eae8e4]/60 hover:text-white transition-all">
          <span className="material-symbols-outlined text-[20px]">home</span>
          <span className="text-[8px] font-bold uppercase tracking-wider">Home</span>
        </Link>

        <Link href="/genz" className="flex flex-col items-center gap-0.5 text-[#fed488] font-bold scale-105 transition-all">
          <span className="material-symbols-outlined text-[20px]">style</span>
          <span className="text-[8px] font-bold uppercase tracking-wider">GEN-Z</span>
          <span className="w-1.5 h-1.5 rounded-full bg-[#fed488] mt-0.5 animate-pulse" />
        </Link>

        <Link href="/shopallshirts" className="flex flex-col items-center gap-0.5 text-[#eae8e4]/60 hover:text-white transition-all">
          <span className="material-symbols-outlined text-[20px]">storefront</span>
          <span className="text-[8px] font-bold uppercase tracking-wider">Shop</span>
        </Link>

        <Link href="/shoppingbag" className="flex flex-col items-center gap-0.5 text-[#eae8e4]/60 hover:text-white relative transition-all">
          <span className="material-symbols-outlined text-[20px]">shopping_bag</span>
          {cartCount > 0 && (
            <span className="absolute -top-1.5 -right-2 bg-[#fed488] text-black text-[9px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center border border-[#0c0c0e]">
              {cartCount}
            </span>
          )}
          <span className="text-[8px] font-bold uppercase tracking-wider">Bag</span>
        </Link>

        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="flex flex-col items-center gap-0.5 text-[#eae8e4]/60 hover:text-white">
          <span className="material-symbols-outlined text-[20px]">
            {mobileMenuOpen ? "close" : "menu"}
          </span>
          <span className="text-[8px] font-bold uppercase tracking-wider">
            {mobileMenuOpen ? "Close" : "Menu"}
          </span>
        </button>
      </div>

      {/* Mobile Drawer Menu */}
      <div
        className={`fixed inset-0 z-[105] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 pb-20 md:hidden transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] ${
          mobileMenuOpen ? "clip-path-circle-open" : "clip-path-circle-closed"
        }`}
        style={{
          clipPath: mobileMenuOpen ? "circle(150% at bottom right)" : "circle(0% at bottom right)",
          transition: "clip-path 0.5s cubic-bezier(0.25, 1, 0.5, 1)",
        }}
      >
        <nav className="flex flex-col items-center gap-10 text-center">
          <Link onClick={() => setMobileMenuOpen(false)} className="text-3xl font-headline font-black uppercase tracking-tight text-white hover:text-[#fed488]" href="/">
            Home
          </Link>
          <Link onClick={() => setMobileMenuOpen(false)} className="text-3xl font-headline font-black uppercase tracking-tight text-[#fed488]" href="/genz">
            GEN-Z
          </Link>
          <Link onClick={() => setMobileMenuOpen(false)} className="text-3xl font-headline font-black uppercase tracking-tight text-white hover:text-[#fed488]" href="/shopallshirts">
            Shop All
          </Link>
          <Link onClick={() => setMobileMenuOpen(false)} className="text-3xl font-headline font-black uppercase tracking-tight text-white hover:text-[#fed488]" href="/orderhistory">
            Order History
          </Link>
          <Link onClick={() => setMobileMenuOpen(false)} className="text-3xl font-headline font-black uppercase tracking-tight text-white hover:text-[#fed488]" href="/ordertracking">
            Track Order
          </Link>
        </nav>
      </div>

      {/* Immersive Streetwear Hero Banner */}
      <section className="relative w-full h-[60vh] md:h-[65vh] flex items-center justify-center overflow-hidden pt-[calc(3.5rem+env(safe-area-inset-top,0px))]">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f11] via-[#0f0f11]/40 to-black/75 z-10" />
          <img
            src="/assets/hero_navy_street.jpeg"
            alt="streetwear background"
            className="w-full h-full object-cover grayscale opacity-45 scale-[1.05]"
            draggable={false}
          />
        </div>

        <div className="relative z-20 text-center px-6 max-w-3xl">
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-[#fed488] font-black tracking-[0.45em] text-[10px] md:text-xs uppercase mb-4"
          >
            6K ATELIER STREETWEAR
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-4xl sm:text-5xl md:text-6xl font-black font-headline tracking-tighter uppercase mb-6 leading-none text-white shadow-sm"
          >
            ATELIER STREET
          </motion.h1>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.3 }}
            className="w-16 h-[2px] bg-[#fed488] mx-auto mb-6"
          />
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-[11px] md:text-xs text-neutral-400 font-bold uppercase tracking-widest leading-relaxed"
          >
            Oversized silhouettes, drop shoulders, minimal utility twills, and printed silk blends. Raw edge structures meets high-density tailoring.
          </motion.p>
        </div>
      </section>

      {/* Main Catalog Section */}
      <main className="pb-24 px-4 sm:px-6 md:px-10 lg:px-12 max-w-[1400px] mx-auto w-full flex-grow">
        {/* HEADER BAR */}
        <div className="mb-8 md:mb-12 flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/5 pb-8">
          <div className="max-w-xl">
            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-widest text-[#fed488]">
              The Urban Series
            </h2>
            <p className="text-[10px] md:text-xs text-neutral-400 mt-2 font-medium tracking-wide uppercase">
              Exclusive items optimized for modern street compositions and heavy-wear comfort.
            </p>
            <div className="mt-4 max-w-sm">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="SEARCH STREET DROP..."
                className="w-full text-[10px] uppercase tracking-widest border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-[#fed488]/50 font-bold rounded-lg backdrop-blur-md transition-all text-[#eae8e4] placeholder-neutral-500"
              />
            </div>
          </div>

          {/* SORT DROPDOWN */}
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-neutral-400 select-none bg-white/5 backdrop-blur-md border border-white/10 px-4 py-2.5 rounded-lg shadow-sm hover:border-[#fed488]/30 transition-colors">
            <span>Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-transparent text-white font-black cursor-pointer border-none outline-none uppercase tracking-widest text-[9px] focus:ring-0"
            >
              <option className="bg-[#0f0f11]" value="popularity">Popularity</option>
              <option className="bg-[#0f0f11]" value="newest">Newest</option>
              <option className="bg-[#0f0f11]" value="low-high">Low → High</option>
              <option className="bg-[#0f0f11]" value="high-low">High → Low</option>
            </select>
          </div>
        </div>

        {/* SIDEBAR FILTERS AND PRODUCT LIST */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
          
          {/* SIDEBAR FILTERS (Mood styled) */}
          <aside id="shop-filters" className="lg:col-span-1">
            <div className="bg-white/5 border border-white/10 backdrop-blur-lg p-6 shadow-2xl rounded-2xl relative overflow-hidden">
              <div className="absolute -top-16 -left-16 w-36 h-36 bg-[#fed488]/5 rounded-full blur-3xl"></div>
              
              {/* Header Toggle for Mobile */}
              <div 
                className="flex justify-between items-center lg:cursor-default cursor-pointer relative z-10"
                onClick={() => {
                  if (window.innerWidth < 1024) {
                    setFiltersExpanded(!filtersExpanded);
                  }
                }}
              >
                <h2 className="text-[11px] font-black uppercase tracking-[0.25em] text-[#fed488] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">tune</span>
                  Filter & Setup
                </h2>
                <span className="material-symbols-outlined lg:hidden text-neutral-400 transition-transform duration-300" style={{ transform: filtersExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                  expand_more
                </span>
              </div>

              {/* Collapsible Content */}
              <div className={`space-y-6 transition-all duration-500 ease-in-out overflow-hidden lg:block lg:max-h-none lg:opacity-100 relative z-10 ${filtersExpanded ? 'max-h-[1000px] opacity-100 mt-5' : 'max-h-0 opacity-0 lg:mt-5'}`}>
                <div className="h-[1px] bg-gradient-to-r from-[#fed488]/20 via-white/5 to-transparent"></div>

                {/* CATEGORIES */}
                <div>
                  <h3 className="text-[9px] font-bold uppercase tracking-[0.25em] text-neutral-500 mb-3 select-none">Streetwear Category</h3>
                  <div className="space-y-3">
                    {["Oversized", "Co-ord Sets", "Urban Utility", "Printed Luxury", "Monochrome", "Relaxed Fit"].map((cat) => (
                      <label key={cat} className="flex items-center gap-3 cursor-pointer group select-none text-neutral-300 hover:text-[#fed488] transition-colors font-bold uppercase tracking-wider text-[10px]">
                        <div className="relative flex items-center justify-center">
                          <input
                            type="checkbox"
                            checked={selectedCategories.includes(cat.toLowerCase())}
                            onChange={() => handleCategoryChange(cat)}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 peer"
                          />
                          <div className="w-4 h-4 border border-white/10 rounded transition-all duration-300 bg-white/5 backdrop-blur-sm peer-checked:bg-[#fed488] peer-checked:border-[#fed488] group-hover:border-[#fed488]/40 flex items-center justify-center">
                            <span className="material-symbols-outlined text-[10px] text-neutral-950 font-black opacity-0 peer-checked:opacity-100 transition-opacity duration-300 select-none">
                              check
                            </span>
                          </div>
                        </div>
                        <span>{cat}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="h-[1px] bg-gradient-to-r from-[#fed488]/20 via-white/5 to-transparent"></div>

                {/* SIZE */}
                <div>
                  <h3 className="text-[9px] font-bold uppercase tracking-[0.25em] text-neutral-500 mb-3 select-none">Select Size</h3>
                  <div className="grid grid-cols-4 gap-2">
                    {["S", "M", "L", "XL"].map((size) => (
                      <button
                        key={size}
                        onClick={() => setSelectedSize(size)}
                        className={`py-2 text-[10px] font-bold uppercase tracking-widest transition-all duration-300 rounded-lg border ${
                          selectedSize === size
                            ? "border-[#fed488] text-[#fed488] bg-[#fed488]/10 font-bold"
                            : "border-white/10 text-neutral-400 bg-transparent hover:border-[#fed488]/40 hover:text-white active:scale-95 cursor-pointer"
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="h-[1px] bg-gradient-to-r from-[#fed488]/20 via-white/5 to-transparent"></div>

                {/* PRICE RANGE */}
                <div>
                  <h3 className="text-[9px] font-bold uppercase tracking-[0.25em] text-neutral-500 mb-3 select-none flex justify-between items-center">
                    <span>Limit Price</span>
                    <span className="font-black text-[#fed488]">₹{maxPrice.toLocaleString("en-IN")}</span>
                  </h3>
                  <input
                    type="range"
                    min="1000"
                    max="12000"
                    step="500"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(parseInt(e.target.value))}
                    className="w-full accent-[#fed488] cursor-pointer bg-neutral-800 rounded-lg appearance-none h-1"
                  />
                  <div className="flex justify-between text-[8px] font-bold uppercase tracking-widest mt-2 text-neutral-500 select-none">
                    <span>₹1,000</span>
                    <span>₹12,000</span>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          {/* PRODUCTS GRID */}
          <section className="lg:col-span-3">
            {filteredProducts.length === 0 ? (
              <div className="py-20 text-center bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md">
                <p className="text-neutral-400 text-xs uppercase tracking-widest">No streetwear drops match the selected filters.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
                {filteredProducts.map((product, index) => {
                  let badgeElement = null;
                  if (product.isNew) {
                    badgeElement = (
                      <span className="absolute top-2.5 left-2.5 bg-black/80 backdrop-blur-md text-[#fed488] border border-[#fed488]/30 px-2.5 py-0.5 text-[7px] font-black uppercase tracking-[0.18em] z-10 rounded-full shadow-md">
                        Drop New
                      </span>
                    );
                  } else if (product.stock && product.stock < 35) {
                    badgeElement = (
                      <span className="absolute top-2.5 left-2.5 bg-black/80 backdrop-blur-md text-red-400 border border-red-400/30 px-2.5 py-0.5 text-[7px] font-black uppercase tracking-[0.18em] z-10 rounded-full shadow-md flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span> Low Run
                      </span>
                    );
                  }

                  const secondaryImg = product.images && product.images.length > 1 ? product.images[1] : product.image;

                  return (
                    <motion.div
                      key={product.id}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: (index % 3) * 0.08 }}
                      className="group relative border border-white/5 p-2 bg-[#121214] hover:shadow-[0_20px_50px_rgba(0,0,0,0.6),0_0_20px_rgba(254,212,136,0.03)] hover:-translate-y-1.5 hover:border-[#fed488]/30 active:scale-[0.98] active:translate-y-0 transition-all duration-500 ease-out rounded-2xl flex flex-col justify-between"
                    >
                      <Link
                        href={`/product/${product.slug}`}
                        className="block relative aspect-[3/4] overflow-hidden bg-neutral-900 border border-white/5 rounded-xl select-none"
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

                        {/* Secondary Image on Hover */}
                        <img
                          className="absolute inset-0 w-full h-full object-cover transition-all duration-[1200ms] ease-out scale-[1.08] opacity-0 group-hover:opacity-100 group-hover:scale-100"
                          src={secondaryImg}
                          alt={`${product.title} Detail`}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              "https://images.unsplash.com/photo-1503342394128-c104d54dba01?auto=format&fit=crop&q=80&w=800";
                          }}
                        />

                        {badgeElement}

                        {/* Quick Add Menu */}
                        <div className="absolute bottom-0 left-0 w-full bg-black/85 backdrop-blur-md border-t border-white/5 p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] z-25 rounded-b-xl">
                          <p className="text-[8px] font-black uppercase tracking-widest text-center mb-3 text-neutral-400">
                            Select Size to Add
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
                                className="border border-white/10 text-white hover:bg-[#fed488] hover:text-black hover:border-transparent py-2 text-[9px] font-black uppercase tracking-widest transition-all duration-300 rounded-lg active:scale-95 cursor-pointer"
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
                              <h4 className="text-[10px] font-black uppercase tracking-[0.15em] text-white group-hover:text-[#fed488] transition-colors leading-tight">
                                {product.title}
                              </h4>
                            </Link>
                            <p className="text-[8px] text-neutral-500 uppercase tracking-[0.2em] font-bold">
                              {product.category} • Street Drops
                            </p>
                          </div>
                          <p className="font-headline font-black text-[#fed488] text-xs shrink-0 self-start">
                            ₹{product.price.toLocaleString("en-IN")}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Global Footer (Matching Dark Streetwear Aesthetics) */}
      <footer className="py-12 bg-black text-white px-6 lg:px-20 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <img 
                  src="/assets/logo.png" 
                  alt="6K Logo" 
                  className="h-8 w-auto object-contain bg-white rounded-full p-1"
                  draggable={false}
                />
                <span className="font-headline text-2xl font-black tracking-tighter uppercase text-white">6K STREET</span>
              </div>
              <p className="text-[10px] text-neutral-400 leading-relaxed max-w-sm uppercase tracking-widest font-light mb-6">
                Premium streetwear drops born from high-density weaves. Limited editions, engineered in South India.
              </p>
            </div>
            <div className="lg:text-right flex flex-col lg:items-end justify-center">
              <h4 className="text-lg font-headline font-black uppercase tracking-tight mb-2 text-white">Join the Street Atelier</h4>
              <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-500 mb-4">Drop notifications & private links.</p>
              <div className="flex w-full lg:max-w-md border-b border-white/10 pb-2 focus-within:border-[#fed488] transition-colors">
                <input type="email" placeholder="EMAIL ADDRESS" className="bg-transparent border-none outline-none w-full text-[10px] uppercase tracking-widest text-white placeholder-neutral-600 px-2" />
                <button className="text-[10px] font-black uppercase tracking-[0.2em] text-[#fed488] hover:text-white transition-colors px-2">Join</button>
              </div>
            </div>
          </div>
          <div className="pt-6 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-[9px] font-bold uppercase tracking-[0.4em] text-neutral-500">© 2026 6K Shirts. Streetwear Division.</p>
          </div>
        </div>
      </footer>

      {/* Floating Sticky Cart Count Button */}
      <div className="fixed bottom-8 right-8 z-50">
        <Link
          href="/shoppingbag"
          className="bg-[#fed488] text-black w-14 h-14 flex flex-col items-center justify-center group relative hover:bg-white transition-colors rounded-full shadow-2xl hover-scale"
        >
          <span className="material-symbols-outlined text-xl">shopping_cart</span>
          {cartCount > 0 && (
            <span className="text-[8px] font-black absolute top-1 right-1 bg-black text-[#fed488] w-4 h-4 flex items-center justify-center rounded-full">
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
          className="bg-black/90 backdrop-blur-md border border-white/10 text-white px-8 py-3.5 rounded-full flex items-center gap-3 shadow-2xl hover:scale-105 transition-transform"
        >
          <span className="material-symbols-outlined text-[18px]">tune</span>
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">Filter & Sort</span>
        </button>
      </div>
    </div>
  );
}
