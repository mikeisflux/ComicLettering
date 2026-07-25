import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser, hasAccess } from "@/lib/auth";
import Editor from "@/components/Editor";

export const metadata: Metadata = {
  title: "Studio",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AppPage() {
  const user = await getSessionUser();
  // You must have an account to reach the studio — even the free demo.
  if (!user) redirect("/signup?next=/app&demo=1");
  // Free accounts (no active subscription) get the watermarked demo;
  // subscribers and admins get full save/export/print.
  return <Editor demo={!hasAccess(user)} />;
}
