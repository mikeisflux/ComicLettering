import type { Metadata } from "next";
import { prisma } from "@/lib/db";

export const metadata: Metadata = {
  title: "Credits — lifetime supporters",
  description: "The lifetime supporters who helped build LetterMyComic.",
  alternates: { canonical: "/credits" },
};

export const dynamic = "force-dynamic";

/* The promise on the Lifetime tier: your name on the credits page. */
export default async function CreditsPage() {
  const supporters = await prisma.user.findMany({
    where: { subPlan: "lifetime" },
    select: { name: true },
    orderBy: { createdAt: "asc" },
  }).catch(() => [] as { name: string }[]);

  return (
    <main className="mktSection" style={{ maxWidth: 720 }}>
      <h2>Credits</h2>
      <p className="sub">
        LetterMyComic exists because people believed in a real lettering tool for
        the open web. These lifetime supporters put their money where the word
        balloons are — thank you.
      </p>
      {supporters.length ? (
        <ul style={{ columns: 2, fontSize: 17, fontWeight: 600, color: "#2c3542", lineHeight: 2 }}>
          {supporters.map((s, i) => <li key={i}>{s.name}</li>)}
        </ul>
      ) : (
        <p className="sub">The first names land here soon — the <a href="/pricing">Lifetime plan</a> includes a permanent spot.</p>
      )}
    </main>
  );
}
