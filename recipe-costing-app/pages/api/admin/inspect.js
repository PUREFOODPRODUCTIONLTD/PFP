// Admin-only diagnostic endpoint: search the ingredients table by name and
// see the raw stored fields (pack size, pack price, computed price per
// unit). Same password gate as /api/admin/sync. This is for tracking down
// pricing bugs - never linked from the customer-facing app.

import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { password, q } = req.query;
  const adminPassword = process.env.ADMIN_SYNC_PASSWORD;

  if (!adminPassword) {
    return res.status(500).json({ error: "ADMIN_SYNC_PASSWORD is not set in Vercel yet." });
  }
  if (password !== adminPassword) {
    return res.status(401).json({ error: "Incorrect password." });
  }

  try {
    const supabase = getSupabaseAdmin();
    let query = supabase
      .from("ingredients")
      .select("rcc_id, name, category, unit_name, price_per_unit, pack_size, pack_price, synced_at")
      .order("name")
      .limit(30);

    if (typeof q === "string" && q.trim()) {
      query = query.ilike("name", "%" + q.trim() + "%");
    }

    const { data, error } = await query;
    if (error) throw error;

    return res.status(200).json(data);
  } catch (err) {
    console.error("GET /api/admin/inspect failed:", err.message);
    return res.status(500).json({ error: "Failed to inspect ingredients" });
  }
}
