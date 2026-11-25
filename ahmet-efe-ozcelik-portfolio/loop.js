/* Progress, in a Loop — the evolving material ribbon.
   A Möbius-like band: one surface that returns into itself.
   State 0 raw → 1 shaped → 2 structured → 3 engineered → 4 closed loop. */
(() => {
  'use strict';
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas = document.getElementById('loop');
  const ctx = canvas && canvas.getContext('2d');
  if (!ctx) return;

  const TAU = Math.PI * 2;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const lerp = (a, b, t) => a + (b - a) * t;

  let W = 0, H = 0, DPR = 1, mobile = false, SEG = 220;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    mobile = W < 760;
    SEG = mobile ? 150 : 230;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    dirty = true;
  }

  // ---------- sections → target state ----------
  const anchors = Array.from(document.querySelectorAll('[data-state]'));
  const stateName = document.getElementById('stateName');
  let active = anchors[0];
  function pickActive() {
    const mid = H * 0.5;
    let best = null, bestH = Infinity;
    for (const el of anchors) {
      const r = el.getBoundingClientRect();
      if (r.top <= mid && r.bottom >= mid && r.height < bestH) { best = el; bestH = r.height; }
    }
    if (best && best !== active) {
      active = best;
      document.body.classList.toggle('dark', active.dataset.tone === 'dark');
      if (stateName) stateName.textContent = active.dataset.name || '';
    }
  }

  function layoutFor(name) {
    const m = Math.min(W, H);
    if (name === 'hero') return mobile ? { x: W * .5, y: H * .78, r: W * .30, a: 1 } : { x: W * .74, y: H * .56, r: m * .27, a: 1 };
    if (name === 'center') return mobile ? { x: W * .5, y: H * .30, r: W * .26, a: 1 } : { x: W * .5, y: H * .33, r: m * .22, a: 1 };
    return mobile ? { x: W * .84, y: H * .16, r: W * .11, a: .55 } : { x: W * .82, y: H * .5, r: Math.min(W * .12, H * .22), a: 1 };
  }

  // ---------- live state ----------
  const S = { s: 0, x: 0, y: 0, r: 100, a: 1, tone: 0 };
  let yaw = 0.4, vel = 0, accum = 0, tiltX = 0, tiltY = 0, tTX = 0, tTY = 0;
  let energy = 0, pulse = 0, dirty = true, dragging = false, lastX = 0;
  const modes = { quality: 0, engineering: 0, ci: 0, digital: 0, sustain: 0 };
  let modeTarget = null, pinned = null;

  // waste fragments (deterministic)
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const FR = Array.from({ length: 30 }, () => ({
    t: -0.9 + rnd() * 1.8, off: 0.18 + rnd() * 0.42, z: (rnd() - .5) * .5,
    sz: 0.025 + rnd() * 0.05, rot: rnd() * TAU
  }));
  const grain = Array.from({ length: 400 }, () => rnd() - .5);

  // ---------- geometry ----------
  function project(p, cx, cy, R) {
    const cyaw = Math.cos(yaw), syaw = Math.sin(yaw);
    // spin around loop axis (z), then tilt (x), then cursor tilt (y)
    let x = p[0] * cyaw - p[1] * syaw, y = p[0] * syaw + p[1] * cyaw, z = p[2];
    const pitch = 1.08 + tiltY, cp = Math.cos(pitch), sp = Math.sin(pitch);
    let y2 = y * cp - z * sp, z2 = y * sp + z * cp;
    const cb = Math.cos(tiltX), sb = Math.sin(tiltX);
    let x3 = x * cb + z2 * sb, z3 = -x * sb + z2 * cb;
    const F = R * 4.2, k = F / (F - z3);
    return [cx + x3 * k, cy + y2 * k, z3];
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    if (S.a < 0.02) return;
    const s = S.s, R = S.r;
    const sus = modes.sustain;
    const closure = lerp(0.6 + 0.4 * smooth(0, 4, s) ** 1.3, 1, sus);
    const full = closure > 0.999;
    const rough = Math.max(0, 1 - s / 2) ** 1.3 * (1 - sus);
    const frag = clamp(1 - s / 2.6) * (1 - sus);
    const facet = clamp(smooth(2.2, 3, s) * (1 - .55 * smooth(3.6, 4, s)) + modes.quality);
    const ribs = clamp(smooth(1.4, 2.6, s) * (1 - .6 * smooth(3.6, 4, s)) + modes.engineering);
    const gloss = smooth(.8, 3, s);
    const greenEdge = clamp(smooth(2.7, 3.1, s) * .55 + smooth(3.85, 4, s) * .25);
    const dark = S.tone;
    const dash = modes.digital;

    const t0 = 0.35 * Math.PI;                    // gap position
    const span = closure * TAU;
    const W0 = R * 0.2;
    const N = SEG;
    const A = new Array(N + 1), B = new Array(N + 1);
    for (let i = 0; i <= N; i++) {
      const u = i / N, t = t0 + (TAU - span) / 2 + u * span;
      const n1 = Math.sin(3 * t + 1.3) * .5 + Math.sin(7 * t + .4) * .3 + Math.sin(13 * t) * .2;
      const n2 = Math.sin(29 * t + 2) * .6 + Math.sin(17 * t) * .4;
      const rr = R * (1 + rough * 0.11 * n1);
      const c = [rr * Math.cos(t), rr * Math.sin(t), R * 0.1 * Math.sin(2 * t) * (1 - .5 * gloss)];
      const phi = t * 0.5 + 0.6;                    // half twist → one continuous surface
      let w = W0 * (1 + rough * 0.38 * n2);
      if (!full) {
        const k = clamp((1 - closure) / 0.4);
        const taper = smooth(0, .07, u) * smooth(1, .93, u);
        w *= 1 - k * (1 - taper);
      }
      const dx = Math.cos(phi) * Math.cos(t), dy = Math.cos(phi) * Math.sin(t), dz = Math.sin(phi);
      A[i] = project([c[0] + w * dx, c[1] + w * dy, c[2] + w * dz], S.x, S.y, R);
      B[i] = project([c[0] - w * dx, c[1] - w * dy, c[2] - w * dz], S.x, S.y, R);
    }
    if (full) { A[N] = B[0]; B[N] = A[0]; }  // Möbius seam: edges swap

    const quads = [];
    for (let i = 0; i < N; i++) {
      if (dash > .05 && Math.floor(i / 5) % 2 === 1 && grain[i % 400] + .5 < dash) continue;
      quads.push(i);
    }
    quads.sort((i, j) => (A[i][2] + B[i][2] + A[i + 1][2]) - (A[j][2] + B[j][2] + A[j + 1][2]));

    const L = [-.42, -.62, .66], Hh = [-.25, -.37, .9];
    const base0 = dark ? [150, 152, 146] : [128, 122, 112];   // raw, warm, matte
    const base1 = dark ? [196, 198, 191] : [58, 62, 59];      // engineered metal
    ctx.globalAlpha = S.a;
    ctx.lineJoin = 'round';
    for (const i of quads) {
      const a1 = A[i], b1 = B[i], a2 = A[i + 1], b2 = B[i + 1];
      // screen-space normal approximation from projected + depth
      const ux = a2[0] - a1[0], uy = a2[1] - a1[1], uz = a2[2] - a1[2];
      const vx = b1[0] - a1[0], vy = b1[1] - a1[1], vz = b1[2] - a1[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
      let lam = Math.abs(nx * L[0] + ny * L[1] + nz * L[2]);
      let shade = .32 + .68 * lam;
      if (facet > 0) shade = lerp(shade, Math.round(shade * 5) / 5, facet);
      const spec = Math.abs(nx * Hh[0] + ny * Hh[1] + nz * Hh[2]) ** 28 * gloss;
      const gr = grain[i % 400] * 38 * rough;
      const m = smooth(0, 3, s);
      let r = lerp(base0[0], base1[0], m) * shade + gr + spec * 210;
      let g = lerp(base0[1], base1[1], m) * shade + gr + spec * 210;
      let b = lerp(base0[2], base1[2], m) * shade + gr + spec * 200;
      // energy: light flows only where interaction happens
      if (energy > .003) {
        let d = Math.abs(i / N - pulse); d = Math.min(d, 1 - d);
        const e = energy * Math.exp(-((d / .06) ** 2));
        r = lerp(r, 61, e); g = lerp(g, 205, e); b = lerp(b, 88, e);
      }
      const col = `rgb(${r | 0},${g | 0},${b | 0})`;
      ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = .7;
      ctx.beginPath();
      ctx.moveTo(a1[0], a1[1]); ctx.lineTo(a2[0], a2[1]); ctx.lineTo(b2[0], b2[1]); ctx.lineTo(b1[0], b1[1]);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      // engineered edges
      if (greenEdge > .02 || ribs > .02) {
        ctx.lineWidth = 1;
        if (greenEdge > .02) {
          ctx.strokeStyle = `rgba(61,205,88,${greenEdge * .9})`;
          ctx.beginPath(); ctx.moveTo(a1[0], a1[1]); ctx.lineTo(a2[0], a2[1]);
          ctx.moveTo(b1[0], b1[1]); ctx.lineTo(b2[0], b2[1]); ctx.stroke();
        }
        if (ribs > .02 && i % 6 === 0) {
          ctx.strokeStyle = dark ? `rgba(17,19,16,${ribs * .55})` : `rgba(242,241,234,${ribs * .6})`;
          ctx.beginPath(); ctx.moveTo(a1[0], a1[1]); ctx.lineTo(b1[0], b1[1]); ctx.stroke();
        }
      }
    }

    // waste: fragments drift away and disappear as the material is refined
    if (frag > .01) {
      const shown = frag * FR.length;
      FR.forEach((f, k) => {
        const al = clamp(shown - k);
        if (al <= 0) return;
        const t = t0 + f.t;
        const off = R * (1 + f.off * (1 + (1 - frag) * 1.6));
        const p = project([off * Math.cos(t), off * Math.sin(t), f.z * R], S.x, S.y, R);
        const sz = f.sz * R;
        ctx.fillStyle = dark ? `rgba(138,143,136,${al * .8})` : `rgba(128,122,112,${al * .85})`;
        ctx.beginPath();
        for (let v = 0; v < 3; v++) {
          const ang = f.rot + yaw * .5 + v * TAU / 3 + (v === 1 ? .6 : 0);
          const px = p[0] + Math.cos(ang) * sz * (v === 2 ? .55 : 1), py = p[1] + Math.sin(ang) * sz * .7;
          v ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.closePath(); ctx.fill();
      });
    }
    ctx.globalAlpha = 1;
  }

  // ---------- full-rotation discovery ----------
  const reveal = document.getElementById('reveal');
  let revealTimer = 0;
  function showReveal() {
    if (!reveal) return;
    reveal.textContent = 'Progress is not linear.';
    reveal.style.left = S.x + 'px';
    reveal.style.top = Math.min(H - 60, S.y + S.r * 0.9) + 'px';
    reveal.classList.add('on');
    energy = 1;
    clearTimeout(revealTimer);
    revealTimer = setTimeout(() => reveal.classList.remove('on'), 2800);
  }

  // ---------- input ----------
  const isUI = el => el && el.closest && el.closest('a,button,input,textarea,select,label');
  const onLoop = (x, y) => S.a > .5 && Math.hypot(x - S.x, (y - S.y) * 1.5) < S.r * 1.3;

  window.addEventListener('pointerdown', e => {
    if (e.button > 0 || isUI(e.target) || !onLoop(e.clientX, e.clientY)) return;
    dragging = true; lastX = e.clientX; vel = 0;
    document.body.style.cursor = 'grabbing';
    if (e.pointerType === 'mouse') e.preventDefault();
  });
  window.addEventListener('pointermove', e => {
    if (!reduce) {
      tTX = clamp((e.clientX - S.x) / W, -.5, .5) * .35;
      tTY = clamp((e.clientY - S.y) / H, -.5, .5) * .22;
    }
    if (dragging) {
      const d = (e.clientX - lastX) * 0.009; lastX = e.clientX;
      yaw += d; vel = d; accum += d;
      energy = Math.min(1, energy + Math.abs(d) * .5);
      pulse = (pulse + d * .25 + 1) % 1;
    } else if (e.pointerType === 'mouse') {
      document.body.style.cursor = !isUI(e.target) && onLoop(e.clientX, e.clientY) ? 'grab' : '';
    }
    dirty = true;
  }, { passive: true });
  const end = () => { if (dragging) { dragging = false; document.body.style.cursor = ''; if (reduce) vel = 0; } };
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);

  let lastScroll = window.scrollY;
  window.addEventListener('scroll', () => {
    const dy = window.scrollY - lastScroll; lastScroll = window.scrollY;
    if (!reduce) { energy = Math.min(.55, energy + Math.abs(dy) * .0012); pulse = (pulse + dy * .0004 + 1) % 1; }
    pickActive(); dirty = true;
  }, { passive: true });
  window.addEventListener('resize', () => { resize(); pickActive(); });

  // knowledge landscape → each concept affects the material
  document.querySelectorAll('.theme-btn').forEach(btn => {
    const mode = btn.dataset.mode;
    const list = document.getElementById(btn.getAttribute('aria-controls'));
    const enter = () => { modeTarget = mode; dirty = true; };
    const leave = () => { modeTarget = pinned; dirty = true; };
    btn.addEventListener('mouseenter', enter);
    btn.addEventListener('focus', enter);
    btn.addEventListener('mouseleave', leave);
    btn.addEventListener('blur', leave);
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') !== 'true';
      document.querySelectorAll('.theme-btn').forEach(b => {
        b.setAttribute('aria-expanded', 'false');
        const l = document.getElementById(b.getAttribute('aria-controls')); if (l) l.classList.remove('open');
      });
      btn.setAttribute('aria-expanded', String(open));
      if (list) list.classList.toggle('open', open);
      pinned = open ? mode : null; modeTarget = open ? mode : null;
      energy = Math.max(energy, .8); dirty = true;
    });
  });

  // ---------- loop ----------
  function frame() {
    const tgt = layoutFor(active ? active.dataset.layout : 'hero');
    const ts = parseFloat(active ? active.dataset.state : 0) || 0;
    const tone = document.body.classList.contains('dark') ? 1 : 0;
    const kS = reduce ? 1 : .03, kL = reduce ? 1 : .07;
    const before = S.s + S.x + S.y + S.r + S.a + S.tone + yaw + tiltX + tiltY;

    S.s = lerp(S.s, ts, kS); if (Math.abs(S.s - ts) < 1e-3) S.s = ts;
    S.x = lerp(S.x, tgt.x, kL); S.y = lerp(S.y, tgt.y, kL); S.r = lerp(S.r, tgt.r, kL); S.a = lerp(S.a, tgt.a, kL);
    S.tone = lerp(S.tone, tone, reduce ? 1 : .05);
    tiltX = lerp(tiltX, tTX, .05); tiltY = lerp(tiltY, tTY, .05);
    for (const k in modes) {
      const v = lerp(modes[k], modeTarget === k ? 1 : 0, reduce ? 1 : .06);
      if (Math.abs(v - modes[k]) > 1e-4) dirty = true;
      modes[k] = Math.abs(v) < 1e-3 ? 0 : v;
    }
    if (!dragging && Math.abs(vel) > 1e-4) { yaw += vel; accum += vel; vel *= .94; pulse = (pulse + vel * .25 + 1) % 1; }
    if (Math.abs(accum) >= TAU) { accum = 0; showReveal(); }
    if (modes.ci > .05 && !reduce) { energy = Math.max(energy, .7 * modes.ci); pulse = (pulse + .004) % 1; }
    if (energy > .003) { energy *= .965; dirty = true; } else energy = 0;

    const after = S.s + S.x + S.y + S.r + S.a + S.tone + yaw + tiltX + tiltY;
    if (dirty || Math.abs(after - before) > 1e-3) { draw(); dirty = false; }
    requestAnimationFrame(frame);
  }

  // text reveal (scroll → appearance)
  const rv = document.querySelectorAll('.sec-head, .step, .big-para, .cycle, .statement .display, .chapter-dl, .themes, .chapter-note, .piece, .efficiency, .theme');
  if ('IntersectionObserver' in window && !reduce) {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -12% 0px' });
    rv.forEach(el => { el.classList.add('rv'); io.observe(el); });
  }

  // ---------- energy trail on the dark surface ----------
  const trail = document.getElementById('trail');
  if (trail && !reduce) {
    const tc = trail.getContext('2d');
    const pts = []; let running = false;
    const size = () => { const r = trail.getBoundingClientRect(); trail.width = r.width * DPR; trail.height = r.height * DPR; tc.setTransform(DPR, 0, 0, DPR, 0, 0); };
    size(); window.addEventListener('resize', size);
    const sec = trail.parentElement;
    sec.addEventListener('pointermove', e => {
      const r = trail.getBoundingClientRect();
      pts.push({ x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() });
      if (!running) { running = true; requestAnimationFrame(tick); }
    }, { passive: true });
    function tick(now) {
      while (pts.length && now - pts[0].t > 1100) pts.shift();
      tc.clearRect(0, 0, trail.width, trail.height);
      tc.lineCap = 'round';
      for (let i = 1; i < pts.length; i++) {
        const p = pts[i], q = pts[i - 1];
        if (Math.hypot(p.x - q.x, p.y - q.y) > 120) continue;
        const life = 1 - (now - p.t) / 1100;
        tc.strokeStyle = `rgba(61,205,88,${life * .55})`;
        tc.lineWidth = 1 + life * 2.2;
        tc.beginPath(); tc.moveTo(q.x, q.y); tc.lineTo(p.x, p.y); tc.stroke();
      }
      if (pts.length) requestAnimationFrame(tick); else running = false;
    }
  }

  resize(); pickActive();
  const t0 = layoutFor('hero'); S.x = t0.x; S.y = t0.y; S.r = t0.r;
  requestAnimationFrame(frame);
})();
