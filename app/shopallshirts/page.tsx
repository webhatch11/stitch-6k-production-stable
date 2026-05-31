"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Product } from "@/lib/registry";
import { db } from "@/lib/db";

export default function ShopAllShirts() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);

  // Filter & Sort state
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>(["cotton"]); // Default seed-checked in prototype
  const [selectedSize, setSelectedSize] = useState<string>("S"); // Default seed-selected S
  const [maxPrice, setMaxPrice] = useState<number>(12000);
  const [sortBy, setSortBy] = useState<string>("popularity");

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
  }, [products, searchQuery, selectedMaterials, maxPrice, sortBy]);

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

      {/* Desktop Top Header (Hidden on Mobile) */}
      <header className="hidden md:block md:sticky md:top-0 z-50 bg-surface/80 backdrop-blur-xl border-b border-outline-variant/10 px-6 lg:px-20 py-2.5">
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
            <nav className="flex items-center gap-8">
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
          <div className="flex items-center gap-6">
            <Link href="/shoppingbag" className="material-symbols-outlined text-outline hover:text-primary transition-colors relative">
              shopping_bag
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-secondary text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-surface">
                  {cartCount}
                </span>
              )}
            </Link>
            <Link href="/myprofile" className="material-symbols-outlined text-outline hover:text-primary transition-colors">
              person
            </Link>
            <Link href="/admindashboard" className="material-symbols-outlined text-outline hover:text-primary transition-colors">
              admin_panel_settings
            </Link>
          </div>
        </div>
      </header>

      {/* Modern Mobile Bottom Navigation Capsule */}
      <div className="md:hidden fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 w-[92%] max-w-[400px] z-[115] bg-[#0c0c0e]/95 backdrop-blur-xl border border-white/10 rounded-full py-2.5 px-6 shadow-[0_12px_40px_rgba(0,0,0,0.5)] flex items-center justify-between text-[#eae8e4] transition-all duration-300">
        {/* Home Tab */}
        <Link 
          href="/" 
          className="flex flex-col items-center gap-0.5 text-[#eae8e4]/70 hover:text-secondary-fixed-dim focus:text-secondary-fixed-dim transition-colors group"
        >
          <span className="material-symbols-outlined text-[20px]">home</span>
          <span className="text-[8px] font-bold uppercase tracking-wider scale-95 group-hover:scale-100 transition-transform">Home</span>
        </Link>

        {/* Shop Tab */}
        <Link 
          href="/shopallshirts" 
          className="flex flex-col items-center gap-0.5 text-secondary-fixed-dim transition-colors group"
        >
          <span className="material-symbols-outlined text-[20px]">storefront</span>
          <span className="text-[8px] font-bold uppercase tracking-wider scale-100 transition-transform">Shop</span>
        </Link>

        {/* Bag Tab (with real-time count badge) */}
        <Link 
          href="/shoppingbag" 
          className="flex flex-col items-center gap-0.5 text-[#eae8e4]/70 hover:text-secondary-fixed-dim focus:text-secondary-fixed-dim transition-colors group relative"
        >
          <span className="material-symbols-outlined text-[20px]">shopping_bag</span>
          {cartCount > 0 && (
            <span className="absolute -top-1.5 -right-2 bg-secondary text-white text-[9px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center border border-[#0c0c0e] animate-pulse">
              {cartCount}
            </span>
          )}
          <span className="text-[8px] font-bold uppercase tracking-wider scale-95 group-hover:scale-100 transition-transform">Bag</span>
        </Link>

        {/* Profile Tab */}
        <Link 
          href="/myprofile" 
          className="flex flex-col items-center gap-0.5 text-[#eae8e4]/70 hover:text-secondary-fixed-dim focus:text-secondary-fixed-dim transition-colors group"
        >
          <span className="material-symbols-outlined text-[20px]">person</span>
          <span className="text-[8px] font-bold uppercase tracking-wider scale-95 group-hover:scale-100 transition-transform">Profile</span>
        </Link>

        {/* Menu drawer trigger */}
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)} 
          className="flex flex-col items-center gap-0.5 text-[#eae8e4]/70 hover:text-secondary-fixed-dim focus:text-secondary-fixed-dim transition-colors group focus:outline-none"
        >
          <span className="material-symbols-outlined text-[20px] transition-transform duration-300">
            {mobileMenuOpen ? "close" : "menu"}
          </span>
          <span className="text-[8px] font-bold uppercase tracking-wider scale-95 group-hover:scale-100 transition-transform">
            {mobileMenuOpen ? "Close" : "Menu"}
          </span>
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
      <main className="pt-16 md:pt-24 pb-16 md:pb-24 px-4 sm:px-6 md:px-10 lg:px-12 min-h-screen">
        {/* HEADER */}
        <header className="mb-10 md:mb-16 flex flex-col lg:flex-row justify-between gap-6">
          <div className="max-w-xl">
            <h1 className="text-2xl sm:text-3xl md:text-5xl font-extrabold uppercase mb-3 md:mb-4">
              The Heritage Shirt
            </h1>
            <p className="text-sm sm:text-base text-gray-500 leading-relaxed">
              Premium handcrafted shirts blending traditional Indian textiles with modern style.
            </p>
            <div className="mt-4 max-w-sm">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search SKU or name..."
                className="w-full text-xs border border-outline-variant/60 bg-transparent px-4 py-2.5 outline-none focus:border-secondary font-bold"
              />
            </div>
          </div>

          {/* SORT */}
          <div className="flex items-center gap-3 text-xs uppercase font-bold text-gray-500 self-end lg:self-auto">
            <span>Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-transparent text-black font-bold cursor-pointer border-none outline-none"
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
          <aside id="shop-filters" className="lg:col-span-1 space-y-8">
            <div className="bg-surface-container-lowest border border-outline-variant/10 p-6 space-y-6 shadow-sm">
              {/* MATERIAL */}
              <div>
                <h3 className="text-xs font-bold uppercase mb-3">Material</h3>
                <div className="space-y-2 text-xs">
                  {["Linen", "Cotton", "Silk", "Denim"].map((material) => (
                    <label key={material} className="flex gap-2 items-center cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={selectedMaterials.includes(material.toLowerCase())}
                        onChange={() => handleMaterialChange(material)}
                        className="accent-secondary"
                      />{" "}
                      {material === "Silk" ? "Silk Blend" : material}
                    </label>
                  ))}
                </div>
              </div>

              {/* SIZE */}
              <div>
                <h3 className="text-xs font-bold uppercase mb-3 text-on-surface/80 tracking-widest">Size</h3>
                <div className="grid grid-cols-4 gap-2">
                  {["S", "M", "L", "XL"].map((size) => (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      className={`border py-2 text-[10px] font-black uppercase tracking-widest btn-active-scale transition-all duration-300 ${
                        selectedSize === size
                          ? "border-on-surface text-surface bg-on-surface"
                          : "border-outline-variant/60 text-outline bg-transparent hover:border-on-surface hover:text-on-surface"
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              {/* PRICE */}
              <div>
                <h3 className="text-xs font-bold uppercase mb-3 text-on-surface/80 tracking-widest">
                  Max Price: <span className="font-bold text-secondary">₹{maxPrice.toLocaleString("en-IN")}</span>
                </h3>
                <input
                  type="range"
                  min="1000"
                  max="12000"
                  step="500"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(parseInt(e.target.value))}
                  className="w-full accent-secondary cursor-pointer"
                />
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest mt-2 text-outline">
                  <span>₹1K</span>
                  <span>₹12K</span>
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
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-10">
                {filteredProducts.map((product, index) => {
                  // Dynamic Badges
                  let badgeElement = null;
                  if (product.isNew) {
                    badgeElement = (
                      <span className="absolute top-3 left-3 bg-surface-container-lowest/95 backdrop-blur-md text-secondary border border-secondary/20 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.15em] z-10 shadow-sm">
                        New Arrival
                      </span>
                    );
                  } else if (product.stock && product.stock < 30) {
                    badgeElement = (
                      <span className="absolute top-3 left-3 bg-surface-container-lowest/95 backdrop-blur-md text-red-700 border border-red-200 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.15em] z-10 shadow-sm flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse"></span> Only {product.stock} Left
                      </span>
                    );
                  } else if (product.price > 1800) {
                    badgeElement = (
                      <span className="absolute top-3 left-3 bg-on-surface text-secondary-fixed px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.15em] z-10 border border-secondary/30 shadow-sm">
                        Atelier Exclusive
                      </span>
                    );
                  }

                  const secondaryImg = product.images && product.images.length > 1 ? product.images[1] : product.image;

                  return (
                    <React.Fragment key={product.id}>
                      {/* Dynamic Trust Signal Card every 5th item */}
                      {index > 0 && index % 5 === 0 && (
                        <div className="aspect-[3/4] bg-[#0A0A0A] flex flex-col items-center justify-center text-center p-8 text-white select-none border border-white/5">
                          <span className="material-symbols-outlined text-secondary text-4xl mb-6">local_shipping</span>
                          <h4 className="text-sm font-headline font-black uppercase tracking-widest mb-3">Global Shipping</h4>
                          <p className="text-[10px] text-white/50 uppercase tracking-widest leading-loose">
                            Free 2-day delivery across India.
                            <br />
                            DHL Express worldwide.
                          </p>
                        </div>
                      )}

                      <div className="group relative border border-outline-variant/10 p-2 bg-surface-container-lowest hover:shadow-xl hover:border-secondary/20 transition-all duration-500 flex flex-col justify-between">
                        <Link
                          href={`/product/${product.slug}`}
                          className="block relative aspect-[3/4] overflow-hidden bg-surface-container border border-outline-variant/10"
                        >
                          {/* Primary Image */}
                          <img
                            className="absolute inset-0 w-full h-full object-cover transition-all duration-[1000ms] cubic-bezier(0.25, 1, 0.5, 1) group-hover:scale-105"
                            src={product.image}
                            alt={product.title}
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&q=80&w=800";
                            }}
                          />

                          {/* Secondary Image */}
                          <img
                            className="absolute inset-0 w-full h-full object-cover transition-all duration-[1200ms] cubic-bezier(0.25, 1, 0.5, 1) scale-[1.05] opacity-0 group-hover:opacity-100 group-hover:scale-100"
                            src={secondaryImg}
                            alt={`${product.title} Lifestyle`}
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                "https://images.unsplash.com/photo-1503342394128-c104d54dba01?auto=format&fit=crop&q=80&w=800";
                            }}
                          />

                          {badgeElement}

                          {/* Quick Add Menu */}
                          <div className="absolute bottom-0 left-0 w-full bg-surface-container-lowest/80 backdrop-blur-md border-t border-outline-variant/10 p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] z-20">
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
                                  className="border border-outline-variant/50 text-on-surface hover:bg-secondary hover:text-white hover:border-secondary py-2 text-[10px] font-black uppercase tracking-widest transition-all duration-300 btn-active-scale"
                                >
                                  {size}
                                </button>
                              ))}
                            </div>
                          </div>
                        </Link>

                        <div className="pt-4 px-2 pb-2">
                          <div className="flex justify-between items-start gap-3">
                            <div className="space-y-1">
                              <Link href={`/product/${product.slug}`}>
                                <h4 className="text-[10px] font-black uppercase tracking-[0.15em] text-on-surface group-hover:text-secondary transition-colors leading-tight">
                                  {product.title}
                                </h4>
                              </Link>
                              <p className="text-[8px] text-outline uppercase tracking-[0.2em] font-semibold">
                                {product.category} • Atelier Series
                              </p>
                            </div>
                            <p className="font-headline font-black text-secondary text-xs shrink-0">
                              ₹{product.price.toLocaleString("en-IN")}
                            </p>
                          </div>
                        </div>
                      </div>
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
