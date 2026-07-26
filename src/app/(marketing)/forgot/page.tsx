import type { Metadata } from "next";
import ForgotForm from "./ForgotForm";

export const metadata: Metadata = {
  title: "Forgot Password",
  description: "Reset your LetterMyComic password.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <main>
      <ForgotForm />
    </main>
  );
}
