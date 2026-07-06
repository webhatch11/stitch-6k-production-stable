"use client";
import Script from "next/script";

export function GA4Script() {
  const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID;

  // If GTM is configured, GA4 runs through GTM. Only install direct if no GTM.
  if (!GA_ID || GA_ID === "G-XXXXXXXXXX") return null;
  if (GTM_ID && GTM_ID !== "GTM-XXXXXXX") return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}', {
            page_path: window.location.pathname,
          });
        `}
      </Script>
    </>
  );
}
