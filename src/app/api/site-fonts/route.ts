import { NextResponse } from "next/server";
import { readdir } from "fs/promises";
import path from "path";

/* Site-wide fonts managed by the site owner: any font files placed in
   public/fonts/custom/ on the server are served to all users as built-in
   fonts. Licensing of files placed here is the site operator's
   responsibility — only add fonts you have the rights to embed. */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const dir = path.join(process.cwd(), "public", "fonts", "custom");
    const files = await readdir(dir);
    const fonts = files
      .filter((f) => /\.(ttf|otf|woff2?)$/i.test(f))
      .map((f) => ({
        name: f.replace(/\.(ttf|otf|woff2?)$/i, ""),
        url: `/api/site-fonts/${encodeURIComponent(f)}`,
      }));
    return NextResponse.json(fonts);
  } catch {
    return NextResponse.json([]); // folder doesn't exist yet
  }
}
