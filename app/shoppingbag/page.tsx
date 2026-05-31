"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface CartItem {
  productName: string;
  price: number;
  size: string;
  image: string;
  color?: string;
}

interface GroupedCartItem {
  productName: string;
  price: number;
  size: string;
  image: string;
  quantity: number;
  color?: string;
}

export default function ShoppingBag() {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [groupedItems, setGroupedItems] = useState<GroupedCartItem[]>([]);

  // Calculate Subtotal, GST, and Total
  const subtotal = cartItems.reduce((sum, item) => sum + item.price, 0);
  const gst = subtotal * 0.12;
  const total = subtotal + gst;

  // Load cart items on mount
  useEffect(() => {
    loadCart();
  }, []);

  // Update grouped items whenever cart items change
  useEffect(() => {
    groupItems(cartItems);
  }, [cartItems]);

  const loadCart = () => {
    try {
      const items = JSON.parse(localStorage.getItem("cart_items") || "[]");
      setCartItems(items);
    } catch (e) {
      console.error("Failed to parse cart items:", e);
    }
  };

  const groupItems = (items: CartItem[]) => {
    const groups: { [key: string]: GroupedCartItem } = {};
    items.forEach((item) => {
      const key = `${item.productName}_${item.size || "M"}_${item.color || "Atelier Choice"}`;
      if (!groups[key]) {
        groups[key] = {
          productName: item.productName,
          price: item.price,
          size: item.size || "M",
          image: item.image,
          quantity: 0,
          color: item.color || "Atelier Choice",
        };
      }
      groups[key].quantity += 1;
    });
    setGroupedItems(Object.values(groups));
  };

  const saveCart = (newItems: CartItem[]) => {
    localStorage.setItem("cart_items", JSON.stringify(newItems));
    localStorage.setItem("cartCount", newItems.length.toString());
    setCartItems(newItems);

    // Dispatch storage event to trigger count update in layout/header
    window.dispatchEvent(new Event("storage"));
  };

  const handleIncrement = (item: GroupedCartItem) => {
    const newItems = [...cartItems, {
      productName: item.productName,
      price: item.price,
      size: item.size,
      image: item.image,
      color: item.color || "Atelier Choice",
    }];
    saveCart(newItems);
  };

  const handleDecrement = (item: GroupedCartItem) => {
    const idx = cartItems.findIndex(
      (x) => x.productName === item.productName && 
             (x.size || "M") === item.size && 
             (x.color || "Atelier Choice") === (item.color || "Atelier Choice")
    );
    if (idx !== -1) {
      const newItems = [...cartItems];
      newItems.splice(idx, 1);
      saveCart(newItems);
    }
  };

  const handleRemove = (item: GroupedCartItem) => {
    const newItems = cartItems.filter(
      (x) => !(x.productName === item.productName && 
               (x.size || "M") === item.size && 
               (x.color || "Atelier Choice") === (item.color || "Atelier Choice"))
    );
    saveCart(newItems);
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
            <Link href="/shoppingbag" className="material-symbols-outlined text-primary font-bold">
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

      {/* Main Bag Content */}
      <main className="max-w-7xl mx-auto px-6 lg:px-12 py-12 lg:py-20">
        <div className="flex flex-col lg:flex-row gap-16">
          {/* Left Column: Items List */}
          <div className="flex-grow space-y-12">
            <div className="border-b border-on-surface/5 pb-6">
              <h2 className="font-headline text-5xl font-black tracking-tight mb-2">Shopping Bag</h2>
              <p className="text-outline font-medium uppercase tracking-widest text-xs">
                {cartItems.length} ITEM{cartItems.length !== 1 ? "S" : ""} SELECTED
              </p>
            </div>

            <div className="space-y-10">
              {cartItems.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-outline-variant/30 space-y-6">
                  <span className="material-symbols-outlined text-6xl text-outline/40">shopping_bag</span>
                  <h3 className="font-headline text-2xl font-bold uppercase tracking-tight">Your Bag is Empty</h3>
                  <p className="text-xs text-outline uppercase tracking-widest max-w-sm mx-auto leading-relaxed">
                    Explore our limited-run collections and South Indian woven heritage series.
                  </p>
                  <Link
                    href="/shopallshirts"
                    className="inline-block bg-on-surface text-surface px-10 py-4 text-xs font-black uppercase tracking-[0.2em] hover:bg-secondary transition-colors btn-active-scale mt-4"
                  >
                    Shop Collection
                  </Link>
                </div>
              ) : (
                groupedItems.map((item) => {
                  const itemPrice = item.price || 0;
                  const formattedPrice = `₹${(itemPrice * item.quantity).toLocaleString("en-IN")}`;
                  const imageSrc = item.image || "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf";

                  return (
                    <div
                      key={`${item.productName}_${item.size}_${item.color || "Atelier Choice"}`}
                      className="flex flex-col md:flex-row gap-8 relative group border-b border-on-surface/5 pb-10"
                    >
                      <div className="w-full md:w-48 aspect-[3/4] bg-surface-container overflow-hidden border border-outline-variant/10">
                        <img alt={item.productName} className="w-full h-full object-cover" src={imageSrc} />
                      </div>
                      <div className="flex-grow flex flex-col justify-between py-2">
                        <div>
                          <div className="flex justify-between items-start mb-2">
                            <h3 className="font-headline text-xl font-bold">{item.productName}</h3>
                            <p className="font-headline font-bold text-lg">{formattedPrice}</p>
                          </div>
                          <div className="space-y-1 text-sm text-outline font-medium uppercase tracking-wider mb-4">
                            <p>Size: {item.size}</p>
                            <p>Color: {item.color || "Atelier Choice"}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-6">
                          <div className="flex items-center border border-outline-variant">
                            <button
                              onClick={() => handleDecrement(item)}
                              className="px-3 py-2 hover:bg-surface-container-low transition-colors btn-active-scale"
                            >
                              <span className="material-symbols-outlined">remove</span>
                            </button>
                            <span className="px-4 font-headline font-bold">{item.quantity}</span>
                            <button
                              onClick={() => handleIncrement(item)}
                              className="px-3 py-2 hover:bg-surface-container-low transition-colors btn-active-scale"
                            >
                              <span className="material-symbols-outlined">add</span>
                            </button>
                          </div>
                          <button
                            onClick={() => handleRemove(item)}
                            className="text-xs font-bold uppercase tracking-widest border-b border-on-surface/20 pb-0.5 hover:border-on-surface transition-colors btn-active-scale"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Trust Signals */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-12 border-t border-on-surface/5">
              <div className="flex items-center gap-4">
                <span className="material-symbols-outlined text-secondary">verified</span>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em]">Handcrafted in India</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="material-symbols-outlined text-secondary">published_with_changes</span>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em]">Easy 7-Day Returns</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="material-symbols-outlined text-secondary">local_shipping</span>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em]">Complimentary Shipping</p>
              </div>
            </div>
          </div>

          {/* Right Column: Order Summary */}
          {cartItems.length > 0 && (
            <div className="w-full lg:w-[400px]">
              <div className="bg-surface-container-lowest p-8 lg:sticky lg:top-32 border border-outline-variant/10 shadow-sm">
                <h3 className="font-headline text-2xl font-black tracking-tight mb-8">Order Summary</h3>
                <div className="space-y-4 mb-8">
                  <div className="flex justify-between text-sm font-medium">
                    <span className="text-outline uppercase tracking-wider">Subtotal</span>
                    <span>₹{subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-sm font-medium">
                    <span className="text-outline uppercase tracking-wider">Shipping</span>
                    <span className="text-secondary font-bold uppercase tracking-widest">Free</span>
                  </div>
                  <div className="flex justify-between text-sm font-medium">
                    <span className="text-outline uppercase tracking-wider">Estimated Tax / GST</span>
                    <span>₹{gst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                <div className="border-t border-on-surface/10 pt-6 mb-8">
                  <div className="flex justify-between items-end">
                    <span className="font-headline font-bold text-lg uppercase tracking-widest">Total</span>
                    <span className="font-headline font-black text-3xl">
                      ₹{total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => router.push("/checkout")}
                  className="w-full bg-on-surface text-surface py-5 font-headline font-bold text-sm uppercase tracking-[0.3em] hover:bg-on-surface/90 transition-all flex items-center justify-center gap-3 btn-active-scale"
                >
                  Proceed to Checkout
                  <span className="material-symbols-outlined">arrow_forward</span>
                </button>

                <div className="mt-8 space-y-4">
                  <div className="p-4 bg-secondary-container/10 flex items-start gap-3">
                    <span className="material-symbols-outlined text-secondary">info</span>
                    <p className="text-xs leading-relaxed font-medium">
                      Members get <span className="text-secondary font-bold">FREE SHIPPING</span> and exclusive access to the
                      Heritage Collection. <a className="underline" href="#">Join Now</a>.
                    </p>
                  </div>
                  <div className="flex justify-center gap-4 opacity-40 grayscale">
                    <img
                      alt="Visa"
                      className="h-4"
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuDvWjR0FxPlD1Bbr8IIGvOem2_CS0oAoiGJkcdUXUFzFJCcyCeCOoPUVL7_8nl7gnSvlCWHzkSMSIvvPz8jzgcYLTWovOCL3smbP52wVGRFIGHFwiWrSL4wBUud8Vy2QBRLEnDaAsqu2Yj_9bR3uJZFXEZ3IywkCdS-IADrHPUmXxuyvR3lNpLq82fvrUBdLeIm-bwB9tqLR2scB8oEUNYL5H9ypBTjDXwpNDoVTyDm_uru-Y5vy_6DeVnFboBxjzp1VLcGcvMfprA"
                    />
                    <img
                      alt="Mastercard"
                      className="h-4"
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuAGXq4UBQBpQT0nMdqNkTaV_7dLj6zRsVrJJZaRjzCrdOQ-WmJjrv7q9O6n-rDea8R11-CyFA2v9_3zYnSf-iW0tvvfnoEhJm3Sst2jjlFFSHx0w9wHJa6Q9TnWGvwx4jmDA3RkmiqYpgl7OCjlP1IXFbPWPZTnvrd4bg8H5KIIUlLIzkxMZMgti9xIa-x3WG3YpXD-oH5Hn9SlWnh0AdDTHlzNEclh_yweIy_khg-sCu5s0Afm73FAo533o_4zsYb55CHMbcguhz8"
                    />
                    <img
                      alt="PayPal"
                      className="h-4"
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuCPGHpGdJ1hE36tsfZ3daofkcNJb-27h_RECwh_WjVU9xMyK668uJuktG4wJEwynAnnOAbl560BmZDiB2NmNDneNedC63-yDciK7y9zAp4vjV6IYX-QwiqdajfQ1F9M22Rr9iRE3-_jHIBzIZ5A-TjeJajQ1e2k1PMdDFStplFhtqSCSz__Ghd2pmahBFWBcuKZOuYS58oCMM9xozGNFMTuI__LoG0nQN92WZdvX7t85pGYDl336TIeejJ7ZIFVsjIf5jUV8OVXQ6Y"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Curated Recommendations */}
        <section className="mt-32 pt-20 border-t border-outline-variant/30">
          <div className="flex justify-between items-end mb-12">
            <div>
              <span className="text-secondary font-bold text-xs uppercase tracking-[0.3em] mb-4 block">Curated for You</span>
              <h2 className="font-headline text-4xl font-black tracking-tight">You May Also Like</h2>
            </div>
            <Link className="text-xs font-bold uppercase tracking-widest border-b border-on-surface pb-1" href="/shopallshirts">
              View Collection
            </Link>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
            <div className="group cursor-pointer">
              <div className="aspect-[3/4] bg-surface-container overflow-hidden mb-6 border border-outline-variant/10">
                <img
                  className="w-full h-full object-cover group-hover:scale-105 transition"
                  src="https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf"
                  alt="Khaki trousers"
                />
              </div>
              <div className="space-y-1">
                <h4 className="font-headline font-bold text-sm uppercase tracking-widest">Premium Trousers (Khaki)</h4>
                <p className="text-secondary font-bold font-headline">₹5,200</p>
              </div>
            </div>

            <div className="group cursor-pointer">
              <div className="aspect-[3/4] bg-surface-container overflow-hidden mb-6 border border-outline-variant/10">
                <img
                  alt="Clay Overshirt"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuBeiDw3huheb21HblGgonS4l78232XPejmqsgttbASBTtIrDIrTBPK_jt1FTJCpNstQfWi3FZKI9nXjJxlK_lLDlaU13BH2sRTklsW5VHbxGne_J2b0ruxPIsb4vUVMoEJkA2ABSiqOU96dBRsoHvm6tQJLT3pM4rn7V9XNuTNl_SAhk8jJY7lEhwFcRhUJbKY-QCfZ_AeZfOzEf8oaB19-7BP3ZUwJBxq6UO0yQ2peXxYIjlQwp3wUTcLLh_HIk4qQ89wlmk7vbAk"
                />
              </div>
              <div className="space-y-1">
                <h4 className="font-headline font-bold text-sm uppercase tracking-widest">Clay Overshirt</h4>
                <p className="text-secondary font-bold font-headline">₹3,900</p>
              </div>
            </div>

            <div className="group cursor-pointer">
              <div className="aspect-[3/4] bg-surface-container overflow-hidden mb-6 border border-outline-variant/10">
                <img
                  className="w-full h-full object-cover group-hover:scale-105 transition"
                  src="https://images.unsplash.com/photo-1603252109303-2751441dd157"
                  alt="Premium slides"
                />
              </div>
              <div className="space-y-1">
                <h4 className="font-headline font-bold text-sm uppercase tracking-widest">Premium Slide</h4>
                <p className="text-secondary font-bold font-headline">₹4,800</p>
              </div>
            </div>

            <div className="group cursor-pointer">
              <div className="aspect-[3/4] bg-surface-container overflow-hidden mb-6 border border-outline-variant/10">
                <img
                  className="w-full h-full object-cover group-hover:scale-105 transition"
                  src="https://images.unsplash.com/photo-1596755094514-f87e34085b2c"
                  alt="Signature tee"
                />
              </div>
              <div className="space-y-1">
                <h4 className="font-headline font-bold text-sm uppercase tracking-widest">Signature White Tee</h4>
                <p className="text-secondary font-bold font-headline">₹1,500</p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
