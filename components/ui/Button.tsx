import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost";
  isLoading?: boolean;
}

export default function Button({
  children,
  variant = "primary",
  isLoading = false,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  let baseStyle = "inline-flex items-center justify-center text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 focus:outline-none focus:ring-1 focus:ring-secondary/50 disabled:opacity-50 disabled:cursor-not-allowed select-none btn-active-scale py-4 px-8 rounded-full";

  let variantStyle = "";
  if (variant === "primary") {
    // Luxury dark theme primary
    variantStyle = "bg-on-surface text-surface hover:bg-secondary hover:text-white border border-transparent";
  } else if (variant === "secondary") {
    // Heritage gold theme secondary
    variantStyle = "bg-[#fed488] text-neutral-950 hover:bg-[#ebd0a3] border border-[#fed488]/30";
  } else if (variant === "outline") {
    // Sleek border
    variantStyle = "bg-transparent border border-outline text-on-surface hover:bg-on-surface hover:text-surface";
  } else if (variant === "ghost") {
    // Minimal borderless
    variantStyle = "bg-transparent text-on-surface hover:bg-on-surface/5";
  }

  return (
    <button
      disabled={disabled || isLoading}
      className={`${baseStyle} ${variantStyle} ${className}`}
      {...props}
    >
      {isLoading ? (
        <span className="flex items-center gap-2">
          <svg className="animate-spin h-3 w-3 text-current" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Loading...
        </span>
      ) : (
        children
      )}
    </button>
  );
}
