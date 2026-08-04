import type { Metadata } from "next";
import PayPalButtons, { PayPalOrderButton } from "./PayPalButtons";

export const metadata: Metadata = {
  title: "Pricing — $20/month, $160/year, passes & lifetime",
  description:
    "LetterMyComic pricing: full access to the browser comic lettering studio for $20/month or $160/year, one-time 3-month ($40) and 6-month ($80) passes, or lifetime access ($500). Pay securely with PayPal.",
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
        Everything included on every plan. Pay securely with PayPal — subscribe and cancel
        anytime, or pay once for a pass with no auto-renew.
      </p>
      <div className="priceGrid wide">
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
        <div className="priceCard">
          <div className="plan">3-Month Pass</div>
          <div className="amount">$40</div>
          <div className="per">one payment — no auto-renew</div>
          <div className="save">3 months for the price of 2 — save $20</div>
          <ul>{FEATURES.map((f) => <li key={f}>{f}</li>)}</ul>
          <PayPalOrderButton tier="pass3" />
        </div>
        <div className="priceCard">
          <div className="plan">6-Month Pass</div>
          <div className="amount">$80</div>
          <div className="per">one payment — no auto-renew</div>
          <div className="save">6 months for the price of 4 — save $40</div>
          <ul>{FEATURES.map((f) => <li key={f}>{f}</li>)}</ul>
          <PayPalOrderButton tier="pass6" />
        </div>
        <div className="priceCard">
          <div className="plan">Lifetime</div>
          <div className="amount">$500</div>
          <div className="per">one payment — yours forever</div>
          <div className="save">Pay once, letter forever</div>
          <ul>
            {FEATURES.map((f) => <li key={f}>{f}</li>)}
            <li><b>Your name on the <a href="/credits">credits page</a></b></li>
          </ul>
          <PayPalOrderButton tier="lifetime" />
        </div>
      </div>
      <p className="ppNote">
        Payments are processed by PayPal. Subscriptions renew automatically until cancelled;
        you can cancel from your PayPal account at any time. Passes and Lifetime are one-time
        payments — nothing renews. No free trial — but you can browse every feature on the{" "}
        <a href="/features">features page</a> before you commit.
      </p>
    </main>
  );
}
