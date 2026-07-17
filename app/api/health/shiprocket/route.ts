import { NextResponse } from "next/server";
import { checkShiprocket } from "@/lib/health";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await checkShiprocket();
  return NextResponse.json(result, { status: result.status === "healthy" ? 200 : 503 });
}
