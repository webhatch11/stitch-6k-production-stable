import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const checks = {
      supabase: !!(
        process.env.NEXT_PUBLIC_SUPABASE_URL &&
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
        process.env.SUPABASE_SERVICE_ROLE_KEY
      ),
      razorpay: !!(
        process.env.RAZORPAY_KEY_ID &&
        process.env.RAZORPAY_KEY_SECRET
      ),
      cloudinary: !!(
        process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
      ),
      redis: !!(process.env.REDIS_URL),
      resend: !!(process.env.RESEND_API_KEY),
      sentry: !!(process.env.NEXT_PUBLIC_SENTRY_DSN),
      analytics: !!(
        process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
      )
    };

    const allCriticalHealthy = 
      checks.supabase && 
      checks.razorpay && 
      checks.cloudinary;

    return NextResponse.json({
      status: allCriticalHealthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      checks
    }, { 
      status: allCriticalHealthy ? 200 : 503 
    });
  } catch (error) {
    console.error('[GET /api/health]:', error);
    const Sentry = await import('@sentry/nextjs');
    Sentry.captureException(error);
    
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
