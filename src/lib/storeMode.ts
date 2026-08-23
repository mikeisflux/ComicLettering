/* iOS App Store build mode (Apple guideline 3.1.1 / 3.1.3).

   The iOS wrapper app launches the site with ?store=ios; an inline script
   in the root layout persists that flag and stamps `iosStore` on <html>
   BEFORE first paint. While the flag is set:
     - every link to /pricing is hidden site-wide (globals.css),
     - the pricing page itself redirects to the studio,
     - demo-mode messages say "sign in with a full-access account" instead
       of "subscribe" — Apple forbids directing users to purchase outside
       the app, so no purchase wording, no external-payment links, at all.
   Users who already subscribed on the web sign in normally and get
   everything ("multiplatform services", 3.1.3(b)). Every other platform
   is completely unaffected. */

export function isIosStore(): boolean {
  return typeof document !== "undefined" &&
    document.documentElement.classList.contains("iosStore");
}

/* demo-gate wording: the exact existing message everywhere, but inside the
   App Store build swap it for sign-in wording with no purchase direction */
export function demoLock(webMsg: string, action: string): string {
  return isIosStore()
    ? `${action} needs a full-access account — sign in with one to unlock.`
    : webMsg;
}
