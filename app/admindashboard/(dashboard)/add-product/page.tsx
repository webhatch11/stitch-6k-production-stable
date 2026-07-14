"use client";

import React, { useState, useEffect, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { saveProductAction, deleteProductAction } from "@/app/actions/admin-products";
import { getProductsAction, getProductAuditLogsAction } from "@/app/actions/admin-reads";
import CloudinaryUploadWidget, { type CloudinaryUploadHandle } from "@/app/admindashboard/CloudinaryUploadWidget";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  closestCenter,
} from "@dnd-kit/core";


// ---------------------------------------------------------------------------
// Drag-and-drop helpers (hooks can't be called inside .map)
// ---------------------------------------------------------------------------

interface DraggableImageProps {
  slotIdx: number;
  url: string;
}

function DraggableImage({ slotIdx, url }: DraggableImageProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `slot-${slotIdx}`,
    data: { slotIdx },
  });

  const style: React.CSSProperties = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 50,
        opacity: isDragging ? 0.4 : 1,
        cursor: isDragging ? "grabbing" : "grab",
      }
    : { cursor: "grab" };

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      ref={setNodeRef}
      style={style}
      src={url}
      alt={`Slot ${slotIdx + 1}`}
      className="w-full h-full object-cover select-none"
      {...attributes}
      {...listeners}
      draggable={false}
    />
  );
}

interface DroppableSlotProps {
  slotIdx: number;
  children: React.ReactNode;
  isFilled: boolean;
  isPrimary: boolean;
}

