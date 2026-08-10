import { useEffect, useState } from "react";

// Simple shared-password gate for a customer's page. There's no individual
// login system yet - one username/password per customer, checked
// server-side against env vars (CUSTOMER_<SLUG>_USERNAME /
// CUSTOMER_<SLUG>_PASSWORD) and remembered via a signed cookie so staff
// don't have to log in again every visit.
export default function AuthGate({ customer, children }) {
  const [status, setStatus] = useState("checking"); // checking | authorized | locked
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/check?slug=" + encodeURIComponent(customer.slug))
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setStatus(data.authorized ? "authorized" : "locked");
      })
      .catch(() => {
        if (!cancelled) setStatus("locked");
      });
    return () => {
      cancelled = true;
    };
  }, [customer.slug]);

  function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: customer.slug, username, password })
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Incorrect username or password.");
        }
        return res.json();
      })
      .then(() => setStatus("authorized"))
      .catch((err) => setError(err.message))
      .finally(() => setSubmitting(false));
  }

  const colors = customer.colors || {};
  const themeStyle = {
    "--forest": colors.forest,
    "--forest-dark": colors.forestDark,
    "--amber-dark": colors.amberDark,
    "--badge-bg": colors.badgeBg,
    "--badge-border": colors.badgeBorder
  };

  if (status === "checking") {
    return (
      <div className="wrap" style={themeStyle}>
        <p className="status-note" style={{ marginTop: 40 }}>
          Loading…
        </p>
      </div>
    );
  }

  if (status === "authorized") {
    return children;
  }

  return (
    <div className="wrap" style={themeStyle}>
      <div className="login-panel">
        {customer.logo && <img src={customer.logo} alt={customer.name + " logo"} className="brand-logo" />}
        <h1>{customer.name} recipe pricing</h1>
        <p className="lede">Sign in to access your recipe cost calculator.</p>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="loginUsername">Username</label>
            <input
              id="loginUsername"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </div>
          <div className="field">
            <label htmlFor="loginPassword">Password</label>
            <input
              id="loginPassword"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          {error && <p className="status-note">{error}</p>}
          <button type="submit" className="save-btn" disabled={submitting} style={{ width: "100%" }}>
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
