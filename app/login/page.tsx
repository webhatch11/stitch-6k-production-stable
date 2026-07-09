"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Mail, 
  User, 
  Phone, 
  Check, 
  ArrowRight, 
  Shield, 
  Heart, 
  Users, 
  ShoppingBag 
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { trackLogin, trackSignUp } from "@/lib/analytics";
import { checkUserExistsAction } from "@/app/actions/auth";

export default function LoginPage() {
  const router = useRouter();

  // Layout State: true for Sign In (State 1), false for Create Account (State 2)
  const [isSignIn, setIsSignIn] = useState(true);

  // OTP Step State: 1 for details collection, 2 for OTP verification
  const [step, setStep] = useState<1 | 2>(1);

  // Form inputs
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [otp, setOtp] = useState<string[]>(["", "", "", "", "", ""]);

  // UI feedback states
  const [errorMsg, setErrorMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [isCheckoutRedirect, setIsCheckoutRedirect] = useState(false);
  // Shown after OTP verify succeeds, while router.push() is in flight
  const [isVerifying, setIsVerifying] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Check URL parameters for redirection
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

  // Submitting the form (sending OTP)
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setInfoMsg("");

    if (!email) {
      setErrorMsg("Please enter your email address.");
      return;
    }

    if (!isSignIn && !agreeTerms) {
      setErrorMsg("You must agree to the Terms of Service and Privacy Policy.");
      return;
    }

    setLoading(true);

    try {
      if (isSignIn) {
        // -------------------------------------------------------------------
        // Bug 1 fix: Use server action for authoritative user-exists check.
        // The old approach queried profiles.email client-side via RLS, which
        // returned null whenever the profile row was missing or had a NULL
        // email (trigger race / legacy data), wrongly routing returning users
        // to the Create Account form.
        //
        // The server action checks profiles.email first, then falls back to
        // auth.users via the admin API — the true source of truth.
        // -------------------------------------------------------------------
        let userExists = false;
        if (isSupabaseConfigured()) {
          const { exists } = await checkUserExistsAction(email);
          userExists = exists;
        } else {
          // Mock offline fallback: treat addresses without "new" as existing
          userExists = !email.toLowerCase().includes("new");
        }

        if (!userExists) {
          // New user — switch to Create Account form
          setIsSignIn(false);
          setInfoMsg("Welcome! Let's create your 6K Brand account.");
          setLoading(false);
          return;
        }
      }

      const optionsData: Record<string, string> = {
        full_name: isSignIn ? "" : name
      };
      if (!isSignIn && phone) {
        optionsData.phone = phone;
      }

      if (isSupabaseConfigured() && supabase) {
        const origin = typeof window !== "undefined" ? window.location.origin : "";
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            data: optionsData,
            // Bug 1 fix: returning users (isSignIn=true) must use
            // shouldCreateUser:false — prevents Supabase from creating a
            // duplicate auth user if the profiles row was absent. New users
            // (isSignIn=false, Create Account path) keep shouldCreateUser:true.
            shouldCreateUser: !isSignIn,
            emailRedirectTo: `${origin}/auth/callback`
          }
        });
        if (error) throw error;
      } else {
        // Mock offline fallback
        await new Promise((resolve) => setTimeout(resolve, 800));
        if (!email.includes("@")) {
          throw new Error("Unable to validate email address: invalid format");
        }
      }

      setStep(2);
      setCountdown(45);
      if (!isSignIn) {
        setInfoMsg("Your account is ready! Please check your email.");
      } else {
        setInfoMsg("Verification code sent successfully.");
      }
    } catch (err: any) {
      console.error("Auth send OTP error:", err);
      let friendlyMsg = err.message || "Failed to send verification code.";
      if (err.message?.includes("Email rate limit exceeded")) {
        friendlyMsg = "Too many requests. Please wait a few minutes and try again.";
      }
      setErrorMsg(friendlyMsg);
    } finally {
      setLoading(false);
    }
  };

  // Verifying the OTP code
  const handleVerifyCode = async (codeToVerify?: string) => {
    const finalCode = codeToVerify || otp.join("");
    if (finalCode.length !== 6) return;
    if (loading) return;

    setErrorMsg("");
    setInfoMsg("");
    setLoading(true);

    try {
      // -----------------------------------------------------------------------
      // Bug 2 fix — Step 1: OTP verification ONLY.
      // This try/catch is now exclusively for the verifyOtp call. Any error
      // here is a genuine auth failure (wrong/expired code) and SHOULD be
      // shown to the user via setErrorMsg.
      // -----------------------------------------------------------------------
      if (isSupabaseConfigured() && supabase) {
        const { error } = await supabase.auth.verifyOtp({
          email,
          token: finalCode,
          type: "email"
        });
        if (error) throw error;
      } else {
        throw new Error("Supabase is not configured.");
      }
    } catch (err: any) {
      // OTP itself failed — show error, stop here.
      console.error("Verification Error:", err);
      let friendlyMsg = err.message || "Failed to verify OTP.";
      if (err.message?.includes("Token has expired or is invalid")) {
        friendlyMsg = "Code expired or incorrect. Request a new one.";
      }
      setErrorMsg(friendlyMsg);
      setLoading(false);
      setIsVerifying(false);
      return;
    }

    // OTP verified — show redirect loading overlay immediately
    setIsVerifying(true);

    // -------------------------------------------------------------------------
    // Bug 2 fix — Step 2: Post-verify operations (analytics + role fetch).
    // These run in their OWN try/catch so any failure here NEVER blocks the
    // redirect. router.push() is guaranteed to fire regardless.
    // router.refresh() has been moved AFTER router.push() to avoid the
    // App Router race where refresh() cancels a pending navigation.
    // -------------------------------------------------------------------------
    setInfoMsg("Signed in successfully. Redirecting...");

    if (isSignIn) {
      trackLogin();
    } else {
      trackSignUp();
    }

    // Determine redirect target before we attempt the profile fetch
    const redirectParam = typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("redirect")
      : null;

    let userRole = "customer";
    try {
      if (isSupabaseConfigured() && supabase) {
        // Use getSession() — more reliable immediately after verifyOtp than
        // getUser() which can return null before session cookies are written.
        const { data: sessionData } = await supabase.auth.getSession();
        const authUser = sessionData?.session?.user;
        if (authUser) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", authUser.id)
            .maybeSingle();
          if (profile?.role) {
            userRole = profile.role;
          }
        }
      } else {
        const mockProfile = localStorage.getItem("mock_user_profile");
        if (mockProfile) {
          const parsed = JSON.parse(mockProfile);
          userRole = parsed.role || "customer";
        }
      }
    } catch (profileErr: any) {
      // Profile fetch failed — log it but DO NOT block the redirect.
      console.error("[login] Profile role fetch failed (non-fatal):", profileErr);
    }

    // Redirect — guaranteed to execute regardless of profile fetch outcome.
    if (userRole === "admin") {
      router.push("/admindashboard");
    } else if (redirectParam === "checkout" || redirectParam === "/checkout") {
      router.push("/checkout");
    } else if (redirectParam) {
      router.push(redirectParam);
    } else {
      router.push("/");
    }
    // Refresh after push so server components update without racing the navigation.
    router.refresh();

    setLoading(false);
  };

  const handleResendOtp = async () => {
    if (countdown > 0) return;
    setErrorMsg("");
    setInfoMsg("");
    setLoading(true);

    try {
      if (isSupabaseConfigured() && supabase) {
        const origin = typeof window !== "undefined" ? window.location.origin : "";
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            data: { full_name: name },
            shouldCreateUser: !isSignIn,   // keep consistent with handleSendOtp
            emailRedirectTo: `${origin}/auth/callback`
          }
        });
        if (error) throw error;
      } else {
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
      setCountdown(45);
      setInfoMsg("A new verification code has been sent.");
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } catch (err: any) {
      console.error("Resend Error:", err);
      setErrorMsg(err.message || "Failed to resend verification code.");
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchState = (toSignIn: boolean) => {
    setIsSignIn(toSignIn);
    setStep(1);
    setErrorMsg("");
    setInfoMsg("");
    setOtp(["", "", "", "", "", ""]);
  };

  // Input Field validation hooks
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isNameValid = name.trim().length > 0;
  const isPhoneValid = !phone || /^\+?[0-9\s-]{10,15}$/.test(phone);

  return (
    <div className="bg-white min-h-screen flex text-[#1a1a1a] font-body">
      {/* LEFT PANEL: Branding & Features (hidden on mobile) */}
      <div className="hidden md:flex md:w-1/2 bg-[#0a0a0a] relative flex-col justify-between p-12 lg:p-16 overflow-hidden">
        {/* Decorative subtle background gradient glows */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#BA7517]/5 rounded-full blur-[120px] translate-x-1/3 -translate-y-1/3 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[#BA7517]/5 rounded-full blur-[100px] -translate-x-1/3 translate-y-1/3 pointer-events-none"></div>

        {/* Top Wordmark Logo */}
        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-4 group">
            <div className="w-10 h-10 rounded-full bg-white/5 p-1.5 flex items-center justify-center border border-white/10 shadow-md">
              <img src="/assets/logo.png" alt="6K Logo" className="max-w-full max-h-full object-contain filter invert" />
            </div>
            <div>
              <h1 className="text-white text-[11px] font-black tracking-[0.25em] uppercase leading-none">Stitch 6K</h1>
              <p className="text-[#BA7517] text-[8px] font-bold uppercase tracking-[0.18em] mt-1.5">Heritage & Streetwear</p>
            </div>
          </Link>
        </div>

        {/* Core Marketing Copy */}
        <div className="relative z-10 space-y-6 max-w-lg">
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#BA7517] bg-[#BA7517]/10 px-2.5 py-1">
            THE HERITAGE SUITE
          </span>
          <h2 className="text-white font-headline text-4xl lg:text-5xl font-black tracking-tight leading-[1.05] uppercase">
            Crafting luxury <br/>For the new generation.
          </h2>
          <p className="text-white/60 text-xs leading-relaxed max-w-md">
            Sign in to access your curated collections, track recent orders, check loyalty tiers, and pay instantly using your Store Wallet credit.
          </p>
        </div>

        {/* Features Grid */}
        <div className="relative z-10 grid grid-cols-2 gap-y-6 gap-x-4 border-t border-white/10 pt-8">
          <div className="flex gap-3">
            <ShoppingBag className="w-6 h-6 text-[#BA7517] shrink-0" />
            <div>
              <h4 className="text-white text-[11px] font-bold uppercase tracking-wider">Curated Collections</h4>
              <p className="text-white/40 text-[9px] mt-0.5">Premium designs</p>
            </div>
          </div>

          <div className="flex gap-3">
            <Shield className="w-6 h-6 text-[#BA7517] shrink-0" />
            <div>
              <h4 className="text-white text-[11px] font-bold uppercase tracking-wider">Secure Payments</h4>
              <p className="text-white/40 text-[9px] mt-0.5">100% Protected</p>
            </div>
          </div>

          <div className="flex gap-3">
            <Heart className="w-6 h-6 text-[#BA7517] shrink-0" />
            <div>
              <h4 className="text-white text-[11px] font-bold uppercase tracking-wider">Loyalty Rewards</h4>
              <p className="text-white/40 text-[9px] mt-0.5">Earn & Redeem</p>
            </div>
          </div>

          <div className="flex gap-3">
            <Users className="w-6 h-6 text-[#BA7517] shrink-0" />
            <div>
              <h4 className="text-white text-[11px] font-bold uppercase tracking-wider">Member Benefits</h4>
              <p className="text-white/40 text-[9px] mt-0.5">Exclusive Access</p>
            </div>
          </div>
        </div>

        {/* Footer Credit */}
        <div className="relative z-10 text-[8px] font-bold uppercase tracking-widest text-white/30">
          © 2026 STITCH 6K • HANDCRAFTED IN TAMIL NADU, INDIA
        </div>
      </div>

      {/* RIGHT PANEL: Authentication Form */}
      <div className="flex-1 bg-white flex flex-col justify-between p-8 md:p-12 lg:p-16 relative">

        {/* Signing-in overlay — shown between OTP verify success and router.push completion */}
        {isVerifying && (
          <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center gap-5">
            {/* Animated spinner ring */}
            <div className="relative w-14 h-14">
              <div className="absolute inset-0 rounded-full border-[3px] border-[#e5e5e5]" />
              <div className="absolute inset-0 rounded-full border-[3px] border-t-[#1a1a1a] border-r-transparent border-b-transparent border-l-transparent animate-spin" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#1a1a1a]">Signing you in...</p>
              <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Just a moment</p>
            </div>
          </div>
        )}
        
        {/* Mobile Header (hidden on desktop) */}
        <div className="flex md:hidden items-center justify-between w-full pb-4 border-b border-gray-100">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#0a0a0a] p-1 flex items-center justify-center">
              <img src="/assets/logo.png" alt="6K Logo" className="max-w-full max-h-full object-contain filter invert" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider text-black">Stitch 6K</span>
          </Link>
          <Link 
            href="/shopallshirts" 
            className="text-[9px] font-black uppercase tracking-widest text-gray-500 hover:text-black flex items-center gap-1 transition-colors"
          >
            Back to Shop ←
          </Link>
        </div>

        {/* Desktop Top Nav */}
        <div className="hidden md:flex justify-between items-center w-full">
          <div /> {/* Spacer */}
          <Link 
            href="/shopallshirts" 
            className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-black flex items-center gap-1 transition-colors"
          >
            Back to Shop ←
          </Link>
        </div>

        {/* Vertically Centered Form Area */}
        <div className="max-w-sm w-full mx-auto my-auto py-12 md:py-0 space-y-8">
          
          {/* Centered Logo (desktop only) */}
          <div className="hidden md:flex justify-center">
            <div className="w-12 h-12 rounded-full bg-gray-50 p-2.5 flex items-center justify-center border border-gray-100 shadow-sm">
              <img src="/assets/logo.png" alt="6K Logo" className="max-w-full max-h-full object-contain" />
            </div>
          </div>

          {/* Checkout Redirect Gold Banner */}
          {isCheckoutRedirect && step === 1 && (
            <div className="bg-[#BA7517]/10 border border-[#BA7517]/20 text-[#BA7517] text-[10px] font-bold uppercase tracking-wider p-4 text-center rounded-[4px] animate-pulse">
              Sign in to complete your order
            </div>
          )}

          {/* Status Messages */}
          {errorMsg && (
            <div className="bg-red-50 text-red-700 text-[10px] font-bold uppercase tracking-widest p-4 border border-red-200 rounded-[4px]">
              {errorMsg}
            </div>
          )}
          {infoMsg && (
            <div className="bg-green-50 text-[#22c55e] text-[10px] font-bold uppercase tracking-widest p-4 border border-green-200 rounded-[4px]">
              {infoMsg}
            </div>
          )}

          {step === 1 ? (
            isSignIn ? (
              /* STATE 1: Sign In form */
              <div className="space-y-6">
                <div className="space-y-1.5 text-center md:text-left">
                  <h3 className="text-2xl font-black tracking-tight uppercase text-[#1a1a1a]">
                    Welcome Back
                  </h3>
                  <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">
                    Sign in to your 6K Brand account
                  </p>
                </div>

                <form onSubmit={handleSendOtp} className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e.g. customer@stitch6k.in"
                        className="w-full h-[48px] pl-11 pr-11 border border-[#e5e5e5] rounded-[4px] outline-none text-xs focus:border-[#1a1a1a] transition-colors placeholder:text-gray-300 text-black"
                        required
                      />
                      {isEmailValid && (
                        <Check className="absolute right-4 top-1/2 -translate-y-1/2 text-[#22c55e] w-4 h-4" />
                      )}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-[52px] bg-[#1a1a1a] hover:bg-black text-white text-xs font-medium uppercase tracking-[0.1em] rounded-[4px] transition-all flex items-center justify-between px-6 disabled:opacity-50 cursor-pointer"
                  >
                    <div className="w-4" />
                    <span>{loading ? "Sending..." : "Send OTP"}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>

                <div className="text-center pt-2">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                    New here?{" "}
                    <button
                      onClick={() => handleSwitchState(false)}
                      className="text-[#BA7517] hover:underline font-black cursor-pointer bg-transparent border-none"
                    >
                      Create an account
                    </button>
                  </p>
                </div>
              </div>
            ) : (
              /* STATE 2: Create Account form */
              <div className="space-y-6">
                <div className="space-y-1.5 text-center md:text-left">
                  <h3 className="text-2xl font-black tracking-tight uppercase text-black">
                    Create Account
                  </h3>
                  <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">
                    Join 6K Brand and elevate your style
                  </p>
                </div>

                <form onSubmit={handleSendOtp} className="space-y-4">
                  {/* Full Name input */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Aditya Singhania"
                        className="w-full h-[48px] pl-11 pr-11 border border-[#e5e5e5] rounded-[4px] outline-none text-xs focus:border-[#1a1a1a] transition-colors placeholder:text-gray-300 text-black"
                        required
                      />
                      {isNameValid && (
                        <Check className="absolute right-4 top-1/2 -translate-y-1/2 text-[#22c55e] w-4 h-4" />
                      )}
                    </div>
                  </div>

                  {/* Email Address input */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e.g. customer@stitch6k.in"
                        className="w-full h-[48px] pl-11 pr-11 border border-[#e5e5e5] rounded-[4px] outline-none text-xs focus:border-[#1a1a1a] transition-colors placeholder:text-gray-300 text-black"
                        required
                      />
                      {isEmailValid && (
                        <Check className="absolute right-4 top-1/2 -translate-y-1/2 text-[#22c55e] w-4 h-4" />
                      )}
                    </div>
                  </div>

                  {/* Mobile Number input (Optional) */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Mobile Number (Optional)</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+91 98765 43210"
                        className="w-full h-[48px] pl-11 pr-11 border border-[#e5e5e5] rounded-[4px] outline-none text-xs focus:border-[#1a1a1a] transition-colors placeholder:text-gray-300 text-black"
                      />
                      {phone && isPhoneValid && (
                        <Check className="absolute right-4 top-1/2 -translate-y-1/2 text-[#22c55e] w-4 h-4" />
                      )}
                    </div>
                  </div>

                  {/* Terms Checkbox */}
                  <label className="flex items-start gap-3 cursor-pointer pt-2 select-none">
                    <input
                      type="checkbox"
                      checked={agreeTerms}
                      onChange={(e) => setAgreeTerms(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#BA7517] focus:ring-[#BA7517]"
                      required
                    />
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider leading-tight">
                      I agree to the{" "}
                      <Link href="/terms" className="text-[#BA7517] hover:underline">
                        Terms of Service
                      </Link>{" "}
                      and{" "}
                      <Link href="/privacy" className="text-[#BA7517] hover:underline">
                        Privacy Policy
                      </Link>
                    </span>
                  </label>

                  <button
                    type="submit"
                    disabled={loading || !agreeTerms}
                    className="w-full h-[52px] bg-[#1a1a1a] hover:bg-black text-white text-xs font-medium uppercase tracking-[0.1em] rounded-[4px] transition-all flex items-center justify-between px-6 disabled:opacity-50 cursor-pointer mt-4"
                  >
                    <div className="w-4" />
                    <span>{loading ? "Sending..." : "Send verification code"}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>

                <div className="text-center pt-2">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                    Already have an account?{" "}
                    <button
                      onClick={() => handleSwitchState(true)}
                      className="text-[#BA7517] hover:underline font-black cursor-pointer bg-transparent border-none"
                    >
                      Sign In
                    </button>
                  </p>
                </div>
              </div>
            )
          ) : (
            /* STEP 2: OTP Entry */
            <div className="space-y-6">
              <div className="space-y-1.5 text-center md:text-left">
                <h3 className="text-2xl font-black tracking-tight uppercase text-black">
                  Check your email
                </h3>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider leading-relaxed">
                  Enter the 6-digit code sent to <span className="text-black font-extrabold">{email}</span>
                </p>
                <div className="pt-2 text-center md:text-left">
                  <button
                    onClick={() => setStep(1)}
                    className="text-[9px] font-black uppercase tracking-widest text-[#BA7517] hover:underline"
                  >
                    ← Change email
                  </button>
                </div>
              </div>

              {/* Step 2 OTP Fields */}
              <div className="space-y-6">
                <div className="flex justify-between gap-2 max-w-[280px] mx-auto md:mx-0">
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
                      className="w-10 h-12 text-center border border-gray-200 focus:border-[#1a1a1a] text-lg font-bold outline-none transition-colors rounded-[4px] text-black"
                    />
                  ))}
                </div>

                <div className="pt-2 space-y-4">
                  <button
                    type="button"
                    onClick={() => handleVerifyCode()}
                    disabled={loading}
                    className="w-full h-[52px] bg-[#1a1a1a] hover:bg-black text-white text-xs font-medium uppercase tracking-[0.1em] rounded-[4px] transition-all flex items-center justify-between px-6 disabled:opacity-50 cursor-pointer"
                  >
                    <div className="w-4" />
                    <span>{loading ? "Verifying..." : "Verify"}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <div className="text-center md:text-left pt-2">
                    {countdown > 0 ? (
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                        Resend in {countdown}s
                      </span>
                    ) : (
                      <button
                        onClick={handleResendOtp}
                        disabled={loading}
                        className="text-[10px] text-[#BA7517] hover:text-black font-black uppercase tracking-wider underline cursor-pointer disabled:opacity-50"
                      >
                        Resend code
                      </button>
                    )}
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-6">
                  <p className="text-[10px] text-gray-400 font-bold uppercase leading-relaxed text-center md:text-left">
                    New here? No worries — we&apos;ll create your account automatically.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Quick Mock Login Assist card for Development */}
          {!isSupabaseConfigured() && (
            <div className="border-t border-gray-100 pt-6 space-y-2">
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

        {/* Footer Credit (shown on right panel ONLY on mobile) */}
        <div className="md:hidden text-[8px] font-bold uppercase tracking-widest text-gray-400 text-center pt-8 border-t border-gray-100">
          © 2026 STITCH 6K • HANDCRAFTED IN TAMIL NADU, INDIA
        </div>

        {/* Empty placeholder to keep layout balanced on desktop */}
        <div className="hidden md:block" />
      </div>
    </div>
  );
}
