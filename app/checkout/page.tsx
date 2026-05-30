"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { db } from "@/lib/db";

interface CartItem {
  productName: string;
  price: number;
  size: string;
  image: string;
}

export default function CheckoutPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Form Fields
  const [form, setForm] = useState({
    fname: "",
    lname: "",
    email: "",
    address: "",
    city: "",
    pincode: "",
    phone: "",
  });

  // Cart & Calculation States
  const [cart, setCart] = useState<CartItem[]>([]);
  const [couponCode, setCouponCode] = useState("");
  const [couponMessage, setCouponMessage] = useState({ text: "", isError: false });
  const [appliedDiscount, setAppliedDiscount] = useState(0);
  const [appliedCouponCode, setAppliedCouponCode] = useState("");

  const [loyaltyChecked, setLoyaltyChecked] = useState(false);
  const [walletChecked, setWalletChecked] = useState(false);

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
    // Fetch Cart
    let savedCart: CartItem[] = [];
    try {
      savedCart = JSON.parse(localStorage.getItem("cart_items") || "[]");
    } catch (e) {
      console.error("Failed to parse cart items", e);
    }

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
  }, []);

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

  // Handle Form Change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({
      ...form,
      [e.target.id]: e.target.value,
    });
  };

  // Coupon Code Validation
  const handleApplyCoupon = async () => {
    const code = couponCode.trim();
    if (!code) {
      setAppliedDiscount(0);
      setAppliedCouponCode("");
      setCouponMessage({ text: "", isError: false });
      return;
    }

    const coupon = await db.validateCoupon(code);

    if (coupon) {
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
        text: "INVALID OR EXPIRED COUPON CODE",
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
      const emptyFields = Object.entries(form).filter(([_, val]) => !val.trim());
      if (emptyFields.length > 0) {
        triggerToast("Please fill in all shipping details");
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
      const customerName = `${form.fname} ${form.lname}`;

      if (finalPayable === 0) {
        // Paid fully via Wallet and/or Loyalty Points
        const orderId = "ORD-" + Math.floor(Math.random() * 9000 + 1000);

        if (walletDeduction > 0) {
          await db.applyWalletDebit(walletDeduction, orderId);
        }
        if (pointsRedeemed > 0) {
          await db.applyLoyaltyDebit(pointsRedeemed, orderId);
        }

        // Earn points on netTotal
        await db.awardLoyaltyPoints(netTotal, orderId);

        // Save Order
        await db.saveOrder({
          id: orderId,
          customer: customerName,
          date: new Date().toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          }),
          total: netTotal,
          originalTotal: baseTotal,
          couponDiscount: appliedDiscount,
          couponCode: appliedCouponCode,
          walletPaid: walletDeduction,
          gatewayPaid: 0,
          pointsRedeemed: pointsRedeemed,
          pointsDiscount: loyaltyDiscount,
          pointsEarned: Math.floor(netTotal / 10),
          status: "Paid via Wallet",
          items: cart.map((item) => item.productName),
        });

        triggerToast("Order placed successfully!");
        setTimeout(() => {
          router.push("/orderconfirmed");
        }, 1000);
      } else {
        // Forward to payment gateway
        const checkoutState = {
          customer: customerName,
          originalTotal: baseTotal,
          couponDiscount: appliedDiscount,
          couponCode: appliedCouponCode,
          netTotal: netTotal,
          walletDeduction: walletDeduction,
          pointsRedeemed: pointsRedeemed,
          pointsDiscount: loyaltyDiscount,
          finalPayable: finalPayable,
          items: cart.map((item) => item.productName),
        };
        sessionStorage.setItem("checkoutState", JSON.stringify(checkoutState));
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
      <header className="sticky top-0 z-50 bg-surface/80 backdrop-blur-xl border-b border-outline-variant/10 px-6 lg:px-20 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-12">
            <Link href="/" className="flex items-center group">
              <img 
                src="/assets/logo.png" 
                alt="6K Logo" 
                className="h-10 w-auto object-contain" 
                draggable={false}
              />
            </Link>
            <nav className="hidden md:flex items-center gap-8">
              <Link className="text-[10px] font-black uppercase tracking-widest text-outline hover:text-primary transition-colors" href="/">Home</Link>
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
            <Link className="block text-[10px] font-black uppercase tracking-widest" href="/shopallshirts">Shop All</Link>
            <Link className="block text-[10px] font-black uppercase tracking-widest" href="/orderhistory">Order History</Link>
            <Link className="block text-[10px] font-black uppercase tracking-widest" href="/ordertracking">Track Order</Link>
          </div>
        )}
      </header>

      {/* Main Checkout Station */}
      <main className="pt-32 pb-24 px-8 max-w-screen-xl mx-auto flex-grow w-full">
        {/* Progress Timeline Indicator */}
        <div className="max-w-4xl mx-auto mb-16">
          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.3em] border-b border-outline/10 pb-4">
            <div
              className={`${
                currentStep === 1 ? "text-secondary border-b-2 border-secondary" : "text-outline/40 border-b-2 border-transparent"
              } pb-4 -mb-[18px] transition-all font-bold cursor-pointer`}
              onClick={() => handleGoToStep(1)}
            >
              01. Delivery Details
            </div>
            <div
              className={`${
                currentStep === 2 ? "text-secondary border-b-2 border-secondary" : "text-outline/40 border-b-2 border-transparent"
              } pb-4 -mb-[18px] transition-all font-bold cursor-pointer`}
              onClick={() => handleGoToStep(2)}
            >
              02. Perks & Credit
            </div>
            <div
              className={`${
                currentStep === 3 ? "text-secondary border-b-2 border-secondary" : "text-outline/40 border-b-2 border-transparent"
              } pb-4 -mb-[18px] transition-all font-bold`}
            >
              03. Final Verification
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
          {/* Left Column: Form Wizards */}
          <div className="lg:col-span-7">
            {/* Step 1: Delivery Details */}
            {currentStep === 1 && (
              <div className="space-y-12">
                <div className="flex items-baseline gap-4 mb-12">
                  <span className="text-xs font-bold tracking-[0.2em] text-secondary uppercase italic">Step 01 of 03</span>
                  <h2 className="text-4xl font-bold tracking-tighter uppercase">Delivery Details</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-16">
                  <div className="relative group">
                    <input
                      className="block w-full px-0 py-4 bg-transparent border-0 border-b border-outline/30 focus:border-secondary focus:ring-0 peer transition-colors text-sm uppercase tracking-wider"
                      id="fname"
                      placeholder=" "
                      type="text"
                      value={form.fname}
                      onChange={handleInputChange}
                    />
                    <label
                      className="absolute text-xs tracking-[0.2em] uppercase text-outline/60 top-4 z-10 origin-[0] duration-300 transform -translate-y-8 scale-100 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-90 peer-focus:-translate-y-8 peer-focus:text-secondary cursor-text"
                      htmlFor="fname"
                    >
                      First Name
                    </label>
                  </div>
                  <div className="relative group">
                    <input
                      className="block w-full px-0 py-4 bg-transparent border-0 border-b border-outline/30 focus:border-secondary focus:ring-0 peer transition-colors text-sm uppercase tracking-wider"
                      id="lname"
                      placeholder=" "
                      type="text"
                      value={form.lname}
                      onChange={handleInputChange}
                    />
                    <label
                      className="absolute text-xs tracking-[0.2em] uppercase text-outline/60 top-4 z-10 origin-[0] duration-300 transform -translate-y-8 scale-100 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-90 peer-focus:-translate-y-8 peer-focus:text-secondary cursor-text"
                      htmlFor="lname"
                    >
                      Last Name
                    </label>
                  </div>
                  <div className="md:col-span-2 relative group">
                    <input
                      className="block w-full px-0 py-4 bg-transparent border-0 border-b border-outline/30 focus:border-secondary focus:ring-0 peer transition-colors text-sm uppercase tracking-wider"
                      id="email"
                      placeholder=" "
                      type="email"
                      value={form.email}
                      onChange={handleInputChange}
                    />
                    <label
                      className="absolute text-xs tracking-[0.2em] uppercase text-outline/60 top-4 z-10 origin-[0] duration-300 transform -translate-y-8 scale-100 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-90 peer-focus:-translate-y-8 peer-focus:text-secondary cursor-text"
                      htmlFor="email"
                    >
                      Email Address
                    </label>
                  </div>
                  <div className="md:col-span-2 relative group">
                    <input
                      className="block w-full px-0 py-4 bg-transparent border-0 border-b border-outline/30 focus:border-secondary focus:ring-0 peer transition-colors text-sm uppercase tracking-wider"
                      id="address"
                      placeholder=" "
                      type="text"
                      value={form.address}
                      onChange={handleInputChange}
                    />
                    <label
                      className="absolute text-xs tracking-[0.2em] uppercase text-outline/60 top-4 z-10 origin-[0] duration-300 transform -translate-y-8 scale-100 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-90 peer-focus:-translate-y-8 peer-focus:text-secondary cursor-text"
                      htmlFor="address"
                    >
                      Full Address
                    </label>
                  </div>
                  <div className="relative group">
                    <input
                      className="block w-full px-0 py-4 bg-transparent border-0 border-b border-outline/30 focus:border-secondary focus:ring-0 peer transition-colors text-sm uppercase tracking-wider"
                      id="city"
                      placeholder=" "
                      type="text"
                      value={form.city}
                      onChange={handleInputChange}
                    />
                    <label
                      className="absolute text-xs tracking-[0.2em] uppercase text-outline/60 top-4 z-10 origin-[0] duration-300 transform -translate-y-8 scale-100 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-90 peer-focus:-translate-y-8 peer-focus:text-secondary cursor-text"
                      htmlFor="city"
                    >
                      City
                    </label>
                  </div>
                  <div className="relative group">
                    <input
                      className="block w-full px-0 py-4 bg-transparent border-0 border-b border-outline/30 focus:border-secondary focus:ring-0 peer transition-colors text-sm uppercase tracking-wider"
                      id="pincode"
                      placeholder=" "
                      type="text"
                      value={form.pincode}
                      onChange={handleInputChange}
                    />
                    <label
                      className="absolute text-xs tracking-[0.2em] uppercase text-outline/60 top-4 z-10 origin-[0] duration-300 transform -translate-y-8 scale-100 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-90 peer-focus:-translate-y-8 peer-focus:text-secondary cursor-text"
                      htmlFor="pincode"
                    >
                      Pin Code
                    </label>
                  </div>
                  <div className="md:col-span-2 relative group">
                    <input
                      className="block w-full px-0 py-4 bg-transparent border-0 border-b border-outline/30 focus:border-secondary focus:ring-0 peer transition-colors text-sm uppercase tracking-wider"
                      id="phone"
                      placeholder=" "
                      type="tel"
                      value={form.phone}
                      onChange={handleInputChange}
                    />
                    <label
                      className="absolute text-xs tracking-[0.2em] uppercase text-outline/60 top-4 z-10 origin-[0] duration-300 transform -translate-y-8 scale-100 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-90 peer-focus:-translate-y-8 peer-focus:text-secondary cursor-text"
                      htmlFor="phone"
                    >
                      Phone Number
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Perks & Wallet */}
            {currentStep === 2 && (
              <div className="space-y-12 animate-fade-in">
                <div className="flex items-baseline gap-4 mb-12">
                  <span className="text-xs font-bold tracking-[0.2em] text-secondary uppercase italic">Step 02 of 03</span>
                  <h2 className="text-4xl font-bold tracking-tighter uppercase">Perks & Store Credit</h2>
                </div>
                <div className="space-y-8">
                  {/* Coupon Validation */}
                  <div className="bg-surface-container-low p-8">
                    <h4 className="text-xs font-black tracking-widest uppercase mb-4 text-outline/80">Promotional Discount</h4>
                    <div className="flex gap-2">
                      <input
                        id="couponInput"
                        className="flex-1 bg-transparent border border-outline/20 px-4 py-3 text-[10px] tracking-widest uppercase focus:border-secondary focus:ring-0 placeholder:text-outline/40 text-on-surface"
                        placeholder="DISCOUNT CODE"
                        type="text"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value)}
                      />
                      <button
                        id="applyCouponBtn"
                        onClick={handleApplyCoupon}
                        className="bg-on-surface text-surface px-6 py-3 text-[10px] font-bold tracking-[0.2em] uppercase hover:bg-secondary transition-colors"
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
                  <div className="bg-surface-container-low p-8 space-y-6">
                    <h4 className="text-xs font-black tracking-widest uppercase text-outline/80">Redemption Portal</h4>
                    <div className="space-y-4 text-[10px] tracking-widest uppercase">
                      {/* Loyalty Toggle */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="loyaltyToggle"
                            checked={loyaltyChecked}
                            onChange={(e) => setLoyaltyChecked(e.target.checked)}
                            className="bg-transparent border border-outline/25 text-secondary focus:ring-0 focus:ring-offset-0 rounded-none cursor-pointer size-4"
                          />
                          <label htmlFor="loyaltyToggle" className="font-bold cursor-pointer select-none">
                            REDEEM LOYALTY POINTS
                          </label>
                        </div>
                        <span id="loyaltyAvailableText" className="text-outline font-semibold">
                          {availablePoints} PTS AVAILABLE
                        </span>
                      </div>
                      {loyaltyChecked && loyaltyDiscount > 0 && (
                        <div id="loyaltyAppliedMessage" className="text-[9px] font-bold text-green-600 uppercase tracking-widest pl-6">
                          REDEEMING {pointsRedeemed} POINTS (-₹{loyaltyDiscount.toLocaleString("en-IN", { minimumFractionDigits: 2 })})
                        </div>
                      )}

                      {/* Wallet Toggle */}
                      <div className="flex items-center justify-between border-t border-outline/5 pt-4">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="walletToggle"
                            checked={walletChecked}
                            onChange={(e) => setWalletChecked(e.target.checked)}
                            className="bg-transparent border border-outline/25 text-secondary focus:ring-0 focus:ring-offset-0 rounded-none cursor-pointer size-4"
                          />
                          <label htmlFor="walletToggle" className="font-bold cursor-pointer select-none">
                            PAY WITH STORE WALLET
                          </label>
                        </div>
                        <span id="walletAvailableText" className="text-outline font-semibold">
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
                      className="flex-1 border border-outline/40 text-on-surface py-4 text-[10px] font-black tracking-[0.2em] uppercase hover:bg-surface-container-low transition-all flex items-center justify-center gap-2 bg-transparent"
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
                <div className="flex items-baseline gap-4 mb-12">
                  <span className="text-xs font-bold tracking-[0.2em] text-secondary uppercase italic">Step 03 of 03</span>
                  <h2 className="text-4xl font-bold tracking-tighter uppercase">Final Verification</h2>
                </div>
                <div className="space-y-8">
                  {/* Destination Overview */}
                  <div className="bg-surface-container-low p-8 space-y-4">
                    <h4 className="text-xs font-black tracking-widest uppercase text-secondary">Delivery Destination</h4>
                    <div className="text-xs font-medium space-y-2 uppercase tracking-wide">
                      <p>
                        <span className="text-outline">Client Name:</span>{" "}
                        <span className="font-bold">{form.fname} {form.lname}</span>
                      </p>
                      <p>
                        <span className="text-outline">Address:</span>{" "}
                        <span className="font-bold">{form.address}, {form.city} - {form.pincode}</span>
                      </p>
                      <p>
                        <span className="text-outline">Contact:</span>{" "}
                        <span className="font-bold">{form.phone}</span> | <span>{form.email}</span>
                      </p>
                    </div>
                  </div>

                  {/* Applied Perks Summary */}
                  {(appliedDiscount > 0 || loyaltyChecked || walletChecked) && (
                    <div className="bg-surface-container-low p-8 space-y-4">
                      <h4 className="text-xs font-black tracking-widest uppercase text-secondary">Applied Perks</h4>
                      <div className="text-xs font-medium space-y-2 uppercase tracking-wide text-green-700 font-bold">
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
                      className="flex-1 border border-outline/40 text-on-surface py-4 text-[10px] font-black tracking-[0.2em] uppercase hover:bg-surface-container-low transition-all flex items-center justify-center gap-2 bg-transparent"
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
              <div className="bg-surface-container-low p-8">
                <h3 className="text-xl font-bold tracking-tighter uppercase mb-8 pb-4 border-b border-outline/10">Order Summary</h3>
                
                {/* Product List */}
                <div className="space-y-6 mb-8">
                  {cart.map((item, index) => (
                    <div key={index} className="flex gap-6">
                      <div className="w-24 h-32 bg-white overflow-hidden flex-shrink-0">
                        <img
                          className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-500"
                          src={item.image}
                          alt={item.productName}
                        />
                      </div>
                      <div className="flex-grow flex flex-col justify-between py-1">
                        <div>
                          <h4 className="font-headline font-bold uppercase text-sm tracking-wide">{item.productName}</h4>
                          <p className="text-[10px] uppercase tracking-widest text-outline/60 mt-1">
                            Size: {item.size} | Color: Atelier Choice
                          </p>
                        </div>
                        <span className="font-headline font-bold text-lg">
                          ₹ {(Number(item.price) || 0).toLocaleString("en-IN")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Price Matrix */}
                <div className="space-y-4 border-t border-outline/10 pt-8 mb-8">
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
                  <div className="flex justify-between text-lg font-bold tracking-tighter pt-4 border-t border-outline/5">
                    <span className="uppercase">Final Payable</span>
                    <span>₹ {finalPayable.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>

                {/* Primary Action Button */}
                <button
                  onClick={handleSubmit}
                  className="w-full bg-secondary text-on-secondary py-5 font-headline font-extrabold text-sm tracking-[0.2em] uppercase hover:opacity-90 transition-all flex items-center justify-center gap-3"
                >
                  {getButtonText()}
                </button>

                {/* Secure checkout assurances */}
                <div className="mt-8 space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-lg text-secondary">verified_user</span>
                    <span className="text-[9px] uppercase tracking-widest text-outline/60 font-semibold">
                      100% Secure Encrypted Payments
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-lg text-secondary">local_shipping</span>
                    <span className="text-[9px] uppercase tracking-widest text-outline/60 font-semibold">
                      Insured Fast Shipping
                    </span>
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
