// Checks a customer's shared username/password (one set of credentials per
// customer, no individual accounts yet) and, on success, sets a signed
// cookie so the browser stays logged in. The cookie value is an HMAC of the
// customer slug, so it can't be guessed or forged without the server-side
// secret, but there's no long-term session store - just this cookie.

const crypto = require("crypto");

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { slug, username, password } = req.body || {};
  if (!slug || typeof slug !== "string") {
    return res.status(400).json({ error: "Missing customer" });
  }

  const key = slug.toUpperCase().replace(/[^A-Z0-9]/g, "_");
  const expectedUsername = process.env["CUSTOMER_" + key + "_USERNAME"];
  const expectedPassword = process.env["CUSTOMER_" + key + "_PASSWORD"];
  const secret = process.env.CUSTOMER_AUTH_SECRET;

  if (!expectedUsername || !expectedPassword || !secret) {
    return res.status(500).json({ error: "Login is not configured for this customer yet." });
  }

  if (username !== expectedUsername || password !== expectedPassword) {
    return res.status(401).json({ error: "Incorrect username or password." });
  }

  const token = crypto.createHmac("sha256", secret).update(slug).digest("hex");
  const maxAge = 60 * 60 * 24 * 30; // 30 days
  res.setHeader(
    "Set-Cookie",
    "pfp_auth_" + slug + "=" + token + "; Path=/; Max-Age=" + maxAge + "; HttpOnly; SameSite=Lax; Secure"
  );
  return res.status(200).json({ ok: true });
}
