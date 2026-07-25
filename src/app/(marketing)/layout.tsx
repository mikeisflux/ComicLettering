import Link from "next/link";
import "../marketing.css";
import { getSessionUser } from "@/lib/auth";

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  return (
    <div className="mkt">
      <header className="mktHeader">
        <Link href="/" className="mktLogo">Letter<span>My</span>Comic</Link>
        <nav className="mktNav" aria-label="Main">
          <Link href="/features">Features</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/faq">FAQ</Link>
          <Link href="/contact">Contact</Link>
        </nav>
        {user ? (
          <>
            {user.isAdmin && <Link href="/admin" className="ghost">Admin</Link>}
            <Link href="/app" className="cta">Open Studio</Link>
          </>
        ) : (
          <>
            <Link href="/login" className="ghost">Sign in</Link>
            <Link href="/signup" className="cta">Get Started</Link>
          </>
        )}
      </header>
      {children}
      <footer className="mktFooter">
        <div className="cols">
          <div>
            <div className="foot-brand">LetterMyComic</div>
            <p>Professional comic lettering,<br />right in your browser.</p>
          </div>
          <div>
            <div className="foot-h">Product</div>
            <Link href="/features">Features</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/faq">FAQ</Link>
            <Link href="/contact">Contact</Link>
          </div>
          <div>
            <div className="foot-h">Comic lettering</div>
            <Link href="/comic-lettering-software">Comic lettering software</Link>
            <Link href="/manga-lettering">Manga lettering</Link>
            <Link href="/comic-book-lettering">Comic book lettering</Link>
            <Link href="/comic-book-fonts">Comic book fonts</Link>
          </div>
          <div>
            <Link href="/login">Sign in</Link>
            <Link href="/signup">Create account</Link>
            <Link href="/app">Open the studio</Link>
          </div>
        </div>
        <div className="legal">© {new Date().getFullYear()} LetterMyComic. All rights reserved.</div>
      </footer>
    </div>
  );
}
