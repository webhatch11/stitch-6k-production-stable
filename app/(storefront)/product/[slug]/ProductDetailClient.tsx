"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import ProductImage from "@/components/ProductImage";
import { useRouter } from "next/navigation";
import { Product } from "@/lib/types";
import { useCartStore } from "@/stores/cartStore";
import { useRecentStore } from "@/stores/recentStore";
import { useWishlistStore } from "@/stores/wishlistStore";
import { trackViewProduct, trackAddToCart } from "@/lib/analytics";
import { LOW_STOCK_THRESHOLD, LOW_STOCK_SIZE_THRESHOLD, URGENT_STOCK_THRESHOLD } from "@/lib/inventory-config";

interface ProductDetailClientProps {
  product: Product;
}

export default function ProductDetailClient({ product }: ProductDetailClientProps) {
  const router = useRouter();
  const addToCartStore = useCartStore((state) => state.addToCart);
  const addProductToRecent = useRecentStore((state) => state.addProductToRecent);
  const recentItems = useRecentStore((state) => state.recentItems);
  const wishlistStore = useWishlistStore();
  const isInWishlist = wishlistStore.isInWishlist(product.id);

  const [animateCart, setAnimateCart] = useState(false);

  // Toast State
  const [toastText, setToastText] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [toastItem, setToastItem] = useState<{ productName: string; size: string; image: string } | null>(null);
  const [showSizeGuide, setShowSizeGuide] = useState(false);

  // Interactive Product States
  const [activeImg, setActiveImg] = useState("");
  const [touchStartX, setTouchStartX] = useState(0);
  const [imgAnimating, setImgAnimating] = useState(false);
  const [selectedSize, setSelectedSize] = useState("M");
  const [selectedColor, setSelectedColor] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [isZoomed, setIsZoomed] = useState(false);

  // Accordion open/close state
  const [accordionOpen, setAccordionOpen] = useState({
    details: true,
    material: false,
    care: false,
  });

  const triggerToast = (msg: string, itemData?: { productName: string; size: string; image: string }) => {
    setToastText(msg);
    setToastItem(itemData || null);
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 4500);
  };

  useEffect(() => {
    if (product) {
      if (product.images && product.images.length > 0) {
        setActiveImg(product.images[0]);
      } else {
        setActiveImg(product.image);
      }

      // Set first available size with stock > 0
      const sizes: ("S" | "M" | "L" | "XL" | "XXL")[] = ["S", "M", "L", "XL", "XXL"];
      const inStockSize = sizes.find(
        (size) => product.sizeStock && (product.sizeStock[size] || 0) > 0
      );
      if (inStockSize) {
        setSelectedSize(inStockSize);
      } else {
        setSelectedSize("M");
      }

      // Set default color
      if (product.colors && product.colors.length > 0) {
        setSelectedColor(product.colors[0]);
      } else {
        setSelectedColor("Default");
      }

      // Track as recently viewed
      addProductToRecent(product);

      trackViewProduct({
        productId: product.id,
        productName: product.title,
        price: product.price,
        category: product.category || "Apparel",
      });
    }
  }, [product]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.fbq && product) {
      window.fbq('track', 'ViewContent', {
        content_ids: [product.id],
        content_name: product.title,
        content_type: 'product',
        value: product.price,
        currency: 'INR'
      });
    }
  }, [product.id, product.title, product.price]);

  // Clamp quantity when size changes to prevent choosing more than stock
  useEffect(() => {
    setQuantity(1);
  }, [selectedSize]);

  const swapImage = (newSrc: string) => {
    if (newSrc === activeImg) return;
    setImgAnimating(true);
    setTimeout(() => {
      setActiveImg(newSrc);
      setImgAnimating(false);
    }, 300);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndX = e.changedTouches[0].clientX;
    const diffX = touchStartX - touchEndX;

    const images = product.images && product.images.length > 0 ? product.images : [product.image];
    const currentIndex = images.indexOf(activeImg);

    if (diffX > 50) {
      // Swipe Left -> next image
      const nextIndex = (currentIndex + 1) % images.length;
      swapImage(images[nextIndex]);
    } else if (diffX < -50) {
      // Swipe Right -> previous image
      const prevIndex = (currentIndex - 1 + images.length) % images.length;
      swapImage(images[prevIndex]);
    }
  };

  const toggleAccordion = (section: "details" | "material" | "care") => {
    setAccordionOpen((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const addToCart = (redirect = false) => {
    if (!product) return;

    // Add selected items to Zustand store
    addToCartStore({
      productId: product.id,
      productName: product.title,
      price: product.price,
      size: selectedSize,
      image: activeImg || product.image,
      color: selectedColor || product.colors?.[0] || "Default",
    }, quantity);

    trackAddToCart({
      productId: product.id,
      productName: product.title,
      price: product.price,
      size: selectedSize,
      color: selectedColor || product.colors?.[0] || "Default",
    });

    if (typeof window !== 'undefined' && window.fbq) {
      window.fbq('track', 'AddToCart', {
        content_ids: [product.id],
        content_name: product.title,
        content_type: 'product',
        value: product.price,
        currency: 'INR',
        num_items: quantity
      });
    }

    // Trigger cart badge bounce micro-animation
    setAnimateCart(true);
    setTimeout(() => setAnimateCart(false), 1000);

    triggerToast(`${quantity}x ${product.title} added to bag`, {
      productName: product.title,
      size: selectedSize,
      image: activeImg || product.image || "",
    });

    if (redirect) {
      setTimeout(() => {
        router.push("/shoppingbag");
      }, 500);
    }
  };

  // Sizing stock calculation
  const selectedSizeStock = product.sizeStock
    ? (product.sizeStock[selectedSize as keyof typeof product.sizeStock] || 0)
    : 0;

  const totalStock = product.sizeStock
    ? Object.values(product.sizeStock).reduce((sum, s) => sum + (s || 0), 0)
    : 0;

  const isProductOutOfStock = totalStock <= 0;

  return (
    <>
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-6 right-6 z-[1000] bg-white border border-[#775a19]/25 p-5 w-80 shadow-2xl animate-fade-in flex flex-col gap-4">
          {toastItem ? (
            <>
              <div className="flex gap-4">
                {toastItem.image && (
                  <div className="w-12 h-16 bg-[#faf9f8] border border-outline-variant/15 p-0.5 flex-shrink-0 relative">
                    <ProductImage src={toastItem.image} className="object-cover" alt="Product Thumbnail" fill sizes="48px" />
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
                    Size: {toastItem.size} | Qty: {quantity} | Color: {selectedColor}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowToast(false)}
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
                <p className="text-[10px] uppercase font-black tracking-wider mt-1 leading-relaxed">
                  {toastText}
                </p>
              </div>
              <button 
                onClick={() => setShowToast(false)} 
                aria-label="Close notification"
                className="material-symbols-outlined text-gray-400 hover:text-black text-sm bg-transparent border-none cursor-pointer"
              >
                close
              </button>
            </div>
          )}
        </div>
      )}
      
      {/* Main Content */}
      <main className="pt-20 md:pt-32 pb-24 px-6 md:px-12 max-w-[1440px] mx-auto animate-fade-in">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500 mb-8" id="productBreadcrumb">
          <Link href="/" className="hover:text-black transition-colors">Home</Link>
          <span>→</span>
          <Link href="/shopallshirts" className="hover:text-black transition-colors">Shop All</Link>
          <span>→</span>
          <span className="text-black font-extrabold">{product.title}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20">
          
          {/* Left Side: Product Gallery */}
          <div className="lg:col-span-7">
            {/* Gallery Layout */}
            <div className="grid grid-cols-12 gap-4">
              
              {/* Vertical Thumbnails (Desktop Only) */}
              <div className="hidden md:flex flex-col gap-4 col-span-2">
                {(product.images && product.images.length > 0 ? product.images : [product.image]).map((src, idx) => (
                  <button
                    key={idx}
                    onClick={() => swapImage(src)}
                    className={`aspect-[3/4] bg-surface-container-low border overflow-hidden cursor-pointer transition-all duration-300 hover:scale-[1.03] ${
                      activeImg === src ? "border-secondary thumb-active" : "border-outline-variant/10 opacity-70 hover:opacity-100"
                    }`}
                  >
                    <div className="w-full h-full relative">
                      <ProductImage
                        className="object-cover"
                        src={src}
                        alt={`${product.title} view ${idx + 1}`}
                        fill
                        sizes="100px"
                      />
                    </div>
                  </button>
                ))}
              </div>

              {/* Main Image Display (Swipeable on mobile) */}
              <div className="col-span-12 md:col-span-10">
                <div 
                  onMouseEnter={() => setIsZoomed(true)}
                  onMouseLeave={() => setIsZoomed(false)}
                  onTouchStart={handleTouchStart}
                  onTouchEnd={handleTouchEnd}
                  style={{ overflow: "hidden", cursor: "zoom-in" }}
                  className="aspect-[4/5] bg-surface-container-low border border-outline-variant/10 gallery-zoom-container relative overflow-hidden select-none"
                >
                  {activeImg && (
                    <ProductImage
                      className={`object-cover transition-all duration-300 ${
                        imgAnimating ? "opacity-0 scale-[0.98]" : "opacity-100"
                      }`}
                      style={{
                        transform: isZoomed ? "scale(1.5)" : "scale(1)",
                        transition: "transform 0.3s ease"
                      }}
                      src={activeImg}
                      alt={product.title}
                      fill
                      priority
                      sizes="(max-width: 768px) 100vw, 800px"
                    />
                  )}

                  {/* Swipe Gallery Pagination Dots (Mobile Only) */}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 md:hidden z-10">
                    {(product.images && product.images.length > 0 ? product.images : [product.image]).map((_, idx) => {
                      const images = product.images && product.images.length > 0 ? product.images : [product.image];
                      const activeIndex = images.indexOf(activeImg);
                      return (
                        <span
                          key={idx}
                          className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                            activeIndex === idx ? "bg-white scale-125" : "bg-white/40"
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Thumbnail Strip (Mobile Only) */}
            <div className="flex md:hidden overflow-x-auto scrollbar-none gap-3 py-4 w-full snap-x justify-start mt-2 border-b border-outline-variant/5">
              {(product.images && product.images.length > 0 ? product.images : [product.image]).map((src, idx) => (
                <button
                  key={idx}
                  onClick={() => swapImage(src)}
                  className={`aspect-[3/4] w-14 shrink-0 bg-surface-container-low border overflow-hidden cursor-pointer snap-start transition-all duration-300 ${
                    activeImg === src ? "border-secondary" : "border-outline-variant/10 opacity-70"
                  }`}
                >
                  <div className="w-full h-full relative">
                    <ProductImage
                      className="object-cover"
                      src={src}
                      alt={`${product.title} thumb ${idx + 1}`}
                      fill
                      sizes="60px"
                    />
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Right Side: Product Information */}
          <div className="lg:col-span-5 flex flex-col space-y-8 sticky top-32 h-fit">
            <header className="space-y-4">
              <div className="flex items-center space-x-2 text-[10px] uppercase tracking-[0.2em] text-outline font-black">
                <span>Premium Series</span>
                <span className="text-secondary">•</span>
                <span>{product.category || "Signature Series"}</span>
              </div>
              
              <h1 className="text-4xl sm:text-5xl font-black font-headline tracking-tighter text-on-surface leading-[1.05] uppercase">
                {product.title}
              </h1>

              {/* Ratings Overview */}
              {product.ratings && (
                <div className="flex items-center gap-2 pt-1">
                  <div className="flex items-center text-secondary">
                    {Array.from({ length: 5 }).map((_, starIdx) => (
                      <span key={starIdx} className="material-symbols-outlined text-sm">
                        {starIdx < Math.floor(product.ratings || 5) ? "star" : "star_half"}
                      </span>
                    ))}
                  </div>
                  <span className="text-[10px] font-black tracking-widest text-outline">
                    {product.ratings.toFixed(1)} / 5.0 ({product.reviews?.length || 0} reviews)
                  </span>
                </div>
              )}

              {/* Pricing & Badges */}
              <div className="flex items-center gap-6 pt-2">
                <span className="text-3xl font-extrabold text-secondary tracking-tight">
                  ₹{product.price.toLocaleString("en-IN")}
                </span>
                
                {(() => {
                  const effectiveComparePrice = product.compareAtPrice || product.comparePrice;
                  if (effectiveComparePrice && effectiveComparePrice > product.price) {
                    return (
                      <>
                        <span className="text-lg line-through text-gray-400 font-bold">
                          ₹{effectiveComparePrice.toLocaleString("en-IN")}
                        </span>
                        <span className="text-xs font-black text-green-700 uppercase tracking-widest bg-green-50 px-2 py-1 border border-green-200/40">
                          {Math.round((1 - product.price / effectiveComparePrice) * 100)}% OFF
                        </span>
                      </>
                    );
                  }
                  return null;
                })()}
                
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

            {/* Color Swatches */}
            {product.colors && product.colors.length > 0 && (
              <div className="space-y-3">
                <label className="text-[10px] uppercase tracking-[0.2em] font-black text-on-surface-variant">
                  Select Color: <span className="text-secondary font-black">{selectedColor}</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {product.colors.map((color) => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={`px-4 py-2.5 text-[9px] font-black uppercase tracking-widest transition-all duration-300 border ${
                        selectedColor === color
                          ? "border-secondary bg-[#775a19]/10 text-secondary"
                          : "border-outline-variant/60 hover:border-on-surface text-on-surface"
                      }`}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Size Selection */}
            <div className="space-y-4">
              <div className="flex justify-between items-end border-b border-outline-variant/10 pb-2">
                <label className="text-[10px] uppercase tracking-[0.2em] font-black text-on-surface-variant">
                  Select Size: <span className="text-secondary font-black">{selectedSize}</span>
                </label>
                <button
                  onClick={() => setShowSizeGuide(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#BA7517',
                    fontSize: '10px',
                    fontWeight: '900',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  Size Guide
                </button>
              </div>
              
              <div className="flex flex-wrap">
                {["S", "M", "L", "XL", "XXL"].map((size) => {
                  const sizeStock = product.sizeStock
                    ? (product.sizeStock[size as keyof typeof product.sizeStock] || 0)
                    : 0;
                  const isOutOfStock = sizeStock <= 0;
                  return (
                    <div key={size} className="mr-2 mb-2">
                      <button
                        disabled={isOutOfStock}
                        onClick={() => setSelectedSize(size)}
                        aria-label={`Size ${size}${
                          sizeStock === 0 ? ', sold out' : 
                          sizeStock <= 3 ? `, only ${sizeStock} left` : 
                          ', in stock'
                        }`}
                        aria-pressed={selectedSize === size}
                        style={{
                          minWidth: '44px',
                          minHeight: '44px',
                        }}
                        className={`py-2 px-4 text-sm font-black uppercase tracking-widest btn-active-scale transition-all duration-300 relative ${
                          isOutOfStock
                            ? "border border-outline-variant/40 text-outline size-out-of-stock cursor-not-allowed opacity-35"
                            : selectedSize === size
                            ? "border-2 border-secondary bg-transparent text-secondary"
                            : "border border-outline-variant/60 hover:border-on-surface bg-transparent text-on-surface"
                        }`}
                      >
                        {size}
                        {/* Red indicator for out of stock sizes */}
                        {isOutOfStock && (
                          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-red-500"></span>
                        )}
                        {/* Subtly show quick warning dot on sizes if low stock */}
                        {!isOutOfStock && sizeStock > 0 && sizeStock <= LOW_STOCK_SIZE_THRESHOLD && (
                          <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-500"></span>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Sizing Low/No Stock Warning Alert */}
              {selectedSize && selectedSizeStock === 0 && (
                <p className="text-[10px] text-red-600 font-bold uppercase tracking-wider mt-2">
                  ✗ This size is out of stock. Please select another size.
                </p>
              )}

              {selectedSizeStock > 0 && selectedSizeStock <= URGENT_STOCK_THRESHOLD && (
                <div className="p-3 bg-red-950/20 border border-red-900/30 text-red-500 flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm animate-pulse">warning</span>
                  <p className="text-[10px] font-black uppercase tracking-widest leading-none">
                    Only {selectedSizeStock} left in size {selectedSize}! Order soon.
                  </p>
                </div>
              )}
            </div>

            {/* Quantity Selector */}
            {!isProductOutOfStock && (
              <div className="space-y-3">
                <label className="text-[10px] uppercase tracking-[0.2em] font-black text-on-surface-variant">
                  Quantity
                </label>
                <div className="flex items-center border border-outline-variant/60 w-32 justify-between">
                  <button
                    onClick={() => setQuantity(prev => Math.max(1, prev - 1))}
                    className="px-4 py-2 hover:bg-surface-container-low transition-colors font-bold text-lg cursor-pointer"
                  >
                    -
                  </button>
                  <span className="font-headline font-black text-sm">{quantity}</span>
                  <button
                    onClick={() => {
                      if (quantity < selectedSizeStock) {
                        setQuantity(prev => prev + 1);
                      } else {
                        triggerToast(`Maximum stock limit of size ${selectedSize} reached.`);
                      }
                    }}
                    className="px-4 py-2 hover:bg-surface-container-low transition-colors font-bold text-lg cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
            )}

            {/* Main Action Buttons */}
            <div className="flex flex-col space-y-4">
              {isProductOutOfStock ? (
                <div className="flex gap-3">
                  <button
                    disabled
                    className="flex-1 py-5 bg-outline-variant/25 text-outline cursor-not-allowed font-black uppercase tracking-[0.2em] text-xs"
                  >
                    Sold Out
                  </button>
                  <button
                    onClick={() => {
                      if (isInWishlist) {
                        wishlistStore.removeFromWishlist(product.id);
                        triggerToast("Removed from wishlist");
                      } else {
                        wishlistStore.addToWishlist(product);
                        triggerToast("Added to wishlist");
                      }
                    }}
                    aria-label="Wishlist toggle"
                    className={`px-5 py-5 border transition-all duration-300 cursor-pointer flex items-center justify-center ${
                      isInWishlist
                        ? "border-red-600 bg-red-600/10 text-red-600"
                        : "border-outline-variant/40 text-on-surface hover:border-on-surface hover:bg-on-surface/5"
                    }`}
                  >
                    <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: isInWishlist ? "'FILL' 1" : "'FILL' 0" }}>
                      {isInWishlist ? "favorite" : "favorite_border"}
                    </span>
                  </button>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => addToCart(true)}
                    className="w-full py-5 bg-gradient-to-r from-secondary to-secondary/80 text-white font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-secondary/15 hover:shadow-secondary/25 hover:scale-[1.02] transition-all duration-300 btn-active-scale cursor-pointer"
                  >
                    Buy Now
                  </button>
                  <div className="flex gap-3">
                    <button
                      onClick={() => addToCart(false)}
                      className="flex-1 py-5 border border-on-surface text-on-surface font-black uppercase tracking-[0.2em] text-xs hover:bg-on-surface hover:text-surface transition-all duration-300 btn-active-scale cursor-pointer"
                    >
                      Add to Cart
                    </button>
                    <button
                      onClick={() => {
                        if (isInWishlist) {
                          wishlistStore.removeFromWishlist(product.id);
                          triggerToast("Removed from wishlist");
                        } else {
                          wishlistStore.addToWishlist(product);
                          triggerToast("Added to wishlist");
                        }
                      }}
                      aria-label="Wishlist toggle"
                      className={`px-5 py-5 border transition-all duration-300 cursor-pointer flex items-center justify-center ${
                        isInWishlist
                          ? "border-red-600 bg-red-600/10 text-red-600"
                          : "border-on-surface text-on-surface hover:bg-on-surface/5"
                      }`}
                    >
                      <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: isInWishlist ? "'FILL' 1" : "'FILL' 0" }}>
                        {isInWishlist ? "favorite" : "favorite_border"}
                      </span>
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Trust Badges */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-6 border-t border-b border-outline-variant/30 text-outline">
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
                  className="flex justify-between items-center w-full text-left uppercase text-[10px] font-black tracking-widest text-on-surface cursor-pointer"
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
                  className="flex justify-between items-center w-full text-left uppercase text-[10px] font-black tracking-widest text-on-surface cursor-pointer"
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 text-xs">
                    <div>
                      <h4 className="text-[9px] uppercase tracking-widest font-black text-outline">Material</h4>
                      <p className="font-bold text-on-surface mt-0.5">{product.specFabric || product.details?.fabric || "100% Premium Cotton"}</p>
                    </div>
                    <div>
                      <h4 className="text-[9px] uppercase tracking-widest font-black text-outline">Fit</h4>
                      <p className="font-bold text-on-surface mt-0.5">{product.specFit || product.details?.fit || "Modern Tailored Fit"}</p>
                    </div>
                    <div>
                      <h4 className="text-[9px] uppercase tracking-widest font-black text-outline">Sleeve</h4>
                      <p className="font-bold text-on-surface mt-0.5">{product.specSleeve || product.details?.sleeve || "Full Sleeve"}</p>
                    </div>
                    <div>
                      <h4 className="text-[9px] uppercase tracking-widest font-black text-outline">Collar</h4>
                      <p className="font-bold text-on-surface mt-0.5">{product.specCollar || product.details?.collar || "Artisan Collar"}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-b border-outline-variant/20 pb-3">
                <button
                  onClick={() => toggleAccordion("care")}
                  className="flex justify-between items-center w-full text-left uppercase text-[10px] font-black tracking-widest text-on-surface cursor-pointer"
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
                    {product.specCare || product.details?.care || "Hand wash in cold water with mild detergent or dry clean to maintain the structure. Do not bleach. Line dry in shade. Warm iron if necessary."}
                  </p>
                </div>
              </div>
            </div>

            <a
              className="flex items-center justify-center space-x-3 py-4 bg-surface-container-low border border-outline-variant/20 hover:bg-surface-container transition-all duration-300"
              href={`https://wa.me/${process.env.NEXT_PUBLIC_SUPPORT_PHONE || "919363693004"}`}
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

        {/* Dynamic Reviews Section */}
        {product.reviews && product.reviews.length > 0 && (
          <section className="mt-24 pt-16 border-t border-outline-variant/10">
            <div className="max-w-2xl mx-auto space-y-12">
              <div className="text-center">
                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-secondary">Client Reviews</span>
                <h2 className="text-3xl font-black font-headline tracking-tighter uppercase mt-2">Verified Testimonials</h2>
                <div className="w-12 h-[1px] bg-secondary mx-auto mt-4"></div>
              </div>
              <div className="space-y-8">
                {product.reviews.map((review, rIdx) => (
                  <div key={rIdx} className="bg-surface-container-lowest p-6 border border-outline-variant/10 space-y-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-wider text-on-surface">{review.author}</h4>
                        <p className="text-[8px] font-bold text-outline uppercase tracking-widest mt-0.5">{review.date}</p>
                      </div>
                      <div className="flex text-secondary">
                        {Array.from({ length: 5 }).map((_, reviewStarIdx) => (
                          <span key={reviewStarIdx} className="material-symbols-outlined text-xs">
                            {reviewStarIdx < review.rating ? "star" : "star_outline"}
                          </span>
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-on-surface-variant leading-relaxed uppercase tracking-wide">
                      "{review.comment}"
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

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
              <h3 className="text-xs font-black uppercase tracking-widest mb-3">Premium Weaves</h3>
              <p className="text-xs text-outline leading-relaxed uppercase tracking-wider">
                Crafted from selected long-staple fibers for a softer, more breathable texture and high resistance to wear.
              </p>
            </div>
            <div className="bg-surface-container-lowest border border-outline-variant/10 p-8 hover:border-secondary/20 hover:shadow-lg transition-all duration-500">
              <span className="material-symbols-outlined text-secondary text-3xl mb-4">settings_brightness</span>
              <h3 className="text-xs font-black uppercase tracking-widest mb-3">Mother of Pearl</h3>
              <p className="text-xs text-outline leading-relaxed uppercase tracking-wider">
                Equipped with hand-carved, genuine white Mother of Pearl buttons that catch the light with subtle, luxury luster.
              </p>
            </div>
            <div className="bg-surface-container-lowest border border-outline-variant/10 p-8 hover:border-secondary/20 hover:shadow-lg transition-all duration-500">
              <span className="material-symbols-outlined text-secondary text-3xl mb-4">architecture</span>
              <h3 className="text-xs font-black uppercase tracking-widest mb-3">Double-Needle Seams</h3>
              <p className="text-xs text-outline leading-relaxed uppercase tracking-wider">
                Executed by master tailors with double-needle stitching (16 stitches per inch) for clean profiles and lifetime seam durability.
              </p>
            </div>
          </div>
        </section>



        {/* RECENTLY VIEWED */}
        {recentItems.length > 1 && (
          <section className="mt-24 pt-16 border-t border-outline-variant/10">
            <div className="flex justify-between items-end mb-12">
              <div>
                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-secondary">Your History</span>
                <h2 className="text-3xl font-black font-headline tracking-tighter uppercase mt-2">Recently Viewed</h2>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => useRecentStore.getState().clearRecent()}
                  className="text-[9px] font-black uppercase tracking-widest text-outline hover:text-black transition-colors border-none bg-transparent cursor-pointer"
                >
                  Clear History
                </button>
              </div>
            </div>
            <div className="flex overflow-x-auto gap-6 pb-4 scrollbar-thin scrollbar-thumb-neutral-200">
              {recentItems
                .filter((item: Product) => item.id !== product.id)
                .slice(0, 8)
                .map((rec: Product) => {
                  const primaryImg = rec.image || "/assets/logo.png";
                  const secondaryImg = rec.images && rec.images.length > 1 ? rec.images[1] : primaryImg;
                  const totalRecStock = rec.sizeStock ? Object.values(rec.sizeStock).reduce((sum, val) => sum + (val || 0), 0) : 0;
                  const isRecOutOfStock = totalRecStock <= 0;

                  return (
                    <div key={rec.id} className="min-w-[200px] md:min-w-[240px] flex-shrink-0 group border border-outline-variant/10 p-2 bg-surface-container-lowest hover:shadow-xl hover:border-secondary/20 transition-all duration-500 flex flex-col justify-between relative">
                      <Link href={`/product/${rec.slug}`} className="block relative aspect-[3/4] overflow-hidden bg-surface-container border border-outline-variant/10">
                        {isRecOutOfStock && (
                          <span className="absolute top-2 left-2 z-20 bg-black/85 text-white text-[8px] font-black uppercase tracking-widest px-2 py-0.5 border border-white/20">
                            SOLD OUT
                          </span>
                        )}
                        <div className="absolute inset-0">
                          <ProductImage
                            className="object-cover transition-all duration-[1000ms] group-hover:scale-105"
                            src={primaryImg}
                            alt={rec.title}
                            fill
                            sizes="(max-w-400px) 50vw, 300px"
                          />
                        </div>
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-[1200ms] scale-[1.05] group-hover:scale-100">
                          <ProductImage
                            className="object-cover"
                            src={secondaryImg}
                            alt={`${rec.title} Detail`}
                            fill
                            sizes="(max-w-400px) 50vw, 300px"
                          />
                        </div>
                      </Link>
                      <div className="pt-4 px-2 pb-2">
                        <div className="flex justify-between items-start gap-3">
                          <div className="space-y-1">
                            <Link href={`/product/${rec.slug}`} className="text-[10px] font-black uppercase tracking-[0.15em] text-on-surface group-hover:text-secondary transition-colors leading-tight cursor-pointer block">
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
        )}
      </main>

      {/* Sticky Buy Bar for Mobile */}
      {!isProductOutOfStock && (
        <div className="fixed bottom-0 left-0 w-full bg-surface-container-lowest/90 backdrop-blur-xl border-t border-outline-variant/10 px-6 py-4 flex items-center justify-between z-45 md:hidden">
          <div className="flex flex-col text-left">
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
      )}

      {showSizeGuide && (
        <div
          onClick={() => setShowSizeGuide(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#ffffff',
              borderRadius: '8px',
              padding: '2rem',
              maxWidth: '520px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)'
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.5rem'
            }}>
              <div>
                <h2 style={{
                  fontSize: '18px',
                  fontWeight: '600',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  margin: 0,
                  color: '#1a1a1a'
                }}>
                  SIZE GUIDE
                </h2>
                <p style={{
                  fontSize: '12px',
                  color: '#6b7280',
                  marginTop: '4px'
                }}>
                  All measurements in inches
                </p>
              </div>
              <button
                onClick={() => setShowSizeGuide(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#6b7280',
                  lineHeight: 1
                }}
              >
                ×
              </button>
            </div>

             {/* Size Chart Table */}
            <div className="overflow-x-auto w-full -mx-4 px-4 sm:mx-0 sm:px-0">
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '12px'
              }}>
                <thead>
                  <tr style={{
                    background: '#1a1a1a',
                    color: '#ffffff'
                  }}>
                    <th style={{
                      padding: '8px 4px',
                      textAlign: 'center',
                      fontWeight: '500',
                      letterSpacing: '0.05em',
                      fontSize: '10px',
                      textTransform: 'uppercase'
                    }}>
                      Size
                    </th>
                    <th style={{
                      padding: '8px 4px',
                      textAlign: 'center',
                      fontWeight: '500',
                      letterSpacing: '0.05em',
                      fontSize: '10px',
                      textTransform: 'uppercase'
                    }}>
                      Chest (in)
                    </th>
                    <th style={{
                      padding: '8px 4px',
                      textAlign: 'center',
                      fontWeight: '500',
                      letterSpacing: '0.05em',
                      fontSize: '10px',
                      textTransform: 'uppercase'
                    }}>
                      Waist (in)
                    </th>
                    <th style={{
                      padding: '8px 4px',
                      textAlign: 'center',
                      fontWeight: '500',
                      letterSpacing: '0.05em',
                      fontSize: '10px',
                      textTransform: 'uppercase'
                    }}>
                      Length (in)
                    </th>
                    <th style={{
                      padding: '8px 4px',
                      textAlign: 'center',
                      fontWeight: '500',
                      letterSpacing: '0.05em',
                      fontSize: '10px',
                      textTransform: 'uppercase'
                    }}>
                      Chest (cm)
                    </th>
                    <th style={{
                      padding: '8px 4px',
                      textAlign: 'center',
                      fontWeight: '500',
                      letterSpacing: '0.05em',
                      fontSize: '10px',
                      textTransform: 'uppercase'
                    }}>
                      Waist (cm)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { size: 'S', chestIn: '36-38', waistIn: '30-32', lengthIn: '28', chestCm: '91-96', waistCm: '76-81' },
                    { size: 'M', chestIn: '38-40', waistIn: '32-34', lengthIn: '29', chestCm: '96-101', waistCm: '81-86' },
                    { size: 'L', chestIn: '40-42', waistIn: '34-36', lengthIn: '30', chestCm: '101-106', waistCm: '86-91' },
                    { size: 'XL', chestIn: '42-44', waistIn: '36-38', lengthIn: '31', chestCm: '106-111', waistCm: '91-96' },
                    { size: 'XXL', chestIn: '44-46', waistIn: '38-40', lengthIn: '32', chestCm: '111-116', waistCm: '96-101' },
                  ].map((row, i) => (
                    <tr
                      key={row.size}
                      style={{
                        background: i % 2 === 0 
                          ? '#ffffff' : '#f9f9f9',
                        borderBottom: '1px solid #e5e5e5'
                      }}
                    >
                      <td style={{
                        padding: '10px 4px',
                        textAlign: 'center',
                        fontWeight: '600',
                        color: '#1a1a1a'
                      }}>
                        {row.size}
                      </td>
                      <td style={{
                        padding: '10px 4px',
                        textAlign: 'center',
                        color: '#374151'
                      }}>
                        {row.chestIn}
                      </td>
                      <td style={{
                        padding: '10px 4px',
                        textAlign: 'center',
                        color: '#374151'
                      }}>
                        {row.waistIn}
                      </td>
                      <td style={{
                        padding: '10px 4px',
                        textAlign: 'center',
                        color: '#374151'
                      }}>
                        {row.lengthIn}
                      </td>
                      <td style={{
                        padding: '10px 4px',
                        textAlign: 'center',
                        color: '#374151'
                      }}>
                        {row.chestCm}
                      </td>
                      <td style={{
                        padding: '10px 4px',
                        textAlign: 'center',
                        color: '#374151'
                      }}>
                        {row.waistCm}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Tip text */}
            <p style={{
              fontSize: '11px',
              color: '#775a19',
              fontWeight: 'bold',
              marginTop: '1.25rem',
              textAlign: 'center',
              lineHeight: '1.4'
            }}>
              Tip: If you're between sizes, size up for a relaxed fit or size down for a tailored look.
            </p>

            {/* How to measure tip */}
            <div style={{
              marginTop: '1.5rem',
              padding: '12px 16px',
              background: '#faf5e8',
              border: '0.5px solid #e8d08a',
              borderRadius: '6px'
            }}>
              <p style={{
                fontSize: '12px',
                color: '#7a5c00',
                fontWeight: '500',
                marginBottom: '6px',
                marginTop: 0
              }}>
                HOW TO MEASURE
              </p>
              <ul style={{
                fontSize: '12px',
                color: '#92400e',
                paddingLeft: '16px',
                margin: 0,
                lineHeight: 1.8
              }}>
                <li>
                  <strong>Chest:</strong> Measure around the fullest part of your chest, under your arms
                </li>
                <li>
                  <strong>Length:</strong> Measure from the highest point of the shoulder to the hem
                </li>
                <li>
                  <strong>Shoulder:</strong> Measure from one shoulder seam to the other
                </li>
              </ul>
            </div>

            {/* Note */}
            <p style={{
              fontSize: '11px',
              color: '#9ca3af',
              textAlign: 'center',
              marginTop: '1rem',
              marginBottom: '1rem',
              lineHeight: 1.5
            }}>
              * S size measurements are estimated. If you are between sizes, we recommend sizing up for a comfortable fit.
            </p>

            {/* Close button */}
            <button
              onClick={() => setShowSizeGuide(false)}
              style={{
                width: '100%',
                marginTop: '1rem',
                padding: '10px',
                background: '#1a1a1a',
                color: '#ffffff',
                border: 'none',
                borderRadius: '4px',
                fontSize: '13px',
                fontWeight: '500',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                cursor: 'pointer'
              }}
            >
              CLOSE
            </button>
          </div>
        </div>
      )}
    </>
  );
}