function DroppableSlot({ slotIdx, children, isFilled, isPrimary }: DroppableSlotProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `drop-${slotIdx}`,
    data: { slotIdx },
  });

  const baseRing = isPrimary && isFilled
    ? "border-[#fed488] shadow-md"
    : "border-gray-200";

  const hoverRing = isOver ? "ring-2 ring-blue-400 ring-offset-2" : "";

  return (
    <div
      ref={setNodeRef}
      className={`aspect-square border-2 relative group overflow-hidden bg-gray-50 transition-all ${baseRing} ${hoverRing}`}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------

function AddProductContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editProductId = searchParams.get("edit");
  const [productSlug, setProductSlug] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Form Fields State
  const [title, setTitle] = useState("");
  const [sku, setSku] = useState("");
  const [category, setCategory] = useState("Cotton");
  const [description, setDescription] = useState("");
  const [categories, setCategories] = useState<string[]>(["Cotton", "Linen", "Denim", "Silk Blend", "Silk"]);
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategory, setCustomCategory] = useState("");

  // Load categories dynamically from database site settings
  useEffect(() => {
    import("@/app/actions/admin-settings").then(({ getSettingAction }) => {
      getSettingAction("categories").then((res) => {
        if (res.success && res.value && Array.isArray(res.value.items)) {
          const list = res.value.items.map((item: any) => item.title);
          if (list.length > 0) {
            setCategories(list);
            setCategory(list[0]);
          }
        }
      });
    });
  }, []);

  // Stock Size Allocation
  const [stockS, setStockS] = useState(0);
  const [stockM, setStockM] = useState(0);
  const [stockL, setStockL] = useState(0);
  const [stockXL, setStockXL] = useState(0);
  const [stockXXL, setStockXXL] = useState(0);

  // Variants — admin manages size × color combinations
  const SIZE_OPTIONS = ["S", "M", "L", "XL", "XXL"];
  const [variants, setVariants] = useState<Array<{
    size: string;
    color: string;
    sku: string;
    price: number;
    stock: number;
  }>>([]);

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
  const [displaySections, setDisplaySections] = useState<string[]>([]);

  // Pricing & Commercial
  const [basePrice, setBasePrice] = useState(0);
  const [compareAtPrice, setCompareAtPrice] = useState<number | "">("");
  const [weightGrams, setWeightGrams] = useState<number | "">("");
  const [productStatus, setProductStatus] = useState<"active" | "draft" | "archived">("active");
  const [gstRate, setGstRate] = useState(12);
  const [discountRate, setDiscountRate] = useState(0);

  // SEO States
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [seoKeywords, setSeoKeywords] = useState("");

  // 4-slot image grid: index 0 = primary cover, 1-3 = secondary images
  const [selectedImages, setSelectedImages] = useState<string[]>(["", "", "", ""]);
  // Ref (not state) — onUpload callback closure must read the LATEST
  // target slot, not the value captured at render time.
  const pendingSlotRef = useRef<number | null>(null);
  // Ref to the single Cloudinary widget instance for the entire page
  const cloudinaryRef = useRef<CloudinaryUploadHandle>(null);

  // Success Modal State
  const [successModalText, setSuccessModalText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // Defensive cleanup: restore body scroll if Cloudinary widget leaves it locked
  useEffect(() => {
    return () => {
      if (typeof document !== "undefined") {
        document.body.style.overflow = "";
      }
    };
  }, []);

  useEffect(() => {
    if (!editProductId) return;
    getProductAuditLogsAction(editProductId).then((res) => {
      if (res.success) setAuditLogs(res.logs || []);
    });
  }, [editProductId]);

  // Detect Edit Mode & Pre-populate
  useEffect(() => {
    const loadProductData = async () => {
      const res = await getProductsAction();
      const items = res.success ? (res.products || []) : [];
      const uniqueCats = Array.from(new Set(items.map((p) => p.category).filter(Boolean)));
      const seedCats = ["Cotton", "Linen", "Denim", "Silk Blend", "Silk"];
      const combinedCats = Array.from(new Set([...seedCats, ...uniqueCats]));
      setCategories(combinedCats);

      if (editProductId) {
        const p = items.find((prod) => prod.id === editProductId);

        if (p) {
          setTitle(p.title || "");
          setSku(p.id || "");
          setProductSlug(p.slug || "");
          
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
          setDisplaySections(p.display_sections || []);
          if (p.customBadge) {
            setEnableCustomBadge(true);
            setCustomBadgeText(p.customBadge);
          } else {
            setEnableCustomBadge(false);
            setCustomBadgeText("");
          }

          // Pricing
          setBasePrice(p.basePrice || p.price || 0);
          setCompareAtPrice(p.compareAtPrice !== undefined && p.compareAtPrice !== null ? p.compareAtPrice : (p.comparePrice !== undefined && p.comparePrice !== null ? p.comparePrice : ""));
          setWeightGrams(p.weightGrams !== undefined && p.weightGrams !== null ? p.weightGrams : "");
          setProductStatus(p.productStatus || "active");
          setGstRate(p.gstRate || 12);
          setDiscountRate(p.discountRate || 0);

          // SEO
          setSeoTitle(p.seoTitle || "");
          setSeoDescription(p.seoDescription || "");
          setSeoKeywords(p.seoKeywords || "");

          // Images — populate 4 fixed slots; empty string = empty slot.
          const imgList = (p.images && p.images.length > 0)
            ? p.images
            : (p.image ? [p.image] : []);

          const slotted = [...imgList.slice(0, 4)];
          while (slotted.length < 4) slotted.push("");
          setSelectedImages(slotted);

          // Variants
          if (p.variants && p.variants.length > 0) {
            setVariants(p.variants.map((v: any) => ({
              size: v.size,
              color: v.color,
              sku: v.sku || "",
              price: v.price ?? p.basePrice ?? 0,
              stock: v.stock ?? 0,
            })));
          } else {
            setVariants(SIZE_OPTIONS.map(size => ({
              size,
              color: p.colors?.[0] || "Default",
              sku: `${p.id || "PROD"}-${size}-${(p.colors?.[0] || "ATL").slice(0, 3).toUpperCase()}`,
              price: p.basePrice || 0,
              stock: sizeStock[size as keyof typeof sizeStock] || 0,
            })));
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
  const hasComparePriceError = compareAtPrice !== "" && Number(compareAtPrice) <= basePrice;

  // Drag-and-drop swap handler
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const sourceIdx = active.data?.current?.slotIdx as number | undefined;
    const targetIdx = over.data?.current?.slotIdx as number | undefined;

    if (typeof sourceIdx !== "number" || typeof targetIdx !== "number") return;
    if (sourceIdx === targetIdx) return;

    setSelectedImages((prev) => {
      const next = [...prev];
      while (next.length < 4) next.push("");
      const tmp = next[sourceIdx];
      next[sourceIdx] = next[targetIdx];
      next[targetIdx] = tmp;
      return next;
    });
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
      predicate: (event: any) => {
        const target = event.target as HTMLElement;
        return !target.closest("button") && !target.closest("input");
      },
    }),
    useSensor(KeyboardSensor)
  );

  // Submit and Save
  const handleSaveProduct = async () => {
    if (isSubmitting) return;
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

    // Collect images — filter empty slots; slot order = save order
    let productImages = selectedImages.filter((url) => url && url.trim().length > 0);

    if (productImages.length === 0) {
      productImages = [
        "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&q=80&w=600",
      ];
    }

    const primaryImage = productImages[0];

    // Auto-generate variants for new products if UI was bypassed and state is empty
    const sizeStockMap: Record<string, number> = {
      S: stockS,
      M: stockM,
      L: stockL,
      XL: stockXL,
      XXL: stockXXL,
    };

    const parentSkuForVariants = finalSKU && finalSKU.trim() ? finalSKU.trim() : `${Date.now()}`;

    const autoVariants = ["S", "M", "L", "XL", "XXL"]
      .filter((size) => sizeStockMap[size] > 0)
      .map((size) => ({
        size,
        color: "Default",
        sku: `${parentSkuForVariants}-${size}`,
        price: basePrice,
        stock: sizeStockMap[size],
      }));

    // In edit mode, sync the UI stock inputs (stockS/M/L/XL/XXL) and the
    // current basePrice back into each variant before saving. The variants
    // array retains all other fields (color, sku, id) from the DB snapshot.
    const editVariants = variants.map((v) => ({
      ...v,
      price: basePrice,
      stock: sizeStockMap[v.size] ?? v.stock,
    }));

    const finalVariants = editProductId
      ? editVariants
      : (variants.length > 0 ? variants : autoVariants);

    const input = {
      id: finalSKU,
      title: title.trim(),
      category: finalCategory,
      description: description.trim() || `${title} in premium ${finalCategory} weave.`,
      basePrice,
      gstRate,
      discountRate,
      image: primaryImage,
      images: productImages,
      sizeStock: { S: stockS, M: stockM, L: stockL, XL: stockXL, XXL: stockXXL },
      specFabric: specFabric.trim() || `Premium ${finalCategory}`,
      specFit: specFit.trim() || "Relaxed Fit",
      specCollar: specCollar.trim() || "Spread Collar",
      specSleeve: specSleeve.trim() || "Full Sleeves",
      specCare: specCare.trim() || "Dry clean only.",
      isNew: badgeNew,
      isAtelierExclusive: badgeExclusive,
      customBadge: enableCustomBadge ? customBadgeText.trim() : "",
      variants: finalVariants,
      display_sections: displaySections,
      compareAtPrice: compareAtPrice === "" ? null : Number(compareAtPrice),
      weightGrams: weightGrams === "" ? null : Number(weightGrams),
      productStatus: productStatus,
      seoTitle: seoTitle.trim() || null,
      seoDescription: seoDescription.trim() || null,
      seoKeywords: seoKeywords.trim() || null,
    };

    setIsSubmitting(true);
    try {
      if (!editProductId) {
        const listRes = await getProductsAction();
        const list = listRes.success ? (listRes.products || []) : [];
        const exists = list.some((prod) => prod.id === finalSKU);
        if (exists) {
          triggerToast("SKU already exists. Please choose a unique SKU reference.");
          setIsSubmitting(false);
          return;
        }
      }
      const result = await saveProductAction(input);
      if (!result.success) {
        triggerToast(result.error || "Failed to save product");
        setIsSubmitting(false);
        return;
      }
      router.refresh();
      setSuccessModalText(editProductId ? "Product updated successfully!" : "Product created successfully!");
    } catch (e: any) {
      console.error(e);
      triggerToast("Failed to save product details");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-8 lg:p-16">
      {/* Single mounted Cloudinary widget — opened programmatically per slot */}
      <CloudinaryUploadWidget
        ref={cloudinaryRef}
        onUpload={(newUrl) => {
          const slotIdx = pendingSlotRef.current;
          if (slotIdx === null) return;
          setSelectedImages((prev) => {
            const next = [...prev];
            while (next.length < 4) next.push("");
            next[slotIdx] = newUrl;
            return next;
          });
          pendingSlotRef.current = null;
        }}
      />
      {/* Header bar actions */}
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8 mb-16">
        <div>
          <nav className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">
            <span>Inventory</span>
            <span className="material-symbols-outlined text-sm opacity-30">chevron_right</span>
            <span className="text-[#0a0a0a] italic">{editProductId ? `Edit Product: ${title}` : "Add Product"}</span>
          </nav>
          <div className="flex items-center gap-4 flex-wrap">
            <h2 className="text-5xl font-headline font-black tracking-tighter text-[#0a0a0a] uppercase leading-none">
              {editProductId ? "Edit Product" : "Add Product"}
            </h2>
            {editProductId && (
              <a
                href={`/product/${productSlug || editProductId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[10px] font-black uppercase tracking-widest transition-all rounded-none cursor-pointer border border-gray-200"
                style={{ textDecoration: 'none' }}
              >
                <span className="material-symbols-outlined text-xs">open_in_new</span>
                View on Storefront
              </a>
            )}
          </div>
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
            disabled={isSubmitting || (compareAtPrice !== "" && Number(compareAtPrice) <= basePrice)}
            className={`flex-1 lg:flex-none bg-primary text-white px-10 py-4 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-secondary transition-all shadow-lg rounded-none cursor-pointer border-none font-bold ${
              (isSubmitting || (compareAtPrice !== "" && Number(compareAtPrice) <= basePrice)) ? "opacity-55 cursor-not-allowed bg-gray-400" : ""
            }`}
          >
            {isSubmitting ? "Saving..." : (editProductId ? "Update Product" : "Save Product")}
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-[#0a0a0a] mb-3 flex items-center justify-between">
                    <span>Product Status</span>
                    <span className="flex items-center gap-1.5 font-black">
                      <span className={`w-2.5 h-2.5 rounded-full ${
                        productStatus === "active" ? "bg-green-600" :
                        productStatus === "draft" ? "bg-yellow-500 animate-pulse" : "bg-gray-400"
                      }`} />
                      <span className="text-[9px] uppercase tracking-widest text-outline">
                        {productStatus}
                      </span>
                    </span>
                  </label>
                  <select
                    value={productStatus}
                    onChange={(e) => setProductStatus(e.target.value as any)}
                    className="w-full bg-white border border-gray-200 p-4 text-xs font-black uppercase tracking-widest outline-none focus:border-primary rounded-none cursor-pointer"
                  >
                    <option value="active">Active — visible on storefront</option>
                    <option value="draft">Draft — hidden from storefront</option>
                    <option value="archived">Archived — hidden, no longer sold</option>
                  </select>
                </div>
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

          {/* Section 03.5: Display Sections */}
          <div className="border-b border-gray-100 pb-12 grid grid-cols-1 lg:grid-cols-12 gap-12">
            <div className="lg:col-span-4">
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-[#775a19] mb-4 block">
                Section 03.5
              </span>
              <h3 className="font-headline font-black text-xl uppercase tracking-widest text-primary">Display Sections</h3>
              <p className="text-xs text-gray-500 mt-4 leading-relaxed font-semibold uppercase tracking-wider italic opacity-85">
                Select where this product will be displayed on the homepage.
              </p>
            </div>
            <div className="lg:col-span-8 space-y-6">
              <div className="bg-[#fafafa] p-8 border border-gray-200 space-y-6">
                
                <div className="flex items-start gap-4">
                  <input
                    type="checkbox"
                    id="sectionNewArrivals"
                    checked={displaySections.includes("new_arrivals")}
                    onChange={(e) => {
                      const updated = e.target.checked
                        ? [...displaySections, "new_arrivals"]
                        : displaySections.filter(s => s !== "new_arrivals");
                      setDisplaySections(updated);
                    }}
                    className="w-5 h-5 text-primary border-gray-300 focus:ring-0 rounded-none cursor-pointer mt-1"
                  />
                  <div>
                    <label htmlFor="sectionNewArrivals" className="font-headline font-black text-xs uppercase tracking-widest cursor-pointer block mb-1">
                      New Arrival Section
                    </label>
                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wide">
                      Show this product in the "New Arrivals" Coverflow slider on the homepage.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 pt-6 border-t border-dashed border-gray-200">
                  <input
                    type="checkbox"
                    id="sectionBestsellers"
                    checked={displaySections.includes("bestsellers")}
                    onChange={(e) => {
                      const updated = e.target.checked
                        ? [...displaySections, "bestsellers"]
                        : displaySections.filter(s => s !== "bestsellers");
                      setDisplaySections(updated);
                    }}
                    className="w-5 h-5 text-primary border-gray-300 focus:ring-0 rounded-none cursor-pointer mt-1"
                  />
                  <div>
                    <label htmlFor="sectionBestsellers" className="font-headline font-black text-xs uppercase tracking-widest cursor-pointer block mb-1">
                      Favourite Collection Section
                    </label>
                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wide">
                      Show this product in the "Our Favorite Style" grid/section on the homepage.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 pt-6 border-t border-dashed border-gray-200">
                  <input
                    type="checkbox"
                    id="sectionAtelierExclusives"
                    checked={displaySections.includes("atelier_exclusives")}
                    onChange={(e) => {
                      const updated = e.target.checked
                        ? [...displaySections, "atelier_exclusives"]
                        : displaySections.filter(s => s !== "atelier_exclusives");
                      setDisplaySections(updated);
                    }}
                    className="w-5 h-5 text-primary border-gray-300 focus:ring-0 rounded-none cursor-pointer mt-1"
                  />
                  <div>
                    <label htmlFor="sectionAtelierExclusives" className="font-headline font-black text-xs uppercase tracking-widest cursor-pointer block mb-1">
                      Exclusive Section
                    </label>
                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wide">
                      Show this product in the "Atelier Exclusives" grid/section on the homepage.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 pt-6 border-t border-dashed border-gray-200">
                  <input
                    type="checkbox"
                    id="sectionGenz"
                    checked={displaySections.includes("genz")}
                    onChange={(e) => {
                      const updated = e.target.checked
                        ? [...displaySections, "genz"]
                        : displaySections.filter(s => s !== "genz");
                      setDisplaySections(updated);
                    }}
                    className="w-5 h-5 text-primary border-gray-300 focus:ring-0 rounded-none cursor-pointer mt-1"
                  />
                  <div>
                    <label htmlFor="sectionGenz" className="font-headline font-black text-xs uppercase tracking-widest cursor-pointer block mb-1">
                      Gen Z Section
                    </label>
                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wide">
                      Show this product in the "Gen Z Streetwear" section on the storefront.
                    </p>
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
                    Compare-At Price (INR)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-xs text-gray-400">₹</span>
                    <input
                      type="number"
                      value={compareAtPrice}
                      onChange={(e) => setCompareAtPrice(e.target.value === "" ? "" : Math.max(0, parseFloat(e.target.value) || 0))}
                      placeholder="e.g. 18500"
                      className={`w-full bg-white border pl-8 pr-4 py-4 text-sm font-black outline-none focus:border-primary rounded-none ${
                        hasComparePriceError ? "border-red-500 focus:border-red-500" : "border-gray-200"
                      }`}
                    />
                  </div>
                  {hasComparePriceError && (
                    <p className="text-[10px] text-red-600 font-bold uppercase tracking-wider mt-2">
                      Compare-at price must be higher than the selling price
                    </p>
                  )}
                  {!hasComparePriceError && compareAtPrice !== "" && basePrice > 0 && Number(compareAtPrice) > basePrice && (
                    <p className="text-[10px] text-green-700 font-bold uppercase tracking-wider mt-2 bg-green-50/50 p-2 border border-green-200/40">
                      Preview: <span className="line-through text-gray-400">₹{Number(compareAtPrice).toLocaleString("en-IN")}</span> <span className="text-[#0a0a0a]">₹{basePrice.toLocaleString("en-IN")}</span> <span className="text-green-600">({Math.round((1 - basePrice / Number(compareAtPrice)) * 100)}% off)</span>
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-dashed border-gray-200">
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

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-[#0a0a0a] mb-3">
                    Product Weight (Grams)
                  </label>
                  <input
                    type="number"
                    value={weightGrams}
                    onChange={(e) => setWeightGrams(e.target.value === "" ? "" : Math.max(0, parseInt(e.target.value) || 0))}
                    placeholder="e.g. 300"
                    className="w-full bg-white border border-gray-200 p-4 text-xs font-black outline-none focus:border-primary rounded-none"
                  />
                  <p className="text-[9px] text-outline uppercase tracking-wider font-semibold mt-2">
                    Used for Shiprocket shipping calculations. Typical shirt: 250-400g
                  </p>
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
              <h3 className="font-headline font-black text-xl uppercase tracking-widest text-primary">
                Media Gallery
              </h3>
              <p className="text-xs text-gray-500 mt-4 leading-relaxed font-semibold uppercase tracking-wider italic opacity-85">
                4 image slots. Slot 1 is the primary cover shown on listings.
                Slots 2–4 are secondary product images.
              </p>
              <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest italic opacity-60 mt-3">
                Cloudinary CDN · Max 10 MB · png, jpg, webp
              </p>
            </div>

            <div className="lg:col-span-8">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <div className="grid grid-cols-2 gap-3 max-w-md">
                  {[0, 1, 2, 3].map((slotIdx) => {
                    const url = selectedImages[slotIdx] || "";
                    const isPrimary = slotIdx === 0;
                    const isFilled = url.length > 0;

                    const openForSlot = () => {
                      pendingSlotRef.current = slotIdx;
                      cloudinaryRef.current?.open();
                    };

                    return (
                      <DroppableSlot
                        key={slotIdx}
                        slotIdx={slotIdx}
                        isFilled={isFilled}
                        isPrimary={isPrimary}
                      >
                        {/* Slot label */}
                        <div
                          className={`absolute top-2 left-2 z-30 px-2 py-1 text-[8px] font-black uppercase tracking-widest pointer-events-none ${
                            isPrimary
                              ? "bg-[#fed488] text-[#775a19]"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {isPrimary ? "★ Primary Cover" : `Image ${slotIdx + 1}`}
                        </div>

                        {isFilled ? (
                          <>
                            <DraggableImage slotIdx={slotIdx} url={url} />

                            {/* Direct absolute remove button */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedImages((prev) => {
                                  const next = [...prev];
                                  while (next.length < 4) next.push("");
                                  next[slotIdx] = "";
                                  return next;
                                });
                              }}
                              style={{
                                position: "absolute",
                                top: "8px",
                                right: "8px",
                                background: "rgba(0,0,0,0.6)",
                                color: "#fff",
                                border: "none",
                                borderRadius: "50%",
                                width: "24px",
                                height: "24px",
                                cursor: "pointer",
                                fontSize: "14px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                zIndex: 40,
                              }}
                              className="pointer-events-auto hover:bg-red-600 transition-colors"
                            >
                              ×
                            </button>

                            {/* Hover overlay — pointer-events-none so drags pass through;
                                buttons restore pointer-events-auto individually */}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 z-20 pointer-events-none">
                              <button
                                type="button"
                                onClick={openForSlot}
                                className="px-4 py-2 bg-white text-[#0a0a0a] text-[10px] font-black uppercase tracking-widest hover:bg-[#fed488] transition-colors border-none cursor-pointer pointer-events-auto"
                              >
                                Replace
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedImages((prev) => {
                                  const next = [...prev];
                                  while (next.length < 4) next.push("");
                                  next[slotIdx] = "";
                                  return next;
                                })}
                                className="px-4 py-2 bg-red-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-colors border-none cursor-pointer pointer-events-auto"
                              >
                                Delete
                              </button>
                            </div>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={openForSlot}
                            className="w-full h-full flex flex-col items-center justify-center gap-2 bg-transparent border-none cursor-pointer hover:bg-gray-100 transition-colors"
                          >
                            <span className="material-symbols-outlined text-2xl text-gray-400">
                              add_photo_alternate
                            </span>
                            <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">
                              Click to upload
                            </span>
                          </button>
                        )}
                      </DroppableSlot>
                    );
                  })}
                </div>
              </DndContext>
            </div>
          </div>

          {/* Section 06: SEO & DISCOVERABILITY */}
          <div className="pb-12 grid grid-cols-1 lg:grid-cols-12 gap-12 pt-12 border-t border-gray-100">
            <div className="lg:col-span-4">
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-[#775a19] mb-4 block">
                Section 06
              </span>
              <h3 className="font-headline font-black text-xl uppercase tracking-widest text-primary">
                SEO & Discoverability
              </h3>
              <p className="text-xs text-gray-500 mt-4 leading-relaxed font-semibold uppercase tracking-wider italic opacity-85">
                Control how this product appears in search engines.
              </p>
            </div>

            <div className="lg:col-span-8 space-y-8 bg-white p-8 border border-gray-200">
              {/* SEO Title */}
              <div>
                <div className="flex justify-between items-baseline mb-3">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-[#0a0a0a]">
                    SEO Title
                  </label>
                  <span className={`text-[9px] font-black uppercase tracking-widest ${
                    seoTitle.length > 60 ? "text-orange-600 font-bold" : "text-gray-400"
                  }`}>
                    {seoTitle.length}/60 characters
                  </span>
                </div>
                <input
                  type="text"
                  maxLength={100}
                  value={seoTitle}
                  onChange={(e) => setSeoTitle(e.target.value)}
                  placeholder="e.g. Premium Cotton Shirt — 6K Brand | Buy Online India"
                  className="w-full bg-white border border-gray-200 p-4 text-sm font-semibold outline-none focus:border-primary rounded-none"
                />
                <p className="text-[9px] text-outline uppercase tracking-wider font-semibold mt-2 leading-relaxed">
                  Recommended: 50-60 characters. Leave empty to use product name.
                </p>
                {seoTitle.length > 60 && (
                  <p className="text-[9px] text-orange-600 font-black uppercase tracking-widest mt-1.5 flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">warning</span>
                    Too long — may be truncated
                  </p>
                )}
                {seoTitle.length > 0 && seoTitle.length < 30 && (
                  <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest mt-1.5">
                    Consider adding more detail
                  </p>
                )}
              </div>

              {/* Meta Description */}
              <div>
                <div className="flex justify-between items-baseline mb-3">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-[#0a0a0a]">
                    Meta Description
                  </label>
                  <span className={`text-[9px] font-black uppercase tracking-widest ${
                    seoDescription.length > 160 ? "text-orange-600 font-bold" : "text-gray-400"
                  }`}>
                    {seoDescription.length}/160 characters
                  </span>
                </div>
                <textarea
                  maxLength={300}
                  value={seoDescription}
                  onChange={(e) => setSeoDescription(e.target.value)}
                  placeholder="e.g. Buy premium cotton shirts from 6K Brand. Heritage craftsmanship meets modern streetwear. Free shipping across India."
                  className="w-full bg-white border border-gray-200 p-4 text-sm font-semibold outline-none focus:border-primary rounded-none h-28 resize-none"
                />
                <p className="text-[9px] text-outline uppercase tracking-wider font-semibold mt-2 leading-relaxed">
                  Recommended: 150-160 characters. Shown in Google search results.
                </p>
                {seoDescription.length > 160 && (
                  <p className="text-[9px] text-orange-600 font-black uppercase tracking-widest mt-1.5 flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">warning</span>
                    Too long — may be truncated
                  </p>
                )}
              </div>

              {/* Focus Keywords */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-[#0a0a0a] mb-3">
                  Focus Keywords
                </label>
                <input
                  type="text"
                  value={seoKeywords}
                  onChange={(e) => setSeoKeywords(e.target.value)}
                  placeholder="e.g. cotton shirt, premium shirt India"
                  className="w-full bg-white border border-gray-200 p-4 text-sm font-semibold outline-none focus:border-primary rounded-none"
                />
                <p className="text-[9px] text-outline uppercase tracking-wider font-semibold mt-2">
                  Comma-separated. Used for search engine discoverability.
                </p>
              </div>

              {/* Dynamic Google Search Preview Card */}
              <div className="pt-6 border-t border-dashed border-gray-200">
                <div className="bg-[#f8f9fa] border border-gray-200/80 p-6 rounded-none text-left max-w-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-5 h-5 rounded-full bg-[#1a0dab]/5 text-[#1a0dab] font-serif font-black text-xs flex items-center justify-center border border-[#1a0dab]/10">G</span>
                    <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Google Search Preview</span>
                  </div>
                  <div className="space-y-1 font-sans">
                    <p className="text-xs text-[#0d652d] font-mono truncate">
                      the6k.com › product › {sku || "shirt-sku"}
                    </p>
                    <h4 className="text-[17px] leading-tight text-[#1a0dab] hover:underline cursor-pointer font-medium font-sans">
                      {seoTitle.trim() || title || "Premium Cotton Shirt — 6K Brand"}
                    </h4>
                    <p className="text-xs text-[#4d5156] font-sans leading-relaxed">
                      {seoDescription.trim() || description.trim().slice(0, 160) || "Buy premium cotton shirts from 6K Brand. Heritage craftsmanship meets modern streetwear. Free shipping across India."}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </form>
      </div>

      {editProductId && (
        <div className="max-w-5xl mt-16 space-y-12">
          {/* Edit History Section */}
          {auditLogs.length > 0 && (
            <div className="pt-8 border-t border-gray-200">
              <h3 className="font-headline font-black text-lg uppercase tracking-widest text-[#0a0a0a] mb-6">Edit History</h3>
              <div className="bg-white border border-gray-200 overflow-hidden divide-y divide-gray-100">
                {auditLogs.map((log: any, idx: number) => (
                  <div key={idx} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-semibold">
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 text-[8px] font-black uppercase tracking-widest rounded-none ${
                        log.action === 'soft_delete' ? 'bg-amber-100 text-amber-700' :
                        log.action === 'restore' ? 'bg-green-100 text-green-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {log.action?.replace(/_/g, ' ')}
                      </span>
                      <div>
                        <p className="text-gray-900">{log.admin_user_email || 'system'}</p>
                        {log.reason && <p className="text-[10px] text-gray-500 mt-0.5">{log.reason}</p>}
                      </div>
                    </div>
                    <span className="text-[10px] text-gray-400 font-mono">
                      {log.created_at ? new Date(log.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Danger Zone / Delete Section */}
          <div className="pt-8 border-t border-red-100">
            <h3 className="font-headline font-black text-lg uppercase tracking-widest text-red-600 mb-2">Danger Zone</h3>
            <p className="text-xs text-gray-500 mb-6 font-semibold uppercase tracking-wider">Actions performed here cannot be easily undone.</p>
            {!showDeleteConfirm ? (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="px-6 py-3.5 bg-red-50 hover:bg-red-600 hover:text-white border border-red-200 text-red-600 text-[10px] font-black uppercase tracking-[0.2em] transition-all rounded-none cursor-pointer"
              >
                Delete Product
              </button>
            ) : (
              <div className="p-6 bg-red-50 border border-red-200 max-w-xl space-y-4">
                <p className="text-xs font-bold text-red-800">
                  Are you sure you want to delete this product? This will perform a soft delete, and it will be moved to the trash ledger where it can be restored or purged later.
                </p>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await deleteProductAction(editProductId);
                      if (res.success) {
                        router.push("/admindashboard/inventory");
                      } else {
                        triggerToast(res.error || "Failed to delete product");
                        setShowDeleteConfirm(false);
                      }
                    }}
                    className="px-6 py-3 bg-red-600 text-white hover:bg-red-700 text-[10px] font-black uppercase tracking-[0.2em] transition-all border-none cursor-pointer"
                  >
                    Confirm Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-6 py-3 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 text-[10px] font-black uppercase tracking-[0.2em] transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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
