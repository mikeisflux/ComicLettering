import type { Metadata } from "next";
import { Suspense } from "react";
import ResetForm from "./ResetForm";

export const metadata: Metadata = {
  title: "Reset Password",
  description: "Choose a new LetterMyComic password.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <main>
      <Suspense fallback={<div className="formCard"><h1>Reset Password</h1></div>}>
        <ResetForm />
      </Suspense>
    </main>
  );
}
