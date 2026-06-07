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

  if (!isAdminRoute && !isProfileRoute) {
    return NextResponse.next();
  }

  if (isSupabaseConfigured) {
    // --- Supabase Production Authentication & Guarding ---
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
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    if (isAdminRoute) {
      // Check admin privileges inside profiles table
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile || profile.role !== "admin") {
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
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    if (isAdminRoute && mockRole !== "admin") {
      url.pathname = "/";
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  }
}

// Intercept profile overview and admin directories
export const config = {
  matcher: [
    "/admindashboard/:path*", 
    "/myprofile/:path*"
  ],
};
