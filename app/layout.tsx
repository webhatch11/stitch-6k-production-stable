import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/ToastProvider";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://the6k.com"
  ),
  title: "Stitch 6K | Predefining Luxury",
  description: "Handcrafted luxury menswear and GEN-Z streetwear woven from the looms of South India. Limited batches, precision tailored.",
  keywords: ["luxury shirts", "GEN-Z streetwear", "linen shirts", "premium cotton", "Stitch 6K", "menswear", "South India"],
  openGraph: {
    title: "Stitch 6K | Predefining Luxury",
    description: "Handcrafted luxury menswear and GEN-Z streetwear woven from the looms of South India.",
    url: "https://6kthebrand.com",
    siteName: "Stitch 6K",
    images: [
      {
        url: "/assets/logo.png",
        width: 800,
        height: 600,
        alt: "Stitch 6K Logo",
      },
    ],
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Stitch 6K | Predefining Luxury",
    description: "Handcrafted luxury menswear and GEN-Z streetwear woven from the looms of South India.",
    images: ["/assets/logo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&family=Manrope:wght@200..800&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col bg-surface text-on-surface">
        <ToastProvider />
        {children}
      </body>
    </html>
  );
}
