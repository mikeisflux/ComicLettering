/* Sentinel bug reports — the public submit endpoint.

   Open to anyone (a bug found in the demo matters too), with the same
   bot defences as the contact form: firewall check, honeypot, reCAPTCHA
   when configured, and a size cap on every field. The signed-in account,
   if any, is attached so the console can follow up. */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { verifyCaptcha } from "@/lib/captcha";
import { blockIP, clientIp, isBlocked, noteSuspicious } from "@/lib/botblock";

const S = (v: unknown, n: number) => String(v ?? "").slice(0, n);
const MAX_SHOT = 2_000_000;   // ~1.5 MB of PNG as a data URL

export async function POST(req: Request) {
  try {
    const ip = clientIp(req);
    const ua = req.headers.get("user-agent");
    if (await isBlocked(ip)) return NextResponse.json({ ok: true });
    const body = await req.json();
    if (body.website) {
      await blockIP(ip || "", "Honeypot triggered on bug report", { userAgent: ua, path: "/api/bugs" });
      return NextResponse.json({ ok: true });
    }
    const cap = await verifyCaptcha(body.captcha, "bug");
    if (!cap.ok) {
      await noteSuspicious(ip, "Failed captcha on bug report", { userAgent: ua, path: "/api/bugs" });
      return NextResponse.json({ error: cap.reason }, { status: 400 });
    }
    const title = S(body.title, 200).trim();
    const description = S(body.description, 20000).trim();
    if (!title || !description) return NextResponse.json({ error: "Give the bug a title and say what happened." }, { status: 400 });
    const email = S(body.email, 200).trim().toLowerCase();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "That email address doesn't look right." }, { status: 400 });
    }
    const user = await getSessionUser();
    let screenshot: string | null = typeof body.screenshot === "string" ? body.screenshot : null;
    if (screenshot && (!screenshot.startsWith("data:image/") || screenshot.length > MAX_SHOT)) screenshot = null;
    const ctx = body.context && typeof body.context === "object" ? body.context : {};
    const row = await prisma.bugReport.create({
      data: {
        title,
        description,
        steps: S(body.steps, 20000).trim() || null,
        email: email || user?.email || null,
        name: S(body.name, 120).trim() || user?.name || null,
        userId: user?.id ?? null,
        severity: ["low", "normal", "high", "critical"].includes(body.severity) ? body.severity : "normal",
        build: S(ctx.build ?? body.build, 60) || null,
        url: S(ctx.url ?? body.url, 300) || null,
        form: S(ctx.form, 40) || null,
        userAgent: S(ua, 400) || null,
        context: JSON.stringify(ctx).slice(0, 20000),
        errors: S(body.errors, 20000) || null,
        screenshot,
        ip: ip ? S(ip, 64) : null,
      },
      select: { id: true },
    });
    return NextResponse.json({ ok: true, id: row.id });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Something went wrong — please try again." }, { status: 500 });
  }
}
