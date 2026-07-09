"use server";

export async function checkAdminEmail(
  email: string
): Promise<{ allowed: boolean; error?: string }> {
  try {
    if (!email) return { allowed: false };
    const adminEmails = 
      process.env.ADMIN_EMAILS?.split(',')
        .map(e => e.trim().toLowerCase()) || [];
    return { allowed: adminEmails.includes(email.trim().toLowerCase()) };
  } catch (error) {
    console.error('[checkAdminEmail]:', error);
    return { 
      allowed: false, 
      error: 'Operation failed. Please try again.' 
    };
  }
}
