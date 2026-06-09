"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { db } from "@/lib/db";
import {
  processWalletPointsCheckoutAction,
  verifyAndPrepareGatewayCheckoutAction,
} from "@/app/actions/checkout";
import { useCartStore } from "@/stores/cartStore";
import { useCheckoutStore } from "@/stores/checkoutStore";
import { useAuthStore } from "@/stores/authStore";
import { AddressList } from "@/components/checkout/AddressList";
import { UserAddress } from "@/lib/registry";

interface CartItem {
  productName: string;
  price: number;
  size: string;
  image: string;
}

export default function CheckoutPage() {
  const router = useRouter();
  const [isHydrated, setIsHydrated] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Zustand Store Connection
  const {
    currentStep,
    selectedAddress,
    couponCode,
    couponMessage,
    appliedDiscount,
    appliedCouponCode,
    loyaltyChecked,
    walletChecked,
    idempotencyKey,
    setStep: setCurrentStep,
    setSelectedAddress,
    setCouponCode,
    setCouponMessage,
    setAppliedDiscount,
    setAppliedCouponCode,
    setLoyaltyChecked,
    setWalletChecked,
    setIdempotencyKey,
  } = useCheckoutStore();

  const user = useAuthStore((state) => state.user);
  const userId = user?.email || "guest";

  // Cart & Calculation States
  const cartItems = useCartStore((state) => state.cartItems);
  const [cart, setCart] = useState<CartItem[]>([]);

  const [availablePoints, setAvailablePoints] = useState(0);
  const [availableWallet, setAvailableWallet] = useState(0);

  // Toast Notifications
  const [toastText, setToastText] = useState("");
  const [showToast, setShowToast] = useState(false);

  const triggerToast = (msg: string) => {
    setToastText(msg);
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 3000);
  };

  // Load Initial Data
  useEffect(() => {
    setIsHydrated(true);

    // Fetch Cart from Zustand
    let savedCart: CartItem[] = [...cartItems];

    if (savedCart.length === 0) {
      // Default to mock item if cart is empty
      savedCart = [
        {
          productName: "Signature Linen Shirt",
          price: 14500,
          size: "XL",
          image: "https://lh3.googleusercontent.com/aida-public/AB6AXuA5SFi3n0_AFFxHNg48C_fmzDxMDB7eA3s2kAeA71DAaBm_ATzhe2R_GfrrGwBIzNX3HKK4zEZgSEKQs5Jvxrk6bhNpgfmLBVvjOdG8fDRwO9JeDcL3gTu_iZVQeh4Cp4bleSO3fyprCS-iR5dGwVCtL3L-GXML1kNAv12-CiEUcxHyqNVGLWcWfVDiYn16_qqZYjq9Mjmkm13lf9HnjyMGgyG_lw2ftpstJS9uD-remW6L54WASBxhwTAIs26DeWfrrDO5P_Da5-4",
        },
      ];
    }
    setCart(savedCart);

    // Fetch Available Perks
    const fetchPerks = async () => {
      const points = await db.getLoyaltyPoints();
      const wallet = await db.getWalletBalance();
      setAvailablePoints(points);
      setAvailableWallet(wallet);
    };
    fetchPerks();
  }, [cartItems]);

  // Set idempotency key if empty
  useEffect(() => {
    if (isHydrated && !idempotencyKey) {
      setIdempotencyKey("ORD-" + Math.floor(Math.random() * 900000 + 100000));
    }
  }, [isHydrated, idempotencyKey]);

  // Recalculate Totals
  const baseTotal = cart.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
  const discountedTotal = baseTotal - appliedDiscount;

  // Loyalty calculations (max 50% cart value)
  let loyaltyDiscount = 0;
  let pointsRedeemed = 0;
  if (loyaltyChecked) {
    const maxLoyaltyDiscount = Math.floor(discountedTotal / 2);
    const availableLoyaltyDiscount = Math.floor(availablePoints / 10);
    loyaltyDiscount = Math.min(maxLoyaltyDiscount, availableLoyaltyDiscount);
    pointsRedeemed = loyaltyDiscount * 10;
  }

  const netTotal = discountedTotal - loyaltyDiscount;

  // Wallet calculation
  let walletDeduction = 0;
  if (walletChecked) {
    walletDeduction = Math.min(netTotal, availableWallet);
  }

  const finalPayable = netTotal - walletDeduction;
  const subtotal = netTotal / 1.12;
  const gst = netTotal - subtotal;

  // Coupon Code Validation
  const handleApplyCoupon = async () => {
    const code = couponCode.trim();
    if (!code) {
      setAppliedDiscount(0);
      setAppliedCouponCode("");
      setCouponMessage({ text: "", isError: false });
      return;
    }

    const res = await db.validateCoupon(code, baseTotal);

    if (res.valid && res.coupon) {
      const coupon = res.coupon;
      let disc = 0;
      if (coupon.type === "percent") {
        disc = (baseTotal * coupon.discount) / 100;
      } else {
        disc = coupon.discount;
      }
      setAppliedDiscount(disc);
      setAppliedCouponCode(coupon.code);
      setCouponMessage({
        text: `CODE ${coupon.code} APPLIED SUCCESSFULLY`,
        isError: false,
      });
      triggerToast(`Coupon ${coupon.code} applied!`);
    } else {
      setCouponMessage({
        text: (res.error || "INVALID OR EXPIRED COUPON CODE").toUpperCase(),
        isError: true,
      });
      setAppliedDiscount(0);
      setAppliedCouponCode("");
    }
  };

  // Step Switcher validation
  const handleGoToStep = (step: number) => {
    if (step === 2) {
      // Validate Shipping Details (Step 1)
      if (!selectedAddress) {
        triggerToast("Please select a delivery address");
        return;
      }
    }
    setCurrentStep(step);
  };

  // Handle Main Submit Button
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (currentStep === 1) {
      handleGoToStep(2);
    } else if (currentStep === 2) {
      handleGoToStep(3);
    } else if (currentStep === 3) {
      const customerName = selectedAddress?.name || "Guest";

      // Verify stock before any checkout actions
      const stockCheck = await db.verifyStock(cart);
      if (!stockCheck.success) {
        triggerToast(stockCheck.message || "Insufficient inventory stock.");
        return;
      }

      if (finalPayable === 0) {
        // Paid fully via Wallet and/or Loyalty Points
        const res = await processWalletPointsCheckoutAction({
          cart,
          couponCode: appliedCouponCode,
          walletDeduction,
          pointsRedeemed,
          loyaltyDiscount,
          baseTotal,
          netTotal,
          customerName,
          idempotencyKey,
          addressId: selectedAddress?.id,
          userId,
        });

        if (!res.success) {
          triggerToast(res.error || "Failed to place order.");
          return;
        }

        // Sync local storage to match server's computed balances
        if (res.walletBalance !== undefined) {
          localStorage.setItem("wallet_balance", res.walletBalance.toString());
        }
        if (res.loyaltyPoints !== undefined) {
          localStorage.setItem("loyalty_points", res.loyaltyPoints.toString());
        }

        // Sync order history locally if in offline mode
        try {
          const localOrders = JSON.parse(localStorage.getItem("orders_history") || "[]");
          localOrders.unshift(res.order);
          localStorage.setItem("orders_history", JSON.stringify(localOrders));
        } catch (e) {
          console.error(e);
        }

        // Clear cart
        useCartStore.getState().clearCart();

        triggerToast("Order placed successfully!");
        setTimeout(() => {
          router.push("/orderconfirmed");
        }, 1000);
      } else {
        // Forward to payment gateway with server-verified signature
        const res = await verifyAndPrepareGatewayCheckoutAction({
          cart,
          couponCode: appliedCouponCode,
          walletDeduction,
          pointsRedeemed,
          loyaltyDiscount,
          baseTotal,
          netTotal,
          customerName,
          idempotencyKey,
          addressId: selectedAddress?.id,
          userId,
        });

        if (!res.success || !res.checkoutState) {
          triggerToast(res.error || "Failed to prepare checkout session.");
          return;
        }

        sessionStorage.setItem("checkoutState", JSON.stringify(res.checkoutState));
        router.push("/paymentgateway");
      }
    }
  };

  // Step Button Wording
  const getButtonText = () => {
    if (currentStep === 1) return "Proceed to Perks & Wallet";
    if (currentStep === 2) return "Proceed to Final Review";
    return finalPayable === 0 ? "Pay via Wallet & Points" : "Confirm & Complete Payment";
  };

  // Luxury Brand Shimmer Skeleton Loading
  if (!isHydrated) {
    return (
      <div className="bg-surface text-on-surface min-h-screen flex flex-col justify-between">
        <header className="sticky top-0 z-50 bg-surface/80 backdrop-blur-xl border-b border-outline-variant/10 px-6 lg:px-20 py-5">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div className="h-8 w-24 bg-white/10 rounded animate-pulse"></div>
            <div className="h-6 w-48 bg-white/10 rounded animate-pulse hidden md:block"></div>
            <div className="h-6 w-24 bg-white/10 rounded animate-pulse"></div>
          </div>
        </header>
        <main className="pt-24 pb-24 px-4 sm:px-6 md:px-8 max-w-screen-xl mx-auto flex-grow w-full">
          <div className="max-w-2xl mx-auto mb-10">
            <div className="h-12 w-full bg-white/10 rounded-full animate-pulse"></div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
            <div className="lg:col-span-7 space-y-8">
              <div className="h-8 w-48 bg-white/10 rounded animate-pulse"></div>
              <div className="h-32 w-full bg-white/10 rounded-2xl animate-pulse"></div>
              <div className="h-32 w-full bg-white/10 rounded-2xl animate-pulse"></div>
            </div>
            <div className="lg:col-span-5">
              <div className="h-[400px] w-full bg-white/10 rounded-3xl animate-pulse"></div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="bg-surface text-on-surface min-h-screen flex flex-col">
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-6 right-6 z-[100] bg-on-surface text-surface py-4 px-6 text-[10px] font-bold uppercase tracking-[0.2em] shadow-2xl border border-outline/25">
          {toastText}
        </div>
      )}

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

      {/* Top Header */}
      <header className="sticky top-0 z-50 bg-surface/80 backdrop-blur-xl border-b border-outline-variant/10 px-6 lg:px-20 py-2.5">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-12">
            <Link href="/" className="flex items-center group">
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
              <Link className="text-[10px] font-black uppercase tracking-widest text-outline hover:text-primary transition-colors" href="/">Home</Link>
              <Link className="text-[10px] font-black uppercase tracking-widest text-outline hover:text-primary transition-colors" href="/genz">GEN-Z</Link>
              <Link className="text-[10px] font-black uppercase tracking-widest text-outline hover:text-primary transition-colors" href="/shopallshirts">Shop All</Link>
              <Link className="text-[10px] font-black uppercase tracking-widest text-outline hover:text-primary transition-colors" href="/orderhistory">Order History</Link>
              <Link className="text-[10px] font-black uppercase tracking-widest text-outline hover:text-primary transition-colors" href="/ordertracking">Track Order</Link>
            </nav>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/shoppingbag" className="material-symbols-outlined text-outline hover:text-primary transition-colors">shopping_bag</Link>
            <Link href="/myprofile" className="material-symbols-outlined text-outline hover:text-primary transition-colors">person</Link>
            <Link href="/admindashboard" className="material-symbols-outlined text-outline hover:text-primary transition-colors">admin_panel_settings</Link>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="material-symbols-outlined md:hidden">menu</button>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="flex flex-col mt-4 space-y-4 md:hidden">
            <Link className="block text-[10px] font-black uppercase tracking-widest" href="/">Home</Link>
            <Link className="block text-[10px] font-black uppercase tracking-widest" href="/genz">GEN-Z</Link>
            <Link className="block text-[10px] font-black uppercase tracking-widest" href="/shopallshirts">Shop All</Link>
            <Link className="block text-[10px] font-black uppercase tracking-widest" href="/orderhistory">Order History</Link>
            <Link className="block text-[10px] font-black uppercase tracking-widest" href="/ordertracking">Track Order</Link>
          </div>
        )}
      </header>

      {/* Main Checkout Station */}
      <main className="pt-[calc(4rem+env(safe-area-inset-top,0px))] md:pt-24 pb-32 lg:pb-24 px-4 sm:px-6 md:px-8 max-w-screen-xl mx-auto flex-grow w-full">
        {/* Progress Timeline Indicator */}
        <div className="max-w-2xl mx-auto mb-10 select-none">
          <div className="flex items-center justify-between bg-white/30 backdrop-blur-md border border-outline-variant/10 p-1.5 rounded-full text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-center shadow-sm">
            <div
              className={`flex-grow py-2.5 rounded-full transition-all duration-500 cursor-pointer ${
                currentStep === 1 
                  ? "bg-on-surface text-surface shadow-md scale-102 font-black" 
                  : "text-outline/60 hover:text-on-surface"
              }`}
              onClick={() => handleGoToStep(1)}
            >
              01. Details
            </div>
            <div
              className={`flex-grow py-2.5 rounded-full transition-all duration-500 cursor-pointer ${
                currentStep === 2 
                  ? "bg-on-surface text-surface shadow-md scale-102 font-black" 
                  : "text-outline/60 hover:text-on-surface"
              }`}
              onClick={() => handleGoToStep(2)}
            >
              02. Perks
            </div>
            <div
              className={`flex-grow py-2.5 rounded-full transition-all duration-500 ${
                currentStep === 3 
                  ? "bg-on-surface text-surface shadow-md scale-102 font-black" 
                  : "text-outline/40"
              }`}
            >
              03. Review
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          {/* Left Column: Form Wizards */}
          <div className="lg:col-span-7">
            {/* Step 1: Delivery Details */}
            {currentStep === 1 && (
              <div className="space-y-10">
                <div className="space-y-1.5 mb-6">
                  <span className="block text-[10px] font-black tracking-[0.25em] text-secondary uppercase italic">Step 01 of 03</span>
                  <h2 className="text-2xl sm:text-3xl font-headline font-black tracking-tight uppercase text-on-surface">Delivery Details</h2>
                </div>
                <AddressList 
                  userId={userId} 
                  onAddressSelected={(address) => setSelectedAddress(address)} 
                />
              </div>
            )}

            {/* Step 2: Perks & Wallet */}
            {currentStep === 2 && (
              <div className="space-y-12 animate-fade-in">
                <div className="space-y-1.5 mb-6">
                  <span className="block text-[10px] font-black tracking-[0.25em] text-secondary uppercase italic">Step 02 of 03</span>
                  <h2 className="text-2xl sm:text-3xl font-headline font-black tracking-tight uppercase text-on-surface">Perks & Store Credit</h2>
                </div>
                <div className="space-y-6">
                  {/* Coupon Validation */}
                  <div className="bg-white/40 border border-white/20 backdrop-blur-md p-6 sm:p-8 rounded-2xl shadow-sm relative overflow-hidden">
                    <h4 className="text-[10px] font-black tracking-widest uppercase mb-4 text-outline/80">Promotional Discount</h4>
                    <div className="flex gap-2">
                      <input
                        id="couponInput"
                        className="flex-grow px-4 py-3 bg-white/30 border border-outline-variant/20 focus:border-[#fed488]/60 focus:bg-white/50 text-[10px] font-black uppercase tracking-wider outline-none transition-all duration-300 rounded-lg text-on-surface placeholder-on-surface/40 shadow-sm"
                        placeholder="DISCOUNT CODE"
                        type="text"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value)}
                      />
                      <button
                        id="applyCouponBtn"
                        onClick={handleApplyCoupon}
                        className="bg-on-surface text-surface px-6 py-3 text-[10px] font-black tracking-[0.25em] uppercase hover:bg-secondary transition-all rounded-lg active:scale-95 shadow-sm cursor-pointer"
                      >
                        Apply
                      </button>
                    </div>
                    {couponMessage.text && (
                      <p
                        id="couponMessage"
                        className={`text-[9px] font-bold uppercase tracking-widest mt-2 ${
                          couponMessage.isError ? "text-red-600" : "text-green-600"
                        }`}
                      >
                        {couponMessage.text}
                      </p>
                    )}
                  </div>

                  {/* Wallet & Points Toggles */}
                  <div className="bg-white/40 border border-white/20 backdrop-blur-md p-6 sm:p-8 rounded-2xl shadow-sm relative space-y-6">
                    <h4 className="text-[10px] font-black tracking-widest uppercase text-outline/80">Redemption Portal</h4>
                    <div className="space-y-4 text-[10px] tracking-widest uppercase">
                      {/* Loyalty Toggle */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="relative flex items-center justify-center">
                            <input
                              type="checkbox"
                              id="loyaltyToggle"
                              checked={loyaltyChecked}
                              onChange={(e) => setLoyaltyChecked(e.target.checked)}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 peer"
                            />
                            <div className="w-4 h-4 border border-outline-variant/30 rounded transition-all duration-300 bg-white/50 backdrop-blur-sm peer-checked:bg-[#fed488] peer-checked:border-[#fed488] group-hover:border-[#fed488]/70 flex items-center justify-center">
                              <span className="material-symbols-outlined text-[10px] text-neutral-950 font-black opacity-0 peer-checked:opacity-100 transition-opacity duration-300 select-none">
                                check
                              </span>
                            </div>
                          </div>
                          <label htmlFor="loyaltyToggle" className="font-black cursor-pointer select-none text-[10px] tracking-wider text-on-surface/80">
                            REDEEM LOYALTY POINTS
                          </label>
                        </div>
                        <span id="loyaltyAvailableText" className="text-outline font-bold text-[9px] tracking-wider uppercase">
                          {availablePoints} PTS AVAILABLE
                        </span>
                      </div>
                      {loyaltyChecked && loyaltyDiscount > 0 && (
                        <div id="loyaltyAppliedMessage" className="text-[9px] font-bold text-green-600 uppercase tracking-widest pl-6">
                          REDEEMING {pointsRedeemed} POINTS (-₹{loyaltyDiscount.toLocaleString("en-IN", { minimumFractionDigits: 2 })})
                        </div>
                      )}

                      {/* Wallet Toggle */}
                      <div className="flex items-center justify-between border-t border-outline-variant/10 pt-4">
                        <div className="flex items-center gap-3">
                          <div className="relative flex items-center justify-center">
                            <input
                              type="checkbox"
                              id="walletToggle"
                              checked={walletChecked}
                              onChange={(e) => setWalletChecked(e.target.checked)}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 peer"
                            />
                            <div className="w-4 h-4 border border-outline-variant/30 rounded transition-all duration-300 bg-white/50 backdrop-blur-sm peer-checked:bg-[#fed488] peer-checked:border-[#fed488] group-hover:border-[#fed488]/70 flex items-center justify-center">
                              <span className="material-symbols-outlined text-[10px] text-neutral-950 font-black opacity-0 peer-checked:opacity-100 transition-opacity duration-300 select-none">
                                check
                              </span>
                            </div>
                          </div>
                          <label htmlFor="walletToggle" className="font-black cursor-pointer select-none text-[10px] tracking-wider text-on-surface/80">
                            PAY WITH STORE WALLET
                          </label>
                        </div>
                        <span id="walletAvailableText" className="text-outline font-bold text-[9px] tracking-wider uppercase">
                          ₹{availableWallet.toLocaleString("en-IN", { minimumFractionDigits: 2 })} AVAILABLE
                        </span>
                      </div>
                      {walletChecked && walletDeduction > 0 && (
                        <div id="walletAppliedMessage" className="text-[9px] font-bold text-green-600 uppercase tracking-widest pl-6">
                          APPLYING ₹{walletDeduction.toLocaleString("en-IN", { minimumFractionDigits: 2 })} FROM WALLET
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Navigation back */}
                  <div className="flex gap-4 pt-6">
                    <button
                      type="button"
                      onClick={() => handleGoToStep(1)}
                      className="flex-grow border border-outline-variant/20 text-on-surface py-3.5 text-[10px] font-black tracking-[0.2em] uppercase hover:bg-white/50 transition-all rounded-lg active:scale-95 shadow-sm flex items-center justify-center gap-2 bg-transparent cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">arrow_back</span> Back to Shipping
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Final Verification */}
            {currentStep === 3 && (
              <div className="space-y-12 animate-fade-in">
                <div className="space-y-1.5 mb-6">
                  <span className="block text-[10px] font-black tracking-[0.25em] text-secondary uppercase italic">Step 03 of 03</span>
                  <h2 className="text-2xl sm:text-3xl font-headline font-black tracking-tight uppercase text-on-surface">Final Verification</h2>
                </div>
                <div className="space-y-6">
                  {/* Destination Overview */}
                  <div className="bg-white/40 border border-white/20 backdrop-blur-md p-6 sm:p-8 rounded-2xl shadow-sm relative space-y-4">
                    <h4 className="text-[10px] font-black tracking-widest uppercase text-secondary">Delivery Destination</h4>
                    <div className="text-[10px] font-medium space-y-2 uppercase tracking-wide">
                      <p>
                        <span className="text-outline">Client Name:</span>{" "}
                        <span className="font-bold text-on-surface">{selectedAddress?.name}</span>
                      </p>
                      <p>
                        <span className="text-outline">Address:</span>{" "}
                        <span className="font-bold text-on-surface">{selectedAddress?.address_line_1}{selectedAddress?.address_line_2 ? `, ${selectedAddress.address_line_2}` : ""}, {selectedAddress?.city} - {selectedAddress?.postal_code}</span>
                      </p>
                      <p>
                        <span className="text-outline">Contact:</span>{" "}
                        <span className="font-bold text-on-surface">{selectedAddress?.phone}</span> | <span className="text-on-surface">{user?.email || "guest@stitch6k.com"}</span>
                      </p>
                    </div>
                  </div>

                  {/* Applied Perks Summary */}
                  {(appliedDiscount > 0 || loyaltyChecked || walletChecked) && (
                    <div className="bg-white/40 border border-white/20 backdrop-blur-md p-6 sm:p-8 rounded-2xl shadow-sm relative space-y-4">
                      <h4 className="text-[10px] font-black tracking-widest uppercase text-secondary">Applied Perks</h4>
                      <div className="text-[10px] font-bold space-y-2 uppercase tracking-wide text-green-700">
                        {appliedDiscount > 0 && <p>✓ Coupon Applied ({appliedCouponCode})</p>}
                        {loyaltyChecked && loyaltyDiscount > 0 && <p>✓ Loyalty Points Redeemed ({pointsRedeemed} pts)</p>}
                        {walletChecked && walletDeduction > 0 && <p>✓ Store Wallet Debit Applied</p>}
                      </div>
                    </div>
                  )}

                  {/* Navigation back */}
                  <div className="flex gap-4 pt-6">
                    <button
                      type="button"
                      onClick={() => handleGoToStep(2)}
                      className="flex-grow border border-outline-variant/20 text-on-surface py-3.5 text-[10px] font-black tracking-[0.2em] uppercase hover:bg-white/50 transition-all rounded-lg active:scale-95 shadow-sm flex items-center justify-center gap-2 bg-transparent cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">arrow_back</span> Back to Perks
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Order Summary (Sticky) */}
          <div className="lg:col-span-5">
            <div className="sticky top-32 space-y-8">
              <div className="bg-white/40 border border-white/20 backdrop-blur-lg p-6 sm:p-8 rounded-[1.5rem] shadow-[0_8px_32px_rgba(119,90,25,0.03)] relative overflow-hidden">
                <div className="absolute -top-16 -left-16 w-36 h-36 bg-[#fed488]/5 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-16 -right-16 w-36 h-36 bg-[#775a19]/5 rounded-full blur-3xl"></div>
                
                <div className="relative z-10">
                  <h3 className="text-lg font-headline font-black tracking-tight uppercase mb-6 pb-3 border-b border-outline-variant/10 text-on-surface">Order Summary</h3>
                  
                  {/* Product List */}
                  <div className="space-y-6 mb-8">
                    {cart.map((item, index) => (
                      <div key={index} className="flex gap-6">
                        <div className="w-20 h-26 bg-white overflow-hidden flex-shrink-0 rounded-xl border border-outline-variant/10">
                          <img
                            className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-500"
                            src={item.image}
                            alt={item.productName}
                          />
                        </div>
                        <div className="flex-grow flex flex-col justify-between py-1 text-left">
                          <div>
                            <h4 className="font-headline font-bold uppercase text-xs tracking-wide text-on-surface">{item.productName}</h4>
                            <p className="text-[8px] uppercase tracking-[0.15em] text-outline mt-1 font-bold">
                              Size: {item.size} | Color: Atelier Choice
                            </p>
                          </div>
                          <span className="font-headline font-black text-sm text-[#fed488]">
                            ₹ {(Number(item.price) || 0).toLocaleString("en-IN")}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Price Matrix */}
                  <div className="space-y-4 border-t border-outline-variant/10 pt-6 mb-6">
                    <div className="flex justify-between text-[10px] tracking-widest uppercase text-outline/70">
                      <span>Subtotal</span>
                      <span>₹ {subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    {appliedDiscount > 0 && (
                      <div className="flex justify-between text-[10px] tracking-widest uppercase text-red-600 font-bold animate-fade-in">
                        <span>Coupon Discount</span>
                        <span>- ₹ {appliedDiscount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {loyaltyChecked && loyaltyDiscount > 0 && (
                      <div className="flex justify-between text-[10px] tracking-widest uppercase text-red-600 font-bold animate-fade-in">
                        <span>Loyalty Discount</span>
                        <span>- ₹ {loyaltyDiscount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-[10px] tracking-widest uppercase text-outline/70">
                      <span>GST (12%)</span>
                      <span>₹ {gst.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-[10px] tracking-widest uppercase text-secondary font-bold">
                      <span>Shipping</span>
                      <span>FREE</span>
                    </div>
                    {walletChecked && walletDeduction > 0 && (
                      <div className="flex justify-between text-[10px] tracking-widest uppercase text-green-700 font-bold animate-fade-in">
                        <span>Wallet Paid</span>
                        <span>- ₹ {walletDeduction.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-md font-headline font-black tracking-tight pt-4 border-t border-outline-variant/10 text-on-surface">
                      <span className="uppercase">Final Payable</span>
                      <span className="text-[#fed488]">₹ {finalPayable.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>

                  {/* Primary Action Button */}
                  <button
                    onClick={handleSubmit}
                    className="w-full bg-[#775a19] text-white hover:bg-[#fed488] hover:text-primary hover:shadow-[0_10px_25px_rgba(254,212,136,0.15)] hover:-translate-y-0.5 active:translate-y-0 py-4 font-headline font-black text-xs tracking-[0.25em] uppercase transition-all duration-500 ease-out rounded-xl shadow-lg active:scale-[0.98] cursor-pointer flex items-center justify-center gap-3 mt-4"
                  >
                    {getButtonText()}
                  </button>

                  {/* Secure checkout assurances */}
                  <div className="mt-6 space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-md text-[#fed488]">verified_user</span>
                      <span className="text-[8px] uppercase tracking-[0.2em] text-outline font-bold">
                        100% Secure Encrypted Payments
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-md text-[#fed488]">local_shipping</span>
                      <span className="text-[8px] uppercase tracking-[0.2em] text-outline font-bold">
                        Insured Fast Shipping
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Sticky Bottom Drawer for Mobile Viewports */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface/90 backdrop-blur-xl border-t border-outline-variant/15 p-4 flex flex-col gap-3 shadow-[0_-8px_32px_rgba(0,0,0,0.15)]">
        <div className="flex justify-between items-center text-xs tracking-widest uppercase font-black">
          <span className="text-outline">Final Payable</span>
          <span className="text-[#fed488] text-sm">₹ {finalPayable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
        </div>
        <button
          onClick={handleSubmit}
          className="w-full bg-[#775a19] text-white hover:bg-[#fed488] hover:text-primary py-3 font-headline font-black text-[10px] tracking-[0.2em] uppercase transition-all duration-300 rounded-lg active:scale-95 flex items-center justify-center gap-2 cursor-pointer shadow-md"
        >
          <span>{getButtonText()}</span>
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </button>
      </div>

      {/* Global Footer */}
      <footer className="py-12 bg-[#0A0A0A] text-white px-6 lg:px-20 border-t-4 border-secondary pb-36 lg:pb-12">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <img 
                    src="/assets/logo.png" 
                    alt="6K Logo" 
                    className="h-8 w-auto object-contain"
                    draggable={false}
                  />
                <span className="font-headline text-2xl font-black tracking-tighter uppercase text-white">6K Shirts</span>
              </div>
              <p className="text-[10px] text-white/60 leading-relaxed max-w-sm uppercase tracking-widest font-light mb-6">
                Premium menswear born from the looms of South India. Crafted with precision, shipped globally.
              </p>
              <Link href="/admindashboard" className="inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all duration-300">
                <span className="material-symbols-outlined text-sm">admin_panel_settings</span>
                Admin Portal
              </Link>
            </div>
            <div className="lg:text-right flex flex-col lg:items-end justify-center">
              <h4 className="text-lg font-headline font-black uppercase tracking-tight mb-2 text-white">Join the Atelier</h4>
              <p className="text-[9px] font-bold uppercase tracking-widest text-white/50 mb-4">Early access to limited runs and private sales.</p>
              <div className="flex w-full lg:max-w-md border-b border-white/20 pb-2 focus-within:border-secondary transition-colors">
                <input type="email" placeholder="ENTER YOUR EMAIL" className="bg-transparent border-none outline-none w-full text-[10px] uppercase tracking-widest text-white placeholder-white/30 px-2" />
                <button className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary hover:text-white transition-colors px-2">Subscribe</button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10 pt-10 border-t border-white/10">
            <div className="col-span-1 md:col-span-2">
              <h4 className="text-[9px] font-black uppercase tracking-[0.3em] mb-4 text-white/40">Our Atelier</h4>
              <p className="text-[10px] font-light uppercase tracking-widest text-white/80 leading-loose flex items-start gap-4">
                <span className="material-symbols-outlined text-secondary mt-1">location_on</span>
                <span>
                  The Stitch 6K Workshop<br />
                  Tiruppur Textile District<br />
                  Tamil Nadu, India 641604<br />
                  <span className="text-[8px] text-white/40 mt-1 block">Global Distribution Center</span>
                </span>
              </p>
            </div>
            <div>
              <h4 className="text-[9px] font-black uppercase tracking-[0.3em] mb-4 text-white/40">Client Services</h4>
              <ul className="space-y-3 text-[10px] font-light uppercase tracking-widest text-white/70">
                <li><Link href="/shipping-policy" className="hover:text-secondary hover:translate-x-1 inline-block transition-all">Global Shipping</Link></li>
                <li><Link href="/return-policy" className="hover:text-secondary hover:translate-x-1 inline-block transition-all">Returns & Exchanges</Link></li>
                <li><Link href="/terms" className="hover:text-secondary hover:translate-x-1 inline-block transition-all">Size Guide</Link></li>
                <li><Link href="/contact" className="hover:text-secondary hover:translate-x-1 inline-block transition-all">Contact Concierge</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-[9px] font-black uppercase tracking-[0.3em] mb-4 text-white/40">Legal</h4>
              <ul className="space-y-3 text-[10px] font-light uppercase tracking-widest text-white/70">
                <li><Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
                <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
              </ul>
            </div>
          </div>

          <div className="pt-6 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-[9px] font-bold uppercase tracking-[0.4em] text-white/60">© 2026 6K Shirts. Crafted in Tamil Nadu.</p>
            <div className="flex items-center gap-4 text-white/60">
              <span className="text-[9px] uppercase tracking-widest font-bold">Shipping Worldwide</span>
              <div className="w-1 h-1 rounded-full bg-secondary"></div>
              <span className="text-[9px] uppercase tracking-widest font-bold">INR / USD / EUR / GBP</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

  return (
    <div className="bg-surface text-on-surface min-h-screen flex flex-col">
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-6 right-6 z-[100] bg-on-surface text-surface py-4 px-6 text-[10px] font-bold uppercase tracking-[0.2em] shadow-2xl border border-outline/25">
          {toastText}
        </div>
      )}

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

      {/* Top Header */}
      <header className="sticky top-0 z-50 bg-surface/80 backdrop-blur-xl border-b border-outline-variant/10 px-6 lg:px-20 py-2.5">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-12">
            <Link href="/" className="flex items-center group">
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
              <Link className="text-[10px] font-black uppercase tracking-widest text-outline hover:text-primary transition-colors" href="/">Home</Link>
              <Link className="text-[10px] font-black uppercase tracking-widest text-outline hover:text-primary transition-colors" href="/genz">GEN-Z</Link>
              <Link className="text-[10px] font-black uppercase tracking-widest text-outline hover:text-primary transition-colors" href="/shopallshirts">Shop All</Link>
              <Link className="text-[10px] font-black uppercase tracking-widest text-outline hover:text-primary transition-colors" href="/orderhistory">Order History</Link>
              <Link className="text-[10px] font-black uppercase tracking-widest text-outline hover:text-primary transition-colors" href="/ordertracking">Track Order</Link>
            </nav>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/shoppingbag" className="material-symbols-outlined text-outline hover:text-primary transition-colors">shopping_bag</Link>
            <Link href="/myprofile" className="material-symbols-outlined text-outline hover:text-primary transition-colors">person</Link>
            <Link href="/admindashboard" className="material-symbols-outlined text-outline hover:text-primary transition-colors">admin_panel_settings</Link>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="material-symbols-outlined md:hidden">menu</button>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="flex flex-col mt-4 space-y-4 md:hidden">
            <Link className="block text-[10px] font-black uppercase tracking-widest" href="/">Home</Link>
            <Link className="block text-[10px] font-black uppercase tracking-widest" href="/genz">GEN-Z</Link>
            <Link className="block text-[10px] font-black uppercase tracking-widest" href="/shopallshirts">Shop All</Link>
            <Link className="block text-[10px] font-black uppercase tracking-widest" href="/orderhistory">Order History</Link>
            <Link className="block text-[10px] font-black uppercase tracking-widest" href="/ordertracking">Track Order</Link>
          </div>
        )}
      </header>

      {/* Main Checkout Station */}
      <main className="pt-[calc(4rem+env(safe-area-inset-top,0px))] md:pt-24 pb-16 md:pb-24 px-4 sm:px-6 md:px-8 max-w-screen-xl mx-auto flex-grow w-full">
        {/* Progress Timeline Indicator */}
        <div className="max-w-2xl mx-auto mb-10 select-none">
          <div className="flex items-center justify-between bg-white/30 backdrop-blur-md border border-outline-variant/10 p-1.5 rounded-full text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-center shadow-sm">
            <div
              className={`flex-grow py-2.5 rounded-full transition-all duration-500 cursor-pointer ${
                currentStep === 1 
                  ? "bg-on-surface text-surface shadow-md scale-102 font-black" 
                  : "text-outline/60 hover:text-on-surface"
              }`}
              onClick={() => handleGoToStep(1)}
            >
              01. Details
            </div>
            <div
              className={`flex-grow py-2.5 rounded-full transition-all duration-500 cursor-pointer ${
                currentStep === 2 
                  ? "bg-on-surface text-surface shadow-md scale-102 font-black" 
                  : "text-outline/60 hover:text-on-surface"
              }`}
              onClick={() => handleGoToStep(2)}
            >
              02. Perks
            </div>
            <div
              className={`flex-grow py-2.5 rounded-full transition-all duration-500 ${
                currentStep === 3 
                  ? "bg-on-surface text-surface shadow-md scale-102 font-black" 
                  : "text-outline/40"
              }`}
            >
              03. Review
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          {/* Left Column: Form Wizards */}
          <div className="lg:col-span-7">
            {/* Step 1: Delivery Details */}
            {currentStep === 1 && (
              <div className="space-y-10">
                <div className="space-y-1.5 mb-6">
                  <span className="block text-[10px] font-black tracking-[0.25em] text-secondary uppercase italic">Step 01 of 03</span>
                  <h2 className="text-2xl sm:text-3xl font-headline font-black tracking-tight uppercase text-on-surface">Delivery Details</h2>
                </div>
                <AddressList 
                  userId={userId} 
                  onAddressSelected={(address) => setSelectedAddress(address)} 
                />
              </div>
            )}

            {/* Step 2: Perks & Wallet */}
            {currentStep === 2 && (
              <div className="space-y-12 animate-fade-in">
                <div className="space-y-1.5 mb-6">
                  <span className="block text-[10px] font-black tracking-[0.25em] text-secondary uppercase italic">Step 02 of 03</span>
                  <h2 className="text-2xl sm:text-3xl font-headline font-black tracking-tight uppercase text-on-surface">Perks & Store Credit</h2>
                </div>
                <div className="space-y-6">
                  {/* Coupon Validation */}
                  <div className="bg-white/40 border border-white/20 backdrop-blur-md p-6 sm:p-8 rounded-2xl shadow-sm relative overflow-hidden">
                    <h4 className="text-[10px] font-black tracking-widest uppercase mb-4 text-outline/80">Promotional Discount</h4>
                    <div className="flex gap-2">
                      <input
                        id="couponInput"
                        className="flex-grow px-4 py-3 bg-white/30 border border-outline-variant/20 focus:border-[#fed488]/60 focus:bg-white/50 text-[10px] font-black uppercase tracking-wider outline-none transition-all duration-300 rounded-lg text-on-surface placeholder-on-surface/40 shadow-sm"
                        placeholder="DISCOUNT CODE"
                        type="text"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value)}
                      />
                      <button
                        id="applyCouponBtn"
                        onClick={handleApplyCoupon}
                        className="bg-on-surface text-surface px-6 py-3 text-[10px] font-black tracking-[0.25em] uppercase hover:bg-secondary transition-all rounded-lg active:scale-95 shadow-sm cursor-pointer"
                      >
                        Apply
                      </button>
                    </div>
                    {couponMessage.text && (
                      <p
                        id="couponMessage"
                        className={`text-[9px] font-bold uppercase tracking-widest mt-2 ${
                          couponMessage.isError ? "text-red-600" : "text-green-600"
                        }`}
                      >
                        {couponMessage.text}
                      </p>
                    )}
                  </div>

                  {/* Wallet & Points Toggles */}
                  <div className="bg-white/40 border border-white/20 backdrop-blur-md p-6 sm:p-8 rounded-2xl shadow-sm relative space-y-6">
                    <h4 className="text-[10px] font-black tracking-widest uppercase text-outline/80">Redemption Portal</h4>
                    <div className="space-y-4 text-[10px] tracking-widest uppercase">
                      {/* Loyalty Toggle */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="relative flex items-center justify-center">
                            <input
                              type="checkbox"
                              id="loyaltyToggle"
                              checked={loyaltyChecked}
                              onChange={(e) => setLoyaltyChecked(e.target.checked)}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 peer"
                            />
                            <div className="w-4 h-4 border border-outline-variant/30 rounded transition-all duration-300 bg-white/50 backdrop-blur-sm peer-checked:bg-[#fed488] peer-checked:border-[#fed488] group-hover:border-[#fed488]/70 flex items-center justify-center">
                              <span className="material-symbols-outlined text-[10px] text-neutral-950 font-black opacity-0 peer-checked:opacity-100 transition-opacity duration-300 select-none">
                                check
                              </span>
                            </div>
                          </div>
                          <label htmlFor="loyaltyToggle" className="font-black cursor-pointer select-none text-[10px] tracking-wider text-on-surface/80">
                            REDEEM LOYALTY POINTS
                          </label>
                        </div>
                        <span id="loyaltyAvailableText" className="text-outline font-bold text-[9px] tracking-wider uppercase">
                          {availablePoints} PTS AVAILABLE
                        </span>
                      </div>
                      {loyaltyChecked && loyaltyDiscount > 0 && (
                        <div id="loyaltyAppliedMessage" className="text-[9px] font-bold text-green-600 uppercase tracking-widest pl-6">
                          REDEEMING {pointsRedeemed} POINTS (-₹{loyaltyDiscount.toLocaleString("en-IN", { minimumFractionDigits: 2 })})
                        </div>
                      )}

                      {/* Wallet Toggle */}
                      <div className="flex items-center justify-between border-t border-outline-variant/10 pt-4">
                        <div className="flex items-center gap-3">
                          <div className="relative flex items-center justify-center">
                            <input
                              type="checkbox"
                              id="walletToggle"
                              checked={walletChecked}
                              onChange={(e) => setWalletChecked(e.target.checked)}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 peer"
                            />
                            <div className="w-4 h-4 border border-outline-variant/30 rounded transition-all duration-300 bg-white/50 backdrop-blur-sm peer-checked:bg-[#fed488] peer-checked:border-[#fed488] group-hover:border-[#fed488]/70 flex items-center justify-center">
                              <span className="material-symbols-outlined text-[10px] text-neutral-950 font-black opacity-0 peer-checked:opacity-100 transition-opacity duration-300 select-none">
                                check
                              </span>
                            </div>
                          </div>
                          <label htmlFor="walletToggle" className="font-black cursor-pointer select-none text-[10px] tracking-wider text-on-surface/80">
                            PAY WITH STORE WALLET
                          </label>
                        </div>
                        <span id="walletAvailableText" className="text-outline font-bold text-[9px] tracking-wider uppercase">
                          ₹{availableWallet.toLocaleString("en-IN", { minimumFractionDigits: 2 })} AVAILABLE
                        </span>
                      </div>
                      {walletChecked && walletDeduction > 0 && (
                        <div id="walletAppliedMessage" className="text-[9px] font-bold text-green-600 uppercase tracking-widest pl-6">
                          APPLYING ₹{walletDeduction.toLocaleString("en-IN", { minimumFractionDigits: 2 })} FROM WALLET
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Navigation back */}
                  <div className="flex gap-4 pt-6">
                    <button
                      type="button"
                      onClick={() => handleGoToStep(1)}
                      className="flex-grow border border-outline-variant/20 text-on-surface py-3.5 text-[10px] font-black tracking-[0.2em] uppercase hover:bg-white/50 transition-all rounded-lg active:scale-95 shadow-sm flex items-center justify-center gap-2 bg-transparent cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">arrow_back</span> Back to Shipping
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Final Verification */}
            {currentStep === 3 && (
              <div className="space-y-12 animate-fade-in">
                <div className="space-y-1.5 mb-6">
                  <span className="block text-[10px] font-black tracking-[0.25em] text-secondary uppercase italic">Step 03 of 03</span>
                  <h2 className="text-2xl sm:text-3xl font-headline font-black tracking-tight uppercase text-on-surface">Final Verification</h2>
                </div>
                <div className="space-y-6">
                  {/* Destination Overview */}
                  <div className="bg-white/40 border border-white/20 backdrop-blur-md p-6 sm:p-8 rounded-2xl shadow-sm relative space-y-4">
                    <h4 className="text-[10px] font-black tracking-widest uppercase text-secondary">Delivery Destination</h4>
                    <div className="text-[10px] font-medium space-y-2 uppercase tracking-wide">
                      <p>
                        <span className="text-outline">Client Name:</span>{" "}
                        <span className="font-bold text-on-surface">{selectedAddress?.name}</span>
                      </p>
                      <p>
                        <span className="text-outline">Address:</span>{" "}
                        <span className="font-bold text-on-surface">{selectedAddress?.address_line_1}{selectedAddress?.address_line_2 ? `, ${selectedAddress.address_line_2}` : ""}, {selectedAddress?.city} - {selectedAddress?.postal_code}</span>
                      </p>
                      <p>
                        <span className="text-outline">Contact:</span>{" "}
                        <span className="font-bold text-on-surface">{selectedAddress?.phone}</span> | <span className="text-on-surface">{user?.email || "guest@stitch6k.com"}</span>
                      </p>
                    </div>
                  </div>

                  {/* Applied Perks Summary */}
                  {(appliedDiscount > 0 || loyaltyChecked || walletChecked) && (
                    <div className="bg-white/40 border border-white/20 backdrop-blur-md p-6 sm:p-8 rounded-2xl shadow-sm relative space-y-4">
                      <h4 className="text-[10px] font-black tracking-widest uppercase text-secondary">Applied Perks</h4>
                      <div className="text-[10px] font-bold space-y-2 uppercase tracking-wide text-green-700">
                        {appliedDiscount > 0 && <p>✓ Coupon Applied ({appliedCouponCode})</p>}
                        {loyaltyChecked && loyaltyDiscount > 0 && <p>✓ Loyalty Points Redeemed ({pointsRedeemed} pts)</p>}
                        {walletChecked && walletDeduction > 0 && <p>✓ Store Wallet Debit Applied</p>}
                      </div>
                    </div>
                  )}

                  {/* Navigation back */}
                  <div className="flex gap-4 pt-6">
                    <button
                      type="button"
                      onClick={() => handleGoToStep(2)}
                      className="flex-grow border border-outline-variant/20 text-on-surface py-3.5 text-[10px] font-black tracking-[0.2em] uppercase hover:bg-white/50 transition-all rounded-lg active:scale-95 shadow-sm flex items-center justify-center gap-2 bg-transparent cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">arrow_back</span> Back to Perks
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Order Summary (Sticky) */}
          <div className="lg:col-span-5">
            <div className="sticky top-32 space-y-8">
              <div className="bg-white/40 border border-white/20 backdrop-blur-lg p-6 sm:p-8 rounded-[1.5rem] shadow-[0_8px_32px_rgba(119,90,25,0.03)] relative overflow-hidden">
                <div className="absolute -top-16 -left-16 w-36 h-36 bg-[#fed488]/5 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-16 -right-16 w-36 h-36 bg-[#775a19]/5 rounded-full blur-3xl"></div>
                
                <div className="relative z-10">
                  <h3 className="text-lg font-headline font-black tracking-tight uppercase mb-6 pb-3 border-b border-outline-variant/10 text-on-surface">Order Summary</h3>
                  
                  {/* Product List */}
                  <div className="space-y-6 mb-8">
                    {cart.map((item, index) => (
                      <div key={index} className="flex gap-6">
                        <div className="w-20 h-26 bg-white overflow-hidden flex-shrink-0 rounded-xl border border-outline-variant/10">
                          <img
                            className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-500"
                            src={item.image}
                            alt={item.productName}
                          />
                        </div>
                        <div className="flex-grow flex flex-col justify-between py-1 text-left">
                          <div>
                            <h4 className="font-headline font-bold uppercase text-xs tracking-wide text-on-surface">{item.productName}</h4>
                            <p className="text-[8px] uppercase tracking-[0.15em] text-outline mt-1 font-bold">
                              Size: {item.size} | Color: Atelier Choice
                            </p>
                          </div>
                          <span className="font-headline font-black text-sm text-[#fed488]">
                            ₹ {(Number(item.price) || 0).toLocaleString("en-IN")}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Price Matrix */}
                  <div className="space-y-4 border-t border-outline-variant/10 pt-6 mb-6">
                    <div className="flex justify-between text-[10px] tracking-widest uppercase text-outline/70">
                      <span>Subtotal</span>
                      <span>₹ {subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    {appliedDiscount > 0 && (
                      <div className="flex justify-between text-[10px] tracking-widest uppercase text-red-600 font-bold animate-fade-in">
                        <span>Coupon Discount</span>
                        <span>- ₹ {appliedDiscount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {loyaltyChecked && loyaltyDiscount > 0 && (
                      <div className="flex justify-between text-[10px] tracking-widest uppercase text-red-600 font-bold animate-fade-in">
                        <span>Loyalty Discount</span>
                        <span>- ₹ {loyaltyDiscount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-[10px] tracking-widest uppercase text-outline/70">
                      <span>GST (12%)</span>
                      <span>₹ {gst.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-[10px] tracking-widest uppercase text-secondary font-bold">
                      <span>Shipping</span>
                      <span>FREE</span>
                    </div>
                    {walletChecked && walletDeduction > 0 && (
                      <div className="flex justify-between text-[10px] tracking-widest uppercase text-green-700 font-bold animate-fade-in">
                        <span>Wallet Paid</span>
                        <span>- ₹ {walletDeduction.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-md font-headline font-black tracking-tight pt-4 border-t border-outline-variant/10 text-on-surface">
                      <span className="uppercase">Final Payable</span>
                      <span className="text-[#fed488]">₹ {finalPayable.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>

                  {/* Primary Action Button */}
                  <button
                    onClick={handleSubmit}
                    className="w-full bg-[#775a19] text-white hover:bg-[#fed488] hover:text-primary hover:shadow-[0_10px_25px_rgba(254,212,136,0.15)] hover:-translate-y-0.5 active:translate-y-0 py-4 font-headline font-black text-xs tracking-[0.25em] uppercase transition-all duration-500 ease-out rounded-xl shadow-lg active:scale-[0.98] cursor-pointer flex items-center justify-center gap-3 mt-4"
                  >
                    {getButtonText()}
                  </button>

                  {/* Secure checkout assurances */}
                  <div className="mt-6 space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-md text-[#fed488]">verified_user</span>
                      <span className="text-[8px] uppercase tracking-[0.2em] text-outline font-bold">
                        100% Secure Encrypted Payments
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-md text-[#fed488]">local_shipping</span>
                      <span className="text-[8px] uppercase tracking-[0.2em] text-outline font-bold">
                        Insured Fast Shipping
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Global Footer */}
      <footer className="py-12 bg-[#0A0A0A] text-white px-6 lg:px-20 border-t-4 border-secondary">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <img 
                    src="/assets/logo.png" 
                    alt="6K Logo" 
                    className="h-8 w-auto object-contain"
                    draggable={false}
                  />
                <span className="font-headline text-2xl font-black tracking-tighter uppercase text-white">6K Shirts</span>
              </div>
              <p className="text-[10px] text-white/60 leading-relaxed max-w-sm uppercase tracking-widest font-light mb-6">
                Premium menswear born from the looms of South India. Crafted with precision, shipped globally.
              </p>
              <Link href="/admindashboard" className="inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all duration-300">
                <span className="material-symbols-outlined text-sm">admin_panel_settings</span>
                Admin Portal
              </Link>
            </div>
            <div className="lg:text-right flex flex-col lg:items-end justify-center">
              <h4 className="text-lg font-headline font-black uppercase tracking-tight mb-2 text-white">Join the Atelier</h4>
              <p className="text-[9px] font-bold uppercase tracking-widest text-white/50 mb-4">Early access to limited runs and private sales.</p>
              <div className="flex w-full lg:max-w-md border-b border-white/20 pb-2 focus-within:border-secondary transition-colors">
                <input type="email" placeholder="ENTER YOUR EMAIL" className="bg-transparent border-none outline-none w-full text-[10px] uppercase tracking-widest text-white placeholder-white/30 px-2" />
                <button className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary hover:text-white transition-colors px-2">Subscribe</button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10 pt-10 border-t border-white/10">
            <div className="col-span-1 md:col-span-2">
              <h4 className="text-[9px] font-black uppercase tracking-[0.3em] mb-4 text-white/40">Our Atelier</h4>
              <p className="text-[10px] font-light uppercase tracking-widest text-white/80 leading-loose flex items-start gap-4">
                <span className="material-symbols-outlined text-secondary mt-1">location_on</span>
                <span>
                  The Stitch 6K Workshop<br />
                  Tiruppur Textile District<br />
                  Tamil Nadu, India 641604<br />
                  <span className="text-[8px] text-white/40 mt-1 block">Global Distribution Center</span>
                </span>
              </p>
            </div>
            <div>
              <h4 className="text-[9px] font-black uppercase tracking-[0.3em] mb-4 text-white/40">Client Services</h4>
              <ul className="space-y-3 text-[10px] font-light uppercase tracking-widest text-white/70">
                <li><Link href="/shipping-policy" className="hover:text-secondary hover:translate-x-1 inline-block transition-all">Global Shipping</Link></li>
                <li><Link href="/return-policy" className="hover:text-secondary hover:translate-x-1 inline-block transition-all">Returns & Exchanges</Link></li>
                <li><Link href="/terms" className="hover:text-secondary hover:translate-x-1 inline-block transition-all">Size Guide</Link></li>
                <li><Link href="/contact" className="hover:text-secondary hover:translate-x-1 inline-block transition-all">Contact Concierge</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-[9px] font-black uppercase tracking-[0.3em] mb-4 text-white/40">Legal</h4>
              <ul className="space-y-3 text-[10px] font-light uppercase tracking-widest text-white/70">
                <li><Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
                <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
              </ul>
            </div>
          </div>

          <div className="pt-6 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-[9px] font-bold uppercase tracking-[0.4em] text-white/60">© 2026 6K Shirts. Crafted in Tamil Nadu.</p>
            <div className="flex items-center gap-4 text-white/60">
              <span className="text-[9px] uppercase tracking-widest font-bold">Shipping Worldwide</span>
              <div className="w-1 h-1 rounded-full bg-secondary"></div>
              <span className="text-[9px] uppercase tracking-widest font-bold">INR / USD / EUR / GBP</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
