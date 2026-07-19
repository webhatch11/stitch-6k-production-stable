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
  const [origin, setOrigin] = useState("");

  React.useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const handlePrint = async () => {
    if (matchedOrder && matchedOrder.status === "Paid") {
      const res = await updateOrderToProcessingAction(matchedOrder.id);
      if (res.success && res.order) {
        setMatchedOrder(res.order);
        window.dispatchEvent(new Event("storage"));
      }
    }
    const iframe = document.querySelector("iframe");
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } else {
      window.print();
    }
  };

  const invoiceData = orderToInvoiceData(
    matchedOrder,
    matchedOrder.id.replace("6K-RPO-", "").replace("6K-WPO-", "")
  );
  const html = buildInvoiceHtml(invoiceData, false, origin, true);

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
        @media (max-width: 640px) {
          .invoice-preview iframe {
            transform: scale(0.6) !important;
            transform-origin: top left !important;
            width: 167% !important; /* compensate for scale */
            height: 133vh !important;
          }
        }
      `}} />

      <div className="fixed top-6 right-6 left-6 sm:left-auto flex flex-col sm:flex-row gap-4 no-print z-50">
        <button
          onClick={handlePrint}
          className="w-full sm:w-auto px-6 py-3 bg-black text-white rounded-none text-[10px] font-black uppercase tracking-[0.2em] LoggedInAdminOnly hover:bg-gray-800 transition-all shadow-xl border-none cursor-pointer text-center"
        >
          Print / Download PDF
        </button>
        <button
          onClick={() => router.back()}
          className="w-full sm:w-auto px-6 py-3 bg-white border border-gray-200 text-gray-500 rounded-none text-[10px] font-black uppercase tracking-[0.2em] hover:bg-gray-50 transition-all cursor-pointer text-center"
        >
          Go Back
        </button>
      </div>

      <div className="w-full overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 mt-20 sm:mt-0">
        <div className="min-w-[320px] invoice-preview-container max-w-[800px] mx-auto shadow-sm border border-gray-200 bg-white invoice-preview">
          <iframe
            srcDoc={html}
            className="w-full border-0"
            style={{
              height: "80vh",
              minHeight: "500px",
              transform: "scale(1)",
              transformOrigin: "top left",
            }}
            title="Invoice Preview"
          />
        </div>
      </div>
    </div>
  );
}
