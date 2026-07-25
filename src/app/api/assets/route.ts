import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, hasAccess } from "@/lib/auth";

const MAX_ASSETS = 100;
const MAX_DATA = { font: 4_000_000, stamp: 2_000_000 }; // dataURL length caps

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const assets = await prisma.userAsset.findMany({
    where: { userId: user.id },
    select: { id: true, kind: true, name: true, data: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(assets);
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!hasAccess(user)) return NextResponse.json({ error: "An active subscription is required." }, { status: 402 });
  try {
    const { kind, name, data } = await req.json();
    if (kind !== "font" && kind !== "stamp") return NextResponse.json({ error: "kind must be font or stamp" }, { status: 400 });
    if (typeof data !== "string" || !data.startsWith("data:")) return NextResponse.json({ error: "data must be a data URL" }, { status: 400 });
    if (data.length > MAX_DATA[kind as "font" | "stamp"]) {
      return NextResponse.json({ error: `That ${kind} is too large (max ~${kind === "font" ? "3" : "1.5"} MB).` }, { status: 413 });
    }
    const count = await prisma.userAsset.count({ where: { userId: user.id } });
    if (count >= MAX_ASSETS) return NextResponse.json({ error: "Asset library is full (100 items)." }, { status: 409 });
    const a = await prisma.userAsset.create({
      data: { userId: user.id, kind, name: String(name || kind).slice(0, 120), data },
    });
    return NextResponse.json({ id: a.id });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
