import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Warm V8 process in-memory rate limiting fallback cache
const rateLimitCache = new Map<string, number[]>();

async function checkRateLimit(ip: string, path: string, limit: number, windowMs: number): Promise<{ success: boolean }> {
  const key = `ratelimit:${path}:${ip}`;
  const now = Date.now();
  const windowStart = now - windowMs;

  const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
  const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (UPSTASH_URL && UPSTASH_TOKEN) {
    try {
      const url = `${UPSTASH_URL}/pipeline`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${UPSTASH_TOKEN}`,
        },
        body: JSON.stringify([
          ["ZREMRANGEBYSCORE", key, "-inf", `(${windowStart}`],
          ["ZADD", key, now.toString(), now.toString()],
          ["ZCARD", key],
          ["EXPIRE", key, Math.ceil(windowMs / 1000).toString()]
        ])
      });

      if (res.ok) {
        const results = await res.json();
        // results is an array of responses corresponding to each command in pipeline
        // ZCARD response is at index 2
        const cardVal = results[2]?.result;
        if (typeof cardVal === "number" && cardVal > limit) {
          return { success: false };
        }
        return { success: true };
      }
    } catch (e: any) {
      console.warn("[Rate Limiter] Upstash Redis REST failed, falling back to memory cache:", e.message);
    }
  }

  // Fallback: warm V8 process memory cache
  let timestamps = rateLimitCache.get(key) || [];
  timestamps = timestamps.filter(t => t > windowStart);

  if (timestamps.length >= limit) {
    rateLimitCache.set(key, timestamps);
    return { success: false };
  }

  timestamps.push(now);
  rateLimitCache.set(key, timestamps);
  return { success: true };
}

export async function proxy(request: NextRequest) {
  const url = request.nextUrl.clone();
  const path = request.nextUrl.pathname;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

  const isAdminRoute = path.startsWith("/admindashboard");
  const isProfileRoute = path.startsWith("/myprofile");

  // Client connection metadata for security audit logging
  const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";

  // 1. Rate Limiting Check for high-risk routes
  if (path === "/api/payments/create-order" || path === "/login") {
    const limit = path === "/api/payments/create-order" ? 5 : 15;
    const windowMs = 60 * 1000;
    
    const rateLimitRes = await checkRateLimit(ip, path, limit, windowMs);
    
    if (!rateLimitRes.success) {
      console.error(`[RATE LIMIT EXCEEDED] IP ${ip} exceeded rate limit on "${path}". Limit: ${limit}/min.`);
      return new NextResponse(
        JSON.stringify({
          success: false,
          error: "Too Many Requests",
          message: "You have exceeded the rate limit. Please try again in a minute."
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": "60",
          }
        }
      );
    }
  }

  // If path is not a protected route, continue immediately
  if (!isAdminRoute && !isProfileRoute) {
    return NextResponse.next();
  }

  if (isSupabaseConfigured) {
    let response = NextResponse.next({
      request: {
        headers: request.headers,
      },
    });

    const supabaseClient = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll().map(({ name, value }) => ({ name, value }));
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            response = NextResponse.next({
              request,
            });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();

    if (!user) {
      console.warn(`[SECURITY WARNING] Unauthorized request to protected path "${path}" from IP ${ip}. Redirecting to /login.`);
      url.pathname = "/login";
      url.searchParams.set("redirect", path);
      return NextResponse.redirect(url);
    }

    if (isAdminRoute) {
      // Secure role validation from public profiles table
      const { data: profile } = await supabaseClient
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile || profile.role !== "admin") {
        console.error(`[SECURITY VIOLATION] Unauthorized admin access attempt to "${path}" by user "${user.email}" (UID: ${user.id}) from IP ${ip}. Access denied.`);
        url.pathname = "/myprofile";
        url.searchParams.set("error", "admin_required");
        return NextResponse.redirect(url);
      }
    }

    return response;
  } else {
    // --- Mock Development Offline Guarding (Cookie Synced) ---
    const mockSession = request.cookies.get("mock_user_session")?.value;
    const mockRole = request.cookies.get("mock_user_role")?.value;

    if (!mockSession) {
      console.warn(`[MOCK SECURITY WARNING] Unauthorized request to mock protected path "${path}" from IP ${ip}. Redirecting to /login.`);
      url.pathname = "/login";
      url.searchParams.set("redirect", path);
      return NextResponse.redirect(url);
    }

    if (isAdminRoute && mockRole !== "admin") {
      console.error(`[MOCK SECURITY VIOLATION] Unauthorized mock admin access attempt to "${path}" by session "${mockSession}" (Role: ${mockRole}) from IP ${ip}. Redirecting to root.`);
      url.pathname = "/myprofile";
      url.searchParams.set("error", "admin_required");
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    "/admindashboard/:path*", 
    "/myprofile/:path*",
    "/api/payments/create-order",
    "/login"
  ],
};
