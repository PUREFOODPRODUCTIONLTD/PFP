// Save/list a customer's recipes. There is no individual customer login
// yet, so recipes are scoped by customer (e.g. "atis"), not by a specific
// person - anyone on that customer's branded page can see and edit them.
// Only ever accessed with the service-role key server-side.

import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";

export default async function handler(req, res) {
  const supabase = getSupabaseAdmin();

  if (req.method === "GET") {
    const customerSlug = typeof req.query.customer === "string" ? req.query.customer : "atis";

    const { data, error } = await supabase
      .from("recipes")
      .select("id, name, batch_yield_kg, updated_at")
      .eq("customer_slug", customerSlug)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("GET /api/recipes failed:", error.message);
      return res.status(500).json({ error: "Failed to load recipes" });
    }

    return res.status(200).json(
      data.map((r) => ({
        id: r.id,
        name: r.name,
        batchYieldKg: r.batch_yield_kg,
        updatedAt: r.updated_at
      }))
    );
  }

  if (req.method === "POST") {
    const { customerSlug, name, batchYieldKg, ingredients } = req.body || {};

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "Recipe name is required" });
    }
    if (!Array.isArray(ingredients)) {
      return res.status(400).json({ error: "ingredients must be an array" });
    }

    const { data: recipe, error: recipeError } = await supabase
      .from("recipes")
      .insert({
        name: name.trim(),
        customer_slug: customerSlug || "atis",
        batch_yield_kg: Number(batchYieldKg) > 0 ? Number(batchYieldKg) : 1
      })
      .select()
      .single();

    if (recipeError) {
      console.error("POST /api/recipes failed:", recipeError.message);
      return res.status(500).json({ error: "Failed to save recipe" });
    }

    const rows = ingredients
      .filter((i) => i.rcc_id && Number(i.quantity) > 0)
      .map((i) => ({
        recipe_id: recipe.id,
        ingredient_rcc_id: Number(i.rcc_id),
        quantity: Number(i.quantity)
      }));

    if (rows.length) {
      const { error: linesError } = await supabase.from("recipe_ingredients").insert(rows);
      if (linesError) {
        console.error("POST /api/recipes (lines) failed:", linesError.message);
        return res.status(500).json({ error: "Failed to save recipe ingredients" });
      }
    }

    return res.status(200).json({ id: recipe.id });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
