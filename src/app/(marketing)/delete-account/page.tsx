import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Delete your account",
  description:
    "How to permanently delete your LetterMyComic account and all data associated with it.",
  alternates: { canonical: "/delete-account" },
};

/* The public account-deletion page Google Play and the App Store require
   for apps with account creation. Self-serve, no email needed. */
export default function DeleteAccountPage() {
  return (
    <main className="mktSection" style={{ maxWidth: 640 }}>
      <article className="prose">
        <h1>Delete your LetterMyComic account</h1>
        <p>
          You can permanently delete your account yourself, at any time, from
          any device:
        </p>
        <ol>
          <li><a href="/login?next=/account">Sign in</a> and open <a href="/account">My Account</a>.</li>
          <li>Scroll to the bottom and choose <b>Delete my account</b>.</li>
          <li>Confirm with your password.</li>
        </ol>
        <p>Deletion is immediate and permanent. It removes:</p>
        <ul>
          <li>your profile and sign-in credentials,</li>
          <li>every saved project in your library,</li>
          <li>imported fonts and custom stamps,</li>
          <li>your access to shared books and any comments you left,</li>
          <li>and it cancels any active subscription, so no further billing occurs.</li>
        </ul>
        <p>
          Nothing is retained after deletion except records we are legally
          required to keep (such as past payment transactions processed by
          PayPal). Artwork you worked on never left your device unless you
          saved it into a project, and deleted projects are removed with the
          account.
        </p>
        <p>
          Locked out or need help? <a href="/contact">Contact us</a> from the
          email address on the account and we will delete it for you.
        </p>
      </article>
    </main>
  );
}
