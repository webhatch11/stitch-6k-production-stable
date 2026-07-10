import { NextRequest, NextResponse } from "next/server";
import { cloudinary } from "@/lib/cloudinary";
import { requireAdmin } from "@/lib/admin-auth";

export async function POST(req: NextRequest) {
  // Auth check: admin only (consistent with all other admin API routes)
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { paramsToSign } = await req.json();

    if (!paramsToSign || typeof paramsToSign !== "object") {
      return NextResponse.json(
        { error: "Missing paramsToSign" },
        { status: 400 }
      );
    }

    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      process.env.CLOUDINARY_API_SECRET || ""
    );

    return NextResponse.json({ signature });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[cloudinary-sign] error:", e);
    return NextResponse.json(
      { error: message || "Failed to sign" },
      { status: 500 }
    );
  }
}
