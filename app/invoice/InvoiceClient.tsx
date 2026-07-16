"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Order, Product } from "@/lib/types";
import { updateOrderToProcessingAction } from "@/app/actions/orders";
import { buildInvoiceHtml, orderToInvoiceData } from "@/lib/invoice-template";

interface InvoiceClientProps {
  initialOrder: Order;
  products: Product[];
  originalTotal: number;
  finalGatewayAmount: number;
  pointsDiscount: number;
  walletPaid: number;
  couponDiscount: number;
  gstin?: string;
}

export default function InvoiceClient({
  initialOrder,
  products,
  originalTotal,
  finalGatewayAmount,
  pointsDiscount,
  walletPaid,
  couponDiscount,
  gstin = "33BFOPT4938Q1ZE",
}: InvoiceClientProps) {
  const router = useRouter();
  const [matchedOrder, setMatchedOrder] = useState<Order>(initialOrder);

  const handlePrint = async () => {
    if (matchedOrder && matchedOrder.status === "Paid") {
      const res = await updateOrderToProcessingAction(matchedOrder.id);
      if (res.success && res.order) {
        setMatchedOrder(res.order);
        window.dispatchEvent(new Event("storage"));
      }
    }
    window.print();
  };

  const invoiceData = orderToInvoiceData(
    matchedOrder,
    matchedOrder.id.replace("6K-RPO-", "").replace("6K-WPO-", "")
  );
  const html = buildInvoiceHtml(invoiceData, false);

  return (
    <div className="bg-[#f9f9f9] min-h-screen py-12 px-6 no-print-bg">
      {/* Dynamic print stylesheet to isolate layout during browser printing */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          .no-print, .no-print * {
            display: none !important;
          }
          body, .no-print-bg {
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .invoice-preview-container {
            border: none !important;
            box-shadow: none !important;
            max-width: 100% !important;
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
          }
        }
      `}} />

      <div className="fixed top-6 right-6 flex gap-4 no-print z-50">
        <button
          onClick={handlePrint}
          className="bg-black text-white px-8 py-3 LoggedInAdminOnly text-[10px] font-black uppercase tracking-widest hover:bg-gray-800 transition-all shadow-xl border-none cursor-pointer"
        >
          Print / Download PDF
        </button>
        <button
          onClick={() => router.back()}
          className="bg-white border border-gray-200 text-gray-500 px-6 py-3 text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 transition-all cursor-pointer"
        >
          Go Back
        </button>
      </div>

      <div className="invoice-preview-container max-w-[800px] mx-auto shadow-sm border border-gray-200 bg-white">
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
}
