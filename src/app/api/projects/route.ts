import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      select: { id: true, name: true, updatedAt: true, thumbnail: true },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json(projects);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
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
      },
    });
    return NextResponse.json({ id: p.id, name: p.name });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
