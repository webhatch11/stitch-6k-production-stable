"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

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

        // Check if verified user is an administrator
        const { data: profile, error: profileErr } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", data.user?.id)
          .maybeSingle();

        if (profileErr) throw profileErr;

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

  return (
    <div className="bg-[#0A0A0A] text-white font-body min-h-screen flex flex-col justify-center items-center p-8 relative overflow-hidden">
      {/* Dynamic Background Blurs */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#fed488]/5 rounded-full blur-[120px] translate-x-1/3 -translate-y-1/3 pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[#775a19]/5 rounded-full blur-[100px] -translate-x-1/3 translate-y-1/3 pointer-events-none"></div>

      <div className="absolute top-8 right-8 z-10">
        <Link 
          href="/" 
          className="text-[9px] font-black uppercase tracking-widest text-white/40 hover:text-white flex items-center gap-1 transition-colors"
        >
          Back to Shop <span className="material-symbols-outlined text-xs">close</span>
        </Link>
      </div>

      <div className="w-full max-w-sm space-y-10 z-10">
        {/* 6K Logo at top */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-white/5 p-2 flex items-center justify-center border border-[#fed488]/15 shadow-sm">
            <img src="/assets/logo.png" alt="6K Logo" className="max-w-full max-h-full object-contain filter invert" />
          </div>
        </div>

        {step === 1 ? (
          <div className="space-y-8 bg-white/5 p-8 border border-white/10 backdrop-blur-md rounded-none shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
            <div className="space-y-2 text-center">
              <h3 className="text-2xl font-headline font-black tracking-tighter uppercase text-white">
                Admin Portal
              </h3>
              <p className="text-[9px] text-[#fed488] uppercase tracking-widest font-bold">
                6K Brand Management
              </p>
            </div>

            <form onSubmit={handleSendOtp} className="space-y-6">
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase tracking-widest text-white/40">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@stitch6k.in"
                  className="w-full border-b border-white/20 focus:border-[#fed488] bg-transparent py-3 text-xs outline-none transition-colors rounded-none placeholder:text-white/20 text-white"
                  required
                />
              </div>

              {errorMsg && (
                <div className="bg-red-950/50 text-red-400 text-[10px] font-bold uppercase tracking-widest p-4 border border-red-900/50">
                  {errorMsg}
                </div>
              )}
              {infoMsg && (
                <div className="bg-green-950/50 text-green-400 text-[10px] font-bold uppercase tracking-widest p-4 border border-green-900/50">
                  {infoMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-white text-black hover:bg-[#fed488] hover:text-black text-xs font-black uppercase tracking-[0.2em] py-4 transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin h-3 w-3 border-2 border-black border-t-transparent rounded-full" />
                    Sending...
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
          <div className="space-y-8 bg-white/5 p-8 border border-white/10 backdrop-blur-md rounded-none shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
            <div className="space-y-2 text-center">
              <h3 className="text-2xl font-headline font-black tracking-tighter uppercase text-white">
                Enter Code
              </h3>
              <p className="text-[9px] text-[#fed488] uppercase tracking-widest font-bold leading-relaxed">
                Sent to <span className="text-white font-extrabold">{email}</span>
              </p>
              <div className="pt-1">
                <button
                  onClick={() => setStep(1)}
                  className="text-[9px] font-black uppercase tracking-widest text-[#fed488] hover:underline"
                >
                  Change email
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
                    className="w-10 h-12 text-center border-b-2 border-white/20 focus:border-[#fed488] bg-transparent text-lg font-bold outline-none transition-colors text-white"
                  />
                ))}
              </div>

              {errorMsg && (
                <div className="bg-red-950/50 text-red-400 text-[10px] font-bold uppercase tracking-widest p-4 border border-red-900/50">
                  {errorMsg}
                </div>
              )}
              {infoMsg && (
                <div className="bg-green-950/50 text-green-400 text-[10px] font-bold uppercase tracking-widest p-4 border border-green-900/50">
                  {infoMsg}
                </div>
              )}

              <div className="pt-2 space-y-4">
                <button
                  type="button"
                  onClick={() => handleVerifyCode()}
                  disabled={loading}
                  className="w-full bg-[#fed488] text-black hover:bg-[#dfb466] text-xs font-black uppercase tracking-[0.2em] py-4 transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin h-3 w-3 border-2 border-black border-t-transparent rounded-full" />
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
                    <span className="text-[10px] text-white/40 font-bold uppercase tracking-wider">
                      Resend in {countdown}s
                    </span>
                  ) : (
                    <button
                      onClick={handleResendOtp}
                      disabled={loading}
                      className="text-[10px] text-[#fed488] hover:text-white font-black uppercase tracking-wider underline cursor-pointer disabled:opacity-50"
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
          <div className="border-t border-white/10 pt-8 space-y-4">
            <div className="flex items-center gap-2 text-amber-500">
              <span className="material-symbols-outlined text-sm">info</span>
              <span className="text-[9px] font-black uppercase tracking-widest">Mock offline mode active</span>
            </div>
            <p className="text-[9px] text-white/40 font-bold uppercase leading-relaxed">
              Supabase keys are missing. Use code <span className="font-extrabold text-white">123456</span> to log in as admin.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
