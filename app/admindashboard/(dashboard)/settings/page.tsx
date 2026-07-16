"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import CloudinaryUploadWidget, { type CloudinaryUploadHandle } from "@/app/admindashboard/CloudinaryUploadWidget";
import {
  getSettingAction,
  saveHeroAction,
  saveBusinessAction,
  saveFlagsAction,
  saveMarqueeAction,
  saveOfferBoxAction,
  saveTrustBadgesAction,
  saveCategoriesAction,
  getReviewsAction,
  approveReviewAction,
  rejectReviewAction,
  updateReviewAction,
  saveShippingAction,
  saveStoreIdentityAction,
  saveLoyaltyConfigAction,
  saveShiprocketConfigAction,
} from "@/app/actions/admin-settings";
import { calculateShipping, getShippingMessage, type ShippingMode } from "@/lib/shipping";

export default function SettingsDashboardPage() {
  const router = useRouter();

  // Cloudinary Widget Ref
  const cloudinaryRef = useRef<CloudinaryUploadHandle>(null);

  // States for Hero Settings
  const [heroImage, setHeroImage] = useState("");
  const [carouselSlides, setCarouselSlides] = useState<string[]>([]);
  const [activeUploadHeroSlideIndex, setActiveUploadHeroSlideIndex] = useState<number | null>(null);
  const [uploadOptions, setUploadOptions] = useState<any>({});


  // States for Business Settings
  const [bizPhone, setBizPhone] = useState("");
  const [bizEmail, setBizEmail] = useState("");
  const [bizAddress, setBizAddress] = useState("");
  const [bizGst, setBizGst] = useState("");
  const [bizInstagram, setBizInstagram] = useState("");
  const [bizFacebook, setBizFacebook] = useState("");

  // States for Flags Settings
  const [flagCodEnabled, setFlagCodEnabled] = useState(true);
  const [flagReturnsDays, setFlagReturnsDays] = useState(7);

  // States for Marquee Settings
  const [marqueeEnabled, setMarqueeEnabled] = useState(true);
  const [marqueeItems, setMarqueeItems] = useState<string[]>([]);
  const [newMarqueeItem, setNewMarqueeItem] = useState("");

  // States for Offer Box Settings
  const [offerEnabled, setOfferEnabled] = useState(true);
  const [offerLabel, setOfferLabel] = useState("");
  const [offerHeading, setOfferHeading] = useState("");
  const [offerBody, setOfferBody] = useState("");
  const [offerCouponCode, setOfferCouponCode] = useState("");
  const [offerCtaText, setOfferCtaText] = useState("");
  const [offerCtaUrl, setOfferCtaUrl] = useState("");
  const [offerBgImageUrl, setOfferBgImageUrl] = useState("");

  // Upload target
  const [uploadTarget, setUploadTarget] = useState<"hero" | "offer" | "category" | "hero_slide" | null>(null);
  const [activeUploadCategoryIndex, setActiveUploadCategoryIndex] = useState<number | null>(null);


  // Tab control state
  const [activeTab, setActiveTab] = useState<
    | "hero"
    | "business"
    | "flags"
    | "marquee"
    | "offer_box"
    | "trust_badges"
    | "categories"
    | "reviews"
    | "shipping"
    | "store_identity"
    | "loyalty"
    | "shiprocket"
  >("hero");

  // States for Store Identity
  const [storeName, setStoreName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [supportPhone, setSupportPhone] = useState("");

  // States for Loyalty Config
  const [pointsPer100, setPointsPer100] = useState(5);
  const [rupeesPerPoint, setRupeesPerPoint] = useState(0.5);
  const [minRedeemPoints, setMinRedeemPoints] = useState(100);

  // States for Shiprocket Config
  const [pickupLocationName, setPickupLocationName] = useState("");
  const [pickupPincode, setPickupPincode] = useState("");
  const [pickupAddress, setPickupAddress] = useState("");
  const [pickupCity, setPickupCity] = useState("");
  const [pickupState, setPickupState] = useState("");
  const [pickupPhone, setPickupPhone] = useState("");

  // States for Shipping Settings
  const [shippingMode, setShippingMode] = useState<ShippingMode>("free_above");
  const [shippingFlatRate, setShippingFlatRate] = useState<number>(99);
  const [shippingFreeAboveAmount, setShippingFreeAboveAmount] = useState<number>(999);
  const [shippingDisplayMessage, setShippingDisplayMessage] = useState<string>("Free shipping on orders above ₹999");

  // States for Trust Badges
  const [trustBadgesEnabled, setTrustBadgesEnabled] = useState(true);
  const [trustBadgesItems, setTrustBadgesItems] = useState<{ icon: string; title: string; description: string }[]>([]);

  // States for Categories
  const [categoriesEnabled, setCategoriesEnabled] = useState(true);
  const [categoriesItems, setCategoriesItems] = useState<{ title: string; subtitle: string; image_url: string; theme: "navy" | "crimson" | "linen" | "charcoal" | "cream"; cta_url: string }[]>([]);

  // States for Reviews
  const [reviewsList, setReviewsList] = useState<any[]>([]);
  const [editingCommentMap, setEditingCommentMap] = useState<{ [id: string]: string }>({});
  const [editingRatingMap, setEditingRatingMap] = useState<{ [id: string]: number }>({});
  const [activeReviewsTab, setActiveReviewsTab] = useState<"pending" | "approved">("pending");


  // Loading & Toast States
  const [loading, setLoading] = useState(true);
  const [toastText, setToastText] = useState("");
  const [showToast, setShowToast] = useState(false);

  const triggerToast = (msg: string) => {
    setToastText(msg);
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 3000);
  };

  useEffect(() => {
    loadAllSettings();
  }, []);

  const loadAllSettings = async () => {
    try {
      setLoading(true);
      const [
        heroRes, bizRes, flagsRes, marqueeRes, offerRes, trustRes, categoriesRes, shippingRes,
        storeIdentityRes, loyaltyRes, shiprocketRes
      ] = await Promise.all([
        getSettingAction("hero"),
        getSettingAction("business"),
        getSettingAction("flags"),
        getSettingAction("marquee"),
        getSettingAction("offer_box"),
        getSettingAction("trust_badges"),
        getSettingAction("categories"),
        getSettingAction("shipping_rules"),
        getSettingAction("store_identity" as any),
        getSettingAction("loyalty_config" as any),
        getSettingAction("shiprocket_config" as any),
      ]);

      if (heroRes.success && heroRes.value) {
        setHeroImage(heroRes.value.image_url || "");
        setCarouselSlides(heroRes.value.carousel_slides || []);
      }


      if (bizRes.success && bizRes.value) {
        setBizPhone(bizRes.value.phone || "");
        setBizEmail(bizRes.value.email || "");
        setBizAddress(bizRes.value.address || "");
        setBizGst(bizRes.value.gst_no || "");
        setBizInstagram(bizRes.value.instagram || "");
        setBizFacebook(bizRes.value.facebook || "");
      }

      if (flagsRes.success && flagsRes.value) {
        setFlagCodEnabled(flagsRes.value.cod_enabled ?? true);
        setFlagReturnsDays(flagsRes.value.returns_window_days ?? 7);
      }

      if (marqueeRes.success && marqueeRes.value) {
        setMarqueeEnabled(marqueeRes.value.enabled ?? true);
        setMarqueeItems(marqueeRes.value.items || []);
      }

      if (offerRes.success && offerRes.value) {
        setOfferEnabled(offerRes.value.enabled ?? true);
        setOfferLabel(offerRes.value.label || "");
        setOfferHeading(offerRes.value.heading || "");
        setOfferBody(offerRes.value.body || "");
        setOfferCouponCode(offerRes.value.coupon_code || "");
        setOfferCtaText(offerRes.value.cta_text || "");
        setOfferCtaUrl(offerRes.value.cta_url || "");
        setOfferBgImageUrl(offerRes.value.bg_image_url || "");
      }

      if (trustRes.success && trustRes.value) {
        setTrustBadgesEnabled(trustRes.value.enabled ?? true);
        setTrustBadgesItems(trustRes.value.items || []);
      }

      if (categoriesRes.success && categoriesRes.value) {
        setCategoriesEnabled(categoriesRes.value.enabled ?? true);
        setCategoriesItems(categoriesRes.value.items || []);
      }

      if (shippingRes.success && shippingRes.value) {
        setShippingMode(shippingRes.value.mode || "free_above");
        setShippingFlatRate(shippingRes.value.flat_rate ?? 99);
        setShippingFreeAboveAmount(shippingRes.value.free_above_amount ?? 999);
        setShippingDisplayMessage(shippingRes.value.display_message || "Free shipping on orders above ₹999");
      }

      if (storeIdentityRes.success && storeIdentityRes.value) {
        setStoreName(storeIdentityRes.value.store_name || "");
        setLogoUrl(storeIdentityRes.value.logo_url || "");
        setSupportEmail(storeIdentityRes.value.support_email || "");
        setSupportPhone(storeIdentityRes.value.support_phone || "");
      }

      if (loyaltyRes.success && loyaltyRes.value) {
        setPointsPer100(loyaltyRes.value.points_per_100 ?? 5);
        setRupeesPerPoint(loyaltyRes.value.rupees_per_point ?? 0.5);
        setMinRedeemPoints(loyaltyRes.value.min_redeem_points ?? 100);
      }

      if (shiprocketRes.success && shiprocketRes.value) {
        setPickupLocationName(shiprocketRes.value.pickup_location_name || "");
        setPickupPincode(shiprocketRes.value.pickup_pincode || "");
        setPickupAddress(shiprocketRes.value.pickup_address || "");
        setPickupCity(shiprocketRes.value.pickup_city || "");
        setPickupState(shiprocketRes.value.pickup_state || "");
        setPickupPhone(shiprocketRes.value.pickup_phone || "");
      }
    } catch (err: any) {
      triggerToast("Error loading settings: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveHero = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      image_url: heroImage,
      carousel_slides: carouselSlides,
    };
    const res = await saveHeroAction(payload);

    if (res.success) {
      triggerToast("Hero settings updated successfully");
      router.refresh();
    } else {
      triggerToast(res.error || "Failed to update hero settings");
    }
  };

  const handleSaveBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      phone: bizPhone,
      email: bizEmail,
      address: bizAddress,
      gst_no: bizGst,
      instagram: bizInstagram,
      facebook: bizFacebook,
    };
    const res = await saveBusinessAction(payload);
    if (res.success) {
      triggerToast("Business details updated successfully");
      router.refresh();
    } else {
      triggerToast(res.error || "Failed to update business details");
    }
  };

  const handleSaveFlags = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      cod_enabled: flagCodEnabled,
      returns_window_days: flagReturnsDays,
    };
    const res = await saveFlagsAction(payload);
    if (res.success) {
      triggerToast("Feature flags updated successfully");
      router.refresh();
    } else {
      triggerToast(res.error || "Failed to update feature flags");
    }
  };

  const handleSaveMarquee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (marqueeItems.length === 0) {
      triggerToast("Must have at least 1 marquee item");
      return;
    }
    const payload = {
      enabled: marqueeEnabled,
      items: marqueeItems,
    };
    const res = await saveMarqueeAction(payload);
    if (res.success) {
      triggerToast("Marquee settings updated successfully");
      router.refresh();
    } else {
      triggerToast(res.error || "Failed to update marquee settings");
    }
  };

  const handleSaveOfferBox = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      enabled: offerEnabled,
      label: offerLabel,
      heading: offerHeading,
      body: offerBody,
      coupon_code: offerCouponCode,
      cta_text: offerCtaText,
      cta_url: offerCtaUrl,
      bg_image_url: offerBgImageUrl,
    };
    const res = await saveOfferBoxAction(payload);
    if (res.success) {
      triggerToast("Offer Box settings updated successfully");
      router.refresh();
    } else {
      triggerToast(res.error || "Failed to update offer box settings");
    }
  };

  const handleSaveTrustBadges = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      enabled: trustBadgesEnabled,
      items: trustBadgesItems,
    };
    const res = await saveTrustBadgesAction(payload);
    if (res.success) {
      triggerToast("Trust Badges updated successfully");
      router.refresh();
    } else {
      triggerToast(res.error || "Failed to update trust badges");
    }
  };

  const handleSaveCategories = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      enabled: categoriesEnabled,
      items: categoriesItems,
    };
    const res = await saveCategoriesAction(payload);
    if (res.success) {
      triggerToast("Categories settings updated successfully");
      router.refresh();
    } else {
      triggerToast(res.error || "Failed to update categories settings");
    }
  };

  const handleSaveShipping = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await saveShippingAction({
      mode: shippingMode,
      flatRate: Number(shippingFlatRate),
      freeAboveAmount: Number(shippingFreeAboveAmount),
      displayMessage: shippingDisplayMessage,
    });
    if (res.success) {
      triggerToast("Shipping settings updated successfully");
      router.refresh();
    } else {
      triggerToast(res.error || "Failed to update shipping settings");
    }
  };

  const handleSaveStoreIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await saveStoreIdentityAction({
      store_name: storeName,
      logo_url: logoUrl,
      support_email: supportEmail,
      support_phone: supportPhone,
    });
    if (res.success) {
      triggerToast("Store Identity updated successfully");
      router.refresh();
    } else {
      triggerToast(res.error || "Failed to update Store Identity");
    }
  };

  const handleSaveLoyalty = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await saveLoyaltyConfigAction({
      points_per_100: pointsPer100,
      rupees_per_point: rupeesPerPoint,
      min_redeem_points: minRedeemPoints,
    });
    if (res.success) {
      triggerToast("Loyalty settings updated successfully");
      router.refresh();
    } else {
      triggerToast(res.error || "Failed to update Loyalty settings");
    }
  };

  const handleSaveShiprocket = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await saveShiprocketConfigAction({
      pickup_location_name: pickupLocationName,
      pickup_pincode: pickupPincode,
      pickup_address: pickupAddress,
      pickup_city: pickupCity,
      pickup_state: pickupState,
      pickup_phone: pickupPhone,
    });
    if (res.success) {
      triggerToast("Shiprocket settings updated successfully");
      router.refresh();
    } else {
      triggerToast(res.error || "Failed to update Shiprocket settings");
    }
  };

  const loadReviews = async () => {
    const res = await getReviewsAction();
    if (res.success && res.value) {
      setReviewsList(res.value);
      // Initialize edit comments & ratings map
      const editMap: { [id: string]: string } = {};
      const ratingMap: { [id: string]: number } = {};
      res.value.forEach((r: any) => {
        editMap[r.id] = r.comment;
        ratingMap[r.id] = r.rating;
      });
      setEditingCommentMap(editMap);
      setEditingRatingMap(ratingMap);
    }
  };

  useEffect(() => {
    if (activeTab === "reviews") {
      loadReviews();
    }
  }, [activeTab]);

  const handleApproveReview = async (id: string) => {
    const res = await approveReviewAction(id);
    if (res.success) {
      triggerToast("Review approved successfully");
      loadReviews();
    } else {
      triggerToast(res.error || "Failed to approve review");
    }
  };

  const handleRejectReview = async (id: string) => {
    const res = await rejectReviewAction(id);
    if (res.success) {
      triggerToast("Review rejected/deleted successfully");
      loadReviews();
    } else {
      triggerToast(res.error || "Failed to reject review");
    }
  };

  const handleUpdateReviewComment = async (id: string) => {
    const comment = editingCommentMap[id] || "";
    const rating = editingRatingMap[id];
    if (!comment.trim()) {
      triggerToast("Comment cannot be empty");
      return;
    }
    const res = await updateReviewAction(id, comment, rating);
    if (res.success) {
      triggerToast("Review updated successfully");
      loadReviews();
    } else {
      triggerToast(res.error || "Failed to update review");
    }
  };



  const addMarqueeItem = () => {
    if (!newMarqueeItem.trim()) return;
    if (marqueeItems.length >= 10) {
      triggerToast("Maximum 10 items allowed");
      return;
    }
    setMarqueeItems([...marqueeItems, newMarqueeItem.trim()]);
    setNewMarqueeItem("");
  };

  const removeMarqueeItem = (index: number) => {
    setMarqueeItems(marqueeItems.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <div className="p-8 lg:p-16 text-center text-xs font-black uppercase tracking-widest text-gray-500">
        Loading settings...
      </div>
    );
  }

  return (
    <div className="p-8 lg:p-16">
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-6 right-6 z-[1000] bg-black text-white py-4 px-6 text-[10px] font-bold uppercase tracking-[0.2em] shadow-2xl border border-white/10 animate-fade-in">
          {toastText}
        </div>
      )}

      {/* Cloudinary Widget */}
      <CloudinaryUploadWidget
        ref={cloudinaryRef}
        options={uploadOptions}
        onUpload={(newUrl) => {
          if (uploadTarget === "hero") {
            setHeroImage(newUrl);
          } else if (uploadTarget === "offer") {
            setOfferBgImageUrl(newUrl);
          } else if (uploadTarget === "category" && activeUploadCategoryIndex !== null) {
            const newItems = [...categoriesItems];
            newItems[activeUploadCategoryIndex].image_url = newUrl;
            setCategoriesItems(newItems);
          } else if (uploadTarget === "hero_slide" && activeUploadHeroSlideIndex !== null) {
            const newSlides = [...carouselSlides];
            newSlides[activeUploadHeroSlideIndex] = newUrl;
            setCarouselSlides(newSlides.filter(Boolean));
          }
        }}
      />


      <header className="mb-16">
        <nav className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">
          <span>Admin Portal</span>
          <span className="material-symbols-outlined text-sm opacity-30">chevron_right</span>
          <span className="text-[#0a0a0a] italic">Settings</span>
        </nav>
        <h2 className="text-5xl font-headline font-black tracking-tighter text-[#0a0a0a] uppercase leading-none">
          Store Settings
        </h2>
        <p className="text-xs text-gray-500 mt-4 font-bold uppercase tracking-widest italic opacity-70">
          Configure homepage hero content, contact information, and business feature flags.
        </p>
      </header>

      {/* Tabs navigation */}
      <div className="flex border-b border-gray-200 gap-6 overflow-x-auto pb-px mb-12 scrollbar-none">
        {[
          { id: "hero", label: "Hero Settings" },
          { id: "business", label: "Business Info" },
          { id: "store_identity", label: "Store Identity" },
          { id: "flags", label: "Feature Flags" },
          { id: "marquee", label: "Marquee" },
          { id: "offer_box", label: "Offer Box" },
          { id: "trust_badges", label: "Trust Badges" },
          { id: "categories", label: "Categories" },
          { id: "reviews", label: "Reviews" },
          { id: "shipping", label: "Shipping" },
          { id: "loyalty", label: "Loyalty & Points" },
          { id: "shiprocket", label: "Shiprocket" },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`pb-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? "border-[#BA7517] text-[#BA7517]"
                  : "border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-300"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="space-y-16">
        {/* Section 1: Hero Settings */}
        {activeTab === "hero" && (
          <section className="bg-white border border-gray-150 rounded-xl p-6 shadow-sm">
            <span className="text-[11px] font-black uppercase tracking-[0.08em] text-gray-400 mb-4 block">
              Homepage Hero Editor
            </span>
            <form onSubmit={handleSaveHero} className="space-y-6">
              {/* Cloudinary Upload */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 block">
                  Hero Background Image
                </label>
                {heroImage ? (
                  <div className="space-y-4">
                    <div className="relative w-full max-w-md h-48 bg-neutral-100 border border-gray-200 overflow-hidden flex items-center justify-center rounded-md">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={heroImage} alt="Hero preview" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex gap-4">
                      <button
                        type="button"
                        onClick={() => {
                          setUploadTarget("hero");
                          setUploadOptions({
                            maxFileSize: 5000000,
                            minImageWidth: 1920,
                            minImageHeight: 1080,
                            clientAllowedFormats: ["jpg", "jpeg", "png", "webp"],
                            showPoweredBy: false,
                            cropping: false,
                          });
                          cloudinaryRef.current?.open();
                        }}
                        className="border border-gray-200 text-primary px-6 py-2.5 text-[10px] font-black uppercase tracking-widest hover:bg-neutral-50 transition-all rounded-md cursor-pointer"
                      >
                        Change Image
                      </button>
                      <button
                        type="button"
                        onClick={() => setHeroImage("")}
                        className="border border-red-200 text-red-600 px-6 py-2.5 text-[10px] font-black uppercase tracking-widest hover:bg-red-50 transition-all rounded-md cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        setUploadTarget("hero");
                        setUploadOptions({
                          maxFileSize: 5000000,
                          minImageWidth: 1920,
                          minImageHeight: 1080,
                          clientAllowedFormats: ["jpg", "jpeg", "png", "webp"],
                          showPoweredBy: false,
                          cropping: false,
                        });
                        cloudinaryRef.current?.open();
                      }}
                      className="w-full max-w-md border border-dashed border-gray-300 py-12 text-center text-xs text-gray-400 hover:border-primary transition-colors cursor-pointer bg-[#fbfbfb] rounded-md"
                    >
                      <span className="material-symbols-outlined text-3xl block mb-2 opacity-50">cloud_upload</span>
                      Upload Custom Hero Image (Cloudinary)
                    </button>
                  </div>
                )}

                {/* Upload details chips */}
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-gray-400 border border-gray-200 rounded-full">Max 5 MB</span>
                  <span className="px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-gray-400 border border-gray-200 rounded-full">JPG / PNG / WebP</span>
                  <span className="px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-gray-400 border border-gray-200 rounded-full">Min 1920 × 1080px</span>
                </div>
              </div>

              {/* Carousel Slides Section */}
              <div className="border-t border-gray-200 pt-8 space-y-6">
                <span className="text-[11px] font-black uppercase tracking-[0.08em] text-gray-400 block">
                  Carousel Slides (Max 6)
                </span>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {[0, 1, 2, 3, 4, 5].map((index) => {
                    const url = carouselSlides[index];
                    const isFilled = !!url;
                    return (
                      <div
                        key={index}
                        className={`relative aspect-[16/9] border rounded-lg overflow-hidden flex flex-col items-center justify-center transition-all ${
                          isFilled
                            ? "border-[#BA7517] bg-white"
                            : "border-dashed border-gray-300 hover:border-primary hover:bg-[#fbfbfb] bg-[#fbfbfb]"
                        }`}
                      >
                        <span className="absolute top-2 left-2 text-[10px] font-bold text-gray-400 bg-white/80 px-1.5 py-0.5 rounded shadow-sm z-10">
                          {index + 1}
                        </span>

                        {isFilled ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={url}
                              alt={`Slide ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const newSlides = carouselSlides.filter((_, i) => i !== index);
                                setCarouselSlides(newSlides);
                              }}
                              className="absolute top-2 right-2 size-6 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center border-none shadow-md cursor-pointer transition-all z-20"
                            >
                              <span className="material-symbols-outlined text-[14px]">close</span>
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setUploadTarget("hero_slide");
                              setActiveUploadHeroSlideIndex(index);
                              setUploadOptions({
                                maxFileSize: 5000000,
                                minImageWidth: 1920,
                                minImageHeight: 1080,
                                clientAllowedFormats: ["jpg", "jpeg", "png", "webp"],
                                showPoweredBy: false,
                                cropping: false,
                              });
                              cloudinaryRef.current?.open();
                            }}
                            className="w-full h-full flex flex-col items-center justify-center gap-1 bg-transparent border-none cursor-pointer p-2"
                          >
                            <span className="material-symbols-outlined text-2xl text-gray-400">cloud_upload</span>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Add Slide</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-gray-500">
                  <span>{carouselSlides.length} of 6 slides uploaded</span>
                  <span>Max 6 slides allowed</span>
                </div>
                <p className="text-[10px] text-gray-400 italic">
                  If slides are added, the storefront shows a carousel instead of the single hero image above.
                </p>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  className="bg-[#1a1a1a] hover:bg-black text-white px-6 py-2.5 text-[13px] font-medium tracking-wide transition-all rounded-md cursor-pointer border-none shadow-sm block w-fit"
                >
                  Save Hero Settings
                </button>
              </div>
            </form>
          </section>
        )}

        {/* Section 2: Business Info */}
        {activeTab === "business" && (
          <section className="bg-white border border-gray-150 rounded-xl p-6 shadow-sm">
            <span className="text-[11px] font-black uppercase tracking-[0.08em] text-gray-400 mb-4 block">
              Business Information
            </span>
            <form onSubmit={handleSaveBusiness} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 block">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    maxLength={20}
                    value={bizPhone}
                    onChange={(e) => setBizPhone(e.target.value)}
                    className="w-full h-9 border border-gray-200 focus:border-primary focus:ring-0 text-xs px-3 bg-neutral-50 rounded-md"
                    placeholder="+91 XXXXX XXXXX"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 block">
                    Email Address
                  </label>
                  <input
                    type="email"
                    maxLength={100}
                    value={bizEmail}
                    onChange={(e) => setBizEmail(e.target.value)}
                    className="w-full h-9 border border-gray-200 focus:border-primary focus:ring-0 text-xs px-3 bg-neutral-50 rounded-md"
                    placeholder="contact@store.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 block">
                  Office / Store Address
                </label>
                <textarea
                  maxLength={500}
                  value={bizAddress}
                  onChange={(e) => setBizAddress(e.target.value)}
                  className="w-full border border-gray-200 focus:border-primary focus:ring-0 text-xs p-3 bg-neutral-50 rounded-md h-20 resize-none"
                  placeholder="123 Luxury Lane, Atelier Block..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 block">
                    GSTIN Number
                  </label>
                  <input
                    type="text"
                    maxLength={50}
                    value={bizGst}
                    onChange={(e) => setBizGst(e.target.value)}
                    className="w-full h-9 border border-gray-200 focus:border-primary focus:ring-0 text-xs px-3 bg-neutral-50 rounded-md"
                    placeholder="33AAAAA1111A1Z1"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 block">
                    Instagram URL
                  </label>
                  <input
                    type="text"
                    maxLength={200}
                    value={bizInstagram}
                    onChange={(e) => setBizInstagram(e.target.value)}
                    className="w-full h-9 border border-gray-200 focus:border-primary focus:ring-0 text-xs px-3 bg-neutral-50 rounded-md"
                    placeholder="https://instagram.com/..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 block">
                    Facebook URL
                  </label>
                  <input
                    type="text"
                    maxLength={200}
                    value={bizFacebook}
                    onChange={(e) => setBizFacebook(e.target.value)}
                    className="w-full h-9 border border-gray-200 focus:border-primary focus:ring-0 text-xs px-3 bg-neutral-50 rounded-md"
                    placeholder="https://facebook.com/..."
                  />
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  className="bg-[#1a1a1a] hover:bg-black text-white px-6 py-2.5 text-[13px] font-medium tracking-wide transition-all rounded-md cursor-pointer border-none shadow-sm block w-fit"
                >
                  Save Business details
                </button>
              </div>
            </form>
          </section>
        )}

        {/* Section 3: Feature Flags */}
        {activeTab === "flags" && (
          <section className="bg-white border border-gray-150 rounded-xl p-6 shadow-sm">
            <span className="text-[11px] font-black uppercase tracking-[0.08em] text-gray-400 mb-4 block">
              Feature Flags & Policy Rules
            </span>
            <form onSubmit={handleSaveFlags} className="space-y-6">
              <div className="flex items-center gap-3">
                <input
                  id="cod-flag"
                  type="checkbox"
                  checked={flagCodEnabled}
                  onChange={(e) => setFlagCodEnabled(e.target.checked)}
                  className="w-4 h-4 border-gray-300 text-primary focus:ring-primary rounded cursor-pointer"
                />
                <label htmlFor="cod-flag" className="text-xs font-bold uppercase tracking-widest text-[#0a0a0a] cursor-pointer select-none">
                  Enable Cash on Delivery (COD) globally at checkout
                </label>
              </div>

              <div className="space-y-2 max-w-xs">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 block">
                  Returns Window Days
                </label>
                <input
                  required
                  type="number"
                  min={0}
                  max={60}
                  value={flagReturnsDays}
                  onChange={(e) => setFlagReturnsDays(Math.max(0, Math.min(60, parseInt(e.target.value) || 0)))}
                  className="w-full h-9 border border-gray-200 focus:border-primary focus:ring-0 text-xs px-3 bg-neutral-50 rounded-md"
                  placeholder="7"
                />
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  className="bg-[#1a1a1a] hover:bg-black text-white px-6 py-2.5 text-[13px] font-medium tracking-wide transition-all rounded-md cursor-pointer border-none shadow-sm block w-fit"
                >
                  Save Feature Flags
                </button>
              </div>
            </form>
          </section>
        )}

        {/* Section 4: Marquee Settings */}
        {activeTab === "marquee" && (
          <section className="bg-white border border-gray-150 rounded-xl p-6 shadow-sm">
            <span className="text-[11px] font-black uppercase tracking-[0.08em] text-gray-400 mb-4 block">
              Announcement Marquee Editor
            </span>
            <form onSubmit={handleSaveMarquee} className="space-y-6">
              <div className="flex items-center gap-3">
                <input
                  id="marquee-enabled"
                  type="checkbox"
                  checked={marqueeEnabled}
                  onChange={(e) => setMarqueeEnabled(e.target.checked)}
                  className="w-4 h-4 border-gray-300 text-primary focus:ring-primary rounded cursor-pointer"
                />
                <label htmlFor="marquee-enabled" className="text-xs font-bold uppercase tracking-widest text-[#0a0a0a] cursor-pointer select-none">
                  Enable Announcement Marquee
                </label>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 block">
                  Marquee Text Segments (Min 1, Max 10)
                </label>
                
                <div className="space-y-2">
                  {marqueeItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3 bg-neutral-50 border border-gray-200 p-2.5 rounded-md">
                      <span className="text-xs font-bold text-gray-700 flex-1">{item}</span>
                      <button
                        type="button"
                        onClick={() => removeMarqueeItem(idx)}
                        className="text-red-500 hover:text-red-700 text-xs uppercase font-black tracking-widest"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>

                {marqueeItems.length < 10 && (
                  <div className="flex gap-4">
                    <input
                      type="text"
                      maxLength={120}
                      value={newMarqueeItem}
                      onChange={(e) => setNewMarqueeItem(e.target.value)}
                      placeholder="Enter new marquee text segment..."
                      className="flex-1 h-9 border border-gray-200 focus:border-primary focus:ring-0 text-xs px-3 bg-neutral-50 rounded-md"
                    />
                    <button
                      type="button"
                      onClick={addMarqueeItem}
                      className="bg-neutral-800 hover:bg-neutral-900 text-white px-6 h-9 text-[10px] font-black uppercase tracking-widest transition-all rounded-md"
                    >
                      Add Item
                    </button>
                  </div>
                )}
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  className="bg-[#1a1a1a] hover:bg-black text-white px-6 py-2.5 text-[13px] font-medium tracking-wide transition-all rounded-md cursor-pointer border-none shadow-sm block w-fit"
                >
                  Save Marquee Settings
                </button>
              </div>
            </form>
          </section>
        )}

        {/* Section 5: Offer Box Settings */}
        {activeTab === "offer_box" && (
          <section className="bg-white border border-gray-150 rounded-xl p-6 shadow-sm">
            <span className="text-[11px] font-black uppercase tracking-[0.08em] text-gray-400 mb-4 block">
              Homepage Offer Box Editor
            </span>
            <form onSubmit={handleSaveOfferBox} className="space-y-6">
              <div className="flex items-center gap-3">
                <input
                  id="offer-enabled"
                  type="checkbox"
                  checked={offerEnabled}
                  onChange={(e) => setOfferEnabled(e.target.checked)}
                  className="w-4 h-4 border-gray-300 text-primary focus:ring-primary rounded cursor-pointer"
                />
                <label htmlFor="offer-enabled" className="text-xs font-bold uppercase tracking-widest text-[#0a0a0a] cursor-pointer select-none">
                  Enable Offer Box Section
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 block">
                    Label
                  </label>
                  <input
                    type="text"
                    maxLength={200}
                    value={offerLabel}
                    onChange={(e) => setOfferLabel(e.target.value)}
                    className="w-full h-9 border border-gray-200 focus:border-primary focus:ring-0 text-xs px-3 bg-neutral-50 rounded-md"
                    placeholder="Limited Time Offer"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 block">
                    Heading
                  </label>
                  <input
                    type="text"
                    maxLength={200}
                    value={offerHeading}
                    onChange={(e) => setOfferHeading(e.target.value)}
                    className="w-full h-9 border border-gray-200 focus:border-primary focus:ring-0 text-xs px-3 bg-neutral-50 rounded-md"
                    placeholder="S E A S O N"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 block">
                  Body / Subtitle Text
                </label>
                <textarea
                  maxLength={200}
                  value={offerBody}
                  onChange={(e) => setOfferBody(e.target.value)}
                  className="w-full border border-gray-200 focus:border-primary focus:ring-0 text-xs p-3 bg-neutral-50 rounded-md h-20 resize-none"
                  placeholder="Elevate your wardrobe with the atelier linen collection..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 block">
                    Coupon Code (Optional)
                  </label>
                  <input
                    type="text"
                    maxLength={200}
                    value={offerCouponCode}
                    onChange={(e) => setOfferCouponCode(e.target.value)}
                    className="w-full h-9 border border-gray-200 focus:border-primary focus:ring-0 text-xs px-3 bg-neutral-50 rounded-md"
                    placeholder="FESTIVE24"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 block">
                    CTA Button Text
                  </label>
                  <input
                    type="text"
                    maxLength={200}
                    value={offerCtaText}
                    onChange={(e) => setOfferCtaText(e.target.value)}
                    className="w-full h-9 border border-gray-200 focus:border-primary focus:ring-0 text-xs px-3 bg-neutral-50 rounded-md"
                    placeholder="Shop The Collection"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 block">
                    CTA Button URL
                  </label>
                  <input
                    type="text"
                    maxLength={200}
                    value={offerCtaUrl}
                    onChange={(e) => setOfferCtaUrl(e.target.value)}
                    className="w-full h-9 border border-gray-200 focus:border-primary focus:ring-0 text-xs px-3 bg-neutral-50 rounded-md"
                    placeholder="/shopallshirts"
                  />
                </div>
              </div>

              {/* Cloudinary Upload for Offer Box Background */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 block">
                  Offer Box Background Image (Optional)
                </label>
                {offerBgImageUrl ? (
                  <div className="space-y-4">
                    <div className="relative w-full max-w-md h-36 bg-neutral-100 border border-gray-200 overflow-hidden flex items-center justify-center rounded-md">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={offerBgImageUrl} alt="Offer Box preview" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex gap-4">
                      <button
                        type="button"
                        onClick={() => {
                          setUploadTarget("offer");
                          setUploadOptions({});
                          cloudinaryRef.current?.open();
                        }}
                        className="border border-gray-200 text-primary px-6 py-2.5 text-[10px] font-black uppercase tracking-widest hover:bg-neutral-50 transition-all rounded-md cursor-pointer"
                      >
                        Change Image
                      </button>
                      <button
                        type="button"
                        onClick={() => setOfferBgImageUrl("")}
                        className="border border-red-200 text-red-600 px-6 py-2.5 text-[10px] font-black uppercase tracking-widest hover:bg-red-50 transition-all rounded-md cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setUploadTarget("offer");
                      setUploadOptions({});
                      cloudinaryRef.current?.open();
                    }}
                    className="w-full max-w-md border border-dashed border-gray-300 py-8 text-center text-xs text-gray-400 hover:border-primary transition-colors cursor-pointer bg-[#fbfbfb] rounded-md"
                  >
                    <span className="material-symbols-outlined text-2xl block mb-2 opacity-50">cloud_upload</span>
                    Upload Custom Background Image (Cloudinary)
                  </button>
                )}
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  className="bg-[#1a1a1a] hover:bg-black text-white px-6 py-2.5 text-[13px] font-medium tracking-wide transition-all rounded-md cursor-pointer border-none shadow-sm block w-fit"
                >
                  Save Offer Box Settings
                </button>
              </div>
            </form>
          </section>
        )}

        {/* Section 6: Trust Badges Settings */}
        {activeTab === "trust_badges" && (
          <section className="bg-white border border-gray-150 rounded-xl p-6 shadow-sm">
            <span className="text-[11px] font-black uppercase tracking-[0.08em] text-gray-400 mb-4 block">
              Trust Badges Editor
            </span>
            <form onSubmit={handleSaveTrustBadges} className="space-y-6">
              <div className="flex items-center gap-3">
                <input
                  id="trust-enabled"
                  type="checkbox"
                  checked={trustBadgesEnabled}
                  onChange={(e) => setTrustBadgesEnabled(e.target.checked)}
                  className="w-4 h-4 border-gray-300 text-primary focus:ring-primary rounded cursor-pointer"
                />
                <label htmlFor="trust-enabled" className="text-xs font-bold uppercase tracking-widest text-[#0a0a0a] cursor-pointer select-none">
                  Enable Trust Badges Section
                </label>
              </div>

              <div className="space-y-6">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 block">
                  Trust Badge Items (Max 6)
                </label>

                <div className="space-y-4">
                  {trustBadgesItems.map((item, idx) => (
                    <div key={idx} className="bg-neutral-50 border border-gray-200 p-6 space-y-4 relative rounded-md">
                      <div className="flex justify-between items-center border-b border-gray-200 pb-3">
                        <span className="text-xs font-black uppercase tracking-widest text-primary">
                          Badge #{idx + 1}
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => {
                              const newItems = [...trustBadgesItems];
                              const temp = newItems[idx];
                              newItems[idx] = newItems[idx - 1];
                              newItems[idx - 1] = temp;
                              setTrustBadgesItems(newItems);
                            }}
                            className="text-gray-500 hover:text-primary text-[10px] uppercase font-black tracking-widest disabled:opacity-30 disabled:pointer-events-none"
                          >
                            Up
                          </button>
                          <button
                            type="button"
                            disabled={idx === trustBadgesItems.length - 1}
                            onClick={() => {
                              const newItems = [...trustBadgesItems];
                              const temp = newItems[idx];
                              newItems[idx] = newItems[idx + 1];
                              newItems[idx + 1] = temp;
                              setTrustBadgesItems(newItems);
                            }}
                            className="text-gray-500 hover:text-primary text-[10px] uppercase font-black tracking-widest disabled:opacity-30 disabled:pointer-events-none"
                          >
                            Down
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setTrustBadgesItems(trustBadgesItems.filter((_, i) => i !== idx));
                            }}
                            className="text-red-500 hover:text-red-700 text-[10px] uppercase font-black tracking-widest"
                          >
                            Remove
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                          <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">
                            Icon Name (Material Symbols)
                          </label>
                          <input
                            required
                            type="text"
                            maxLength={40}
                            value={item.icon}
                            onChange={(e) => {
                              const newItems = [...trustBadgesItems];
                              newItems[idx].icon = e.target.value;
                              setTrustBadgesItems(newItems);
                            }}
                            className="w-full h-9 border border-gray-200 focus:border-primary focus:ring-0 text-xs px-3 bg-neutral-50 rounded-md"
                            placeholder="flag, shield, local_shipping..."
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">
                            Title (Max 30)
                          </label>
                          <input
                            required
                            type="text"
                            maxLength={30}
                            value={item.title}
                            onChange={(e) => {
                              const newItems = [...trustBadgesItems];
                              newItems[idx].title = e.target.value;
                              setTrustBadgesItems(newItems);
                            }}
                            className="w-full h-9 border border-gray-200 focus:border-primary focus:ring-0 text-xs px-3 bg-neutral-50 rounded-md"
                            placeholder="Made in India"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">
                            Description (Max 80)
                          </label>
                          <input
                            required
                            type="text"
                            maxLength={80}
                            value={item.description}
                            onChange={(e) => {
                              const newItems = [...trustBadgesItems];
                              newItems[idx].description = e.target.value;
                              setTrustBadgesItems(newItems);
                            }}
                            className="w-full h-9 border border-gray-200 focus:border-primary focus:ring-0 text-xs px-3 bg-neutral-50 rounded-md"
                            placeholder="Crafted in Tamil Nadu"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {trustBadgesItems.length < 6 && (
                  <button
                    type="button"
                    onClick={() => {
                      setTrustBadgesItems([
                        ...trustBadgesItems,
                        { icon: "verified", title: "New Badge", description: "Details..." },
                      ]);
                    }}
                    className="border border-dashed border-gray-300 w-full py-4 text-center text-xs font-black uppercase tracking-widest text-gray-400 hover:border-primary hover:text-primary transition-all cursor-pointer bg-[#fbfbfb] rounded-md"
                  >
                    + Add Trust Badge
                  </button>
                )}
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  className="bg-[#1a1a1a] hover:bg-black text-white px-6 py-2.5 text-[13px] font-medium tracking-wide transition-all rounded-md cursor-pointer border-none shadow-sm block w-fit"
                >
                  Save Trust Badges
                </button>
              </div>
            </form>
          </section>
        )}

        {/* Section 7: Categories Settings */}
        {activeTab === "categories" && (
          <section className="bg-white border border-gray-150 rounded-xl p-6 shadow-sm">
            <span className="text-[11px] font-black uppercase tracking-[0.08em] text-gray-400 mb-4 block">
              Categories Section Editor
            </span>
            <form onSubmit={handleSaveCategories} className="space-y-6">
              <div className="flex items-center gap-3">
                <input
                  id="categories-enabled"
                  type="checkbox"
                  checked={categoriesEnabled}
                  onChange={(e) => setCategoriesEnabled(e.target.checked)}
                  className="w-4 h-4 border-gray-300 text-primary focus:ring-primary rounded cursor-pointer"
                />
                <label htmlFor="categories-enabled" className="text-xs font-bold uppercase tracking-widest text-[#0a0a0a] cursor-pointer select-none">
                  Enable Categories Section
                </label>
              </div>

              <div className="space-y-6">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 block">
                  Category Items (Max 8)
                </label>

                <div className="space-y-6">
                  {categoriesItems.map((item, idx) => (
                    <div key={idx} className="bg-neutral-50 border border-gray-200 p-6 space-y-4 relative rounded-md">
                      <div className="flex justify-between items-center border-b border-gray-200 pb-3">
                        <span className="text-xs font-black uppercase tracking-widest text-primary">
                          Category #{idx + 1}
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => {
                              const newItems = [...categoriesItems];
                              const temp = newItems[idx];
                              newItems[idx] = newItems[idx - 1];
                              newItems[idx - 1] = temp;
                              setCategoriesItems(newItems);
                            }}
                            className="text-gray-500 hover:text-primary text-[10px] uppercase font-black tracking-widest disabled:opacity-30 disabled:pointer-events-none"
                          >
                            Up
                          </button>
                          <button
                            type="button"
                            disabled={idx === categoriesItems.length - 1}
                            onClick={() => {
                              const newItems = [...categoriesItems];
                              const temp = newItems[idx];
                              newItems[idx] = newItems[idx + 1];
                              newItems[idx + 1] = temp;
                              setCategoriesItems(newItems);
                            }}
                            className="text-gray-500 hover:text-primary text-[10px] uppercase font-black tracking-widest disabled:opacity-30 disabled:pointer-events-none"
                          >
                            Down
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setCategoriesItems(categoriesItems.filter((_, i) => i !== idx));
                            }}
                            className="text-red-500 hover:text-red-700 text-[10px] uppercase font-black tracking-widest"
                          >
                            Remove
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">
                            Title / Name (Max 50)
                          </label>
                          <input
                            required
                            type="text"
                            maxLength={50}
                            value={item.title}
                            onChange={(e) => {
                              const newItems = [...categoriesItems];
                              newItems[idx].title = e.target.value;
                              setCategoriesItems(newItems);
                            }}
                            className="w-full h-9 border border-gray-200 focus:border-primary focus:ring-0 text-xs px-3 bg-neutral-50 rounded-md"
                            placeholder="Belgian Linen"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">
                            Subtitle / Description (Max 150)
                          </label>
                          <input
                            required
                            type="text"
                            maxLength={150}
                            value={item.subtitle}
                            onChange={(e) => {
                              const newItems = [...categoriesItems];
                              newItems[idx].subtitle = e.target.value;
                              setCategoriesItems(newItems);
                            }}
                            className="w-full h-9 border border-gray-200 focus:border-primary focus:ring-0 text-xs px-3 bg-neutral-50 rounded-md"
                            placeholder="Pure flax linen shirts for breathable luxury"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                          <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">
                            CTA Link URL
                          </label>
                          <input
                            required
                            type="text"
                            maxLength={200}
                            value={item.cta_url}
                            onChange={(e) => {
                              const newItems = [...categoriesItems];
                              newItems[idx].cta_url = e.target.value;
                              setCategoriesItems(newItems);
                            }}
                            className="w-full h-9 border border-gray-200 focus:border-primary focus:ring-0 text-xs px-3 bg-neutral-50 rounded-md"
                            placeholder="/shopallshirts"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">
                            Theme Style Preset
                          </label>
                          <select
                            value={item.theme}
                            onChange={(e) => {
                              const newItems = [...categoriesItems];
                              newItems[idx].theme = e.target.value as any;
                              setCategoriesItems(newItems);
                            }}
                            className="w-full h-9 border border-gray-200 focus:border-primary focus:ring-0 text-xs px-3 bg-neutral-50 rounded-md font-bold"
                          >
                            <option value="navy">Classic Navy</option>
                            <option value="crimson">Crimson Red</option>
                            <option value="linen">Sage Linen</option>
                            <option value="charcoal">Charcoal Grey</option>
                            <option value="cream">Cream Purple</option>
                          </select>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 block">
                            Category Image
                          </label>
                          {item.image_url ? (
                            <div className="flex items-center gap-3">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={item.image_url} className="w-12 h-16 object-cover border border-gray-200 rounded-md" alt="Category thumbnail" />
                              <div className="flex flex-col gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setUploadTarget("category");
                                    setActiveUploadCategoryIndex(idx);
                                    setUploadOptions({});
                                    cloudinaryRef.current?.open();
                                  }}
                                  className="text-[9px] font-black uppercase tracking-widest text-primary hover:underline bg-transparent border-none p-0 cursor-pointer"
                                >
                                  Change
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newItems = [...categoriesItems];
                                    newItems[idx].image_url = "";
                                    setCategoriesItems(newItems);
                                  }}
                                  className="text-[9px] font-black uppercase tracking-widest text-red-500 hover:underline bg-transparent border-none p-0 cursor-pointer"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setUploadTarget("category");
                                setActiveUploadCategoryIndex(idx);
                                setUploadOptions({});
                                cloudinaryRef.current?.open();
                              }}
                              className="border border-dashed border-gray-300 px-4 py-2 text-center text-[10px] font-black uppercase tracking-widest text-gray-400 hover:border-primary hover:text-primary transition-all cursor-pointer bg-[#fbfbfb] rounded-md"
                            >
                              Upload Image
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {categoriesItems.length < 8 && (
                  <button
                    type="button"
                    onClick={() => {
                      setCategoriesItems([
                        ...categoriesItems,
                        { title: "New Category", subtitle: "Description...", image_url: "", theme: "navy", cta_url: "/shopallshirts" },
                      ]);
                    }}
                    className="border border-dashed border-gray-300 w-full py-4 text-center text-xs font-black uppercase tracking-widest text-gray-400 hover:border-primary hover:text-primary transition-all cursor-pointer bg-[#fbfbfb] rounded-md"
                  >
                    + Add Category Card
                  </button>
                )}
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  className="bg-[#1a1a1a] hover:bg-black text-white px-6 py-2.5 text-[13px] font-medium tracking-wide transition-all rounded-md cursor-pointer border-none shadow-sm block w-fit"
                >
                  Save Category Settings
                </button>
              </div>
            </form>
          </section>
        )}

        {/* Section 8: Reviews Moderator */}
        {activeTab === "reviews" && (
          <section className="bg-white border border-gray-150 rounded-xl p-6 shadow-sm">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div>
                <span className="text-[11px] font-black uppercase tracking-[0.08em] text-gray-400 block">
                  Review Moderation Portal
                </span>
                <p className="text-[10px] text-gray-400 italic mt-1">
                  Approve, reject, or correct customer reviews before they show on the storefront.
                </p>
              </div>

              {/* Sub-tabs for Pending / Approved */}
              <div className="flex border border-gray-200 rounded-md overflow-hidden shadow-sm">
                <button
                  type="button"
                  onClick={() => setActiveReviewsTab("pending")}
                  className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest cursor-pointer transition-all border-none ${
                    activeReviewsTab === "pending"
                      ? "bg-[#1a1a1a] text-white font-bold"
                      : "bg-white text-gray-600 hover:bg-neutral-50"
                  }`}
                >
                  Pending ({reviewsList.filter((r) => !r.approved).length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveReviewsTab("approved")}
                  className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest cursor-pointer transition-all border-none ${
                    activeReviewsTab === "approved"
                      ? "bg-[#1a1a1a] text-white font-bold"
                      : "bg-white text-gray-600 hover:bg-neutral-50"
                  }`}
                >
                  Approved ({reviewsList.filter((r) => r.approved).length})
                </button>
              </div>
            </div>

            <div className="space-y-6">
              {reviewsList.filter((r) => activeReviewsTab === "approved" ? r.approved : !r.approved).length === 0 ? (
                <div className="text-center py-12 text-xs font-black uppercase tracking-widest text-gray-400">
                  No {activeReviewsTab} reviews found.
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {reviewsList
                    .filter((r) => activeReviewsTab === "approved" ? r.approved : !r.approved)
                    .map((review) => {
                      const initial = review.name ? review.name.charAt(0).toUpperCase() : "?";
                      return (
                        <div key={review.id} className="py-6 first:pt-0 last:pb-0 flex flex-col md:flex-row gap-6 items-start">
                          {/* User avatar/initial and header */}
                          <div className="flex items-center gap-4 w-full md:w-1/4">
                            <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center font-bold text-primary border border-gray-200 text-xs shrink-0 select-none">
                              {initial}
                            </div>
                            <div className="overflow-hidden">
                              <h4 className="text-xs font-black uppercase tracking-widest text-[#0a0a0a] truncate">
                                {review.name}
                              </h4>
                              <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest truncate mt-0.5">
                                {review.location}
                              </p>
                              {/* Stars */}
                              <div className="flex gap-0.5 mt-1 text-[#fed488]">
                                {Array.from({ length: 5 }).map((_, i) => {
                                  const currentRating = activeReviewsTab === "pending"
                                    ? (editingRatingMap[review.id] ?? review.rating)
                                    : review.rating;
                                  return (
                                    <span
                                      key={i}
                                      onClick={() => {
                                        if (activeReviewsTab === "pending") {
                                          setEditingRatingMap({
                                            ...editingRatingMap,
                                            [review.id]: i + 1,
                                          });
                                        }
                                      }}
                                      className={`material-symbols-outlined text-sm font-bold ${
                                        activeReviewsTab === "pending" ? "cursor-pointer hover:scale-110 transition-transform" : ""
                                      }`}
                                    >
                                      {i < currentRating ? "star" : "star_outline"}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          </div>

                          {/* Comment Content */}
                          <div className="flex-1 w-full space-y-3">
                            {activeReviewsTab === "pending" ? (
                              <textarea
                                value={editingCommentMap[review.id] || ""}
                                onChange={(e) => {
                                  setEditingCommentMap({
                                    ...editingCommentMap,
                                    [review.id]: e.target.value,
                                  });
                                }}
                                className="w-full border border-gray-200 focus:border-primary focus:ring-0 text-xs p-3 bg-neutral-50 rounded-md h-20 resize-none"
                              />
                            ) : (
                              <p className="text-xs text-gray-600 leading-relaxed font-medium">
                                "{review.comment}"
                              </p>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex md:flex-col gap-2 w-full md:w-auto md:items-end justify-end self-stretch shrink-0">
                            {activeReviewsTab === "pending" ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleApproveReview(review.id)}
                                  className="bg-primary text-white px-4 py-2 text-[9px] font-black uppercase tracking-widest hover:bg-secondary transition-all rounded-md cursor-pointer border-none shrink-0"
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateReviewComment(review.id)}
                                  className="border border-gray-200 text-[#0a0a0a] px-4 py-2 text-[9px] font-black uppercase tracking-widest hover:bg-neutral-50 transition-all rounded-md cursor-pointer shrink-0"
                                >
                                  Update Review
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRejectReview(review.id)}
                                  className="border border-red-200 text-red-600 px-4 py-2 text-[9px] font-black uppercase tracking-widest hover:bg-red-50 transition-all rounded-md cursor-pointer shrink-0"
                                >
                                  Reject
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleRejectReview(review.id)}
                                className="border border-red-200 text-red-600 px-4 py-2 text-[9px] font-black uppercase tracking-widest hover:bg-red-50 transition-all rounded-md cursor-pointer shrink-0"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Section 9: Shipping Settings */}
        {activeTab === "shipping" && (
          <section className="bg-white border border-gray-150 rounded-xl p-6 shadow-sm">
            <header className="mb-8 border-b border-gray-100 pb-4">
              <h3 className="text-xl font-headline font-black tracking-tight text-primary uppercase">
                Delivery Charges
              </h3>
              <p className="text-xs text-gray-500 mt-1 uppercase tracking-widest font-bold opacity-60">
                Configure shipping costs for customer orders
              </p>
            </header>

            <form onSubmit={handleSaveShipping} className="space-y-8">
              {/* Radio Group for Shipping Modes */}
              <div className="space-y-4">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 block mb-2">
                  Shipping Mode
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { id: "free_always", title: "Free Always", desc: "All orders ship for free" },
                    { id: "flat_rate", title: "Flat Rate", desc: "Charge a fixed amount per order" },
                    { id: "free_above", title: "Free Above Amount (Recommended)", desc: "Free shipping above a minimum order value" },
                    { id: "paid_always", title: "Always Paid", desc: "Always charge shipping" },
                  ].map((modeOption) => (
                    <label
                      key={modeOption.id}
                      className={`flex items-start gap-4 border p-5 rounded-lg cursor-pointer transition-all ${
                        shippingMode === modeOption.id
                          ? "border-[#BA7517] bg-[#BA7517]/5"
                          : "border-gray-200 hover:bg-neutral-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="shippingMode"
                        value={modeOption.id}
                        checked={shippingMode === modeOption.id}
                        onChange={() => setShippingMode(modeOption.id as any)}
                        className="text-[#BA7517] focus:ring-[#BA7517] mt-1 border-gray-300"
                      />
                      <div className="flex flex-col text-left">
                        <span className="text-xs font-black uppercase tracking-wider text-primary">
                          {modeOption.title}
                        </span>
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                          {modeOption.desc}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Conditional Input Fields */}
              {(shippingMode === "flat_rate" || shippingMode === "paid_always" || shippingMode === "free_above") && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-neutral-50 border border-gray-200 p-6 rounded-lg">
                  {(shippingMode === "flat_rate" || shippingMode === "paid_always" || shippingMode === "free_above") && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 block">
                        Flat Rate Shipping Amount (₹)
                      </label>
                      <input
                        required
                        type="number"
                        min={0}
                        value={shippingFlatRate}
                        onChange={(e) => setShippingFlatRate(Number(e.target.value))}
                        className="w-full h-9 border border-gray-200 focus:border-primary focus:ring-0 text-xs px-3 bg-white rounded-md font-bold"
                      />
                    </div>
                  )}

                  {shippingMode === "free_above" && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 block">
                        Free Above Order Value Threshold (₹)
                      </label>
                      <input
                        required
                        type="number"
                        min={0}
                        value={shippingFreeAboveAmount}
                        onChange={(e) => setShippingFreeAboveAmount(Number(e.target.value))}
                        className="w-full h-9 border border-gray-200 focus:border-primary focus:ring-0 text-xs px-3 bg-white rounded-md font-bold"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Promotional Message Input */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 block">
                  Promotional Message
                </label>
                <input
                  required
                  type="text"
                  value={shippingDisplayMessage}
                  onChange={(e) => setShippingDisplayMessage(e.target.value)}
                  className="w-full h-9 border border-gray-200 focus:border-primary focus:ring-0 text-xs px-3 bg-white rounded-md font-semibold"
                  placeholder="e.g. Free shipping on orders above ₹999"
                />
                <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block mt-1">
                  Shown in the global announcement marquee bar and checkout page.
                </span>
              </div>

              {/* Live Preview Card */}
              <div className="border border-dashed border-[#BA7517]/40 bg-[#BA7517]/5 p-6 rounded-lg space-y-4">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#BA7517] block">
                  Interactive Preview (Customer Experience)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-bold uppercase tracking-wider">
                  <div className="bg-white p-4 border border-[#BA7517]/10 rounded shadow-sm space-y-2">
                    <p className="text-gray-400 text-[10px] tracking-widest">Order value: ₹300</p>
                    <p className="text-sm font-black">
                      Shipping: ₹
                      {calculateShipping(300, {
                        mode: shippingMode,
                        flatRate: Number(shippingFlatRate || 0),
                        freeAboveAmount: Number(shippingFreeAboveAmount || 0),
                        displayMessage: shippingDisplayMessage,
                      })}
                    </p>
                    <p className="text-[9px] text-[#BA7517] normal-case italic font-medium font-sans">
                      {getShippingMessage(300, {
                        mode: shippingMode,
                        flatRate: Number(shippingFlatRate || 0),
                        freeAboveAmount: Number(shippingFreeAboveAmount || 0),
                        displayMessage: shippingDisplayMessage,
                      })}
                    </p>
                  </div>

                  <div className="bg-white p-4 border border-[#BA7517]/10 rounded shadow-sm space-y-2">
                    <p className="text-gray-400 text-[10px] tracking-widest">
                      Order value: ₹{shippingFreeAboveAmount || 999}
                    </p>
                    <p className="text-sm font-black text-green-600">
                      Shipping:{" "}
                      {calculateShipping(Number(shippingFreeAboveAmount || 0), {
                        mode: shippingMode,
                        flatRate: Number(shippingFlatRate || 0),
                        freeAboveAmount: Number(shippingFreeAboveAmount || 0),
                        displayMessage: shippingDisplayMessage,
                      }) === 0
                        ? "FREE ✓"
                        : `₹${calculateShipping(Number(shippingFreeAboveAmount || 0), {
                            mode: shippingMode,
                            flatRate: Number(shippingFlatRate || 0),
                            freeAboveAmount: Number(shippingFreeAboveAmount || 0),
                            displayMessage: shippingDisplayMessage,
                          })}`}
                    </p>
                    <p className="text-[9px] text-[#BA7517] normal-case italic font-medium font-sans">
                      {getShippingMessage(Number(shippingFreeAboveAmount || 0), {
                        mode: shippingMode,
                        flatRate: Number(shippingFlatRate || 0),
                        freeAboveAmount: Number(shippingFreeAboveAmount || 0),
                        displayMessage: shippingDisplayMessage,
                      })}
                    </p>
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <div className="pt-4 border-t border-gray-100 flex justify-end">
                <button
                  type="submit"
                  className="bg-black text-white px-8 py-3 text-[10px] font-black uppercase tracking-widest hover:bg-[#775a19] transition-all rounded-md cursor-pointer border-none shadow-md"
                >
                  Save Shipping Settings
                </button>
              </div>
            </form>
          </section>
        )}
        {/* Section 10: Store Identity Settings */}
        {activeTab === "store_identity" && (
          <section className="bg-white border border-gray-150 rounded-xl p-6 shadow-sm">
            <header className="mb-8 border-b border-gray-100 pb-4">
              <h3 className="text-xl font-headline font-black tracking-tight text-primary uppercase">
                Store Identity
              </h3>
              <p className="text-xs text-gray-500 mt-1 uppercase tracking-widest font-bold opacity-60">
                Configure store branding and support channels
              </p>
            </header>

            <form onSubmit={handleSaveStoreIdentity} className="space-y-6">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-[#0a0a0a] mb-3">
                  Store Name
                </label>
                <input
                  required
                  type="text"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="e.g. 6K Designer Shirts"
                  className="w-full h-9 border border-gray-200 focus:border-primary focus:ring-0 text-xs px-3 bg-white rounded-md font-semibold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-[#0a0a0a] mb-3">
                  Store Logo URL
                </label>
                <input
                  type="text"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://res.cloudinary.com/..."
                  className="w-full h-9 border border-gray-200 focus:border-primary focus:ring-0 text-xs px-3 bg-white rounded-md font-semibold"
                />
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-2">
                  Upload your logo to Cloudinary or similar service, then paste the direct URL here.
                </p>
                {logoUrl && (
                  <div className="mt-4 p-3 bg-gray-50 border border-gray-100 rounded-lg inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logoUrl} alt="Store Logo Preview" className="h-12 w-auto object-contain" />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-[#0a0a0a] mb-3">
                    Support Email Address
                  </label>
                  <input
                    required
                    type="email"
                    value={supportEmail}
                    onChange={(e) => setSupportEmail(e.target.value)}
                    placeholder="support@the6k.com"
                    className="w-full h-9 border border-gray-200 focus:border-primary focus:ring-0 text-xs px-3 bg-white rounded-md font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-[#0a0a0a] mb-3">
                    Support Phone Number
                  </label>
                  <input
                    required
                    type="text"
                    value={supportPhone}
                    onChange={(e) => setSupportPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full h-9 border border-gray-200 focus:border-primary focus:ring-0 text-xs px-3 bg-white rounded-md font-semibold"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end">
                <button
                  type="submit"
                  className="bg-black text-white px-8 py-3 text-[10px] font-black uppercase tracking-widest hover:bg-[#775a19] transition-all rounded-md cursor-pointer border-none shadow-md"
                >
                  Save Store Identity
                </button>
              </div>
            </form>
          </section>
        )}

        {/* Section 11: Loyalty & Points Settings */}
        {activeTab === "loyalty" && (
          <section className="bg-white border border-gray-150 rounded-xl p-6 shadow-sm">
            <header className="mb-8 border-b border-gray-100 pb-4">
              <h3 className="text-xl font-headline font-black tracking-tight text-primary uppercase">
                Loyalty & Reward Points
              </h3>
              <p className="text-xs text-gray-500 mt-1 uppercase tracking-widest font-bold opacity-60">
                Configure reward points accrual and redemption values
              </p>
            </header>

            <form onSubmit={handleSaveLoyalty} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 block">
                    Points per ₹100 spent
                  </label>
                  <input
                    required
                    type="number"
                    min={1}
                    value={pointsPer100}
                    onChange={(e) => setPointsPer100(Number(e.target.value))}
                    className="w-full h-9 border border-gray-200 focus:border-primary focus:ring-0 text-xs px-3 bg-white rounded-md font-bold"
                  />
                  <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block mt-1">
                    Accrual rate (default: 5)
                  </span>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 block">
                    Rupee value per point (₹)
                  </label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min={0.01}
                    value={rupeesPerPoint}
                    onChange={(e) => setRupeesPerPoint(Number(e.target.value))}
                    className="w-full h-9 border border-gray-200 focus:border-primary focus:ring-0 text-xs px-3 bg-white rounded-md font-bold"
                  />
                  <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block mt-1">
                    Redemption value (default: ₹0.50)
                  </span>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 block">
                    Minimum points to redeem
                  </label>
                  <input
                    required
                    type="number"
                    min={1}
                    value={minRedeemPoints}
                    onChange={(e) => setMinRedeemPoints(Number(e.target.value))}
                    className="w-full h-9 border border-gray-200 focus:border-primary focus:ring-0 text-xs px-3 bg-white rounded-md font-bold"
                  />
                  <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block mt-1">
                    Redemption eligibility (default: 100)
                  </span>
                </div>
              </div>

              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-2 text-[10px] text-amber-800 font-bold">
                <p className="uppercase tracking-wider">Note on checkout calculation:</p>
                <p className="font-semibold normal-case text-xs leading-relaxed">
                  Accrued points and rupee values are processed at checkout. Saving here updates the store policies in database.
                </p>
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end">
                <button
                  type="submit"
                  className="bg-black text-white px-8 py-3 text-[10px] font-black uppercase tracking-widest hover:bg-[#775a19] transition-all rounded-md cursor-pointer border-none shadow-md"
                >
                  Save Loyalty Rules
                </button>
              </div>
            </form>
          </section>
        )}

        {/* Section 12: Shiprocket Settings */}
        {activeTab === "shiprocket" && (
          <section className="bg-white border border-gray-150 rounded-xl p-6 shadow-sm">
            <header className="mb-8 border-b border-gray-100 pb-4">
              <h3 className="text-xl font-headline font-black tracking-tight text-primary uppercase">
                Shiprocket Configuration
              </h3>
              <p className="text-xs text-gray-500 mt-1 uppercase tracking-widest font-bold opacity-60">
                Manage logistics and shipment dispatch address settings
              </p>
            </header>

            <form onSubmit={handleSaveShiprocket} className="space-y-6">
              <div className="p-4 bg-blue-50 border border-blue-200 text-blue-800 text-[10px] rounded-lg font-bold">
                ℹ️ Changes here update the database config. You still need to update .env for SHIPROCKET_PICKUP_LOCATION on server restarts.
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-[#0a0a0a] mb-3">
                    Pickup Location Name
                  </label>
                  <input
                    required
                    type="text"
                    value={pickupLocationName}
                    onChange={(e) => setPickupLocationName(e.target.value)}
                    placeholder="e.g. CHENNAI_WAREHOUSE"
                    className="w-full h-9 border border-gray-200 focus:border-primary focus:ring-0 text-xs px-3 bg-white rounded-md font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-[#0a0a0a] mb-3">
                    Pickup Pincode
                  </label>
                  <input
                    required
                    type="text"
                    maxLength={6}
                    value={pickupPincode}
                    onChange={(e) => setPickupPincode(e.target.value)}
                    placeholder="600001"
                    className="w-full h-9 border border-gray-200 focus:border-primary focus:ring-0 text-xs px-3 bg-white rounded-md font-semibold"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-[#0a0a0a] mb-3">
                    Pickup Address Line 1
                  </label>
                  <input
                    required
                    type="text"
                    value={pickupAddress}
                    onChange={(e) => setPickupAddress(e.target.value)}
                    placeholder="e.g. 12, Nungambakkam High Road"
                    className="w-full h-9 border border-gray-200 focus:border-primary focus:ring-0 text-xs px-3 bg-white rounded-md font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-[#0a0a0a] mb-3">
                    Pickup City
                  </label>
                  <input
                    required
                    type="text"
                    value={pickupCity}
                    onChange={(e) => setPickupCity(e.target.value)}
                    placeholder="Chennai"
                    className="w-full h-9 border border-gray-200 focus:border-primary focus:ring-0 text-xs px-3 bg-white rounded-md font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-[#0a0a0a] mb-3">
                    Pickup State
                  </label>
                  <input
                    required
                    type="text"
                    value={pickupState}
                    onChange={(e) => setPickupState(e.target.value)}
                    placeholder="Tamil Nadu"
                    className="w-full h-9 border border-gray-200 focus:border-primary focus:ring-0 text-xs px-3 bg-white rounded-md font-semibold"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-[#0a0a0a] mb-3">
                    Pickup Contact Phone
                  </label>
                  <input
                    required
                    type="text"
                    value={pickupPhone}
                    onChange={(e) => setPickupPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full h-9 border border-gray-200 focus:border-primary focus:ring-0 text-xs px-3 bg-white rounded-md font-semibold"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end">
                <button
                  type="submit"
                  className="bg-black text-white px-8 py-3 text-[10px] font-black uppercase tracking-widest hover:bg-[#775a19] transition-all rounded-md cursor-pointer border-none shadow-md"
                >
                  Save Shiprocket Config
                </button>
              </div>
            </form>
          </section>
        )}
      </div>
    </div>
  );
}
