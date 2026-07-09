import { v2 as cloudinary } from "cloudinary";

if (typeof window !== "undefined") {
  throw new Error(
    "lib/cloudinary.ts must NEVER be imported in browser code. " +
    "It exposes the API secret."
  );
}

cloudinary.config({
  cloud_name: (process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "").replace(/"/g, ""),
  api_key: (process.env.CLOUDINARY_API_KEY || "").replace(/"/g, ""),
  api_secret: (process.env.CLOUDINARY_API_SECRET || "").replace(/"/g, ""),
  secure: true,
});

export { cloudinary };
