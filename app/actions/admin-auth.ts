"use server";

export async function checkAdminEmail(
  email: string
): Promise<{ allowed: boolean }> {
  if (!email) return { allowed: false };
  const adminEmails = 
    process.env.ADMIN_EMAILS?.split(',')
      .map(e => e.trim().toLowerCase()) || [];
  return { allowed: adminEmails.includes(email.trim().toLowerCase()) };
}
