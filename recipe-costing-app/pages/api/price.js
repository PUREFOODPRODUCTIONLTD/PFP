// Calculates a recipe's price server-side. The browser sends ingredient
// IDs + quantities and gets back marked-up prices only - raw supplier
// cost and the margin percentage never leave this function.

import { getSupabaseAdmin } from "../../lib/supabaseAdmin";

function round2(n) {
  return Math.round(n * 100) / 100;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { ingredients, prepMinutes, portions } = req.body || {};

  if (!Array.isArray(ingredients)) {
    return res.status(400).json({ error: "ingredients must be an array" });
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data: settings, error: settingsError } = await supabase
      .from("settings")
      .select("margin_pct, labour_rate_per_hour, currency_symbol")
      .eq("id", 1)
      .single();
    if (settingsError) throw settingsError;

    const marginPct = Number(settings.margin_pct) || 0;
    const labourRate = Number(settings.labour_rate_per_hour) || 0;

    const rccIds = ingredients
      .map((i) => i.rcc_id)
      .filter((id) => typeof id === "number");

    let priceMap = {};
    if (rccIds.length) {
      const { data: priceRows, error: priceError } = await supabase
        .from("ingredients")
        .select("rcc_id, name, unit_name, price_per_unit")
        .in("rcc_id", rccIds);
      if (priceError) throw priceError;
      priceMap = Object.fromEntries(priceRows.map((r) => [r.rcc_id, r]));
    }

    let ingredientsSubtotal = 0;
    const lineItems = ingredients.map((item) => {
      const match = priceMap[item.rcc_id];
      const quantity = Number(item.quantity) || 0;

      if (!match) {
        return { rcc_id: item.rcc_id, name: null, unit: null, quantity, price: 0, error: "Ingredient not found" };
      }

      const markedUpUnitPrice = match.price_per_unit * (1 + marginPct);
      const lineTotal = markedUpUnitPrice * quantity;
      ingredientsSubtotal += lineTotal;

      return {
        rcc_id: item.rcc_id,
        name: match.name,
        unit: match.unit_name,
        quantity,
        price: round2(lineTotal)
      };
    });

    const minutes = Number(prepMinutes) || 0;
    const labourCost = (minutes / 60) * labourRate * (1 + marginPct);
    const total = ingredientsSubtotal + labourCost;
    const portionCount = Number(portions) > 0 ? Number(portions) : 1;

    return res.status(200).json({
      currencySymbol: settings.currency_symbol || "£",
      lineItems,
      ingredientsSubtotal: round2(ingredientsSubtotal),
      labourCost: round2(labourCost),
      total: round2(total),
      perPortion: round2(total / portionCount)
    });
  } catch (err) {
    console.error("POST /api/price failed:", err.message);
    return res.status(500).json({ error: "Failed to calculate price" });
  }
}
