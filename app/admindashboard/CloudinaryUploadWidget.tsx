"use client";

import { useEffect, useRef, ReactNode, forwardRef, useImperativeHandle } from "react";

export interface CloudinaryUploadHandle {
  open: () => void;
}

interface CloudinaryUploadWidgetProps {
  onUploadSuccess?: (url: string) => void;
  onUpload?: (url: string) => void; // backwards compatibility
  children?: (props: { open: () => void }) => ReactNode;
  maxFileSize?: number;
  acceptedFormats?: string[];
  options?: any;
}

declare global {
  interface Window {
    cloudinary: any;
  }
}

const CloudinaryUploadWidget = forwardRef<CloudinaryUploadHandle, CloudinaryUploadWidgetProps>(
  (
    {
      onUploadSuccess,
      onUpload,
      children,
      maxFileSize = 10000000,
      acceptedFormats = ["png", "jpg", "jpeg", "webp"],
      options = {},
    },
    ref
  ) => {
    const widgetRef = useRef<any>(null);
    const cloudName = (process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "").replace(/"/g, "");
    const uploadPreset = (process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "stitch6k_products").replace(/"/g, "");

    if (!cloudName) {
      console.error(
        '[Cloudinary] NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME not configured'
      );
      return null;
    }

    const initWidget = () => {
      if (!window.cloudinary) {
        console.error("[Cloudinary] window.cloudinary not available");
        return;
      }
      if (widgetRef.current) {
        return; // already initialized
      }

      widgetRef.current = window.cloudinary.createUploadWidget(
        {
          cloudName,
          uploadPreset,
          sources: ["local", "url", "camera"],
          multiple: false,
          maxFileSize,
          clientAllowedFormats: acceptedFormats,
          cropping: false,
          showPoweredBy: false,
          styles: {
            palette: {
              window: "#FFFFFF",
              windowBorder: "#1a1a1a",
              tabIcon: "#BA7517",
              menuIcons: "#5A616A",
              textDark: "#000000",
              textLight: "#FFFFFF",
              link: "#BA7517",
              action: "#1a1a1a",
              inactiveTabIcon: "#6b7280",
              error: "#F44235",
              inProgress: "#BA7517",
              complete: "#20B832",
              sourceBg: "#F9F9F9",
            },
          },
          ...options,
        },
        (error: any, result: any) => {
          if (error) {
            console.error("[Cloudinary] Upload error:", error);
            return;
          }
          if (result?.event === "success") {
            const url = result.info.secure_url;
            console.log("[Cloudinary] Upload success:", url);
            
            if (onUploadSuccess) {
              onUploadSuccess(url);
            } else if (onUpload) {
              onUpload(url);
            }
            
            widgetRef.current?.close();
          }
        }
      );
    };

    useEffect(() => {
      let intervalId: any;

      const checkAndInit = () => {
        if (window.cloudinary) {
          initWidget();
          if (intervalId) clearInterval(intervalId);
          return true;
        }
        return false;
      };

      if (!checkAndInit()) {
        // Ensure the Cloudinary global script is loading or loaded
        const existingScript = document.querySelector('script[src*="cloudinary"]');
        if (!existingScript) {
          const script = document.createElement("script");
          script.src = "https://upload-widget.cloudinary.com/global/all.js";
          script.async = true;
          document.head.appendChild(script);
        }

        // Poll every 100ms until window.cloudinary is available
        intervalId = setInterval(checkAndInit, 100);
      }

      return () => {
        if (intervalId) clearInterval(intervalId);
        if (widgetRef.current) {
          widgetRef.current.destroy();
          widgetRef.current = null;
        }
      };
    }, []);

    const open = () => {
      if (!widgetRef.current) {
        // Widget not ready — try to init first
        if (window.cloudinary) {
          initWidget();
          setTimeout(() => {
            widgetRef.current?.open();
          }, 100);
        } else {
          console.error(
            "[Cloudinary] Widget not initialized. Check script load and upload preset."
          );
          alert("Image upload is loading. Please try again in a moment.");
        }
        return;
      }
      widgetRef.current.open();
    };

    useImperativeHandle(ref, () => ({
      open,
    }));

    if (children) {
      return <>{children({ open })}</>;
    }
    return <></>;
  }
);

CloudinaryUploadWidget.displayName = "CloudinaryUploadWidget";

export default CloudinaryUploadWidget;
