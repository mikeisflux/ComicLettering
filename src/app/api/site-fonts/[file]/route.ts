import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = {
  ".woff2": "font/woff2", ".woff": "font/woff",
  ".ttf": "font/ttf", ".otf": "font/otf",
};

/* Streams a site font installed in public/fonts/custom/ — works for files
   added after the app was built. */
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const name = path.basename(decodeURIComponent(file)); // no path traversal
  const ext = path.extname(name).toLowerCase();
  if (!TYPES[ext]) return NextResponse.json({ error: "not a font" }, { status: 404 });
  try {
    const buf = await readFile(path.join(process.cwd(), "public", "fonts", "custom", name));
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": TYPES[ext],
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}
