"use client";
/* Rotating hero taglines. Crossfades one line at a time; pauses on hover and
   respects prefers-reduced-motion (no auto-advance, dots still work). */
import { useEffect, useRef, useState } from "react";

const SLIDES = [
  "It's so easy, anyone can do it!",
  "No AI art. No AI lettering. Every page is 100% yours.",
  "Speech balloons that behave like ink — aimed, joined, melted.",
  "Your pages never train anything. Your art never leaves your browser.",
  "600+ comic fonts, 100+ lettering styles, print-ready export.",
  "No generative AI — this is a pen, not a ghostwriter.",
  "Runs in any browser. Never crashes. Never installs.",
];

const HOLD_MS = 4500;

export default function HeroSlider() {
  const [at, setAt] = useState(0);
  const pausedRef = useRef(false);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => {
      if (!pausedRef.current) setAt((v) => (v + 1) % SLIDES.length);
    }, HOLD_MS);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="heroSlider" role="region" aria-label="What makes LetterMyComic different"
      onMouseEnter={() => { pausedRef.current = true; }}
      onMouseLeave={() => { pausedRef.current = false; }}>
      <div className="heroSlides">
        {SLIDES.map((s, i) => (
          <p key={s} className={"heroSlide" + (i === at ? " on" : "")} aria-hidden={i !== at}>
            {s}
          </p>
        ))}
      </div>
      <div className="heroDots" role="tablist" aria-label="Slides">
        {SLIDES.map((s, i) => (
          <button key={i} role="tab" aria-selected={i === at}
            aria-label={`Slide ${i + 1}: ${s}`}
            className={"heroDot" + (i === at ? " on" : "")}
            onClick={() => setAt(i)} />
        ))}
      </div>
    </div>
  );
}
