import { NextResponse } from "next/server";
import { getSessionUser, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";

async function requireAdmin() {
  const u = await getSessionUser();
  return u?.isAdmin ? u : null;
}

const STATUSES = ["none", "active", "cancelled", "suspended"];
const PLANS = ["", "monthly", "yearly", "lifetime", "comp", "pass3", "pass6"];

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, isAdmin: true, subStatus: true, subPlan: true, subId: true, subUntil: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return NextResponse.json(users);
}

/* Create an account by hand. */
export async function POST(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { email, name, password, subStatus, subPlan, isAdmin } = await req.json();
  const em = String(email || "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(em)) return NextResponse.json({ error: "Valid email required." }, { status: 400 });
  if (!password || String(password).length < 6) return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
  if (await prisma.user.findUnique({ where: { email: em } })) {
    return NextResponse.json({ error: "A user with that email already exists." }, { status: 400 });
  }
  const user = await prisma.user.create({
    data: {
      email: em,
      name: String(name || "").trim() || em.split("@")[0],
      passwordHash: await hashPassword(String(password)),
      isAdmin: !!isAdmin,
      subStatus: STATUSES.includes(subStatus) ? subStatus : "none",
      subPlan: PLANS.includes(subPlan) ? subPlan : "",
    },
  });
  return NextResponse.json({ ok: true, id: user.id });
}

/* Edit an account: email, name, password reset, subscription, admin role. */
export async function PUT(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id, email, name, password, subStatus, subPlan, subUntil, isAdmin } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  if (id === admin.id && isAdmin === false) {
    return NextResponse.json({ error: "You cannot remove your own admin role." }, { status: 400 });
  }
  const data: Record<string, unknown> = {};
  if (typeof email === "string" && email.trim()) {
    const em = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(em)) return NextResponse.json({ error: "Valid email required." }, { status: 400 });
    const other = await prisma.user.findUnique({ where: { email: em } });
    if (other && other.id !== id) return NextResponse.json({ error: "That email is taken by another user." }, { status: 400 });
    data.email = em;
  }
  if (typeof name === "string") data.name = name.trim();
  if (typeof password === "string" && password) {
    if (password.length < 6) return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
    data.passwordHash = await hashPassword(password);
  }
  if (typeof subStatus === "string" && STATUSES.includes(subStatus)) {
    data.subStatus = subStatus;
    /* quick Activate button: comp the plan unless one was chosen */
    if (subStatus === "active" && subPlan === undefined) data.subPlan = "comp";
  }
  if (typeof subPlan === "string" && PLANS.includes(subPlan)) data.subPlan = subPlan;
  /* access-until date for manually granted passes (Kickstarter rewards):
     a date string sets it, empty string clears it */
  if (typeof subUntil === "string") {
    if (!subUntil.trim()) data.subUntil = null;
    else {
      const d = new Date(subUntil);
      if (isNaN(d.getTime())) return NextResponse.json({ error: "Invalid access-until date." }, { status: 400 });
      data.subUntil = d;
    }
  }
  if (typeof isAdmin === "boolean") data.isAdmin = isAdmin;
  await prisma.user.update({ where: { id: String(id) }, data });
  return NextResponse.json({ ok: true });
}

/* Delete an account and everything it owns. */
export async function DELETE(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  if (id === admin.id) return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });
  await prisma.project.deleteMany({ where: { userId: String(id) } });
  await prisma.userAsset.deleteMany({ where: { userId: String(id) } });
  await prisma.user.delete({ where: { id: String(id) } });
  return NextResponse.json({ ok: true });
}
