"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Product } from "@/lib/registry";
import { db } from "@/lib/db";

// Helper function to compress images using HTML5 canvas to prevent LocalStorage quota overflow
const compressImage = (base64Str: string, maxWidth = 800, maxHeight = 800, quality = 0.7): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL("image/jpeg", quality);
        resolve(compressedBase64);
      } else {
        resolve(base64Str);
      }
    };
    img.onerror = () => {
      resolve(base64Str);
    };
  });
};

function AddProductContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editProductId = searchParams.get("edit");

  // Form Fields State
  const [title, setTitle] = useState("");
  const [sku, setSku] = useState("");
  const [category, setCategory] = useState("Cotton");
  const [description, setDescription] = useState("");
  const [categories, setCategories] = useState<string[]>(["Cotton", "Linen", "Denim", "Silk Blend", "Silk"]);
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategory, setCustomCategory] = useState("");

  // Stock Size Allocation
  const [stockS, setStockS] = useState(0);
  const [stockM, setStockM] = useState(0);
  const [stockL, setStockL] = useState(0);
  const [stockXL, setStockXL] = useState(0);
  const [stockXXL, setStockXXL] = useState(0);

  // Artisan Specs
  const [specFabric, setSpecFabric] = useState("");
  const [specFit, setSpecFit] = useState("");
  const [specCollar, setSpecCollar] = useState("");
  const [specSleeve, setSpecSleeve] = useState("");
  const [specCare, setSpecCare] = useState("");

  // Badges
  const [badgeNew, setBadgeNew] = useState(true);
  const [badgeExclusive, setBadgeExclusive] = useState(false);
  const [enableCustomBadge, setEnableCustomBadge] = useState(false);
  const [customBadgeText, setCustomBadgeText] = useState("");

  // Pricing & Commercial
  const [basePrice, setBasePrice] = useState(0);
  const [gstRate, setGstRate] = useState(12);
  const [discountRate, setDiscountRate] = useState(0);

  // Image Manager Mode: 'upload' | 'urls'
  const [imageMode, setImageMode] = useState<"upload" | "urls">("upload");
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [imgUrl1, setImgUrl1] = useState("");
  const [imgUrl2, setImgUrl2] = useState("");
  const [imgUrl3, setImgUrl3] = useState("");
  const [imgUrl4, setImgUrl4] = useState("");
  const [primaryImageIndex, setPrimaryImageIndex] = useState(0);

  // Success Modal State
  const [successModalText, setSuccessModalText] = useState("");

  // Toast notifications
  const [toastText, setToastText] = useState("");
  const [showToast, setShowToast] = useState(false);

  const triggerToast = (msg: string) => {
    setToastText(msg);
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 3000);
  };

  // Detect Edit Mode & Pre-populate
  useEffect(() => {
    const loadProductData = async () => {
      // 1. Fetch unique categories from current inventory
      const items = await db.getProducts();
      const uniqueCats = Array.from(new Set(items.map((p) => p.category).filter(Boolean)));
      const seedCats = ["Cotton", "Linen", "Denim", "Silk Blend", "Silk"];
      const combinedCats = Array.from(new Set([...seedCats, ...uniqueCats]));
      setCategories(combinedCats);

      if (editProductId) {
        const p = items.find((prod) => prod.id === editProductId);

        if (p) {
          setTitle(p.title || "");
          setSku(p.id || "");
          
          // Pre-populate category
          if (combinedCats.includes(p.category || "Cotton")) {
            setCategory(p.category || "Cotton");
            setIsCustomCategory(false);
          } else {
            setCategory("Cotton");
            setIsCustomCategory(true);
            setCustomCategory(p.category || "");
          }
          
          setDescription(p.description || "");

          // Stock Matrix
          const sizeStock = p.sizeStock || {};
          setStockS(sizeStock.S || 0);
          setStockM(sizeStock.M || 0);
          setStockL(sizeStock.L || 0);
          setStockXL(sizeStock.XL || 0);
          setStockXXL(sizeStock.XXL || 0);

          // Specs
          setSpecFabric(p.specFabric || "");
          setSpecFit(p.specFit || "");
          setSpecCollar(p.specCollar || "");
          setSpecSleeve(p.specSleeve || "");
          setSpecCare(p.specCare || "");

          // Highlights & Badging
          setBadgeNew(p.isNew !== undefined ? !!p.isNew : true);
          setBadgeExclusive(!!p.isAtelierExclusive);
          if (p.customBadge) {
            setEnableCustomBadge(true);
            setCustomBadgeText(p.customBadge);
          } else {
            setEnableCustomBadge(false);
            setCustomBadgeText("");
          }

          // Pricing
          setBasePrice(p.basePrice || p.price || 0);
          setGstRate(p.gstRate || 12);
          setDiscountRate(p.discountRate || 0);

          // Images
          const imgList = p.images || (p.image ? [p.image] : []);
          const hasUrlLinks = imgList.some(
            (img) => img && (img.startsWith("http") || img.startsWith("//") || img.startsWith("data:") === false)
          );

          if (hasUrlLinks) {
            setImageMode("urls");
            if (imgList[0]) setImgUrl1(imgList[0]);
            if (imgList[1]) setImgUrl2(imgList[1]);
            if (imgList[2]) setImgUrl3(imgList[2]);
            if (imgList[3]) setImgUrl4(imgList[3]);
            
            const coverImage = p.image || imgList[0];
            const foundIndex = imgList.indexOf(coverImage);
            setPrimaryImageIndex(foundIndex !== -1 ? foundIndex : 0);
          } else {
            setImageMode("upload");
            setSelectedImages(imgList);
            
            const coverImage = p.image || imgList[0];
            const foundIndex = imgList.indexOf(coverImage);
            setPrimaryImageIndex(foundIndex !== -1 ? foundIndex : 0);
          }
        }
      }
    };
    loadProductData();
  }, [editProductId]);

  // Aggregate values
  const totalStock = stockS + stockM + stockL + stockXL + stockXXL;

  const calculateFinalPrice = () => {
    const gstPercent = gstRate / 100;
    const discPercent = discountRate / 100;
    const priceWithGst = basePrice * (1 + gstPercent);
    const discountAmount = basePrice * discPercent;
    return Math.max(0, priceWithGst - discountAmount);
  };

  const finalPrice = calculateFinalPrice();

  // Handle local image file load with inline compression
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const slotsAvailable = 4 - selectedImages.length;
    if (slotsAvailable <= 0) return;

    const filesToUpload = Array.from(files).slice(0, slotsAvailable);
    const newCompressedImages: string[] = [];

    for (const file of filesToUpload) {
      try {
        const rawBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => {
            if (event.target?.result) resolve(event.target.result as string);
            else reject(new Error("Failed to read file"));
          };
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(file);
        });

        const compressed = await compressImage(rawBase64);
        newCompressedImages.push(compressed);
      } catch (err) {
        console.error("Error reading/compressing image:", err);
      }
    }

    if (newCompressedImages.length > 0) {
      setSelectedImages((prev) => [...prev, ...newCompressedImages]);
    }
  };

  const removeLocalImage = (index: number) => {
    const updated = [...selectedImages];
    updated.splice(index, 1);
    setSelectedImages(updated);
  };

  // Submit and Save
  const handleSaveProduct = async () => {
    if (!title.trim()) {
      triggerToast("Please enter a product title");
      return;
    }
    const finalSKU = sku.trim() || "SKU-" + Math.floor(Math.random() * 9000 + 1000);
    const finalCategory = isCustomCategory ? customCategory.trim() : category;
    if (!finalCategory.trim()) {
      triggerToast("Please select or enter a category name");
      return;
    }

    // Collect images
    let productImages: string[] = [];
    if (imageMode === "urls") {
      if (imgUrl1.trim()) productImages.push(imgUrl1.trim());
      if (imgUrl2.trim()) productImages.push(imgUrl2.trim());
      if (imgUrl3.trim()) productImages.push(imgUrl3.trim());
      if (imgUrl4.trim()) productImages.push(imgUrl4.trim());
    } else {
      productImages = selectedImages;
    }

    if (productImages.length === 0) {
      productImages = [
        "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&q=80&w=600",
      ];
    }

    // Set primary image first in the list
    let primaryImage = productImages[0];
    if (primaryImageIndex > 0 && primaryImageIndex < productImages.length) {
      const primary = productImages[primaryImageIndex];
      const others = productImages.filter((_, i) => i !== primaryImageIndex);
      productImages = [primary, ...others];
      primaryImage = primary;
    }

    const payload: Product = {
      id: finalSKU,
      title: title.trim(),
      category: finalCategory,
      price: finalPrice,
      basePrice: basePrice,
      gstRate: gstRate,
      discountRate: discountRate,
      stock: totalStock,
      description: description.trim() || `${title} in premium ${finalCategory} weave.`,
      image: primaryImage,
      images: productImages,
      isNew: badgeNew,
      isAtelierExclusive: badgeExclusive,
      customBadge: enableCustomBadge ? customBadgeText.trim() : "",
      sizeStock: {
        S: stockS,
        M: stockM,
        L: stockL,
        XL: stockXL,
        XXL: stockXXL,
      },
      specFabric: specFabric.trim() || `Premium ${finalCategory}`,
      specFit: specFit.trim() || "Relaxed Fit",
      specCollar: specCollar.trim() || "Spread Collar",
      specSleeve: specSleeve.trim() || "Full Sleeves",
      specCare: specCare.trim() || "Dry clean only.",
    };

    try {
      if (editProductId) {
        // Edit Mode
        await db.saveProduct(payload);
        setSuccessModalText("Product updated successfully!");
      } else {
        // Add Mode
        const list = await db.getProducts();
        const exists = list.some((prod) => prod.id === finalSKU);
        if (exists) {
          triggerToast("SKU already exists. Please choose a unique SKU reference.");
          return;
        }
        await db.saveProduct(payload);
        setSuccessModalText("Product created successfully!");
      }
    } catch (e: any) {
      console.error(e);
      if (e?.name === "QuotaExceededError" || e?.message?.includes("exceeded the quota") || e?.message?.includes("QuotaExceededError")) {
        triggerToast("Storage full! Please use direct Image URLs or compress your local photos under 500KB.");
      } else {
        triggerToast("Failed to save product details");
      }
    }
  };

  return (
    <div className="p-8 lg:p-16">
      {/* Header bar actions */}
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8 mb-16">
        <div>
          <nav className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">
            <span>Admin Portal</span>
            <span className="material-symbols-outlined text-sm opacity-30">chevron_right</span>
            <span className="text-[#0a0a0a] italic">{editProductId ? "Edit Product" : "Add New Product"}</span>
          </nav>
          <h2 className="text-5xl font-headline font-black tracking-tighter text-[#0a0a0a] uppercase leading-none">
            {editProductId ? "Edit Product" : "Add Product"}
          </h2>
          <p className="text-xs text-gray-500 mt-4 font-bold uppercase tracking-widest italic opacity-70">
            {editProductId
              ? "Modify existing entry details in your shop inventory."
              : "Create a new shirt entry details in your shop inventory."}
          </p>
        </div>
        <div className="flex gap-4 w-full lg:w-auto font-bold">
          <button
            type="button"
            onClick={() => router.push("/admindashboard/inventory")}
            className="flex-1 lg:flex-none px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 hover:text-red-600 transition-colors bg-white border border-gray-200 whitespace-nowrap rounded-none cursor-pointer"
          >
            Discard
          </button>
          <button
            onClick={handleSaveProduct}
            type="button"
            className="flex-1 lg:flex-none bg-primary text-white px-10 py-4 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-secondary transition-all shadow-lg rounded-none cursor-pointer border-none font-bold"
          >
            {editProductId ? "Update Product" : "Save Product"}
          </button>
        </div>
      </header>

      <div className="max-w-5xl">
        <form onSubmit={(e) => e.preventDefault()} className="space-y-16">
          {/* Section 01: Core Registry */}
          <div className="border-b border-gray-100 pb-12 grid grid-cols-1 lg:grid-cols-12 gap-12">
            <div className="lg:col-span-4">
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-[#775a19] mb-4 block">
                Section 01
              </span>
              <h3 className="font-headline font-black text-xl uppercase tracking-widest text-primary">Core Details</h3>
              <p className="text-xs text-gray-500 mt-4 leading-relaxed font-semibold uppercase tracking-wider italic opacity-85">
                Basic product information and categorization.
              </p>
            </div>
            <div className="lg:col-span-8 space-y-8">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-[#0a0a0a] mb-3">
                  Product Name
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Signature Cotton Shirt"
                  className="w-full bg-white border border-gray-200 p-4 text-sm font-semibold outline-none focus:border-primary rounded-none"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-[#0a0a0a] mb-3">
                    Product SKU (Unique ID)
                  </label>
                  <input
                    type="text"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    disabled={!!editProductId}
                    placeholder="e.g. SHIRT-001"
                    className={`w-full bg-white border border-gray-200 p-4 text-sm font-semibold uppercase tracking-widest outline-none focus:border-primary rounded-none ${
                      editProductId ? "bg-gray-100 cursor-not-allowed opacity-60" : ""
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-[#0a0a0a] mb-3">
                    Product Category
                  </label>
                  {!isCustomCategory ? (
                    <select
                      value={category}
                      onChange={(e) => {
                        if (e.target.value === "NEW_CUSTOM") {
                          setIsCustomCategory(true);
                          setCustomCategory("");
                        } else {
                          setCategory(e.target.value);
                        }
                      }}
                      className="w-full bg-white border border-gray-200 p-4 text-xs font-black uppercase tracking-widest outline-none focus:border-primary rounded-none cursor-pointer"
                    >
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                      <option value="NEW_CUSTOM">+ Add Custom Category...</option>
                    </select>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={customCategory}
                          onChange={(e) => setCustomCategory(e.target.value)}
                          placeholder="Enter new category name"
                          className="flex-1 bg-white border border-gray-200 p-4 text-xs font-black uppercase tracking-widest outline-none focus:border-primary rounded-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setIsCustomCategory(false);
                            if (categories.length > 0) {
                              setCategory(categories[0]);
                            }
                          }}
                          className="px-4 py-2 border border-gray-200 text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 transition-colors rounded-none cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                      <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest italic">
                        Creating a custom category. Click cancel to select an existing one.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Size Allocation Matrix */}
              <div className="bg-[#fafafa] p-6 border border-gray-200 space-y-4">
                <label className="block text-[9px] font-black uppercase tracking-widest text-gray-500">
                  Size-Wise Stock Levels
                </label>
                <div className="grid grid-cols-5 gap-4">
                  {(["S", "M", "L", "XL", "XXL"] as const).map((size) => {
                    const val =
                      size === "S"
                        ? stockS
                        : size === "M"
                        ? stockM
                        : size === "L"
                        ? stockL
                        : size === "XL"
                        ? stockXL
                        : stockXXL;
                    const setter =
                      size === "S"
                        ? setStockS
                        : size === "M"
                        ? setStockM
                        : size === "L"
                        ? setStockL
                        : size === "XL"
                        ? setStockXL
                        : setStockXXL;

                    return (
                      <div key={size}>
                        <label className="text-[9px] font-black text-center text-gray-400 block mb-1.5">{size}</label>
                        <input
                          type="number"
                          placeholder="0"
                          min="0"
                          value={val || ""}
                          onChange={(e) => setter(Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-full text-center font-bold p-2 text-xs border border-gray-200 outline-none rounded-none focus:border-primary bg-white"
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="pt-4 border-t border-dashed border-gray-200 flex justify-between items-center">
                  <label className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-500">
                    Total Aggregate Stock
                  </label>
                  <input
                    type="number"
                    readOnly
                    value={totalStock}
                    className="w-24 text-center font-black bg-gray-100 border border-gray-200 p-2 text-xs outline-none rounded-none cursor-not-allowed select-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-[#0a0a0a] mb-3">
                  Narrative Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder="Describe the heritage weave structure, artisan fabric fit, and styling specs..."
                  className="w-full bg-white border border-gray-200 p-4 text-sm font-semibold outline-none focus:border-primary rounded-none"
                />
              </div>
            </div>
          </div>

          {/* Section 02: Artisan Specifications */}
          <div className="border-b border-gray-100 pb-12 grid grid-cols-1 lg:grid-cols-12 gap-12">
            <div className="lg:col-span-4">
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-[#775a19] mb-4 block">
                Section 02
              </span>
              <h3 className="font-headline font-black text-xl uppercase tracking-widest text-primary">Atelier Specs</h3>
              <p className="text-xs text-gray-500 mt-4 leading-relaxed font-semibold uppercase tracking-wider italic opacity-85">
                Configure technical thread profiles, collars, and fit specs.
              </p>
            </div>
            <div className="lg:col-span-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-[#0a0a0a] mb-3">
                    Composition / Material
                  </label>
                  <input
                    type="text"
                    value={specFabric}
                    onChange={(e) => setSpecFabric(e.target.value)}
                    placeholder="e.g. 100% Giza Cotton Handloom"
                    className="w-full bg-white border border-gray-200 p-4 text-sm font-semibold outline-none focus:border-primary rounded-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-[#0a0a0a] mb-3">
                    Atelier Fit Profile
                  </label>
                  <input
                    type="text"
                    value={specFit}
                    onChange={(e) => setSpecFit(e.target.value)}
                    placeholder="e.g. Modern Tailored Fit"
                    className="w-full bg-white border border-gray-200 p-4 text-sm font-semibold outline-none focus:border-primary rounded-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-[#0a0a0a] mb-3">
                    Collar Design
                  </label>
                  <input
                    type="text"
                    value={specCollar}
                    onChange={(e) => setSpecCollar(e.target.value)}
                    placeholder="e.g. Cutaway French Collar"
                    className="w-full bg-white border border-gray-200 p-4 text-sm font-semibold outline-none focus:border-primary rounded-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-[#0a0a0a] mb-3">
                    Sleeves & Buttons
                  </label>
                  <input
                    type="text"
                    value={specSleeve}
                    onChange={(e) => setSpecSleeve(e.target.value)}
                    placeholder="e.g. MOP Buttons, Mitred Cuffs"
                    className="w-full bg-white border border-gray-200 p-4 text-sm font-semibold outline-none focus:border-primary rounded-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-[#0a0a0a] mb-3">
                  Atelier Care Guide
                </label>
                <textarea
                  value={specCare}
                  onChange={(e) => setSpecCare(e.target.value)}
                  rows={3}
                  placeholder="e.g. Dry clean to maintain natural weave and fabric integrity."
                  className="w-full bg-white border border-gray-200 p-4 text-sm font-semibold outline-none focus:border-primary rounded-none"
                />
              </div>
            </div>
          </div>

          {/* Section 03: Urgency Badges */}
          <div className="border-b border-gray-100 pb-12 grid grid-cols-1 lg:grid-cols-12 gap-12">
            <div className="lg:col-span-4">
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-[#775a19] mb-4 block">
                Section 03
              </span>
              <h3 className="font-headline font-black text-xl uppercase tracking-widest text-primary">Badging</h3>
              <p className="text-xs text-gray-500 mt-4 leading-relaxed font-semibold uppercase tracking-wider italic opacity-85">
                Toggle catalog urgency indicators or limited edition tags.
              </p>
            </div>
            <div className="lg:col-span-8 space-y-6">
              <div className="bg-[#fafafa] p-8 border border-gray-200 space-y-6">
                <div className="flex items-start gap-4">
                  <input
                    type="checkbox"
                    id="badgeNew"
                    checked={badgeNew}
                    onChange={(e) => setBadgeNew(e.target.checked)}
                    className="w-5 h-5 text-primary border-gray-300 focus:ring-0 rounded-none cursor-pointer mt-1"
                  />
                  <div>
                    <label htmlFor="badgeNew" className="font-headline font-black text-xs uppercase tracking-widest cursor-pointer block mb-1">
                      New Arrival Tag
                    </label>
                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wide">
                      Displays a golden "New" badge overlay on storefront grid listings.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4 pt-6 border-t border-dashed border-gray-200">
                  <input
                    type="checkbox"
                    id="badgeExclusive"
                    checked={badgeExclusive}
                    onChange={(e) => setBadgeExclusive(e.target.checked)}
                    className="w-5 h-5 text-primary border-gray-300 focus:ring-0 rounded-none cursor-pointer mt-1"
                  />
                  <div>
                    <label htmlFor="badgeExclusive" className="font-headline font-black text-xs uppercase tracking-widest cursor-pointer block mb-1">
                      Atelier Exclusive Ribbon
                    </label>
                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wide">
                      Overrides generic styles to showcase the premium dark-gold "Atelier Exclusive" banner.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4 pt-6 border-t border-dashed border-gray-200">
                  <input
                    type="checkbox"
                    id="enableCustomBadge"
                    checked={enableCustomBadge}
                    onChange={(e) => setEnableCustomBadge(e.target.checked)}
                    className="w-5 h-5 text-primary border-gray-300 focus:ring-0 rounded-none cursor-pointer mt-1"
                  />
                  <div className="flex-1">
                    <label htmlFor="enableCustomBadge" className="font-headline font-black text-xs uppercase tracking-widest cursor-pointer block mb-1">
                      Custom Badge Text
                    </label>
                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wide mb-3">
                      Add a personalized overlay badge to showcase unique features or events on the storefront.
                    </p>
                    {enableCustomBadge && (
                      <input
                        type="text"
                        value={customBadgeText}
                        onChange={(e) => setCustomBadgeText(e.target.value)}
                        placeholder="e.g. FESTIVE SALE, OVERSIZED FIT"
                        className="w-full bg-white border border-gray-200 p-3 text-xs font-black uppercase tracking-widest outline-none focus:border-primary rounded-none"
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 04: Valuation & Tax */}
          <div className="border-b border-gray-100 pb-12 grid grid-cols-1 lg:grid-cols-12 gap-12">
            <div className="lg:col-span-4">
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-[#775a19] mb-4 block">
                Section 04
              </span>
              <h3 className="font-headline font-black text-xl uppercase tracking-widest text-primary">Commercials</h3>
              <p className="text-xs text-gray-500 mt-4 leading-relaxed font-semibold uppercase tracking-wider italic opacity-85">
                Configure prices, discounts, and regional taxation categorizations.
              </p>
            </div>
            <div className="lg:col-span-8 space-y-8 bg-white p-8 border border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-[#0a0a0a] mb-3">
                    Base Valuation (INR)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-xs text-gray-400">₹</span>
                    <input
                      type="number"
                      value={basePrice || ""}
                      onChange={(e) => setBasePrice(Math.max(0, parseFloat(e.target.value) || 0))}
                      placeholder="e.g. 14500"
                      className="w-full bg-white border border-gray-200 pl-8 pr-4 py-4 text-sm font-black outline-none focus:border-primary rounded-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-[#0a0a0a] mb-3">
                    GST Category (%)
                  </label>
                  <select
                    value={gstRate}
                    onChange={(e) => setGstRate(parseInt(e.target.value) || 12)}
                    className="w-full bg-white border border-gray-200 p-4 text-xs font-black uppercase tracking-widest outline-none focus:border-primary rounded-none cursor-pointer"
                  >
                    <option value="5">5% (Handloom Textiles)</option>
                    <option value="12">12% (Premium Apparel)</option>
                    <option value="18">18% (Luxury Goods)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-dashed border-gray-200">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-[#0a0a0a] mb-3">
                    Commercial Discount (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={discountRate || ""}
                    onChange={(e) => setDiscountRate(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                    placeholder="e.g. 10"
                    className="w-full bg-white border border-gray-200 p-4 text-sm font-bold outline-none focus:border-primary rounded-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">
                    Final Retail Price (Calculated)
                  </label>
                  <div className="bg-[#f9fafb] p-4 border border-gray-200 text-left">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                      Total Valuation (Inc. GST & discount)
                    </p>
                    <p className="text-2xl font-headline font-black text-[#775a19]">
                      ₹{finalPrice.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 05: Product Images */}
          <div className="border-b border-gray-100 pb-12 grid grid-cols-1 lg:grid-cols-12 gap-12">
            <div className="lg:col-span-4">
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-[#775a19] mb-4 block">
                Section 05
              </span>
              <h3 className="font-headline font-black text-xl uppercase tracking-widest text-primary">Media Gallery</h3>
              <p className="text-xs text-gray-500 mt-4 leading-relaxed font-semibold uppercase tracking-wider italic opacity-85">
                Primary catalog showcase and alternate lifestyle slides.
              </p>
            </div>
            <div className="lg:col-span-8 space-y-6">
              {/* Tab options switch */}
              <div className="flex gap-6 border-b border-gray-200 pb-3">
                <button
                  type="button"
                  onClick={() => setImageMode("upload")}
                  className={`text-[10px] font-black uppercase tracking-widest pb-3 outline-none whitespace-nowrap bg-transparent border-none cursor-pointer transition-colors ${
                    imageMode === "upload"
                      ? "text-primary border-b-2 border-primary"
                      : "text-gray-400 hover:text-primary border-b-2 border-transparent"
                  }`}
                >
                  Upload Local Files
                </button>
                <button
                  type="button"
                  onClick={() => setImageMode("urls")}
                  className={`text-[10px] font-black uppercase tracking-widest pb-3 outline-none whitespace-nowrap bg-transparent border-none cursor-pointer transition-colors ${
                    imageMode === "urls"
                      ? "text-primary border-b-2 border-primary"
                      : "text-gray-400 hover:text-primary border-b-2 border-transparent"
                  }`}
                >
                  Use Image URLs
                </button>
              </div>

              {/* Mode 1: Local Upload */}
              {imageMode === "upload" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {/* Add Image slot */}
                    {selectedImages.length < 4 && (
                      <div
                        onClick={() => document.getElementById("fileInputTrigger")?.click()}
                        className="aspect-[3/4] flex flex-col items-center justify-center border-2 border-dashed border-gray-200 bg-[#fafafa] hover:border-[#fed488] hover:bg-white transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-4xl text-gray-400">add_photo_alternate</span>
                        <p className="text-[9px] font-black uppercase tracking-widest mt-2 text-gray-500">
                          Add Photo
                        </p>
                        <input
                          type="file"
                          id="fileInputTrigger"
                          multiple
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                        />
                      </div>
                    )}

                    {selectedImages.map((imgSrc, idx) => (
                      <div
                        key={idx}
                        className={`aspect-[3/4] border-2 relative group overflow-hidden bg-white transition-all ${
                          primaryImageIndex === idx ? "border-[#fed488] shadow-md scale-[1.02]" : "border-gray-200"
                        }`}
                      >
                        <img src={imgSrc} className="w-full h-full object-cover" alt={`Preview ${idx + 1}`} />
                        
                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeLocalImage(idx);
                            if (primaryImageIndex === idx) {
                              setPrimaryImageIndex(0);
                            } else if (primaryImageIndex > idx) {
                              setPrimaryImageIndex(primaryImageIndex - 1);
                            }
                          }}
                          className="absolute top-2 right-2 z-10 w-8 h-8 flex items-center justify-center bg-black/60 text-white rounded-full hover:bg-red-600 transition-colors border-none cursor-pointer opacity-0 group-hover:opacity-100"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>

                        {/* Cover Image Action/Status */}
                        {primaryImageIndex === idx ? (
                          <div className="absolute bottom-0 left-0 right-0 bg-[#fed488] text-[#775a19] py-2 px-2 text-[8px] font-black uppercase tracking-widest text-center flex items-center justify-center gap-1">
                            <span className="material-symbols-outlined text-[10px]">star</span>
                            Primary Cover
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setPrimaryImageIndex(idx)}
                            className="absolute bottom-0 left-0 right-0 bg-black/75 hover:bg-[#fed488] hover:text-[#775a19] text-white py-2 px-2 text-[8px] font-black uppercase tracking-widest text-center border-none cursor-pointer transition-colors opacity-0 group-hover:opacity-100"
                          >
                            Set as Cover
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-2 italic opacity-60">
                    Quota limit: Up to 4 product photos in base64. Select one as Primary Cover.
                  </p>
                </div>
              )}

              {/* Mode 2: URLs inputs */}
              {imageMode === "urls" && (
                <div className="space-y-6 bg-white p-6 border border-gray-200">
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 leading-relaxed">
                    Enter direct image addresses (CDN links) to prevent browser quota limit overflows.
                  </p>
                  <div className="space-y-4">
                    <div>
                      <label className="text-[9px] font-black text-gray-400 mb-1.5 block">Showcase Cover Image</label>
                      <input
                        type="text"
                        value={imgUrl1}
                        onChange={(e) => setImgUrl1(e.target.value)}
                        placeholder="https://images.unsplash.com/photo-..."
                        className="w-full border border-gray-200 p-3 text-xs outline-none focus:border-primary rounded-none"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-gray-400 mb-1.5 block">Lifestyle Flip Image</label>
                      <input
                        type="text"
                        value={imgUrl2}
                        onChange={(e) => setImgUrl2(e.target.value)}
                        placeholder="https://images.unsplash.com/photo-..."
                        className="w-full border border-gray-200 p-3 text-xs outline-none focus:border-primary rounded-none"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-gray-400 mb-1.5 block">Detail Angle 1</label>
                      <input
                        type="text"
                        value={imgUrl3}
                        onChange={(e) => setImgUrl3(e.target.value)}
                        placeholder="https://images.unsplash.com/photo-..."
                        className="w-full border border-gray-200 p-3 text-xs outline-none focus:border-primary rounded-none"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-gray-400 mb-1.5 block">Detail Angle 2</label>
                      <input
                        type="text"
                        value={imgUrl4}
                        onChange={(e) => setImgUrl4(e.target.value)}
                        placeholder="https://images.unsplash.com/photo-..."
                        className="w-full border border-gray-200 p-3 text-xs outline-none focus:border-primary rounded-none"
                      />
                    </div>
                  </div>

                  {/* URL previews */}
                  <div className="pt-6 border-t border-dashed border-gray-200">
                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-3 block">
                      Live URL Previews & Primary Selector
                    </label>
                    <div className="grid grid-cols-4 gap-4">
                      {[imgUrl1, imgUrl2, imgUrl3, imgUrl4].map((urlStr, idx) => {
                        const isVal = urlStr.trim().length > 0;
                        return (
                          <div
                            key={idx}
                            className={`aspect-[3/4] border-2 relative group overflow-hidden bg-gray-50 flex items-center justify-center text-center transition-all ${
                              isVal && primaryImageIndex === idx ? "border-[#fed488] shadow-md scale-[1.02] bg-white" : "border-gray-200"
                            }`}
                          >
                            {isVal ? (
                              <>
                                <img
                                  src={urlStr.trim()}
                                  className="w-full h-full object-cover"
                                  alt={`URL Preview ${idx + 1}`}
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src =
                                      "https://via.placeholder.com/150?text=Invalid+URL";
                                  }}
                                />
                                
                                {/* Cover Image Action/Status */}
                                {primaryImageIndex === idx ? (
                                  <div className="absolute bottom-0 left-0 right-0 bg-[#fed488] text-[#775a19] py-2 px-2 text-[8px] font-black uppercase tracking-widest text-center flex items-center justify-center gap-1">
                                    <span className="material-symbols-outlined text-[10px]">star</span>
                                    Primary Cover
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setPrimaryImageIndex(idx)}
                                    className="absolute bottom-0 left-0 right-0 bg-black/75 hover:bg-[#fed488] hover:text-[#775a19] text-white py-2 px-2 text-[8px] font-black uppercase tracking-widest text-center border-none cursor-pointer transition-colors opacity-0 group-hover:opacity-100"
                                  >
                                    Set as Cover
                                  </button>
                                )}
                              </>
                            ) : (
                              <span className="text-gray-400 text-[8px] font-black uppercase tracking-widest">
                                Slot {idx + 1} Empty
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </form>
      </div>

      {/* Success Confirmation Modal */}
      {successModalText && (
        <div className="fixed inset-0 z-[2000] bg-[#0a0a0a]/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border border-[#775a19]/20 shadow-2xl p-8 max-w-sm w-full space-y-6 text-center rounded-none animate-zoom-in">
            <div className="mx-auto w-12 h-12 rounded-full border border-green-200 bg-green-50 flex items-center justify-center text-green-600">
              <span className="material-symbols-outlined text-xl">check_circle</span>
            </div>
            <div className="space-y-2">
              <h3 className="font-headline font-black text-sm uppercase tracking-wider text-primary">Success</h3>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold leading-relaxed">
                {successModalText}
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  setSuccessModalText("");
                  router.push("/admindashboard/inventory");
                }}
                className="w-full bg-[#1a1c1c] text-white hover:bg-secondary py-3 text-[10px] font-black uppercase tracking-widest transition-colors cursor-pointer rounded-none border-none font-bold"
              >
                Continue to Inventory
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AddProductPage() {
  return (
    <Suspense
      fallback={
        <div className="p-16 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-secondary mx-auto"></div>
        </div>
      }
    >
      <AddProductContent />
    </Suspense>
  );
}
