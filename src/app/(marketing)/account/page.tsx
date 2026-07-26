import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import AccountPanel from "./AccountPanel";

export const metadata: Metadata = {
  title: "My Account",
  description: "Manage your LetterMyComic account and subscription.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/account");
  return (
    <main className="mktSection" style={{ maxWidth: 640 }}>
      <h1 style={{ fontFamily: "Bangers, cursive", letterSpacing: 1, fontSize: 40 }}>My Account</h1>
      <AccountPanel />
    </main>
  );
}
