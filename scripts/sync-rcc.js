// Pulls current ingredient pricing from Recipe Cost Calculator (RCC) and
// mirrors it into the Supabase "ingredients" table.
//
// Run manually with: npm run sync-prices
// Most people should use the /admin page in the deployed app instead -
// this script is only needed for local development.
//
// Requires RCC_API_KEY, NEXT_PUBLIC_SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY to be set (see .env.example).

require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const { runSync } = require("../lib/rccSync");

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

async function main() {
  requireEnv();
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });

  console.log("Fetching ingredients from Recipe Cost Calculator...");
  const { synced } = await runSync(supabase, RCC_API_KEY);
  console.log("Synced " + synced + " ingredients into Supabase.");
}

main().catch((err) => {
  console.error("Sync failed:", err.message);
  process.exit(1);
});
