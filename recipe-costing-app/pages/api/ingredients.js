// Returns ingredient names + units only - no pricing. This is safe to call
// from the browser: the dropdown needs names, not costs. Actual pricing is
// only ever calculated server-side, in /api/price.

import { getSupabaseAdmin } from "../../lib/supabaseAdmin";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("ingredients")
      .select("rcc_id, name, unit_name")
      .order("name", { ascending: true });

    if (error) throw error;

    return res.status(200).json(data);
  } catch (err) {
    console.error("GET /api/ingredients failed:", err.message);
    return res.status(500).json({ error: "Failed to load ingredients" });
  }
}
