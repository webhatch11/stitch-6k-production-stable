import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Warm V8 process in-memory rate limiting fallback cache
const rateLimitCache = new Map<string, number[]>();

const RATE_LIMIT_CONFIG: Record<string, { limit: number; windowMs: number }> = {
  "/api/payments/create-order": { limit: 5, windowMs: 60 * 1000 },
  "/api/payments/verify": { limit: 10, windowMs: 60 * 1000 },
  "/login": { limit: 15, windowMs: 60 * 1000 },
  "/admindashboard/login": { limit: 15, windowMs: 60 * 1000 },
};

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

import { logger } from "./lib/logger";

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const traceId = request.headers.get("x-trace-id") || `tr_${generateId()}`;
  const correlationId = request.headers.get("x-correlation-id") || `corr_${generateId()}`;
  const requestId = `req_${generateId()}`;
  const sessionId = request.cookies.get("sb-access-token")?.value || request.cookies.get("mock_user_session")?.value || "anonymous";

  const context = {
    traceId,
    requestId,
    correlationId,
    sessionId,
  };

  return await logger.runWithContext(context, async () => {
    const start = Date.now();
    logger.info(`Incoming request: ${request.method} ${request.nextUrl.pathname}`);
    
    try {
      const response = await handleProxy(request);
      
      const durationMs = Date.now() - start;
      logger.info(`Request processed`, { route: request.nextUrl.pathname, durationMs });
      
      const { recordApiLatency } = await import("./lib/metrics");
      recordApiLatency(request.nextUrl.pathname, durationMs);
      
      // Inject trace context headers into the response
      response.headers.set("x-trace-id", traceId);
      response.headers.set("x-correlation-id", correlationId);
      response.headers.set("x-request-id", requestId);
      
      return response;
    } catch (error: any) {
      const durationMs = Date.now() - start;
      logger.critical("Proxy execution crashed", { route: request.nextUrl.pathname, durationMs, error: error.message });
      return new NextResponse(
        JSON.stringify({ success: false, error: "Internal Server Error" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  });
}

async function handleProxy(request: NextRequest) {
  const url = request.nextUrl.clone();
  const path = request.nextUrl.pathname;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

  const isAdminRoute = path.startsWith("/admindashboard") && !path.startsWith("/admindashboard/login");
  const isProfileRoute = path.startsWith("/myprofile");
  const isCheckoutRoute = path.startsWith("/checkout");
  const isOrderHistoryRoute = path.startsWith("/orderhistory");

  // Client connection metadata for security audit logging
  const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";

  // 0. CSRF protection: state-changing API requests from browsers must come
  // from our own origin. Webhooks are exempt (server-to-server, signature/token
  // verified in-route). Requests without an Origin header (curl, mobile SDKs,
  // same-origin GET) pass through — cookies aren't attached cross-site there.
  const isStateChanging = ["POST", "PUT", "PATCH", "DELETE"].includes(request.method);
  if (isStateChanging && path.startsWith("/api/") && !path.startsWith("/api/webhooks/")) {
    const origin = request.headers.get("origin");
    if (origin) {
      let originHost = "";
      try {
        originHost = new URL(origin).host;
      } catch {
        originHost = "";
      }
      const requestHost = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
      if (!originHost || originHost !== requestHost) {
        console.error(`[CSRF BLOCKED] Cross-origin ${request.method} to "${path}" from origin "${origin}" (host: ${requestHost}, IP: ${ip}).`);
        return new NextResponse(
          JSON.stringify({ success: false, error: "Cross-origin request rejected" }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }
    }
  }

  // 1. Rate Limiting Check for configured routes
  const routeRateLimit = RATE_LIMIT_CONFIG[path];
  if (routeRateLimit) {
    const rateLimitRes = await checkRateLimit(ip, path, routeRateLimit.limit, routeRateLimit.windowMs);
    
    if (!rateLimitRes.success) {
      console.error(`[RATE LIMIT EXCEEDED] IP ${ip} exceeded rate limit on "${path}". Limit: ${routeRateLimit.limit}/${routeRateLimit.windowMs / 1000}s.`);
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

  const isMetricsRoute = path === "/api/metrics";
  const isSubsystemHealthRoute = path.startsWith("/api/health/") && path !== "/api/health";

  if (isMetricsRoute || isSubsystemHealthRoute) {
    // 1. Check Bearer token using timing-safe comparison
    const adminSecret = process.env.ADMIN_SECRET;
    const authHeader = request.headers.get("authorization");
    if (authHeader && adminSecret) {
      const token = authHeader.replace(/^bearer\s+/i, "").trim();
      if (token.length === adminSecret.length) {
        let match = 0;
        for (let i = 0; i < token.length; i++) {
          match |= token.charCodeAt(i) ^ adminSecret.charCodeAt(i);
        }
        if (match === 0) {
          return NextResponse.next();
        }
      }
    }

    // 2. Check Supabase session
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

      try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (user) {
          const { data: profile } = await supabaseClient
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .maybeSingle();

          if (profile && profile.role === "admin") {
            return response;
          }
        }
      } catch (err) {
        console.error("[Middleware Auth Check Error]:", err);
      }
    }

    return new NextResponse(
      JSON.stringify({ success: false, error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  // If path is not a protected route, continue immediately
  if (!isAdminRoute && !isProfileRoute && !isCheckoutRoute && !isOrderHistoryRoute) {
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
      console.warn(`[SECURITY WARNING] Unauthorized request to protected path "${path}" from IP ${ip}. Redirecting to login.`);
      if (path.startsWith("/admindashboard") && !path.startsWith("/admindashboard/login")) {
        url.pathname = "/admindashboard/login";
      } else {
        url.pathname = "/login";
      }
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
        url.pathname = "/admindashboard/login";
        url.searchParams.set("error", "admin_required");
        return NextResponse.redirect(url);
      }
    }

    return response;
  } else {
    throw new Error(
      'Supabase not configured. ' +
      'Check NEXT_PUBLIC_SUPABASE_URL and ' +
      'NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    );
  }
}

export const config = {
  matcher: [
    "/admindashboard/:path*",
    "/myprofile/:path*",
    "/checkout/:path*",
    "/orderhistory/:path*",
    "/api/:path*",
    "/login"
  ],
};
