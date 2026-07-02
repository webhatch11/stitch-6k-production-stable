"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();

  // Auth Modes: 'signin' | 'signup'
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  
  // Input fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  
  // UI states
  const [errorMsg, setErrorMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if user is already logged in
    const checkSession = async () => {
      if (isSupabaseConfigured && supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          router.push("/myprofile");
        }
      } else {
        const mockSession = localStorage.getItem("mock_user_session");
        if (mockSession) {
          router.push("/myprofile");
        }
      }
    };
    checkSession();
  }, [router]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setInfoMsg("");
    setLoading(true);

    if (!email || !password) {
      setErrorMsg("Please fill in all required fields.");
      setLoading(false);
      return;
    }

    if (mode === "signup" && !name) {
      setErrorMsg("Please enter your name for registration.");
      setLoading(false);
      return;
    }

    try {
      if (isSupabaseConfigured && supabase) {
        // --- Supabase Authentication ---
        if (mode === "signup") {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                name: name,
                phone: phone,
              },
            },
          });
          if (error) throw error;
          
          setInfoMsg("Registration successful! Check your email for confirmation, or try signing in.");
          setMode("signin");
        } else {
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (error) throw error;

          const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", data.user?.id ?? "")
            .maybeSingle();

          const redirectTo = new URLSearchParams(window.location.search).get("redirect");
          router.refresh();
          router.push(
            profile?.role === "admin"
              ? (redirectTo || "/admindashboard")
              : (redirectTo || "/myprofile")
          );
        }
      } else {
        // --- LocalStorage Mock Authentication Fallback ---
        if (mode === "signup") {
          const mockUser = {
            id: "mock-user-" + Date.now(),
            name,
            email,
            phone,
            role: email.toLowerCase().includes("admin") ? "admin" : "customer",
            wallet_balance: 2500,
            loyalty_points: 500
          };
          
          localStorage.setItem("mock_user_profile", JSON.stringify(mockUser));
          localStorage.setItem("mock_user_session", JSON.stringify({ email: mockUser.email, userId: mockUser.id }));
          document.cookie = `mock_user_session=${mockUser.id}; path=/; max-age=86400`;
          document.cookie = `mock_user_role=${mockUser.role}; path=/; max-age=86400`;
          document.cookie = `mock_user_email=${mockUser.email}; path=/; max-age=86400`;
          document.cookie = `mock_user_name=${mockUser.name}; path=/; max-age=86400`;
          setInfoMsg("Mock Registration successful! Redirecting...");
          setTimeout(() => {
            router.refresh();
            router.push("/myprofile");
          }, 1500);
        } else {
          const savedProfile = localStorage.getItem("mock_user_profile");
          let profile = savedProfile ? JSON.parse(savedProfile) : null;
          
          // Seed a default mock admin if logging in with admin credentials
          if (email.toLowerCase().includes("admin") && !profile) {
            profile = {
              id: "mock-admin",
              name: "Store Administrator",
              email: "admin@stitch6k.in",
              phone: "9999988888",
              role: "admin",
              wallet_balance: 10000,
              loyalty_points: 0
            };
            localStorage.setItem("mock_user_profile", JSON.stringify(profile));
          } else if (!profile) {
            // Seed standard customer profile
            profile = {
              id: "mock-customer",
              name: "Aditya R. Singhania",
              email: email,
              phone: "9876543210",
              role: "customer",
              wallet_balance: 2500,
              loyalty_points: 500
            };
            localStorage.setItem("mock_user_profile", JSON.stringify(profile));
          }

          localStorage.setItem("mock_user_session", JSON.stringify({ email: profile.email, userId: profile.id }));
          document.cookie = `mock_user_session=${profile.id}; path=/; max-age=86400`;
          document.cookie = `mock_user_role=${profile.role}; path=/; max-age=86400`;
          document.cookie = `mock_user_email=${profile.email}; path=/; max-age=86400`;
          document.cookie = `mock_user_name=${profile.name}; path=/; max-age=86400`;
          const redirectTo = new URLSearchParams(window.location.search).get("redirect");
          router.refresh();
          router.push(
            profile.role === "admin"
              ? (redirectTo || "/admindashboard")
              : (redirectTo || "/myprofile")
          );
        }
      }
    } catch (err: any) {
      console.error("Authentication Error:", err);
      setErrorMsg(err.message || "Failed to process authentication request.");
    } finally {
      setLoading(false);
    }
  };

  const handleMockLoginClick = () => {
    setEmail("aditya.singhania@heritage.com");
    setPassword("password123");
    setMode("signin");
  };

  const handleMockAdminClick = () => {
    setEmail("admin@stitch6k.in");
    setPassword("adminpassword");
    setMode("signin");
  };

  return (
    <div className="bg-[#fcfcfa] text-[#0a0a0a] font-body min-h-screen flex flex-col lg:flex-row">
      {/* Announcement bar for mobile viewports */}
      <div className="lg:hidden w-full bg-[#0a0a0a] text-white py-2 text-center text-[9px] font-black uppercase tracking-[0.2em]">
        Stitch 6K Heritage & Streetwear
      </div>

      {/* Left Pane: Branding & Aesthetic Showroom Showcase */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#0A0A0A] relative flex-col justify-between p-16 overflow-hidden">
        {/* Ambient Gradient Glow */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#fed488]/5 rounded-full blur-[120px] translate-x-1/3 -translate-y-1/3"></div>
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[#775a19]/5 rounded-full blur-[100px] -translate-x-1/3 translate-y-1/3"></div>

        {/* Brand Header */}
        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-4 group">
            <div className="w-10 h-10 rounded-full bg-white p-1.5 flex items-center justify-center border border-[#775a19]/25 shadow-md">
              <img src="/assets/logo.png" alt="6K Logo" className="max-w-full max-h-full object-contain" />
            </div>
            <div>
              <h1 className="text-white text-xs font-black tracking-[0.3em] uppercase leading-none">Stitch 6K</h1>
              <p className="text-[#fed488] text-[8px] font-bold uppercase tracking-widest mt-1">Heritage & Streetwear</p>
            </div>
          </Link>
        </div>

        {/* Narrative Copy */}
        <div className="relative z-10 space-y-6 max-w-md">
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#fed488]">The Heritage Suite</span>
          <h2 className="text-white font-headline text-5xl font-extrabold tracking-tighter leading-none uppercase">
            Crafting luxury <br/>For the new generation.
          </h2>
          <p className="text-white/60 text-xs leading-relaxed">
            Welcome to our consolidated storefront. Sign in to access your curated collections, track recent orders, check loyalty tiers, and pay instantly using your Store Wallet credit.
          </p>
        </div>

        {/* Footer info */}
        <div className="relative z-10 text-[9px] font-bold uppercase tracking-widest text-white/40 border-t border-white/10 pt-6">
          © 2026 STITCH 6K • HANDCRAFTED IN TAMIL NADU, INDIA
        </div>
      </div>

      {/* Right Pane: Authentication Card Form */}
      <div className="flex-1 flex flex-col justify-center items-center p-8 lg:p-24 bg-white relative">
        <div className="absolute top-8 right-8">
          <Link 
            href="/" 
            className="text-[9px] font-black uppercase tracking-widest text-gray-500 hover:text-black flex items-center gap-1 transition-colors"
          >
            Back to Shop <span className="material-symbols-outlined text-xs">close</span>
          </Link>
        </div>

        <div className="w-full max-w-sm space-y-12">
          {/* Header titles */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-gray-400">
              <span>Authentication</span>
              <span className="material-symbols-outlined text-xs opacity-50">chevron_right</span>
              <span className="text-black italic">{mode === "signin" ? "Sign In" : "Register"}</span>
            </div>
            <h3 className="text-4xl font-headline font-black tracking-tighter uppercase text-black">
              {mode === "signin" ? "Welcome Back" : "Create Account"}
            </h3>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
              {mode === "signin" 
                ? "Enter your credentials to enter the atelier suite." 
                : "Join the suite to claim ₹2,500 welcome credits."}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleAuthSubmit} className="space-y-6">
            <AnimatePresence mode="wait">
              {mode === "signup" && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-500">Full Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Aditya Singhania"
                      className="w-full border-b border-gray-200 focus:border-[#775a19] py-3 text-xs outline-none transition-colors rounded-none placeholder:text-gray-300"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-500">Phone Number (Optional)</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. 9876543210"
                      className="w-full border-b border-gray-200 focus:border-[#775a19] py-3 text-xs outline-none transition-colors rounded-none placeholder:text-gray-300"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase tracking-widest text-gray-500">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. customer@stitch6k.in"
                className="w-full border-b border-gray-200 focus:border-[#775a19] py-3 text-xs outline-none transition-colors rounded-none placeholder:text-gray-300"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase tracking-widest text-gray-500">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border-b border-gray-200 focus:border-[#775a19] py-3 text-xs outline-none transition-colors rounded-none placeholder:text-gray-300"
                required
              />
            </div>

            {/* Notifications */}
            {errorMsg && (
              <div className="bg-red-50 text-red-700 text-[10px] font-bold uppercase tracking-widest p-4 border border-red-200">
                {errorMsg}
              </div>
            )}
            {infoMsg && (
              <div className="bg-green-50 text-green-700 text-[10px] font-bold uppercase tracking-widest p-4 border border-green-200">
                {infoMsg}
              </div>
            )}

            {/* Buttons */}
            <div className="pt-4 flex flex-col gap-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#0a0a0a] hover:bg-[#775a19] text-white text-xs font-black uppercase tracking-[0.2em] py-4 transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? "Authenticating..." : mode === "signin" ? "Sign In" : "Register Details"}
                <span className="material-symbols-outlined text-xs">login</span>
              </button>

              <button
                type="button"
                onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
                className="w-full bg-white hover:bg-gray-50 text-gray-500 hover:text-black border border-gray-200 text-xs font-black uppercase tracking-[0.2em] py-4 transition-all cursor-pointer"
              >
                {mode === "signin" ? "Create New Profile" : "Already Registered? Sign In"}
              </button>
            </div>
          </form>

          {/* Quick Mock Login Assist cards (extremely helpful for dev testing) */}
          {!isSupabaseConfigured && (
            <div className="border-t border-gray-100 pt-8 space-y-4">
              <div className="flex items-center gap-2 text-amber-600">
                <span className="material-symbols-outlined text-sm">info</span>
                <span className="text-[9px] font-black uppercase tracking-widest">Mock offline mode active</span>
              </div>
              <p className="text-[9px] text-gray-400 font-bold uppercase leading-relaxed">
                Supabase keys are missing. Use these quick actions to auto-fill mock credentials and log in instantly:
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleMockLoginClick}
                  className="bg-transparent border border-[#775a19]/20 hover:border-[#775a19] text-[#775a19] px-4 py-2.5 text-[9px] font-black uppercase tracking-widest transition-colors cursor-pointer"
                >
                  Mock Customer
                </button>
                <button
                  type="button"
                  onClick={handleMockAdminClick}
                  className="bg-transparent border border-red-500/20 hover:border-red-500 text-red-500 px-4 py-2.5 text-[9px] font-black uppercase tracking-widest transition-colors cursor-pointer"
                >
                  Mock Admin
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
