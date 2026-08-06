import Calculator from "../components/Calculator";
import { customers } from "../lib/customers";

// ATIS is the only customer today, so the main page shows their branding
// directly. Future customers get their own page at /<slug> (see
// pages/[customer].js) without touching this file.
export default function Home() {
  return <Calculator customer={customers.atis} />;
}
