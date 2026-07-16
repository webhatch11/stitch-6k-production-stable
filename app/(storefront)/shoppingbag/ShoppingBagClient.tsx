"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import ProductImage from "@/components/ProductImage";
import { useRouter } from "next/navigation";
import { Product } from "@/lib/types";
import { useCartStore } from "@/stores/cartStore";
import { trackRemoveFromCart } from "@/lib/analytics";

interface GroupedCartItem {
  productId?: string;
  productName: string;
  price: number;
  size: string;
  image: string;
  quantity: number;
  color?: string;
}

interface ShoppingBagClientProps {
  initialProducts: Product[];
}

export default function ShoppingBagClient({ initialProducts }: ShoppingBagClientProps) {
  const router = useRouter();
  const cartItems = useCartStore((state) => state.cartItems);
  const [products] = useState<Product[]>(initialProducts);
  const [isClient, setIsClient] = useState(false);
  const [toastText, setToastText] = useState("");
  const [showToast, setShowToast] = useState(false);

  const triggerToast = (msg: string) => {
    setToastText(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3500);
  };

  const subtotal = cartItems.reduce((sum, item) => sum + item.price, 0);
  const total = subtotal;

  useEffect(() => {
    setIsClient(true);
  }, []);

  const groupedItems = React.useMemo(() => {
    const groups: { [key: string]: GroupedCartItem } = {};
    cartItems.forEach((item) => {
      const key = `${item.productName}_${item.size || "M"}_${item.color || "Default"}`;
      if (!groups[key]) {
        groups[key] = {
          productId: item.productId,
          productName: item.productName,
          price: item.price,
          size: item.size || "M",
          image: item.image,
          quantity: 0,
          color: item.color || "Default",
        };
      }
      groups[key].quantity += 1;
    });
    return Object.values(groups);
  }, [cartItems]);

  const handleIncrement = (item: GroupedCartItem) => {
    // Look up the variant stock level in catalog
    const dbProduct = products.find(
      (p) => p.title.toLowerCase() === item.productName.toLowerCase()
    );
    if (dbProduct && dbProduct.sizeStock) {
      const availableStock = dbProduct.sizeStock[item.size as keyof typeof dbProduct.sizeStock] || 0;
      if (item.quantity >= availableStock) {
        triggerToast(`Only ${availableStock} units of ${item.productName} in size ${item.size} are available.`);
        return;
      }
    }

    useCartStore.getState().addToCart({
      productId: item.productId,
      productName: item.productName,
      price: item.price,
      size: item.size,
      image: item.image,
      color: item.color || "Default",
    }, 1);
  };

  const handleDecrement = (item: GroupedCartItem) => {
    const dbProduct = products.find(
      (p) => p.title.toLowerCase() === item.productName.toLowerCase()
    );
    const productId = item.productId || dbProduct?.id || "";

    trackRemoveFromCart({
      productId: productId,
      productName: item.productName,
      price: item.price,
      size: item.size,
      color: item.color || "Default",
      quantity: 1,
    });
    useCartStore.getState().decrementQuantity(item.productName, item.size, item.color || "Default");
  };

  const handleRemove = (item: GroupedCartItem) => {
    const dbProduct = products.find(
      (p) => p.title.toLowerCase() === item.productName.toLowerCase()
    );
    const productId = item.productId || dbProduct?.id || "";

    trackRemoveFromCart({
      productId: productId,
      productName: item.productName,
      price: item.price,
      size: item.size,
      color: item.color || "Default",
      quantity: item.quantity,
    });
    useCartStore.getState().removeFromCart(item.productName, item.size, item.color || "Default");
  };

  return (
    <>
      {showToast && (
        <div className="fixed top-6 right-6 z-[1000] bg-black text-white py-4 px-6 text-[10px] font-bold uppercase tracking-[0.2em] shadow-2xl border border-white/10">
          {toastText}
        </div>
      )}

      {/* Main Bag Content */}
      <main className="max-w-7xl mx-auto px-6 lg:px-12 py-12 lg:py-20">
        <div className="flex flex-col lg:flex-row gap-16">
          {/* Left Column: Items List */}
          <div className="flex-grow space-y-12">
            <div className="border-b border-on-surface/5 pb-6">
              <h2 className="font-headline text-5xl font-black tracking-tight mb-2">Shopping Bag</h2>
              <p className="text-outline font-medium uppercase tracking-widest text-xs">
                {isClient ? cartItems.length : 0} ITEM{cartItems.length !== 1 ? "S" : ""} SELECTED
              </p>
            </div>

            <div className="space-y-10">
              {!isClient || cartItems.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-outline-variant/30 space-y-6">
                  <span className="material-symbols-outlined text-6xl text-outline/40">shopping_bag</span>
                  <h3 className="font-headline text-2xl font-bold uppercase tracking-tight">Your cart is empty</h3>
                  <p className="text-xs text-outline uppercase tracking-widest max-w-sm mx-auto leading-relaxed">
                    Add items to get started. Explore our limited-run collections and South Indian woven heritage series.
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
                      key={`${item.productName}_${item.size}_${item.color || "Default"}`}
                      className="flex flex-col md:flex-row gap-8 relative group border-b border-on-surface/5 pb-10"
                    >
                      <div className="w-full md:w-48 aspect-[3/4] bg-surface-container overflow-hidden border border-outline-variant/10 relative">
                        <ProductImage alt={item.productName} className="object-cover" src={imageSrc} fill sizes="(max-width: 768px) 100vw, 192px" />
                      </div>
                      <div className="flex-grow flex flex-col justify-between py-2">
                        <div>
                          <div className="flex justify-between items-start mb-2">
                            <h3 className="font-headline text-xl font-bold">{item.productName}</h3>
                            <p className="font-headline font-bold text-lg">{formattedPrice}</p>
                          </div>
                          <div className="space-y-1 text-sm text-outline font-medium uppercase tracking-wider mb-4">
                            <p>Size: {item.size}</p>
                            <p>Color: {item.color || "Default"}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-6">
                          <div className="flex items-center border border-outline-variant">
                            <button
                              onClick={() => handleDecrement(item)}
                              aria-label="Decrease quantity"
                              className="px-3 py-2 hover:bg-surface-container-low transition-colors btn-active-scale"
                            >
                              <span className="material-symbols-outlined">remove</span>
                            </button>
                            <span className="px-4 font-headline font-bold">{item.quantity}</span>
                            <button
                              onClick={() => handleIncrement(item)}
                              aria-label="Increase quantity"
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
                </div>

                <div className="border-t border-on-surface/10 pt-6 mb-8">
                  <div className="flex justify-between items-end">
                    <span className="font-headline font-bold text-lg uppercase tracking-widest">Total</span>
                    <span className="font-headline font-black text-3xl">
                      ₹{total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* GST inclusive note */}
                <div style={{
                  background: '#f9f9f9',
                  border: '0.5px solid #e5e5e5',
                  borderRadius: '4px',
                  padding: '8px 12px',
                  marginBottom: '1.5rem'
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
                      Heritage Collection. <Link className="underline" href="/about">Join Now</Link>.
                    </p>
                  </div>
                  <div className="flex justify-center gap-4 opacity-40 grayscale">
                    <Image
                      alt="Visa"
                      height={16}
                      width={50}
                      className="h-4 w-auto object-contain"
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuDvWjR0FxPlD1Bbr8IIGvOem2_CS0oAoiGJkcdUXUFzFJCcyCeCOoPUVL7_8nl7gnSvlCWHzkSMSIvvPz8jzgcYLTWovOCL3smbP52wVGRFIGHFwiWrSL4wBUud8Vy2QBRLEnDaAsqu2Yj_9bR3uJZFXEZ3IywkCdS-IADrHPUmXxuyvR3lNpLq82fvrUBdLeIm-bwB9tqLR2scB8oEUNYL5H9ypBTjDXwpNDoVTyDm_uru-Y5vy_6DeVnFboBxjzp1VLcGcvMfprA"
                    />
                    <Image
                      alt="Mastercard"
                      height={16}
                      width={50}
                      className="h-4 w-auto object-contain"
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuAGXq4UBQBpQT0nMdqNkTaV_7dLj6zRsVrJJZaRjzCrdOQ-WmJjrv7q9O6n-rDea8R11-CyFA2v9_3zYnSf-iW0tvvfnoEhJm3Sst2jjlFFSHx0w9wHJa6Q9TnWGvwx4jmDA3RkmiqYpgl7OCjlP1IXFbPWPZTnvrd4bg8H5KIIUlLIzkxMZMgti9xIa-x3WG3YpXD-oH5Hn9SlWnh0AdDTHlzNEclh_yweIy_khg-sCu5s0Afm73FAo533o_4zsYb55CHMbcguhz8"
                    />
                    <Image
                      alt="PayPal"
                      height={16}
                      width={50}
                      className="h-4 w-auto object-contain"
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuCPGHpGdJ1hE36tsfZ3daofkcNJb-27h_RECwh_WjVU9xMyK668uJuktG4wJEwynAnnOAbl560BmZDiB2NmNDneNedC63-yDciK7y9zAp4vjV6IYX-QwiqdajfQ1F9M22Rr9iRE3-_jHIBzIZ5A-TjeJajQ1e2k1PMdDFStplFhtqSCSz__Ghd2pmahBFWBcuKZOuYS58oCMM9xozGNFMTuI__LoG0nQN92WZdvX7t85pGYDl336TIeejJ7ZIFVsjIf5jUV8OVXQ6Y"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>


      </main>
    </>
  );
}
