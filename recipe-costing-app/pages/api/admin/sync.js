// Triggers an RCC -> Supabase price sync from the browser (the /admin page).
// Protected by a simple shared password (ADMIN_SYNC_PASSWORD) so random
// visitors can't trigger it. The real RCC key never leaves the server -
// it's read from the RCC_API_KEY environment variable, the same one used
// by the terminal script.

import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
const { runSync } = require("../../../lib/rccSync");

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { password } = req.body || {};
  const adminPassword = process.env.ADMIN_SYNC_PASSWORD;

  if (!adminPassword) {
    return res.status(500).json({ error: "ADMIN_SYNC_PASSWORD is not set in Vercel yet." });
  }
  if (password !== adminPassword) {
    return res.status(401).json({ error: "Incorrect password." });
  }

  const rccApiKey = process.env.RCC_API_KEY;
  if (!rccApiKey) {
    return res.status(500).json({ error: "RCC_API_KEY is not set in Vercel yet." });
  }

  try {
    const supabase = getSupabaseAdmin();
    const result = await runSync(supabase, rccApiKey);
    return res.status(200).json({ synced: result.synced, fetched: result.fetched });
  } catch (err) {
    console.error("POST /api/admin/sync failed:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
