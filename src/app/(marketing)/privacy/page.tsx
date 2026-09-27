import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "LetterMyComic privacy policy: what we store (very little), how your artwork stays on your device, and how payment data is handled by PayPal.",
  alternates: { canonical: "/privacy" },
};

export default function Privacy() {
  return (
    <main className="mktSection prose">
      <h1>Privacy Policy</h1>
      <p>We built LetterMyComic to be private by design. This page explains exactly what we store and why.</p>
      <h2>What we store</h2>
      <ul>
        <li><b>Account data:</b> your email, name and a salted password hash.</li>
        <li><b>Subscription data:</b> your PayPal subscription ID and its status. We never see or store card numbers — payments are handled entirely by PayPal.</li>
        <li><b>Projects you save:</b> comics you explicitly save to the cloud library, stored privately for your account — including any page art you chose to include in them.</li>
        <li><b>Fonts and stamps you import:</b> font files and stamp images you add to your account so they follow you between devices.</li>
        <li><b>Abuse-prevention logs:</b> the IP address and browser identifier of requests that fail a sign-in, trip the spam check or look automated, kept only as long as needed to block abuse.</li>
        <li><b>Messages:</b> anything you send via the contact form or email us, so we can reply.</li>
      </ul>
      <h2>What we don't store</h2>
      <p>While you letter, your artwork and pages render locally in your browser and are not transmitted to us. Autosave-in-browser uses your own device's storage. We do not sell data, run third-party ad trackers, or profile you.</p>
      <h2>Cookies</h2>
      <p>We use a single session cookie to keep you signed in. PayPal sets its own cookies during checkout under its own policy.</p>
      <h2>Spam protection</h2>
      <p>The sign-up, sign-in and contact forms may be protected by Google reCAPTCHA v3, which is subject to the <a href="https://policies.google.com/privacy" rel="noreferrer">Google Privacy Policy</a> and <a href="https://policies.google.com/terms" rel="noreferrer">Terms of Service</a>. It runs only on those forms, never inside the studio.</p>
      <h2>Email</h2>
      <p>We send transactional email (like replies to your messages) via SendGrid. We do not send marketing email without your consent.</p>
      <h2>Deletion</h2>
      <p>You can delete your account yourself at any time: open <a href="/account">My Account</a> and choose <b>Delete my account</b>. It removes your profile, saved projects, imported fonts and stamps immediately and cancels any active subscription — see <a href="/delete-account">how deletion works</a>. If you are locked out, ask from the <a href="/contact">contact page</a> and we will remove them for you.</p>
    </main>
  );
}
