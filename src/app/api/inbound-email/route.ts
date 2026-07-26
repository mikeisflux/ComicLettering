import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/* SendGrid Inbound Parse webhook — set your domain's MX to mx.sendgrid.net
   and point the Inbound Parse URL at /api/inbound-email?key=<INBOUND_EMAIL_KEY>.
   The key requirement stops random visitors from injecting fake messages
   (with spoofed senders) into the admin inbox. */
export async function POST(req: Request) {
  try {
    const expected = process.env.INBOUND_EMAIL_KEY || "";
    const got = new URL(req.url).searchParams.get("key") || "";
    if (!expected || got !== expected) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const form = await req.formData();
    const from = String(form.get("from") || "");
    const emailMatch = from.match(/<([^>]+)>/);
    await prisma.message.create({
      data: {
        direction: "in",
        channel: "email",
        fromEmail: (emailMatch ? emailMatch[1] : from).slice(0, 200),
        fromName: from.replace(/<[^>]+>/, "").trim().slice(0, 120) || null,
        toEmail: String(form.get("to") || "").slice(0, 200),
        subject: String(form.get("subject") || "(no subject)").slice(0, 250),
        body: String(form.get("text") || form.get("html") || "").slice(0, 100000),
      },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
