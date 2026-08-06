// Pulls current ingredient pricing from Recipe Cost Calculator (RCC) and
// mirrors it into the Supabase "ingredients" table.
//
// Run manually with: npm run sync-prices
// In production, trigger this on a schedule (Vercel Cron hitting an API
// route that calls the same logic, or a scheduled GitHub Action).
//
// Requires RCC_API_KEY, NEXT_PUBLIC_SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY to be set (see .env.example).

require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const RCC_BASE_URL = "https://recipecostcalculator.net";
const RCC_API_KEY = process.env.RCC_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function requireEnv() {
  const missing = [];
  if (!RCC_API_KEY) missing.push("RCC_API_KEY");
  if (!SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (missing.length) {
    console.error(
      "Missing required environment variables: " + missing.join(", ") +
      "\nCopy .env.example to .env and fill these in first."
    );
    process.exit(1);
  }
}

async function fetchAllIngredients() {
  const res = await fetch(RCC_BASE_URL + "/api/v1/ingredients", {
    headers: { "x-api-key": RCC_API_KEY }
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error("RCC API error " + res.status + ": " + body);
  }
  return res.json();
}

async function main() {
  requireEnv();
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });

  console.log("Fetching ingredients from Recipe Cost Calculator...");
  const ingredients = await fetchAllIngredients();
  console.log("Fetched " + ingredients.length + " ingredients.");

  const rows = ingredients
    .filter((i) => typeof i.price_per_unit === "number")
    .map((i) => ({
      rcc_id: i.id,
      name: i.name,
      category: i.category_name || null,
      unit_name: i.unit_name || null,
      price_per_unit: i.price_per_unit,
      pack_size: i.pack_size || null,
      pack_price: i.price || null,
      synced_at: new Date().toISOString()
    }));

  if (!rows.length) {
    console.log("No ingredients with pricing found - nothing to sync.");
    return;
  }

  const { error } = await supabase
    .from("ingredients")
    .upsert(rows, { onConflict: "rcc_id" });

  if (error) {
    throw new Error("Supabase upsert failed: " + error.message);
  }

  console.log("Synced " + rows.length + " ingredients into Supabase.");
}

main().catch((err) => {
  console.error("Sync failed:", err.message);
  process.exit(1);
});
