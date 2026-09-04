// Dot lattice background, adapted from draupnir-web/js/particles.js.
// A static grid of faint dots; dots near the pointer light up in the accent
// colour and settle back once it moves on. No animation runs while the page is
// idle. Colours follow the active al-folio theme (data-theme on <html>).
(function () {
  const canvas = document.getElementById("particleCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const SPACING = 56; // grid cell size in px
  const SEARCH_RADIUS = 140; // pointer influence in px
  const ACCENT_SHARE = 0.94; // seeds above this render as latent accent dots

  const state = {
    w: 0,
    h: 0,
    dots: [],
    px: -1e4,
    py: -1e4,
    raf: null,
    accent: "224,122,58",
    base: "26,24,22",
  };

  // "#rgb" or "#rrggbb" -> "r,g,b"; null for anything else
  function hexToRgb(value) {
    let hex = value.trim().replace("#", "");
    if (hex.length === 3) hex = hex.replace(/./g, (c) => c + c);
    if (!/^[0-9a-f]{6}$/i.test(hex)) return null;
    const n = parseInt(hex, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(",");
  }

  function readColors() {
    const cs = getComputedStyle(document.documentElement);
    state.accent = hexToRgb(cs.getPropertyValue("--global-theme-color")) || state.accent;
    state.base = hexToRgb(cs.getPropertyValue("--global-text-color")) || state.base;
  }

  // deterministic per-cell pseudo-random in [0, 1)
  function cellHash(x, y) {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return s - Math.floor(s);
  }

  function build() {
    state.w = window.innerWidth;
    state.h = window.innerHeight;
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    canvas.width = state.w * dpr;
    canvas.height = state.h * dpr;
    canvas.style.width = state.w + "px";
    canvas.style.height = state.h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    state.dots = [];
    const cols = Math.ceil(state.w / SPACING) + 1;
    const rows = Math.ceil(state.h / SPACING) + 1;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const r1 = cellHash(i, j);
        const r2 = cellHash(j + 7, i + 3);
        state.dots.push({
          x: i * SPACING + (r1 - 0.5) * SPACING * 0.6,
          y: j * SPACING + (r2 - 0.5) * SPACING * 0.6,
          seed: r1,
          glow: 0,
        });
      }
    }
    draw();
  }

  function draw() {
    ctx.clearRect(0, 0, state.w, state.h);
    for (const d of state.dots) {
      const accent = d.seed > ACCENT_SHARE;
      let alpha = accent ? 0.3 : 0.1;
      let radius = accent ? 1.6 : 1.1;
      if (d.glow > 0.01) {
        alpha = Math.min(0.85, alpha + d.glow * 0.6);
        radius += d.glow * 1.5;
        ctx.fillStyle = "rgba(" + state.accent + "," + alpha.toFixed(3) + ")";
      } else {
        ctx.fillStyle = "rgba(" + (accent ? state.accent : state.base) + "," + alpha + ")";
      }
      ctx.beginPath();
      ctx.arc(d.x, d.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Eases each dot's glow toward its target and stops once everything settles,
  // so the rAF loop only runs briefly after pointer input.
  function step() {
    let maxDelta = 0;
    for (const d of state.dots) {
      const dist = Math.hypot(d.x - state.px, d.y - state.py);
      const target = dist < SEARCH_RADIUS ? 1 - dist / SEARCH_RADIUS : 0;
      const next = d.glow + (target - d.glow) * 0.14;
      maxDelta = Math.max(maxDelta, Math.abs(next - d.glow));
      d.glow = next;
    }
    draw();
    state.raf = maxDelta > 0.002 ? requestAnimationFrame(step) : null;
  }

  function wake() {
    if (!state.raf) state.raf = requestAnimationFrame(step);
  }

  if (!reduceMotion) {
    window.addEventListener("pointermove", (e) => {
      if (e.isPrimary === false) return;
      state.px = e.clientX;
      state.py = e.clientY;
      wake();
    });
    window.addEventListener("pointerleave", () => {
      state.px = -1e4;
      state.py = -1e4;
      wake();
    });
  }

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(build, 150);
  });

  // Re-colour when the light/dark toggle flips the theme attribute.
  new MutationObserver(() => {
    readColors();
    draw();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  readColors();
  build();
})();
