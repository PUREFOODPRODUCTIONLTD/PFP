import { useState } from "react";

export default function Admin() {
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSync() {
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch("/api/admin/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      setStatus({
        type: "success",
        message: `RCC sent back ${data.fetched} ingredient(s). ${data.synced} had a price and were saved.`
      });
    } catch (err) {
      setStatus({ type: "error", message: err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="wrap">
      <header>
        <span className="badge">Admin only</span>
        <div>
          <div className="brand-name">Pure Food Production</div>
          <div className="brand-sub">Price sync</div>
        </div>
        <h1>Sync prices from RCC</h1>
        <p className="lede">
          Pulls your current supplier prices from Recipe Cost Calculator into the pricing
          tool. Customers never see this page.
        </p>
      </header>

      <div className="panel">
        <h2>Admin password</h2>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter admin password"
            onKeyDown={(e) => {
              if (e.key === "Enter" && password && !loading) handleSync();
            }}
          />
        </div>
        <button
          type="button"
          className="add-row"
          style={{ marginTop: 16 }}
          onClick={handleSync}
          disabled={loading || !password}
        >
          {loading ? "Syncing…" : "Sync now"}
        </button>
        {status && (
          <p
            className="status-note"
            style={{
              color: status.type === "error" ? "#b3441f" : "#1f4d3e",
              marginTop: 14,
              fontWeight: 600
            }}
          >
            {status.message}
          </p>
        )}
      </div>
    </div>
  );
}
