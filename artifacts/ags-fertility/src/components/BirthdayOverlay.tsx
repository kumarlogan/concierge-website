import React, { useEffect, useRef, useState, useCallback } from 'react';

// ══════════════════════════════════════════════════════════════════════════════
// TEMPORARY BIRTHDAY CELEBRATION OVERLAY — auto-expires after EXPIRATION_TIMESTAMP
// ─────────────────────────────────────────────────────────────────────────────
// To extend:   bump EXPIRATION_TIMESTAMP
// To shorten:  lower EXPIRATION_TIMESTAMP
// To remove:   delete this file + the import in AboutPage.tsx (single commit)
// ══════════════════════════════════════════════════════════════════════════════

/** Auto-expiry timestamp (ms since epoch).  Set once; the overlay stops rendering
 *  after this moment.  July 19, 2026 12:00 UTC = 48 h after deployment. */
const EXPIRATION_TIMESTAMP = Date.UTC(2026, 6, 19, 12, 0, 0);

const SESSION_KEY = 'birthday_celebration_shown_v1';
const TOTAL_DURATION_MS   = 15000; // total overlay lifetime
const FIREWORKS_END_MS    = 8000;  // switch from fireworks → sparkles
const MESSAGE_DELAY_MS    = 2500;  // when text starts fading in
const FADE_OUT_START_MS   = 12000; // overlay begins opacity fade

// ─── Colour palettes ────────────────────────────────────────────────────────

const FW_COLORS = [
  '#FFD700', '#FFC107', '#F9A825',
  '#FFFFFF', '#FFF8E1',
  '#FFB6C1', '#FF69B4',
  '#FF8C42', '#FFE0B2',
];

const SPARKLE_COLORS = ['#FFD700', '#FFF8DC', '#FFC107', '#FFB6C1', '#FFFFFF'];

// ─── Tiny helpers ───────────────────────────────────────────────────────────

const rb = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

