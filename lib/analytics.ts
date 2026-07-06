declare global {
  interface Window {
    gtag: Function;
    fbq: Function;
    dataLayer: any[];
  }
}

// Push to dataLayer (works with GTM)
export const pushEvent = (event: string, data?: Record<string, any>) => {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event, ...data });
};

// GA4 direct event (fallback)
export const trackGA4Event = (eventName: string, params?: Record<string, any>) => {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", eventName, params);
  }
};

// Meta Pixel event
export const trackMetaEvent = (eventName: string, params?: Record<string, any>) => {
  if (typeof window !== "undefined" && window.fbq) {
    window.fbq("track", eventName, params);
  }
};

// Combined tracker — fires all platforms
export const trackEvent = (eventName: string, params?: Record<string, any>) => {
  pushEvent(eventName, params);
  trackGA4Event(eventName, params);
};

// E-commerce specific events
export const trackAddToCart = (item: {
  productName: string;
  productId: string;
  price: number;
  size: string;
  color: string;
}) => {
  const data = {
    currency: "INR",
    value: item.price,
    items: [
      {
        item_id: item.productId,
        item_name: item.productName,
        price: item.price,
        item_variant: `${item.size}/${item.color}`,
        quantity: 1,
      },
    ],
  };
  trackEvent("add_to_cart", data);
  trackMetaEvent("AddToCart", {
    content_ids: [item.productId],
    content_name: item.productName,
    value: item.price,
    currency: "INR",
  });
};

export const trackViewProduct = (item: {
  productId: string;
  productName: string;
  price: number;
  category: string;
}) => {
  trackEvent("view_item", {
    currency: "INR",
    value: item.price,
    items: [
      {
        item_id: item.productId,
        item_name: item.productName,
        item_category: item.category,
        price: item.price,
      },
    ],
  });
  trackMetaEvent("ViewContent", {
    content_ids: [item.productId],
    content_name: item.productName,
    value: item.price,
    currency: "INR",
  });
};

export const trackBeginCheckout = (total: number, itemCount: number) => {
  trackEvent("begin_checkout", {
    currency: "INR",
    value: total,
    num_items: itemCount,
  });
  trackMetaEvent("InitiateCheckout", {
    value: total,
    currency: "INR",
    num_items: itemCount,
  });
};

export const trackPurchase = (order: {
  orderId: string;
  total: number;
  items: any[];
  couponCode?: string;
}) => {
  trackEvent("purchase", {
    transaction_id: order.orderId,
    currency: "INR",
    value: order.total,
    coupon: order.couponCode,
    items: order.items.map((item) => ({
      item_id: item.productId || item.product_id || order.orderId,
      item_name: item.productName || item.title || item.name || "Apparel Item",
      price: item.price || order.total,
      quantity: item.quantity || item.qty || 1,
    })),
  });
  trackMetaEvent("Purchase", {
    value: order.total,
    currency: "INR",
    content_ids: order.items.map((i) => i.productId || i.product_id || order.orderId),
  });

  // Google Ads conversion
  if (typeof window !== "undefined" && window.gtag) {
    const ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
    const ADS_LABEL = process.env.NEXT_PUBLIC_GOOGLE_ADS_LABEL;
    if (ADS_ID && ADS_LABEL && ADS_ID !== "AW-XXXXXXXXXX") {
      window.gtag("event", "conversion", {
        send_to: `${ADS_ID}/${ADS_LABEL}`,
        value: order.total,
        currency: "INR",
        transaction_id: order.orderId,
      });
    }
  }
};

export const trackLogin = () => {
  trackEvent("login", { method: "OTP" });
  trackMetaEvent("Lead");
};

export const trackSignUp = () => {
  trackEvent("sign_up", { method: "OTP" });
  trackMetaEvent("CompleteRegistration");
};

export const trackSearch = (query: string) => {
  trackEvent("search", { search_term: query });
  trackMetaEvent("Search", {
    search_string: query,
  });
};
