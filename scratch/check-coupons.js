const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

// Load .env.local variables
const envPath = path.join(__dirname, "..", ".env.local");
let supabaseUrl = "";
let serviceRoleKey = "";

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.*)/);
  const keyMatch = envContent.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*(.*)/);
  if (urlMatch) supabaseUrl = urlMatch[1].trim().replace(/['"]/g, "");
  if (keyMatch) serviceRoleKey = keyMatch[1].trim().replace(/['"]/g, "");
}

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing Supabase configuration in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkCoupons() {
  const { data, error } = await supabase.from("coupons").select("*");
  if (error) {
    console.error("Error fetching coupons:", error);
  } else {
    console.log(`Found ${data.length} coupons in database:`);
    console.log(JSON.stringify(data, null, 2));
  }
}

checkCoupons();
