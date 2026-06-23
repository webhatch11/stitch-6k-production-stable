"use client";

import { CldUploadWidget } from "next-cloudinary";
import { useState } from "react";

interface Props {
  onUpload: (urls: string[]) => void;
  maxFiles?: number;
  buttonLabel?: string;
}

export default function CloudinaryUploadWidget({
  onUpload,
  maxFiles = 4,
  buttonLabel = "Upload Images",
}: Props) {
  const [uploaded, setUploaded] = useState<string[]>([]);

  return (
    <CldUploadWidget
      uploadPreset={process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET}
      signatureEndpoint="/api/admin/cloudinary-sign"
      options={{
        sources: ["local", "url", "camera"],
        multiple: true,
        maxFiles,
        folder: "products",
        clientAllowedFormats: ["png", "jpg", "jpeg", "webp"],
        maxFileSize: 10000000,
      }}
      onSuccess={(result: any) => {
        const url = result?.info?.secure_url;
        if (url) {
          const next = [...uploaded, url].slice(0, maxFiles);
          setUploaded(next);
          onUpload(next);
        }
      }}
    >
      {({ open }) => (
        <button
          type="button"
          onClick={() => open()}
          className="px-6 py-3 bg-[#0a0a0a] text-white text-xs uppercase tracking-widest font-bold hover:bg-[#fed488] hover:text-[#0a0a0a] transition-all"
        >
          {buttonLabel}
        </button>
      )}
    </CldUploadWidget>
  );
}
