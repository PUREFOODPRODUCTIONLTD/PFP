// Load, update, or delete a single saved recipe.

import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";

export default async function handler(req, res) {
  const supabase = getSupabaseAdmin();
  const { id } = req.query;

  if (req.method === "GET") {
    const { data: recipe, error: recipeError } = await supabase
      .from("recipes")
      .select("id, name, batch_yield_kg, customer_slug, updated_at")
      .eq("id", id)
      .single();

    if (recipeError) {
      console.error("GET /api/recipes/[id] failed:", recipeError.message);
      return res.status(404).json({ error: "Recipe not found" });
    }

    const { data: lines, error: linesError } = await supabase
      .from("recipe_ingredients")
      .select("ingredient_rcc_id, quantity")
      .eq("recipe_id", id);

    if (linesError) {
      console.error("GET /api/recipes/[id] (lines) failed:", linesError.message);
      return res.status(500).json({ error: "Failed to load recipe ingredients" });
    }

    return res.status(200).json({
      id: recipe.id,
      name: recipe.name,
      batchYieldKg: recipe.batch_yield_kg,
      updatedAt: recipe.updated_at,
      ingredients: lines.map((l) => ({ rcc_id: l.ingredient_rcc_id, quantity: l.quantity }))
    });
  }

  if (req.method === "PUT") {
    const { name, batchYieldKg, ingredients } = req.body || {};

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "Recipe name is required" });
    }
    if (!Array.isArray(ingredients)) {
      return res.status(400).json({ error: "ingredients must be an array" });
    }

    const { error: updateError } = await supabase
      .from("recipes")
      .update({
        name: name.trim(),
        batch_yield_kg: Number(batchYieldKg) > 0 ? Number(batchYieldKg) : 1,
        updated_at: new Date().toISOString()
      })
      .eq("id", id);

    if (updateError) {
      console.error("PUT /api/recipes/[id] failed:", updateError.message);
      return res.status(500).json({ error: "Failed to update recipe" });
    }

    const { error: deleteError } = await supabase.from("recipe_ingredients").delete().eq("recipe_id", id);
    if (deleteError) {
      console.error("PUT /api/recipes/[id] (clear lines) failed:", deleteError.message);
      return res.status(500).json({ error: "Failed to update recipe ingredients" });
    }

    const rows = ingredients
      .filter((i) => i.rcc_id && Number(i.quantity) > 0)
      .map((i) => ({
        recipe_id: id,
        ingredient_rcc_id: Number(i.rcc_id),
        quantity: Number(i.quantity)
      }));

    if (rows.length) {
      const { error: insertError } = await supabase.from("recipe_ingredients").insert(rows);
      if (insertError) {
        console.error("PUT /api/recipes/[id] (insert lines) failed:", insertError.message);
        return res.status(500).json({ error: "Failed to update recipe ingredients" });
      }
    }

    return res.status(200).json({ id });
  }

  if (req.method === "DELETE") {
    const { error } = await supabase.from("recipes").delete().eq("id", id);
    if (error) {
      console.error("DELETE /api/recipes/[id] failed:", error.message);
      return res.status(500).json({ error: "Failed to delete recipe" });
    }
    return res.status(200).json({ id });
  }

  res.setHeader("Allow", "GET, PUT, DELETE");
  return res.status(405).json({ error: "Method not allowed" });
}
