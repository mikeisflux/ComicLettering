import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const u = await getSessionUser();
  if (!u) return NextResponse.json({ user: null });
  return NextResponse.json({
    user: { id: u.id, email: u.email, name: u.name, isAdmin: u.isAdmin, subStatus: u.subStatus, subPlan: u.subPlan },
  });
}
