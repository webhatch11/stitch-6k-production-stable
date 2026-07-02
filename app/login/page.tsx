"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();

  // Step state: 1 (Email + Name), 2 (OTP Entry)
  const [step, setStep] = useState<1 | 2>(1);

  // Form states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState<string[]>(["", "", "", "", "", ""]);

  // UI states
  const [errorMsg, setErrorMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [isCheckoutRedirect, setIsCheckoutRedirect] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Check URL parameters for redirect
  useEffect(() => {
    if (typeof window !== "undefined") {
      const redirectTo = new URLSearchParams(window.location.search).get("redirect");
      if (redirectTo === "checkout" || redirectTo === "/checkout") {
        setIsCheckoutRedirect(true);
      }
    }
  }, []);

  // Countdown timer for Resend OTP
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  // Handle individual digit input auto-advance
  const handleOtpChange = (value: string, index: number) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    // Auto-advance if a digit was typed
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Handle Backspace for navigation
  const handleOtpKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === "Backspace") {
      if (!otp[index] && index > 0) {
        const newOtp = [...otp];
        newOtp[index - 1] = "";
        setOtp(newOtp);
        inputRefs.current[index - 1]?.focus();
      } else {
        const newOtp = [...otp];
        newOtp[index] = "";
        setOtp(newOtp);
      }
    }
  };

  // Handle pasting a 6-digit code
  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").trim();
    if (/^\d{6}$/.test(pasted)) {
      const digits = pasted.split("");
      setOtp(digits);
      inputRefs.current[5]?.focus();
      handleVerifyCode(digits.join(""));
    }
  };

  // Auto-submit OTP when all 6 digits are filled
  useEffect(() => {
    const code = otp.join("");
    if (code.length === 6 && /^\d{6}$/.test(code)) {
      handleVerifyCode(code);
    }
  }, [otp]);

  // Send OTP handler
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }
    setErrorMsg("");
    setInfoMsg("");
    setLoading(true);

    try {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            data: { full_name: name },
            shouldCreateUser: true
          }
        });
        if (error) throw error;
      } else {
        // Mock fallback for development if Supabase not configured
        console.log(`[Mock Dev] Sending OTP to ${email} for user ${name}`);
        await new Promise((resolve) => setTimeout(resolve, 800));
        if (!email.includes("@")) {
          throw new Error("Unable to validate email address: invalid format");
        }
      }
      setStep(2);
      setCountdown(60);
      setInfoMsg("Verification code sent successfully.");
    } catch (err: any) {
      console.error("Authentication Error:", err);
      let friendlyMsg = err.message || "Failed to send verification code.";
      if (err.message?.includes("Email rate limit exceeded")) {
        friendlyMsg = "Too many requests. Please wait a few minutes and try again.";
      } else if (err.message?.includes("Unable to validate email address: invalid format")) {
        friendlyMsg = "Please enter a valid email address.";
      }
      setErrorMsg(friendlyMsg);
    } finally {
      setLoading(false);
    }
  };

  // Verify OTP handler
  const handleVerifyCode = async (codeToVerify?: string) => {
    const finalCode = codeToVerify || otp.join("");
    if (finalCode.length !== 6) return;
    if (loading) return;
    
    setErrorMsg("");
    setInfoMsg("");
    setLoading(true);

    try {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.auth.verifyOtp({
          email,
          token: finalCode,
          type: 'email'
        });
        if (error) throw error;
      } else {
        // Mock verify for development
        console.log(`[Mock Dev] Verifying OTP ${finalCode} for ${email}`);
        await new Promise((resolve) => setTimeout(resolve, 800));
        if (finalCode !== "123456" && finalCode !== "111111") {
          throw new Error("Token has expired or is invalid");
        }
        // Save mock session
        const mockUser = {
          id: "mock-user-123",
          name: name || "Demo User",
          email: email,
          role: "customer"
        };
        localStorage.setItem("mock_user_profile", JSON.stringify(mockUser));
        localStorage.setItem("mock_user_session", JSON.stringify({ email: mockUser.email, userId: mockUser.id }));
        document.cookie = `mock_user_session=${mockUser.id}; path=/; max-age=86400`;
      }

      setInfoMsg("Signed in successfully. Redirecting...");
      
      const redirectTo = new URLSearchParams(window.location.search).get("redirect");
      router.refresh();
      if (redirectTo === "checkout" || redirectTo === "/checkout") {
        router.push("/checkout");
      } else if (redirectTo) {
        router.push(redirectTo);
      } else {
        router.push("/");
      }
    } catch (err: any) {
      console.error("Verification Error:", err);
      let friendlyMsg = err.message || "Failed to verify OTP.";
      if (err.message?.includes("Token has expired or is invalid")) {
        friendlyMsg = "Code expired or incorrect. Request a new one.";
      }
      setErrorMsg(friendlyMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (countdown > 0) return;
    setErrorMsg("");
    setInfoMsg("");
    setLoading(true);

    try {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            data: { full_name: name },
            shouldCreateUser: true
          }
        });
        if (error) throw error;
      } else {
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
      setCountdown(60);
      setInfoMsg("A new verification code has been sent.");
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } catch (err: any) {
      console.error("Resend Error:", err);
      let friendlyMsg = err.message || "Failed to resend verification code.";
      if (err.message?.includes("Email rate limit exceeded")) {
        friendlyMsg = "Too many requests. Please wait a few minutes and try again.";
      }
      setErrorMsg(friendlyMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#fcfcfa] text-[#0a0a0a] font-body min-h-screen flex flex-col lg:flex-row">
      {/* Announcement bar for mobile */}
      <div className="lg:hidden w-full bg-[#0a0a0a] text-white py-2 text-center text-[9px] font-black uppercase tracking-[0.2em]">
        Stitch 6K Heritage & Streetwear
      </div>

      {/* Left Pane: Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#0A0A0A] relative flex-col justify-between p-16 overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#fed488]/5 rounded-full blur-[120px] translate-x-1/3 -translate-y-1/3"></div>
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[#775a19]/5 rounded-full blur-[100px] -translate-x-1/3 translate-y-1/3"></div>

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

        <div className="relative z-10 space-y-6 max-w-md">
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#fed488]">The Heritage Suite</span>
          <h2 className="text-white font-headline text-5xl font-extrabold tracking-tighter leading-none uppercase">
            Crafting luxury <br/>For the new generation.
          </h2>
          <p className="text-white/60 text-xs leading-relaxed">
            Welcome to our consolidated storefront. Sign in to access your curated collections, track recent orders, check loyalty tiers, and pay instantly using your Store Wallet credit.
          </p>
        </div>

        <div className="relative z-10 text-[9px] font-bold uppercase tracking-widest text-white/40 border-t border-white/10 pt-6">
          © 2026 STITCH 6K • HANDCRAFTED IN TAMIL NADU, INDIA
        </div>
      </div>

      {/* Right Pane: Login Form Card */}
      <div className="flex-1 flex flex-col justify-center items-center p-8 lg:p-24 bg-white relative">
        <div className="absolute top-8 right-8">
          <Link 
            href="/" 
            className="text-[9px] font-black uppercase tracking-widest text-gray-500 hover:text-black flex items-center gap-1 transition-colors"
          >
            Back to Shop <span className="material-symbols-outlined text-xs">close</span>
          </Link>
        </div>

        <div className="w-full max-w-sm space-y-10">
          {/* 6K Logo at top */}
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-[#fcfcfa] p-2 flex items-center justify-center border border-[#775a19]/15 shadow-sm">
              <img src="/assets/logo.png" alt="6K Logo" className="max-w-full max-h-full object-contain" />
            </div>
          </div>

          {/* Checkout Redirect Gold Banner */}
          {isCheckoutRedirect && (
            <div className="bg-[#BA7517]/10 border border-[#BA7517]/30 text-[#BA7517] text-[10px] font-black uppercase tracking-wider p-4 text-center rounded-none animate-pulse">
              Sign in to complete your order
            </div>
          )}

          {step === 1 ? (
            <div className="space-y-8">
              {/* Header Title */}
              <div className="space-y-2 text-center">
                <h3 className="text-3xl font-headline font-black tracking-tighter uppercase text-black">
                  Sign in to your account
                </h3>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
                  New here? We&apos;ll create your account automatically.
                </p>
              </div>

              {/* Step 1 Form */}
              <form onSubmit={handleSendOtp} className="space-y-6">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-gray-500">Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Aditya Singhania"
                    className="w-full border-b border-gray-200 focus:border-[#775a19] py-3 text-xs outline-none transition-colors rounded-none placeholder:text-gray-300"
                    required
                  />
                </div>

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

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#0a0a0a] hover:bg-[#775a19] text-white text-xs font-black uppercase tracking-[0.2em] py-4 transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full" />
                      Sending OTP...
                    </span>
                  ) : (
                    <>
                      Send OTP
                      <span className="material-symbols-outlined text-xs">arrow_forward</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Header Title */}
              <div className="space-y-2 text-center">
                <h3 className="text-3xl font-headline font-black tracking-tighter uppercase text-black">
                  Check your email
                </h3>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold leading-relaxed">
                  We sent a 6-digit code to <span className="text-black font-extrabold">{email}</span>
                </p>
                <div className="pt-1">
                  <button
                    onClick={() => setStep(1)}
                    className="text-[9px] font-black uppercase tracking-widest text-[#775a19] hover:underline"
                  >
                    Change email
                  </button>
                </div>
              </div>

              {/* Step 2 OTP Fields */}
              <div className="space-y-6">
                <div className="flex justify-between gap-2 max-w-[280px] mx-auto">
                  {otp.map((digit, idx) => (
                    <input
                      key={idx}
                      type="text"
                      ref={(el) => { inputRefs.current[idx] = el; }}
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(e.target.value, idx)}
                      onKeyDown={(e) => handleOtpKeyDown(e, idx)}
                      onPaste={handleOtpPaste}
                      className="w-10 h-12 text-center border-b-2 border-gray-200 focus:border-[#BA7517] text-lg font-bold outline-none transition-colors"
                    />
                  ))}
                </div>

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

                <div className="pt-2 space-y-4">
                  <button
                    type="button"
                    onClick={() => handleVerifyCode()}
                    disabled={loading}
                    className="w-full bg-[#BA7517] hover:bg-[#9a5d10] text-white text-xs font-black uppercase tracking-[0.2em] py-4 transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <span className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full" />
                        Verifying...
                      </span>
                    ) : (
                      <>
                        Verify Code
                        <span className="material-symbols-outlined text-xs">verified</span>
                      </>
                    )}
                  </button>

                  <div className="text-center pt-2">
                    {countdown > 0 ? (
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                        Resend in {countdown}s
                      </span>
                    ) : (
                      <button
                        onClick={handleResendOtp}
                        disabled={loading}
                        className="text-[10px] text-[#775a19] hover:text-black font-black uppercase tracking-wider underline cursor-pointer disabled:opacity-50"
                      >
                        Resend code
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quick Mock Login Assist card for Development */}
          {!isSupabaseConfigured && (
            <div className="border-t border-gray-100 pt-8 space-y-4">
              <div className="flex items-center gap-2 text-amber-600">
                <span className="material-symbols-outlined text-sm">info</span>
                <span className="text-[9px] font-black uppercase tracking-widest">Mock offline mode active</span>
              </div>
              <p className="text-[9px] text-gray-400 font-bold uppercase leading-relaxed">
                Supabase keys are missing. Use code <span className="font-extrabold text-black">123456</span> to log in.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
