"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import Image from "next/image";
import ProductImage from "@/components/ProductImage";
import { Product } from "@/lib/types";
import { useCartStore } from "@/stores/cartStore";
import { useWishlistStore } from "@/stores/wishlistStore";
import { useRecentStore } from "@/stores/recentStore";

interface ShopAllShirtsClientProps {
  initialProducts: Product[];
}

export default function ShopAllShirtsClient({ initialProducts }: ShopAllShirtsClientProps) {
  const pathname = usePathname();
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const cartItems = useCartStore((state) => state.cartItems);
  const cartCount = cartItems.length;
  const addToCartStore = useCartStore((state) => state.addToCart);
  const [isLoading, setIsLoading] = useState(true);

  // Filter & Sort state
  const [products] = useState<Product[]>(initialProducts);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>(["cotton"]); // Default seed-checked in prototype
  const [selectedSize, setSelectedSize] = useState<string>("S"); // Default seed-selected S
  const [maxPrice, setMaxPrice] = useState<number>(12000);
  const [sortBy, setSortBy] = useState<string>("popularity");

  const wishlistStore = useWishlistStore();
  const recentStore = useRecentStore();

  // Pagination & Infinite Scroll states
  const [visibleCount, setVisibleCount] = useState(6);
  const loaderRef = useRef<HTMLDivElement | null>(null);

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Simulated loading transition
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 300);
    return () => clearTimeout(timer);
  }, []);

  // Reset pagination on filter change
  useEffect(() => {
    setVisibleCount(6);
  }, [debouncedSearchQuery, selectedMaterials, selectedSize, maxPrice, sortBy]);

  // Infinite Scroll IntersectionObserver hook
  useEffect(() => {
    if (!loaderRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first.isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + 6, filteredProducts.length));
        }
      },
      { threshold: 0.1 }
    );

    const currentLoader = loaderRef.current;
    observer.observe(currentLoader);

    return () => {
      if (currentLoader) {
        observer.unobserve(currentLoader);
      }
    };
  }, [filteredProducts, visibleCount]);

  // Filter products logic
  useEffect(() => {
    let result = [...products];

    // 0. Exclude Gen-Z products from the heritage catalog
    result = result.filter((p) => !p.isGenz);

    // 1. Search Query Filter
    if (debouncedSearchQuery.trim() !== "") {
      const query = debouncedSearchQuery.toLowerCase();
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
  }, [products, debouncedSearchQuery, selectedMaterials, selectedSize, maxPrice, sortBy]);

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
    addToCartStore({
      productId: product.id,
      productName: product.title,
      price: product.price,
      size: size,
      image: product.image,
      color: product.colors?.[0] || "Default",
    }, 1);

    showToast(`Size ${size} added to bag`);
  };

  return (
    <>
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
            {isLoading ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6 md:gap-8">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="animate-pulse bg-neutral-200 rounded-[1.5rem] aspect-[3/4] w-full" />
                ))}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="py-20 text-center">
                <p className="text-gray-400 text-sm uppercase tracking-widest">No products match your filters.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6 md:gap-8">
                {filteredProducts.slice(0, visibleCount).map((product, index) => {
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
                      <motion.div 
                        initial={{ opacity: 0, y: 15 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: (index % 3) * 0.08 }}
                        className="group relative border border-outline-variant/10 p-2 bg-surface-container-lowest hover:shadow-[0_20px_40px_rgba(119,90,25,0.06),0_0_20px_rgba(254,212,136,0.04)] hover:-translate-y-1.5 hover:border-[#fed488]/40 active:scale-[0.98] active:translate-y-0 transition-all duration-500 ease-out rounded-[1.5rem] flex flex-col justify-between"
                      >
                        <Link
                          href={`/product/${product.slug}`}
                          style={{ aspectRatio: '3/4' }}
                          className="block relative aspect-[3/4] overflow-hidden bg-surface-container border border-outline-variant/10 rounded-[1.2rem] select-none"
                        >
                          {/* Primary Image */}
                          <ProductImage
                            className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1.5s] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-108"
                            src={product.image || "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&q=80&w=800"}
                            alt={product.title}
                            fill
                            loading="lazy"
                            sizes="(max-width: 768px) 50vw, 33vw"
                          />

                          {/* Secondary Image */}
                          <ProductImage
                            className="absolute inset-0 w-full h-full object-cover transition-all duration-[1200ms] cubic-bezier(0.25, 1, 0.5, 1) scale-[1.08] opacity-0 group-hover:opacity-100 group-hover:scale-100"
                            src={secondaryImg || "https://images.unsplash.com/photo-1503342394128-c104d54dba01?auto=format&fit=crop&q=80&w=800"}
                            alt={`${product.title} Lifestyle`}
                            fill
                            loading="lazy"
                            sizes="(max-width: 768px) 50vw, 33vw"
                          />

                          {badgeElement}

                          {/* Wishlist Heart Icon */}
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (wishlistStore.isInWishlist(product.id)) {
                                wishlistStore.removeFromWishlist(product.id);
                              } else {
                                wishlistStore.addToWishlist(product);
                              }
                            }}
                            className="absolute top-2.5 right-2.5 bg-black/70 backdrop-blur-md p-2 rounded-full border border-white/10 text-white z-20 hover:text-red-500 hover:scale-110 active:scale-95 transition-all cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[14px]">
                              {wishlistStore.isInWishlist(product.id) ? "favorite" : "favorite_border"}
                            </span>
                          </button>

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
                              <Link 
                                href={`/product/${product.slug}`}
                                onClick={() => recentStore.addProductToRecent(product)}
                              >
                                <h4 className="text-[10px] font-black uppercase tracking-[0.15em] text-on-surface group-hover:text-[#fed488] transition-colors leading-tight">
                                  {product.title}
                                </h4>
                              </Link>
                              <p className="text-[8px] text-outline uppercase tracking-[0.2em] font-bold">
                                {product.category} • Atelier Series
                              </p>
                            </div>
                            <div className="flex flex-col items-end shrink-0 self-start">
                              <p className="font-headline font-black text-secondary text-xs">
                                ₹{product.price.toLocaleString("en-IN")}
                              </p>
                              {(() => {
                                const effectiveComparePrice = product.compareAtPrice || product.comparePrice;
                                if (effectiveComparePrice && effectiveComparePrice > product.price) {
                                  return (
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      <span className="text-[9px] line-through text-gray-400 font-bold">
                                        ₹{effectiveComparePrice.toLocaleString("en-IN")}
                                      </span>
                                      <span className="text-[8px] font-black text-green-700 uppercase tracking-widest bg-green-50 px-1 py-0.5 border border-green-200/30">
                                        {Math.round((1 - product.price / effectiveComparePrice) * 100)}% OFF
                                      </span>
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    </React.Fragment>
                  );
                })}
              </div>
            )}

            {/* Infinite Scroll Trigger */}
            {visibleCount < filteredProducts.length && (
              <div ref={loaderRef} className="col-span-full py-12 flex justify-center items-center">
                <div className="size-8 text-[#fed488] animate-spin relative flex items-center justify-center">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 48 48">
                    <circle cx="24" cy="24" r="18" stroke="currentColor" strokeWidth="3" strokeDasharray="30 30" strokeLinecap="round" />
                  </svg>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* RECENTLY VIEWED SHELF */}
        {recentStore.recentItems.length > 0 && (
          <section className="mt-20 pt-12 border-t border-outline-variant/10">
            <h3 className="text-xs font-black uppercase tracking-[0.25em] text-outline/80 mb-8 flex items-center gap-2">
              <span className="material-symbols-outlined text-sm text-[#fed488]">history</span>
              Recently Viewed
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
              {recentStore.recentItems.map((item) => (
                <div key={item.id} className="group border border-outline-variant/10 p-2 bg-surface-container-lowest hover:border-[#fed488]/40 rounded-2xl flex flex-col justify-between transition-all duration-300">
                  <Link href={`/product/${item.slug}`} style={{ aspectRatio: '3/4' }} className="relative aspect-[3/4] overflow-hidden rounded-xl bg-surface-container select-none block">
                    <ProductImage
                      src={item.image}
                      alt={item.title}
                      fill
                      className="object-cover group-hover:scale-105 transition duration-500"
                      sizes="(max-width: 768px) 50vw, 25vw"
                    />
                  </Link>
                  <div className="pt-3 px-1 text-left">
                    <h4 className="text-[9px] font-black uppercase tracking-[0.15em] text-on-surface truncate">{item.title}</h4>
                    <p className="font-headline font-black text-secondary text-[10px] mt-1">₹{item.price.toLocaleString("en-IN")}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
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
    </>
  );
}
