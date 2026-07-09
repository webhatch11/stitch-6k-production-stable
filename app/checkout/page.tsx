"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import ProductImage from "@/components/ProductImage";
import {
  processWalletPointsCheckoutAction,
  processCodCheckoutAction,
  getLoyaltyAndWalletAction,
  validateCouponAction,
  verifyStockAction,
} from "@/app/actions/checkout";
import { useCartStore } from "@/stores/cartStore";
import { useCheckoutStore } from "@/stores/checkoutStore";
import { useAuthStore } from "@/stores/authStore";
import { calculateShipping, getShippingMessage, type ShippingRules } from "@/lib/shipping";
import { trackBeginCheckout, trackAddShippingInfo, trackAddPaymentInfo } from "@/lib/analytics";
import { clearCartAction } from "@/app/actions/cart";
import { createBrowserClient } from "@supabase/ssr";
import { AddressList } from "@/components/checkout/AddressList";
import { AddressErrorBoundary } from "@/components/checkout/AddressErrorBoundary";
import { UserAddress } from "@/lib/types";
import { useToastStore } from "@/stores/toastStore";
import { PaymentProcessingScreen } from "@/components/checkout/PaymentProcessingScreen";
import { PaymentFailureScreen } from "@/components/checkout/PaymentFailureScreen";
import Script from "next/script";

interface CartItem {
  productId?: string;
  productName: string;
  price: number;
  size: string;
  image: string;
  color?: string;
}

// Get GA4 client ID from cookie
const getGA4ClientId = (): string => {
  if (typeof window === "undefined") return "";
  const cookie = document.cookie
    .split(";")
    .find((c) => c.trim().startsWith("_ga="));
  if (!cookie) return "";
  return cookie.split("=")[1]?.split(".").slice(-2).join(".") || "";
};

