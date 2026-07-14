/* ==============================================
   Capital Finplus Academy — chart-bg.js
   Animated financial-chart background. Draws on the existing
   #galaxy-canvas (position:fixed, z-index:0, behind all content).

   Setting window.CFP_CHART_BG = true makes the old galaxy animation
   in script.js bail out (see the guard at the top of initGalaxy), so
   only ONE thing ever paints the shared canvas. To go back to the
   galaxy look, just don't load this file.

   Self-contained: no dependencies, no build step. Respects
   prefers-reduced-motion and pauses when the tab is hidden.
   ============================================== */
window.CFP_CHART_BG = true;

(function initChartBackground() {
  const canvas = document.getElementById('galaxy-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const GOLD = '244,194,13';
  const GOLD_HI = '255,224,102';
  const UP = '52,211,153';    // muted green
  const DOWN = '248,113,113';  // muted red

  let W, H, DPR, time = 0;
  let grid, series, candles;

  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    build();
    frame();   // setting canvas.width cleared it — repaint now, don't wait for the loop
  }

  /* A scrolling price line: values in [0,1], drawn smoothed with a glow
     and a soft area fill underneath. Mean-reverting random walk so it
     stays on screen and reads like a real chart. */
  function makeSeries(cfg) {
    const spacing = cfg.spacing;
    const n = Math.ceil(W / spacing) + 4;
    const values = [];
    let v = rand(0.35, 0.65);
    for (let i = 0; i < n; i++) {
      v = clamp(v + rand(-cfg.jitter, cfg.jitter) + (0.5 - v) * 0.05, 0.08, 0.92);
      values.push(v);
    }
    return { ...cfg, spacing, values, offset: 0 };
  }

  function stepSeries(s) {
    s.offset += s.speed;
    while (s.offset >= s.spacing) {
      s.offset -= s.spacing;
      s.values.shift();
      const last = s.values[s.values.length - 1];
      s.values.push(clamp(last + rand(-s.jitter, s.jitter) + (0.5 - last) * 0.05, 0.08, 0.92));
    }
  }

  function drawSeries(s) {
    const baseY = H * s.baseY;
    const amp = H * s.amp;
    const pt = (i) => [i * s.spacing - s.offset, baseY - s.values[i] * amp];

    // Smooth path via midpoint quadratics
    ctx.beginPath();
    let [x0, y0] = pt(0);
    ctx.moveTo(x0, y0);
    for (let i = 1; i < s.values.length - 1; i++) {
      const [x1, y1] = pt(i);
      const [x2, y2] = pt(i + 1);
      ctx.quadraticCurveTo(x1, y1, (x1 + x2) / 2, (y1 + y2) / 2);
    }

    // Area fill
    const lastX = (s.values.length - 1) * s.spacing - s.offset;
    ctx.save();
    ctx.lineTo(lastX, H);
    ctx.lineTo(x0, H);
    ctx.closePath();
    const fill = ctx.createLinearGradient(0, baseY - amp, 0, H);
    fill.addColorStop(0, `rgba(${s.color},${s.fill})`);
    fill.addColorStop(1, `rgba(${s.color},0)`);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.restore();

    // Glowing stroke (re-trace the line only)
    ctx.beginPath();
    [x0, y0] = pt(0);
    ctx.moveTo(x0, y0);
    for (let i = 1; i < s.values.length - 1; i++) {
      const [x1, y1] = pt(i);
      const [x2, y2] = pt(i + 1);
      ctx.quadraticCurveTo(x1, y1, (x1 + x2) / 2, (y1 + y2) / 2);
    }
    ctx.strokeStyle = `rgba(${s.color},${s.alpha})`;
    ctx.lineWidth = s.width;
    ctx.shadowBlur = s.glow;
    ctx.shadowColor = `rgba(${s.color},${s.alpha})`;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  /* Drifting candlesticks along a band, low opacity. */
  function makeCandles() {
    const w = 7, gap = 34;
    const n = Math.ceil(W / gap) + 2;
    const arr = [];
    let base = rand(0.4, 0.6);
    for (let i = 0; i < n; i++) {
      base = clamp(base + rand(-0.06, 0.06), 0.2, 0.8);
      arr.push(candle(i * gap, base));
    }
    return { w, gap, arr, offset: 0 };
  }

  function candle(x, base) {
    const o = base + rand(-0.05, 0.05);
    const c = base + rand(-0.05, 0.05);
    const hi = Math.max(o, c) + rand(0.01, 0.05);
    const lo = Math.min(o, c) - rand(0.01, 0.05);
    return { x, o, c, hi, lo, up: c >= o, base };
  }

  function stepCandles() {
    candles.offset += 0.28;
    while (candles.offset >= candles.gap) {
      candles.offset -= candles.gap;
      candles.arr.shift();
      const prev = candles.arr[candles.arr.length - 1];
      const base = clamp(prev.base + rand(-0.06, 0.06), 0.2, 0.8);
      candles.arr.push(candle((candles.arr.length) * candles.gap, base));
    }
  }

  function drawCandles() {
    const baseY = H * 0.62, amp = H * 0.32, w = candles.w;
    const y = (v) => baseY - v * amp;
    for (let i = 0; i < candles.arr.length; i++) {
      const c = candles.arr[i];
      const x = i * candles.gap - candles.offset;
      const col = c.up ? UP : DOWN;
      ctx.strokeStyle = `rgba(${col},0.16)`;
      ctx.fillStyle = `rgba(${col},0.10)`;
      ctx.lineWidth = 1;
      // wick
      ctx.beginPath();
      ctx.moveTo(x, y(c.hi));
      ctx.lineTo(x, y(c.lo));
      ctx.stroke();
      // body
      const top = y(Math.max(c.o, c.c));
      const bh = Math.max(2, Math.abs(y(c.o) - y(c.c)));
      ctx.fillRect(x - w / 2, top, w, bh);
      ctx.strokeRect(x - w / 2, top, w, bh);
    }
  }

  function drawGrid() {
    ctx.lineWidth = 1;
    ctx.strokeStyle = `rgba(${GOLD},0.035)`;
    const rows = 8, cols = 14;
    const gx = W / cols, gy = H / rows;
    const drift = (time * 0.15) % gx;
    for (let i = -1; i <= cols; i++) {
      const x = i * gx - drift;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let j = 0; j <= rows; j++) {
      const y = j * gy;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
  }

  function drawVignette() {
    const g = ctx.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.2, W / 2, H * 0.5, Math.max(W, H) * 0.75);
    g.addColorStop(0, 'rgba(13,10,2,0)');
    g.addColorStop(1, 'rgba(8,6,1,0.85)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function build() {
    grid = true;
    series = [
      makeSeries({ spacing: 46, speed: 0.55, jitter: 0.09, baseY: 0.52, amp: 0.30, color: GOLD,    alpha: 0.42, fill: 0.06, width: 2,   glow: 14 }),
      makeSeries({ spacing: 62, speed: 0.32, jitter: 0.07, baseY: 0.60, amp: 0.22, color: GOLD_HI, alpha: 0.16, fill: 0.03, width: 1.4, glow: 8 }),
    ];
    candles = makeCandles();
  }

  function frame() {
    ctx.clearRect(0, 0, W, H);
    drawGrid();
    drawCandles();
    series.forEach(drawSeries);
    drawVignette();
  }

  function loop() {
    if (document.hidden) { requestAnimationFrame(loop); return; }
    time += 1;
    stepCandles();
    series.forEach(stepSeries);
    frame();
    requestAnimationFrame(loop);
  }

  window.addEventListener('resize', resize, { passive: true });
  resize();                                    // builds + paints one frame immediately
  if (!REDUCED) requestAnimationFrame(loop);   // then animate (loop self-pauses when hidden)
})();
