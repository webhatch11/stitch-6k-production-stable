"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation";
import { Order, Product } from "@/lib/registry";
import { db } from "@/lib/db";

function OrderTrackingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderIdParam = searchParams.get("orderId");

  const [searchOrderId, setSearchOrderId] = useState("");
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);

  // Layout View State: 'search' | 'loading' | 'dashboard' | 'error'
  const [viewState, setViewState] = useState<"search" | "loading" | "dashboard" | "error">("search");
  const [loadingStatusText, setLoadingStatusText] = useState("Establishing connection to Shiprocket routing nodes...");

  // Data States
  const [matchedOrder, setMatchedOrder] = useState<Order | null>(null);
  const [matchedProduct, setMatchedProduct] = useState<Product | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);

  useEffect(() => {
    loadRecentOrders();

    if (orderIdParam) {
      handleSearchOrder(orderIdParam);
    } else {
      setViewState("search");
    }
  }, [orderIdParam]);

  const loadRecentOrders = async () => {
    // Show up to 3 recent orders
    const orders = await db.getOrders();
    setRecentOrders(orders.slice(0, 3));
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchOrderId.trim()) {
      router.push(`/ordertracking?orderId=${searchOrderId.trim()}`);
    }
  };

  const handleSearchOrder = (orderId: string) => {
    setActiveOrderId(orderId);
    setViewState("loading");

    // Message loops
    const messages = [
      "Establishing connection to Shiprocket routing nodes...",
      "Authenticating Waybill with Xpress logistics...",
      "Downloading transit logs and ETA estimations...",
      "Resolving delivery agent profile...",
    ];

    let msgIndex = 0;
    setLoadingStatusText(messages[0]);

    const msgInterval = setInterval(() => {
      msgIndex = (msgIndex + 1) % messages.length;
      setLoadingStatusText(messages[msgIndex]);
    }, 200);

    setTimeout(async () => {
      clearInterval(msgInterval);

      // Search registry
      const ordersList = await db.getOrders();
      const order = ordersList.find((o) => o.id.toUpperCase() === orderId.toUpperCase());

      if (!order) {
        setViewState("error");
        return;
      }

      // Found order!
      setMatchedOrder(order);

      // Search matching product
      const products = await db.getProducts();
      const product = products.find((p) => p.title.toLowerCase() === order.items[0].toLowerCase());
      setMatchedProduct(product || null);

      setViewState("dashboard");
    }, 800);
  };

  const clearTracking = () => {
    setSearchOrderId("");
    setActiveOrderId(null);
    setMatchedOrder(null);
    setMatchedProduct(null);
    router.push("/ordertracking");
  };

  // Helper date utilities
  const getOrderDate = (dateStr: string): Date => {
    if (!dateStr) return new Date();
    let d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d;

    const parts = dateStr.split(/[\/\-]/);
    if (parts.length === 3) {
      const p0 = parseInt(parts[0]);
      const p1 = parseInt(parts[1]);
      const p2 = parseInt(parts[2]);
      if (p1 > 12) {
        return new Date(p2, p0 - 1, p1);
      }
      return new Date(p2, p1 - 1, p0);
    }
    return new Date();
  };

  const formatTimelineDate = (date: Date, daysOffset = 0, timeStr = ""): string => {
    const d = new Date(date);
    d.setDate(d.getDate() + daysOffset);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const formattedDate = `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
    return timeStr ? `${formattedDate} • ${timeStr}` : formattedDate;
  };

  // Generate dynamic progress milestones list based on order status
  const getTimelineMilestones = (order: Order) => {
    const orderDate = getOrderDate(order.date);
    const milestones = [];

    // Milestone 1: Placed
    milestones.push({
      title: "Order Placed & Confirmed",
      dateStr: formatTimelineDate(orderDate, 0, "10:00 AM"),
      desc: "Your order has been verified and registered. Materials prepared for weaving.",
      icon: "inventory_2",
      active: true,
    });

    const isShipped = order.status === "Shipped";
    const isDelivered = order.status === "Delivered";
    const isReturned = order.status === "Returned";
    const isReturnTransit = order.status === "Return in Transit";
    const isReturnReq = order.status === "Return Requested";

    // Milestone 2: Dispatch
    milestones.push({
      title: "Workshop Dispatch",
      dateStr: formatTimelineDate(orderDate, 1, "08:30 AM"),
      desc: "Package dispatched from Varanasi Workshop in custom luxury packing and handed to Shiprocket courier partner.",
      icon: "local_shipping",
      active: isShipped || isDelivered || isReturned || isReturnTransit || isReturnReq,
    });

    // Milestone 3: Sorting
    milestones.push({
      title: "Arrived at Sorting Facility",
      dateStr: formatTimelineDate(orderDate, 2, "04:15 PM"),
      desc: "Processed through Shiprocket automated routing at Bengaluru West Hub. Handover confirmed.",
      icon: "hub",
      active: isShipped || isDelivered || isReturned || isReturnTransit || isReturnReq,
    });

    // Milestone 4: Out for Delivery
    milestones.push({
      title: "Out for Delivery",
      dateStr: formatTimelineDate(orderDate, 3, "09:00 AM"),
      desc: "Shiprocket delivery agent Sunil K. (+91 90876 XXXXX) is out for delivery to your address.",
      icon: "hail",
      active: isDelivered || isReturned || isReturnTransit || isReturnReq,
    });

    // Milestone 5: Handed over
    milestones.push({
      title: "Package Handed Over",
      dateStr: formatTimelineDate(orderDate, 3, "02:30 PM"),
      desc: "Delivered. Secure handover verified by signature receipt.",
      icon: "check_circle",
      active: isDelivered || isReturned || isReturnTransit || isReturnReq,
    });

    // Return milestones
    if (isReturnReq || isReturnTransit || isReturned) {
      const returnReqDate = order.returnRequestDate || formatTimelineDate(new Date(), 0, "11:00 AM");
      milestones.push({
        title: "Return Request Registered",
        dateStr: returnReqDate,
        desc: `Reason: "${order.returnReason || "Size issues"}". Proof Image: ${order.returnImage || "None"}. Awaiting authorization.`,
        icon: "assignment_return",
        active: true,
        isReturn: true,
      });
    }

    if (isReturnTransit || isReturned) {
      milestones.push({
        title: "Return Shipment Dispatched",
        dateStr: formatTimelineDate(new Date(), 0, "03:45 PM"),
        desc: "Reverse logistics partner agent has collected the package. Transit sorting to Varanasi Workshop in progress.",
        icon: "local_shipping",
        active: true,
        isReturn: true,
      });
    }

    if (isReturned) {
      milestones.push({
        title: "Return Processed & Refunded",
        dateStr: order.returnDate || formatTimelineDate(new Date(), 0, "05:00 PM"),
        desc: `Refund credited back to ${order.refundOption === "wallet" ? "Store Wallet" : "Original Payment Method"}. Restocked in workshop inventory.`,
        icon: "account_balance_wallet",
        active: true,
        isReturn: true,
      });
    }

    return milestones;
  };

  const getExpectedDateText = (order: Order) => {
    const parsedDate = getOrderDate(order.date);
    let daysToAdd = 5;
    if (order.status === "Delivered") daysToAdd = 3;
    else if (order.status === "Returned" || order.status === "Return Rejected") daysToAdd = 4;
    return formatTimelineDate(parsedDate, daysToAdd).toUpperCase();
  };

  return (
    <>
      {/* Main Track Station */}
      <main className="max-w-7xl mx-auto px-6 py-12 lg:py-24 flex-grow w-full">
        {/* VIEW 1: SEARCH PAGE */}
        {viewState === "search" && (
          <div className="animate-fade-in">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center mb-24">
              <div className="lg:col-span-6 flex flex-col justify-center">
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-secondary">Logistics Tracking</span>
                <h1 className="font-headline text-5xl lg:text-7xl font-black tracking-tighter text-on-surface uppercase mt-4 leading-[1.1] mb-6">
                  Track Your<br />
                  <span className="text-gold-gradient font-black">Shipment</span>
                </h1>
                <p className="text-xs font-semibold text-outline uppercase tracking-widest leading-relaxed max-w-md">
                  Verify real-time status and Shiprocket transit history for your custom atelier orders.
                </p>
              </div>

              <div className="lg:col-span-6">
                <div className="bg-[#0a0a0a] text-surface p-8 lg:p-12 relative overflow-hidden border border-white/10 shadow-2xl hover:shadow-[0_0_50px_rgba(254,212,136,0.12)] transition-all duration-500 hover:border-accent/20 group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/15 -translate-y-16 translate-x-16 rounded-full blur-3xl group-hover:bg-accent/20 transition-all duration-700"></div>
                  <h3 className="font-headline text-lg font-black uppercase tracking-widest text-white mb-8">Track Order</h3>
                  <form onSubmit={handleSearchSubmit} className="space-y-6">
                    <div className="relative border-b border-white/20 focus-within:border-accent transition-colors pb-2">
                      <label htmlFor="orderIdInput" className="block text-[9px] font-black uppercase tracking-[0.2em] text-white/50 mb-2">Order ID</label>
                      <input
                        type="text"
                        id="orderIdInput"
                        placeholder="e.g., ORD-101"
                        required
                        value={searchOrderId}
                        onChange={(e) => setSearchOrderId(e.target.value)}
                        className="bg-transparent border-none outline-none focus:ring-0 w-full text-sm font-black uppercase tracking-widest text-white placeholder-white/20 py-2 px-0 rounded-none"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full bg-secondary-container text-on-secondary-container py-4.5 text-xs font-black uppercase tracking-[0.3em] hover:bg-white hover:text-primary transition-all duration-300 flex items-center justify-center gap-3"
                    >
                      <span>Track</span>
                      <span className="material-symbols-outlined text-sm">local_shipping</span>
                    </button>
                  </form>
                </div>
              </div>
            </div>

            {/* Recent Orders List */}
            {recentOrders.length > 0 && (
              <section className="border-t border-outline-variant/30 pt-16">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-12">
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-[0.3em] text-secondary mb-2 block">Recent Activity</span>
                    <h3 className="font-headline text-3xl font-black uppercase tracking-tight">Recent Shipments</h3>
                  </div>
                  <p className="text-[10px] text-outline font-bold uppercase tracking-widest italic opacity-75">Auto-saved Locally</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {recentOrders.map((order) => (
                    <div
                      key={order.id}
                      onClick={() => router.push(`/ordertracking?orderId=${order.id}`)}
                      className="bg-white border border-outline-variant/10 p-6 flex flex-col justify-between hover:border-secondary transition-all cursor-pointer group shadow-sm hover:shadow-md"
                    >
                      <div>
                        <div className="flex justify-between items-center mb-4">
                          <span className="font-headline font-black text-sm tracking-tight text-on-surface">#{order.id}</span>
                          <span className="inline-block px-2 py-0.5 border border-outline-variant/20 bg-surface-container-low text-[8px] font-black uppercase tracking-widest text-outline">
                            {order.status}
                          </span>
                        </div>
                        <p className="text-xs font-bold uppercase tracking-wide truncate">{order.items[0]}</p>
                        <p className="text-[10px] text-outline mt-1 font-semibold uppercase tracking-wider">{order.date}</p>
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-secondary mt-6 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                        Verify Shipment <span className="material-symbols-outlined text-xs">arrow_forward</span>
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* VIEW 2: LOADING CONNECTION */}
        {viewState === "loading" && (
          <div className="min-h-[50vh] flex flex-col items-center justify-center py-12 animate-pulse">
            <div className="flex flex-col items-center max-w-md text-center p-8 bg-surface-container-low border border-outline-variant/10 relative">
              <div className="size-20 text-secondary mb-6 relative flex items-center justify-center">
                <svg className="w-16 h-16 animate-spin" fill="none" viewBox="0 0 48 48">
                  <path d="M24 6L40 34H8L24 6Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center font-headline text-lg font-black tracking-tighter">6K</div>
              </div>
              <h3 className="font-headline text-lg font-black uppercase tracking-tight text-on-surface mb-2">Connecting to Shiprocket</h3>
              <p className="text-[10px] text-outline font-bold uppercase tracking-widest leading-relaxed mb-4">
                {loadingStatusText}
              </p>
              <div className="w-48 h-1 bg-outline-variant/20 overflow-hidden relative">
                <div className="absolute top-0 bottom-0 left-0 bg-secondary w-1/3 animate-ping"></div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 3: TRACKING DASHBOARD */}
        {viewState === "dashboard" && matchedOrder && (
          <div className="animate-fade-in">
            <section className="mb-12">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pb-8 border-b border-on-surface/10">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-[0.4em] text-secondary">Logistics Support</span>
                  <h1 className="font-headline text-4xl lg:text-5xl font-black tracking-tighter text-on-surface uppercase mt-2">
                    Order Tracking
                  </h1>
                  <p className="text-xs font-bold text-outline uppercase tracking-widest mt-2">
                    Order Reference: <span className="text-on-surface font-black font-mono">#{matchedOrder.id}</span>
                  </p>
                </div>
                <div className="flex flex-col items-start md:items-end gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-outline">Expected Delivery</p>
                  <p className="font-headline text-2xl font-black text-on-surface">
                    {getExpectedDateText(matchedOrder)}
                  </p>
                  <button
                    onClick={clearTracking}
                    className="mt-2 text-[9px] font-black uppercase tracking-widest text-secondary hover:text-on-surface flex items-center gap-1 group transition-colors bg-transparent"
                  >
                    <span className="material-symbols-outlined text-sm group-hover:-translate-x-0.5 transition-transform">arrow_back</span>
                    Track Another Order
                  </button>
                </div>
              </div>
            </section>

            {/* Info Metrics Board */}
            <section className="mb-16">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-outline-variant/20 border border-outline-variant/10 shadow-sm">
                <div className="bg-surface-container-low p-6">
                  <p className="text-[9px] font-black uppercase tracking-widest text-outline mb-1">Status</p>
                  <div className="flex items-center gap-2">
                    <span
                      className={`size-2 rounded-full ${
                        matchedOrder.status === "Delivered"
                          ? "bg-green-500"
                          : matchedOrder.status === "Returned" || matchedOrder.status === "Return Rejected"
                          ? "bg-red-500"
                          : "bg-amber-500"
                      }`}
                    ></span>
                    <span className="text-xs font-bold uppercase tracking-widest">{matchedOrder.status}</span>
                  </div>
                </div>
                <div className="bg-surface-container-low p-6">
                  <p className="text-[9px] font-black uppercase tracking-widest text-outline mb-1">Logistics Partner</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-widest">SR-Xpress</span>
                  </div>
                </div>
                <div className="bg-surface-container-low p-6">
                  <p className="text-[9px] font-black uppercase tracking-widest text-outline mb-1">Waybill Number</p>
                  <span className="text-xs font-bold font-mono tracking-tight">
                    SR772{matchedOrder.id.replace(/\D/g, "") || "4022"}
                  </span>
                </div>
                <div className="bg-surface-container-low p-6">
                  <p className="text-[9px] font-black uppercase tracking-widest text-outline mb-1">Priority Tier</p>
                  <span className="text-xs font-bold uppercase text-secondary">Premium Express</span>
                </div>
              </div>
            </section>

            {/* Timeline & Details columns */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
              {/* Left Column: Milestones vertical path */}
              <div className="lg:col-span-7 space-y-12">
                <div className="space-y-10">
                  <h2 className="font-headline text-xs font-black uppercase tracking-[0.4em] border-l-4 border-secondary pl-6">Tracking History</h2>
                  
                  <div className="relative pl-10 space-y-16">
                    {/* Vertical Connector Line */}
                    <div className="absolute left-[24px] top-2 bottom-2 w-[1px] bg-outline-variant/30 overflow-hidden">
                      <div className="absolute left-0 w-full h-20 bg-gradient-to-b from-transparent via-[#fed488] to-transparent animate-[line-flow_4s_infinite_linear]"></div>
                    </div>

                    {getTimelineMilestones(matchedOrder).map((milestone, idx) => (
                      <div key={idx} className={`relative flex gap-8 items-start transition-opacity ${milestone.active ? "opacity-100" : "opacity-35"}`}>
                        {/* Circle Badge Indicator */}
                        <div
                          className={`absolute -left-[24px] size-12 -translate-x-1/2 flex items-center justify-center border bg-white ${
                            milestone.active ? "border-secondary text-secondary" : "border-outline-variant/35 text-outline/35"
                          }`}
                        >
                          <span className="material-symbols-outlined text-lg">{milestone.icon}</span>
                        </div>

                        <div className="pl-6">
                          <span className="text-[9px] font-bold text-outline uppercase tracking-wider block">{milestone.dateStr}</span>
                          <h4 className="font-headline font-black text-lg uppercase tracking-tight mt-1">{milestone.title}</h4>
                          <p className="text-sm text-outline mt-2 leading-relaxed font-medium">{milestone.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: Address and Product Cards */}
              <div className="lg:col-span-5 space-y-12">
                <div className="bg-white p-8 border border-outline-variant/10 shadow-sm">
                  <h3 className="font-headline text-[10px] font-black uppercase tracking-[0.4em] mb-8">Order Details</h3>
                  <div className="flex gap-6 items-start">
                    <div className="w-20 h-28 bg-surface-container overflow-hidden flex-shrink-0 relative border border-outline-variant/15">
                      <Image
                        src={matchedProduct?.image || "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&q=80&w=200"}
                        className="object-cover"
                        alt={matchedOrder.items[0]}
                        fill
                        sizes="80px"
                      />
                    </div>
                    <div>
                      <h4 className="font-headline font-black text-xl uppercase tracking-tighter">{matchedOrder.items[0]}</h4>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-outline mt-1">
                        {matchedProduct?.category || "Custom Series"} • Reserve
                      </p>
                      <p className="font-headline font-black text-xl mt-4 text-on-surface">₹{matchedOrder.total.toLocaleString("en-IN")}</p>
                    </div>
                  </div>
                  {matchedOrder.shiprocketId && (
                    <div className="mt-6 pt-6 border-t border-outline-variant/20 flex flex-col gap-2">
                      <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                        <span className="text-outline">Courier Partner</span>
                        <span className="text-on-surface">Shiprocket Express</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                        <span className="text-outline">AWB Waybill</span>
                        <span className="text-on-surface font-mono select-all bg-surface-container-low px-2 py-1 border border-outline-variant/10">{matchedOrder.shiprocketId}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-6">
                  <h3 className="font-headline text-[10px] font-black uppercase tracking-[0.4em]">Delivery Address</h3>
                  <div className="p-8 bg-surface-container-low border border-outline-variant/5">
                    <p className="font-headline font-black text-xl uppercase tracking-tighter mb-4">{matchedOrder.customer}</p>
                    <p className="text-sm text-on-surface-variant leading-relaxed font-medium">
                      Apt 402, Sky-High Residency<br />
                      7th Main, Sector 4, HSR Layout<br />
                      Bengaluru, Karnataka 560102<br />
                      India
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 4: ERROR PAGE */}
        {viewState === "error" && (
          <div className="min-h-[50vh] flex flex-col items-center justify-center py-12 text-center animate-fade-in">
            <div className="flex flex-col items-center max-w-md mx-auto p-8 bg-surface-container-low border border-outline-variant/10">
              <div className="size-20 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20 mb-6 text-red-600">
                <span className="material-symbols-outlined text-4xl">warning</span>
              </div>
              <h3 className="font-headline text-lg font-black uppercase tracking-tight text-on-surface mb-2">Shipment Not Found</h3>
              <p className="text-xs text-outline leading-relaxed uppercase tracking-wider font-semibold opacity-70 mb-8">
                We couldn't locate tracking details for order reference <span className="text-on-surface font-bold font-mono">#{activeOrderId}</span>. Please check the order reference number and try again.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 w-full">
                <button
                  onClick={clearTracking}
                  className="flex-1 bg-on-surface hover:bg-secondary text-surface hover:text-white py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all border border-on-surface/10 font-bold"
                >
                  Back to Search
                </button>
                <Link
                  href="/orderhistory"
                  className="flex-1 border border-outline-variant/60 text-outline hover:text-on-surface py-4 text-[10px] font-black tracking-[0.2em] uppercase hover:bg-surface-container-low transition-all text-center flex items-center justify-center"
                >
                  View History
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}

export default function OrderTrackingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-secondary"></div>
      </div>
    }>
      <OrderTrackingContent />
    </Suspense>
  );
}
