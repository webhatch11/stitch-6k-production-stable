"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Product } from "@/lib/registry";
import { getProductsAction } from "@/app/actions/admin-reads";
import {
  deleteProductAction,
  restoreProductAction,
  restockVariantAction,
  adjustProductSizeAction,
} from "@/app/actions/admin-products";

export default function InventoryLedgerPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [showTrash, setShowTrash] = useState(false);
  const [currentFilter, setCurrentFilter] = useState<"all" | "inStock" | "lowStock" | "outOfStock">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Custom Modal States
  const [modalType, setModalType] = useState<"delete" | "restock" | null>(null);
  const [targetProduct, setTargetProduct] = useState<Product | null>(null);
  const [restockQty, setRestockQty] = useState("10");
  const [selectedSize, setSelectedSize] = useState<"S" | "M" | "L" | "XL" | "XXL" | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");
  const [adjusting, setAdjusting] = useState<Record<string, boolean>>({});

  // Toast Alerts
  const [toastText, setToastText] = useState("");
  const [showToast, setShowToast] = useState(false);

  const triggerToast = (msg: string) => {
    setToastText(msg);
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 3000);
  };

  useEffect(() => {
    loadProducts();

    // Listen for storage events
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "registry_products") {
        loadProducts();
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showTrash]);

  const loadProducts = async () => {
    const res = await getProductsAction({ trashedOnly: showTrash });
    if (!res.success) {
      triggerToast(res.error || "Failed to load products");
      return;
    }
    setProducts(res.products || []);
  };

  const handleDeleteProduct = (p: Product) => {
    setTargetProduct(p);
    setModalType("delete");
  };

  const confirmDeleteProduct = async () => {
    if (!targetProduct) return;
    const res = await deleteProductAction(targetProduct.id);
    if (!res.success) {
      triggerToast(res.error || "Failed to delete product");
      return;
    }
    triggerToast("Product removed successfully");
    setModalType(null);
    setTargetProduct(null);
    router.refresh();
    await loadProducts();
  };

  const handleInlineAdjust = async (productId: string, size: "S" | "M" | "L" | "XL" | "XXL", diff: number) => {
    const adjustKey = `${productId}-${size}`;
    if (adjusting[adjustKey]) return; // Prevent double-clicks

    // Find the product and the current value
    const productIndex = products.findIndex(p => p.id === productId);
    if (productIndex === -1) return;

    const originalProducts = [...products];
    const targetProd = originalProducts[productIndex];
    const currentVal = targetProd.sizeStock?.[size] || 0;

    // Check if decrementing below 0
    if (diff < 0 && currentVal <= 0) return;

    // Optimistic UI Update: update the product size stock and total stock
    const newSizeStock = {
      ...targetProd.sizeStock,
      [size]: Math.max(0, currentVal + diff)
    } as any;

    const newTotalStock = Object.values(newSizeStock).reduce((sum: number, val: any) => sum + (val || 0), 0) as number;

    const updatedProducts = [...products];
    updatedProducts[productIndex] = {
      ...targetProd,
      sizeStock: newSizeStock,
      stock: newTotalStock
    };

    // Apply optimistic state
    setProducts(updatedProducts);
    setAdjusting(prev => ({ ...prev, [adjustKey]: true }));

    try {
      const res = await adjustProductSizeAction(productId, size, diff);
      if (!res.success) {
        // Rollback optimistic update
        setProducts(originalProducts);
        triggerToast(res.error || "Failed to save stock changes");
      } else {
        window.dispatchEvent(new Event("storage"));
        await loadProducts();
        triggerToast(`Adjusted size ${size} stock`);
      }
    } catch (err: any) {
      setProducts(originalProducts);
      triggerToast(err.message || "Failed to save stock changes");
    } finally {
      setAdjusting(prev => {
        const next = { ...prev };
        delete next[adjustKey];
        return next;
      });
    }
  };

  const handleRestockClick = (p: Product, size: "S" | "M" | "L" | "XL" | "XXL") => {
    setTargetProduct(p);
    setSelectedSize(size);
    setRestockQty("10");
    setModalType("restock");
  };

  // Filter products based on search keyword and active status tab
  const filteredProducts = products.filter((p) => {
    // Tab filter logic
    if (currentFilter === "inStock" && (p.stock || 0) <= 10) return false;
    if (currentFilter === "lowStock" && ((p.stock || 0) <= 0 || (p.stock || 0) > 10)) return false;
    if (currentFilter === "outOfStock" && (p.stock || 0) > 0) return false;

    // Search query logic
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchTitle = (p.title || "").toLowerCase().includes(q);
      const matchSKU = (p.id || "").toLowerCase().includes(q);
      const matchCategory = (p.category || "").toLowerCase().includes(q);
      return matchTitle || matchSKU || matchCategory;
    }
    return true;
  });

  // Pagination logic
  const totalItems = filteredProducts.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const activePage = currentPage > totalPages ? totalPages : currentPage;
  
  const startIndex = (activePage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

  const getStockStatusStyle = (stock: number) => {
    if (stock > 10) return "bg-green-50 text-green-700 border border-green-200/50";
    if (stock > 0) return "bg-yellow-50 text-yellow-700 border border-yellow-200/50";
    return "bg-red-50 text-red-700 border border-red-200/50";
  };

  const getStockStatusText = (stock: number) => {
    if (stock > 10) return "In Stock";
    if (stock > 0) return "Low Stock";
    return "Out of Stock";
  };

  return (
    <div className="p-8 lg:p-16 relative">
      <style>{`
        @keyframes pulse-gold {
          0%, 100% { box-shadow: 0 0 0 0 rgba(186,117,23,0.6); }
          50% { box-shadow: 0 0 0 6px rgba(186,117,23,0); }
        }
        .pulse-gold-btn {
          animation: pulse-gold 1.6s ease-in-out infinite;
        }
      `}</style>
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-6 right-6 z-[1000] bg-black text-white py-4 px-6 text-[10px] font-bold uppercase tracking-[0.2em] shadow-2xl border border-white/10 animate-fade-in">
          {toastText}
        </div>
      )}

      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8 mb-16">
        <div>
          <nav className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">
            <span>Admin Panel</span>
            <span className="material-symbols-outlined text-sm opacity-30">chevron_right</span>
            <span className="text-[#0a0a0a] italic">Inventory</span>
          </nav>
          <h2 className="text-5xl font-headline font-black tracking-tighter text-[#0a0a0a] uppercase leading-none">Inventory Ledger</h2>
          <p className="text-xs text-gray-500 mt-4 font-bold uppercase tracking-widest italic opacity-70">
            A comprehensive record of shop inventory, SKUs, and stock levels.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
          <div className="relative group">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg group-focus-within:text-secondary transition-colors">
              search
            </span>
            <input
              type="text"
              placeholder="Search SKU or name..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-12 pr-6 py-3.5 bg-white border border-gray-200 text-[10px] font-bold uppercase tracking-widest focus:border-[#0a0a0a] focus:ring-0 outline-none w-full sm:w-72 shadow-sm rounded-none"
            />
          </div>
          <button
            type="button"
            onClick={() => { setShowTrash(!showTrash); setCurrentPage(1); }}
            className={`px-5 py-3.5 text-[10px] font-black uppercase tracking-widest border-2 transition-all whitespace-nowrap rounded-none flex items-center gap-2 ${
              showTrash
                ? "bg-red-600 text-white border-red-600"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
            }`}
          >
            <span className="material-symbols-outlined text-sm">delete</span>
            {showTrash ? "Showing Trash" : "View Trash"}
          </button>
          <Link
            href="/admindashboard/add-product"
            className="bg-primary text-white hover:bg-secondary px-8 py-3.5 text-xs font-black uppercase tracking-[0.2em] transition-all shadow-lg flex items-center justify-center gap-2 whitespace-nowrap rounded-none"
          >
            <span className="material-symbols-outlined text-sm">add</span> Add Product
          </Link>
        </div>
      </header>

      {/* Inventory Ledger Table */}
      <div className="bg-white border border-gray-200 shadow-sm overflow-hidden rounded-none">
        <div className="p-8 border-b border-gray-200 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 bg-[#fafafa]">
          <div className="flex gap-6 overflow-x-auto pb-2 sm:pb-0">
            {(["all", "inStock", "lowStock", "outOfStock"] as const).map((filterKey) => (
              <button
                key={filterKey}
                onClick={() => {
                  setCurrentFilter(filterKey);
                  setCurrentPage(1);
                }}
                className={`text-[10px] font-black uppercase tracking-[0.3em] pb-2 whitespace-nowrap bg-transparent border-t-0 border-x-0 cursor-pointer transition-colors ${
                  currentFilter === filterKey
                    ? "text-[#0a0a0a] border-b-2 border-[#fed488]"
                    : "text-gray-400 hover:text-[#0a0a0a] border-b-2 border-transparent"
                }`}
              >
                {filterKey === "all"
                  ? "All Products"
                  : filterKey === "inStock"
                  ? "In Stock"
                  : filterKey === "lowStock"
                  ? "Low Stock"
                  : "Out of Stock"}
              </button>
            ))}
          </div>
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 italic opacity-85">
            Showing {totalItems} products in inventory
          </p>
        </div>

        {/* Desktop View Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-500 border-b border-gray-200 bg-white">
                <th className="p-6 w-24">Image</th>
                <th className="p-6">Product Details</th>
                <th className="p-6">Price</th>
                <th className="p-6">Stock Status</th>
                <th className="p-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-xs font-semibold">
              {totalItems === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-[10px] font-black uppercase tracking-widest text-gray-400 opacity-40">
                    No products found in database inventory.
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((p) => {
                  const stockCount = p.stock || 0;
                  const pImage = p.image || "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&q=80&w=200";
                  const isDeleted = !!p.deleted_at;

                  return (
                    <tr key={p.id} className={`group border-b border-gray-100 hover:bg-[#fafafa] transition-colors animate-fade-in ${isDeleted ? "opacity-50" : ""}`}>
                      <td className="p-6">
                        <div className={`size-16 bg-white border border-gray-200 p-1 rounded-none overflow-hidden transition-all ${
                          stockCount > 0 && !isDeleted ? "" : "grayscale opacity-60 border-red-200"
                        }`}>
                          <img src={pImage} className="w-full h-full object-cover" alt={p.title} />
                        </div>
                      </td>
                      <td className="p-6">
                        <p className="text-xs font-black uppercase tracking-widest text-primary">{p.title}</p>
                        <p className="text-[10px] text-gray-400 font-bold mt-1 uppercase tracking-wide">
                          SKU: {p.id || "N/A"} • {p.category || "General"}
                        </p>
                        {isDeleted && (
                          <span className="text-red-600 text-[9px] font-black uppercase tracking-widest">TRASHED</span>
                        )}
                      </td>
                      <td className="p-6 font-headline font-black text-sm">
                        ₹{(p.price || 0).toLocaleString("en-IN")}.00
                      </td>
                      <td className="p-6">
                        {!isDeleted ? (
                          <div className="flex flex-col gap-2.5">
                            <div className="flex items-center gap-3">
                              <span className={`px-2.5 py-0.5 ${getStockStatusStyle(stockCount)} text-[8px] font-black uppercase tracking-widest rounded-none`}>
                                {getStockStatusText(stockCount)}
                              </span>
                              <span className="text-xs font-black">Total: <strong className="font-mono">{stockCount}</strong></span>
                            </div>                            {/* Per-size row list layout */}
                            <div className="flex flex-col gap-2 mt-2.5 max-w-md">
                              {(["S", "M", "L", "XL", "XXL"] as const).map((size) => {
                                const currentVal = p.sizeStock?.[size] || 0;
                                const adjustKey = `${p.id}-${size}`;
                                const isAdjusting = adjusting[adjustKey];
                                return (
                                  <div key={size} className="flex items-center justify-between border border-gray-200/60 bg-[#fafafa]/30 p-1.5 rounded-none select-none text-[10px]">
                                    <div className="flex items-center gap-2">
                                      <span className="font-black px-2 py-0.5 bg-[#f0f0f0] text-primary rounded-none min-w-[28px] text-center">{size}</span>
                                      <div className="flex items-center border border-gray-200 bg-white p-0.5 rounded-none">
                                        <button
                                          onClick={() => handleInlineAdjust(p.id, size, -1)}
                                          disabled={currentVal <= 0 || isAdjusting}
                                          className="px-1.5 text-gray-500 hover:text-red-600 disabled:opacity-30 disabled:pointer-events-none bg-transparent border-none cursor-pointer text-xs font-bold"
                                        >
                                          -
                                        </button>
                                        <span className="font-mono px-2 min-w-[16px] text-center font-bold">{currentVal}</span>
                                        <button
                                          onClick={() => handleInlineAdjust(p.id, size, 1)}
                                          disabled={isAdjusting}
                                          className="px-1.5 text-gray-500 hover:text-green-600 disabled:opacity-30 disabled:pointer-events-none bg-transparent border-none cursor-pointer text-xs font-bold"
                                        >
                                          +
                                        </button>
                                      </div>
                                    </div>
                                    <button
                                      onClick={() => handleRestockClick(p, size)}
                                      disabled={isSubmitting || isAdjusting}
                                      title={`Restock ${size}`}
                                      className={`flex items-center justify-center cursor-pointer select-none transition-all duration-300 border-none active:scale-90 disabled:opacity-30 disabled:pointer-events-none ${
                                        currentVal <= 2 && !isSubmitting && !isAdjusting ? "pulse-gold-btn" : ""
                                      }`}
                                      style={
                                        currentVal > 2
                                          ? { backgroundColor: "#f5f0e0", color: "#7a5c00", width: "26px", height: "26px", borderRadius: "50%" }
                                          : { backgroundColor: "#BA7517", color: "#ffffff", width: "26px", height: "26px", borderRadius: "50%" }
                                      }
                                    >
                                      <span className="material-symbols-outlined text-xs select-none">sync</span>
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">—</span>
                        )}
                      </td>
                      <td className="p-6 text-right">
                        <div className="flex justify-end gap-2">
                          {isDeleted ? (
                            <button
                              type="button"
                              onClick={async () => {
                                const result = await restoreProductAction(p.id);
                                if (result.success) {
                                  router.refresh();
                                  const r = await getProductsAction({ trashedOnly: showTrash });
                                  if (r.success) setProducts(r.products || []);
                                } else {
                                  triggerToast(result.error || "Failed to restore");
                                }
                              }}
                              className="px-3 py-1.5 bg-green-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-green-700 transition-colors border-none cursor-pointer rounded-none"
                            >
                              Restore
                            </button>
                          ) : (
                            <>
                              <Link
                                href={`/admindashboard/add-product?edit=${p.id}`}
                                className="p-2 text-primary hover:bg-[#fed488]/20 hover:text-secondary transition-colors inline-block rounded-none border border-transparent hover:border-secondary/10"
                                title="Edit"
                              >
                                <span className="material-symbols-outlined text-lg flex items-center justify-center">edit</span>
                              </Link>
                              <button
                                onClick={() => handleDeleteProduct(p)}
                                className="p-2 text-red-500 hover:bg-red-50 transition-colors inline-block rounded-none border border-transparent bg-transparent cursor-pointer"
                                title="Delete"
                              >
                                <span className="material-symbols-outlined text-lg flex items-center justify-center">delete</span>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View Stacked Cards */}
        <div className="md:hidden divide-y divide-gray-200">
          {totalItems === 0 ? (
            <div className="p-12 text-center text-[10px] font-black uppercase tracking-widest text-gray-400 opacity-40">
              No products found in database inventory.
            </div>
          ) : (
            paginatedProducts.map((p) => {
              const stockCount = p.stock || 0;
              const pImage = p.image || "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&q=80&w=200";
              const isDeleted = !!p.deleted_at;

              return (
                <div key={p.id} className={`p-6 hover:bg-[#fafafa] transition-colors flex flex-col gap-4 animate-fade-in ${isDeleted ? "opacity-50" : ""}`}>
                  <div className="flex gap-4">
                    <div className={`size-16 bg-white border border-gray-200 p-1 rounded-none overflow-hidden shrink-0 transition-all ${
                      stockCount > 0 && !isDeleted ? "" : "grayscale opacity-60 border-red-200"
                    }`}>
                      <img src={pImage} className="w-full h-full object-cover" alt={p.title} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black uppercase tracking-widest text-primary truncate">{p.title}</p>
                      <p className="text-[10px] text-gray-400 font-bold mt-1 uppercase tracking-wide">
                        SKU: {p.id || "N/A"} • {p.category || "General"}
                      </p>
                      <p className="font-headline font-black text-sm mt-1 text-secondary">
                        ₹{(p.price || 0).toLocaleString("en-IN")}.00
                      </p>
                      {isDeleted && (
                        <span className="text-red-600 text-[9px] font-black uppercase tracking-widest">TRASHED</span>
                      )}
                    </div>
                  </div>

                  {/* Stock and Inline Adjustments — hidden for trashed products */}
                  {!isDeleted && (
                    <div className="space-y-3 pt-2 border-t border-gray-100">
                      <div className="flex items-center justify-between">
                        <span className={`px-2.5 py-0.5 ${getStockStatusStyle(stockCount)} text-[8px] font-black uppercase tracking-widest rounded-none`}>
                          {getStockStatusText(stockCount)}
                        </span>
                        <span className="text-xs font-black">Total Stock: <strong className="font-mono">{stockCount}</strong></span>
                      </div>

                      <div className="flex flex-col gap-2 mt-1 max-w-md">
                        {(["S", "M", "L", "XL", "XXL"] as const).map((size) => {
                          const currentVal = p.sizeStock?.[size] || 0;
                          const adjustKey = `${p.id}-${size}`;
                          const isAdjusting = adjusting[adjustKey];
                          return (
                            <div key={size} className="flex items-center justify-between border border-gray-200/60 bg-[#fafafa]/30 p-1.5 rounded-none select-none text-[10px]">
                              <div className="flex items-center gap-2">
                                <span className="font-black px-2 py-0.5 bg-[#f0f0f0] text-primary rounded-none min-w-[28px] text-center">{size}</span>
                                <div className="flex items-center border border-gray-200 bg-white p-0.5 rounded-none">
                                  <button
                                    onClick={() => handleInlineAdjust(p.id, size, -1)}
                                    disabled={currentVal <= 0 || isAdjusting}
                                    className="px-1.5 text-gray-500 hover:text-red-600 disabled:opacity-30 disabled:pointer-events-none bg-transparent border-none cursor-pointer text-xs font-bold"
                                  >
                                    -
                                  </button>
                                  <span className="font-mono px-2 min-w-[16px] text-center font-bold">{currentVal}</span>
                                  <button
                                    onClick={() => handleInlineAdjust(p.id, size, 1)}
                                    disabled={isAdjusting}
                                    className="px-1.5 text-gray-500 hover:text-green-600 disabled:opacity-30 disabled:pointer-events-none bg-transparent border-none cursor-pointer text-xs font-bold"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                               <button
                                onClick={() => handleRestockClick(p, size)}
                                disabled={isSubmitting || isAdjusting}
                                title={`Restock ${size}`}
                                className={`flex items-center justify-center cursor-pointer select-none transition-all duration-300 border-none active:scale-90 disabled:opacity-30 disabled:pointer-events-none ${
                                  currentVal <= 2 && !isSubmitting && !isAdjusting ? "pulse-gold-btn" : ""
                                }`}
                                style={
                                  currentVal > 2
                                    ? { backgroundColor: "#f5f0e0", color: "#7a5c00", width: "26px", height: "26px", borderRadius: "50%" }
                                    : { backgroundColor: "#BA7517", color: "#ffffff", width: "26px", height: "26px", borderRadius: "50%" }
                                }
                              >
                                <span className="material-symbols-outlined text-xs select-none">sync</span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                    {isDeleted ? (
                      <button
                        type="button"
                        onClick={async () => {
                          const result = await restoreProductAction(p.id);
                          if (result.success) {
                            router.refresh();
                            const r = await getProductsAction({ trashedOnly: showTrash });
                            if (r.success) setProducts(r.products || []);
                          } else {
                            triggerToast(result.error || "Failed to restore");
                          }
                        }}
                        className="px-3 py-1.5 bg-green-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-green-700 transition-colors border-none cursor-pointer rounded-none"
                      >
                        Restore
                      </button>
                    ) : (
                      <>
                        <Link
                          href={`/admindashboard/add-product?edit=${p.id}`}
                          className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-primary border border-gray-200 px-3 py-1.5 font-bold"
                        >
                          <span className="material-symbols-outlined text-sm">edit</span>
                          Edit
                        </Link>
                        <button
                          onClick={() => handleDeleteProduct(p)}
                          className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-red-500 border border-red-200 px-3 py-1.5 bg-transparent cursor-pointer font-bold"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Ledger Pagination */}
        <div className="px-10 py-8 bg-[#fafafa] border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
            Showing {totalItems > 0 ? startIndex + 1 : 0} - {endIndex} of {totalItems} Products
          </p>
          <div className="flex gap-2 font-bold font-mono">
            <button
              disabled={activePage === 1}
              onClick={() => setCurrentPage(activePage - 1)}
              className={`size-10 flex items-center justify-center border border-gray-200 bg-white transition-all rounded-none cursor-pointer ${
                activePage === 1 ? "opacity-30 cursor-not-allowed" : "hover:bg-[#fed488] hover:text-primary"
              }`}
            >
              <span className="material-symbols-outlined text-base">chevron_left</span>
            </button>
            {Array.from({ length: totalPages }).map((_, i) => {
              const pNum = i + 1;
              return (
                <button
                  key={pNum}
                  onClick={() => setCurrentPage(pNum)}
                  className={`size-10 flex items-center justify-center border text-[10px] font-black tracking-widest transition-all rounded-none cursor-pointer ${
                    pNum === activePage
                      ? "bg-primary border-primary text-white"
                      : "bg-white border-gray-200 text-primary hover:bg-gray-50"
                  }`}
                >
                  {pNum}
                </button>
              );
            })}
            <button
              disabled={activePage === totalPages}
              onClick={() => setCurrentPage(activePage + 1)}
              className={`size-10 flex items-center justify-center border border-gray-200 bg-white transition-all rounded-none cursor-pointer ${
                activePage === totalPages ? "opacity-30 cursor-not-allowed" : "hover:bg-[#fed488] hover:text-primary"
              }`}
            >
              <span className="material-symbols-outlined text-base">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      {/* Custom UI Modals */}
      {modalType && (
        <div className="absolute inset-0 z-[2000] min-h-[400px] bg-[#0a0a0a]/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border border-[#775a19]/20 shadow-2xl p-8 max-w-sm w-full space-y-6 text-center rounded-none animate-zoom-in">
            {modalType === "delete" && (
              <>
                <div className="mx-auto w-12 h-12 rounded-full border border-red-200 bg-red-50 flex items-center justify-center text-red-600">
                  <span className="material-symbols-outlined text-xl">delete</span>
                </div>
                <div className="space-y-2">
                  <h3 className="font-headline font-black text-sm uppercase tracking-wider text-primary">Remove Product</h3>
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold leading-relaxed">
                    Are you sure you want to remove <span className="text-[#0a0a0a] font-black">"{targetProduct?.title}"</span> from the inventory?
                  </p>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setModalType(null)}
                    className="flex-1 px-4 py-3 bg-white border border-gray-200 text-gray-500 hover:text-[#0a0a0a] text-[10px] font-black uppercase tracking-widest transition-colors cursor-pointer rounded-none"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmDeleteProduct}
                    className="flex-1 px-4 py-3 bg-red-600 text-white hover:bg-red-700 text-[10px] font-black uppercase tracking-widest transition-colors cursor-pointer rounded-none border-none font-bold"
                  >
                    Remove
                  </button>
                </div>
              </>
            )}
            {modalType === "restock" && targetProduct && selectedSize && (() => {
              const currentStock = targetProduct.sizeStock?.[selectedSize] || 0;
              const inputQty = parseInt(restockQty) || 0;
              const resultingStock = currentStock + (inputQty >= 0 ? inputQty : 0);

              const current = currentStock;
              const addQty = inputQty >= 0 ? inputQty : 0;
              const maxScale = Math.max(current + addQty, current * 2, 10);
              const currentWidth = (current / maxScale) * 100 + "%";
              const addWidth = (addQty / maxScale) * 100 + "%";

              return (
                <>
                  <div className="space-y-1.5 text-center">
                    <h3 className="text-[15px] font-medium tracking-wide text-primary uppercase">Restock variant</h3>
                    <p className="text-[12px] text-gray-400 lowercase tracking-wide italic">Adjust incoming stock for this size only</p>
                  </div>

                  {modalError && (
                    <div className="bg-red-50 text-red-600 border border-red-100 p-2 text-[10px] font-bold uppercase tracking-wider text-center">
                      {modalError}
                    </div>
                  )}

                  {/* Meta chips row */}
                  <div className="flex gap-2 justify-center flex-wrap">
                    <span className="bg-[#faf9f8] border border-[#d1c5b4]/50 rounded-[6px] px-2.5 py-1 text-[12px] font-bold text-gray-600">
                      Product: {targetProduct.title}
                    </span>
                    <span className="bg-[#faf9f8] border border-[#d1c5b4]/50 rounded-[6px] px-2.5 py-1 text-[12px] font-bold text-gray-600">
                      Size: {selectedSize}
                    </span>
                    <span className="bg-[#faf9f8] border border-[#d1c5b4]/50 rounded-[6px] px-2.5 py-1 text-[12px] font-bold text-gray-600">
                      Current: {currentStock}
                    </span>
                  </div>

                  {/* Stock progress visualizer */}
                  <div className="space-y-1.5 text-left">
                    <div className="flex justify-between text-[11px] text-gray-400 font-bold uppercase tracking-widest">
                      <span>Current stock</span>
                      <span>After restock</span>
                    </div>
                    <div className="w-full h-2 rounded-[6px] bg-[#faf9f8] border border-gray-100 flex overflow-hidden">
                      <div
                        className="h-full bg-gray-300"
                        style={{ width: currentWidth, transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)" }}
                      />
                      <div
                        className="h-full"
                        style={{ backgroundColor: "#BA7517", width: addWidth, transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)" }}
                      />
                    </div>
                  </div>

                  {/* Quantity input row */}
                  <div className="flex justify-between items-center py-1">
                    <span className="text-[13px] font-bold text-gray-600 uppercase tracking-wide">Add quantity</span>
                    <input
                      type="number"
                      min="1"
                      value={restockQty}
                      onChange={(e) => {
                        setRestockQty(e.target.value);
                        setModalError("");
                      }}
                      disabled={isSubmitting}
                      className="w-[80px] text-center bg-white border border-gray-200 p-1.5 text-xs font-black outline-none focus:border-secondary rounded-none"
                      autoFocus
                    />
                  </div>

                  {/* Resulting stock display */}
                  <div className="flex justify-between items-center p-3 border border-[#e8d08a] bg-[#faf5e8]">
                    <span className="text-[12px] font-bold tracking-wider text-[#7a5c00] uppercase">Resulting stock</span>
                    <span className="text-[18px] font-bold text-[#4a3500] font-mono">{resultingStock}</span>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setModalType(null);
                        setSelectedSize(null);
                        setModalError("");
                      }}
                      disabled={isSubmitting}
                      className="flex-1 px-4 py-3 bg-white border border-gray-200 text-gray-500 hover:text-[#0a0a0a] text-[10px] font-black uppercase tracking-widest transition-colors cursor-pointer rounded-none disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={async () => {
                        if (isSubmitting) return;
                        setModalError("");
                        const qty = parseInt(restockQty);
                        if (isNaN(qty) || qty <= 0) {
                          setModalError("Please enter a valid positive number.");
                          return;
                        }
                        setIsSubmitting(true);
                        try {
                          const res = await restockVariantAction(targetProduct.id, selectedSize, qty);
                          if (!res.success) {
                            setModalError(res.error || "Restock failed");
                          } else {
                            // Update local state directly for responsive feedback
                            const productIndex = products.findIndex(p => p.id === targetProduct.id);
                            if (productIndex !== -1) {
                              const updatedProducts = [...products];
                              const newSizeStock = {
                                ...targetProduct.sizeStock,
                                [selectedSize]: currentStock + qty
                              } as any;
                              const newTotalStock = Object.values(newSizeStock).reduce((sum: number, val: any) => sum + (val || 0), 0) as number;

                              updatedProducts[productIndex] = {
                                ...targetProduct,
                                sizeStock: newSizeStock,
                                stock: newTotalStock
                              };
                              setProducts(updatedProducts);
                            }
                            window.dispatchEvent(new Event("storage"));
                            await loadProducts();
                            triggerToast(`Restocked +${qty} units to size ${selectedSize}`);
                            setModalType(null);
                            setTargetProduct(null);
                            setSelectedSize(null);
                          }
                        } catch (err: any) {
                          setModalError(err.message || "An unexpected error occurred");
                        } finally {
                          setIsSubmitting(false);
                        }
                      }}
                      className="flex-[2] bg-[#BA7517] text-white hover:bg-[#a6620f] text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer rounded-none border-none font-bold disabled:opacity-50 flex items-center justify-center gap-1.5"
                      style={{ backgroundColor: "#BA7517" }}
                    >
                      {isSubmitting ? (
                        <>
                          <span className="animate-spin border-2 border-white border-t-transparent rounded-full size-3 inline-block" />
                          Restocking…
                        </>
                      ) : (
                        "Confirm restock"
                      )}
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
