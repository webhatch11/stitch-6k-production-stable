"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

interface HeroSlide {
  badge: string;
  title: string;
  productId: string;
  price: string;
  desc: string;
  weave: string;
  time: string;
  rarity: string;
  registryId: string;
  ctaLink: string;
  bgImage: string;
  frontImage: string;
}

const heroSlides: HeroSlide[] = [
  {
    badge: "Limited Edition",
    title: "PURE MOTION\nPREMIUM SERIES.",
    productId: "Product Code: MOTION-6K",
    price: "₹12,499",
    desc: "Experience fluid comfort with the Pure Motion 6K series. Tailored to move with you, using our finest stretch-blend knit.",
    weave: "Stretch-Knit",
    time: "40 Hours",
    rarity: "80 Items",
    registryId: "MOTION-6K",
    ctaLink: "/shopallshirts",
    bgImage: "/assets/pure_motion_6k.png",
    frontImage: "/assets/pure_motion_6k.png",
  },
  {
    badge: "Premium Series 01",
    title: "OUR FINEST\nHANDMADE SHIRTS.",
    productId: "Product Code: MARBLE-001",
    price: "₹8,999",
    desc: "Handcrafted in small batches from high-quality black silk-linen fabric. Designed for comfort, style, and long-lasting quality.",
    weave: "Silk-Linen",
    time: "32 Hours",
    rarity: "150 Items",
    registryId: "MARBLE-001",
    ctaLink: "/signatureshirtblack",
    bgImage: "/assets/hero_showroom_marble.jpeg",
    frontImage: "/assets/hero_showroom_marble.jpeg",
  },
  {
    badge: "Premium Series 02",
    title: "CRISP & CLASSIC\nCOTTON SHIRTS.",
    productId: "Product Code: WHITE-002",
    price: "₹4,999",
    desc: "Made from the finest cotton, this crisp white shirt has a modern, clean look that fits perfectly for any formal or smart occasion.",
    weave: "Premium Cotton",
    time: "18 Hours",
    rarity: "500 Items",
    registryId: "WHITE-002",
    ctaLink: "/shopallshirts",
    bgImage: "/assets/hero_showroom_white.jpeg",
    frontImage: "/assets/hero_showroom_white.jpeg",
  },
  {
    badge: "Premium Series 03",
    title: "RELAXED & COOL\nLINEN SHIRTS.",
    productId: "Product Code: NAVY-003",
    price: "₹3,499",
    desc: "A breathable, light navy blue linen shirt colored with soft, natural dyes. Ideal for warm weather, outdoor events, or casual smart wear.",
    weave: "Linen Fabric",
    time: "24 Hours",
    rarity: "300 Items",
    registryId: "NAVY-003",
    ctaLink: "/shopallshirts",
    bgImage: "/assets/hero_navy_street.jpeg",
    frontImage: "/assets/hero_navy_street.jpeg",
  },
  {
    badge: "Spring Series 04",
    title: "THE ATELIER\nSPRING LOOK.",
    productId: "Product Code: SPRING-004",
    price: "₹5,499",
    desc: "An elegant olive-green utility shirt designed for modern versatility. Built with reinforced stitching and lightweight breathable cotton.",
    weave: "Spring Cotton",
    time: "20 Hours",
    rarity: "200 Items",
    registryId: "SPRING-004",
    ctaLink: "/shopallshirts",
    bgImage: "/assets/hero_spring_street.jpeg",
    frontImage: "/assets/hero_spring_street.jpeg",
  },
  {
    badge: "Resort Series 05",
    title: "VACATION & RESORT\nSIGNATURE SHIRTS.",
    productId: "Product Code: BEACH-005",
    price: "₹6,999",
    desc: "A relaxed-fit camp collar resort shirt. Light, breezy, and perfect for sunset strolls or beachside dining.",
    weave: "Breezy Linen",
    time: "28 Hours",
    rarity: "100 Items",
    registryId: "BEACH-005",
    ctaLink: "/shopallshirts",
    bgImage: "/assets/hero_beach_custom.jpeg",
    frontImage: "/assets/hero_beach_custom.jpeg",
  },
];

interface FavoriteProduct {
  id: string;
  name: string;
  category: string;
  price: string;
  tag: string;
  link: string;
  image: string;
  verticalText: string;
}

const favoriteProducts: FavoriteProduct[] = [
  {
    id: "fav-1",
    name: "Charcoal Oxford",
    category: "Premium Cotton",
    price: "₹3,999",
    tag: "Atelier",
    link: "/shoppingbag",
    image: "/assets/model_black_shirt.png",
    verticalText: "CHARCOAL OXFORD"
  },
  {
    id: "fav-2",
    name: "Desert Sand",
    category: "Linen Blend",
    price: "₹4,999",
    tag: "Popular",
    link: "/shoppingbag",
    image: "/assets/model_beige_shirt.png",
    verticalText: "DESERT SAND"
  },
  {
    id: "fav-3",
    name: "White Atelier",
    category: "Signature Series",
    price: "₹8,999",
    tag: "NEW",
    link: "/signatureshirtblack",
    image: "/assets/model_white_shirt.png",
    verticalText: "THE ATELIER"
  },
  {
    id: "fav-4",
    name: "Olive Linen",
    category: "Breathable Linen",
    price: "₹3,499",
    tag: "Trending",
    link: "/shoppingbag",
    image: "/assets/model_olive_shirt.png",
    verticalText: "OLIVE LINEN"
  },
  {
    id: "fav-5",
    name: "Navy Street",
    category: "Smart Casual",
    price: "₹5,999",
    tag: "Exclusive",
    link: "/shoppingbag",
    image: "/assets/model_navy_shirt.png",
    verticalText: "NAVY STREET"
  }
];

interface FavoriteStyleItem {
  id: string;
  name: string;
  price: string;
  image: string;
  badge: string;
  colors: string[];
}

const favoriteStyles: FavoriteStyleItem[] = [
  {
    id: "fav-style-1",
    name: "Tamil Nadu Floral Resort",
    price: "₹6,499",
    image: "/assets/floral_resort_shirt.png",
    badge: "New",
    colors: ["#ffd1d1", "#ffffff", "#775a19"]
  },
  {
    id: "fav-style-2",
    name: "Monochrome Geometric",
    price: "₹6,499",
    image: "/assets/geometric_resort_shirt.png",
    badge: "Limited",
    colors: ["#1a1c1c", "#ffffff", "#dadad9"]
  },
  {
    id: "fav-style-3",
    name: "Teal Crane Handloom",
    price: "₹6,999",
    image: "/assets/teal_crane_shirt.png",
    badge: "Bestseller",
    colors: ["#005f73", "#e5e2e1", "#ffffff"]
  },
  {
    id: "fav-style-4",
    name: "Nautical Striped Resort",
    price: "₹6,499",
    image: "/assets/striped_resort_shirt.png",
    badge: "Sale",
    colors: ["#bfdbfe", "#ffffff", "#e5e2e1"]
  },
  {
    id: "fav-style-5",
    name: "Classic Ivory Cotton",
    price: "₹5,999",
    image: "/assets/folded_white_shirt.png",
    badge: "New",
    colors: ["#ffffff", "#e5e2e1", "#e9c176"]
  },
  {
    id: "fav-style-6",
    name: "Varanasi Crimson Linen",
    price: "₹5,999",
    image: "/assets/folded_crimson_shirt.png",
    badge: "Bestseller",
    colors: ["#ba1a1a", "#e5e2e1", "#ffffff"]
  },
  {
    id: "fav-style-7",
    name: "Olive Handwoven Loom",
    price: "₹5,999",
    image: "/assets/folded_olive_shirt.png",
    badge: "Limited",
    colors: ["#3d4a3e", "#ffffff", "#e5e2e1"]
  },
  {
    id: "fav-style-8",
    name: "Midnight Navy Oxford",
    price: "₹5,999",
    image: "/assets/hanging_navy_shirt.png",
    badge: "Sale",
    colors: ["#0d1b2a", "#ffffff", "#775a19"]
  }
];

interface ShirtCategoryItem {
  id: string;
  name: string;
  title: string;
  subtitle: string;
  badge: string;
  image: string;
  thumbnail: string;
  cardBg: string;
  activeBg: string;
  glowColor: string;
  textColor: string;
}

const shirtCategories: ShirtCategoryItem[] = [
  {
    id: "cat-linen",
    name: "Classic Navy",
    title: "BELGIAN LINEN",
    subtitle: "Pure flax linen shirts for breathable, lightweight luxury",
    badge: "LINEN SERIES",
    image: "/assets/hanging_navy_shirt.png",
    thumbnail: "/assets/hanging_navy_shirt.png",
    cardBg: "from-[#1d3557] to-[#0f1d30]",
    activeBg: "linear-gradient(to bottom, #0f1d30, #1d3557, #0b1421)",
    glowColor: "rgba(29, 53, 87, 0.6)",
    textColor: "text-blue-100/70"
  },
  {
    id: "cat-crimson",
    name: "Crimson Cotton",
    title: "CRIMSON LUXURY",
    subtitle: "High-density combed cotton with embossed premium branding",
    badge: "T-SHIRT",
    image: "/assets/folded_crimson_shirt.png",
    thumbnail: "/assets/folded_crimson_shirt.png",
    cardBg: "from-[#5e1914] to-[#2d0b09]",
    activeBg: "linear-gradient(to bottom, #2d0b09, #5e1914, #1f0706)",
    glowColor: "rgba(94, 25, 20, 0.6)",
    textColor: "text-red-100/70"
  },
  {
    id: "cat-olive",
    name: "Olive Woven",
    title: "OLIVE UTILITY",
    subtitle: "Relaxed-fit camp collar shirt tailored for warm weather elegance",
    badge: "UTILITY",
    image: "/assets/folded_olive_shirt.png",
    thumbnail: "/assets/folded_olive_shirt.png",
    cardBg: "from-[#133c30] to-[#091e18]",
    activeBg: "linear-gradient(to bottom, #091e18, #133c30, #05110d)",
    glowColor: "rgba(19, 60, 48, 0.6)",
    textColor: "text-emerald-100/70"
  },
  {
    id: "cat-signature",
    name: "Signature 6K",
    title: "PURE MOTION",
    subtitle: "Luxurious knit-blend signature designer series with gold detailing",
    badge: "SIGNATURE",
    image: "/assets/pure_motion_6k.png",
    thumbnail: "/assets/pure_motion_6k.png",
    cardBg: "from-[#2c1d3f] to-[#160e20]",
    activeBg: "linear-gradient(to bottom, #160e20, #2c1d3f, #0e0914)",
    glowColor: "rgba(44, 29, 63, 0.6)",
    textColor: "text-purple-100/70"
  },
  {
    id: "cat-white",
    name: "Atelier Classic",
    title: "WHITE LUXURY",
    subtitle: "Double-ply long-staple cotton shirts with pristine sharp collars",
    badge: "ATELIER",
    image: "/assets/folded_white_shirt.png",
    thumbnail: "/assets/folded_white_shirt.png",
    cardBg: "from-[#374151] to-[#111827]",
    activeBg: "linear-gradient(to bottom, #111827, #374151, #0b0f19)",
    glowColor: "rgba(55, 65, 81, 0.6)",
    textColor: "text-gray-200/70"
  }
];

