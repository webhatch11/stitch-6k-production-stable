import { NextResponse } from "next/server";
import { getAggregatedMetrics } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const metrics = await getAggregatedMetrics();
    return NextResponse.json(metrics);
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to fetch metrics", details: err.message }, { status: 500 });
  }
}
