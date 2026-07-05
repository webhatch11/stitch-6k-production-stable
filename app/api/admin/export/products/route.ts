import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import * as XLSX from "xlsx";

function escapeCSV(val: any): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const format = req.nextUrl.searchParams.get("format") || "csv";
    const products = (await db.getProducts({ includeDeleted: false })) as any[];
    const dateStr = new Date().toISOString().split("T")[0];

    const getStockForSize = (p: any, size: string) => {
      const vars = p.variants || [];
      return vars
        .filter((v: any) => String(v.size).toUpperCase() === size.toUpperCase())
        .reduce((sum: number, v: any) => sum + (Number(v.stock) || 0), 0);
    };

    if (format === "xlsx") {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Products Summary
      const summaryRows = products.map((p) => {
        const variants = p.variants || [];
        const totalStock = variants.reduce((sum: number, v: any) => sum + (Number(v.stock) || 0), 0);
        const colors = Array.from(new Set(variants.map((v: any) => v.color || "Default"))).join(", ");
        return {
          "Product ID (SKU)": p.id,
          "Product Name": p.title || "",
          "Category": p.category || "",
          "Base Price": p.price / 1.12,
          "GST Rate": "12%",
          "Final Price": p.price || 0,
          "Size S stock": getStockForSize(p, "S"),
          "Size M stock": getStockForSize(p, "M"),
          "Size L stock": getStockForSize(p, "L"),
          "Size XL stock": getStockForSize(p, "XL"),
          "Size XXL stock": getStockForSize(p, "XXL"),
          "Total Stock": totalStock,
          "Colors Available": colors,
          "Is Featured": p.isFeatured ? "Yes" : "No",
          "Is Bestseller": p.isBestseller ? "Yes" : "No",
          "Is New Arrival": p.isNewArrival ? "Yes" : "No",
          "Is Gen-Z": p.isGenZ ? "Yes" : "No",
          "Created Date": p.created_at || "",
          "Primary Image URL": p.image || "",
        };
      });
      const wsProducts = XLSX.utils.json_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(wb, wsProducts, "Products List");

      // Sheet 2: Variant details
      const variantRows: any[] = [];
      for (const p of products) {
        const variants = p.variants || [];
        for (const v of variants) {
          variantRows.push({
            "Product ID": p.id,
            "Product Name": p.title || "",
            "Size": v.size || "",
            "Color": v.color || "",
            "Stock": v.stock || 0,
            "SKU": v.sku || `${p.id}-${v.size}-${v.color}`,
            "Price": v.price || p.price,
          });
        }
      }
      const wsVariants = XLSX.utils.json_to_sheet(variantRows);
      XLSX.utils.book_append_sheet(wb, wsVariants, "Per-Variant Details");

      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

      return new NextResponse(buf, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="products-${dateStr}.xlsx"`,
        },
      });
    } else {
      // Default: CSV format
      const csvHeaders = [
        "Product ID (SKU)", "Product Name", "Category", "Base Price", "GST Rate", "Final Price",
        "Size S stock", "Size M stock", "Size L stock", "Size XL stock", "Size XXL stock",
        "Total Stock", "Colors Available", "Is Featured", "Is Bestseller", "Is New Arrival", "Is Gen-Z",
        "Created Date", "Primary Image URL"
      ];

      const csvRows = products.map((p) => {
        const variants = p.variants || [];
        const totalStock = variants.reduce((sum: number, v: any) => sum + (Number(v.stock) || 0), 0);
        const colors = Array.from(new Set(variants.map((v: any) => v.color || "Default"))).join(", ");
        return [
          p.id,
          p.title || "",
          p.category || "",
          (p.price / 1.12).toFixed(2),
          "12%",
          p.price || 0,
          getStockForSize(p, "S"),
          getStockForSize(p, "M"),
          getStockForSize(p, "L"),
          getStockForSize(p, "XL"),
          getStockForSize(p, "XXL"),
          totalStock,
          colors,
          p.isFeatured ? "Yes" : "No",
          p.isBestseller ? "Yes" : "No",
          p.isNewArrival ? "Yes" : "No",
          p.isGenZ ? "Yes" : "No",
          p.created_at || "",
          p.image || "",
        ];
      });

      const csvContent = [
        csvHeaders.join(","),
        ...csvRows.map((row) => row.map(escapeCSV).join(",")),
      ].join("\n");

      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="products-${dateStr}.csv"`,
        },
      });
    }
  } catch (error: any) {
    console.error("[Products Export Error]:", error);
    return NextResponse.json({ error: "Failed to export products" }, { status: 500 });
  }
}
