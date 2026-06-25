import { getServerUser } from "./supabase-server";

export async function requireAdmin() {
  const user = await getServerUser();
  if (!user || user.role !== "admin") {
    throw new Error("Unauthorized — admin access required");
  }
  return user;
}
