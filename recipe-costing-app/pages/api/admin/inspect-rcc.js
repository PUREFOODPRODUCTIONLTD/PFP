// Admin-only diagnostic endpoint: hits RCC's live API directly (not our
// Supabase mirror) and returns the raw, unfiltered fields for ingredients
// matching a name search. Used to check for fields our sync isn't
// capturing yet (e.g. a case/pack multiplier) when stored prices look
// wrong. Same password gate as /api/admin/sync. Never linked from the
// customer-facing app.

const { fetchAllIngredients } = require("../../../lib/rccSync");

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

  const rccApiKey = process.env.RCC_API_KEY;
  if (!rccApiKey) {
    return res.status(500).json({ error: "RCC_API_KEY is not set in Vercel yet." });
  }

  try {
    const ingredients = await fetchAllIngredients(rccApiKey);
    const needle = typeof q === "string" ? q.trim().toLowerCase() : "";
    const matches = needle
      ? ingredients.filter((i) => (i.name || "").toLowerCase().includes(needle))
      : ingredients.slice(0, 10);

    return res.status(200).json(matches.slice(0, 20));
  } catch (err) {
    console.error("GET /api/admin/inspect-rcc failed:", err.message);
    return res.status(500).json({ error: "Failed to fetch from RCC" });
  }
}
