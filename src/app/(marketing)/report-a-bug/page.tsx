import type { Metadata } from "next";
import BugReportForm from "@/components/BugReportForm";

export const metadata: Metadata = {
  title: "Report a bug",
  description: "Found something broken in LetterMyComic? Send a bug report — we read every one and reply by email.",
  alternates: { canonical: "/report-a-bug" },
  robots: { index: false, follow: true },
};

export default function ReportBugPage() {
  return (
    <main>
      <BugReportForm />
      <p className="sub" style={{ textAlign: "center", maxWidth: 560, margin: "0 auto 48px" }}>
        In the studio, <b>Help → Report a bug…</b> sends the same report with a picture of the page and
        the app&apos;s own error log attached, which usually gets it fixed faster.
      </p>
    </main>
  );
}
