import Calculator from "../components/Calculator";
import AuthGate from "../components/AuthGate";
import { customers } from "../lib/customers";

// ATIS is the only customer today, so the main page shows their branding
// directly. Future customers get their own page at /<slug> (see
// pages/[customer].js) without touching this file. AuthGate asks for the
// customer's shared username/password before showing the calculator.
export default function Home() {
  return (
    <AuthGate customer={customers.atis}>
      <Calculator customer={customers.atis} />
    </AuthGate>
  );
}
