import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "LetterMyComic terms of service: subscription terms, acceptable use, content ownership and cancellation policy.",
  alternates: { canonical: "/terms" },
};

export default function Terms() {
  return (
    <main className="mktSection prose">
      <h1>Terms of Service</h1>
      <p>Welcome to LetterMyComic. By creating an account or subscribing you agree to these terms.</p>
      <h2>1. The service</h2>
      <p>LetterMyComic provides browser-based comic lettering software ("the Studio") available at lettermycomic.com/app to subscribers with an active plan.</p>
      <h2>2. Subscriptions & billing</h2>
      <p>Access costs $20 per month or $160 per year, billed through PayPal. Subscriptions renew automatically until cancelled. You can cancel at any time from your PayPal account; access continues until the end of the paid period. There are no free trials. Fees already paid are non-refundable except where required by law.</p>
      <h2>3. Your content</h2>
      <p>You keep full ownership of everything you create in the Studio and every image you import. Artwork renders locally in your browser; projects you explicitly save to the cloud library are stored privately for your account so we can provide the service. We claim no rights to your comics.</p>
      <h2>4. Acceptable use</h2>
      <p>You agree not to abuse the service: no attempts to breach security, resell access, or use the platform to store unlawful content. Accounts violating these rules may be suspended.</p>
      <h2>5. Availability & changes</h2>
      <p>We work to keep the Studio available at all times but do not guarantee uninterrupted service. Features may be improved or changed; we will not materially reduce what your subscription includes during a paid period.</p>
      <h2>6. Liability</h2>
      <p>The service is provided "as is". To the maximum extent permitted by law, our liability is limited to the amount you paid in the twelve months before a claim. Keep local JSON backups of important projects — the Studio makes that a one-click export.</p>
      <h2>7. Contact</h2>
      <p>Questions about these terms? Reach us via the <a href="/contact">contact page</a>.</p>
    </main>
  );
}
