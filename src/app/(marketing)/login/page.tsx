import type { Metadata } from "next";
import { Suspense } from "react";
import AuthForm from "../signup/AuthForm";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to your LetterMyComic account to open the comic lettering studio.",
  robots: { index: false },
};

export default function Login() {
  return <main><Suspense><AuthForm mode="login" /></Suspense></main>;
}
