import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, hasAccess } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to use the project library." }, { status: 401 });
  try {
    const projects = await prisma.project.findMany({
      where: { userId: user.id },
      select: { id: true, name: true, updatedAt: true, thumbnail: true },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json(projects);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to save projects." }, { status: 401 });
  if (!hasAccess(user)) return NextResponse.json({ error: "An active subscription is required." }, { status: 402 });
  try {
    const body = await req.json();
    if (!body?.name || !body?.data) {
      return NextResponse.json({ error: "name and data are required" }, { status: 400 });
    }
    const p = await prisma.project.create({
      data: {
        name: String(body.name).slice(0, 120),
        data: JSON.stringify(body.data),
        thumbnail: typeof body.thumbnail === "string" ? body.thumbnail : null,
        userId: user.id,
      },
    });
    return NextResponse.json({ id: p.id, name: p.name });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
