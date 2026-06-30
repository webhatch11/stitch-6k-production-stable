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
} from "@/app/actions/admin-settings";

export default function SettingsDashboardPage() {
  const router = useRouter();

  // Cloudinary Widget Ref
  const cloudinaryRef = useRef<CloudinaryUploadHandle>(null);

  // States for Hero Settings
  const [heroImage, setHeroImage] = useState("");
  const [heroHeadline, setHeroHeadline] = useState("");
  const [heroSubheadline, setHeroSubheadline] = useState("");
  const [heroCtaText, setHeroCtaText] = useState("");
  const [heroCtaUrl, setHeroCtaUrl] = useState("");
  const [heroSlides, setHeroSlides] = useState<{ image_url: string; headline: string; subheadline: string; cta_text: string; cta_url: string }[]>([]);
  const [activeUploadHeroSlideIndex, setActiveUploadHeroSlideIndex] = useState<number | null>(null);


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
  const [activeTab, setActiveTab] = useState<"hero" | "business" | "flags" | "marquee" | "offer_box" | "trust_badges" | "categories" | "reviews">("hero");

  // States for Trust Badges
  const [trustBadgesEnabled, setTrustBadgesEnabled] = useState(true);
  const [trustBadgesItems, setTrustBadgesItems] = useState<{ icon: string; title: string; description: string }[]>([]);

  // States for Categories
  const [categoriesEnabled, setCategoriesEnabled] = useState(true);
  const [categoriesItems, setCategoriesItems] = useState<{ title: string; subtitle: string; image_url: string; theme: "navy" | "crimson" | "linen" | "charcoal" | "cream"; cta_url: string }[]>([]);

  // States for Reviews
  const [reviewsList, setReviewsList] = useState<any[]>([]);
  const [editingCommentMap, setEditingCommentMap] = useState<{ [id: string]: string }>({});
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
      const [heroRes, bizRes, flagsRes, marqueeRes, offerRes, trustRes, categoriesRes] = await Promise.all([
        getSettingAction("hero"),
        getSettingAction("business"),
        getSettingAction("flags"),
        getSettingAction("marquee"),
        getSettingAction("offer_box"),
        getSettingAction("trust_badges"),
        getSettingAction("categories"),
      ]);

      if (heroRes.success && heroRes.value) {
        setHeroImage(heroRes.value.image_url || "");
        setHeroHeadline(heroRes.value.headline || "");
        setHeroSubheadline(heroRes.value.subheadline || "");
        setHeroCtaText(heroRes.value.cta_text || "");
        setHeroCtaUrl(heroRes.value.cta_url || "");
        setHeroSlides(heroRes.value.slides || []);
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
      headline: heroHeadline,
      subheadline: heroSubheadline,
      cta_text: heroCtaText,
      cta_url: heroCtaUrl,
      slides: heroSlides,
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

  const loadReviews = async () => {
    const res = await getReviewsAction();
    if (res.success && res.value) {
      setReviewsList(res.value);
      // Initialize edit comments map
      const editMap: { [id: string]: string } = {};
      res.value.forEach((r: any) => {
        editMap[r.id] = r.comment;
      });
      setEditingCommentMap(editMap);
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
    if (!comment.trim()) {
      triggerToast("Comment cannot be empty");
      return;
    }
    const res = await updateReviewAction(id, comment);
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
            const newSlides = [...heroSlides];
            newSlides[activeUploadHeroSlideIndex].image_url = newUrl;
            setHeroSlides(newSlides);
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
          { id: "flags", label: "Feature Flags" },
          { id: "marquee", label: "Marquee" },
          { id: "offer_box", label: "Offer Box" },
          { id: "trust_badges", label: "Trust Badges" },
          { id: "categories", label: "Categories" },
          { id: "reviews", label: "Reviews" },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`pb-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? "border-primary text-primary"
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
          <section className="bg-white border border-gray-200 shadow-sm overflow-hidden rounded-none">
            <div className="p-8 border-b border-gray-200 bg-[#fafafa]">
              <h3 className="font-headline font-black text-xs uppercase tracking-[0.3em] text-primary">
                Homepage Hero Editor
              </h3>
            </div>
            <form onSubmit={handleSaveHero} className="p-8 space-y-6">
            {/* Cloudinary Upload */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 block">
                Hero Background Image
              </label>
              {heroImage ? (
                <div className="space-y-4">
                  <div className="relative w-full max-w-md h-48 bg-neutral-100 border border-gray-200 overflow-hidden flex items-center justify-center">
                    <img src={heroImage} alt="Hero preview" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => {
                        setUploadTarget("hero");
                        cloudinaryRef.current?.open();
                      }}
                      className="border border-gray-200 text-primary px-6 py-2.5 text-[10px] font-black uppercase tracking-widest hover:bg-neutral-50 transition-all rounded-none cursor-pointer"
                    >
                      Change Image
                    </button>
                    <button
                      type="button"
                      onClick={() => setHeroImage("")}
                      className="border border-red-200 text-red-600 px-6 py-2.5 text-[10px] font-black uppercase tracking-widest hover:bg-red-50 transition-all rounded-none cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setUploadTarget("hero");
                    cloudinaryRef.current?.open();
                  }}
                  className="w-full max-w-md border border-dashed border-gray-300 py-12 text-center text-xs text-gray-400 hover:border-primary transition-colors cursor-pointer bg-[#fbfbfb]"
                >
                  <span className="material-symbols-outlined text-3xl block mb-2 opacity-50">cloud_upload</span>
                  Upload Custom Hero Image (Cloudinary)
                </button>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 block">
                Headline
              </label>
              <input
                required
                type="text"
                maxLength={120}
                value={heroHeadline}
                onChange={(e) => setHeroHeadline(e.target.value)}
                className="w-full border border-gray-200 focus:border-primary focus:ring-0 font-bold text-sm py-3 px-4 rounded-none"
                placeholder="PREDEFINING LUXURY"
              />
              <span className="text-[9px] text-gray-400 block text-right">{heroHeadline.length}/120 characters</span>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 block">
                Subheadline
              </label>
              <textarea
                maxLength={300}
                value={heroSubheadline}
                onChange={(e) => setHeroSubheadline(e.target.value)}
                className="w-full border border-gray-200 focus:border-primary focus:ring-0 text-sm py-3 px-4 rounded-none h-24 resize-none"
                placeholder="Heritage craftsmanship meets Gen-Z streetwear."
              />
              <span className="text-[9px] text-gray-400 block text-right">{heroSubheadline.length}/300 characters</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 block">
                  CTA Button Text
                </label>
                <input
                  required
                  type="text"
                  maxLength={40}
                  value={heroCtaText}
                  onChange={(e) => setHeroCtaText(e.target.value)}
                  className="w-full border border-gray-200 focus:border-primary focus:ring-0 text-sm py-3 px-4 rounded-none"
                  placeholder="Shop Collection"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 block">
                  CTA URL
                </label>
                <input
                  required
                  type="text"
                  maxLength={200}
                  value={heroCtaUrl}
                  onChange={(e) => setHeroCtaUrl(e.target.value)}
                  className="w-full border border-gray-200 focus:border-primary focus:ring-0 text-sm py-3 px-4 rounded-none"
                  placeholder="/shopallshirts"
                />
              </div>
            </div>

            {/* Carousel Slides Section */}
            <div className="border-t border-gray-200 pt-8 space-y-6">
              <h4 className="font-headline font-black text-xs uppercase tracking-[0.2em] text-[#0a0a0a]">
                Carousel Slides (Optional)
              </h4>
              <p className="text-[11px] text-gray-500 font-bold uppercase tracking-widest opacity-80">
                If slides are specified, the storefront will render a sliding carousel instead of a single hero image.
              </p>

              <div className="space-y-6">
                {heroSlides.map((slide, idx) => (
                  <div key={idx} className="bg-neutral-50 border border-gray-200 p-6 space-y-4 relative">
                    <div className="flex justify-between items-center border-b border-gray-200 pb-3">
                      <span className="text-xs font-black uppercase tracking-widest text-primary">
                        Slide #{idx + 1}
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => {
                            const newSlides = [...heroSlides];
                            const temp = newSlides[idx];
                            newSlides[idx] = newSlides[idx - 1];
                            newSlides[idx - 1] = temp;
                            setHeroSlides(newSlides);
                          }}
                          className="text-gray-500 hover:text-primary text-[10px] uppercase font-black tracking-widest disabled:opacity-30 disabled:pointer-events-none"
                        >
                          Up
                        </button>
                        <button
                          type="button"
                          disabled={idx === heroSlides.length - 1}
                          onClick={() => {
                            const newSlides = [...heroSlides];
                            const temp = newSlides[idx];
                            newSlides[idx] = newSlides[idx + 1];
                            newSlides[idx + 1] = temp;
                            setHeroSlides(newSlides);
                          }}
                          className="text-gray-500 hover:text-primary text-[10px] uppercase font-black tracking-widest disabled:opacity-30 disabled:pointer-events-none"
                        >
                          Down
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setHeroSlides(heroSlides.filter((_, i) => i !== idx));
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
                          Headline (Max 120)
                        </label>
                        <input
                          required
                          type="text"
                          maxLength={120}
                          value={slide.headline}
                          onChange={(e) => {
                            const newSlides = [...heroSlides];
                            newSlides[idx].headline = e.target.value;
                            setHeroSlides(newSlides);
                          }}
                          className="w-full border border-gray-200 focus:border-primary focus:ring-0 text-sm py-2.5 px-3 rounded-none"
                          placeholder="PREDEFINING LUXURY"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">
                          Subheadline (Max 300)
                        </label>
                        <input
                          type="text"
                          maxLength={300}
                          value={slide.subheadline}
                          onChange={(e) => {
                            const newSlides = [...heroSlides];
                            newSlides[idx].subheadline = e.target.value;
                            setHeroSlides(newSlides);
                          }}
                          className="w-full border border-gray-200 focus:border-primary focus:ring-0 text-sm py-2.5 px-3 rounded-none"
                          placeholder="Heritage craftsmanship meets street style."
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">
                          CTA Button Text (Max 40)
                        </label>
                        <input
                          required
                          type="text"
                          maxLength={40}
                          value={slide.cta_text}
                          onChange={(e) => {
                            const newSlides = [...heroSlides];
                            newSlides[idx].cta_text = e.target.value;
                            setHeroSlides(newSlides);
                          }}
                          className="w-full border border-gray-200 focus:border-primary focus:ring-0 text-sm py-2.5 px-3 rounded-none"
                          placeholder="Shop Collection"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">
                          CTA Link URL (Max 200)
                        </label>
                        <input
                          required
                          type="text"
                          maxLength={200}
                          value={slide.cta_url}
                          onChange={(e) => {
                            const newSlides = [...heroSlides];
                            newSlides[idx].cta_url = e.target.value;
                            setHeroSlides(newSlides);
                          }}
                          className="w-full border border-gray-200 focus:border-primary focus:ring-0 text-sm py-2.5 px-3 rounded-none"
                          placeholder="/shopallshirts"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 block">
                          Slide Background Image
                        </label>
                        {slide.image_url ? (
                          <div className="flex items-center gap-3">
                            <img src={slide.image_url} className="w-16 h-10 object-cover border border-gray-200" alt="Slide preview" />
                            <div className="flex flex-col gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setUploadTarget("hero_slide");
                                  setActiveUploadHeroSlideIndex(idx);
                                  cloudinaryRef.current?.open();
                                }}
                                className="text-[9px] font-black uppercase tracking-widest text-primary hover:underline bg-transparent border-none p-0 cursor-pointer"
                              >
                                Change
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const newSlides = [...heroSlides];
                                  newSlides[idx].image_url = "";
                                  setHeroSlides(newSlides);
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
                              setUploadTarget("hero_slide");
                              setActiveUploadHeroSlideIndex(idx);
                              cloudinaryRef.current?.open();
                            }}
                            className="border border-dashed border-gray-300 px-4 py-2 text-center text-[10px] font-black uppercase tracking-widest text-gray-400 hover:border-primary hover:text-primary transition-all cursor-pointer bg-[#fbfbfb]"
                          >
                            Upload Image
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {heroSlides.length < 6 && (
                <button
                  type="button"
                  onClick={() => {
                    setHeroSlides([
                      ...heroSlides,
                      { image_url: "", headline: "New Slide", subheadline: "Description...", cta_text: "Shop Now", cta_url: "/shopallshirts" },
                    ]);
                  }}
                  className="border border-dashed border-gray-300 w-full py-4 text-center text-xs font-black uppercase tracking-widest text-gray-400 hover:border-primary hover:text-primary transition-all cursor-pointer bg-[#fbfbfb]"
                >
                  + Add Slide Card
                </button>
              )}
            </div>

            <div className="pt-4">

              <button
                type="submit"
                className="bg-primary text-white px-8 py-3.5 text-xs font-black uppercase tracking-[0.2em] hover:bg-secondary transition-all shadow-lg rounded-none cursor-pointer border-none font-bold"
              >
                Save Hero Settings
              </button>
            </div>
          </form>
        </section>
        )}

        {/* Section 2: Business Info */}
        {activeTab === "business" && (
        <section className="bg-white border border-gray-200 shadow-sm overflow-hidden rounded-none">
          <div className="p-8 border-b border-gray-200 bg-[#fafafa]">
            <h3 className="font-headline font-black text-xs uppercase tracking-[0.3em] text-primary">
              Business Information
            </h3>
          </div>
          <form onSubmit={handleSaveBusiness} className="p-8 space-y-6">
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
                  className="w-full border border-gray-200 focus:border-primary focus:ring-0 text-sm py-3 px-4 rounded-none"
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
                  className="w-full border border-gray-200 focus:border-primary focus:ring-0 text-sm py-3 px-4 rounded-none"
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
                className="w-full border border-gray-200 focus:border-primary focus:ring-0 text-sm py-3 px-4 rounded-none h-24 resize-none"
                placeholder="123 Luxury Lane, Atelier Block..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 block">
                  GST Number
                </label>
                <input
                  type="text"
                  maxLength={50}
                  value={bizGst}
                  onChange={(e) => setBizGst(e.target.value)}
                  className="w-full border border-gray-200 focus:border-primary focus:ring-0 text-sm py-3 px-4 rounded-none"
                  placeholder="GSTIN12345..."
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 block">
                  Instagram Profile URL
                </label>
                <input
                  type="text"
                  maxLength={200}
                  value={bizInstagram}
                  onChange={(e) => setBizInstagram(e.target.value)}
                  className="w-full border border-gray-200 focus:border-primary focus:ring-0 text-sm py-3 px-4 rounded-none"
                  placeholder="https://instagram.com/..."
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 block">
                  Facebook Page URL
                </label>
                <input
                  type="text"
                  maxLength={200}
                  value={bizFacebook}
                  onChange={(e) => setBizFacebook(e.target.value)}
                  className="w-full border border-gray-200 focus:border-primary focus:ring-0 text-sm py-3 px-4 rounded-none"
                  placeholder="https://facebook.com/..."
                />
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                className="bg-primary text-white px-8 py-3.5 text-xs font-black uppercase tracking-[0.2em] hover:bg-secondary transition-all shadow-lg rounded-none cursor-pointer border-none font-bold"
              >
                Save Business details
              </button>
            </div>
          </form>
        </section>
        )}

        {/* Section 3: Feature Flags */}
        {activeTab === "flags" && (
        <section className="bg-white border border-gray-200 shadow-sm overflow-hidden rounded-none">
          <div className="p-8 border-b border-gray-200 bg-[#fafafa]">
            <h3 className="font-headline font-black text-xs uppercase tracking-[0.3em] text-primary">
              Feature Flags & Policy Rules
            </h3>
          </div>
          <form onSubmit={handleSaveFlags} className="p-8 space-y-6">
            <div className="flex items-center gap-3">
              <input
                id="cod-flag"
                type="checkbox"
                checked={flagCodEnabled}
                onChange={(e) => setFlagCodEnabled(e.target.checked)}
                className="w-4.5 h-4.5 border-gray-300 text-primary focus:ring-primary rounded-none cursor-pointer"
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
                className="w-full border border-gray-200 focus:border-primary focus:ring-0 font-bold text-sm py-3 px-4 rounded-none"
                placeholder="7"
              />
            </div>

            <div className="pt-4">
              <button
                type="submit"
                className="bg-primary text-white px-8 py-3.5 text-xs font-black uppercase tracking-[0.2em] hover:bg-secondary transition-all shadow-lg rounded-none cursor-pointer border-none font-bold"
              >
                Save Feature Flags
              </button>
            </div>
          </form>
        </section>
        )}

        {/* Section 4: Marquee Settings */}
        {activeTab === "marquee" && (
        <section className="bg-white border border-gray-200 shadow-sm overflow-hidden rounded-none">
          <div className="p-8 border-b border-gray-200 bg-[#fafafa]">
            <h3 className="font-headline font-black text-xs uppercase tracking-[0.3em] text-primary">
              Announcement Marquee Editor
            </h3>
          </div>
          <form onSubmit={handleSaveMarquee} className="p-8 space-y-6">
            <div className="flex items-center gap-3">
              <input
                id="marquee-enabled"
                type="checkbox"
                checked={marqueeEnabled}
                onChange={(e) => setMarqueeEnabled(e.target.checked)}
                className="w-4.5 h-4.5 border-gray-300 text-primary focus:ring-primary rounded-none cursor-pointer"
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
                  <div key={idx} className="flex items-center gap-3 bg-neutral-50 border border-gray-200 p-2.5">
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
                    className="flex-1 border border-gray-200 focus:border-primary focus:ring-0 text-sm py-2 px-3 rounded-none"
                  />
                  <button
                    type="button"
                    onClick={addMarqueeItem}
                    className="bg-neutral-800 hover:bg-neutral-900 text-white px-6 py-2 text-[10px] font-black uppercase tracking-widest transition-all rounded-none"
                  >
                    Add Item
                  </button>
                </div>
              )}
            </div>

            <div className="pt-4">
              <button
                type="submit"
                className="bg-primary text-white px-8 py-3.5 text-xs font-black uppercase tracking-[0.2em] hover:bg-secondary transition-all shadow-lg rounded-none cursor-pointer border-none font-bold"
              >
                Save Marquee Settings
              </button>
            </div>
          </form>
        </section>
        )}

        {/* Section 5: Offer Box Settings */}
        {activeTab === "offer_box" && (
        <section className="bg-white border border-gray-200 shadow-sm overflow-hidden rounded-none">
          <div className="p-8 border-b border-gray-200 bg-[#fafafa]">
            <h3 className="font-headline font-black text-xs uppercase tracking-[0.3em] text-primary">
              Homepage Offer Box Editor
            </h3>
          </div>
          <form onSubmit={handleSaveOfferBox} className="p-8 space-y-6">
            <div className="flex items-center gap-3">
              <input
                id="offer-enabled"
                type="checkbox"
                checked={offerEnabled}
                onChange={(e) => setOfferEnabled(e.target.checked)}
                className="w-4.5 h-4.5 border-gray-300 text-primary focus:ring-primary rounded-none cursor-pointer"
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
                  className="w-full border border-gray-200 focus:border-primary focus:ring-0 text-sm py-3 px-4 rounded-none"
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
                  className="w-full border border-gray-200 focus:border-primary focus:ring-0 text-sm py-3 px-4 rounded-none"
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
                className="w-full border border-gray-200 focus:border-primary focus:ring-0 text-sm py-3 px-4 rounded-none h-20 resize-none"
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
                  className="w-full border border-gray-200 focus:border-primary focus:ring-0 text-sm py-3 px-4 rounded-none"
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
                  className="w-full border border-gray-200 focus:border-primary focus:ring-0 text-sm py-3 px-4 rounded-none"
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
                  className="w-full border border-gray-200 focus:border-primary focus:ring-0 text-sm py-3 px-4 rounded-none"
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
                  <div className="relative w-full max-w-md h-36 bg-neutral-100 border border-gray-200 overflow-hidden flex items-center justify-center">
                    <img src={offerBgImageUrl} alt="Offer Box preview" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => {
                        setUploadTarget("offer");
                        cloudinaryRef.current?.open();
                      }}
                      className="border border-gray-200 text-primary px-6 py-2.5 text-[10px] font-black uppercase tracking-widest hover:bg-neutral-50 transition-all rounded-none cursor-pointer"
                    >
                      Change Image
                    </button>
                    <button
                      type="button"
                      onClick={() => setOfferBgImageUrl("")}
                      className="border border-red-200 text-red-600 px-6 py-2.5 text-[10px] font-black uppercase tracking-widest hover:bg-red-50 transition-all rounded-none cursor-pointer"
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
                    cloudinaryRef.current?.open();
                  }}
                  className="w-full max-w-md border border-dashed border-gray-300 py-8 text-center text-xs text-gray-400 hover:border-primary transition-colors cursor-pointer bg-[#fbfbfb]"
                >
                  <span className="material-symbols-outlined text-2xl block mb-2 opacity-50">cloud_upload</span>
                  Upload Custom Background Image (Cloudinary)
                </button>
              )}
            </div>

            <div className="pt-4">
              <button
                type="submit"
                className="bg-primary text-white px-8 py-3.5 text-xs font-black uppercase tracking-[0.2em] hover:bg-secondary transition-all shadow-lg rounded-none cursor-pointer border-none font-bold"
              >
                Save Offer Box Settings
              </button>
            </div>
          </form>
        </section>
        )}

        {/* Section 6: Trust Badges Settings */}
        {activeTab === "trust_badges" && (
          <section className="bg-white border border-gray-200 shadow-sm overflow-hidden rounded-none">
            <div className="p-8 border-b border-gray-200 bg-[#fafafa]">
              <h3 className="font-headline font-black text-xs uppercase tracking-[0.3em] text-primary">
                Trust Badges Editor
              </h3>
            </div>
            <form onSubmit={handleSaveTrustBadges} className="p-8 space-y-6">
              <div className="flex items-center gap-3">
                <input
                  id="trust-enabled"
                  type="checkbox"
                  checked={trustBadgesEnabled}
                  onChange={(e) => setTrustBadgesEnabled(e.target.checked)}
                  className="w-4.5 h-4.5 border-gray-300 text-primary focus:ring-primary rounded-none cursor-pointer"
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
                    <div key={idx} className="bg-neutral-50 border border-gray-200 p-6 space-y-4 relative">
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
                            className="w-full border border-gray-200 focus:border-primary focus:ring-0 text-sm py-2 px-3 rounded-none"
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
                            className="w-full border border-gray-200 focus:border-primary focus:ring-0 text-sm py-2 px-3 rounded-none"
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
                            className="w-full border border-gray-200 focus:border-primary focus:ring-0 text-sm py-2 px-3 rounded-none"
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
                    className="border border-dashed border-gray-300 w-full py-4 text-center text-xs font-black uppercase tracking-widest text-gray-400 hover:border-primary hover:text-primary transition-all cursor-pointer bg-[#fbfbfb]"
                  >
                    + Add Trust Badge
                  </button>
                )}
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  className="bg-primary text-white px-8 py-3.5 text-xs font-black uppercase tracking-[0.2em] hover:bg-secondary transition-all shadow-lg rounded-none cursor-pointer border-none font-bold"
                >
                  Save Trust Badges
                </button>
              </div>
            </form>
          </section>
        )}

        {/* Section 7: Categories Settings */}
        {activeTab === "categories" && (
          <section className="bg-white border border-gray-200 shadow-sm overflow-hidden rounded-none">
            <div className="p-8 border-b border-gray-200 bg-[#fafafa]">
              <h3 className="font-headline font-black text-xs uppercase tracking-[0.3em] text-primary">
                Categories Section Editor
              </h3>
            </div>
            <form onSubmit={handleSaveCategories} className="p-8 space-y-6">
              <div className="flex items-center gap-3">
                <input
                  id="categories-enabled"
                  type="checkbox"
                  checked={categoriesEnabled}
                  onChange={(e) => setCategoriesEnabled(e.target.checked)}
                  className="w-4.5 h-4.5 border-gray-300 text-primary focus:ring-primary rounded-none cursor-pointer"
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
                    <div key={idx} className="bg-neutral-50 border border-gray-200 p-6 space-y-4 relative">
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
                            className="w-full border border-gray-200 focus:border-primary focus:ring-0 text-sm py-2 px-3 rounded-none"
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
                            className="w-full border border-gray-200 focus:border-primary focus:ring-0 text-sm py-2 px-3 rounded-none"
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
                            className="w-full border border-gray-200 focus:border-primary focus:ring-0 text-sm py-2 px-3 rounded-none"
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
                            className="w-full border border-gray-200 focus:border-primary focus:ring-0 text-sm py-2.5 px-3 rounded-none bg-white font-bold"
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
                              <img src={item.image_url} className="w-12 h-16 object-cover border border-gray-200" alt="Category thumbnail" />
                              <div className="flex flex-col gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setUploadTarget("category");
                                    setActiveUploadCategoryIndex(idx);
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
                                cloudinaryRef.current?.open();
                              }}
                              className="border border-dashed border-gray-300 px-4 py-2 text-center text-[10px] font-black uppercase tracking-widest text-gray-400 hover:border-primary hover:text-primary transition-all cursor-pointer bg-[#fbfbfb]"
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
                    className="border border-dashed border-gray-300 w-full py-4 text-center text-xs font-black uppercase tracking-widest text-gray-400 hover:border-primary hover:text-primary transition-all cursor-pointer bg-[#fbfbfb]"
                  >
                    + Add Category Card
                  </button>
                )}
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  className="bg-primary text-white px-8 py-3.5 text-xs font-black uppercase tracking-[0.2em] hover:bg-secondary transition-all shadow-lg rounded-none cursor-pointer border-none font-bold"
                >
                  Save Category Settings
                </button>
              </div>
            </form>
          </section>
        )}

        {/* Section 8: Reviews Moderator */}
        {activeTab === "reviews" && (
          <section className="bg-white border border-gray-200 shadow-sm overflow-hidden rounded-none">
            <div className="p-8 border-b border-gray-200 bg-[#fafafa] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h3 className="font-headline font-black text-xs uppercase tracking-[0.3em] text-primary">
                  Review Moderation Portal
                </h3>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">
                  Approve, reject, or correct customer reviews before they show on the storefront.
                </p>
              </div>

              {/* Sub-tabs for Pending / Approved */}
              <div className="flex border border-gray-200 rounded-none overflow-hidden">
                <button
                  type="button"
                  onClick={() => setActiveReviewsTab("pending")}
                  className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest cursor-pointer transition-all border-none ${
                    activeReviewsTab === "pending"
                      ? "bg-primary text-white font-bold"
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
                      ? "bg-primary text-white font-bold"
                      : "bg-white text-gray-600 hover:bg-neutral-50"
                  }`}
                >
                  Approved ({reviewsList.filter((r) => r.approved).length})
                </button>
              </div>
            </div>

            <div className="p-8 space-y-6">
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
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <span key={i} className="material-symbols-outlined text-sm font-bold">
                                    {i < review.rating ? "star" : "star_outline"}
                                  </span>
                                ))}
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
                                className="w-full border border-gray-200 focus:border-primary focus:ring-0 text-sm py-2 px-3 rounded-none h-20 resize-none"
                              />
                            ) : (
                              <p className="text-sm text-gray-600 leading-relaxed font-medium">
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
                                  className="bg-primary text-white px-4 py-2 text-[9px] font-black uppercase tracking-widest hover:bg-secondary transition-all rounded-none cursor-pointer border-none shrink-0"
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateReviewComment(review.id)}
                                  className="border border-gray-200 text-[#0a0a0a] px-4 py-2 text-[9px] font-black uppercase tracking-widest hover:bg-neutral-50 transition-all rounded-none cursor-pointer shrink-0"
                                >
                                  Update Comment
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRejectReview(review.id)}
                                  className="border border-red-200 text-red-600 px-4 py-2 text-[9px] font-black uppercase tracking-widest hover:bg-red-50 transition-all rounded-none cursor-pointer shrink-0"
                                >
                                  Reject
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleRejectReview(review.id)}
                                className="border border-red-200 text-red-600 px-4 py-2 text-[9px] font-black uppercase tracking-widest hover:bg-red-50 transition-all rounded-none cursor-pointer shrink-0"
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
      </div>
    </div>
  );
}
