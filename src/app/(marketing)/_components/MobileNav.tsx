"use client";
/* Mobile hamburger navigation for the marketing site. Hidden on desktop
   (CSS); on phones/tablets it replaces the inline nav with a slide-in
   drawer holding every header link. */
import Link from "next/link";
import { useEffect, useState } from "react";

export default function MobileNav({ signedIn, isAdmin }: { signedIn: boolean; isAdmin: boolean }) {
  const [open, setOpen] = useState(false);

  /* no page scroll behind the drawer */
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const close = () => setOpen(false);
  return (
    <>
      <button className={"mktBurger" + (open ? " open" : "")} aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open} onClick={() => setOpen(!open)}>
        <span /><span /><span />
      </button>
      {open && <div className="mktMenuBackdrop" onClick={close} />}
      <nav className={"mktMenu" + (open ? " open" : "")} aria-label="Mobile">
        <Link href="/features" onClick={close}>Features</Link>
        <Link href="/pricing" onClick={close}>Pricing</Link>
        <Link href="/get-the-app" onClick={close}>Get the App</Link>
        <Link href="/blog" onClick={close}>Blog</Link>
        <Link href="/faq" onClick={close}>FAQ</Link>
        <Link href="/guide" onClick={close}>User Guide</Link>
        <Link href="/contact" onClick={close}>Contact</Link>
        <div className="mktMenuSep" />
        {signedIn ? (
          <>
            {isAdmin && <Link href="/admin" onClick={close}>Admin</Link>}
            <Link href="/account" onClick={close}>My Account</Link>
            <Link href="/app" className="mktMenuCta" onClick={close}>Open Studio</Link>
          </>
        ) : (
          <>
            <Link href="/login" onClick={close}>Sign in</Link>
            <Link href="/signup" className="mktMenuCta" onClick={close}>Get Started</Link>
          </>
        )}
      </nav>
    </>
  );
}
