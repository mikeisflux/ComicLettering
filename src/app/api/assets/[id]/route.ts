import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const a = await prisma.userAsset.findFirst({ where: { id, userId: user.id } });
  if (!a) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ id: a.id, kind: a.kind, name: a.name, data: a.data },
    { headers: { "Cache-Control": "private, max-age=86400" } });
}

export async function DELETE(_req: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  await prisma.userAsset.deleteMany({ where: { id, userId: user.id } });
  return NextResponse.json({ ok: true });
}
