"use client";
/* Celebration fireworks — a throwaway fullscreen canvas that bursts a few
   rockets and removes itself. Fired when an export finishes: the book is
   OUT, that deserves sparks. Pointer-events pass straight through, the
   whole show is ~2.5s, and prefers-reduced-motion skips it entirely. */

interface Spark {
  x: number; y: number; vx: number; vy: number;
  life: number; decay: number; color: string; size: number;
}

const COLORS = ["#ff5252", "#ffd740", "#69f0ae", "#40c4ff", "#e040fb", "#ffab40", "#ffffff"];

export function launchFireworks() {
  if (typeof document === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  if (document.getElementById("lmcFireworks")) return;   // one show at a time

  const cv = document.createElement("canvas");
  cv.id = "lmcFireworks";
  cv.style.cssText = "position:fixed;inset:0;z-index:6000;pointer-events:none";
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(innerWidth * dpr);
  cv.height = Math.round(innerHeight * dpr);
  const ctx = cv.getContext("2d");
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  document.body.appendChild(cv);

  const sparks: Spark[] = [];
  const burst = (x: number, y: number) => {
    const base = COLORS[Math.floor(Math.random() * COLORS.length)];
    const n = 60 + Math.floor(Math.random() * 30);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.2;
      const sp = 1.6 + Math.random() * 4.4;
      sparks.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.6,
        life: 1, decay: 0.012 + Math.random() * 0.014,
        color: Math.random() < 0.25 ? "#ffffff" : base,
        size: 1.4 + Math.random() * 1.8,
      });
    }
  };
  /* a staggered volley across the upper half of the screen */
  const volley = [0, 320, 640, 1000, 1400];
  volley.forEach((t) => setTimeout(() => {
    burst(innerWidth * (0.15 + Math.random() * 0.7), innerHeight * (0.12 + Math.random() * 0.38));
  }, t));

  const t0 = performance.now();
  const tick = () => {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    ctx.globalCompositeOperation = "lighter";
    for (const s of sparks) {
      if (s.life <= 0) continue;
      s.x += s.vx;
      s.y += s.vy;
      s.vy += 0.055;            // gravity
      s.vx *= 0.985;
      s.life -= s.decay;
      ctx.globalAlpha = Math.max(0, s.life);
      ctx.shadowBlur = 8;
      ctx.shadowColor = s.color;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size * s.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    const alive = sparks.some((s) => s.life > 0);
    if ((alive || performance.now() - t0 < 1600) && performance.now() - t0 < 5000) {
      requestAnimationFrame(tick);
    } else {
      cv.remove();
    }
  };
  requestAnimationFrame(tick);
}
