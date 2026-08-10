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

  // RCC's own `price_per_unit` field is unreliable: for "Kilogram" and
  // "Liter" ingredients it's actually priced per gram / per millilitre
  // (1000x too low) even though unit_name says Kilogram/Liter. Rather than
  // guess which units RCC silently rescales, we compute the price per the
  // labelled unit ourselves directly from pack price and total pack
  // quantity, which is unambiguous and matches what the calculator
  // displays and charges for. We only fall back to RCC's price_per_unit if
  // pack data is missing.
  //
  // Total pack quantity is pack_size * case_count, NOT pack_size alone.
  // RCC's own item page shows this multiplied-out total (e.g. "6L" for a
  // pack_size of 1 with a case_count of 6) - if we only divide by
  // pack_size, a 6-pack priced as "case_count: 6, pack_size: 1" comes out
  // 6x too expensive per unit. case_count defaults to 1 when missing.
  const rows = ingredients
    .filter((i) => {
      const packPrice = Number(i.price);
      const packSize = Number(i.pack_size);
      const hasPackData = Number.isFinite(packPrice) && Number.isFinite(packSize) && packSize > 0;
      const hasRccPpu = i.price_per_unit !== null && i.price_per_unit !== undefined && !Number.isNaN(Number(i.price_per_unit));
      return hasPackData || hasRccPpu;
    })
    .map((i) => {
      const packPrice = Number(i.price);
      const packSize = Number(i.pack_size);
      const caseCount = Number.isFinite(Number(i.case_count)) && Number(i.case_count) > 0 ? Number(i.case_count) : 1;
      const hasPackData = Number.isFinite(packPrice) && Number.isFinite(packSize) && packSize > 0;
      const totalQuantity = packSize * caseCount;
      const pricePerUnit = hasPackData ? packPrice / totalQuantity : Number(i.price_per_unit);
      return {
        rcc_id: i.id,
        name: i.name,
        category: i.category_name || null,
        unit_name: i.unit_name || null,
        price_per_unit: pricePerUnit,
        pack_size: hasPackData ? totalQuantity : i.pack_size || null,
        pack_price: i.price || null,
        synced_at: new Date().toISOString()
      };
    });

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
