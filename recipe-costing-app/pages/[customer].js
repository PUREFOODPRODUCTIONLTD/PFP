import { useRouter } from "next/router";
import Calculator from "../components/Calculator";
import { getCustomer } from "../lib/customers";

// Per-customer branded pricing page, e.g. /atis. Add a new customer in
// lib/customers.js and it's reachable here automatically - no new page
// needed. Once real customer logins exist, they can redirect here.
export default function CustomerPage() {
  const router = useRouter();
  const { customer: slug } = router.query;

  if (!router.isReady) return null;

  const customer = typeof slug === "string" ? getCustomer(slug) : null;

  if (!customer) {
    return (
      <div className="wrap">
        <p className="status-note" style={{ marginTop: 40 }}>
          No pricing page set up for &quot;{slug}&quot; yet.
        </p>
      </div>
    );
  }

  return <Calculator customer={customer} />;
}
