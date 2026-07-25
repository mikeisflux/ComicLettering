import type { Metadata } from "next";
import PayPalButtons from "./PayPalButtons";

export const metadata: Metadata = {
  title: "Pricing — $20/month or $160/year",
  description:
    "LetterMyComic pricing: full access to the browser comic lettering studio for $20 per month or $160 per year (save $80). Pay securely with PayPal. Cancel anytime.",
  alternates: { canonical: "/pricing" },
};

const FEATURES = [
  "The full lettering studio — balloons, styles, fonts, layouts, fills",
  "Cloud project library with thumbnails",
  "Full-resolution PNG page export",
  "Unlimited pages and projects",
  "All future features included",
];

export default function Pricing() {
  return (
    <main className="mktSection">
      <h2 style={{ textAlign: "center" }}>Simple, Honest Pricing</h2>
      <p className="sub" style={{ textAlign: "center", margin: "0 auto 36px" }}>
        One subscription, everything included. Pay securely with PayPal and cancel anytime.
      </p>
      <div className="priceGrid">
        <div className="priceCard">
          <div className="plan">Monthly</div>
          <div className="amount">$20</div>
          <div className="per">per month</div>
          <ul>{FEATURES.map((f) => <li key={f}>{f}</li>)}</ul>
          <PayPalButtons plan="monthly" />
        </div>
        <div className="priceCard best">
          <div className="plan">Yearly</div>
          <div className="amount">$160</div>
          <div className="per">per year</div>
          <div className="save">Save $80 — 4 months free vs monthly</div>
          <ul>{FEATURES.map((f) => <li key={f}>{f}</li>)}</ul>
          <PayPalButtons plan="yearly" />
        </div>
      </div>
      <p className="ppNote">
        Payments are processed by PayPal. Subscriptions renew automatically until cancelled;
        you can cancel from your PayPal account at any time. No free trial — but you can
        browse every feature on the <a href="/features">features page</a> before you commit.
      </p>
    </main>
  );
}
