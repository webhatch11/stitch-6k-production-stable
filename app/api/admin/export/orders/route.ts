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
    const orders = (await db.getOrders()) as any[];
    const dateStr = new Date().toISOString().split("T")[0];

    if (format === "xlsx") {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Orders Summary
      const summaryRows = orders.map((o) => ({
        "Order ID": o.id,
        "Date": o.date || o.createdAt || o.created_at || "",
        "Customer Name": o.customer || "",
        "Customer Email": o.address_snapshot?.email || o.customerEmail || "",
        "Customer Phone": o.address_snapshot?.phone || "",
        "Items Summary": (o.items || []).map((item: any) => typeof item === "string" ? item : (item.productName || item.title || "")).join("; "),
        "Subtotal": Number(o.total || 0) / 1.12,
        "Discount": Number(o.couponDiscount || o.coupon_discount || 0),
        "GST": Number(o.total || 0) - (Number(o.total || 0) / 1.12),
        "Total": Number(o.total || 0),
        "Payment Method": o.paymentMethod || o.payment_method || "",
        "Payment Status": o.paymentStatus || o.payment_status || "",
        "Order Status": o.status || "",
        "Shipping Address": o.address_snapshot ? `${o.address_snapshot.name}, ${o.address_snapshot.phone}, ${o.address_snapshot.address_line_1}, ${o.address_snapshot.address_line_2}, ${o.address_snapshot.city} - ${o.address_snapshot.postal_code}, ${o.address_snapshot.state}, ${o.address_snapshot.country}` : "",
        "Courier AWB": o.shiprocketId || "",
      }));
      const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(wb, wsSummary, "Orders Summary");

      // Sheet 2: Order line items detail
      const detailRows: any[] = [];
      for (const o of orders) {
        const rawItems = o.cartItems || o.cart_items || [];
        if (rawItems.length === 0 && Array.isArray(o.items)) {
          for (const itemStr of o.items) {
            detailRows.push({
              "Order ID": o.id,
              "Date": o.date || o.createdAt || o.created_at || "",
              "Customer Name": o.customer || "",
              "Product Name": typeof itemStr === "string" ? itemStr : (itemStr.productName || itemStr.title || ""),
              "Size": typeof itemStr === "object" ? (itemStr.size || "") : "",
              "Color": typeof itemStr === "object" ? (itemStr.color || "") : "",
              "Quantity": typeof itemStr === "object" ? (itemStr.quantity || 1) : 1,
              "Price": typeof itemStr === "object" ? (itemStr.price || 0) : 0,
            });
          }
        } else {
          for (const item of rawItems) {
            detailRows.push({
              "Order ID": o.id,
              "Date": o.date || o.createdAt || o.created_at || "",
              "Customer Name": o.customer || "",
              "Product Name": item.productName || item.title || "",
              "Size": item.size || "",
              "Color": item.color || "",
              "Quantity": item.quantity || 1,
              "Price": item.price || 0,
            });
          }
        }
      }
      const wsDetail = XLSX.utils.json_to_sheet(detailRows);
      XLSX.utils.book_append_sheet(wb, wsDetail, "Order Line Items Detail");

      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

      return new NextResponse(buf, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="orders-${dateStr}.xlsx"`,
        },
      });
    } else {
      // Default: CSV format
      const csvHeaders = [
        "Order ID", "Date", "Customer Name", "Customer Email", "Customer Phone",
        "Items Summary", "Subtotal", "Discount", "GST", "Total",
        "Payment Method", "Payment Status", "Order Status", "Shipping Address", "Courier AWB"
      ];

      const csvRows = orders.map((o) => [
        o.id,
        o.date || o.createdAt || o.created_at || "",
        o.customer || "",
        o.address_snapshot?.email || o.customerEmail || "",
        o.address_snapshot?.phone || "",
        (o.items || []).map((item: any) => typeof item === "string" ? item : (item.productName || item.title || "")).join("; "),
        (Number(o.total || 0) / 1.12).toFixed(2),
        Number(o.couponDiscount || o.coupon_discount || 0).toFixed(2),
        (Number(o.total || 0) - (Number(o.total || 0) / 1.12)).toFixed(2),
        Number(o.total || 0).toFixed(2),
        o.paymentMethod || o.payment_method || "",
        o.paymentStatus || o.payment_status || "",
        o.status || "",
        o.address_snapshot ? `${o.address_snapshot.name}, ${o.address_snapshot.phone}, ${o.address_snapshot.address_line_1}, ${o.address_snapshot.address_line_2}, ${o.address_snapshot.city} - ${o.address_snapshot.postal_code}, ${o.address_snapshot.state}, ${o.address_snapshot.country}` : "",
        o.shiprocketId || "",
      ]);

      const csvContent = [
        csvHeaders.join(","),
        ...csvRows.map((row) => row.map(escapeCSV).join(",")),
      ].join("\n");

      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="orders-${dateStr}.csv"`,
        },
      });
    }
  } catch (error: any) {
    console.error("[Orders Export Error]:", error);
    return NextResponse.json({ error: "Failed to export orders" }, { status: 500 });
  }
}
