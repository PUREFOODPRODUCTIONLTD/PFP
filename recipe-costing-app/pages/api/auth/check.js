// Checks whether the browser already has a valid login cookie for a
// customer's page, so the login form doesn't show every single visit.

const crypto = require("crypto");

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ authorized: false });
  }

  const { slug } = req.query;
  if (!slug || typeof slug !== "string") {
    return res.status(200).json({ authorized: false });
  }

  const secret = process.env.CUSTOMER_AUTH_SECRET;
  if (!secret) {
    return res.status(200).json({ authorized: false });
  }

  const cookies = parseCookies(req.headers.cookie || "");
  const expectedToken = crypto.createHmac("sha256", secret).update(slug).digest("hex");
  const authorized = cookies["pfp_auth_" + slug] === expectedToken;

  return res.status(200).json({ authorized });
}

function parseCookies(header) {
  const out = {};
  header.split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx === -1) return;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  });
  return out;
}
