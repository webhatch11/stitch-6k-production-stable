"use client";

import { CldUploadWidget } from "next-cloudinary";
import { forwardRef, useImperativeHandle, useRef } from "react";

export interface CloudinaryUploadHandle {
  open: () => void;
}

interface Props {
  onUpload: (url: string) => void;
}

/**
 * Single mountable Cloudinary upload widget controlled via ref.
 * Parent calls ref.current.open() to trigger the modal.
 * On success, calls onUpload(url) with the secure_url.
 * Mounting ONE instance at the page level avoids multi-widget body-scroll conflicts.
 */
const CloudinaryUploadWidget = forwardRef<CloudinaryUploadHandle, Props>(
  ({ onUpload }, ref) => {
    const openRef = useRef<(() => void) | null>(null);

    useImperativeHandle(ref, () => ({
      open: () => {
        openRef.current?.();
      },
    }));

    return (
      <CldUploadWidget
        uploadPreset={process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET}
        signatureEndpoint="/api/admin/cloudinary-sign"
        options={{
          sources: ["local", "url", "camera"],
          multiple: false,
          maxFiles: 1,
          folder: "products",
          clientAllowedFormats: ["png", "jpg", "jpeg", "webp"],
          maxFileSize: 10000000,
          showSkipCropButton: true,
          cropping: false,
          showPoweredBy: false,
        }}
        onSuccess={(result: any) => {
          const url = result?.info?.secure_url;
          if (url) onUpload(url);
        }}
      >
        {({ open }) => {
          openRef.current = open;
          return <></>;
        }}
      </CldUploadWidget>
    );
  }
);

CloudinaryUploadWidget.displayName = "CloudinaryUploadWidget";

export default CloudinaryUploadWidget;
