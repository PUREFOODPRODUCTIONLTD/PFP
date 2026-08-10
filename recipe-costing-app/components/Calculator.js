import { useEffect, useMemo, useState } from "react";

let rowIdCounter = 0;
function nextRowId() {
  rowIdCounter += 1;
  return rowIdCounter;
}

function emptyRow() {
  return { id: nextRowId(), rccId: "", quantity: "" };
}

function formatMoney(amount, symbol) {
  const value = Number.isFinite(amount) ? amount : 0;
  return symbol + value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Renders the customer recipe pricing calculator, themed per customer.
// `customer` comes from lib/customers.js - it controls the name, tagline,
// logo and colors shown, but the pricing logic and API calls are identical
// for every customer.
//
// Pricing model: cost of goods + a fixed margin (set server-side) only -
// there is no labour cost on this calculator. Batches are costed by yield
// in kilograms, and recipes can be saved/reloaded per customer so staff can
// come back and tweak them later.
export default function Calculator({ customer }) {
  const [recipeId, setRecipeId] = useState(null);
  const [recipeName, setRecipeName] = useState("");
  const [batchYieldKg, setBatchYieldKg] = useState("");
  const [rows, setRows] = useState([emptyRow(), emptyRow(), emptyRow()]);

  const [ingredientOptions, setIngredientOptions] = useState([]);
  const [loadingIngredients, setLoadingIngredients] = useState(true);
  const [ingredientsError, setIngredientsError] = useState(null);

  const [pricing, setPricing] = useState(null);
  const [pricingError, setPricingError] = useState(null);

  const [savedRecipes, setSavedRecipes] = useState([]);
  const [recipesError, setRecipesError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ingredients")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load ingredients");
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setIngredientOptions(data);
      })
      .catch((err) => {
        if (!cancelled) setIngredientsError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoadingIngredients(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function refreshSavedRecipes() {
    fetch("/api/recipes?customer=" + encodeURIComponent(customer.slug))
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load saved recipes");
        return res.json();
      })
      .then((data) => setSavedRecipes(data))
      .catch((err) => setRecipesError(err.message));
  }

  useEffect(() => {
    refreshSavedRecipes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer.slug]);

  const validRows = useMemo(
    () => rows.filter((r) => r.rccId !== "" && Number(r.quantity) > 0),
    [rows]
  );

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      fetch("/api/price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          ingredients: validRows.map((r) => ({ rcc_id: Number(r.rccId), quantity: Number(r.quantity) })),
          batchYieldKg: Number(batchYieldKg) || 1
        })
      })
        .then((res) => {
          if (!res.ok) throw new Error("Failed to calculate price");
          return res.json();
        })
        .then((data) => {
          setPricing(data);
          setPricingError(null);
        })
        .catch((err) => {
          if (err.name !== "AbortError") setPricingError(err.message);
        });
    }, 250);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [validRows, batchYieldKg]);

  function updateRow(id, patch) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function removeRow(id) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }

  function priceForRow(rccId) {
    if (!pricing) return null;
    const match = pricing.lineItems.find((li) => String(li.rcc_id) === String(rccId));
    return match || null;
  }

  function ingredientName(rccId) {
    const opt = ingredientOptions.find((o) => String(o.rcc_id) === String(rccId));
    return opt ? opt.name : "—";
  }

  function handleNewRecipe() {
    setRecipeId(null);
    setRecipeName("");
    setBatchYieldKg("");
    setRows([emptyRow(), emptyRow(), emptyRow()]);
    setSaveMessage(null);
  }

  function handleLoadRecipe(id) {
    if (!id) {
      handleNewRecipe();
      return;
    }
    fetch("/api/recipes/" + id)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load recipe");
        return res.json();
      })
      .then((data) => {
        setRecipeId(data.id);
        setRecipeName(data.name);
        setBatchYieldKg(String(data.batchYieldKg));
        const loadedRows = data.ingredients.map((i) => ({
          id: nextRowId(),
          rccId: String(i.rcc_id),
          quantity: String(i.quantity)
        }));
        setRows(loadedRows.length ? loadedRows : [emptyRow(), emptyRow(), emptyRow()]);
        setSaveMessage(null);
      })
      .catch((err) => setRecipesError(err.message));
  }

  function handleSaveRecipe() {
    if (!recipeName.trim()) {
      setSaveMessage("Give the recipe a name first.");
      return;
    }
    if (!validRows.length) {
      setSaveMessage("Add at least one ingredient first.");
      return;
    }

    setSaving(true);
    setSaveMessage(null);

    const payload = {
      customerSlug: customer.slug,
      name: recipeName.trim(),
      batchYieldKg: Number(batchYieldKg) || 1,
      ingredients: validRows.map((r) => ({ rcc_id: Number(r.rccId), quantity: Number(r.quantity) }))
    };

    const request = recipeId
      ? fetch("/api/recipes/" + recipeId, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        })
      : fetch("/api/recipes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

    request
      .then((res) => {
        if (!res.ok) throw new Error("Failed to save recipe");
        return res.json();
      })
      .then((data) => {
        setRecipeId(data.id);
        setSaveMessage("Saved.");
        refreshSavedRecipes();
      })
      .catch((err) => setSaveMessage(err.message))
      .finally(() => setSaving(false));
  }

  const symbol = pricing?.currencySymbol || "£";
  const colors = customer.colors || {};

  const themeStyle = {
    "--forest": colors.forest,
    "--forest-dark": colors.forestDark,
    "--amber-dark": colors.amberDark,
    "--badge-bg": colors.badgeBg,
    "--badge-border": colors.badgeBorder
  };

  return (
    <div className="wrap" style={themeStyle}>
      <div className="no-print">
        <header>
          <span className="badge">Live pricing</span>
          <div className="brand-row">
            {customer.logo && (
              <img src={customer.logo} alt={customer.name + " logo"} className="brand-logo" />
            )}
            <div>
              <div className="brand-name">{customer.name}</div>
              <div className="brand-sub">{customer.tagline}</div>
            </div>
          </div>
          <h1>Recipe cost calculator</h1>
          <p className="lede">
            Build your recipe below — pricing updates automatically using current supplier costs.
          </p>
        </header>

        <div className="panel">
          <h2>Saved recipes</h2>
          <div className="field-row">
            <div className="field">
              <label htmlFor="savedRecipe">Load a recipe</label>
              <select
                id="savedRecipe"
                value={recipeId || ""}
                onChange={(e) => handleLoadRecipe(e.target.value)}
              >
                <option value="">Start a new recipe…</option>
                {savedRecipes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ maxWidth: 140 }}>
              <label>&nbsp;</label>
              <button type="button" className="new-recipe-btn" onClick={handleNewRecipe}>
                + New recipe
              </button>
            </div>
          </div>
          {recipesError && <p className="status-note">{recipesError}</p>}
        </div>

        <div className="panel">
          <h2>Recipe details</h2>
          <div className="field-row">
            <div className="field">
              <label htmlFor="recipeName">Recipe name</label>
              <input
                id="recipeName"
                type="text"
                value={recipeName}
                onChange={(e) => setRecipeName(e.target.value)}
                placeholder="e.g. Beef Lasagne (Catering Tray)"
              />
            </div>
            <div className="field" style={{ maxWidth: 180 }}>
              <label htmlFor="batchYieldKg">Batch yield (kg)</label>
              <input
                id="batchYieldKg"
                type="number"
                min="0"
                step="0.01"
                value={batchYieldKg}
                onChange={(e) => setBatchYieldKg(e.target.value)}
                placeholder="e.g. 5"
              />
            </div>
          </div>
        </div>

        <div className="panel">
          <h2>Ingredients</h2>
          {loadingIngredients && <p className="status-note">Loading ingredients…</p>}
          {ingredientsError && (
            <p className="status-note">
              Couldn&apos;t load ingredients ({ingredientsError}). Check the Supabase connection and that the sync
              script has run at least once.
            </p>
          )}
          <table>
            <thead>
              <tr>
                <th className="col-ing">Ingredient</th>
                <th className="col-qty">Quantity</th>
                <th className="col-unit">Unit</th>
                <th className="col-price">Price</th>
                <th className="col-remove"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const priced = priceForRow(row.rccId);
                return (
                  <tr key={row.id}>
                    <td className="col-ing">
                      <select
                        value={row.rccId}
                        onChange={(e) => updateRow(row.id, { rccId: e.target.value })}
                      >
                        <option value="">Select…</option>
                        {ingredientOptions.map((opt) => (
                          <option key={opt.rcc_id} value={opt.rcc_id}>
                            {opt.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="col-qty">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.quantity}
                        onChange={(e) => updateRow(row.id, { quantity: e.target.value })}
                      />
                    </td>
                    <td className="col-unit unit-cell">{priced?.unit || "—"}</td>
                    <td className="col-price price-cell">{formatMoney(priced?.price, symbol)}</td>
                    <td className="col-remove">
                      <button type="button" className="remove-btn" title="Remove" onClick={() => removeRow(row.id)}>
                        ×
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <button type="button" className="add-row" onClick={addRow}>
            + Add ingredient
          </button>
        </div>

        {pricingError && (
          <div className="panel">
            <p className="status-note">{pricingError}</p>
          </div>
        )}

        <div className="total-card">
          <div>
            <div className="label">Total recipe price</div>
            <div className="per-portion">{formatMoney(pricing?.perKg, symbol)} per kg</div>
          </div>
          <div className="amount">{formatMoney(pricing?.total, symbol)}</div>
        </div>

        <div className="actions-row">
          <button type="button" className="save-btn" onClick={handleSaveRecipe} disabled={saving}>
            {saving ? "Saving…" : recipeId ? "Update recipe" : "Save recipe"}
          </button>
          <button type="button" className="print-btn" onClick={() => window.print()}>
            Print / Save as PDF
          </button>
        </div>
        {saveMessage && <p className="status-note">{saveMessage}</p>}

        <footer>
          Prices reflect current supplier costs and are updated regularly.
          <br />
          Raw supplier costs and margin are never sent to your browser — only the price above.
        </footer>
      </div>

      <div className="print-sheet">
        <div className="print-brand">
          {customer.logo && <img src={customer.logo} alt="" />}
          <div>
            <div className="print-brand-name">{customer.name}</div>
            <div className="print-brand-sub">{customer.tagline}</div>
          </div>
        </div>
        <h1>{recipeName.trim() || "Untitled recipe"}</h1>
        <p className="print-yield">Batch yield: {batchYieldKg || "—"} kg</p>
        <table>
          <thead>
            <tr>
              <th>Ingredient</th>
              <th>Quantity</th>
              <th>Unit</th>
              <th>Price</th>
            </tr>
          </thead>
          <tbody>
            {validRows.map((row) => {
              const priced = priceForRow(row.rccId);
              return (
                <tr key={row.id}>
                  <td>{ingredientName(row.rccId)}</td>
                  <td>{row.quantity}</td>
                  <td>{priced?.unit || "—"}</td>
                  <td>{formatMoney(priced?.price, symbol)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="print-total">
          <span>Total price</span>
          <span>{formatMoney(pricing?.total, symbol)}</span>
        </div>
        <div className="print-total sub">
          <span>Price per kg</span>
          <span>{formatMoney(pricing?.perKg, symbol)}</span>
        </div>
      </div>
    </div>
  );
}
