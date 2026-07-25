import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

async function requireAdmin() {
  const u = await getSessionUser();
  return u?.isAdmin ? u : null;
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, isAdmin: true, subStatus: true, subPlan: true, subId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return NextResponse.json(users);
}

/* Admin overrides: grant/revoke access or admin role. */
export async function PUT(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id, subStatus, isAdmin } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  if (id === admin.id && isAdmin === false) {
    return NextResponse.json({ error: "You cannot remove your own admin role." }, { status: 400 });
  }
  const data: { subStatus?: string; subPlan?: string; isAdmin?: boolean } = {};
  if (typeof subStatus === "string" && ["none", "active", "cancelled", "suspended"].includes(subStatus)) {
    data.subStatus = subStatus;
    if (subStatus === "active") data.subPlan = "comp";
  }
  if (typeof isAdmin === "boolean") data.isAdmin = isAdmin;
  await prisma.user.update({ where: { id: String(id) }, data });
  return NextResponse.json({ ok: true });
}