export default function Home() {
  // Favorite products active index state for 3D Coverflow slider
  const [activeFavIndex, setActiveFavIndex] = useState(2);
  const [activeCategoryIndex, setActiveCategoryIndex] = useState(0);
  const [selectedQuickShopIndex, setSelectedQuickShopIndex] = useState<number | null>(null);
  const [isCoverflowHovered, setIsCoverflowHovered] = useState(false);

  // Preloader state
  const [showLoader, setShowLoader] = useState(true);
  const [loaderExitClass, setLoaderExitClass] = useState(false);

  // Navigation drawer state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Hero slideshow state
  const [currentHeroSlide, setCurrentHeroSlide] = useState(0);
  const [heroTransitioning, setHeroTransitioning] = useState(false);

  // Helper to show premium toast notification
  const showAtelierToast = (message: string) => {
    let toast = document.getElementById("prototype-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "prototype-toast";
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.className = "active";

    setTimeout(() => {
      toast?.classList.remove("active");
      setTimeout(() => toast?.remove(), 600);
    }, 3500);
  };

  // Helper to add product to localStorage cart
  const handleAddToBag = (productName: string, priceStr: string, image: string, size: string) => {
    try {
      const priceVal = parseInt(priceStr.replace(/[^0-9]/g, ""));
      const currentCart = JSON.parse(localStorage.getItem("cart_items") || "[]");
      const newItem = {
        productName: productName,
        price: priceVal,
        size: size,
        image: image
      };
      const updatedCart = [...currentCart, newItem];
      localStorage.setItem("cart_items", JSON.stringify(updatedCart));
      localStorage.setItem("cartCount", updatedCart.length.toString());
      
      // Dispatch storage event to notify header/layout count
      window.dispatchEvent(new Event("storage"));
      
      // Close size selector
      setSelectedQuickShopIndex(null);
      
      // Show confirmation toast
      showAtelierToast(`${productName} (Size ${size}) added to your Atelier Bag.`);
    } catch (e) {
      console.error("Failed to add to bag:", e);
    }
  };
  const [tempSlideData, setTempSlideData] = useState<HeroSlide>(heroSlides[0]);
  const [isAutoPlay, setIsAutoPlay] = useState(true);

  // Best sellers auto-scroll refs
  const slingRef = useRef<HTMLDivElement>(null);
  const [isSlingHovered, setIsSlingHovered] = useState(false);

  // Newsletter email state
  const [newsletterEmail, setNewsletterEmail] = useState("");

  // Reviews interactive states
  interface Review {
    id: string;
    name: string;
    location: string;
    rating: number;
    comment: string;
    avatar: string;
  }

  const [reviews, setReviews] = useState<Review[]>([
    {
      id: "rev-1",
      name: "Aditya Verma",
      location: "Bengaluru, India",
      rating: 5,
      comment: "I've tried countless luxury shirt brands, but nothing compares to the breathability and structure of 6K's linen-cotton looms. The summer fit is tailored to perfection—every wear feels like bespoke luxury.",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=150&q=80"
    },
    {
      id: "rev-2",
      name: "Priya Deshmukh",
      location: "Mumbai, India",
      rating: 5,
      comment: "Mumbai's humidity is brutal, but 6K's ultra-breathable shirts are an absolute lifesaver. The craftsmanship from their South Indian workshops is immaculate, and the tailored fit keeps me looking sharp all day.",
      avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&h=150&q=80"
    },
    {
      id: "rev-3",
      name: "Sophia Mitchell",
      location: "London, UK",
      rating: 5,
      comment: "As a menswear enthusiast, I appreciate the premium long-staple cotton and the clean hand-rolled collars. The signature gold embroidery on 6K shirts is a beautiful, subtle touch. They've quickly become my go-to.",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80"
    },
    {
      id: "rev-4",
      name: "Karan Malhotra",
      location: "New Delhi, India",
      rating: 5,
      comment: "From the mother-of-pearl buttons to the signature gold branding, the attention to detail is mind-blowing. These aren't just shirts; they are pieces of textile art. Outstanding product!",
      avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=150&h=150&q=80"
    },
    {
      id: "rev-5",
      name: "Aisha Khan",
      location: "New York, USA",
      rating: 5,
      comment: "I never knew cotton-linen could feel this soft yet look so formal! The fit is immaculate, easily competing with Savile Row tailors but at a much fairer price. The gold embroidery adds a very premium vibe.",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80"
    },
    {
      id: "rev-6",
      name: "Mia Lawrence",
      location: "Toronto, Canada",
      rating: 5,
      comment: "I ordered the signature black shirt. The deep rich dye is stunning and hasn't faded after multiple washes. The fabric feels substantial, luxury-grade, and gets softer with every wash.",
      avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&h=150&q=80"
    },
    {
      id: "rev-7",
      name: "Emily Sanders",
      location: "Sydney, Australia",
      rating: 5,
      comment: "The linen weave is exceptionally fine, perfect for the Australian summer. The stitching quality matches international standards, and the packaging was incredibly premium. Highly recommend!",
      avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&h=150&q=80"
    },
    {
      id: "rev-8",
      name: "Vikram Nair",
      location: "Kochi, India",
      rating: 5,
      comment: "The absolute gold standard for shirts in India. The collar has the perfect structure and doesn't warp after a wash. I've replaced my entire wardrobe with 6K shirts now.",
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&h=150&q=80"
    },
    {
      id: "rev-9",
      name: "Olivia Richardson",
      location: "Los Angeles, USA",
      rating: 5,
      comment: "The fabric feels like a warm breeze! Extremely lightweight yet durable, and the tailored silhouette sits beautifully. The unboxing experience was absolutely premium.",
      avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&h=150&q=80"
    },
    {
      id: "rev-10",
      name: "Rahul Sen",
      location: "Kolkata, India",
      rating: 5,
      comment: "The South Indian loom heritage shines through. Every thread feels like a tribute to master weaving, and the fit is incredibly modern. Hands down the best shirts in my collection.",
      avatar: "https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?auto=format&fit=crop&w=150&h=150&q=80"
    }
  ]);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newRating, setNewRating] = useState(5);
  const [newHoverRating, setNewHoverRating] = useState<number | null>(null);
  const [newName, setNewName] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newComment, setNewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  const handleReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newLocation.trim() || !newComment.trim()) return;

    setSubmittingReview(true);
    setTimeout(() => {
      const getInitials = (n: string) => {
        const parts = n.trim().split(" ");
        if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
        return n.slice(0, 2).toUpperCase();
      };

      const newRev: Review = {
        id: "rev-" + Date.now(),
        name: newName,
        location: newLocation,
        rating: newRating,
        comment: newComment,
        avatar: getInitials(newName)
      };

      setReviews([newRev, ...reviews]);
      setNewName("");
      setNewLocation("");
      setNewComment("");
      setNewRating(5);
      setSubmittingReview(false);
      setShowAddForm(false);

      // Trigger visual toast
      setShowSuccessMessage(true);
      setTimeout(() => setShowSuccessMessage(false), 3500);
    }, 1000);
  };

  const firstRowReviews = reviews.filter((_, i) => i % 2 === 0);
  const secondRowReviews = reviews.filter((_, i) => i % 2 !== 0);

  const getCardBg = (row: number, index: number) => {
    const row1Colors = ["bg-[#fecaca]", "bg-[#fed7aa]", "bg-[#fef08a]", "bg-[#ccfbf1]", "bg-[#fbcfe8]"];
    const row2Colors = ["bg-[#bbf7d0]", "bg-[#bfdbfe]", "bg-[#e9d5ff]", "bg-[#fbcfe8]", "bg-[#fed7aa]"];
    const colors = row === 1 ? row1Colors : row2Colors;
    return colors[index % colors.length];
  };

  // Preloader transition
  useEffect(() => {
    // Disable body scroll while loading
    document.body.style.overflow = "hidden";

    const exitTimeout = setTimeout(() => {
      setLoaderExitClass(true);
      document.body.style.overflow = "";
    }, 2700);

    const removeTimeout = setTimeout(() => {
      setShowLoader(false);
    }, 3900); // 2700ms + 1200ms transition time

    return () => {
      clearTimeout(exitTimeout);
      clearTimeout(removeTimeout);
      document.body.style.overflow = "";
    };
  }, []);

  // Hero slider autoplay
  useEffect(() => {
    if (!isAutoPlay) return;

    const interval = setInterval(() => {
      handleSlideChange((currentHeroSlide + 1) % heroSlides.length);
    }, 8000);

    return () => clearInterval(interval);
  }, [currentHeroSlide, isAutoPlay]);

  // Best sellers horizontal auto-scroll
  useEffect(() => {
    const sling = slingRef.current;
    if (!sling) return;

    let autoScrollInterval: NodeJS.Timeout;

    const startAutoScroll = () => {
      autoScrollInterval = setInterval(() => {
        if (isSlingHovered) return;

        const maxScroll = sling.scrollWidth - sling.clientWidth;
        if (sling.scrollLeft >= maxScroll - 10) {
          sling.scrollTo({ left: 0, behavior: "smooth" });
        } else {
          const card = sling.querySelector(".snap-start");
          if (card) {
            const cardWidth = (card as HTMLElement).offsetWidth + 24; // width + gap
            sling.scrollBy({ left: cardWidth, behavior: "smooth" });
          }
        }
      }, 3000);
    };

    startAutoScroll();

    return () => clearInterval(autoScrollInterval);
  }, [isSlingHovered]);

  // Autoplay for 3D Coverflow slider
  useEffect(() => {
    if (selectedQuickShopIndex !== null || isCoverflowHovered) return;

    const timer = setInterval(() => {
      setActiveFavIndex((prev) => (prev + 1) % favoriteProducts.length);
    }, 5000); // Auto-scroll every 5 seconds

    return () => clearInterval(timer);
  }, [selectedQuickShopIndex, isCoverflowHovered]);

  const handleSlideChange = (index: number, manual = false) => {
    if (index === currentHeroSlide || heroTransitioning) return;

    if (manual) {
      setIsAutoPlay(false);
    }

    setHeroTransitioning(true);

    // Step-by-step cross-fade for text elements
    setTimeout(() => {
      setCurrentHeroSlide(index);
      setTempSlideData(heroSlides[index]);
      setHeroTransitioning(false);
    }, 300);
  };

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail) return;

    // Show a premium toast alert
    const toast = document.createElement("div");
    toast.id = "prototype-toast";
    toast.className = "active";
    toast.innerText = "Thank you for subscribing to our atelier.";
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.remove("active");
      setTimeout(() => toast.remove(), 600);
    }, 3000);

    setNewsletterEmail("");
  };

  return (
    <>
      {/* Glowing Brand Splash Preloader */}
      {showLoader && (
        <div
          id="brand-loader"
          className={`fixed inset-0 bg-[#000000] flex flex-col items-center justify-center z-[9999] overflow-hidden transition-all duration-[1200ms] cubic-bezier(0.85, 0, 0.15, 1) ${
            loaderExitClass ? "opacity-0 -translate-y-full scale-[0.96] pointer-events-none" : "opacity-100"
          }`}
        >
          {/* Fine luxury noise overlay */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#fed488_1px,transparent_1px)] [background-size:16px_16px]"></div>

          {/* Floating Golden Dust Particles */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
            <div className="gold-particle w-1.5 h-1.5" style={{ left: "10%", animationDelay: "0s", animationDuration: "12s" }}></div>
            <div className="gold-particle w-1 h-1" style={{ left: "25%", animationDelay: "2s", animationDuration: "9s" }}></div>
            <div className="gold-particle w-2 h-2" style={{ left: "45%", animationDelay: "4s", animationDuration: "14s" }}></div>
            <div className="gold-particle w-1 h-1" style={{ left: "60%", animationDelay: "1s", animationDuration: "10s" }}></div>
            <div className="gold-particle w-1.5 h-1.5" style={{ left: "80%", animationDelay: "3s", animationDuration: "11s" }}></div>
            <div className="gold-particle w-2.5 h-2.5" style={{ left: "15%", animationDelay: "6s", animationDuration: "16s" }}></div>
            <div className="gold-particle w-1 h-1" style={{ left: "35%", animationDelay: "5s", animationDuration: "8s" }}></div>
            <div className="gold-particle w-1.5 h-1.5" style={{ left: "70%", animationDelay: "7s", animationDuration: "13s" }}></div>
            <div className="gold-particle w-2 h-2" style={{ left: "90%", animationDelay: "2s", animationDuration: "15s" }}></div>
            <div className="gold-particle w-1 h-1" style={{ left: "50%", animationDelay: "8s", animationDuration: "11s" }}></div>
          </div>

          <div className="flex flex-col items-center gap-6 relative select-none z-10">
            {/* Glowing SVG Brand Mark Container */}
            <div className="relative w-36 h-36 flex items-center justify-center animate-subtle-zoom">
              {/* Golden Concentric Active Orbital Rings & Glow Layers */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0">
                <div className="absolute inset-0 bg-[#775a19]/25 rounded-full blur-3xl animate-pulse-slow"></div>
                <div className="absolute inset-4 bg-[#fed488]/10 rounded-full blur-2xl animate-pulse-fast"></div>
                <div className="absolute w-36 h-36 border border-[#fed488]/20 rounded-full animate-spin-slow"></div>
                <div className="absolute w-44 h-44 border border-dashed border-[#fed488]/10 rounded-full animate-spin-reverse-slow"></div>
                <div className="absolute w-52 h-52 border border-[#fed488]/5 rounded-full animate-pulse-slow"></div>
              </div>

              {/* Premium Logo Image in Circle */}
              <div className="w-32 h-32 rounded-full bg-white p-5 flex items-center justify-center shadow-2xl relative z-10 animate-pulse border border-[#fed488]/30">
                <img 
                  src="/assets/logo.png" 
                  alt="6K Logo" 
                  className="max-w-full max-h-full object-contain" 
                  draggable={false}
                />
              </div>

              {/* Golden Shimmer Ring */}
              <div className="absolute inset-0 border border-[#fed488]/10 rounded-full scale-110 animate-shimmer-ring"></div>
            </div>

            {/* Brand Name Text */}
            <div className="text-center space-y-3 relative z-10">
              <h1 className="font-headline text-3xl font-black tracking-[0.2em] uppercase opacity-0 animate-premium-text">
                <span className="shimmer-text">6K Designer Shirts</span>
              </h1>
              <div className="h-[1.5px] bg-gradient-to-r from-transparent via-[#fed488]/80 to-transparent mx-auto opacity-0 animate-gold-line"></div>
              <p className="text-[9px] font-black tracking-[0.5em] text-[#fed488]/60 uppercase opacity-0 animate-premium-subtext">
                Predefining Luxury
              </p>
            </div>
          </div>

          {/* Sleek Progress Line */}
          <div className="absolute bottom-0 left-0 w-full h-[1.5px] bg-white/5 z-20">
            <div className="animate-progress-line"></div>
          </div>
        </div>
      )}


      {/* Shared Header (Glassmorphic & Mobile First) */}
      <header className="sticky top-0 z-[100] glass-nav transition-all duration-300">
        <div className="flex items-center justify-between max-w-7xl mx-auto px-6 lg:px-20 py-2.5">
          <div className="flex items-center gap-12">
            {/* Logo */}
            <Link href="/" className="flex items-center group hover-scale">
              <div className="w-11 h-11 rounded-full bg-white p-1.5 flex items-center justify-center shadow-md border border-[#775a19]/15">
                <img 
                  src="/assets/logo.png" 
                  alt="6K Logo" 
                  className="max-w-full max-h-full object-contain" 
                  draggable={false}
                />
              </div>
            </Link>

            {/* Desktop Menu */}
            <nav className="hidden md:flex items-center gap-8">
              <Link
                className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface/60 hover:text-on-surface transition-all duration-300 relative after:absolute after:-bottom-1 after:left-0 after:w-0 after:h-[1px] after:bg-on-surface hover:after:w-full after:transition-all after:duration-300"
                href="/"
              >
                Home
              </Link>
              <Link
                className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface/60 hover:text-on-surface transition-all duration-300 relative after:absolute after:-bottom-1 after:left-0 after:w-0 after:h-[1px] after:bg-on-surface hover:after:w-full after:transition-all after:duration-300"
                href="/shopallshirts"
              >
                Shop All
              </Link>
              <Link
                className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface/60 hover:text-on-surface transition-all duration-300 relative after:absolute after:-bottom-1 after:left-0 after:w-0 after:h-[1px] after:bg-on-surface hover:after:w-full after:transition-all after:duration-300"
                href="/orderhistory"
              >
                Order History
              </Link>
              <Link
                className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface/60 hover:text-on-surface transition-all duration-300 relative after:absolute after:-bottom-1 after:left-0 after:w-0 after:h-[1px] after:bg-on-surface hover:after:w-full after:transition-all after:duration-300"
                href="/ordertracking"
              >
                Track Order
              </Link>
            </nav>
          </div>

          {/* Right Icons */}
          <div className="flex items-center gap-5">
            <Link
              href="/shoppingbag"
              className="material-symbols-outlined text-on-surface hover:text-secondary hover-scale hover:-rotate-6 transition-all duration-300"
            >
              shopping_bag
            </Link>
            <Link
              href="/myprofile"
              className="hidden md:block material-symbols-outlined text-on-surface hover:text-secondary hover-scale transition-all duration-300"
            >
              person
            </Link>
            {/* Hamburger Menu Button (Mobile) */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden relative z-[110] w-10 h-10 flex flex-col justify-center items-center gap-1.5 focus:outline-none group"
            >
              <span
                className={`w-6 h-0.5 bg-on-surface transition-all duration-300 ${
                  mobileMenuOpen ? "rotate-45 translate-y-2" : ""
                }`}
              ></span>
              <span
                className={`w-6 h-0.5 bg-on-surface transition-all duration-300 ${
                  mobileMenuOpen ? "opacity-0" : ""
                }`}
              ></span>
              <span
                className={`w-6 h-0.5 bg-on-surface transition-all duration-300 ${
                  mobileMenuOpen ? "-rotate-45 -translate-y-2" : ""
                }`}
              ></span>
            </button>
          </div>
        </div>

        {/* Mobile Drawer Menu */}
        <div
          className={`fixed inset-0 z-[105] bg-surface flex flex-col items-center justify-center p-6 md:hidden transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] ${
            mobileMenuOpen ? "clip-path-circle-open" : "clip-path-circle-closed"
          }`}
          style={{
            clipPath: mobileMenuOpen ? "circle(150% at top right)" : "circle(0% at top right)",
            transition: "clip-path 0.5s cubic-bezier(0.25, 1, 0.5, 1)",
          }}
        >
          <nav className="flex flex-col items-center gap-10 text-center">
            <Link
              onClick={() => setMobileMenuOpen(false)}
              className="text-3xl font-headline font-black uppercase tracking-tight text-on-surface hover:text-secondary transition-colors"
              href="/"
            >
              Home
            </Link>
            <Link
              onClick={() => setMobileMenuOpen(false)}
              className="text-3xl font-headline font-black uppercase tracking-tight text-on-surface hover:text-secondary transition-colors"
              href="/shopallshirts"
            >
              Shop All
            </Link>
            <Link
              onClick={() => setMobileMenuOpen(false)}
              className="text-3xl font-headline font-black uppercase tracking-tight text-on-surface hover:text-secondary transition-colors"
              href="/orderhistory"
            >
              Order History
            </Link>
            <Link
              onClick={() => setMobileMenuOpen(false)}
              className="text-3xl font-headline font-black uppercase tracking-tight text-on-surface hover:text-secondary transition-colors"
              href="/ordertracking"
            >
              Track Order
            </Link>
            <Link
              onClick={() => setMobileMenuOpen(false)}
              className="text-3xl font-headline font-black uppercase tracking-tight text-on-surface hover:text-secondary transition-colors"
              href="/myprofile"
            >
              Profile
            </Link>
          </nav>
          <div className="absolute bottom-12 flex gap-6 border-t border-outline/10 pt-8 w-full justify-center px-10">
            <Link
              onClick={() => setMobileMenuOpen(false)}
              className="text-xs font-bold uppercase tracking-widest text-outline hover:text-on-surface"
              href="/admindashboard"
            >
              Admin
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Section 1: Hero */}
        <section className="relative min-h-[75svh] lg:min-h-[82vh] flex flex-col justify-center overflow-hidden bg-on-surface py-24 lg:py-0">
          {/* Layered Backgrounds for Cross-Fade */}
          <div className="absolute inset-0 z-0 select-none pointer-events-none">
            {heroSlides.map((slide, i) => (
              <div
                key={`bg-${i}`}
                className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ease-in-out ${
                  i === currentHeroSlide ? "opacity-100 scale-100" : "opacity-0 scale-100"
                }`}
                style={{
                  backgroundImage: `url('${slide.bgImage}')`,
                  filter: "none",
                }}
              ></div>
            ))}

            {/* Ambient Organic glow gradient */}
            <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-secondary/10 blur-3xl"></div>
            <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-tertiary/10 blur-3xl"></div>
            {/* Vignette overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-on-surface via-transparent to-on-surface/50"></div>
          </div>

          {/* Animated Scroll Down Indicator */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1 select-none pointer-events-none opacity-40 hover:opacity-100 transition-opacity">
            <span className="text-[8px] uppercase tracking-[0.3em] text-surface font-bold">Scroll Details</span>
            <div className="w-[1px] h-8 bg-surface-variant relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1/2 bg-secondary animate-bounce"></div>
            </div>
          </div>
        </section>

        {/* Large Infinite Announcement Marquee */}
        <div className="marquee-container overflow-hidden w-full bg-on-surface text-surface py-4.5 text-[11px] font-black uppercase tracking-[0.25em] relative z-20 border-y border-white/5">
          <div className="flex animate-marquee whitespace-nowrap">
            <div className="flex shrink-0 items-center justify-around min-w-full gap-12 px-6">
              <span>FREE DELIVERY ACROSS INDIA</span>
              <span className="text-secondary-fixed-dim font-extrabold">•</span>
              <span>USE CODE <span className="text-secondary-fixed-dim font-extrabold">FESTIVE24</span> FOR 10% OFF</span>
              <span className="text-secondary-fixed-dim font-extrabold">•</span>
              <span>100% PREMIUM COTTON & LINEN</span>
              <span className="text-secondary-fixed-dim font-extrabold">•</span>
              <span>EASY 7-DAY RETURNS</span>
            </div>
            <div className="flex shrink-0 items-center justify-around min-w-full gap-12 px-6">
              <span>FREE DELIVERY ACROSS INDIA</span>
              <span className="text-secondary-fixed-dim font-extrabold">•</span>
              <span>USE CODE <span className="text-secondary-fixed-dim font-extrabold">FESTIVE24</span> FOR 10% OFF</span>
              <span className="text-secondary-fixed-dim font-extrabold">•</span>
              <span>100% PREMIUM COTTON & LINEN</span>
              <span className="text-secondary-fixed-dim font-extrabold">•</span>
              <span>EASY 7-DAY RETURNS</span>
            </div>
          </div>
        </div>

        {/* Section 2: Promotional Spotlight */}
        <section className="bg-surface-container-low py-12 px-4 lg:px-20 relative overflow-hidden group">
          <div className="max-w-5xl mx-auto w-full relative min-h-[320px] lg:min-h-[380px] flex items-center justify-center overflow-hidden bg-black border border-white/5 shadow-2xl">
            {/* Background Image with slow zoom-scale */}
            <img
              alt="Elegant dark silk fabric texture"
              className="absolute inset-0 w-full h-full object-cover grayscale brightness-[0.2] group-hover:scale-105 transition-transform duration-[3000ms] ease-out select-none pointer-events-none"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBt_dM_PwNyCwIwT-O1Hdc00MIZ22eGAUgYi9vEfWdoVc132M9C6iGLoFpcH8jO3Ef-tMj5hHNCSqM6luyueIIuCAzB2muFZoy5zrcS6-J6xi7bbBWJq9Vyy44Q5AaYLfV6B6xsYzHw0ZkNcVDrBXiQK17gSFXF9x3nD3Q9pNhJWSjTd_zcb6fo_VxbX_1BNBczo3rMeCVhL6lBg88mr66F5-9-dmZp16Hwth9jmqvFTgyCzd5dvpwfsUpu5d-js0dRPMLDm1UPQmA"
            />
            
            {/* Double-Gold Framed Card */}
            <div className="relative z-10 w-full max-w-lg mx-6 p-6 lg:p-10 border-4 border-double border-secondary/30 bg-black/60 backdrop-blur-md text-center flex flex-col items-center gap-4 shadow-2xl transition-all duration-500 hover:border-secondary/50">
              {/* Limited offer header */}
              <span className="text-secondary text-[9px] font-black uppercase tracking-[0.4em]">
                Limited Time Offer
              </span>

              {/* Mixed Typography Header */}
              <div className="flex flex-col items-center">
                <span className="font-serif italic text-secondary text-xl lg:text-3xl tracking-wide lowercase leading-none">
                  our new
                </span>
                <h2 className="text-white font-headline text-2xl lg:text-4xl font-extrabold tracking-[0.25em] uppercase mt-2 leading-none">
                  S E A S O N
                </h2>
              </div>

              {/* Subtitle */}
              <p className="text-gray-400 font-label text-[9px] uppercase tracking-[0.2em] max-w-sm leading-relaxed mt-1">
                Elevate your wardrobe with the atelier linen collection. Get 10% off with promo code.
              </p>
              
              {/* Stitched Atelier Tag (Interactive Coupon) */}
              <div className="relative group/tag mt-1">
                {/* Circular thread hole on the left side of the tag */}
                <div className="absolute left-2.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-black border border-secondary/30 shadow-inner z-10"></div>
                
                <button
                  onClick={() => {
                    navigator.clipboard.writeText("FESTIVE24");
                    // Trigger a custom toast notification on the client side
                    const toast = document.createElement("div");
                    toast.className = "fixed top-6 right-6 z-[1000] bg-black text-white py-4 px-6 text-[10px] font-bold uppercase tracking-[0.2em] shadow-2xl border border-white/10 rounded-none animate-fade-in";
                    toast.innerText = "COUPON FESTIVE24 COPIED TO CLIPBOARD!";
                    document.body.appendChild(toast);
                    setTimeout(() => toast.remove(), 2500);
                  }}
                  className="pl-7 pr-5 py-2.5 bg-white/5 border border-dashed border-secondary/55 hover:bg-white/10 hover:border-secondary text-white font-mono text-xs font-bold uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2.5 cursor-pointer select-all rounded-none"
                  title="Click to copy coupon code tag"
                >
                  <span className="text-[#fed488] font-black">FESTIVE24</span>
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/40 group-hover/tag:text-[#fed488] transition-colors"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                </button>
              </div>

              {/* Minimalist Button */}
              <div className="mt-2">
                <Link
                  href="/shopallshirts"
                  className="bg-secondary text-white hover:bg-[#fed488] hover:text-primary px-8 py-3 text-[9px] font-black uppercase tracking-[0.2em] transition-all duration-300 inline-block border-none font-bold"
                >
                  Shop The Collection
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Best Sellers / Featured Collection */}
        <section className="pt-36 pb-24 px-6 lg:px-20 bg-black border-y border-white/5 scroll-mt-24">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col items-center mb-16">
              <p className="text-secondary font-label text-[10px] sm:text-xs uppercase tracking-[0.45em] mb-3.5 text-center">
                New Arrivals
              </p>
              <h2 className="text-white font-headline text-3xl sm:text-4xl lg:text-5xl font-black tracking-[0.15em] uppercase text-center select-none leading-none">
                FEATURED COLLECTION
              </h2>
            </div>

            {/* 3D Coverflow Slider */}
            <div
              onMouseEnter={() => setIsCoverflowHovered(true)}
              onMouseLeave={() => setIsCoverflowHovered(false)}
              className="relative w-full overflow-visible py-8 flex flex-col items-center select-none"
            >
              {/* Coverflow Styles */}
              <style dangerouslySetInnerHTML={{__html: `
                .card-3d-item {
                  transform: translateX(calc(var(--card-offset) * 75px)) scale(var(--card-scale));
                }
                @media (min-width: 480px) {
                  .card-3d-item {
                    transform: translateX(calc(var(--card-offset) * 100px)) scale(var(--card-scale));
                  }
                }
                @media (min-width: 640px) {
                  .card-3d-item {
                    transform: translateX(calc(var(--card-offset) * 130px)) scale(var(--card-scale));
                  }
                }
                @media (min-width: 768px) {
                  .card-3d-item {
                    transform: translateX(calc(var(--card-offset) * 160px)) scale(var(--card-scale));
                  }
                }
                @media (min-width: 1024px) {
                  .card-3d-item {
                    transform: translateX(calc(var(--card-offset) * 200px)) scale(var(--card-scale));
                  }
                }
              `}} />

              {/* Flanking Chevrons */}
              <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 w-full flex justify-between px-2 md:px-10 z-40 pointer-events-none">
                <button
                  onClick={() => {
                    setActiveFavIndex((prev) => (prev - 1 + favoriteProducts.length) % favoriteProducts.length);
                    setSelectedQuickShopIndex(null);
                  }}
                  className="w-11 h-11 rounded-full border border-white/5 hover:border-white/20 bg-black/40 hover:bg-black/80 text-white flex items-center justify-center transition-all cursor-pointer pointer-events-auto backdrop-blur-md shadow-sm"
                  title="Previous item"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                </button>
                <button
                  onClick={() => {
                    setActiveFavIndex((prev) => (prev + 1) % favoriteProducts.length);
                    setSelectedQuickShopIndex(null);
                  }}
                  className="w-11 h-11 rounded-full border border-white/5 hover:border-white/20 bg-black/40 hover:bg-black/80 text-white flex items-center justify-center transition-all cursor-pointer pointer-events-auto backdrop-blur-md shadow-sm"
                  title="Next item"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </button>
              </div>

              {/* Cards Container */}
              <div className="relative w-full max-w-5xl h-[400px] md:h-[490px] flex justify-center items-center overflow-hidden">
                {favoriteProducts.map((product, i) => {
                  const n = favoriteProducts.length;
                  let offset = i - activeFavIndex;
                  if (offset > n / 2) {
                    offset -= n;
                  } else if (offset < -n / 2) {
                    offset += n;
                  }
                  const absOffset = Math.abs(offset);
                  const isActive = absOffset === 0;
                  const isQuickShopOpen = selectedQuickShopIndex === i;

                  // Limit visible card set for clean layout
                  if (absOffset > 2) return null;

                  const scale = isActive ? 1.05 : 0.88 - absOffset * 0.04;
                  const opacity = isActive ? 1.0 : 0.5 - absOffset * 0.15;
                  const zIndex = 30 - absOffset * 5;
                  const blurClass = isActive ? "blur-none" : "blur-[0.4px] md:blur-[0.6px]";
                  const grayscaleClass = isActive ? "grayscale-0" : "grayscale-[60%]";

                  return (
                    <div
                      key={product.id}
                      onClick={() => {
                        if (!isActive) {
                          setActiveFavIndex(i);
                          setSelectedQuickShopIndex(null);
                        }
                      }}
                      style={{
                        zIndex: zIndex,
                        opacity: opacity,
                        '--card-offset': offset,
                        '--card-scale': scale,
                      } as React.CSSProperties}
                      className={`card-3d-item absolute transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] flex h-[350px] md:h-[440px] rounded-[1.8rem] bg-[#0c0c0e] select-none cursor-pointer group ${
                        isActive ? "border border-secondary/40 shadow-[0_0_50px_rgba(254,212,136,0.22)]" : "border border-white/5 shadow-2xl"
                      } ${blurClass} ${grayscaleClass}`}
                    >
                      {/* Ambient spotlight radial gold glow behind active card */}
                      {isActive && (
                        <div className="absolute -inset-3.5 rounded-[2.2rem] bg-gradient-to-r from-secondary/15 via-[#fed488]/10 to-secondary/15 opacity-40 group-hover:opacity-60 blur-2xl transition-opacity duration-700 pointer-events-none -z-10 animate-pulse" style={{ animationDuration: '3s' }} />
                      )}

                      {/* Unified Card Frame */}
                      <div className={`h-full relative overflow-hidden transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] rounded-[1.8rem] bg-surface-container-low border border-black/5 flex flex-col justify-end ${
                        isActive ? "w-[210px] md:w-[250px]" : "w-[110px] sm:w-[130px] md:w-[150px]"
                      }`}>
                        {/* Product Image with smooth group hover scale */}
                        <img
                          alt={product.name}
                          className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none transition-transform duration-[2s] ease-out group-hover:scale-[1.08]"
                          src={product.image}
                        />
                        
                        {/* Overlay shadow for text contrast */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-60 pointer-events-none select-none"></div>

                        {/* Discover Piece Hover Overlay */}
                        {isActive && (
                          <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-center justify-center z-10">
                            <Link
                              href={product.link}
                              onClick={(e) => {
                                if (isQuickShopOpen) {
                                  e.preventDefault();
                                  setSelectedQuickShopIndex(null);
                                }
                              }}
                              className="bg-white/10 hover:bg-white/20 border border-white/20 hover:border-secondary text-white hover:text-[#fed488] font-bold tracking-[0.25em] text-[9px] uppercase py-3 px-6 rounded-full backdrop-blur-md transition-all duration-300 transform translate-y-2 group-hover:translate-y-0 shadow-lg"
                            >
                              Discover Piece
                            </Link>
                          </div>
                        )}

                        {/* NEW Badge Tag on active card (Top-left, gold border black box) */}
                        <div className={`absolute top-4 left-4 bg-secondary text-black px-2.5 py-1 text-[7.5px] font-black uppercase tracking-[0.25em] transition-opacity duration-500 z-10 rounded-sm shadow-md ${
                          isActive ? "opacity-100" : "opacity-0"
                        }`}>
                          {product.tag}
                        </div>

                        {/* Overlaid Rotated Vertical Text on the Right Side */}
                        <div
                          style={{
                            writingMode: 'vertical-rl',
                          } as React.CSSProperties}
                          className={`absolute right-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 z-10 transition-all duration-700 origin-center rotate-180 select-none pointer-events-none ${
                            isActive ? "opacity-90" : "opacity-30"
                          }`}
                        >
                          <span className={`text-[7.5px] uppercase tracking-[0.3em] font-black whitespace-nowrap transition-colors duration-700 ${
                            isActive ? "text-[#fed488] font-extrabold" : "text-black/60"
                          }`}>
                            {product.verticalText}
                          </span>
                          <span className={`text-[9.5px] uppercase tracking-[0.25em] font-black whitespace-nowrap mt-1.5 transition-colors duration-700 ${
                            isActive ? "shimmer-text font-black" : "text-black/60"
                          }`}>
                            Featured Collection
                          </span>
                        </div>

                        {/* Bottom Details Overlay (Transparent dark gradient, visible only when active) */}
                        <div className={`w-full absolute bottom-0 left-0 bg-gradient-to-t from-black/95 via-black/45 to-transparent text-white flex justify-between items-center px-6 pb-5 pt-10 transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] z-20 ${
                          isActive ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
                        }`}>
                          {/* Price details */}
                          <div className="flex flex-col">
                            <span className="text-[7.5px] text-white/50 font-black tracking-[0.25em] uppercase select-none">
                              Start from
                            </span>
                            <span className="text-sm font-black mt-0.5 tracking-wider text-secondary font-headline">
                              {product.price}
                            </span>
                          </div>

                          {/* Solid Gold Circular Shop Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedQuickShopIndex(isQuickShopOpen ? null : i);
                            }}
                            className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all duration-500 select-none scale-100 hover:scale-105 border ${
                              isQuickShopOpen
                                ? "bg-white text-black border-white z-30"
                                : "bg-secondary text-black hover:bg-[#fed488] border-secondary/15"
                            }`}
                            title={`Add ${product.name} to bag`}
                          >
                            {isQuickShopOpen ? (
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                            )}
                          </button>
                        </div>

                        {/* Slide-Up Size Selector Drawer */}
                        {isActive && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className={`absolute bottom-0 left-0 right-0 bg-black/95 backdrop-blur-md border-t border-white/10 p-3 md:p-5 pt-4 md:pt-6 pb-4 md:pb-6 transition-transform duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] z-25 flex flex-col items-center justify-center gap-3 md:gap-4 ${
                              isQuickShopOpen ? "translate-y-0" : "translate-y-full"
                            }`}
                          >
                            <div className="flex justify-between items-center w-full">
                              <span className="text-[8px] text-[#fed488] font-black uppercase tracking-[0.25em]">Select Size</span>
                              <span className="text-[7.5px] text-white/40 uppercase tracking-widest">{product.name}</span>
                            </div>

                            <div className="flex gap-2 md:gap-2.5 w-full justify-center">
                              {["S", "M", "L", "XL"].map((size) => (
                                <button
                                  key={size}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAddToBag(product.name, product.price, product.image, size);
                                  }}
                                  className="w-8 h-8 md:w-10 md:h-10 border border-white/10 hover:border-secondary hover:bg-secondary hover:text-black text-white text-[9px] md:text-[10px] font-black tracking-wider transition-all duration-300 rounded-lg flex items-center justify-center cursor-pointer"
                                >
                                  {size}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Dot Indicators (. . — . .) */}
              <div className="flex gap-2.5 mt-8 z-35 select-none items-center">
                {favoriteProducts.map((_, i) => {
                  const isActive = i === activeFavIndex;
                  return (
                    <button
                      key={`dot-${i}`}
                      onClick={() => {
                        setActiveFavIndex(i);
                        setSelectedQuickShopIndex(null);
                      }}
                      className={`transition-all duration-500 cursor-pointer ${
                        isActive 
                          ? "w-8 h-1.5 bg-secondary rounded-full" 
                          : "w-1.5 h-1.5 bg-white/20 hover:bg-white/40 rounded-full"
                      }`}
                      title={`Go to slide ${i + 1}`}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Section 3.5: Our Favorite Style */}
        <section className="py-24 px-6 lg:px-20 bg-[#FAF9F8] relative overflow-hidden border-t border-black/5">
          <div className="max-w-7xl mx-auto">
            {/* Header Block */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-16">
              <div>
                <p className="text-secondary font-label text-xs uppercase tracking-[0.4em] mb-3">
                  Curated Collection
                </p>
                <h2 className="font-headline text-3xl lg:text-4xl font-black text-neutral-900 uppercase tracking-tight">
                  Our Favorite Style
                </h2>
              </div>
              <p className="text-neutral-500 text-xs md:text-sm max-w-sm text-left lg:text-right leading-relaxed font-medium">
                Handpicked designs crafted from premium, high-density cotton and linen weaves, tailored for effortless style and unmatched comfort.
              </p>
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-12 md:gap-x-8 md:gap-y-16">
              {favoriteStyles.map((item) => (
                <div key={item.id} className="group flex flex-col cursor-pointer">
                  {/* Image container */}
                  <div className="relative aspect-[3/4] w-full rounded-[1.5rem] overflow-hidden bg-[#F5F5F5] border border-black/5 mb-5 shadow-[0_4px_16px_rgba(0,0,0,0.01)] transition-all duration-500 hover:shadow-[0_12px_24px_rgba(0,0,0,0.06)]">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-full h-full object-cover transition-transform duration-[1.2s] ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:scale-[1.05]"
                      draggable={false}
                    />
                    
                    {/* Badge */}
                    <div className="absolute top-4 left-4 bg-neutral-950/80 backdrop-blur-sm text-[8px] md:text-[9px] font-black uppercase text-white px-3 py-1 tracking-widest rounded-full">
                      {item.badge}
                    </div>

                    {/* Color Dots Indicator */}
                    <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm px-2 py-1.5 rounded-full flex gap-1 items-center border border-black/5 shadow-sm">
                      {item.colors.map((color, cIdx) => (
                        <span
                          key={cIdx}
                          className="w-2 md:w-2.5 h-2 md:h-2.5 rounded-full border border-black/10"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Text details below the image */}
                  <div className="flex justify-between items-start gap-4 mb-1">
                    <h3 className="font-sans font-bold text-neutral-900 text-xs md:text-sm text-left leading-tight group-hover:text-secondary transition-colors duration-300">
                      {item.name}
                    </h3>
                    <span className="font-sans font-black text-neutral-900 text-xs md:text-sm whitespace-nowrap">
                      {item.price}
                    </span>
                  </div>
                  <p className="font-sans text-[9px] md:text-[10px] text-neutral-400 font-bold uppercase tracking-wider text-left">
                    MRP inclusive of all taxes
                  </p>
                </div>
              ))}
            </div>

            {/* Bottom Button */}
            <div className="flex justify-center mt-16">
              <Link
                href="/shopallshirts"
                className="bg-neutral-950 text-white hover:bg-secondary hover:text-white px-10 py-4 rounded-full text-xs font-black uppercase tracking-widest transition-all duration-300 shadow-md flex items-center gap-2 hover:scale-[1.03] active:scale-[0.98]"
              >
                <span>All Products</span>
                <span className="material-symbols-outlined text-sm font-black">arrow_forward</span>
              </Link>
            </div>
          </div>
        </section>

        {/* Section 4: Category Showcase */}
        <section className="py-24 px-6 lg:px-20 bg-on-surface relative overflow-hidden">
          <div className="max-w-7xl mx-auto">
            {/* Header Block */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6">
              <div>
                <p className="text-secondary font-label text-xs uppercase tracking-[0.4em] mb-3">
                  Explore Categories
                </p>
                <h2 className="text-surface font-headline text-3xl lg:text-4xl font-black tracking-tighter uppercase">
                  OUR SHIRT STYLES
                </h2>
              </div>
              <p className="text-neutral-400 text-xs md:text-sm max-w-md font-medium leading-relaxed">
                Seamlessly blending high-density looms, rich colors, and bespoke fits, handpicked to redefine modern luxury wear.
              </p>
            </div>

            {/* Immersive Dashboard Container */}
            <div 
              className="relative w-full rounded-[2.5rem] overflow-hidden border border-white/10 shadow-[0_24px_80px_rgba(0,0,0,0.5)] min-h-[500px] md:min-h-[580px] lg:min-h-[660px] flex flex-col justify-between p-6 md:p-12 transition-all duration-[1s] ease-in-out"
              style={{
                background: shirtCategories[activeCategoryIndex].activeBg
              }}
            >
              {/* Dynamic Animated Background Images */}
              <div className="absolute inset-0 z-0">
                <AnimatePresence initial={false}>
                  <motion.div
                    key={activeCategoryIndex}
                    initial={{ opacity: 0, scale: 1.02 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.8, ease: "easeInOut" }}
                    className="absolute inset-0 w-full h-full"
                  >
                    <img
                      src={shirtCategories[activeCategoryIndex].image}
                      alt={shirtCategories[activeCategoryIndex].name}
                      className="w-full h-full object-cover object-center"
                      draggable={false}
                    />
                    {/* Immersive Vignette / Shadow Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/10 to-black/90" />
                    
                    {/* Ambient Theme Color Overlay */}
                    <div 
                      className="absolute inset-0 mix-blend-color opacity-35 pointer-events-none"
                      style={{ backgroundColor: shirtCategories[activeCategoryIndex].glowColor }}
                    />
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Top / Center Decorative Monogram and Typography Overlays */}
              <div className="relative z-10 flex flex-col items-center justify-center text-center my-auto px-4 pointer-events-none select-none">
                {/* Brand Logo Monogram */}
                <motion.div
                  key={`crest-${activeCategoryIndex}`}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 0.95, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="mb-6 w-16 h-16 md:w-20 md:h-20 rounded-full bg-white p-3.5 flex items-center justify-center shadow-2xl border border-white/20 hover:scale-105 transition-transform duration-300"
                >
                  <img
                    src="/assets/logo.png"
                    alt="6K Shirts Brand Logo"
                    className="max-w-full max-h-full object-contain"
                    draggable={false}
                  />
                </motion.div>

                {/* Split title layout mimicking PSYCHO / — THREE — */}
                <div className="overflow-hidden flex flex-col items-center">
                  <motion.h3
                    key={`title-main-${activeCategoryIndex}`}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.1, ease: [0.25, 1, 0.5, 1] }}
                    className="font-headline text-3xl md:text-5xl lg:text-6xl font-black text-white tracking-[0.25em] uppercase leading-none drop-shadow-[0_4px_16px_rgba(0,0,0,0.6)]"
                  >
                    {shirtCategories[activeCategoryIndex].title.split(" ")[0]}
                  </motion.h3>

                  <motion.div
                    key={`title-sub-${activeCategoryIndex}`}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 0.9, scale: 1 }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                    className="flex items-center justify-center gap-4 w-full mt-3"
                  >
                    <span className="h-[1px] w-8 md:w-16 bg-white/30"></span>
                    <span className="font-label text-[10px] md:text-xs text-white uppercase tracking-[0.5em] font-bold">
                      {shirtCategories[activeCategoryIndex].title.split(" ")[1] || "SERIES"}
                    </span>
                    <span className="h-[1px] w-8 md:w-16 bg-white/30"></span>
                  </motion.div>
                </div>

                {/* Subtitle / Description Text */}
                <motion.p
                  key={`subtitle-${activeCategoryIndex}`}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 0.8, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                  className={`text-[10px] md:text-xs max-w-sm mt-5 leading-relaxed font-semibold uppercase tracking-[0.15em] ${shirtCategories[activeCategoryIndex].textColor} drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]`}
                >
                  {shirtCategories[activeCategoryIndex].subtitle}
                </motion.p>

                {/* Floating Capsule Badge representing active category */}
                <motion.div
                  key={`badge-${activeCategoryIndex}`}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: 0.45 }}
                  className="mt-8 pointer-events-auto animate-pulse-slow"
                >
                  <Link
                    href="/shopallshirts"
                    className="inline-block bg-black/40 hover:bg-neutral-950/80 backdrop-blur-md border border-white/10 text-[9px] md:text-[10px] font-black tracking-[0.3em] uppercase text-white px-7 py-2.5 rounded-full shadow-[0_4px_16px_rgba(0,0,0,0.3)] hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer"
                  >
                    {shirtCategories[activeCategoryIndex].badge}
                  </Link>
                </motion.div>
              </div>

              {/* Bottom Interactive Thumbnail Cards */}
              <div className="relative z-10 w-full mt-auto pt-6 border-t border-white/5">
                <div className="flex justify-center items-center gap-3 md:gap-6 max-w-4xl mx-auto overflow-x-auto pb-2 scrollbar-none">
                  {shirtCategories.map((item, idx) => {
                    const isActive = idx === activeCategoryIndex;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveCategoryIndex(idx)}
                        onMouseEnter={() => setActiveCategoryIndex(idx)}
                        suppressHydrationWarning={true}
                        className={`group/card relative flex-shrink-0 w-[78px] h-[105px] md:w-[130px] md:h-[175px] rounded-[1.25rem] overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] ${
                          isActive
                            ? "ring-2 ring-secondary ring-offset-2 ring-offset-black/50 scale-[1.08] shadow-[0_12px_24px_rgba(0,0,0,0.5)]"
                            : "opacity-60 hover:opacity-95 hover:scale-[1.03] shadow-md"
                        } bg-gradient-to-b ${item.cardBg} border border-white/10`}
                      >
                        {/* Thumbnail contents */}
                        <div className="w-full h-full p-2 md:p-3.5 flex flex-col justify-between items-center relative">
                          {/* Floating shirt still */}
                          <div className="w-full h-[70%] flex items-center justify-center overflow-hidden">
                            <img
                              src={item.thumbnail}
                              alt={item.name}
                              className="max-w-full max-h-full object-contain transform group-hover/card:scale-[1.12] transition-transform duration-500"
                              draggable={false}
                            />
                          </div>

                          {/* Category Name inside card */}
                          <div className="w-full text-center">
                            <span className="text-[7.5px] md:text-[9.5px] font-black tracking-widest text-white/90 uppercase block truncate">
                              {item.name}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 5: Trust Section */}
        <section className="py-24 px-6 lg:px-20 bg-[#FAF9F8] border-t border-black/5 overflow-hidden">
          <div className="max-w-7xl mx-auto">
            <motion.div 
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={{
                hidden: { opacity: 0 },
                visible: {
                  opacity: 1,
                  transition: {
                    staggerChildren: 0.15
                  }
                }
              }}
              className="grid grid-cols-1 md:grid-cols-3 gap-16 md:gap-8 text-center"
            >
              {/* Point 1: Made In India */}
              <motion.div
                variants={{
                  hidden: { opacity: 0, y: 30 },
                  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.25, 1, 0.5, 1] } }
                }}
                className="flex flex-col items-center group cursor-default"
              >
                <div className="w-20 h-12 md:w-28 md:h-16 bg-[#F2F2F2] flex items-center justify-center transition-all duration-500 group-hover:scale-[1.05] group-hover:bg-white group-hover:shadow-[0_10px_20px_rgba(168,130,56,0.08)] group-hover:border-[#a88238]/30 rounded-sm mb-6 border border-black/5">
                  <span
                    className="material-symbols-outlined text-[28px] md:text-[32px] text-[#a88238] transition-colors duration-300 animate-handshake-shake"
                    style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 40" }}
                  >
                    handshake
                  </span>
                </div>
                <div className="px-4">
                  <h4 className="font-sans font-bold uppercase tracking-[0.25em] text-xs md:text-sm text-neutral-900 mb-3">
                    MADE IN INDIA
                  </h4>
                  <p className="text-neutral-500 text-xs md:text-xs leading-relaxed max-w-[280px] mx-auto">
                    Ethically crafted by master tailors using age-old Indian garment-making techniques.
                  </p>
                </div>
              </motion.div>

              {/* Point 2: Premium Fabric */}
              <motion.div
                variants={{
                  hidden: { opacity: 0, y: 30 },
                  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.25, 1, 0.5, 1] } }
                }}
                className="flex flex-col items-center group cursor-default"
              >
                <div className="w-20 h-12 md:w-28 md:h-16 bg-[#F2F2F2] flex items-center justify-center transition-all duration-500 group-hover:scale-[1.05] group-hover:bg-white group-hover:shadow-[0_10px_20px_rgba(168,130,56,0.08)] group-hover:border-[#a88238]/30 rounded-sm mb-6 border border-black/5">
                  <span
                    className="material-symbols-outlined text-[28px] md:text-[32px] text-[#a88238] transition-colors duration-300 animate-package-bounce"
                    style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 40" }}
                  >
                    package_2
                  </span>
                </div>
                <div className="px-4">
                  <h4 className="font-sans font-bold uppercase tracking-[0.25em] text-xs md:text-sm text-neutral-900 mb-3">
                    PREMIUM FABRIC
                  </h4>
                  <p className="text-neutral-500 text-xs md:text-xs leading-relaxed max-w-[280px] mx-auto">
                    Sourced from the world's finest mills, focusing on Egyptian cotton and pure linens.
                  </p>
                </div>
              </motion.div>

              {/* Point 3: Fast Delivery */}
              <motion.div
                variants={{
                  hidden: { opacity: 0, y: 30 },
                  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.25, 1, 0.5, 1] } }
                }}
                className="flex flex-col items-center group cursor-default"
              >
                <div className="w-20 h-12 md:w-28 md:h-16 bg-[#F2F2F2] flex items-center justify-center transition-all duration-500 group-hover:scale-[1.05] group-hover:bg-white group-hover:shadow-[0_10px_20px_rgba(168,130,56,0.08)] group-hover:border-[#a88238]/30 rounded-sm mb-6 border border-black/5">
                  <span
                    className="material-symbols-outlined text-[28px] md:text-[32px] text-[#a88238] transition-colors duration-300 animate-shipping-slide"
                    style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 40" }}
                  >
                    local_shipping
                  </span>
                </div>
                <div className="px-4">
                  <h4 className="font-sans font-bold uppercase tracking-[0.25em] text-xs md:text-sm text-neutral-900 mb-3">
                    FAST DELIVERY
                  </h4>
                  <p className="text-neutral-500 text-xs md:text-xs leading-relaxed max-w-[280px] mx-auto">
                    Express shipping across India. Your heritage piece arrives at your doorstep in 48 hours.
                  </p>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* Section 6: Social Proof (Global Reach) */}
        <section className="py-24 bg-[#F9FAFB] relative overflow-hidden">
          <div className="w-full relative z-10">
            {/* Header Centered block with standard padding */}
            <div className="max-w-7xl mx-auto px-6 lg:px-20 text-center mb-16">
              <p className="text-secondary font-label text-[10px] uppercase tracking-[0.4em] mb-4 text-center">
                Born in Tamil Nadu. Worn Worldwide.
              </p>
              <h2 className="font-headline text-3xl md:text-5xl font-black text-black mb-4 uppercase tracking-tight text-center">
                FROM OUR LOOMS
                <br />
                TO THE WORLD.
              </h2>
              <p className="text-neutral-500 max-w-xl mx-auto text-xs md:text-sm leading-relaxed mb-8 text-center">
                We handcraft every premium shirt in our Tamil Nadu workshop, shipping absolute luxury to discerning gentlemen across India and across the globe.
              </p>
              
              {/* Trust Badges */}
              <div className="flex justify-center items-center gap-6 flex-wrap mt-6">
                <div className="flex items-center gap-2 text-[10px] md:text-xs font-bold uppercase tracking-widest text-outline">
                  <span className="material-symbols-outlined text-secondary text-xl">flight_takeoff</span>
                  <span>International Shipping</span>
                </div>
                <div className="hidden md:block w-1.5 h-1.5 bg-outline/30 rounded-full"></div>
                <div className="flex items-center gap-2 text-[10px] md:text-xs font-bold uppercase tracking-widest text-outline">
                  <span className="material-symbols-outlined text-secondary text-xl">verified</span>
                  <span>10k+ Happy Customers</span>
                </div>
              </div>
            </div>

            {/* Marquee Rows Container */}
            <div className="w-full flex flex-col gap-4 overflow-hidden mb-12">
              {/* Row 1 (Left) */}
              <div className="marquee-container w-full overflow-hidden relative py-2">
                <div className="flex gap-6 w-max animate-marquee">
                  {firstRowReviews.map((rev, idx) => (
                    <div
                      key={rev.id}
                      className={`w-[290px] md:w-[320px] shrink-0 ${getCardBg(1, idx)} rounded-[1.25rem] p-6 flex flex-col justify-between shadow-[0_4px_16px_rgba(0,0,0,0.015)] border border-black/5 hover:scale-[1.02] transition-transform duration-300 select-none`}
                    >
                      <div>
                        {/* Rating Stars and Quotes */}
                        <div className="flex justify-between items-center mb-4">
                          <div className="flex gap-0.5 text-secondary">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <span
                                key={i}
                                className="material-symbols-outlined text-xs select-none"
                                style={{ fontVariationSettings: "'FILL' 1" }}
                              >
                                star
                              </span>
                            ))}
                          </div>
                          <span className="font-headline text-2xl font-black text-[#775a19]/25 leading-none select-none">
                            ”
                          </span>
                        </div>
                        <p className="font-sans text-[12px] md:text-[13px] font-semibold leading-relaxed mb-5 text-neutral-800 text-left">
                          &ldquo;{rev.comment}&rdquo;
                        </p>
                      </div>
                      
                      {/* User Info (No Avatar) */}
                      <div className="flex flex-col text-left mt-auto pt-2 border-t border-black/5">
                        <p className="font-sans font-bold text-[11px] md:text-[12px] uppercase tracking-wider text-neutral-900 leading-tight">
                          {rev.name}
                        </p>
                        <p className="font-sans text-[8px] md:text-[9px] text-neutral-500 font-bold uppercase tracking-widest mt-0.5">
                          {rev.location}
                        </p>
                      </div>
                    </div>
                  ))}
                  {/* Duplicated items for infinite marquee loop */}
                  {firstRowReviews.map((rev, idx) => (
                    <div
                      key={`${rev.id}-dup1`}
                      className={`w-[290px] md:w-[320px] shrink-0 ${getCardBg(1, idx)} rounded-[1.25rem] p-6 flex flex-col justify-between shadow-[0_4px_16px_rgba(0,0,0,0.015)] border border-black/5 hover:scale-[1.02] transition-transform duration-300 select-none`}
                    >
                      <div>
                        {/* Rating Stars and Quotes */}
                        <div className="flex justify-between items-center mb-4">
                          <div className="flex gap-0.5 text-secondary">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <span
                                key={i}
                                className="material-symbols-outlined text-xs select-none"
                                style={{ fontVariationSettings: "'FILL' 1" }}
                              >
                                star
                              </span>
                            ))}
                          </div>
                          <span className="font-headline text-2xl font-black text-[#775a19]/25 leading-none select-none">
                            ”
                          </span>
                        </div>
                        <p className="font-sans text-[12px] md:text-[13px] font-semibold leading-relaxed mb-5 text-neutral-800 text-left">
                          &ldquo;{rev.comment}&rdquo;
                        </p>
                      </div>
                      
                      {/* User Info (No Avatar) */}
                      <div className="flex flex-col text-left mt-auto pt-2 border-t border-black/5">
                        <p className="font-sans font-bold text-[11px] md:text-[12px] uppercase tracking-wider text-neutral-900 leading-tight">
                          {rev.name}
                        </p>
                        <p className="font-sans text-[8px] md:text-[9px] text-neutral-500 font-bold uppercase tracking-widest mt-0.5">
                          {rev.location}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Row 2 (Right) */}
              <div className="marquee-container w-full overflow-hidden relative py-2">
                <div className="flex gap-6 w-max animate-marquee-reverse">
                  {secondRowReviews.map((rev, idx) => (
                    <div
                      key={rev.id}
                      className={`w-[290px] md:w-[320px] shrink-0 ${getCardBg(2, idx)} rounded-[1.25rem] p-6 flex flex-col justify-between shadow-[0_4px_16px_rgba(0,0,0,0.015)] border border-black/5 hover:scale-[1.02] transition-transform duration-300 select-none`}
                    >
                      <div>
                        {/* Rating Stars and Quotes */}
                        <div className="flex justify-between items-center mb-4">
                          <div className="flex gap-0.5 text-secondary">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <span
                                key={i}
                                className="material-symbols-outlined text-xs select-none"
                                style={{ fontVariationSettings: "'FILL' 1" }}
                              >
                                star
                              </span>
                            ))}
                          </div>
                          <span className="font-headline text-2xl font-black text-[#775a19]/25 leading-none select-none">
                            ”
                          </span>
                        </div>
                        <p className="font-sans text-[12px] md:text-[13px] font-semibold leading-relaxed mb-5 text-neutral-800 text-left">
                          &ldquo;{rev.comment}&rdquo;
                        </p>
                      </div>
                      
                      {/* User Info (No Avatar) */}
                      <div className="flex flex-col text-left mt-auto pt-2 border-t border-black/5">
                        <p className="font-sans font-bold text-[11px] md:text-[12px] uppercase tracking-wider text-neutral-900 leading-tight">
                          {rev.name}
                        </p>
                        <p className="font-sans text-[8px] md:text-[9px] text-neutral-500 font-bold uppercase tracking-widest mt-0.5">
                          {rev.location}
                        </p>
                      </div>
                    </div>
                  ))}
                  {/* Duplicated items for infinite marquee loop */}
                  {secondRowReviews.map((rev, idx) => (
                    <div
                      key={`${rev.id}-dup2`}
                      className={`w-[290px] md:w-[320px] shrink-0 ${getCardBg(2, idx)} rounded-[1.25rem] p-6 flex flex-col justify-between shadow-[0_4px_16px_rgba(0,0,0,0.015)] border border-black/5 hover:scale-[1.02] transition-transform duration-300 select-none`}
                    >
                      <div>
                        {/* Rating Stars and Quotes */}
                        <div className="flex justify-between items-center mb-4">
                          <div className="flex gap-0.5 text-secondary">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <span
                                key={i}
                                className="material-symbols-outlined text-xs select-none"
                                style={{ fontVariationSettings: "'FILL' 1" }}
                              >
                                star
                              </span>
                            ))}
                          </div>
                          <span className="font-headline text-2xl font-black text-[#775a19]/25 leading-none select-none">
                            ”
                          </span>
                        </div>
                        <p className="font-sans text-[12px] md:text-[13px] font-semibold leading-relaxed mb-5 text-neutral-800 text-left">
                          &ldquo;{rev.comment}&rdquo;
                        </p>
                      </div>
                      
                      {/* User Info (No Avatar) */}
                      <div className="flex flex-col text-left mt-auto pt-2 border-t border-black/5">
                        <p className="font-sans font-bold text-[11px] md:text-[12px] uppercase tracking-wider text-neutral-900 leading-tight">
                          {rev.name}
                        </p>
                        <p className="font-sans text-[8px] md:text-[9px] text-neutral-500 font-bold uppercase tracking-widest mt-0.5">
                          {rev.location}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Form Button & Drawer inside centered container */}
            <div className="max-w-7xl mx-auto px-6 lg:px-20">
            <div className="flex justify-center mt-12">
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                suppressHydrationWarning={true}
                className="bg-transparent border border-secondary/50 text-[#775a19] px-8 py-3.5 text-xs font-black uppercase tracking-widest hover:bg-secondary hover:text-white transition-all duration-300 rounded-none relative overflow-hidden group"
              >
                <span className="relative z-10 flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">rate_review</span>
                  {showAddForm ? "Close Form" : "Share Your Experience"}
                </span>
                <span className="absolute inset-0 bg-[#775a19] transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left"></span>
              </button>
            </div>

            {/* Interactive Review Drawer */}
            <AnimatePresence>
              {showAddForm && (
                <motion.div
                  initial={{ height: 0, opacity: 0, marginTop: 0 }}
                  animate={{ height: "auto", opacity: 1, marginTop: 32 }}
                  exit={{ height: 0, opacity: 0, marginTop: 0 }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden max-w-2xl mx-auto border border-outline-variant/30 bg-surface-container-low p-8 relative rounded-none shadow-lg"
                >
                  <h3 className="font-headline text-lg font-black uppercase tracking-wider mb-6 text-on-surface text-center">
                    Leave a Review
                  </h3>
                  <form onSubmit={handleReviewSubmit} className="space-y-6">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-outline mb-2 text-center">
                        Rating
                      </label>
                      <div className="flex justify-center gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <motion.button
                            key={star}
                            type="button"
                            whileHover={{ scale: 1.2 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => setNewRating(star)}
                            onMouseEnter={() => setNewHoverRating(star)}
                            onMouseLeave={() => setNewHoverRating(null)}
                            className="text-2xl text-[#775a19] bg-transparent border-none cursor-pointer p-1"
                          >
                            <span className="material-symbols-outlined">
                              {star <= (newHoverRating !== null ? newHoverRating : newRating) ? "star" : "star_rate"}
                            </span>
                          </motion.button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label htmlFor="reviewerName" className="block text-[10px] font-black uppercase tracking-widest text-outline mb-2">
                          Full Name
                        </label>
                        <input
                          id="reviewerName"
                          type="text"
                          required
                          placeholder="e.g. Aditya Verma"
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          className="w-full bg-surface border-b border-outline-variant focus:border-secondary p-3 text-xs font-bold uppercase tracking-wider outline-none text-on-surface transition-all"
                        />
                      </div>
                      <div>
                        <label htmlFor="reviewerLocation" className="block text-[10px] font-black uppercase tracking-widest text-outline mb-2">
                          Location
                        </label>
                        <input
                          id="reviewerLocation"
                          type="text"
                          required
                          placeholder="e.g. Bengaluru, India"
                          value={newLocation}
                          onChange={(e) => setNewLocation(e.target.value)}
                          className="w-full bg-surface border-b border-outline-variant focus:border-secondary p-3 text-xs font-bold uppercase tracking-wider outline-none text-on-surface transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="reviewerComment" className="block text-[10px] font-black uppercase tracking-widest text-outline mb-2">
                        Review
                      </label>
                      <textarea
                        id="reviewerComment"
                        required
                        rows={4}
                        maxLength={300}
                        placeholder="Share your thoughts on the fabrics, fit, and craftsmanship..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        className="w-full bg-surface border border-outline-variant/30 focus:border-secondary p-4 text-xs font-medium outline-none text-on-surface transition-all"
                      />
                      <div className="text-right text-[9px] font-bold text-outline uppercase tracking-wider mt-1">
                        {newComment.length}/300 characters
                      </div>
                    </div>

                    <div className="flex justify-center">
                      <button
                        type="submit"
                        disabled={submittingReview}
                        className="bg-on-surface text-surface px-12 py-4 text-xs font-black uppercase tracking-widest hover:bg-secondary hover:text-white transition-all duration-300 disabled:opacity-50"
                      >
                        {submittingReview ? "Submitting..." : "Submit Review"}
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Dynamic Toast Success Banner */}
            <AnimatePresence>
              {showSuccessMessage && (
                <motion.div
                  initial={{ opacity: 0, y: 50, scale: 0.9, x: "-50%" }}
                  animate={{ opacity: 1, y: 0, scale: 1, x: "-50%" }}
                  exit={{ opacity: 0, y: 20, scale: 0.9, x: "-50%" }}
                  className="fixed bottom-10 left-1/2 bg-black border border-secondary/50 text-white px-8 py-4 z-[999] shadow-2xl flex items-center gap-3 rounded-none"
                >
                  <span className="material-symbols-outlined text-secondary">check_circle</span>
                  <span className="text-[10px] font-black uppercase tracking-widest">
                    Thank you! Your review has been submitted.
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          </div>
        </section>
      </main>

      {/* Global Footer */}
      <footer className="py-12 bg-[#0A0A0A] text-white px-6 lg:px-20 border-t-4 border-secondary">
        <div className="max-w-7xl mx-auto">
          {/* Top Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 text-secondary">
                  <img 
                    src="/assets/logo.png" 
                    alt="6K Logo" 
                    className="h-8 w-auto object-contain"
                    draggable={false}
                  />
                </div>
                <span className="font-headline text-2xl font-black tracking-tighter uppercase text-white">6K Shirts</span>
              </div>
              <p className="text-[10px] text-white/60 leading-relaxed max-w-sm uppercase tracking-widest font-light mb-6">
                Premium menswear born from the looms of South India. Crafted with precision, shipped globally.
              </p>
              <Link
                href="/admindashboard"
                className="inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all duration-300"
              >
                <span className="material-symbols-outlined text-sm">admin_panel_settings</span>
                Admin Portal
              </Link>
            </div>

            <div className="lg:text-right flex flex-col lg:items-end justify-center">
              <h4 className="text-lg font-headline font-black uppercase tracking-tight mb-2 text-white">
                Join the Atelier
              </h4>
              <p className="text-[9px] font-bold uppercase tracking-widest text-white/50 mb-4">
                Early access to limited runs and private sales.
              </p>
              <form
                onSubmit={handleNewsletterSubmit}
                className="flex w-full lg:max-w-md border-b border-white/20 pb-2 focus-within:border-secondary transition-colors"
              >
                <input
                  type="email"
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  placeholder="ENTER YOUR EMAIL"
                  suppressHydrationWarning={true}
                  className="bg-transparent border-none outline-none w-full text-[10px] uppercase tracking-widest text-white placeholder-white/30 px-2"
                />
                <button
                  type="submit"
                  suppressHydrationWarning={true}
                  className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary hover:text-white transition-colors px-2"
                >
                  Subscribe
                </button>
              </form>
            </div>
          </div>

          {/* Links Section */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10 pt-10 border-t border-white/10">
            <div className="col-span-1 md:col-span-2">
              <h4 className="text-[9px] font-black uppercase tracking-[0.3em] mb-4 text-white/40">Our Atelier</h4>
              <p className="text-[10px] font-light uppercase tracking-widest text-white/80 leading-loose flex items-start gap-4">
                <span className="material-symbols-outlined text-secondary mt-1">location_on</span>
                <span>
                  The Stitch 6K Workshop
                  <br />
                  Tiruppur Textile District
                  <br />
                  Tamil Nadu, India 641604
                  <br />
                  <span className="text-[8px] text-white/40 mt-1 block">Global Distribution Center</span>
                </span>
              </p>
            </div>
            <div>
              <h4 className="text-[9px] font-black uppercase tracking-[0.3em] mb-4 text-white/40">Client Services</h4>
              <ul className="space-y-3 text-[10px] font-light uppercase tracking-widest text-white/70">
                <li>
                  <Link href="/shipping-policy" className="hover:text-secondary hover:translate-x-1 inline-block transition-all">
                    Global Shipping
                  </Link>
                </li>
                <li>
                  <Link href="/return-policy" className="hover:text-secondary hover:translate-x-1 inline-block transition-all">
                    Returns & Exchanges
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="hover:text-secondary hover:translate-x-1 inline-block transition-all">
                    Size Guide
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="hover:text-secondary hover:translate-x-1 inline-block transition-all">
                    Contact Concierge
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-[9px] font-black uppercase tracking-[0.3em] mb-4 text-white/40">Legal</h4>
              <ul className="space-y-3 text-[10px] font-light uppercase tracking-widest text-white/70">
                <li>
                  <Link href="/terms" className="hover:text-white transition-colors">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="hover:text-white transition-colors">
                    Privacy Policy
                  </Link>
                </li>
              </ul>

              <div className="mt-6 flex gap-3">
                <div className="w-6 h-6 rounded-full border border-white/20 flex items-center justify-center text-white/50 hover:text-white hover:border-secondary transition-all cursor-pointer">
                  <span className="material-symbols-outlined text-[10px]">language</span>
                </div>
                <div className="w-6 h-6 rounded-full border border-white/20 flex items-center justify-center text-white/50 hover:text-white hover:border-secondary transition-all cursor-pointer">
                  <span className="material-symbols-outlined text-[10px]">flight</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Copyright */}
          <div className="pt-6 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-[9px] font-bold uppercase tracking-[0.4em] text-white/60">
              © 2026 6K Shirts. Crafted in Tamil Nadu.
            </p>
            <div className="flex items-center gap-4 text-white/60">
              <span className="text-[9px] uppercase tracking-widest font-bold">Shipping Worldwide</span>
              <div className="w-1 h-1 rounded-full bg-secondary"></div>
              <span className="text-[9px] uppercase tracking-widest font-bold">INR / USD / EUR / GBP</span>
            </div>
          </div>
        </div>
      </footer>

      {/* WhatsApp Sticky Button */}
      <a
        className="fixed bottom-8 right-8 z-[100] bg-[#25D366] text-white w-14 h-14 rounded-full flex items-center justify-center shadow-2xl hover:scale-110 transition-transform active:scale-95 group"
        href="https://wa.me/91XXXXXXXXXX"
        target="_blank"
        rel="noopener noreferrer"
      >
        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
        </svg>
        <span className="absolute right-full mr-4 bg-on-surface text-surface py-2 px-4 whitespace-nowrap text-xs font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
          Chat with Stylist
        </span>
      </a>
    </>
  );
}
