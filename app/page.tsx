"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";

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
    badge: "Premium Series 01",
    title: "OUR FINEST\nHANDMADE SHIRTS.",
    productId: "Product Code: NOIR-001",
    price: "₹8,999",
    desc: "Handcrafted in small batches from high-quality black silk-linen fabric. Designed for comfort, style, and long-lasting quality.",
    weave: "Silk-Linen",
    time: "32 Hours",
    rarity: "150 Items",
    registryId: "NOIR-001",
    ctaLink: "/signatureshirtblack",
    bgImage: "/assets/noir_hero_bg.png",
    frontImage: "/assets/noir_hero_bg.png",
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
    bgImage: "/assets/white_hero_bg.png",
    frontImage: "/assets/white_hero_bg.png",
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
    bgImage: "/assets/navy_hero_bg.png",
    frontImage: "/assets/navy_hero_bg.png",
  },
];

export default function Home() {
  // Preloader state
  const [showLoader, setShowLoader] = useState(true);
  const [loaderExitClass, setLoaderExitClass] = useState(false);

  // Navigation drawer state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Hero slideshow state
  const [currentHeroSlide, setCurrentHeroSlide] = useState(0);
  const [heroTransitioning, setHeroTransitioning] = useState(false);
  const [tempSlideData, setTempSlideData] = useState<HeroSlide>(heroSlides[0]);
  const [isAutoPlay, setIsAutoPlay] = useState(true);

  // Best sellers auto-scroll refs
  const slingRef = useRef<HTMLDivElement>(null);
  const [isSlingHovered, setIsSlingHovered] = useState(false);

  // Newsletter email state
  const [newsletterEmail, setNewsletterEmail] = useState("");

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

              {/* Premium Triangle Logo */}
              <svg className="w-28 h-28 drop-shadow-[0_0_20px_rgba(254,212,136,0.4)] relative z-10" fill="none" viewBox="0 0 48 48">
                <path
                  d="M13.8261 30.5736C16.7203 29.8826 20.2244 29.4783 24 29.4783C27.7756 29.4783 31.2797 29.8826 34.1739 30.5736C36.9144 31.2278 39.9967 32.7669 41.3563 33.8352L24.8486 7.36089C24.4571 6.73303 23.5429 6.73303 23.1514 7.36089L6.64374 33.8352C8.00331 32.7669 11.0856 31.2278 13.8261 30.5736Z"
                  className="animate-draw-and-fill"
                  stroke="url(#goldGradient)"
                  strokeWidth="1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <text
                  x="24"
                  y="25.5"
                  fill="#000000"
                  fontFamily="var(--font-manrope)"
                  fontWeight="900"
                  fontSize="12.5"
                  textAnchor="middle"
                  letterSpacing="-0.03em"
                  className="animate-fade-in-monogram"
                >
                  6K
                </text>
                <defs>
                  <linearGradient id="goldGradient" x1="0%" y1="100%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#5d4201" />
                    <stop offset="35%" stopColor="#fed488" />
                    <stop offset="65%" stopColor="#ffffff" />
                    <stop offset="80%" stopColor="#fed488" />
                    <stop offset="100%" stopColor="#775a19" />
                  </linearGradient>
                </defs>
              </svg>

              {/* Golden Shimmer Ring */}
              <div className="absolute inset-0 border border-[#fed488]/10 rounded-full scale-110 animate-shimmer-ring"></div>
            </div>

            {/* Brand Name Text */}
            <div className="text-center space-y-3 relative z-10">
              <h1 className="font-headline text-3xl font-black tracking-[0.2em] uppercase opacity-0 animate-premium-text">
                <span className="shimmer-text">6K Shirts</span>
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

      {/* Top Announcement Scrolling Marquee */}
      <div className="marquee-container overflow-hidden w-full bg-on-surface text-surface py-2.5 text-[10px] font-bold uppercase tracking-[0.2em] relative z-[60]">
        <div className="flex animate-marquee whitespace-nowrap">
          <div className="flex shrink-0 items-center gap-12 px-6">
            <span>FREE DELIVERY ACROSS INDIA</span>
            <span className="text-secondary-fixed-dim">•</span>
            <span>USE CODE <span className="text-secondary-fixed-dim font-extrabold">FESTIVE24</span> FOR 10% OFF</span>
            <span className="text-secondary-fixed-dim">•</span>
            <span>100% PREMIUM COTTON & LINEN</span>
            <span className="text-secondary-fixed-dim">•</span>
            <span>EASY 7-DAY RETURNS</span>
            <span className="text-secondary-fixed-dim">•</span>
          </div>
          <div className="flex shrink-0 items-center gap-12 px-6">
            <span>FREE DELIVERY ACROSS INDIA</span>
            <span className="text-secondary-fixed-dim">•</span>
            <span>USE CODE <span className="text-secondary-fixed-dim font-extrabold">FESTIVE24</span> FOR 10% OFF</span>
            <span className="text-secondary-fixed-dim">•</span>
            <span>100% PREMIUM COTTON & LINEN</span>
            <span className="text-secondary-fixed-dim">•</span>
            <span>EASY 7-DAY RETURNS</span>
            <span className="text-secondary-fixed-dim">•</span>
          </div>
        </div>
      </div>

      {/* Shared Header (Glassmorphic & Mobile First) */}
      <header className="sticky top-0 z-[100] glass-nav transition-all duration-300">
        <div className="flex items-center justify-between max-w-7xl mx-auto px-6 lg:px-20 py-4">
          <div className="flex items-center gap-12">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 group hover-scale">
              <div className="w-6 h-6 text-on-surface group-hover:text-secondary transition-colors">
                <svg fill="none" viewBox="0 0 48 48" className="w-full h-full">
                  <path
                    d="M13.8261 30.5736C16.7203 29.8826 20.2244 29.4783 24 29.4783C27.7756 29.4783 31.2797 29.8826 34.1739 30.5736C36.9144 31.2278 39.9967 32.7669 41.3563 33.8352L24.8486 7.36089C24.4571 6.73303 23.5429 6.73303 23.1514 7.36089L6.64374 33.8352C8.00331 32.7669 11.0856 31.2278 13.8261 30.5736Z"
                    fill="currentColor"
                  />
                </svg>
              </div>
              <h2 className="text-on-surface font-headline text-2xl font-extrabold tracking-tighter">6K</h2>
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
        <section className="relative min-h-[100svh] lg:min-h-screen flex flex-col justify-center overflow-hidden bg-on-surface py-32 lg:py-0">
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
                  filter: i === 0 ? "brightness(0.4)" : "brightness(0.35)",
                }}
              ></div>
            ))}

            {/* Ambient Organic glow gradient */}
            <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-secondary/10 blur-3xl"></div>
            <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-tertiary/10 blur-3xl"></div>
            {/* Vignette overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-on-surface via-transparent to-on-surface/50"></div>
          </div>

          <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-20">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
              {/* Left Panel: Editorial Typography */}
              <div className="lg:col-span-7 flex flex-col items-start gap-6 lg:gap-8 mt-12 lg:mt-0">
                {/* Collection Tag */}
                <span
                  style={{
                    opacity: heroTransitioning ? 0 : 1,
                    transform: heroTransitioning ? "translateY(10px)" : "translateY(0)",
                    transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                  }}
                  className="text-surface font-label text-xs uppercase tracking-[0.4em] bg-tertiary px-4 py-1.5 transition-all duration-500"
                >
                  {tempSlideData.badge}
                </span>

                {/* Main Text Details */}
                <div className="space-y-4 w-full">
                  <h1
                    style={{
                      opacity: heroTransitioning ? 0 : 1,
                      transform: heroTransitioning ? "translateY(10px)" : "translateY(0)",
                      transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                      fontSize: "clamp(3rem, 7vw, 6rem)",
                    }}
                    className="text-surface font-headline font-black leading-[1.05] tracking-tight select-none text-balance"
                  >
                    {tempSlideData.title.split("\n")[0]}
                    <br />
                    <span className="text-gold-gradient">{tempSlideData.title.split("\n")[1]}</span>
                  </h1>

                  <div
                    style={{
                      opacity: heroTransitioning ? 0 : 1,
                      transform: heroTransitioning ? "translateY(10px)" : "translateY(0)",
                      transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                    }}
                    className="flex flex-wrap items-baseline gap-4 mt-2"
                  >
                    <span className="text-xs font-black tracking-widest text-secondary uppercase">
                      {tempSlideData.productId}
                    </span>
                    <span className="text-sm font-bold text-surface/50">{tempSlideData.price}</span>
                  </div>

                  <p
                    style={{
                      opacity: heroTransitioning ? 0 : 1,
                      transform: heroTransitioning ? "translateY(10px)" : "translateY(0)",
                      transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                    }}
                    className="text-surface-variant text-base lg:text-lg font-body max-w-lg leading-relaxed select-none"
                  >
                    {tempSlideData.desc}
                  </p>
                </div>

                {/* Specifications */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-md bg-white/5 backdrop-blur-md p-6 select-none border border-white/5 rounded-sm">
                  <div>
                    <div className="text-[9px] uppercase tracking-widest text-surface/40 font-black mb-1.5">Fabric</div>
                    <div
                      style={{
                        opacity: heroTransitioning ? 0 : 1,
                        transform: heroTransitioning ? "translateY(10px)" : "translateY(0)",
                        transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                      }}
                      className="text-xs font-bold text-surface tracking-wider uppercase"
                    >
                      {tempSlideData.weave}
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase tracking-widest text-surface/40 font-black mb-1.5">Time to Make</div>
                    <div
                      style={{
                        opacity: heroTransitioning ? 0 : 1,
                        transform: heroTransitioning ? "translateY(10px)" : "translateY(0)",
                        transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                      }}
                      className="text-xs font-bold text-surface tracking-wider uppercase"
                    >
                      {tempSlideData.time}
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase tracking-widest text-surface/40 font-black mb-1.5">Stock Status</div>
                    <div
                      style={{
                        opacity: heroTransitioning ? 0 : 1,
                        transform: heroTransitioning ? "translateY(10px)" : "translateY(0)",
                        transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                      }}
                      className="text-xs font-bold text-secondary tracking-wider uppercase"
                    >
                      {tempSlideData.rarity}
                    </div>
                  </div>
                </div>

                {/* Action & Exploration */}
                <div className="flex flex-wrap gap-4 items-center">
                  <Link href={tempSlideData.ctaLink} className="inline-block transition-transform duration-300 hover:scale-[1.03]">
                    <button className="bg-gradient-to-r from-secondary to-secondary-container text-on-secondary px-10 py-5 text-[11px] font-black uppercase tracking-[0.2em] shadow-xl shadow-secondary/15 transition-all btn-active-scale">
                      Buy Now
                    </button>
                  </Link>
                  <Link href="/shopallshirts" className="inline-block transition-transform duration-300 hover:scale-[1.03]">
                    <button className="bg-surface/5 text-surface border border-surface/10 px-10 py-5 text-[11px] font-black uppercase tracking-[0.2em] hover:bg-surface hover:text-on-surface transition-all btn-active-scale">
                      View All Shirts
                    </button>
                  </Link>
                </div>

                {/* Bottom Controls / Slide Navigation Thumbnails */}
                <div className="grid grid-cols-3 gap-3 w-full max-w-lg mt-4 lg:mt-8">
                  {heroSlides.map((slide, idx) => (
                    <button
                      key={`thumb-${idx}`}
                      onClick={() => handleSlideChange(idx, true)}
                      className={`hero-thumb text-left p-3 transition-all group relative ${
                        idx === currentHeroSlide ? "active bg-surface/10" : "bg-surface/5 hover:bg-surface/10"
                      }`}
                    >
                      <div
                        className={`absolute bottom-0 left-0 w-full h-[2px] bg-secondary transition-transform origin-left duration-500 ${
                          idx === currentHeroSlide ? "scale-x-100" : "scale-x-0"
                        }`}
                      ></div>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 overflow-hidden bg-surface-container shrink-0">
                          <img src={slide.bgImage} alt={`${slide.weave} Preview`} className="w-full h-full object-cover scale-110" />
                        </div>
                        <div className="overflow-hidden">
                          <div className="text-[8px] uppercase tracking-widest text-surface/40 font-bold mb-0.5">
                            0{idx + 1} / {slide.weave.split(" ")[0].toUpperCase()}
                          </div>
                          <div className="text-[9px] font-black text-surface tracking-wider uppercase truncate">
                            {idx === 0 ? "Black Shirt" : idx === 1 ? "White Shirt" : "Navy Shirt"}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Right Panel: Asymmetric Editorial Canvas */}
              <div className="lg:col-span-5 relative flex justify-center">
                {/* Floating details tag */}
                <div className="absolute top-6 right-6 z-20 bg-surface/10 backdrop-blur-md px-4 py-3 select-none">
                  <div className="text-[8px] uppercase tracking-widest text-surface/60 font-bold">Product Code</div>
                  <div
                    style={{
                      opacity: heroTransitioning ? 0 : 1,
                      transform: heroTransitioning ? "translateY(10px)" : "translateY(0)",
                      transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                    }}
                    className="text-[10px] font-black text-surface tracking-wider uppercase mt-0.5"
                  >
                    {tempSlideData.registryId}
                  </div>
                </div>

                {/* Layered Main Images */}
                <div className="relative overflow-hidden aspect-[3/4] w-full max-w-[400px] shadow-2xl shadow-on-surface/50 border border-surface/5">
                  {heroSlides.map((slide, i) => (
                    <img
                      key={`img-${i}`}
                      src={slide.frontImage}
                      alt={`${slide.weave} detail`}
                      className={`absolute inset-0 w-full h-full object-cover transition-all duration-1000 ease-in-out hover:scale-105 ${
                        i === currentHeroSlide ? "opacity-100 scale-100" : "opacity-0 scale-100"
                      }`}
                    />
                  ))}

                  {/* Elegant overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-on-surface/40 to-transparent pointer-events-none"></div>
                </div>

                {/* Frame border shadow */}
                <div className="absolute -bottom-4 -left-4 w-full h-full bg-gradient-to-br from-secondary/5 to-tertiary/5 -z-10 aspect-[3/4] max-w-[400px]"></div>
              </div>
            </div>
          </div>

          {/* Animated Scroll Down Indicator */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1 select-none pointer-events-none opacity-40 hover:opacity-100 transition-opacity">
            <span className="text-[8px] uppercase tracking-[0.3em] text-surface font-bold">Scroll Details</span>
            <div className="w-[1px] h-8 bg-surface-variant relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1/2 bg-secondary animate-bounce"></div>
            </div>
          </div>
        </section>

        {/* Section 2: Promotional Spotlight */}
        <section className="bg-surface-container-low py-20 px-6 lg:px-20 relative overflow-hidden group">
          <div className="max-w-7xl mx-auto w-full relative min-h-[420px] lg:min-h-[480px] flex items-center justify-center overflow-hidden bg-black border border-white/5 shadow-2xl">
            {/* Background Image with slow zoom-scale */}
            <img
              alt="Elegant dark silk fabric texture"
              className="absolute inset-0 w-full h-full object-cover grayscale brightness-[0.2] group-hover:scale-105 transition-transform duration-[3000ms] ease-out select-none pointer-events-none"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBt_dM_PwNyCwIwT-O1Hdc00MIZ22eGAUgYi9vEfWdoVc132M9C6iGLoFpcH8jO3Ef-tMj5hHNCSqM6luyueIIuCAzB2muFZoy5zrcS6-J6xi7bbBWJq9Vyy44Q5AaYLfV6B6xsYzHw0ZkNcVDrBXiQK17gSFXF9x3nD3Q9pNhJWSjTd_zcb6fo_VxbX_1BNBczo3rMeCVhL6lBg88mr66F5-9-dmZp16Hwth9jmqvFTgyCzd5dvpwfsUpu5d-js0dRPMLDm1UPQmA"
            />
            
            {/* Double-Gold Framed Card */}
            <div className="relative z-10 w-full max-w-2xl mx-6 p-8 lg:p-14 border-4 border-double border-secondary/30 bg-black/60 backdrop-blur-md text-center flex flex-col items-center gap-6 shadow-2xl transition-all duration-500 hover:border-secondary/50">
              {/* Limited offer header */}
              <span className="text-secondary text-[10px] font-black uppercase tracking-[0.4em]">
                Limited Time Offer
              </span>

              {/* Mixed Typography Header */}
              <div className="flex flex-col items-center">
                <span className="font-serif italic text-secondary text-2xl lg:text-4xl tracking-wide lowercase leading-none">
                  our new
                </span>
                <h2 className="text-white font-headline text-3xl lg:text-5xl font-extrabold tracking-[0.25em] uppercase mt-2 leading-none">
                  S E A S O N
                </h2>
              </div>

              {/* Subtitle */}
              <p className="text-gray-400 font-label text-[10px] uppercase tracking-[0.2em] max-w-md leading-relaxed mt-2">
                Elevate your wardrobe with the atelier linen collection. Get 10% off with promo code.
              </p>
              
              {/* Stitched Atelier Tag (Interactive Coupon) */}
              <div className="relative group/tag mt-2">
                {/* Circular thread hole on the left side of the tag */}
                <div className="absolute left-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-black border border-secondary/30 shadow-inner z-10"></div>
                
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
                  className="pl-8 pr-6 py-3 bg-white/5 border border-dashed border-secondary/55 hover:bg-white/10 hover:border-secondary text-white font-mono text-xs font-bold uppercase tracking-widest transition-all duration-300 flex items-center gap-3 cursor-pointer select-all rounded-none"
                  title="Click to copy coupon code tag"
                >
                  <span className="text-[#fed488] font-black">FESTIVE24</span>
                  <span className="material-symbols-outlined text-[13px] text-white/40">content_copy</span>
                </button>
              </div>

              {/* Minimalist Button */}
              <div className="mt-4">
                <Link
                  href="/shopallshirts"
                  className="bg-secondary text-white hover:bg-[#fed488] hover:text-primary px-10 py-3.5 text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 inline-block border-none font-bold"
                >
                  Shop The Collection
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Best Sellers */}
        <section className="py-24 px-6 lg:px-20 bg-surface">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
              <div>
                <p className="text-secondary font-label text-xs uppercase tracking-[0.4em] mb-3">Best Sellers</p>
                <h2 className="text-on-surface font-headline text-4xl lg:text-5xl font-black tracking-tighter">
                  OUR FAVORITE SHIRTS
                </h2>
              </div>
              <Link
                className="text-xs font-bold uppercase tracking-widest border-b border-on-surface pb-1 hover:text-secondary hover:border-secondary transition-all"
                href="/shopallshirts"
              >
                View All Shirts
              </Link>
            </div>

            {/* Auto-scrolling favorite shirts sling */}
            <div
              ref={slingRef}
              onMouseEnter={() => setIsSlingHovered(true)}
              onMouseLeave={() => setIsSlingHovered(false)}
              onTouchStart={() => setIsSlingHovered(true)}
              onTouchEnd={() => setIsSlingHovered(false)}
              className="flex flex-nowrap overflow-x-auto snap-x snap-mandatory gap-4 lg:gap-6 pb-12 sling-container -mx-6 px-6 lg:-mx-0 lg:px-0"
              style={{
                scrollbarWidth: "none",
                msOverflowStyle: "none",
              }}
            >
              {/* Product 1 */}
              <div className="snap-start shrink-0 w-[60vw] sm:w-[40vw] md:w-[30vw] lg:w-[22%] relative group flex flex-col product-card-hover">
                <Link href="/shoppingbag" className="block aspect-[4/5] relative overflow-hidden bg-surface-container-low mb-5">
                  <img
                    alt="Premium Egyptian cotton white formal shirt"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1.2s] cubic-bezier(0.2, 0.8, 0.2, 1) group-hover:scale-108"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuCwdRWxiVyBxsKKcbtQFgAA_GBYnoadMo4hsVcyjNgMYJwjn7Am_m6a2GuaqHX3pQbBkcQp1JaEYpe8jKH6NO6r8j-hckF0bsW2ufyS77McMl_ozgeOwhB4qUMj43rHl7BP72Cr-mtRz7UmVMsBkmPa0Yt1s7L1X409Z0ohFfraRtXxM04RR34LiAsrEkMhtLqftk4U7w8vNwYSJlOyCRN9jpSqtTvfUNZLh2pA3OgHnTpeZo803s3b-VI6rKq7uiy4O59ijyT119Q"
                  />
                  <div className="absolute top-3 left-3 bg-white px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.2em] shadow-sm">
                    Bestseller
                  </div>
                  <button className="absolute bottom-4 right-4 w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center text-on-surface hover:bg-black hover:text-white transition-all quick-add-btn opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0">
                    <span className="material-symbols-outlined text-[18px]">add_shopping_cart</span>
                  </button>
                </Link>
                <div className="flex justify-between items-start gap-4 pr-2">
                  <div>
                    <h3 className="font-headline text-sm font-black uppercase tracking-tight text-on-surface mb-1">
                      Premium White
                    </h3>
                    <p className="text-surface-variant font-label text-[10px] uppercase tracking-widest">Egyptian Cotton</p>
                  </div>
                  <p className="text-secondary font-headline text-sm font-bold">₹4,999</p>
                </div>
              </div>

              {/* Product 2 */}
              <div className="snap-start shrink-0 w-[60vw] sm:w-[40vw] md:w-[30vw] lg:w-[22%] relative group flex flex-col product-card-hover">
                <Link href="/shoppingbag" className="block aspect-[4/5] relative overflow-hidden bg-surface-container-low mb-5">
                  <img
                    alt="Luxury midnight navy linen shirt"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1.2s] cubic-bezier(0.2, 0.8, 0.2, 1) group-hover:scale-108"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuCa0KgfQ4n3rvlg1Re0WvcfC0pKLNlGZct0zsjO9D5gttUwN6wFOelDolj9GX8D7-9ZkH4mCRcPsTfYiL_XAGcPaySk4sC4VmJRKkEeQYfrQZE5_LnEswAqUOMWnn3TklqX6vnBQGPRkCtf_44c84Ck4AyDG98jJNw9hL1ouUJlJxBIvVhL9a-9najaOWkf81cAAy4P0U13OqYy3ewFmtaSSAu3ytgfEr8ayHS17RhXwCKjBYHeGZ37jFtj5hRr3kNF-G9_KRzWraw"
                  />
                  <button className="absolute bottom-4 right-4 w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center text-on-surface hover:bg-black hover:text-white transition-all quick-add-btn opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0">
                    <span className="material-symbols-outlined text-[18px]">add_shopping_cart</span>
                  </button>
                </Link>
                <div className="flex justify-between items-start gap-4 pr-2">
                  <div>
                    <h3 className="font-headline text-sm font-black uppercase tracking-tight text-on-surface mb-1">
                      Navy Linen
                    </h3>
                    <p className="text-surface-variant font-label text-[10px] uppercase tracking-widest">Breathable Weave</p>
                  </div>
                  <p className="text-secondary font-headline text-sm font-bold">₹3,499</p>
                </div>
              </div>

              {/* Product 3 */}
              <div className="snap-start shrink-0 w-[60vw] sm:w-[40vw] md:w-[30vw] lg:w-[22%] relative group flex flex-col product-card-hover">
                <Link href="/shoppingbag" className="block aspect-[4/5] relative overflow-hidden bg-surface-container-low mb-5">
                  <img
                    alt="Earthy saffron silk formal shirt"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1.2s] cubic-bezier(0.2, 0.8, 0.2, 1) group-hover:scale-108"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuCjhduJXRCnpRLc1-oHdDtrtOND6smXt8mK5rxpxWDSr-1_O6De-PRIW4cOAZbqpeA2IX8nk6sDjOEEVBy7oggv8RlFLDqNjuGkXXDPaafz4e1NCqvJsrH5jVlJQR3Hs8gfy6bVgFW9zwAvQ7_xGmrwPKF8_rFCYXqwtuVIgezSqTvUQXF4HEpjlxD9r9LM-kcmZjJYpJ06enGoJhba8wvz9HLRs8tPqPRCOjdz2zN-ECKG99sfqVJQzp7oeEPELV5IFLGD5RSnfb0"
                  />
                  <button className="absolute bottom-4 right-4 w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center text-on-surface hover:bg-black hover:text-white transition-all quick-add-btn opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0">
                    <span className="material-symbols-outlined text-[18px]">add_shopping_cart</span>
                  </button>
                </Link>
                <div className="flex justify-between items-start gap-4 pr-2">
                  <div>
                    <h3 className="font-headline text-sm font-black uppercase tracking-tight text-on-surface mb-1">
                      Saffron Silk
                    </h3>
                    <p className="text-surface-variant font-label text-[10px] uppercase tracking-widest">Festive Blend</p>
                  </div>
                  <p className="text-secondary font-headline text-sm font-bold">₹5,999</p>
                </div>
              </div>

              {/* Product 4 */}
              <div className="snap-start shrink-0 w-[60vw] sm:w-[40vw] md:w-[30vw] lg:w-[22%] relative group flex flex-col product-card-hover">
                <Link href="/shoppingbag" className="block aspect-[4/5] relative overflow-hidden bg-surface-container-low mb-5">
                  <img
                    alt="Charcoal Oxford Cotton Shirt"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1.2s] cubic-bezier(0.2, 0.8, 0.2, 1) group-hover:scale-108"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuAYR7Qf-bSfveC_J94IAFp_Ecz6A7SOFKAPKzjjiJVGh82SLmMPgrYTsl_c5W_Jjkn35ocGrTNDJLYuSRqm3AvOrDWUE5rPrUbMuAQ1MzPHveY3mOhSO8HmWgITP5gplbNje2Tn05eHLEpTU98Eu1nO581HVApaYfZmd27and9xaF44qb3eoo0NN6M_VTePsIZm7IkSLFeCDvoTdCCzAMsjwuTdXyb71Czon4BeC42zWlG407yLenkFI6mzVJPF3cEKm0ABsKqJQ8M"
                  />
                  <button className="absolute bottom-4 right-4 w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center text-on-surface hover:bg-black hover:text-white transition-all quick-add-btn opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0">
                    <span className="material-symbols-outlined text-[18px]">add_shopping_cart</span>
                  </button>
                </Link>
                <div className="flex justify-between items-start gap-4 pr-2">
                  <div>
                    <h3 className="font-headline text-sm font-black uppercase tracking-tight text-on-surface mb-1">
                      Charcoal Oxford
                    </h3>
                    <p className="text-surface-variant font-label text-[10px] uppercase tracking-widest">Smart casual</p>
                  </div>
                  <p className="text-secondary font-headline text-sm font-bold">₹3,999</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 4: Category Showcase */}
        <section className="py-24 px-6 lg:px-20 bg-on-surface">
          <div className="max-w-7xl mx-auto">
            <div className="mb-12">
              <p className="text-secondary font-label text-xs uppercase tracking-[0.4em] mb-3">Explore Categories</p>
              <h2 className="text-surface font-headline text-3xl lg:text-4xl font-black tracking-tighter">
                OUR SHIRT STYLES
              </h2>
            </div>

            <div className="flex flex-col lg:flex-row gap-2 min-h-[100svh] lg:min-h-[600px] h-auto w-full">
              {/* Casual Shirts */}
              <Link
                href="/shopallshirts"
                className="group relative overflow-hidden flex-1 lg:hover:flex-[2.5] transition-all duration-[800ms] ease-[cubic-bezier(0.25,1,0.5,1)] flex flex-col justify-end p-8 lg:p-12 cursor-pointer bg-surface-container-lowest"
              >
                <img
                  alt="Man wearing a relaxed linen shirt"
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-[2s]"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuCVQQvaUkwRXjjqhKuMU_pyS28T6zwu2ybrqELpyl3ghzcvbtgaVVSTQaL1l0yCvk-g-wHSqIXfOm-3S2LE57yZIBT1sqv8x60YhPv8XOfU3TKLo7Tto7YV0pwQn22CmZc5PeuWD8g84DYC_XRfjsj-X6CyBiQ7jx718ICGdaW_vYq_pqmKEjJ6R7AJ7dcC-gmOyy_Gm9WyniwEb7NnYVQVB91xeNRkKf3b79hCMt1dpwJoS2S5BYwXvlp8E32k1rvXCbNhUza8vLA"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent opacity-70 group-hover:opacity-90 transition-opacity duration-700"></div>
                <div className="relative z-10 w-full">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-secondary font-label text-[10px] tracking-[0.3em] font-black uppercase">
                      01 / Styles
                    </span>
                    <div className="h-[1px] bg-secondary flex-1 max-w-[40px] opacity-0 group-hover:opacity-100 transition-opacity duration-700 delay-200"></div>
                  </div>
                  <h3 className="text-white font-headline text-3xl lg:text-4xl font-black mb-0 whitespace-nowrap transform translate-y-2 group-hover:translate-y-0 transition-transform duration-700">
                    CASUAL SHIRTS
                  </h3>
                  <div className="grid grid-rows-[0fr] lg:group-hover:grid-rows-[1fr] transition-[grid-template-rows] duration-[800ms] ease-[cubic-bezier(0.25,1,0.5,1)]">
                    <div className="overflow-hidden">
                      <p className="text-white/80 text-sm pt-4 whitespace-normal min-w-[250px] opacity-0 group-hover:opacity-100 transition-opacity duration-700 delay-300">
                        Comfortable and stylish shirts designed for your relaxed weekends and off-duty elegance.
                      </p>
                    </div>
                  </div>
                </div>
              </Link>

              {/* Formal Shirts */}
              <Link
                href="/shopallshirts"
                className="group relative overflow-hidden flex-1 lg:hover:flex-[2.5] transition-all duration-[800ms] ease-[cubic-bezier(0.25,1,0.5,1)] flex flex-col justify-end p-8 lg:p-12 cursor-pointer bg-surface-container-lowest"
              >
                <img
                  alt="Crisp white luxury formal shirt details"
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-[2s]"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuDOKWKyR0ZDQd-3JB62byc_gJu1nFHoSuWGZ8WJq5ZgrX_otOWTAzmaY0ZS3STh4AoN4-_uIdZ4UHh0jRNTQdPMv7c8zMc8G-5pj4fT1XLHKTVnLFjrGtr8uRTc0bCaQazTIBUriEvSNZVG_FmcrpcQivX-yYGZCnjk862z65HR3oao4YaCCndnQTWsmzaQq4q_PlbTVifN4NcRGlwoTixiAfXe7yR2uWOVUg8PmCz0BEw2gHllfHVMnXfoVGRSd7jKAkJL9RNO6gc"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent opacity-70 group-hover:opacity-90 transition-opacity duration-700"></div>
                <div className="relative z-10 w-full">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-secondary font-label text-[10px] tracking-[0.3em] font-black uppercase">
                      02 / Styles
                    </span>
                    <div className="h-[1px] bg-secondary flex-1 max-w-[40px] opacity-0 group-hover:opacity-100 transition-opacity duration-700 delay-200"></div>
                  </div>
                  <h3 className="text-white font-headline text-3xl lg:text-4xl font-black mb-0 whitespace-nowrap transform translate-y-2 group-hover:translate-y-0 transition-transform duration-700">
                    FORMAL SHIRTS
                  </h3>
                  <div className="grid grid-rows-[0fr] lg:group-hover:grid-rows-[1fr] transition-[grid-template-rows] duration-[800ms] ease-[cubic-bezier(0.25,1,0.5,1)]">
                    <div className="overflow-hidden">
                      <p className="text-white/80 text-sm pt-4 whitespace-normal min-w-[250px] opacity-0 group-hover:opacity-100 transition-opacity duration-700 delay-300">
                        Sharp, immaculate tailoring built for the boardroom and your most important formal events.
                      </p>
                    </div>
                  </div>
                </div>
              </Link>

              {/* Linen Shirts */}
              <Link
                href="/shopallshirts"
                className="group relative overflow-hidden flex-1 lg:hover:flex-[2.5] transition-all duration-[800ms] ease-[cubic-bezier(0.25,1,0.5,1)] flex flex-col justify-end p-8 lg:p-12 cursor-pointer bg-surface-container-lowest"
              >
                <img
                  alt="Soft textured linen shirts"
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-[2s]"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuDBozZZR8AKDktOII20_q4LdZj5SAYtPw8IwtypMH2NFWvqGOmY7257NPPPuJfdhg4SJH9y6AROY_SrR4UCz-wAynEeQaqKxxNmPo3n_vm2LAVnSI8b5KcsAneKzKfUckb-AmmGdRbwjTx3oE51xUdijhO5JGY9C1QsYO4zmDkmKtUN5qvoVVz7W4_mGn5QMx4GB4pcN-SZNfyRty4SyJeoqnyx5Jp2x2hzt0BLB-dO5RKcPZi4rDKFxQ1B_tbkrse6NHIqbI6ZN_A"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent opacity-70 group-hover:opacity-90 transition-opacity duration-700"></div>
                <div className="relative z-10 w-full">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-secondary font-label text-[10px] tracking-[0.3em] font-black uppercase">
                      03 / Styles
                    </span>
                    <div className="h-[1px] bg-secondary flex-1 max-w-[40px] opacity-0 group-hover:opacity-100 transition-opacity duration-700 delay-200"></div>
                  </div>
                  <h3 className="text-white font-headline text-3xl lg:text-4xl font-black mb-0 whitespace-nowrap transform translate-y-2 group-hover:translate-y-0 transition-transform duration-700">
                    LINEN SHIRTS
                  </h3>
                  <div className="grid grid-rows-[0fr] lg:group-hover:grid-rows-[1fr] transition-[grid-template-rows] duration-[800ms] ease-[cubic-bezier(0.25,1,0.5,1)]">
                    <div className="overflow-hidden">
                      <p className="text-white/80 text-sm pt-4 whitespace-normal min-w-[250px] opacity-0 group-hover:opacity-100 transition-opacity duration-700 delay-300">
                        Incredibly light and breathable woven linen garments tailored for warm weather comfort.
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </section>

        {/* Section 5: Connected Trust Section */}
        <section className="py-24 px-6 lg:px-20 bg-[#F5F5F5] overflow-hidden">
          <div className="max-w-7xl mx-auto relative">
            {/* Connecting Background Line */}
            <div className="hidden md:block absolute top-[40px] left-[16.66%] right-[16.66%] h-[1px] bg-outline/20 z-0"></div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-16 md:gap-0 text-center relative z-10">
              {/* Point 1 */}
              <div className="flex flex-col items-center gap-6 group/item relative cursor-default">
                {/* Glowing Connecting Line */}
                <div className="hidden md:block absolute top-[39px] left-1/2 w-0 h-[2px] bg-secondary shadow-[0_0_12px_rgba(212,175,55,0.8)] z-0 transition-all duration-700 ease-in-out group-hover/item:w-full"></div>
                <div className="w-20 h-20 bg-[#F5F5F5] flex items-center justify-center relative z-10 transition-transform duration-500 group-hover/item:-translate-y-2">
                  <span
                    className="material-symbols-outlined text-[40px] text-secondary drop-shadow-sm transition-all duration-500 group-hover/item:drop-shadow-[0_0_8px_rgba(212,175,55,0.6)]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    precision_manufacturing
                  </span>
                </div>
                <div className="relative z-10 px-4">
                  <h4 className="font-headline font-bold uppercase tracking-widest text-sm text-on-surface mb-3">
                    Direct from Atelier
                  </h4>
                  <p className="text-surface-variant text-xs leading-relaxed max-w-xs mx-auto">
                    Master tailors overseeing every stitch, from proprietary weave to final hand-finished seam.
                  </p>
                </div>
              </div>

              {/* Point 2 */}
              <div className="flex flex-col items-center gap-6 group/item relative cursor-default">
                {/* Glowing Connecting Line */}
                <div className="hidden md:block absolute top-[39px] left-1/2 w-0 h-[2px] bg-secondary shadow-[0_0_12px_rgba(212,175,55,0.8)] z-0 transition-all duration-700 ease-in-out group-hover/item:w-full"></div>
                <div className="w-20 h-20 bg-[#F5F5F5] flex items-center justify-center relative z-10 transition-transform duration-500 group-hover/item:-translate-y-2">
                  <span
                    className="material-symbols-outlined text-[40px] text-secondary drop-shadow-sm transition-all duration-500 group-hover/item:drop-shadow-[0_0_8px_rgba(212,175,55,0.6)]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    diamond
                  </span>
                </div>
                <div className="relative z-10 px-4">
                  <h4 className="font-headline font-bold uppercase tracking-widest text-sm text-on-surface mb-3">
                    Premium Fabric
                  </h4>
                  <p className="text-surface-variant text-xs leading-relaxed max-w-xs mx-auto">
                    We source only the finest long-staple cotton and Belgian flax for unmatched comfort.
                  </p>
                </div>
              </div>

              {/* Point 3 */}
              <div className="flex flex-col items-center gap-6 group/item relative cursor-default">
                <div className="w-20 h-20 bg-[#F5F5F5] flex items-center justify-center relative z-10 transition-transform duration-500 group-hover/item:-translate-y-2">
                  <span
                    className="material-symbols-outlined text-[40px] text-secondary drop-shadow-sm transition-all duration-500 group-hover/item:drop-shadow-[0_0_8px_rgba(212,175,55,0.6)]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    local_shipping
                  </span>
                </div>
                <div className="relative z-10 px-4">
                  <h4 className="font-headline font-bold uppercase tracking-widest text-sm text-on-surface mb-3">
                    Fast Delivery
                  </h4>
                  <p className="text-surface-variant text-xs leading-relaxed max-w-xs mx-auto">
                    Concierge delivery service across 200+ Indian cities in 2-4 business days.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 6: Social Proof (Global Reach) */}
        <section className="py-24 px-6 lg:px-20 bg-surface relative overflow-hidden">
          {/* Subtle Global Map Background */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none flex justify-center items-center overflow-hidden">
            <span
              className="material-symbols-outlined text-[800px] text-on-surface"
              style={{ fontVariationSettings: "'FILL' 0" }}
            >
              public
            </span>
          </div>

          <div className="max-w-7xl mx-auto relative z-10">
            <div className="text-center mb-16">
              <p className="text-secondary font-label text-[10px] uppercase tracking-[0.4em] mb-4">
                Born in Tamil Nadu. Worn Worldwide.
              </p>
              <h2 className="font-headline text-3xl md:text-5xl font-black tracking-tight mb-4 text-on-surface uppercase">
                FROM OUR LOOMS
                <br />
                TO THE WORLD.
              </h2>
              <p className="text-surface-variant max-w-xl mx-auto text-sm leading-relaxed mb-10">
                We handcraft every premium shirt in our Tamil Nadu workshop, shipping absolute luxury to discerning
                gentlemen across India and across the globe.
              </p>

              {/* Trust Badges */}
              <div className="flex justify-center items-center gap-6 flex-wrap">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-outline">
                  <span className="material-symbols-outlined text-secondary text-xl">flight_takeoff</span>
                  <span>International Shipping</span>
                </div>
                <div className="hidden md:block w-1 h-1 bg-outline/30 rounded-full"></div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-outline">
                  <span className="material-symbols-outlined text-secondary text-xl">verified</span>
                  <span>10k+ Happy Customers</span>
                </div>
              </div>
            </div>

            {/* Review Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Review 1 */}
              <div className="bg-surface-container-lowest border border-outline/10 p-8 lg:p-10 hover:border-secondary/30 hover:shadow-xl transition-all duration-500 group">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex gap-1 text-secondary">
                    <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                    <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                    <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                    <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                    <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                  </div>
                  <span className="material-symbols-outlined text-outline/20 text-4xl group-hover:text-secondary/20 transition-colors">
                    format_quote
                  </span>
                </div>
                <p className="font-body text-sm italic leading-relaxed mb-8 text-on-surface">
                  &ldquo;The craftsmanship is unparalleled. You can literally feel the quality of the South Indian textile
                  heritage in the weave. Delivered to Bangalore in just 2 days.&rdquo;
                </p>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-on-surface font-bold text-xs">
                    AV
                  </div>
                  <div>
                    <p className="font-headline font-bold text-xs uppercase tracking-wider text-on-surface">Aditya Verma</p>
                    <p className="text-outline text-[10px] uppercase tracking-widest">Bengaluru, India</p>
                  </div>
                </div>
              </div>

              {/* Review 2 */}
              <div className="bg-surface-container-lowest border border-outline/10 p-8 lg:p-10 hover:border-secondary/30 hover:shadow-xl transition-all duration-500 group">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex gap-1 text-secondary">
                    <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                    <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                    <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                    <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                    <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                  </div>
                  <span className="material-symbols-outlined text-outline/20 text-4xl group-hover:text-secondary/20 transition-colors">
                    format_quote
                  </span>
                </div>
                <p className="font-body text-sm italic leading-relaxed mb-8 text-on-surface">
                  &ldquo;I ordered 3 formal shirts to Dubai. They arrived beautifully packaged. The fit is immaculate,
                  easily competing with Savile Row tailors but at a much fairer price.&rdquo;
                </p>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-on-surface font-bold text-xs">
                    FA
                  </div>
                  <div>
                    <p className="font-headline font-bold text-xs uppercase tracking-wider text-on-surface">
                      Faisal Al-Rashid
                    </p>
                    <p className="text-outline text-[10px] uppercase tracking-widest">Dubai, UAE</p>
                  </div>
                </div>
              </div>

              {/* Review 3 */}
              <div className="bg-surface-container-lowest border border-outline/10 p-8 lg:p-10 hover:border-secondary/30 hover:shadow-xl transition-all duration-500 group">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex gap-1 text-secondary">
                    <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                    <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                    <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                    <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                    <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                  </div>
                  <span className="material-symbols-outlined text-outline/20 text-4xl group-hover:text-secondary/20 transition-colors">
                    format_quote
                  </span>
                </div>
                <p className="font-body text-sm italic leading-relaxed mb-8 text-on-surface">
                  &ldquo;Found this brand on Instagram. The pure linen shirts are a lifesaver for the Florida heat. Shipping to
                  the US was surprisingly fast and hassle-free.&rdquo;
                </p>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-on-surface font-bold text-xs">
                    MT
                  </div>
                  <div>
                    <p className="font-headline font-bold text-xs uppercase tracking-wider text-on-surface">Michael Turner</p>
                    <p className="text-outline text-[10px] uppercase tracking-widest">Miami, USA</p>
                  </div>
                </div>
              </div>
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
                  <svg fill="currentColor" viewBox="0 0 48 48" className="w-full h-full">
                    <path d="M13.8261 30.5736C16.7203 29.8826 20.2244 29.4783 24 29.4783C27.7756 29.4783 31.2797 29.8826 34.1739 30.5736C36.9144 31.2278 39.9967 32.7669 41.3563 33.8352L24.8486 7.36089C24.4571 6.73303 23.5429 6.73303 23.1514 7.36089L6.64374 33.8352C8.00331 32.7669 11.0856 31.2278 13.8261 30.5736Z" />
                  </svg>
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
                  className="bg-transparent border-none outline-none w-full text-[10px] uppercase tracking-widest text-white placeholder-white/30 px-2"
                />
                <button
                  type="submit"
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
