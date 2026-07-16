import Link from "next/link";

interface Props {
  searchParams: Promise<{ error?: string }>;
}

export default async function PaymentFailedPage({ searchParams }: Props) {
  const resolvedParams = await searchParams;
  const errorMsg = resolvedParams.error || "Your payment could not be processed. No money has been deducted.";

  return (
    <div className="min-h-screen bg-[#faf9f8] flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute inset-0 ambient-glow-gold pointer-events-none opacity-40" />

      {/* Main card box */}
      <div className="w-full max-w-md bg-white border border-[#7f7667]/20 p-8 md:p-12 relative z-10 rounded-none shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
        {/* Header decoration */}
        <div className="w-full h-1 bg-[#ba1a1a] mb-8" />

        {/* Failed SVG Indicator */}
        <div className="w-16 h-16 border border-[#ba1a1a]/20 flex items-center justify-center mx-auto mb-6 bg-red-50/50 rounded-none">
          <svg className="w-6 h-6 text-[#ba1a1a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>

        {/* Headings */}
        <h1 className="text-3xl font-headline font-black tracking-tighter text-[#1a1c1c] text-center uppercase leading-none mb-3">
          Payment Declined
        </h1>
        
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#7f7667] text-center mb-6">
          Transaction Failed
        </p>

        <div className="border-y border-[#7f7667]/10 py-6 mb-8">
          <p className="text-xs text-[#1a1c1c] text-center leading-relaxed font-medium">
            {errorMsg}
          </p>
          <p className="text-[9px] text-[#7f7667] font-black uppercase tracking-wider text-center mt-4">
            Your cart items have been saved.
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <Link
            href="/checkout"
            className="w-full flex items-center justify-center bg-[#1a1c1c] text-[#faf9f8] py-4 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-[#775a19] transition-all duration-300 rounded-none cursor-pointer border-none"
          >
            Retry Payment
          </Link>
          <a
            href={`https://wa.me/${process.env.NEXT_PUBLIC_SUPPORT_PHONE || "919000000000"}?text=Payment failed for my order`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center border border-[#7f7667]/20 text-[#1a1c1c] py-4 text-[10px] font-black uppercase tracking-[0.2em] hover:border-[#1a1c1c] transition-all duration-300 rounded-none cursor-pointer bg-white"
          >
            Contact Support
          </a>
          <Link
            href="/shopallshirts"
            className="w-full flex items-center justify-center text-[#7f7667] py-2 text-[9px] font-black uppercase tracking-[0.15em] hover:text-[#1a1c1c] transition-all duration-300 rounded-none"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  );
}
