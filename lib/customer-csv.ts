// CSV utility for customer export — NOT a server action file
// This is a pure helper that can be imported in both client and server contexts.

export interface CustomerCsvRow {
  name: string;
  email: string;
  phone?: string;
  order_count: number;
  ltv: number;
  wallet_balance: number;
  loyalty_points: number;
  joined?: string;
  is_blocked?: boolean;
}

function sanitizeCsvCell(value: string): string {
  if (!value) return '';
  // Neutralize CSV formula injection
  // Excel interprets cells starting with =, +, -, @, tab, carriage return as formulas
  const dangerous = ['=', '+', '-', '@', '\t', '\r', '\n'];
  if (dangerous.some(c => value.startsWith(c))) {
    return `'${value}`; // prefix with apostrophe
  }
  return value;
}

export function generateCustomerCsv(customers: CustomerCsvRow[]): string {
  const BOM = "\uFEFF";
  const header = [
    "Name",
    "Email",
    "Phone",
    "Order Count",
    "LTV (₹)",
    "Wallet Balance (₹)",
    "Loyalty Points",
    "Joined Date",
    "Status",
  ].join(",");

  const rows = customers.map((c) => {
    const escape = (v: string | number | undefined | null) => {
      let str = String(v ?? "");
      str = sanitizeCsvCell(str);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };
    return [
      escape(c.name),
      escape(c.email),
      escape(c.phone ?? ""),
      escape(c.order_count),
      escape(c.ltv.toFixed(2)),
      escape(c.wallet_balance.toFixed(2)),
      escape(c.loyalty_points),
      escape(c.joined ?? ""),
      escape(c.is_blocked ? "Blocked" : "Active"),
    ].join(",");
  });

  return BOM + [header, ...rows].join("\r\n");
}
