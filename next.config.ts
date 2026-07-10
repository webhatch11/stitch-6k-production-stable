import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  turbopack: {},
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
    ],
  },
  experimental: {
    serverActions: {
      allowedOrigins: [
        "*.app.github.dev",
        "*.preview.app.github.dev",
        "localhost:3000",
        "the6k.com",
        "www.the6k.com",
      ],
    },
  },
  async headers() {
    // Basic CSP: allow self, inline styles (Tailwind/JSON-LD), Razorpay checkout,
    // Cloudinary/Unsplash images, Supabase + Upstash + Razorpay/Sentry XHR,
    // Google Fonts, Google Analytics (GA4) / Tag Manager (GTM), and Meta Pixel.
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://*.razorpay.com https://upload-widget.cloudinary.com https://widget.cloudinary.com https://www.googletagmanager.com https://*.googletagmanager.com https://connect.facebook.net",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https://res.cloudinary.com https://images.unsplash.com https://lh3.googleusercontent.com https://*.razorpay.com https://www.facebook.com https://www.google-analytics.com https://www.googletagmanager.com",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self' https://*.supabase.co https://*.upstash.io https://*.razorpay.com https://api.razorpay.com https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://api.cloudinary.com https://res.cloudinary.com https://upload-widget.cloudinary.com https://www.google-analytics.com https://*.google-analytics.com https://www.googletagmanager.com https://connect.facebook.net https://www.facebook.com",
      "frame-src 'self' https://*.razorpay.com https://api.razorpay.com https://upload-widget.cloudinary.com https://widget.cloudinary.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        net: false,
        tls: false,
        dns: false,
        fs: false,
        child_process: false,
        crypto: false,
        os: false,
        stream: false,
        worker_threads: false,
      };
    } else {
      config.externals = [
        ...(config.externals || []),
        "bullmq",
        "ioredis"
      ];
    }
    return config;
  },
};

// Wrap with Sentry. Source-map upload only runs when SENTRY_AUTH_TOKEN is set,
// so local/dev builds without Sentry credentials are unaffected.
export default withSentryConfig(nextConfig, {
  silent: !process.env.CI,
  // Source-map upload only runs when SENTRY_AUTH_TOKEN is set.
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
});