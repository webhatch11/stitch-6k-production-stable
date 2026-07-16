import Link from "next/link";

export default function PaymentFailedPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 py-12">
      <div className="w-24 h-24 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
        <span className="text-5xl">❌</span>
      </div>

      <h1 className="text-3xl font-bold text-gray-900 text-center mb-2">
        Payment Failed
      </h1>
      <p className="text-gray-500 text-center mb-2 max-w-sm">
        Your payment could not be processed. No money has been deducted.
      </p>
      <p className="text-gray-500 text-sm text-center mb-8 max-w-sm">
        Your cart items are saved. Please try again.
      </p>

      <div className="w-full max-w-md space-y-3">
        <Link
          href="/checkout"
          className="w-full flex items-center justify-center bg-black text-white py-3 rounded-full font-medium hover:bg-gray-800 transition-colors"
        >
          Try Again
        </Link>
        <a
          href={`https://wa.me/${process.env.NEXT_PUBLIC_SUPPORT_PHONE || "919000000000"}?text=Payment failed for my order`}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center border border-gray-300 text-gray-700 py-3 rounded-full font-medium hover:bg-gray-50 transition-colors"
        >
          Contact Support
        </a>
        <Link
          href="/shopallshirts"
          className="w-full flex items-center justify-center text-gray-500 py-2 text-sm hover:text-gray-700 transition-colors"
        >
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}
