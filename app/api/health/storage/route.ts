import { NextResponse } from "next/server";
import { checkStorage } from "@/lib/health";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await checkStorage();
  return NextResponse.json(result, { status: result.status === "healthy" ? 200 : 503 });
}
