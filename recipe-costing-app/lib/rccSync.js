// Shared RCC -> Supabase sync logic, used by both the /admin "Sync now"
// button (pages/api/admin/sync.js) and the terminal script
// (scripts/sync-rcc.js). Keeping this in one place means both paths stay
// in sync with each other.

const RCC_BASE_URL = "https://recipecostcalculator.net";

async function fetchAllIngredients(rccApiKey) {
  const res = await fetch(RCC_BASE_URL + "/api/v1/ingredients", {
    headers: { "x-api-key": rccApiKey }
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error("RCC API error " + res.status + ": " + body);
  }
  return res.json();
}

async function runSync(supabase, rccApiKey) {
  const ingredients = await fetchAllIngredients(rccApiKey);
  const fetched = Array.isArray(ingredients) ? ingredients.length : 0;

  const rows = ingredients
    .filter((i) => i.price_per_unit !== null && i.price_per_unit !== undefined && !Number.isNaN(Number(i.price_per_unit)))
    .map((i) => ({
      rcc_id: i.id,
      name: i.name,
      category: i.category_name || null,
      unit_name: i.unit_name || null,
      price_per_unit: Number(i.price_per_unit),
      pack_size: i.pack_size || null,
      pack_price: i.price || null,
      synced_at: new Date().toISOString()
    }));

  if (!rows.length) {
    return { synced: 0, fetched };
  }

  const { error } = await supabase
    .from("ingredients")
    .upsert(rows, { onConflict: "rcc_id" });

  if (error) {
    throw new Error("Supabase upsert failed: " + error.message);
  }

  return { synced: rows.length, fetched };
}

module.exports = { runSync, fetchAllIngredients };
