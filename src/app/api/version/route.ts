import { NextResponse } from "next/server";

/* Reports the build stamp of the deploy currently running on the server.
   An open editor window (especially the installed desktop/Store app, which
   can sit open for days) fetches this and compares it with its own baked
   NEXT_PUBLIC_LMC_BUILD to know whether a newer version is live. */

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { build: process.env.NEXT_PUBLIC_LMC_BUILD ?? "dev" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