export default function CheckoutPage() {
  const router = useRouter();
  const [isHydrated, setIsHydrated] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [paymentFailed, setPaymentFailed] = useState(false);
  const [paymentFailureError, setPaymentFailureError] = useState("");
  const [addressCount, setAddressCount] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"online" | "cod">("online");
  const [codAllowed, setCodAllowed] = useState(true);
  const [codReason, setCodReason] = useState("");
  const [globalCodEnabled, setGlobalCodEnabled] = useState(() => {
    return typeof window === "undefined" ? ((globalThis as any).codEnabled ?? true) : true;
  });
  const [shippingRules, setShippingRules] = useState<any>(null);

  // Load global COD flag and shipping rules on mount
  useEffect(() => {
    import("@/app/actions/admin-settings").then(({ getSettingAction }) => {
      getSettingAction("flags").then((res) => {
        if (res.success && res.value) {
          const enabled = res.value.cod_enabled ?? true;
          setGlobalCodEnabled(enabled);
        }
      });
      getSettingAction("shipping_rules").then((res) => {
        if (res.success && res.value) {
          setShippingRules(res.value);
        }
      });
    });
  }, []);

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

  const handleAddressSelected = React.useCallback((address: UserAddress | null) => {
    setSelectedAddress(address);
  }, [setSelectedAddress]);

  const handleAddressCountChange = React.useCallback((count: number) => {
    setAddressCount(count);
  }, []);

  const [user, setUser] = useState<any>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const supabase = React.useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  ), []);

  useEffect(() => {
    const fetchUser = async () => {
      if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        setUser(authUser);
      } else {
        // Fallback for mock user in local development
        const mockSession = localStorage.getItem("mock_user_session");
        if (mockSession) {
          const mockProfile = localStorage.getItem("mock_user_profile");
          if (mockProfile) {
            const parsed = JSON.parse(mockProfile);
            setUser({
              id: parsed.id,
              email: parsed.email,
              user_metadata: { full_name: parsed.name }
            });
          }
        }
      }
      setLoadingUser(false);
    };
    fetchUser();
  }, [supabase]);

  const userId = user?.id || null;

  useEffect(() => {
    if (!loadingUser && !userId) {
      router.push("/login?redirect=/checkout");
    }
  }, [loadingUser, userId, router]);

  // Cart & Calculation States
  const cartItems = useCartStore((state) => state.cartItems);
  const [cart, setCart] = useState<CartItem[]>([]);

  const [availablePoints, setAvailablePoints] = useState(0);
  const [availableWallet, setAvailableWallet] = useState(0);
  const [couponInfoMessage, setCouponInfoMessage] = useState("");
  const [freeItemsList, setFreeItemsList] = useState<any[]>([]);

  // Toast Notifications
  const triggerToast = useToastStore((state) => state.addToast);

  // Load Initial Data
  useEffect(() => {
    setIsHydrated(true);

    // Fetch Cart from Zustand
    let savedCart: CartItem[] = [...cartItems];

    if (savedCart.length === 0) {
      router.push("/shopallshirts");
      return;
    }
    setCart(savedCart);

    const totalVal = savedCart.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
    trackBeginCheckout(totalVal, savedCart);

    // Fetch Available Perks
    const fetchPerks = async () => {
      const walletRes = await getLoyaltyAndWalletAction();
      const points = walletRes.loyaltyPoints || 0;
      const wallet = walletRes.walletBalance || 0;
      setAvailablePoints(points);
      setAvailableWallet(wallet);
    };
    fetchPerks();
  }, [cartItems]);

  // Revalidate applied coupon if cart changes
  useEffect(() => {
    if (appliedCouponCode && cart.length > 0) {
      const revalidate = async () => {
        const currentBaseTotal = cart.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
        const couponRes = await validateCouponAction(appliedCouponCode, currentBaseTotal, cart);
        const res = (couponRes.success && couponRes.res) ? couponRes.res : { valid: false };
        if (res.valid) {
          setAppliedDiscount(res.discountAmount || 0);
          setCouponInfoMessage(res.message || "");
          setFreeItemsList(res.freeItems || []);
        } else {
          setAppliedDiscount(0);
          setAppliedCouponCode("");
          setCouponMessage({ text: "", isError: false });
          setCouponInfoMessage("");
          setFreeItemsList([]);
        }
      };
      revalidate();
    } else if (cart.length === 0) {
      setCouponInfoMessage("");
      setFreeItemsList([]);
    }
  }, [cart, appliedCouponCode, setAppliedDiscount, setAppliedCouponCode, setCouponMessage]);

  // Generate fresh idempotency key on checkout page mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const newKey = window.crypto?.randomUUID ? window.crypto.randomUUID() : "ORD-" + Math.floor(Math.random() * 900000 + 100000);
      setIdempotencyKey(newKey);
    }
  }, [setIdempotencyKey]);

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

  // Load and calculate shipping
  let shippingCost = 0;
  let shippingMessage = "";
  let freeAboveAmount = 999;
  let showProgressBar = false;
  let progressPercent = 0;

  if (shippingRules) {
    const rules: ShippingRules = {
      mode: shippingRules.mode,
      flatRate: Number(shippingRules.flat_rate ?? shippingRules.flatRate ?? 99),
      freeAboveAmount: Number(shippingRules.free_above_amount ?? shippingRules.freeAboveAmount ?? 999),
      displayMessage: shippingRules.display_message ?? shippingRules.displayMessage ?? ""
    };
    freeAboveAmount = rules.freeAboveAmount;
    shippingCost = calculateShipping(discountedTotal, rules);
    shippingMessage = getShippingMessage(discountedTotal, rules);
    
    if (rules.mode === 'free_above') {
      showProgressBar = true;
      progressPercent = Math.min(100, (discountedTotal / freeAboveAmount) * 100);
    }
  }

  // Wallet calculation
  let walletDeduction = 0;
  if (walletChecked) {
    walletDeduction = Math.min(netTotal + shippingCost, availableWallet);
  }

  const finalPayable = Math.max(0, netTotal + shippingCost - walletDeduction);
  const subtotal = netTotal / 1.12;
  const gst = netTotal - subtotal;

  const groupedCartItems = React.useMemo(() => {
    const groups: { [key: string]: any } = {};
    cart.forEach((item) => {
      const key = `${item.productName}_${item.size || "M"}_${item.color || "Default"}`;
      if (!groups[key]) {
        groups[key] = {
          productId: item.productId || "",
          productName: item.productName,
          price: Number(item.price),
          size: item.size || "M",
          image: item.image,
          quantity: 0,
          color: item.color || "Default",
        };
      }
      groups[key].quantity += 1;
    });
    return Object.values(groups);
  }, [cart]);

  const discountAmount = appliedDiscount + loyaltyDiscount;
  const finalTotal = finalPayable;

  // Evaluate COD Eligibility dynamically
  useEffect(() => {
    if (isHydrated) {
      if (!globalCodEnabled) {
        setCodAllowed(false);
        setCodReason("Cash on Delivery is currently disabled.");
        if (paymentMethod === "cod") {
          setPaymentMethod("online");
        }
        return;
      }
      if (selectedAddress) {
        import("@/lib/codRules").then(({ evaluateCodRules }) => {
          const res = evaluateCodRules({
            pincode: selectedAddress.postal_code,
            orderTotal: finalPayable,
            customerEmail: user?.email || undefined
          });
          setCodAllowed(res.allowed);
          setCodReason(res.reason || "");
          if (!res.allowed && paymentMethod === "cod") {
            setPaymentMethod("online");
          }
        });
      } else {
        setCodAllowed(false);
        setCodReason("Please select a delivery address.");
        if (paymentMethod === "cod") {
          setPaymentMethod("online");
        }
      }
    }
  }, [isHydrated, selectedAddress, finalPayable, user, paymentMethod, globalCodEnabled]);

  // Coupon Code Validation
  const handleApplyCoupon = async () => {
    const code = couponCode.trim();
    if (!code) {
      setAppliedDiscount(0);
      setAppliedCouponCode("");
      setCouponMessage({ text: "", isError: false });
      setCouponInfoMessage("");
      setFreeItemsList([]);
      return;
    }

    const couponRes = await validateCouponAction(code, baseTotal, cart);
    const res = (couponRes.success && couponRes.res) ? couponRes.res : { valid: false, coupon: undefined, error: couponRes.error };

    if (res.valid && res.coupon) {
      const coupon = res.coupon;
      let disc = 0;
      if (res.discountAmount !== undefined) {
        disc = res.discountAmount;
      } else if (coupon.type === "percent") {
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
      setCouponInfoMessage(res.message || "");
      setFreeItemsList(res.freeItems || []);
      triggerToast(`Coupon ${coupon.code} applied!`);
    } else {
      setCouponMessage({
        text: (res.error || "INVALID OR EXPIRED COUPON CODE").toUpperCase(),
        isError: true,
      });
      setAppliedDiscount(0);
      setAppliedCouponCode("");
      setCouponInfoMessage("");
      setFreeItemsList([]);
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
      // Fire GA4 add_shipping_info when transitioning from Step 1 to Step 2
      trackAddShippingInfo(shippingCost, cart);
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
      if (!selectedAddress) {
        triggerToast("Please select a delivery address before confirming payment.");
        setCurrentStep(1); // send them back to address selection
        return;
      }
      
      // Track add_payment_info here!
      const finalPaymentMethod = finalPayable === 0 ? "Wallet/Points" : (paymentMethod === "cod" ? "COD" : "Razorpay");
      trackAddPaymentInfo(finalPaymentMethod, finalPayable, cart);
      
      const customerName = selectedAddress.name || "Guest";

      const utm_source = typeof window !== "undefined" ? sessionStorage.getItem("utm_source") : null;
      const utm_medium = typeof window !== "undefined" ? sessionStorage.getItem("utm_medium") : null;
      const utm_campaign = typeof window !== "undefined" ? sessionStorage.getItem("utm_campaign") : null;

      // Verify stock before any checkout actions
      const stockCheck = await verifyStockAction(cart);
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
          utm_source,
          utm_medium,
          utm_campaign,
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
        clearCartAction().catch(() => {});
        useCheckoutStore.getState().resetCheckout();

        triggerToast("Order placed successfully!");
        setTimeout(() => {
          router.push(`/orderconfirmed?orderId=${res.orderId || res.order?.id}`);
        }, 1000);
      } else if (paymentMethod === "cod") {
        // Cash on Delivery Placement
        setProcessingPayment(true);
        try {
          const res = await processCodCheckoutAction({
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
            pincode: selectedAddress?.postal_code || "",
            utm_source,
            utm_medium,
            utm_campaign,
          });

          if (!res.success) {
            triggerToast(res.error || "Failed to place COD order.");
            setProcessingPayment(false);
            return;
          }

          if (res.walletBalance !== undefined) {
            localStorage.setItem("wallet_balance", res.walletBalance.toString());
          }
          if (res.loyaltyPoints !== undefined) {
            localStorage.setItem("loyalty_points", res.loyaltyPoints.toString());
          }

          try {
            const localOrders = JSON.parse(localStorage.getItem("orders_history") || "[]");
            localOrders.unshift(res.order);
            localStorage.setItem("orders_history", JSON.stringify(localOrders));
          } catch (e) {
            console.error(e);
          }

          useCartStore.getState().clearCart();
          clearCartAction().catch(() => {});
          useCheckoutStore.getState().resetCheckout();
          triggerToast("✓ COD Order placed successfully!");
          setProcessingPayment(false);
          setTimeout(() => {
            router.push(`/orderconfirmed?orderId=${res.orderId || res.order?.id}`);
          }, 1000);

        } catch (err: any) {
          console.error("COD place order exception:", err);
          triggerToast("❌ Error occurred while placing COD order.");
          setProcessingPayment(false);
        }
      } else {
        // Forward to Razorpay API
        setProcessingPayment(true);
        
        // 1. Verify Razorpay SDK loading
        if (!(window as any).Razorpay) {
          console.error("[Razorpay SDK] window.Razorpay is not loaded");
          triggerToast("❌ Razorpay payment client is not loaded. Please wait or refresh the page.");
          setProcessingPayment(false);
          return;
        }

        try {
          const createRes = await fetch("/api/payments/create-order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
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
              utm_source,
              utm_medium,
              utm_campaign,
            })
          });
          
          const createData = await createRes.json();

          if (!createData.success) {
            console.error("[Razorpay] Order creation failed:", createData.error);
            triggerToast(`❌ Payment initialization failed: ${createData.error || "Please try again."}`);
            setProcessingPayment(false);
            return;
          }

          const key = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
          if (!key) {
            console.error('[Razorpay] NEXT_PUBLIC_RAZORPAY_KEY_ID not configured');
            triggerToast('❌ Payment system not configured. Please contact support.');
            setProcessingPayment(false);
            return;
          }

          const options = {
            key,
            amount: createData.amount,
            currency: createData.currency,
            name: "Stitch 6K",
            description: "Premium Shirts Checkout",
            image: "/assets/logo.png",
            order_id: createData.razorpayOrderId,
            handler: async function (response: any) {
              setProcessingPayment(true);
              try {
                const verifyRes = await fetch("/api/payments/verify", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "x-ga-client-id": getGA4ClientId()
                  },
                  body: JSON.stringify({
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_signature: response.razorpay_signature,
                    checkoutState: createData.checkoutState
                  })
                });
                
                const verifyData = await verifyRes.json();

                if (verifyData.success) {
                   useCartStore.getState().clearCart();
                   clearCartAction().catch(() => {});
                   useCheckoutStore.getState().resetCheckout();
                   setIdempotencyKey(typeof window !== "undefined" && window.crypto?.randomUUID ? window.crypto.randomUUID() : "ORD-" + Math.floor(Math.random() * 900000 + 100000));
                   router.push(`/orderconfirmed?orderId=${verifyData.orderId}`);
                } else {
                   setProcessingPayment(false);
                   setPaymentFailureError(verifyData.error || "Payment verification failed.");
                   setPaymentFailed(true);
                }
              } catch (e) {
                 console.error("[Razorpay] Verification network error:", e);
                 setProcessingPayment(false);
                 setPaymentFailureError("Network error during verification.");
                 setPaymentFailed(true);
              }
            },
            prefill: {
              name: customerName,
              email: user?.email || "guest@6kthebrand.com",
              contact: selectedAddress?.phone || ""
            },
            theme: {
              color: "#1d2745"
            },
            modal: {
              ondismiss: function() {
                setProcessingPayment(false);
                triggerToast("ℹ️ Payment canceled by user.");
              }
            }
          };

          const rzp1 = new (window as any).Razorpay(options);
          
          rzp1.on('payment.failed', function (response: any){
            console.error("[Razorpay] Payment failed on modal:", response.error);
            setProcessingPayment(false);
            setPaymentFailureError(response.error.description || "Payment failed.");
            setPaymentFailed(true);
          });
          
          rzp1.open();
        } catch (error: any) {
          console.error("[Razorpay] Communication error:", error);
          triggerToast(`❌ Failed to connect to payment server: ${error.message || "Please check connection."}`);
          setProcessingPayment(false);
        }
      }
    }
  };

  // Step Button Wording
  const getButtonText = () => {
    if (currentStep === 1) return "Proceed to Perks & Wallet";
    if (currentStep === 2) return "Proceed to Final Review";
    if (finalPayable === 0) return "Pay via Wallet & Points";
    return paymentMethod === "cod" ? "Place COD Order" : "Confirm & Complete Payment";
  };

  // Luxury Brand Shimmer Skeleton Loading
  if (!isHydrated || loadingUser) {
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
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      {processingPayment && <PaymentProcessingScreen />}
      {paymentFailed && (
        <PaymentFailureScreen 
          onRetry={() => {
             setPaymentFailed(false);
             handleSubmit({ preventDefault: () => {} } as React.FormEvent);
          }} 
          errorMsg={paymentFailureError} 
        />
      )}

      {/* Toast Notification handled globally now */}

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
                <Image 
                  src="/assets/logo.png" 
                  alt="6K Logo" 
                  width={44}
                  height={44}
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
              className={`flex-grow py-3.5 rounded-full transition-all duration-500 cursor-pointer ${
                currentStep === 1 
                  ? "bg-on-surface text-surface shadow-md scale-102 font-black" 
                  : "text-outline/60 hover:text-on-surface"
              }`}
              onClick={() => handleGoToStep(1)}
            >
              01. Details
            </div>
            <div
              className={`flex-grow py-3.5 rounded-full transition-all duration-500 cursor-pointer ${
                currentStep === 2 
                  ? "bg-on-surface text-surface shadow-md scale-102 font-black" 
                  : "text-outline/60 hover:text-on-surface"
              }`}
              onClick={() => handleGoToStep(2)}
            >
              02. Perks
            </div>
            <div
              className={`flex-grow py-3.5 rounded-full transition-all duration-500 ${
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
                <AddressErrorBoundary>
                  <AddressList 
                    userId={userId} 
                    onAddressSelected={handleAddressSelected} 
                    onAddressCountChange={handleAddressCountChange}
                  />
                </AddressErrorBoundary>
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
                    {couponInfoMessage && (
                      <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-3 rounded-lg text-[9px] tracking-widest uppercase font-bold mt-2">
                        {couponInfoMessage}
                      </div>
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
                  {/* Payment Option Selector */}
                  <div className="bg-white/40 border border-white/20 backdrop-blur-md p-6 sm:p-8 rounded-2xl shadow-sm relative space-y-4">
                    <h4 className="text-[10px] font-black tracking-widest uppercase text-secondary">Select Payment Option</h4>
                    
                    {/* COD Notice Banner */}
                    {!codAllowed && (
                      <div className="bg-[#faf5e8] border border-[#e8d08a] p-4 text-[10px] uppercase tracking-wider font-semibold text-[#7a5c00] leading-relaxed">
                        Prepaid Orders Only — Cash on Delivery (COD) is not available. All payments are securely processed through Razorpay, and orders are shipped via trusted courier partners powered by Shiprocket after successful payment confirmation.
                      </div>
                    )}

                    <div className="flex flex-col gap-4">
                      {/* Online Payment Option */}
                      <label className={`flex items-center gap-3 cursor-pointer border p-4 transition-all ${paymentMethod === "online" ? "border-secondary bg-secondary/5" : "border-outline-variant/20 bg-transparent"}`}>
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="online"
                          checked={paymentMethod === "online"}
                          onChange={() => setPaymentMethod("online")}
                          className="text-secondary border-outline-variant/40 focus:ring-0 focus:ring-offset-0 rounded-none bg-transparent"
                        />
                        <div className="flex flex-col text-left">
                          <span className="text-[10px] font-black uppercase tracking-widest text-on-surface">Online Payment (UPI, Cards, NetBanking)</span>
                          <span className="text-[8px] text-outline uppercase tracking-wider font-semibold mt-0.5">Pay via Razorpay Secure Gateway (Recommended)</span>
                        </div>
                      </label>

                      {/* Cash on Delivery Option */}
                      {globalCodEnabled && (
                        <label className={`flex items-center gap-3 border p-4 transition-all ${!codAllowed ? "opacity-50 cursor-not-allowed bg-neutral-100/10" : "cursor-pointer"} ${paymentMethod === "cod" ? "border-secondary bg-secondary/5" : "border-outline-variant/20 bg-transparent"}`}>
                          <input
                            type="radio"
                            name="paymentMethod"
                            value="cod"
                            disabled={!codAllowed}
                            checked={paymentMethod === "cod"}
                            onChange={() => setPaymentMethod("cod")}
                            className="text-secondary border-outline-variant/40 focus:ring-0 focus:ring-offset-0 rounded-none bg-transparent"
                          />
                          <div className="flex flex-col text-left">
                            <span className="text-[10px] font-black uppercase tracking-widest text-on-surface">Cash on Delivery (COD)</span>
                            <span className="text-[8px] text-outline uppercase tracking-wider font-semibold mt-0.5">
                              {codAllowed ? "Pay cash at your doorstep" : `COD Unavailable: ${codReason}`}
                            </span>
                          </div>
                        </label>
                      )}
                    </div>
                  </div>

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
                        <span className="font-bold text-on-surface">{selectedAddress?.phone}</span> | <span className="text-on-surface">{user?.email || "guest@6kthebrand.com"}</span>
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
                  <h3 style={{
                    fontSize: '13px',
                    fontWeight: '500',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    marginBottom: '1rem',
                    color: '#1a1a1a'
                  }}>
                    ORDER SUMMARY
                  </h3>

                  {/* Cart items list */}
                  {groupedCartItems.map(item => (
                    <div key={item.productId + item.size}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: '8px',
                        fontSize: '13px'
                      }}
                    >
                      <span style={{ color: '#6b7280' }}>
                        {item.productName} × {item.quantity}
                        <br />
                        <span style={{ fontSize: '11px' }}>
                          {item.size} / {item.color || "Default"}
                        </span>
                      </span>
                      <span>₹{(item.price * (item.quantity || 1)).toFixed(2)}</span>
                    </div>
                  ))}

                  <div style={{ 
                    borderTop: '1px solid #e5e5e5',
                    marginTop: '12px',
                    paddingTop: '12px'
                  }} />

                  {/* Subtotal */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '13px',
                    marginBottom: '8px'
                  }}>
                    <span style={{ color: '#6b7280' }}>
                      SUBTOTAL
                    </span>
                    <span>₹{baseTotal.toFixed(2)}</span>
                  </div>

                  {/* Discount if applied */}
                  {discountAmount > 0 && (
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '13px',
                      marginBottom: '8px',
                      color: '#16a34a'
                    }}>
                      <span>DISCOUNT</span>
                      <span>-₹{discountAmount.toFixed(2)}</span>
                    </div>
                  )}

                  {/* Shipping */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '13px',
                    marginBottom: '12px'
                  }}>
                    <span style={{ color: '#6b7280' }}>
                      SHIPPING
                    </span>
                    <span style={{ color: '#16a34a' }}>
                      {shippingCost === 0 ? 'FREE' : `₹${shippingCost}`}
                    </span>
                  </div>

                  {/* Wallet Paid if applied */}
                  {walletChecked && walletDeduction > 0 && (
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '13px',
                      marginBottom: '8px',
                      color: '#16a34a'
                    }}>
                      <span>WALLET PAID</span>
                      <span>-₹{walletDeduction.toFixed(2)}</span>
                    </div>
                  )}

                  {/* DO NOT show GST row */}
                  {/* GST is calculated internally but not shown to customer */}

                  <div style={{ 
                    borderTop: '1px solid #1a1a1a',
                    marginTop: '4px',
                    paddingTop: '12px'
                  }} />

                  {/* Final Total */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#BA7517',
                    marginBottom: '12px'
                  }}>
                    <span>FINAL PAYABLE</span>
                    <span>₹{finalTotal.toFixed(2)}</span>
                  </div>

                  {/* GST inclusive note */}
                  <div style={{
                    background: '#f9f9f9',
                    border: '0.5px solid #e5e5e5',
                    borderRadius: '4px',
                    padding: '8px 12px',
                    marginTop: '4px'
                  }}>
                    <p style={{
                      fontSize: '11px',
                      color: '#6b7280',
                      margin: 0,
                      lineHeight: 1.6
                    }}>
                      ✓ Prices are inclusive of GST.
                      <br />
                      ✓ Free shipping on all orders.
                    </p>
                  </div>

                  {currentStep === 1 && !selectedAddress && (
                    <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 text-red-600 rounded-xl text-[10px] font-bold uppercase tracking-wider text-center animate-fade-in flex items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-sm font-black">info</span>
                      {addressCount === 0 
                        ? "Please add a delivery address to proceed." 
                        : "Please select a delivery address to proceed."}
                    </div>
                  )}

                  {/* Primary Action Button */}
                  <button
                    onClick={handleSubmit}
                    disabled={currentStep === 1 && !selectedAddress}
                    className={`w-full py-4 font-headline font-black text-xs tracking-[0.25em] uppercase transition-all duration-500 ease-out rounded-xl shadow-lg active:scale-[0.98] flex items-center justify-center gap-3 mt-4 ${
                      currentStep === 1 && !selectedAddress
                        ? "bg-gray-300 text-gray-500 cursor-not-allowed opacity-60 shadow-none border border-gray-200"
                        : "bg-[#775a19] text-white hover:bg-[#fed488] hover:text-primary hover:shadow-[0_10px_25px_rgba(254,212,136,0.15)] hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                    }`}
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
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface/95 backdrop-blur-2xl border-t border-outline-variant/15 p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] flex flex-col gap-3 shadow-[0_-8px_32px_rgba(0,0,0,0.15)]">
        <div className="flex justify-between items-center text-xs tracking-widest uppercase font-black px-2">
          <span className="text-outline">Final Payable</span>
          <span className="text-[#fed488] text-sm">₹ {finalPayable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
        </div>
        {currentStep === 1 && !selectedAddress && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 rounded-lg text-[9px] font-bold uppercase tracking-widest text-center animate-fade-in flex items-center justify-center gap-1.5">
            <span className="material-symbols-outlined text-xs font-black">info</span>
            {addressCount === 0 
              ? "Please add a delivery address to proceed." 
              : "Please select a delivery address to proceed."}
          </div>
        )}
        <button
          onClick={handleSubmit}
          disabled={currentStep === 1 && !selectedAddress}
          className={`w-full py-4 font-headline font-black text-[10px] tracking-[0.2em] uppercase transition-all duration-300 rounded-xl flex items-center justify-center gap-2 shadow-md ${
            currentStep === 1 && !selectedAddress
              ? "bg-gray-300 text-gray-500 cursor-not-allowed opacity-60 shadow-none border border-gray-200"
              : "bg-[#775a19] text-white hover:bg-[#fed488] hover:text-primary active:scale-95 cursor-pointer"
          }`}
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
                <Image 
                    src="/assets/logo.png" 
                    alt="6K Logo" 
                    width={32}
                    height={32}
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
              <p className="text-[9px] font-bold uppercase tracking-widest text-white/50 mb-4">Follow us on Instagram for updates</p>
              <div className="flex items-center gap-4 mt-2">
                <a
                  href="https://instagram.com/6kthebrand"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-white/60 hover:text-secondary transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                  Instagram
                </a>
                <a
                  href="https://facebook.com/6kthebrand"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-white/60 hover:text-secondary transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                  Facebook
                </a>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10 pt-10 border-t border-white/10">
            <div className="col-span-1 md:col-span-2">
              <h4 className="text-[9px] font-black uppercase tracking-[0.3em] mb-4 text-white/40">Our Atelier</h4>
              <p className="text-[10px] font-light uppercase tracking-widest text-white/80 leading-loose flex items-start gap-4">
                <span className="material-symbols-outlined text-secondary mt-1">location_on</span>
                <span>
                  JRT TEXTILES (6K Brand)<br />
                  1st Floor, 66/D, 1st Cross, Devar Colony, Thillai Nagar<br />
                  Tiruchirappalli – 620018, Tamil Nadu<br />
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
                <li><Link href="/about" className="hover:text-white transition-colors">About Us</Link></li>
                <li><Link href="/terms" className="hover:text-white transition-colors">Terms &amp; Conditions</Link></li>
                <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
                <li><Link href="/payment-policy" className="hover:text-white transition-colors">Payment Policy</Link></li>
                <li><Link href="/shipping-policy" className="hover:text-white transition-colors">Shipping &amp; Delivery Policy</Link></li>
                <li><Link href="/refund-policy" className="hover:text-white transition-colors">Refund Policy</Link></li>
                <li><Link href="/cancellation-policy" className="hover:text-white transition-colors">Cancellation Policy</Link></li>
                <li><Link href="/return-policy" className="hover:text-white transition-colors">Return &amp; Exchange Policy</Link></li>
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
