"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { RegistryManager, Product } from "@/lib/registry";

export default function ProductDetailPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;
  const [product, setProduct] = useState<Product | null>(null);
  const [recommendations, setRecommendations] = useState<Product[]>([]);


  const [cartCount, setCartCount] = useState(0);
  const [animateCart, setAnimateCart] = useState(false);

  // Toast State
  const [toastText, setToastText] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [toastItem, setToastItem] = useState<{ productName: string; size: string; image: string } | null>(null);

  const triggerToast = (msg: string, itemData?: { productName: string; size: string; image: string }) => {
    setToastText(msg);
    setToastItem(itemData || null);
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 4500);
  };

  // Product page interactive state
  const [activeImg, setActiveImg] = useState("");
  const [imgAnimating, setImgAnimating] = useState(false);
  const [selectedSize, setSelectedSize] = useState("M");

  // Accordion open/close state
  const [accordionOpen, setAccordionOpen] = useState({
    details: true,
    material: false,
    care: false,
  });

  useEffect(() => {
    // Scroll page to top when product ID changes
    window.scrollTo(0, 0);

    // Fetch product
    if (productId) {
      const allProducts = RegistryManager.getProducts();
      const foundProduct = allProducts.find(p => p.id === productId);
      if (foundProduct) {
        setProduct(foundProduct);
        if (foundProduct.images && foundProduct.images.length > 0) {
          setActiveImg(foundProduct.images[0]);
        } else {
          setActiveImg(foundProduct.image);
        }

        // Set first available size with stock > 0
        const sizes: ("S" | "M" | "L" | "XL" | "XXL")[] = ["S", "M", "L", "XL", "XXL"];
        const inStockSize = sizes.find(
          (size) => foundProduct.sizeStock && (foundProduct.sizeStock[size] || 0) > 0
        );
        if (inStockSize) {
          setSelectedSize(inStockSize);
        } else {
          setSelectedSize("M");
        }

        // Generate dynamic recommendations (same category first, exclude current item)
        const otherProducts = allProducts.filter(p => p.id !== productId);
        const sameCategory = otherProducts.filter(p => p.category === foundProduct.category);
        const differentCategory = otherProducts.filter(p => p.category !== foundProduct.category);
        const combinedRecs = [...sameCategory, ...differentCategory].slice(0, 4);
        setRecommendations(combinedRecs);
      } else {
        router.push("/shopallshirts");
      }
    }

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
  }, [productId]);

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



  const addToCart = (redirect = false) => {
    let cart = [];
    try {
      cart = JSON.parse(localStorage.getItem("cart_items") || "[]");
    } catch (e) {
      console.error(e);
    }

    cart.push({
      productId: product?.id,
      productName: product?.title || "Designer Shirt",
      price: product?.price || 2499,
      size: selectedSize,
      image: activeImg || product?.image,
    });

    localStorage.setItem("cart_items", JSON.stringify(cart));
    const newCount = cartCount + 1;
    localStorage.setItem("cartCount", newCount.toString());
    setCartCount(newCount);

    // Trigger cart badge bounce micro-animation
    setAnimateCart(true);
    setTimeout(() => setAnimateCart(false), 1000);

    triggerToast(`${product?.title || "Item"} added to bag`, {
      productName: product?.title || "Designer Shirt",
      size: selectedSize,
      image: activeImg || product?.image || "",
    });

    if (redirect) {
      setTimeout(() => {
        router.push("/shoppingbag");
      }, 500);
    }
  };

  if (!product) {
    return <div className="min-h-screen bg-black flex items-center justify-center text-white">Loading product...</div>;
  }

  return (
    <>
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-6 right-6 z-[1000] bg-white border border-[#775a19]/25 p-5 w-80 shadow-2xl animate-fade-in flex flex-col gap-4">
          {toastItem ? (
            <>
              <div className="flex gap-4">
                {toastItem.image && (
                  <div className="w-12 h-16 bg-[#faf9f8] border border-outline-variant/15 p-0.5 flex-shrink-0">
                    <img src={toastItem.image} className="w-full h-full object-cover" alt="Product Thumbnail" />
                  </div>
                )}
                <div className="flex-1 flex flex-col justify-center">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-green-700 flex items-center gap-1.5 mb-1">
                    <span className="material-symbols-outlined text-xs">check_circle</span> Added to Bag
                  </p>
                  <h4 className="text-[11px] font-headline font-black uppercase tracking-wider text-[#0a0a0a] leading-tight truncate">
                    {toastItem.productName}
                  </h4>
                  <p className="text-[8px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">
                    Size: {toastItem.size} | Qty: 1
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowToast(false);
                  }}
                  className="flex-1 bg-white border border-gray-200 text-gray-600 hover:text-black py-2.5 text-[9px] font-black uppercase tracking-widest transition-colors cursor-pointer"
                >
                  Continue
                </button>
                <Link
                  href="/shoppingbag"
                  className="flex-1 bg-[#1a1c1c] text-white text-center py-2.5 text-[9px] font-black uppercase tracking-widest hover:bg-[#775a19] transition-colors flex items-center justify-center gap-1"
                >
                  View Bag <span className="material-symbols-outlined text-[10px]">arrow_forward</span>
                </Link>
              </div>
            </>
          ) : (
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-[#775a19] text-base">info</span>
              <div className="flex-1">
                <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Notification</p>
                <p className="text-[10px] uppercase font-black tracking-wider text-on-surface mt-1 leading-relaxed">
                  {toastText}
                </p>
              </div>
              <button 
                onClick={() => setShowToast(false)} 
                className="material-symbols-outlined text-gray-400 hover:text-black text-sm bg-transparent border-none cursor-pointer"
              >
                close
              </button>
            </div>
          )}
        </div>
      )}

      {/* Announcement Marquee */}


      {/* Main Content */}
      <main className="pt-20 md:pt-32 pb-24 px-6 md:px-12 max-w-[1440px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20">
          {/* Left Side: Product Gallery */}
          <div className="lg:col-span-7">
            <div className="grid grid-cols-12 gap-4">
              {/* Vertical Thumbnails */}
              <div className="hidden md:flex flex-col gap-4 col-span-2">
                {(product.images && product.images.length > 0 ? product.images : [product.image]).map((src, idx) => (
                  <button
                    key={idx}
                    onClick={() => swapImage(src)}
                    className={`aspect-[3/4] bg-surface-container-low border overflow-hidden cursor-pointer transition-all duration-300 hover:scale-[1.03] ${
                      activeImg === src ? "border-secondary thumb-active" : "border-outline-variant/10 opacity-70 hover:opacity-100"
                    }`}
                  >
                    <img className="w-full h-full object-cover" src={src} alt={`${product.title} view ${idx + 1}`} />
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
                <span>{product.category || "Signature Series"}</span>
              </div>
              <h1 className="text-4xl sm:text-5xl font-black font-headline tracking-tighter text-on-surface leading-[1.05] uppercase">
                {product.title}
              </h1>
              <div className="flex items-center gap-6 pt-2">
                <span className="text-3xl font-extrabold text-secondary tracking-tight">₹{product.price.toLocaleString("en-IN")}</span>
                {product.customBadge && (
                  <span className="bg-secondary/10 border border-secondary/20 text-secondary text-[8px] font-black uppercase tracking-[0.2em] px-2.5 py-1">
                    {product.customBadge}
                  </span>
                )}
                {!product.customBadge && product.isNew && (
                  <span className="bg-secondary/10 border border-secondary/20 text-secondary text-[8px] font-black uppercase tracking-[0.2em] px-2.5 py-1">
                    New Arrival
                  </span>
                )}
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
                    triggerToast("Size Guide (Inches) - S: 38 | M: 40 | L: 42 | XL: 44 | XXL: 46")
                  }
                  className="text-[10px] uppercase tracking-widest font-black text-secondary hover:text-primary transition-colors pb-0.5"
                >
                  Size Guide
                </button>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {["S", "M", "L", "XL", "XXL"].map((size) => {
                  const isOutOfStock = product.sizeStock
                    ? (product.sizeStock[size as keyof typeof product.sizeStock] || 0) <= 0
                    : false;
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
              {product.stock !== undefined && product.stock <= 0 ? (
                <button
                  disabled
                  className="w-full py-5 bg-outline-variant/25 text-outline cursor-not-allowed font-black uppercase tracking-[0.2em] text-xs"
                >
                  Sold Out
                </button>
              ) : (
                <>
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
                </>
              )}
            </div>

            {/* Trust Badges */}
            <div className="grid grid-cols-2 gap-4 py-6 border-t border-b border-outline-variant/30 text-outline">
              <div className="flex items-center space-x-3">
                <span className="material-symbols-outlined text-secondary text-lg">local_shipping</span>
                <span className="text-[9px] uppercase tracking-widest font-black leading-tight">
                  Free Express Shipping
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
                    {product.description || "Master-tailored in our workspace from the finest long-staple linen. Every seam is carefully finished by hand to ensure a perfect fit and long-lasting quality. This is our signature shirt—uncompromising in design and detail."}
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
            {recommendations.map((rec) => {
              const primaryImg = rec.image || "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&q=80&w=800";
              const secondaryImg = rec.images && rec.images.length > 1 ? rec.images[1] : primaryImg;
              
              // Determine best badge to display
              let badgeText = "";
              let badgeColorClass = "text-secondary border-secondary/20";
              if (rec.stock !== undefined && rec.stock <= 0) {
                badgeText = "Sold Out";
                badgeColorClass = "text-red-700 border-red-200";
              } else if (rec.stock !== undefined && rec.stock > 0 && rec.stock <= 10) {
                badgeText = "Low Stock";
                badgeColorClass = "text-red-700 border-red-200";
              } else if (rec.customBadge) {
                badgeText = rec.customBadge;
                badgeColorClass = "text-secondary border-secondary/20";
              } else if (rec.isAtelierExclusive) {
                badgeText = "Atelier Exclusive";
                badgeColorClass = "text-secondary border-secondary/20";
              } else if (rec.isNew) {
                badgeText = "New Arrival";
                badgeColorClass = "text-secondary border-secondary/20";
              }

              return (
                <div key={rec.id} className="group border border-outline-variant/10 p-2 bg-surface-container-lowest hover:shadow-xl hover:border-secondary/20 transition-all duration-500">
                  <Link href={`/product/${rec.id}`} className="block relative aspect-[3/4] overflow-hidden bg-surface-container border border-outline-variant/10">
                    <img
                      className="absolute inset-0 w-full h-full object-cover transition-all duration-[1000ms] group-hover:scale-105"
                      src={primaryImg}
                      alt={rec.title}
                    />
                    <img
                      className="absolute inset-0 w-full h-full object-cover transition-all duration-[1200ms] scale-[1.05] opacity-0 group-hover:opacity-100 group-hover:scale-100"
                      src={secondaryImg}
                      alt={`${rec.title} Detail`}
                    />
                    {badgeText && (
                      <span className={`absolute top-3 left-3 bg-surface-container-lowest/95 backdrop-blur-md px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.15em] z-10 shadow-sm border ${badgeColorClass} ${badgeText === "Low Stock" ? "flex items-center gap-1.5" : ""}`}>
                        {badgeText === "Low Stock" && (
                          <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse"></span>
                        )}
                        {badgeText}
                      </span>
                    )}
                  </Link>
                  <div className="pt-4 px-2 pb-2">
                    <div className="flex justify-between items-start gap-3">
                      <div className="space-y-1">
                        <Link href={`/product/${rec.id}`} className="text-[10px] font-black uppercase tracking-[0.15em] text-on-surface group-hover:text-secondary transition-colors leading-tight cursor-pointer block">
                          {rec.title}
                        </Link>
                        <p className="text-[8px] text-outline uppercase tracking-[0.2em] font-semibold">{rec.category} • Atelier Series</p>
                      </div>
                      <p className="font-headline font-black text-secondary text-xs shrink-0">₹{rec.price.toLocaleString("en-IN")}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* Sticky Buy Bar for Mobile */}
      <div className="fixed bottom-0 left-0 w-full bg-surface-container-lowest/90 backdrop-blur-xl border-t border-outline-variant/10 px-6 py-4 flex items-center justify-between z-40 md:hidden">
        <div className="flex flex-col">
          <span className="text-xs font-extrabold text-secondary">₹{product.price.toLocaleString("en-IN")}</span>
          <span className="text-[8px] uppercase tracking-widest text-outline font-black mt-0.5">{product.title}</span>
        </div>
        <button
          onClick={() => addToCart(true)}
          className="bg-on-surface text-surface px-8 py-3.5 text-xs font-black uppercase tracking-[0.2em] btn-active-scale"
        >
          Buy Now
        </button>
      </div>
    </>
  );
}
