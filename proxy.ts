import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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

  if (isSupabaseConfigured) {
    let response = NextResponse.next({
      request: {
        headers: request.headers,
      },
    });

    const supabase = createServerClient(
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

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      console.warn(`[SECURITY WARNING] Unauthorized request to protected path "${path}" from IP ${ip}. Redirecting to /login.`);
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    if (isAdminRoute) {
      // Secure role validation from public profiles table
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile || profile.role !== "admin") {
        console.error(`[SECURITY VIOLATION] Unauthorized admin access attempt to "${path}" by user "${user.email}" (UID: ${user.id}) from IP ${ip}. Access denied.`);
        url.pathname = "/";
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
      return NextResponse.redirect(url);
    }

    if (isAdminRoute && mockRole !== "admin") {
      console.error(`[MOCK SECURITY VIOLATION] Unauthorized mock admin access attempt to "${path}" by session "${mockSession}" (Role: ${mockRole}) from IP ${ip}. Redirecting to root.`);
      url.pathname = "/";
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    "/admindashboard/:path*", 
    "/myprofile/:path*"
  ],
};
