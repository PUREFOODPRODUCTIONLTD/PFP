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

export default function Home() {
  const [recipeName, setRecipeName] = useState("");
  const [portions, setPortions] = useState(1);
  const [prepMinutes, setPrepMinutes] = useState(0);
  const [rows, setRows] = useState([emptyRow(), emptyRow(), emptyRow()]);

  const [ingredientOptions, setIngredientOptions] = useState([]);
  const [loadingIngredients, setLoadingIngredients] = useState(true);
  const [ingredientsError, setIngredientsError] = useState(null);

  const [pricing, setPricing] = useState(null);
  const [pricingError, setPricingError] = useState(null);

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
          prepMinutes: Number(prepMinutes) || 0,
          portions: Number(portions) || 1
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
  }, [validRows, prepMinutes, portions]);

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

  const symbol = pricing?.currencySymbol || "£";

  return (
    <div className="wrap">
      <header>
        <span className="badge">Live pricing</span>
        <div>
          <div className="brand-name">Pure Food Production</div>
          <div className="brand-sub">Customer recipe pricing tool</div>
        </div>
        <h1>Recipe cost calculator</h1>
        <p className="lede">
          Build your recipe below — pricing updates automatically using current supplier costs.
        </p>
      </header>

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
            <label htmlFor="portions">Portions / batch yield</label>
            <input
              id="portions"
              type="number"
              min="1"
              value={portions}
              onChange={(e) => setPortions(e.target.value)}
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

      <div className="panel">
        <div className="totals-line sub">
          <span>Ingredients subtotal</span>
          <span className="val">{formatMoney(pricing?.ingredientsSubtotal, symbol)}</span>
        </div>
        <div className="field-row" style={{ margin: "14px 0" }}>
          <div className="field" style={{ maxWidth: 220 }}>
            <label htmlFor="prepTime">Prep time (minutes)</label>
            <input
              id="prepTime"
              type="number"
              min="0"
              value={prepMinutes}
              onChange={(e) => setPrepMinutes(e.target.value)}
            />
          </div>
        </div>
        <div className="totals-line sub">
          <span>Labour cost</span>
          <span className="val">{formatMoney(pricing?.labourCost, symbol)}</span>
        </div>
        {pricingError && <p className="status-note">{pricingError}</p>}
      </div>

      <div className="total-card">
        <div>
          <div className="label">Total recipe price</div>
          <div className="per-portion">{formatMoney(pricing?.perPortion, symbol)} per portion</div>
        </div>
        <div className="amount">{formatMoney(pricing?.total, symbol)}</div>
      </div>

      <footer>
        Prices reflect current supplier costs and are updated regularly.
        <br />
        Raw supplier costs and margin are never sent to your browser — only the price above.
      </footer>
    </div>
  );
}
