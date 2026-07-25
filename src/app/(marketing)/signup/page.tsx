import type { Metadata } from "next";
import { Suspense } from "react";
import AuthForm from "./AuthForm";

export const metadata: Metadata = {
  title: "Create Your Account",
  description: "Create a LetterMyComic account, subscribe, and start lettering your comic in the browser today.",
  alternates: { canonical: "/signup" },
};

export default function Signup() {
  return <main><Suspense><AuthForm mode="signup" /></Suspense></main>;
}
