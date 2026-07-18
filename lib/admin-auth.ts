import { getServerUser } from "./supabase-server";

export type AdminAccessResult = {
  authorized: boolean;
  method: "session" | "secret" | null;
};

export async function requireAdmin() {
  const user = await getServerUser();
  if (!user || user.role !== "admin") {
    throw new Error("Unauthorized — admin access required");
  }
  return user;
}

export async function verifyAdminAccess(request: Request): Promise<AdminAccessResult> {
  const adminSecret = process.env.ADMIN_SECRET;

  // 1. Check Bearer token using timing-safe comparison
  const authHeader = request.headers.get("authorization");
  if (authHeader && adminSecret) {
    const token = authHeader.replace(/^bearer\s+/i, "").trim();
    if (token.length === adminSecret.length) {
      let match = 0;
      for (let i = 0; i < token.length; i++) {
        match |= token.charCodeAt(i) ^ adminSecret.charCodeAt(i);
      }
      if (match === 0) {
        return { authorized: true, method: "secret" };
      }
    }
  }

  // 2. Check Supabase session
  try {
    const user = await getServerUser();
    if (user && user.role === "admin") {
      return { authorized: true, method: "session" };
    }
  } catch (err) {
    console.error("[verifyAdminAccess] Cookie auth check error:", err);
  }

  return { authorized: false, method: null };
}
