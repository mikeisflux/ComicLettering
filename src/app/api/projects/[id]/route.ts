import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const p = await prisma.project.findUnique({ where: { id } });
  if (!p) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ id: p.id, name: p.name, data: JSON.parse(p.data) });
}

export async function PUT(req: Request, { params }: Params) {
  const { id } = await params;
  try {
    const body = await req.json();
    const p = await prisma.project.update({
      where: { id },
      data: {
        ...(body.name ? { name: String(body.name).slice(0, 120) } : {}),
        ...(body.data ? { data: JSON.stringify(body.data) } : {}),
        ...(typeof body.thumbnail === "string" ? { thumbnail: body.thumbnail } : {}),
      },
    });
    return NextResponse.json({ id: p.id, name: p.name });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  try {
    await prisma.project.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
