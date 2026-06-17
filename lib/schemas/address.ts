import { z } from "zod";

export const addressSchema = z.object({
  id: z.string().optional(),
  user_id: z.string().optional(),
  name: z.string()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must not exceed 50 characters"),
  phone: z.string()
    .regex(/^[6-9]\d{9}$/, "Phone number must be a valid 10-digit Indian mobile number (e.g., 9876543210)"),
  address_line_1: z.string()
    .min(5, "Address line 1 must be at least 5 characters"),
  address_line_2: z.string().optional().nullable().or(z.literal("")),
  city: z.string()
    .min(2, "City name must be at least 2 characters"),
  state: z.string()
    .min(2, "State name must be at least 2 characters"),
  postal_code: z.string()
    .regex(/^\d{6}$/, "Postal code must be a valid 6-digit Indian PIN code (e.g., 560102)"),
  country: z.string().default("India"),
  is_default: z.boolean().default(false),
});
