import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, hasAccess } from "@/lib/auth";

/* keep saved documents and thumbnails to a sane size (they are text columns) */
const MAX_DATA_BYTES = 25 * 1024 * 1024;   // 25 MB serialized document
const MAX_THUMB_BYTES = 2 * 1024 * 1024;   // 2 MB thumbnail data-URL

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const p = await prisma.project.findFirst({ where: { id, userId: user.id } });
  if (!p) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ id: p.id, name: p.name, data: JSON.parse(p.data) });
}

export async function PUT(req: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  /* same subscription gate as project creation — otherwise a lapsed account
     keeps full write access by saving over an existing project id */
  if (!hasAccess(user)) return NextResponse.json({ error: "An active subscription is required." }, { status: 402 });
  const { id } = await params;
  try {
    const existing = await prisma.project.findFirst({ where: { id, userId: user.id } });
    if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });
    const body = await req.json();
    const data = body.data ? JSON.stringify(body.data) : null;
    if (data && data.length > MAX_DATA_BYTES) {
      return NextResponse.json({ error: "Project too large to save." }, { status: 413 });
    }
    const thumb = typeof body.thumbnail === "string" ? body.thumbnail.slice(0, MAX_THUMB_BYTES) : null;
    const p = await prisma.project.update({
      where: { id },
      data: {
        ...(body.name ? { name: String(body.name).slice(0, 120) } : {}),
        ...(data ? { data } : {}),
        ...(thumb !== null ? { thumbnail: thumb } : {}),
      },
    });
    return NextResponse.json({ id: p.id, name: p.name });
  } catch {
    return NextResponse.json({ error: "Save failed." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const existing = await prisma.project.findFirst({ where: { id, userId: user.id } });
    if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });
    await prisma.project.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
