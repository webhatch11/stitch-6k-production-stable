"use client";

import React, { useState, useEffect, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { saveProductAction } from "@/app/actions/admin-products";
import { getProductsAction } from "@/app/actions/admin-reads";
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
  const [gstRate, setGstRate] = useState(12);
  const [discountRate, setDiscountRate] = useState(0);

  // 4-slot image grid: index 0 = primary cover, 1-3 = secondary images
  const [selectedImages, setSelectedImages] = useState<string[]>(["", "", "", ""]);
  // Ref (not state) — onUpload callback closure must read the LATEST
  // target slot, not the value captured at render time.
  const pendingSlotRef = useRef<number | null>(null);
  // Ref to the single Cloudinary widget instance for the entire page
  const cloudinaryRef = useRef<CloudinaryUploadHandle>(null);

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

  // Defensive cleanup: restore body scroll if Cloudinary widget leaves it locked
  useEffect(() => {
    return () => {
      if (typeof document !== "undefined") {
        document.body.style.overflow = "";
      }
    };
  }, []);

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
          setGstRate(p.gstRate || 12);
          setDiscountRate(p.discountRate || 0);

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
              color: p.colors?.[0] || "Atelier Choice",
              sku: `${p.id || "PROD"}-${size}-${(p.colors?.[0] || "ATL").slice(0, 3).toUpperCase()}`,
              price: p.basePrice || 0,
              stock: 0,
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
    }),
    useSensor(KeyboardSensor)
  );

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

    // Collect images — filter empty slots; slot order = save order
    let productImages = selectedImages.filter((url) => url && url.trim().length > 0);

    if (productImages.length === 0) {
      productImages = [
        "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&q=80&w=600",
      ];
    }

    const primaryImage = productImages[0];

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
      variants,
      display_sections: displaySections,
    };

    try {
      if (!editProductId) {
        const listRes = await getProductsAction();
        const list = listRes.success ? (listRes.products || []) : [];
        const exists = list.some((prod) => prod.id === finalSKU);
        if (exists) {
          triggerToast("SKU already exists. Please choose a unique SKU reference.");
          return;
        }
      }
      const result = await saveProductAction(input);
      if (!result.success) {
        triggerToast(result.error || "Failed to save product");
        return;
      }
      router.refresh();
      setSuccessModalText(editProductId ? "Product updated successfully!" : "Product created successfully!");
    } catch (e: any) {
      console.error(e);
      triggerToast("Failed to save product details");
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
                      New Arrivals Section
                    </label>
                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wide">
                      Show this product in the "New Arrivals" Coverflow slider on the homepage.
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
                      Atelier Exclusives Section
                    </label>
                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wide">
                      Show this product in the "Atelier Exclusives" grid/section on the homepage.
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
                      Bestsellers Section
                    </label>
                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wide">
                      Show this product in the "Bestsellers" grid/section on the homepage.
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
                      Show on Gen Z page
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
          {/* Section 06: Variants Matrix */}
          <div className="border-b border-gray-100 pb-12 grid grid-cols-1 lg:grid-cols-12 gap-12">
            <div className="lg:col-span-4">
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-[#775a19] mb-4 block">
                Section 06
              </span>
              <h3 className="font-headline font-black text-xl uppercase tracking-widest text-primary">
                Variants
              </h3>
              <p className="text-xs text-gray-500 mt-4 leading-relaxed font-semibold uppercase tracking-wider italic opacity-85">
                Define size × color combinations. Each variant has its own SKU,
                price, and stock count.
              </p>
            </div>

            <div className="lg:col-span-8">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-y-2 border-gray-200">
                    <tr>
                      <th className="px-3 py-2 text-left text-[9px] font-black uppercase tracking-widest text-gray-600">Size</th>
                      <th className="px-3 py-2 text-left text-[9px] font-black uppercase tracking-widest text-gray-600">Color</th>
                      <th className="px-3 py-2 text-left text-[9px] font-black uppercase tracking-widest text-gray-600">SKU</th>
                      <th className="px-3 py-2 text-left text-[9px] font-black uppercase tracking-widest text-gray-600">Price (₹)</th>
                      <th className="px-3 py-2 text-left text-[9px] font-black uppercase tracking-widest text-gray-600">Stock</th>
                      <th className="px-3 py-2 text-right text-[9px] font-black uppercase tracking-widest text-gray-600">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variants.map((v, idx) => (
                      <tr key={idx} className="border-b border-gray-100">
                        <td className="px-3 py-2">
                          <select
                            value={v.size}
                            onChange={(e) => {
                              const next = [...variants];
                              next[idx] = { ...next[idx], size: e.target.value };
                              setVariants(next);
                            }}
                            className="border border-gray-300 px-2 py-1 text-xs"
                          >
                            {SIZE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={v.color}
                            onChange={(e) => {
                              const next = [...variants];
                              next[idx] = { ...next[idx], color: e.target.value };
                              setVariants(next);
                            }}
                            className="border border-gray-300 px-2 py-1 text-xs w-24"
                            placeholder="Color"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={v.sku}
                            onChange={(e) => {
                              const next = [...variants];
                              next[idx] = { ...next[idx], sku: e.target.value };
                              setVariants(next);
                            }}
                            className="border border-gray-300 px-2 py-1 text-xs w-32"
                            placeholder="SKU"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={v.price}
                            onChange={(e) => {
                              const next = [...variants];
                              next[idx] = { ...next[idx], price: Number(e.target.value) || 0 };
                              setVariants(next);
                            }}
                            className="border border-gray-300 px-2 py-1 text-xs w-20"
                            min={0}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={v.stock}
                            onChange={(e) => {
                              const next = [...variants];
                              next[idx] = { ...next[idx], stock: Number(e.target.value) || 0 };
                              setVariants(next);
                            }}
                            className="border border-gray-300 px-2 py-1 text-xs w-20"
                            min={0}
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => setVariants(variants.filter((_, i) => i !== idx))}
                            className="px-2 py-1 bg-red-600 text-white text-[9px] font-black uppercase border-none cursor-pointer"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                type="button"
                onClick={() => {
                  setVariants([
                    ...variants,
                    {
                      size: "M",
                      color: "",
                      sku: "",
                      price: basePrice,
                      stock: 0,
                    },
                  ]);
                }}
                className="mt-4 px-4 py-2 bg-[#fed488] text-[#775a19] text-[10px] font-black uppercase tracking-widest hover:bg-[#fbb850] transition-colors border-none cursor-pointer"
              >
                + Add Variant
              </button>
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
