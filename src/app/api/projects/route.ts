import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, hasAccess } from "@/lib/auth";
import { MAX_DATA_BYTES, MAX_THUMB_BYTES, tooLarge } from "@/lib/projectLimits";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to use the project library." }, { status: 401 });
  try {
    const [owned, shared] = await Promise.all([
      prisma.project.findMany({
        where: { userId: user.id },
        select: { id: true, name: true, updatedAt: true, thumbnail: true },
        orderBy: { updatedAt: "desc" },
      }),
      /* books shared WITH this account come along, marked with the role */
      prisma.projectShare.findMany({
        where: { userId: user.id },
        select: {
          role: true,
          project: {
            select: {
              id: true, name: true, updatedAt: true, thumbnail: true,
              user: { select: { name: true } },
            },
          },
        },
      }),
    ]);
    const all = [
      ...owned,
      ...shared.map((s) => ({
        id: s.project.id, name: s.project.name, updatedAt: s.project.updatedAt,
        thumbnail: s.project.thumbnail, sharedBy: s.project.user?.name ?? "another letterer",
        role: s.role,
      })),
    ].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
    return NextResponse.json(all);
  } catch (err) {
    console.error("project list", err);
    return NextResponse.json({ error: "Could not load the library — please try again." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to save projects." }, { status: 401 });
  if (!hasAccess(user)) return NextResponse.json({ error: "An active subscription is required." }, { status: 402 });
  if (tooLarge(req)) return NextResponse.json({ error: "Project too large to save." }, { status: 413 });
  try {
    const body = await req.json();
    if (!body?.name || !body?.data) {
      return NextResponse.json({ error: "name and data are required" }, { status: 400 });
    }
    const data = JSON.stringify(body.data);
    if (data.length > MAX_DATA_BYTES) return NextResponse.json({ error: "Project too large to save." }, { status: 413 });
    const p = await prisma.project.create({
      data: {
        name: String(body.name).slice(0, 120),
        data,
        thumbnail: typeof body.thumbnail === "string" ? body.thumbnail.slice(0, MAX_THUMB_BYTES) : null,
        userId: user.id,
      },
    });
    return NextResponse.json({ id: p.id, name: p.name, updatedAt: p.updatedAt.toISOString() });
  } catch (err) {
    console.error("project create", err);
    return NextResponse.json({ error: "Could not save the project — please try again." }, { status: 500 });
  }
}
