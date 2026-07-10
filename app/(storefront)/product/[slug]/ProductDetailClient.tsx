"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import ProductImage from "@/components/ProductImage";
import { useRouter } from "next/navigation";
import { Product } from "@/lib/types";
import { useCartStore } from "@/stores/cartStore";
import { useRecentStore } from "@/stores/recentStore";
import { trackViewProduct, trackAddToCart } from "@/lib/analytics";

interface ProductDetailClientProps {
  product: Product;
  recommendations: Product[];
  orderCount: number;
}

export default function ProductDetailClient({ product, recommendations, orderCount }: ProductDetailClientProps) {
  const router = useRouter();
  const addToCartStore = useCartStore((state) => state.addToCart);
  const addProductToRecent = useRecentStore((state) => state.addProductToRecent);

  const [animateCart, setAnimateCart] = useState(false);

  // Toast State
  const [toastText, setToastText] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [toastItem, setToastItem] = useState<{ productName: string; size: string; image: string } | null>(null);
  const [showSizeGuide, setShowSizeGuide] = useState(false);

  // Interactive Product States
  const [activeImg, setActiveImg] = useState("");
  const [imgAnimating, setImgAnimating] = useState(false);
  const [selectedSize, setSelectedSize] = useState("M");
  const [selectedColor, setSelectedColor] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [isZoomed, setIsZoomed] = useState(false);

  // Delivery Estimate State
  const [pincode, setPincode] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');

  const handleCheckDelivery = () => {
    if (pincode.length !== 6) return;
    
    // Calculate delivery date (3-5 business days from today)
    const today = new Date();
    const delivery = new Date(today);
    delivery.setDate(today.getDate() + 4);
    
    const formatted = delivery.toLocaleDateString(
      'en-IN', {
        weekday: 'long',
        day: 'numeric', 
        month: 'long'
      }
    );
    setDeliveryDate(formatted);
  };

  // Ships today live countdown timer
  const [shipsTodayText, setShipsTodayText] = useState('Ships today');

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const cutoff = new Date();
      cutoff.setHours(17, 0, 0, 0);
      const diff = cutoff.getTime() - now.getTime();
      
      if (diff > 0) {
        const totalMinutes = Math.floor(diff / (1000 * 60));
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        
        let timeStr = '';
        if (hours > 0) {
          timeStr += `${hours}h `;
        }
        timeStr += `${minutes}m`;
        setShipsTodayText(`Ships today if ordered in the next ${timeStr}`);
      } else {
        setShipsTodayText('Ships tomorrow');
      }
    };
    
    updateCountdown();
    const interval = setInterval(updateCountdown, 60000); // update every minute
    return () => clearInterval(interval);
  }, []);

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
  const getSizeStock = (size: string) => {
    return product.sizeStock
      ? (product.sizeStock[size as keyof typeof product.sizeStock] || 0)
      : 0;
  };

  const selectedSizeStock = getSizeStock(selectedSize);

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

              {/* Main Image Display */}
              <div className="col-span-12 md:col-span-10">
                <div 
                  onMouseEnter={() => setIsZoomed(true)}
                  onMouseLeave={() => setIsZoomed(false)}
                  style={{ overflow: "hidden", cursor: "zoom-in" }}
                  className="aspect-[4/5] bg-surface-container-low border border-outline-variant/10 gallery-zoom-container relative overflow-hidden"
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
                      sizes="(max-w-780px) 100vw, 800px"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Side: Product Information */}
          <div className="lg:col-span-5 flex flex-col space-y-8 sticky top-32 h-fit">
            <p style={{
              fontSize: '11px',
              color: '#BA7517',
              fontWeight: '500',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginBottom: '6px'
            }}>
              {product.category || 'PREMIUM SERIES'}
            </p>

            <h1 style={{
              fontSize: '28px',
              fontWeight: '700',
              color: '#1a1a1a',
              lineHeight: 1.2,
              fontFamily: 'Georgia, serif',
              marginBottom: '12px'
            }}>
              {product.title}
            </h1>

            {(product.isNewArrival || product.isNew) && (
              <span style={{
                display: 'inline-block',
                border: '1px solid #1a1a1a',
                padding: '3px 10px',
                fontSize: '10px',
                fontWeight: '600',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginBottom: '12px'
              }}>
                NEW ARRIVAL
              </span>
            )}

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '12px'
            }}>
              <div style={{ color: '#BA7517', fontSize: '14px' }}>
                ★★★★★
              </div>
              <span style={{ fontSize: '13px', color: '#6b7280' }}>
                4.8 (126 reviews)
              </span>
              <span style={{ color: '#e5e5e5' }}>·</span>
              {orderCount > 0 && (
                <span style={{ fontSize: '13px', color: '#6b7280' }}>
                  {orderCount}+ customers purchased
                </span>
              )}
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: '10px'
              }}>
                <span style={{
                  fontSize: '32px',
                  fontWeight: '700',
                  color: '#1a1a1a'
                }}>
                  ₹{product.price}
                </span>
                {product.compareAtPrice && 
                 product.compareAtPrice > product.price && (
                  <>
                    <span style={{
                      fontSize: '16px',
                      color: '#9ca3af',
                      textDecoration: 'line-through'
                    }}>
                      ₹{product.compareAtPrice}
                    </span>
                    <span style={{
                      fontSize: '13px',
                      color: '#16a34a',
                      fontWeight: '600'
                    }}>
                      {Math.round(
                        (1 - product.price / 
                         product.compareAtPrice) * 100
                      )}% OFF
                    </span>
                  </>
                )}
              </div>
              <p style={{
                fontSize: '11px',
                color: '#9ca3af',
                marginTop: '2px'
              }}>
                Inclusive of GST
              </p>
            </div>

            <hr style={{ 
              border: 'none',
              borderTop: '1px solid #e5e5e5',
              margin: '16px 0'
            }} />

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '8px',
              marginBottom: '16px'
            }}>
              {[
                { 
                  icon: (
                    <svg width="20" height="20" 
                      viewBox="0 0 24 24" 
                      fill="none" stroke="#BA7517" 
                      strokeWidth="1.5">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  ),
                  title: 'Free Shipping',
                  sub: 'On all orders'
                },
                {
                  icon: (
                    <svg width="20" height="20"
                      viewBox="0 0 24 24"
                      fill="none" stroke="#BA7517"
                      strokeWidth="1.5">
                      <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                  ),
                  title: '7 Day Returns',
                  sub: 'No questions asked'
                },
                {
                  icon: (
                    <svg width="20" height="20"
                      viewBox="0 0 24 24"
                      fill="none" stroke="#BA7517"
                      strokeWidth="1.5">
                      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                  ),
                  title: 'Premium Quality',
                  sub: '100% Guaranteed'
                }
              ].map(badge => (
                <div key={badge.title} style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  gap: '4px'
                }}>
                  {badge.icon}
                  <span style={{
                    fontSize: '11px',
                    fontWeight: '600',
                    color: '#1a1a1a',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    {badge.title}
                  </span>
                  <span style={{
                    fontSize: '10px',
                    color: '#9ca3af'
                  }}>
                    {badge.sub}
                  </span>
                </div>
              ))}
            </div>

            <hr style={{ 
              border: 'none',
              borderTop: '1px solid #e5e5e5',
              margin: '16px 0'
            }} />

            {product.colors && product.colors.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <p style={{
                  fontSize: '12px',
                  fontWeight: '600',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  marginBottom: '8px',
                  color: '#1a1a1a'
                }}>
                  COLOR:{' '}
                  <span style={{ fontWeight: '400', 
                    color: '#6b7280' }}>
                    {selectedColor && 
                     selectedColor !== 'Default' 
                      ? selectedColor.toUpperCase() 
                      : ''}
                  </span>
                </p>
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

            <div style={{ marginBottom: '16px' }}>
              <p style={{
                fontSize: '12px',
                fontWeight: '600',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                marginBottom: '8px',
                color: '#1a1a1a',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                SIZE:
                <button
                  onClick={() => setShowSizeGuide(true)}
                  style={{
                    fontSize: '11px',
                    color: '#BA7517',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: '400',
                    textDecoration: 'underline'
                  }}
                >
                  Size guide
                </button>
              </p>
              
              <div className="grid grid-cols-5 gap-2">
                {["S", "M", "L", "XL", "XXL"].map((size) => {
                  const sizeStock = product.sizeStock
                    ? (product.sizeStock[size as keyof typeof product.sizeStock] || 0)
                    : 0;
                  const isOutOfStock = sizeStock <= 0;
                  return (
                    <button
                      key={size}
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
                      className={`py-4 text-xs font-black uppercase tracking-widest btn-active-scale transition-all duration-300 relative ${
                        isOutOfStock
                          ? "border border-outline-variant/40 text-outline size-out-of-stock cursor-not-allowed opacity-35"
                          : selectedSize === size
                          ? "border-2 border-secondary bg-transparent text-secondary"
                          : "border border-outline-variant/60 hover:border-on-surface bg-transparent text-on-surface"
                      }`}
                    >
                      {size}
                      {isOutOfStock && (
                        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-red-500"></span>
                      )}
                      {!isOutOfStock && sizeStock > 0 && sizeStock < 5 && (
                        <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-500"></span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Sizing Low/No Stock Warning Alert */}
              {selectedSize && selectedSizeStock === 0 && (
                <p className="text-[10px] text-red-600 font-bold uppercase tracking-wider mt-2">
                  ✗ This size is out of stock. Please select another size.
                </p>
              )}
            </div>

            {selectedSize && (() => {
              const stock = getSizeStock(selectedSize)
              return (
                <>
                  {stock > 0 && stock <= 5 && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      marginBottom: '8px'
                    }}>
                      <div style={{
                        width: '8px', height: '8px',
                        borderRadius: '50%',
                        background: '#f59e0b',
                        flexShrink: 0
                      }} />
                      <span style={{
                        fontSize: '13px',
                        color: '#f59e0b',
                        fontWeight: '500'
                      }}>
                        Only {stock} left in stock
                      </span>
                    </div>
                  )}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginBottom: '16px'
                  }}>
                    <svg width="14" height="14"
                      viewBox="0 0 24 24" fill="none"
                      stroke="#6b7280" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/>
                      <path d="M12 6v6l4 2"/>
                    </svg>
                    <span style={{
                      fontSize: '12px',
                      color: '#6b7280'
                    }}>
                      {shipsTodayText}
                    </span>
                  </div>
                </>
              )
            })()}

            {/* Quantity Selector */}
            {!isProductOutOfStock && (
              <div style={{ marginBottom: '16px' }}>
                <p style={{
                  fontSize: '12px',
                  fontWeight: '600',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  marginBottom: '8px',
                  color: '#1a1a1a'
                }}>QUANTITY</p>
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

            {isProductOutOfStock ? (
              <button
                disabled
                style={{
                  width: '100%',
                  padding: '16px',
                  background: '#e5e7eb',
                  color: '#9ca3af',
                  border: 'none',
                  fontSize: '14px',
                  fontWeight: '600',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  cursor: 'not-allowed',
                  marginBottom: '16px'
                }}
              >
                SOLD OUT
              </button>
            ) : (
              <>
                <button
                  onClick={() => addToCart(true)}
                  style={{
                    width: '100%',
                    padding: '16px',
                    background: '#BA7517',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '14px',
                    fontWeight: '600',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    marginBottom: '8px'
                  }}
                >
                  BUY NOW
                </button>
                <button
                  onClick={() => addToCart(false)}
                  style={{
                    width: '100%',
                    padding: '16px',
                    background: 'transparent',
                    color: '#1a1a1a',
                    border: '1.5px solid #1a1a1a',
                    fontSize: '14px',
                    fontWeight: '600',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    marginBottom: '16px'
                  }}
                >
                  ADD TO CART
                </button>
              </>
            )}

            <div className="conversion-trust-badges" style={{
              display: 'grid',
              gap: '4px',
              paddingTop: '16px',
              borderTop: '1px solid #e5e5e5',
              marginBottom: '16px'
            }}>
              {[
                { 
                  icon: '🔐',
                  title: 'Secure Payment',
                  sub: '100% Protected'
                },
                {
                  icon: '🚚',
                  title: 'COD Available', 
                  sub: 'Pay on Delivery'
                },
                {
                  icon: '🔄',
                  title: 'Easy Exchange',
                  sub: 'Hassle Free'
                },
                {
                  icon: '📦',
                  title: 'Premium Packaging',
                  sub: 'Perfectly Packed'
                }
              ].map(b => (
                <div key={b.title} style={{
                  textAlign: 'center',
                  padding: '8px 4px'
                }}>
                  <div style={{ fontSize: '18px' }}>
                    {b.icon}
                  </div>
                  <div style={{
                    fontSize: '9px',
                    fontWeight: '600',
                    color: '#374151',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    lineHeight: 1.3,
                    marginTop: '4px'
                  }}>
                    {b.title}
                  </div>
                  <div style={{
                    fontSize: '9px',
                    color: '#9ca3af',
                    lineHeight: 1.3
                  }}>
                    {b.sub}
                  </div>
                </div>
              ))}
            </div>

            <div style={{
              border: '1px solid #e5e5e5',
              borderRadius: '4px',
              padding: '16px',
              marginBottom: '16px'
            }}>
              <p style={{
                fontSize: '11px',
                fontWeight: '600',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                marginBottom: '10px',
                color: '#1a1a1a'
              }}>
                DELIVERY ESTIMATE
              </p>
              <div style={{
                display: 'flex',
                gap: '8px',
                marginBottom: '8px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  flex: 1,
                  border: '1px solid #e5e5e5',
                  padding: '8px 12px',
                  borderRadius: '4px'
                }}>
                  <svg width="14" height="14"
                    viewBox="0 0 24 24" fill="none"
                    stroke="#9ca3af" strokeWidth="2">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                    <circle cx="12" cy="9" r="2.5"/>
                  </svg>
                  <input
                    type="text"
                    placeholder="Enter pincode"
                    maxLength={6}
                    value={pincode}
                    onChange={e => setPincode(
                      e.target.value.replace(/\D/g, '')
                    )}
                    style={{
                      border: 'none',
                      outline: 'none',
                      fontSize: '13px',
                      color: '#1a1a1a',
                      width: '100%',
                      background: 'transparent'
                    }}
                  />
                </div>
                <button
                  onClick={handleCheckDelivery}
                  style={{
                    padding: '8px 16px',
                    background: 'transparent',
                    border: '1px solid #BA7517',
                    color: '#BA7517',
                    fontSize: '12px',
                    fontWeight: '600',
                    letterSpacing: '0.05em',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  CHECK
                </button>
              </div>
              
              {deliveryDate && (
                <div>
                  <p style={{
                    fontSize: '12px',
                    color: '#6b7280',
                    marginBottom: '4px'
                  }}>
                    Order now and get it by
                  </p>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <span style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#BA7517'
                    }}>
                      {deliveryDate}
                    </span>
                    <span style={{
                      fontSize: '11px',
                      background: '#dcfce7',
                      color: '#166534',
                      padding: '2px 8px',
                      borderRadius: '20px',
                      fontWeight: '500'
                    }}>
                      On Time Delivery
                    </span>
                  </div>
                </div>
              )}
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
                  <div className="grid grid-cols-2 gap-y-4 text-xs">
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

            {/* WhatsApp Contact */}
            <a
              className="flex items-center justify-center space-x-3 py-4 bg-surface-container-low border border-outline-variant/20 hover:bg-surface-container transition-all duration-300"
              href="https://wa.me/919363693004"
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

        <div className="conversion-stats-bar" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          borderTop: '1px solid #e5e5e5',
          borderBottom: '1px solid #e5e5e5',
          padding: '24px 0',
          margin: '32px 0'
        }}>
          {[
            { icon: '😊', number: '1250+', label: 'Happy Customers' },
            { icon: '⭐', number: '4.8/5', label: 'Average Rating' },
            { icon: '↩️', number: '7 Days', label: 'Easy Returns' },
            { icon: '✓', number: '100%', label: '100% Genuine' },
          ].map((stat, i) => (
            <div key={stat.label} style={{
              textAlign: 'center',
              borderRight: i < 3 ? '1px solid #e5e5e5' : 'none',
              padding: '0 16px'
            }}>
              <div style={{ 
                fontSize: '20px',
                marginBottom: '4px'
              }}>
                {stat.icon}
              </div>
              <div style={{
                fontSize: '20px',
                fontWeight: '700',
                color: '#1a1a1a'
              }}>
                {stat.number}
              </div>
              <div style={{
                fontSize: '11px',
                color: '#6b7280',
                marginTop: '2px',
                textTransform: 'uppercase',
                letterSpacing: '0.06em'
              }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* RECOMMENDATIONS */}
        {recommendations.length > 0 && (
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
                  <div key={rec.id} className="group border border-outline-variant/10 p-2 bg-surface-container-lowest hover:shadow-xl hover:border-secondary/20 transition-all duration-500 flex flex-col justify-between">
                    <Link href={`/product/${rec.slug}`} className="block relative aspect-[3/4] overflow-hidden bg-surface-container border border-outline-variant/10">
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
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '14px'
            }}>
              <thead>
                <tr style={{
                  background: '#1a1a1a',
                  color: '#ffffff'
                }}>
                  <th style={{
                    padding: '10px 16px',
                    textAlign: 'center',
                    fontWeight: '500',
                    letterSpacing: '0.05em',
                    fontSize: '12px',
                    textTransform: 'uppercase'
                  }}>
                    Size
                  </th>
                  <th style={{
                    padding: '10px 16px',
                    textAlign: 'center',
                    fontWeight: '500',
                    letterSpacing: '0.05em',
                    fontSize: '12px',
                    textTransform: 'uppercase'
                  }}>
                    Chest
                  </th>
                  <th style={{
                    padding: '10px 16px',
                    textAlign: 'center',
                    fontWeight: '500',
                    letterSpacing: '0.05em',
                    fontSize: '12px',
                    textTransform: 'uppercase'
                  }}>
                    Length
                  </th>
                  <th style={{
                    padding: '10px 16px',
                    textAlign: 'center',
                    fontWeight: '500',
                    letterSpacing: '0.05em',
                    fontSize: '12px',
                    textTransform: 'uppercase'
                  }}>
                    Shoulder
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  { size: 'S (Est)', chest: 38, length: 28,   shoulder: 17   },
                  { size: 'M',       chest: 42, length: 29.5, shoulder: 18.5 },
                  { size: 'L',       chest: 46, length: 30,   shoulder: 19   },
                  { size: 'XL',      chest: 47, length: 31,   shoulder: 20   },
                  { size: 'XXL',     chest: 51, length: 32,   shoulder: 21   },
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
                      padding: '12px 16px',
                      textAlign: 'center',
                      fontWeight: '600',
                      color: '#1a1a1a'
                    }}>
                      {row.size}
                    </td>
                    <td style={{
                      padding: '12px 16px',
                      textAlign: 'center',
                      color: '#374151'
                    }}>
                      {row.chest}
                    </td>
                    <td style={{
                      padding: '12px 16px',
                      textAlign: 'center',
                      color: '#374151'
                    }}>
                      {row.length}
                    </td>
                    <td style={{
                      padding: '12px 16px',
                      textAlign: 'center',
                      color: '#374151'
                    }}>
                      {row.shoulder}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

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
