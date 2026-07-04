"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col items-center justify-center bg-black text-white p-6 text-center">
        <h1 className="text-2xl font-black uppercase tracking-tight mb-3">
          Something went wrong
        </h1>
        <p className="text-xs uppercase tracking-widest text-white/60 mb-6">
          An unexpected error occurred. Our team has been notified.
        </p>
        <a
          href="/"
          className="inline-flex items-center bg-white text-black px-6 py-3 text-[10px] font-black uppercase tracking-[0.2em]"
        >
          Return Home
        </a>
      </body>
    </html>
  );
}
