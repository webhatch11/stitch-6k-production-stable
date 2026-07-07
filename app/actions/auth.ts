"use server";

import { supabaseService, isServiceClientConfigured } from "@/lib/supabase-service";

/**
 * Checks whether an email belongs to an existing user.
 *
 * Strategy (two-layer fallback):
 * 1. Query `profiles.email` — fast path, covers the majority of users whose
 *    profile row was created by the `handle_new_user` trigger.
 * 2. If no profiles row is found (trigger may have failed or email column was
 *    NULL for legacy rows), scan `auth.users` via the admin API.
 *    This is the authoritative source of truth.
 *
 * Runs server-side only — never ships the service-role key to the browser.
 */
export async function checkUserExistsAction(
  email: string
): Promise<{ exists: boolean }> {
  const normalised = email.toLowerCase().trim();

  if (!isServiceClientConfigured || !supabaseService) {
    // Supabase not configured (local dev without .env).
    // Fall back gracefully — let the OTP flow decide.
    return { exists: false };
  }

  // --- Layer 1: profiles table (fast, indexed) ---
  const { data: profile, error: profileError } = await supabaseService
    .from("profiles")
    .select("id, email")
    .eq("email", normalised)
    .maybeSingle();

  if (profileError) {
    console.error("[checkUserExistsAction] profiles query error:", profileError.message);
  }

  if (profile) {
    return { exists: true };
  }

  // --- Layer 2: auth.users admin lookup (authoritative) ---
  // Handles users whose profiles row has a NULL email (trigger race or legacy data).
  try {
    const { data: adminData, error: adminError } =
      await supabaseService.auth.admin.listUsers({ page: 1, perPage: 1000 });

    if (adminError) {
      console.error("[checkUserExistsAction] admin.listUsers error:", adminError.message);
      // Don't block sign-in on an admin API failure — return false and let
      // Supabase's own shouldCreateUser logic handle it.
      return { exists: false };
    }

    const found = (adminData?.users ?? []).some(
      (u) => u.email?.toLowerCase() === normalised
    );

    return { exists: found };
  } catch (err: any) {
    console.error("[checkUserExistsAction] unexpected error:", err);
    return { exists: false };
  }
}
