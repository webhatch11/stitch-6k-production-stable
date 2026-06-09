import React from "react";

interface SkeletonProps {
  className?: string;
  variant?: "rectangle" | "circle" | "text";
}

export default function Skeleton({ className = "", variant = "rectangle" }: SkeletonProps) {
  let shapeStyle = "";
  if (variant === "rectangle") {
    shapeStyle = "rounded-[1rem]";
  } else if (variant === "circle") {
    shapeStyle = "rounded-full";
  } else if (variant === "text") {
    shapeStyle = "rounded-[0.25rem] h-3 w-3/4";
  }

  return (
    <div
      className={`animate-pulse bg-gradient-to-r from-on-surface/5 via-on-surface/10 to-on-surface/5 ${shapeStyle} ${className}`}
      style={{
        backgroundSize: "200% 100%",
        animation: "pulse 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      }}
    />
  );
}
