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
  if (!user) redirect("/login?next=/app");
  if (!hasAccess(user)) redirect("/pricing?locked=1");
  return <Editor />;
}
