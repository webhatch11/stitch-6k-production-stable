/**
 * Stitch 6K Cash on Delivery (COD) Rules Engine
 */

// Whitelist of serviceable pincode prefixes (Tier 1/2 hubs and heritage workshop region)
const SERVICEABLE_PINCODE_PREFIXES = [
  "560", // Bengaluru
  "400", // Mumbai
  "110", // Delhi
  "600", // Chennai
  "700", // Kolkata
  "221", // Varanasi Workshop
  "500", // Hyderabad
  "380", // Ahmedabad
  "411", // Pune
];

// Blacklist of high-risk or remote pincode prefixes
const HIGH_RISK_REMOTE_PREFIXES = [
  "190", // Jammu & Kashmir Remote
  "799", // Tripura / North East Remote
  "800", // High risk COD rejection zone
  "846", // High risk COD rejection zone
];

// Customer blacklist (fraud prevention)
const BLACKLISTED_EMAILS = [
  "blacklist@example.com",
  "fraudster@gmail.com",
  "spammer@stitch6k.com",
];

export interface CodRulesResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Evaluates whether Cash on Delivery is allowed for a given checkout configuration.
 */
export function evaluateCodRules(params: {
  pincode: string;
  orderTotal: number;
  customerEmail?: string;
  cancellationCount?: number;
}): CodRulesResult {
  const { pincode, orderTotal, customerEmail, cancellationCount = 0 } = params;

  // Clean pincode input
  const cleanPincode = (pincode || "").replace(/\s+/g, "").trim();

  if (!cleanPincode) {
    return { allowed: false, reason: "Please specify a delivery pincode." };
  }

  // 1. Order value limit (Order value < ₹5,000)
  if (orderTotal >= 5000) {
    return {
      allowed: false,
      reason: `COD disabled for luxury high-value orders (Order value must be less than ₹5,000. Current order: ₹${orderTotal.toLocaleString("en-IN")}).`,
    };
  }

  // 2. Blacklisted emails (Fraud prevention)
  if (customerEmail && BLACKLISTED_EMAILS.includes(customerEmail.toLowerCase().trim())) {
    return {
      allowed: false,
      reason: "COD disabled: Account flag restriction. Please pay online.",
    };
  }

  // 3. Repeat cancellations tracking (Max 2 cancellations allowed)
  if (cancellationCount >= 2) {
    return {
      allowed: false,
      reason: "COD disabled: Excessive previous order cancellations. Please pay online.",
    };
  }

  // 4. Blacklisted high-risk / remote pincodes
  const matchesHighRisk = HIGH_RISK_REMOTE_PREFIXES.some((prefix) =>
    cleanPincode.startsWith(prefix)
  );
  if (matchesHighRisk) {
    return {
      allowed: false,
      reason: `COD disabled: Delivery location lies in a high-risk or remote postal circle (${cleanPincode}).`,
    };
  }

  // 5. Whitelisted serviceable pincodes check
  const matchesServiceable = SERVICEABLE_PINCODE_PREFIXES.some((prefix) =>
    cleanPincode.startsWith(prefix)
  );

  if (!matchesServiceable) {
    return {
      allowed: false,
      reason: `COD disabled: Location outside standard Tier-1/2 express hubs.`,
    };
  }

  return { allowed: true };
}
