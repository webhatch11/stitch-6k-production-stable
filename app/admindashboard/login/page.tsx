"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Check, ArrowRight } from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { checkAdminEmail } from "@/app/actions/admin-auth";

export default function AdminLoginPage() {
  const router = useRouter();

  // Step state: 1 (Email Input), 2 (OTP Entry)
  const [step, setStep] = useState<1 | 2>(1);

  // Form states
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState<string[]>(["", "", "", "", "", ""]);

  // UI states
  const [errorMsg, setErrorMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

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
      // 1. Extra security layer: Check allowed admin emails via server action
      const { allowed } = await checkAdminEmail(email);
      if (!allowed) {
        setErrorMsg("This email is not authorized for admin access.");
        setLoading(false);
        return;
      }

      // 2. Send OTP
      if (isSupabaseConfigured && supabase) {
        const origin = typeof window !== "undefined" ? window.location.origin : "";
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            shouldCreateUser: false, // Admins must already exist
            emailRedirectTo: `${origin}/auth/callback`
          }
        });
        if (error) throw error;
      } else {
        // Mock offline fallback
        console.log(`[Mock Admin Dev] Sending OTP to ${email}`);
        await new Promise((resolve) => setTimeout(resolve, 800));
        if (!email.includes("@")) {
          throw new Error("Unable to validate email address: invalid format");
        }
      }
      setStep(2);
      setCountdown(60);
      setInfoMsg("Verification code sent successfully.");
    } catch (err: any) {
      console.error("Admin Auth Error:", err);
      let friendlyMsg = err.message || "Failed to send verification code.";
      if (err.message?.includes("Email rate limit exceeded")) {
        friendlyMsg = "Too many requests. Please wait a few minutes and try again.";
      }
      setErrorMsg(friendlyMsg);
    } finally {
      setLoading(false);
    }
  };

  // Verify OTP and Admin role
  const handleVerifyCode = async (codeToVerify?: string) => {
    const finalCode = codeToVerify || otp.join("");
    if (finalCode.length !== 6) return;
    if (loading) return;

    setErrorMsg("");
    setInfoMsg("");
    setLoading(true);

    try {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.auth.verifyOtp({
          email,
          token: finalCode,
          type: "email"
        });
        if (error) throw error;

        const user = data.user;
        if (!user) throw new Error("Authentication failed: No user returned");

        // Check if verified user has admin role in profiles
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

        if (!profile || profile.role !== "admin") {
          // Log out immediately if not admin
          await supabase.auth.signOut();
          throw new Error("Access denied. This portal is for administrators only.");
        }
      } else {
        // Mock verify for development
        console.log(`[Mock Admin Dev] Verifying OTP ${finalCode} for ${email}`);
        await new Promise((resolve) => setTimeout(resolve, 800));
        if (finalCode !== "123456" && finalCode !== "111111") {
          throw new Error("Token has expired or is invalid");
        }

        // Setup mock cookies & storage
        const mockUser = {
          id: "mock-admin-123",
          name: "Admin User",
          email: email,
          role: "admin"
        };
        localStorage.setItem("mock_user_profile", JSON.stringify(mockUser));
        localStorage.setItem("mock_user_session", JSON.stringify({ email: mockUser.email, userId: mockUser.id }));
        document.cookie = `mock_user_session=${mockUser.id}; path=/; max-age=86400`;
        document.cookie = `mock_user_email=${mockUser.email}; path=/; max-age=86400`;
        document.cookie = `mock_user_role=admin; path=/; max-age=86400`;
      }

      setInfoMsg("Authenticated. Redirecting to admin panel...");
      router.refresh();
      router.push("/admindashboard");
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
        const origin = typeof window !== "undefined" ? window.location.origin : "";
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            shouldCreateUser: false,
            emailRedirectTo: `${origin}/auth/callback`
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
      setErrorMsg(err.message || "Failed to resend verification code.");
    } finally {
      setLoading(false);
    }
  };

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  return (
    <div className="bg-[#0A0A0A] text-white font-body min-h-screen flex flex-col justify-center items-center p-8 relative overflow-hidden">
      {/* Background Decorative Blur */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#BA7517]/5 rounded-full blur-[120px] translate-x-1/3 -translate-y-1/3 pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[#BA7517]/5 rounded-full blur-[100px] -translate-x-1/3 translate-y-1/3 pointer-events-none"></div>

      <div className="w-full max-w-sm z-10 space-y-8">
        {/* logo and Header */}
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-white/5 p-2.5 flex items-center justify-center border border-[#BA7517]/25 shadow-md mb-6">
            <img 
              src="/assets/logo.png" 
              alt="6K Logo" 
              className="max-w-full max-h-full object-contain filter invert" 
              draggable={false}
            />
          </div>
        </div>

        {/* Center Card */}
        <div className="bg-[#121212] p-8 md:p-10 border border-[#BA7517] rounded-[4px] shadow-[0_8px_32px_rgba(0,0,0,0.7)]">
          {step === 1 ? (
            <div className="space-y-6">
              <div className="space-y-1 text-center">
                <h3 className="text-2xl font-black tracking-tight uppercase text-white">
                  ADMIN PORTAL
                </h3>
                <p className="text-[10px] text-[#BA7517] font-bold uppercase tracking-widest">
                  Authorized personnel only
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
                      placeholder="e.g. admin@stitch6k.in"
                      className="w-full h-[48px] pl-11 pr-11 border border-white/10 focus:border-[#BA7517] bg-black/40 text-white rounded-[4px] outline-none text-xs transition-colors placeholder:text-white/20"
                      required
                    />
                    {isEmailValid && (
                      <Check className="absolute right-4 top-1/2 -translate-y-1/2 text-[#BA7517] w-4 h-4" />
                    )}
                  </div>
                </div>

                {errorMsg && (
                  <div className="bg-red-950/50 text-red-400 text-[10px] font-bold uppercase tracking-widest p-4 border border-red-900/50 rounded-[4px]">
                    {errorMsg}
                  </div>
                )}
                {infoMsg && (
                  <div className="bg-green-950/50 text-[#22c55e] text-[10px] font-bold uppercase tracking-widest p-4 border border-green-900/50 rounded-[4px]">
                    {infoMsg}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-[52px] bg-[#BA7517] hover:bg-[#a36413] text-white text-xs font-medium uppercase tracking-[0.1em] rounded-[4px] transition-all flex items-center justify-between px-6 disabled:opacity-50 cursor-pointer"
                >
                  <div className="w-4" />
                  <span>{loading ? "Sending..." : "SEND OTP"}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-1.5 text-center">
                <h3 className="text-2xl font-black tracking-tight uppercase text-white">
                  Check your email
                </h3>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider leading-relaxed">
                  Enter the 6-digit code sent to <span className="text-white font-extrabold">{email}</span>
                </p>
                <div className="pt-2 text-center">
                  <button
                    onClick={() => setStep(1)}
                    className="text-[9px] font-black uppercase tracking-widest text-[#BA7517] hover:underline"
                  >
                    ← Change email
                  </button>
                </div>
              </div>

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
                      className="w-10 h-12 text-center border border-white/10 focus:border-[#BA7517] text-lg font-bold outline-none transition-colors rounded-[4px] bg-black/40 text-white"
                    />
                  ))}
                </div>

                {errorMsg && (
                  <div className="bg-red-950/50 text-red-400 text-[10px] font-bold uppercase tracking-widest p-4 border border-red-900/50 rounded-[4px]">
                    {errorMsg}
                  </div>
                )}
                {infoMsg && (
                  <div className="bg-green-950/50 text-[#22c55e] text-[10px] font-bold uppercase tracking-widest p-4 border border-green-900/50 rounded-[4px]">
                    {infoMsg}
                  </div>
                )}

                <div className="pt-2 space-y-4">
                  <button
                    type="button"
                    onClick={() => handleVerifyCode()}
                    disabled={loading}
                    className="w-full h-[52px] bg-[#BA7517] hover:bg-[#a36413] text-white text-xs font-medium uppercase tracking-[0.1em] rounded-[4px] transition-all flex items-center justify-between px-6 disabled:opacity-50 cursor-pointer"
                  >
                    <div className="w-4" />
                    <span>{loading ? "Verifying..." : "Verify Code"}</span>
                    <ArrowRight className="w-4 h-4" />
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
                        className="text-[10px] text-[#BA7517] hover:text-white font-black uppercase tracking-wider underline cursor-pointer disabled:opacity-50"
                      >
                        Resend code
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Back to store link */}
        <Link 
          href="/" 
          className="text-[10px] text-gray-500 hover:text-white font-bold uppercase tracking-widest transition-colors duration-300 text-center block mt-6"
        >
          ← Back to store
        </Link>

        {/* Mock mode feedback */}
        {!isSupabaseConfigured && (
          <div className="border-t border-white/10 pt-6 space-y-2 text-center">
            <div className="flex items-center justify-center gap-2 text-amber-500">
              <span className="material-symbols-outlined text-sm">info</span>
              <span className="text-[9px] font-black uppercase tracking-widest">Mock offline mode active</span>
            </div>
            <p className="text-[9px] text-white/40 font-bold uppercase leading-relaxed">
              Supabase keys are missing. Use code <span className="font-extrabold text-white">123456</span> to log in.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
