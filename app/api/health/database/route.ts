import { NextResponse } from "next/server";
import { checkDatabase } from "@/lib/health";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await checkDatabase();
  return NextResponse.json(result, { status: result.status === "healthy" ? 200 : 503 });
}
