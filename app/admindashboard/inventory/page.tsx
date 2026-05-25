"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { RegistryManager, Product } from "@/lib/registry";

export default function InventoryLedgerPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [currentFilter, setCurrentFilter] = useState<"all" | "inStock" | "lowStock" | "outOfStock">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

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
    RegistryManager.init();
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
  }, []);

  const loadProducts = () => {
    setProducts(RegistryManager.getProducts());
  };

  const handleDeleteProduct = (id: string) => {
    if (confirm("Are you sure you want to remove this product from the inventory?")) {
      RegistryManager.deleteProduct(id);
      triggerToast("Product removed successfully");
      loadProducts();
    }
  };

  const handleInlineAdjust = (productId: string, size: "S" | "M" | "L" | "XL" | "XXL", diff: number) => {
    const allProducts = RegistryManager.getProducts();
    const idx = allProducts.findIndex((p) => p.id === productId);
    if (idx !== -1) {
      const p = allProducts[idx];
      const currentSizeStock = p.sizeStock || {};
      const currentVal = currentSizeStock[size] || 0;
      const newVal = Math.max(0, currentVal + diff);
      
      const newSizeStock = {
        ...currentSizeStock,
        [size]: newVal
      };
      
      // Recalculate total stock count
      const newTotal =
        (newSizeStock.S || 0) +
        (newSizeStock.M || 0) +
        (newSizeStock.L || 0) +
        (newSizeStock.XL || 0) +
        (newSizeStock.XXL || 0);
      
      allProducts[idx] = {
        ...p,
        sizeStock: newSizeStock,
        stock: newTotal
      };
      
      localStorage.setItem("registry_products", JSON.stringify(allProducts));
      window.dispatchEvent(new Event("storage"));
      loadProducts();
      triggerToast(`Adjusted size ${size} stock for ${p.title}`);
    }
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
    <div className="p-8 lg:p-16">
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

                  return (
                    <tr key={p.id} className="group border-b border-gray-100 hover:bg-[#fafafa] transition-colors animate-fade-in">
                      <td className="p-6">
                        <div className="size-16 bg-white border border-gray-200 p-1 grayscale group-hover:grayscale-0 transition-all rounded-none overflow-hidden">
                          <img src={pImage} className="w-full h-full object-cover" alt={p.title} />
                        </div>
                      </td>
                      <td className="p-6">
                        <p className="text-xs font-black uppercase tracking-widest text-primary">{p.title}</p>
                        <p className="text-[10px] text-gray-400 font-bold mt-1 uppercase tracking-wide">
                          SKU: {p.id || "N/A"} • {p.category || "General"}
                        </p>
                      </td>
                      <td className="p-6 font-headline font-black text-sm">
                        ₹{(p.price || 0).toLocaleString("en-IN")}.00
                      </td>
                      <td className="p-6">
                        <div className="flex flex-col gap-2.5">
                          <div className="flex items-center gap-3">
                            <span className={`px-2.5 py-0.5 ${getStockStatusStyle(stockCount)} text-[8px] font-black uppercase tracking-widest rounded-none`}>
                              {getStockStatusText(stockCount)}
                            </span>
                            <span className="text-xs font-black">Total: <strong className="font-mono">{stockCount}</strong></span>
                          </div>
                          
                          {/* Sizing Stock Modification Sub-grid */}
                          <div className="flex gap-2 flex-wrap max-w-xs mt-1 text-[10px]">
                            {(["S", "M", "L", "XL", "XXL"] as const).map((size) => {
                              const currentVal = p.sizeStock?.[size] || 0;
                              return (
                                <div key={size} className="flex items-center border border-gray-200 bg-white shadow-sm p-1 rounded-none select-none">
                                  <span className="font-black px-1.5 border-r border-gray-100">{size}</span>
                                  <button
                                    onClick={() => handleInlineAdjust(p.id, size, -1)}
                                    className="px-1 text-gray-500 hover:text-red-600 bg-transparent border-none cursor-pointer text-xs font-bold"
                                  >
                                    -
                                  </button>
                                  <span className="font-mono px-1 min-w-[12px] text-center font-bold">{currentVal}</span>
                                  <button
                                    onClick={() => handleInlineAdjust(p.id, size, 1)}
                                    className="px-1 text-gray-500 hover:text-green-600 bg-transparent border-none cursor-pointer text-xs font-bold"
                                  >
                                    +
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </td>
                      <td className="p-6 text-right">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/admindashboard/add-product?edit=${p.id}`}
                            className="p-2 text-primary hover:bg-[#fed488]/20 hover:text-secondary transition-colors inline-block rounded-none border border-transparent hover:border-secondary/10"
                            title="Edit"
                          >
                            <span className="material-symbols-outlined text-lg flex items-center justify-center">edit</span>
                          </Link>
                          <button
                            onClick={() => handleDeleteProduct(p.id)}
                            className="p-2 text-red-500 hover:bg-red-50 transition-colors inline-block rounded-none border border-transparent bg-transparent cursor-pointer"
                            title="Delete"
                          >
                            <span className="material-symbols-outlined text-lg flex items-center justify-center">delete</span>
                          </button>
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

              return (
                <div key={p.id} className="p-6 hover:bg-[#fafafa] transition-colors flex flex-col gap-4 animate-fade-in">
                  <div className="flex gap-4">
                    <div className="size-16 bg-white border border-gray-200 p-1 rounded-none overflow-hidden shrink-0">
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
                    </div>
                  </div>
                  
                  {/* Stock and Inline Adjustments */}
                  <div className="space-y-3 pt-2 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                      <span className={`px-2.5 py-0.5 ${getStockStatusStyle(stockCount)} text-[8px] font-black uppercase tracking-widest rounded-none`}>
                        {getStockStatusText(stockCount)}
                      </span>
                      <span className="text-xs font-black">Total Stock: <strong className="font-mono">{stockCount}</strong></span>
                    </div>

                    <div className="flex gap-1.5 flex-wrap text-[10px]">
                      {(["S", "M", "L", "XL", "XXL"] as const).map((size) => {
                        const currentVal = p.sizeStock?.[size] || 0;
                        return (
                          <div key={size} className="flex items-center border border-gray-200 bg-white p-1 rounded-none select-none flex-1 justify-between min-w-[50px]">
                            <span className="font-black px-1 border-r border-gray-100">{size}</span>
                            <button
                              onClick={() => handleInlineAdjust(p.id, size, -1)}
                              className="px-0.5 text-gray-500 hover:text-red-600 bg-transparent border-none cursor-pointer text-xs font-bold"
                            >
                              -
                            </button>
                            <span className="font-mono px-0.5 min-w-[10px] text-center font-bold">{currentVal}</span>
                            <button
                              onClick={() => handleInlineAdjust(p.id, size, 1)}
                              className="px-0.5 text-gray-500 hover:text-green-600 bg-transparent border-none cursor-pointer text-xs font-bold"
                            >
                              +
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                    <Link
                      href={`/admindashboard/add-product?edit=${p.id}`}
                      className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-primary border border-gray-200 px-3 py-1.5"
                    >
                      <span className="material-symbols-outlined text-sm">edit</span>
                      Edit
                    </Link>
                    <button
                      onClick={() => handleDeleteProduct(p.id)}
                      className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-red-500 border border-red-200 px-3 py-1.5 bg-transparent cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                      Delete
                    </button>
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
    </div>
  );
}
