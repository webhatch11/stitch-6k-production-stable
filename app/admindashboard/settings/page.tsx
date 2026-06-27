"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import CloudinaryUploadWidget, { type CloudinaryUploadHandle } from "@/app/admindashboard/CloudinaryUploadWidget";
import {
  getSettingAction,
  saveHeroAction,
  saveBusinessAction,
  saveFlagsAction,
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
      const [heroRes, bizRes, flagsRes] = await Promise.all([
        getSettingAction("hero"),
        getSettingAction("business"),
        getSettingAction("flags"),
      ]);

      if (heroRes.success && heroRes.value) {
        setHeroImage(heroRes.value.image_url || "");
        setHeroHeadline(heroRes.value.headline || "");
        setHeroSubheadline(heroRes.value.subheadline || "");
        setHeroCtaText(heroRes.value.cta_text || "");
        setHeroCtaUrl(heroRes.value.cta_url || "");
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
          setHeroImage(newUrl);
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

      <div className="space-y-16">
        {/* Section 1: Hero Settings */}
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
                      onClick={() => cloudinaryRef.current?.open()}
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
                  onClick={() => cloudinaryRef.current?.open()}
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

        {/* Section 2: Business Info */}
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

        {/* Section 3: Feature Flags */}
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
      </div>
    </div>
  );
}
