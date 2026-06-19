import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

export async function getServerSupabase() {
  if (!isSupabaseConfigured) return null;

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll().map(({ name, value }) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Can be ignored if called from Server Component
        }
      },
    },
  });
}

/**
 * Helper to get the logged-in user profile on the server.
 * Fallback to mock session details if Supabase is not configured.
 */
export async function getServerUser() {
  const cookieStore = await cookies();

  if (!isSupabaseConfigured) {
    const mockSession = cookieStore.get("mock_user_session")?.value;
    const mockEmail = cookieStore.get("mock_user_email")?.value;
    const mockRole = cookieStore.get("mock_user_role")?.value;

    if (mockSession) {
      return {
        id: mockSession,
        email: mockEmail || "guest@stitch6k.com",
        role: mockRole || "customer",
        isMock: true,
      };
    }
    return null;
  }

  const supabaseClient = await getServerSupabase();
  if (!supabaseClient) return null;

  try {
    const { data: { user }, error } = await supabaseClient.auth.getUser();
    if (error || !user) return null;

    // Fetch user role from profiles table
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    return {
      id: user.id,
      email: user.email || "",
      role: profile?.role || "customer",
      isMock: false,
    };
  } catch (e) {
    console.error("[getServerUser] Error fetching user:", e);
    return null;
  }
}
