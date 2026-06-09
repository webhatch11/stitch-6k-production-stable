"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SignatureShirtBlackRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/product/luxury-black-shirt");
  }, [router]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center text-white text-[10px] font-black uppercase tracking-[0.3em]">
      Redirecting to Signature Luxury Black Shirt...
    </div>
  );
}
