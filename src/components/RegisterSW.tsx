"use client";
/* Registers the (deliberately cache-free) service worker — see
   public/sw.js. Rendered once from the root layout so every page,
   marketing and studio alike, counts as installable. */
import { useEffect } from "react";

export default function RegisterSW() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* blocked (private mode, enterprise policy) — the site works
           identically without it */
      });
    }
  }, []);
  return null;
}
