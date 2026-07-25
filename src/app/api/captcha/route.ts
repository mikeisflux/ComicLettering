import { NextResponse } from "next/server";
import { getSetting } from "@/lib/settings";

/* Public: the reCAPTCHA v3 site key (empty = captcha disabled). */
export async function GET() {
  return NextResponse.json({ siteKey: (await getSetting("RECAPTCHA_SITE_KEY")) || null });
}
