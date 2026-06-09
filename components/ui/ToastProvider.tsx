"use client";

import React, { useEffect, useState } from "react";
import { useToastStore } from "@/stores/toastStore";
import { motion, AnimatePresence } from "framer-motion";

export function ToastProvider() {
  const toasts = useToastStore((state) => state.toasts);
  const removeToast = useToastStore((state) => state.removeToast);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  if (!isHydrated) return null;

  return (
    <div className="fixed top-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => {
          let bgColor = "bg-on-surface text-surface"; // default/info
          if (toast.type === "error") bgColor = "bg-red-700 text-white";
          else if (toast.type === "success") bgColor = "bg-[#775a19] text-white";

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95, transition: { duration: 0.2 } }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className={`py-4 px-6 text-[10px] font-bold uppercase tracking-[0.2em] shadow-2xl border border-outline/25 pointer-events-auto cursor-pointer ${bgColor}`}
              onClick={() => removeToast(toast.id)}
            >
              <div className="flex items-center gap-3">
                {toast.type === "success" && <span className="material-symbols-outlined text-sm">check_circle</span>}
                {toast.type === "error" && <span className="material-symbols-outlined text-sm">error</span>}
                {toast.type === "info" && <span className="material-symbols-outlined text-sm">info</span>}
                <span>{toast.message}</span>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