function rgba(hex: string, alpha: number): string {
  return `rgba(${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)},${alpha})`;
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface Particle {
  x: number;  y: number;
  vx: number; vy: number;
  life: number;     // 1→0
  maxLife: number;  // seconds
  color: string;
  size: number;
  gravity: number;
  drag: number;
  sparkle: boolean;
  phase: number;
}

interface Rocket {
  x: number; y: number;
  targetY: number;
  vx: number; vy: number;
  color: string;
  trail: {x:number;y:number}[];
}

// ─── Detector helpers ───────────────────────────────────────────────────────

function isMobile(): boolean {
  return typeof window !== 'undefined' && window.innerWidth < 768;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function BirthdayOverlay() {
  const [visible,  setVisible]  = useState(false);
  const [phase,    setPhase]    = useState<'idle'|'active'|'fading'|'done'>('idle');
  const [showMsg,  setShowMsg]  = useState(false);

  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const rocketsRef   = useRef<Rocket[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const sparklesRef  = useRef<Particle[]>([]);
  const frameRef     = useRef(0);
  const t0Ref        = useRef(0);
  const fwEndRef     = useRef(false);
  const mobileRef    = useRef(false);

  // ── Gate: expiry & sessionStorage ───────────────────────────────────────

  useEffect(() => {
    if (Date.now() >= EXPIRATION_TIMESTAMP) return;
    if (sessionStorage.getItem(SESSION_KEY)) return;
    sessionStorage.setItem(SESSION_KEY, 'true');
    mobileRef.current = isMobile();
    setVisible(true);
    setPhase('active');
    t0Ref.current = performance.now();
  }, []);

  // ── Animation loop ──────────────────────────────────────────────────────

  const animate = useCallback((now: number) => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;

    const elapsed = now - t0Ref.current;
    const W = cvs.width;
    const H = cvs.height;
    const rox = rocketsRef.current;
    const pts = particlesRef.current;
    const spk = sparklesRef.current;
    const mobile = mobileRef.current;

    // Semi-transparent clear → motion-blur trails
    ctx.fillStyle = 'rgba(0,0,0,0.10)';
    ctx.fillRect(0, 0, W, H);

    // ── Fireworks phase ──────────────────────────────────────────────────

    if (elapsed < FIREWORKS_END_MS) {
      // Launch cadence
      const launchChance = mobile ? 0.04 : 0.07;
      if (elapsed < 6000 && Math.random() < launchChance) {
        const x = rb(W * 0.15, W * 0.85);
        rox.push({
          x, y: H,
          targetY: rb(H * 0.08, H * 0.45),
          vx: rb(-0.6, 0.6),
          vy: rb(-13, -8.5),
          color: pick(FW_COLORS),
          trail: [],
        });
      }

      // Animate rockets
      for (let i = rox.length - 1; i >= 0; i--) {
        const r = rox[i];
        r.trail.push({ x: r.x, y: r.y });
        if (r.trail.length > 14) r.trail.shift();

        r.vy += 0.18;
        r.x  += r.vx;
        r.y  += r.vy;

        // Trail
        for (let t = 0; t < r.trail.length; t++) {
          const a = (t / r.trail.length) * 0.45;
          ctx.beginPath();
          ctx.arc(r.trail[t].x, r.trail[t].y, 1.8, 0, Math.PI*2);
          ctx.fillStyle = rgba(r.color, a);
          ctx.fill();
        }
        // Head
        ctx.beginPath();
        ctx.arc(r.x, r.y, 3, 0, Math.PI*2);
        ctx.fillStyle = r.color;
        ctx.fill();
        // Glow
        ctx.beginPath();
        ctx.arc(r.x, r.y, 8, 0, Math.PI*2);
        ctx.fillStyle = rgba(r.color, 0.25);
        ctx.fill();

        // Explode when reaching target
        if (r.y <= r.targetY) {
          const cnt = Math.floor(rb(mobile ? 40 : 70, mobile ? 80 : 140));
          for (let p = 0; p < cnt; p++) {
            const angle = rb(0, Math.PI * 2);
            const speed = rb(1.2, 7);
            const c = pick(FW_COLORS);
            pts.push({
              x: r.x, y: r.y,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              life: 1,
              maxLife: rb(0.7, 2.8),
              color: c,
              size: rb(1.2, 3.8),
              gravity: 0.05,
              drag: 0.978,
              sparkle: Math.random() > 0.82,
              phase: Math.random() * Math.PI * 2,
            });
          }
          rox.splice(i, 1); // remove exploded rocket
        }
      }
    } else if (!fwEndRef.current) {
      fwEndRef.current = true;
      rox.length = 0; // clear any remaining rockets
    }

    // ── Post-fireworks sparkles ──────────────────────────────────────────

    if (elapsed >= FIREWORKS_END_MS && elapsed < FADE_OUT_START_MS) {
      if (Math.random() < (mobile ? 0.18 : 0.28)) {
        spk.push({
          x: rb(0, W), y: H + 10,
          vx: rb(-0.5, 0.5),
          vy: rb(-2.0, -0.6),
          life: 1,
          maxLife: rb(2.5, 5.5),
          color: pick(SPARKLE_COLORS),
          size: rb(2, 7),
          gravity: -0.012,
          drag: 0.994,
          sparkle: true,
          phase: Math.random() * Math.PI * 2,
        });
      }
    }

    // ── Draw & update particles ──────────────────────────────────────────

    for (let i = pts.length - 1; i >= 0; i--) {
      const p = pts[i];
      p.life -= 1 / (p.maxLife * 60);
      if (p.life <= 0) { pts.splice(i, 1); continue; }
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.vy += p.gravity;
      p.x  += p.vx;
      p.y  += p.vy;
      p.phase += 0.14;

      const alpha = p.life * (p.sparkle ? 0.6 + Math.sin(p.phase) * 0.35 : 0.85);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = rgba(p.color, alpha);
      ctx.fill();

      if (p.sparkle) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
        ctx.fillStyle = rgba(p.color, alpha * 0.12);
        ctx.fill();
      }
    }

    // ── Draw & update sparkles ───────────────────────────────────────────

    for (let i = spk.length - 1; i >= 0; i--) {
      const s = spk[i];
      s.life -= 1 / (s.maxLife * 60);
      if (s.life <= 0) { spk.splice(i, 1); continue; }
      s.vx *= s.drag;
      s.vy *= s.drag;
      s.vy += s.gravity;
      s.x  += s.vx;
      s.y  += s.vy;
      s.phase += 0.06;

      const pulse = 1 + Math.sin(s.phase * 2.2) * 0.55;
      const alpha = s.life * (0.25 + Math.sin(s.phase) * 0.25);

      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size * pulse, 0, Math.PI * 2);
      ctx.fillStyle = rgba(s.color, alpha);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size * pulse * 3.5, 0, Math.PI * 2);
      ctx.fillStyle = rgba(s.color, alpha * 0.07);
      ctx.fill();
    }

    // ── Phase transitions ────────────────────────────────────────────────

    if (elapsed >= FADE_OUT_START_MS && phase !== 'fading') {
      setPhase('fading');
    }
    if (elapsed >= TOTAL_DURATION_MS) {
      setPhase('done');
      setVisible(false);
      return; // stop rendering
    }

    if (elapsed >= MESSAGE_DELAY_MS && !showMsg) {
      setShowMsg(true);
    }

    frameRef.current = requestAnimationFrame(animate);
  }, [phase, showMsg]);

  // ── Canvas lifecycle ────────────────────────────────────────────────────

  useEffect(() => {
    if (!visible) return;
    const cvs = canvasRef.current!;
    const resize = () => { cvs.width = window.innerWidth; cvs.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);
    frameRef.current = requestAnimationFrame(animate);
    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(frameRef.current);
    };
  }, [visible, animate]);

  // ── Clean unmount (safety) ──────────────────────────────────────────────

  useEffect(() => {
    return () => cancelAnimationFrame(frameRef.current);
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────

  if (!visible && phase === 'done') return null;

  const fading = phase === 'fading';

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center transition-opacity ${
        fading ? 'duration-[3000ms] opacity-0' : 'duration-700 opacity-100'
      } pointer-events-none`}
      aria-hidden
    >
      {/* Backdrop */}
      <div className={`absolute inset-0 bg-black/88 ${fading ? 'transition-opacity duration-[3000ms] opacity-0' : ''}`} />

      {/* Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* ── Message ──────────────────────────────────────────────────────── */}
      <div
        className={`relative z-10 text-center px-6 max-w-2xl transition-all duration-[2500ms] ease-out ${
          showMsg ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-6 scale-[0.97]'
        }`}
        style={{ textShadow: '0 0 50px rgba(255,215,0,.55), 0 0 100px rgba(255,215,0,.25), 0 0 160px rgba(255,182,193,.18)' }}
      >
        <p className="text-[2rem] sm:text-4xl md:text-5xl lg:text-6xl font-serif font-bold text-white mb-7 tracking-wide leading-[1.2]">
          🎉 Happy Birthday, Dolly! 🎉
        </p>
        <p
          className="text-sm sm:text-base md:text-lg text-white/85 max-w-lg mx-auto leading-relaxed font-light px-2"
          style={{ textShadow: '0 0 18px rgba(255,255,255,.25)', fontFamily: 'Inter, sans-serif' }}
        >
          Every hour spent building this little surprise was worth it, just to see your smile.
        </p>
        <p
          className="text-base sm:text-lg md:text-xl text-white/75 mt-5 font-light italic"
          style={{ textShadow: '0 0 20px rgba(255,182,193,.35)' }}
        >
          This is dedicated to you. ❤️
        </p>
      </div>
    </div>
  );
}