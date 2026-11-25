/* A 3D power system drawn as a living engineering drawing.
   Generator → transmission towers → MV substation (transformer + switchgear) → factory.
   Current pulses travel along the three phases. Scroll moves the camera through the system,
   drag orbits it, click sends a surge. Pure Canvas 2D, no libraries. */
(() => {
  'use strict';
  const canvas = document.getElementById('grid3d');
  const ctx = canvas && canvas.getContext('2d');
  if (!ctx) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const API = window.GRID = { eta: 0.6, energy: 0.4, stage: 'hero', surge() {} };

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;

  // ---------------------------------------------------------------- geometry
  const G = { grid: [], struct: [], wire: [], accent: [] };
  const L = (g, a, b) => G[g].push(a[0], a[1], a[2], b[0], b[1], b[2]);
  const poly = (g, pts, closed) => { for (let i = 0; i < pts.length - 1; i++) L(g, pts[i], pts[i + 1]); if (closed) L(g, pts[pts.length - 1], pts[0]); };
  function box(g, x0, y0, z0, x1, y1, z1) {
    const c = [[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1],[x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1]];
    [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]].forEach(([a,b]) => L(g, c[a], c[b]));
  }
  function cyl(g, x, y0, z, r, h, n, rings = 2) {
    for (let k = 0; k < rings; k++) {
      const y = y0 + h * k / (rings - 1), pts = [];
      for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; pts.push([x + Math.cos(a) * r, y, z + Math.sin(a) * r]); }
      poly(g, pts, true);
    }
    for (let i = 0; i < n; i += 2) { const a = i / n * Math.PI * 2; L(g, [x + Math.cos(a) * r, y0, z + Math.sin(a) * r], [x + Math.cos(a) * r, y0 + h, z + Math.sin(a) * r]); }
  }

  const mobile = innerWidth < 760;
  // ground: blueprint grid
  const STEP = mobile ? 40 : 25;
  for (let x = -250; x <= 250; x += STEP) L('grid', [x, 0, 120], [x, 0, -760]);
  for (let z = 120; z >= -760; z -= STEP) L('grid', [-250, 0, z], [250, 0, z]);

  // --- generator (stator static, rotor dynamic) at origin
  const GZ = 0, GY = 24, GR = 20;
  box('struct', -26, 0, -14, 26, 4, 14);             // skid
  box('struct', -10, 4, -10, -6, GY - GR + 2, 10);
  box('struct', 6, 4, -10, 10, GY - GR + 2, 10);
  for (const zz of [-10, 10]) {                        // stator rings (axis along z)
    const outer = [], inner = [];
    for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2; outer.push([Math.cos(a) * GR, GY + Math.sin(a) * GR, zz]); inner.push([Math.cos(a) * (GR - 4), GY + Math.sin(a) * (GR - 4), zz]); }
    poly('struct', outer, true); poly('struct', inner, true);
  }
  for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; L('struct', [Math.cos(a) * GR, GY + Math.sin(a) * GR, -10], [Math.cos(a) * GR, GY + Math.sin(a) * GR, 10]);
    L('struct', [Math.cos(a) * (GR - 4), GY + Math.sin(a) * (GR - 4), -10], [Math.cos(a) * GR, GY + Math.sin(a) * GR, -10]); }
  L('struct', [0, GY, 22], [0, GY, -22]);              // shaft
  box('struct', -5, GY + GR - 1, -6, 5, GY + GR + 6, 2); // terminal box

  // --- towers
  const TOWERS = [-100, -190, -280, -370];
  const ATT = [[-15, 44], [0, 62], [15, 44]];          // three-phase attachment points (x, y)
  function tower(z) {
    const lv = [0, 14, 28, 42, 52];
    const w = y => lerp(8, 2.8, y / 52);
    for (let i = 0; i < lv.length; i++) {
      const y = lv[i], s = w(y);
      poly('struct', [[-s, y, z - s], [s, y, z - s], [s, y, z + s], [-s, y, z + s]], true);
      if (i < lv.length - 1) {
        const y2 = lv[i + 1], s2 = w(y2);
        for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) L('struct', [sx * s, y, z + sz * s], [sx * s2, y2, z + sz * s2]);
        L('struct', [-s, y, z - s], [s2, y2, z - s2]); L('struct', [s, y, z - s], [-s2, y2, z - s2]);
        L('struct', [-s, y, z + s], [s2, y2, z + s2]); L('struct', [s, y, z + s], [-s2, y2, z + s2]);
        L('struct', [-s, y, z - s], [-s2, y2, z + s2]); L('struct', [s, y, z + s], [s2, y2, z - s2]);
      }
    }
    const t = w(52);
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) L('struct', [sx * t, 52, z + sz * t], [0, 66, z]);
    for (const dz of [-2, 2]) { L('struct', [-17, 48, z + dz], [17, 48, z + dz]); L('struct', [-17, 48, z + dz], [-t, 44, z + dz]); L('struct', [17, 48, z + dz], [t, 44, z + dz]); }
    for (const [x, y] of ATT) { const top = x === 0 ? 66 : 48; L('accent', [x, top, z], [x, y, z]); }   // insulator strings
  }
  TOWERS.forEach(tower);

  // --- substation
  const SZ = -450;
  for (const x of [-22, 22]) box('struct', x - 1.5, 0, SZ - 1.5, x + 1.5, 48, SZ + 1.5);   // gantry
  L('struct', [-24, 46, SZ], [24, 46, SZ]); L('struct', [-24, 48, SZ], [24, 48, SZ]);
  for (let x = -22; x < 22; x += 4) L('struct', [x, 46, SZ], [x + 4, 48, SZ]);
  // transformer
  const TZ = -478;
  box('struct', -16, 0, TZ - 9, 16, 3, TZ + 9);
  box('struct', -13, 3, TZ - 7, 13, 21, TZ + 7);
  for (let x = -12; x <= 12; x += 2) { L('struct', [x, 5, TZ + 7], [x, 19, TZ + 7]); L('struct', [x, 5, TZ - 7], [x, 19, TZ - 7]); }  // radiator fins
  for (let z = TZ - 6; z <= TZ + 6; z += 2) { L('struct', [13.5, 5, z], [16, 5, z]); L('struct', [16, 5, z], [16, 19, z]); L('struct', [16, 19, z], [13.5, 19, z]); }
  cyl('struct', 9, 21, TZ - 3, 3.5, 5, 12);                                                   // conservator-ish
  const BUSH = [-8, 0, 8];
  BUSH.forEach(x => { cyl('accent', x, 21, TZ + 2, 1.4, 12, 8, 4); });
  BUSH.forEach((x, i) => L('wire', [ATT[i][0], 46, SZ], [x, 33, TZ + 2]));                    // drops gantry → bushings
  // MV switchgear lineup (SM6-style cubicles), fronts face +z
  const SW_Z0 = -505, SW_Z1 = -517, SW = [];
  for (let i = 0; i < 6; i++) {
    const x0 = -27 + i * 9, x1 = x0 + 8.4;
    box('struct', x0, 0, SW_Z1, x1, 22, SW_Z0);
    const f = SW_Z0 + 0.01;
    poly('accent', [[x0 + 1, 2, f], [x1 - 1, 2, f], [x1 - 1, 12, f], [x0 + 1, 12, f]], true);       // door
    poly('struct', [[x0 + 1, 14, f], [x1 - 1, 14, f], [x1 - 1, 20.5, f], [x0 + 1, 20.5, f]], true);  // LV compartment
    const cx = (x0 + x1) / 2;                                                                          // mimic single-line diagram
    L('accent', [cx, 20, f], [cx, 18, f]); L('accent', [cx, 18, f], [cx + 1.3, 16.5, f]); L('accent', [cx, 16, f], [cx, 14.6, f]);
    SW.push(cx);
  }
  L('accent', [-27, 21, SW_Z0 + 0.01], [27, 21, SW_Z0 + 0.01]);                                  // busbar line
  L('wire', [0, 6, TZ + 9], [0, 1, TZ + 12]); L('wire', [0, 1, TZ + 12], [0, 1, SW_Z0 + 2]);

  // --- factory (use)
  const FZ0 = -585, FZ1 = -655;
  box('struct', -44, 0, FZ1, -4, 16, FZ0);
  for (let z = FZ0; z > FZ1; z -= 10) {                // saw-tooth roof
    L('struct', [-44, 16, z], [-44, 24, z - 7]); L('struct', [-4, 16, z], [-4, 24, z - 7]);
    L('struct', [-44, 24, z - 7], [-4, 24, z - 7]); L('struct', [-44, 24, z - 7], [-44, 16, z - 10]); L('struct', [-4, 24, z - 7], [-4, 16, z - 10]);
  }
  box('struct', 6, 0, FZ1, 42, 20, FZ0 - 12);
  box('struct', 14, 20, FZ0 - 30, 22, 26, FZ0 - 22);
  const WIN = [];
  for (let x = -40; x <= -8; x += 4) for (const y of [5, 10]) WIN.push([x, y, FZ0 + 0.05]);
  for (let x = 9; x <= 39; x += 4) for (const y of [6, 11, 16]) WIN.push([x, y, FZ0 - 11.95]);
  // streetlights along the street (where light pollution happens)
  const LAMPS = [];
  for (let z = -545; z >= -690; z -= 24) for (const sx of [-56, 54]) {
    const dir = sx < 0 ? 1 : -1;
    L('struct', [sx, 0, z], [sx, 14, z]); L('struct', [sx, 14, z], [sx + dir * 4, 15, z]);
    LAMPS.push([sx + dir * 4, 14.6, z]);
  }
  L('grid', [-50, 0.1, -530], [-50, 0.1, -700]); L('grid', [48, 0.1, -530], [48, 0.1, -700]);
  const DIST = [[0, 1, SW_Z1 - 1], [0, 1, FZ0 + 10], [-24, 1, FZ0 + 10], [-24, 4, FZ0]];
  poly('wire', DIST);
  L('wire', [0, 1, FZ0 + 10], [24, 1, FZ0 + 10]); L('wire', [24, 1, FZ0 + 10], [24, 4, FZ0 - 12]);

  // --- conductors (catenaries) and pulse paths
  const PATHS = [];
  for (let p = 0; p < 3; p++) {
    const pts = [[(p - 1) * 3, GY + GR + 6, -2], [(p - 1) * 6, 30, -40]];
    const anchors = TOWERS.map(z => [ATT[p][0], ATT[p][1], z]).concat([[ATT[p][0], 46, SZ]]);
    let prev = pts[1];
    for (const a of anchors) {
      const n = 14, sag = Math.abs(a[2] - prev[2]) * 0.06;
      for (let i = 1; i <= n; i++) { const t = i / n; pts.push([lerp(prev[0], a[0], t), lerp(prev[1], a[1], t) - sag * 4 * t * (1 - t), lerp(prev[2], a[2], t)]); }
      prev = a;
    }
    pts.push([BUSH[p], 33, TZ + 2]);
    poly('wire', pts);
    PATHS.push(mkPath(pts));
  }
  PATHS.push(mkPath([[0, 6, TZ + 9], [0, 1, TZ + 12], [0, 1, SW_Z0 + 2], [0, 1, SW_Z1 - 1]].concat(DIST.slice(1))));
  function mkPath(pts) {
    const acc = [0];
    for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]));
    return { pts, acc, len: acc[acc.length - 1] };
  }
  function along(path, s, out) {
    const d = s * path.len, a = path.acc; let i = 1;
    while (i < a.length - 1 && a[i] < d) i++;
    const t = (d - a[i - 1]) / ((a[i] - a[i - 1]) || 1), p = path.pts[i - 1], q = path.pts[i];
    out[0] = lerp(p[0], q[0], t); out[1] = lerp(p[1], q[1], t); out[2] = lerp(p[2], q[2], t);
  }
  const PULSES = [];
  PATHS.forEach((path, k) => { const n = k < 3 ? (mobile ? 3 : 5) : 4; for (let i = 0; i < n; i++) PULSES.push({ k, s: (i / n + k * 0.13) % 1 }); });

  for (const g in G) G[g] = new Float32Array(G[g]);
  const LABELS = [
    { p: [0, 58, 0], n: '01', t: 'Generator', k: 'gen' },
    { p: [0, 80, -235], n: '02', t: 'Transmission', k: 'tx' },
    { p: [0, 60, -478], n: '03', t: 'MV substation', k: 'dist' },
    { p: [0, 40, -620], n: '04', t: 'City & street lights', k: 'use' }
  ];

  // ---------------------------------------------------------------- camera
  const KEYS = {
    hero:  { t: [0, 30, -250], d: 360, yaw: 0.62, pitch: 0.30, sx: 0.66 },
    gen:   { t: [0, 26, 0],    d: 95,  yaw: 0.75, pitch: 0.18, sx: 0.68 },
    tx:    { t: [0, 42, -220], d: 150, yaw: 1.30, pitch: 0.10, sx: 0.70 },
    dist:  { t: [-4, 14, -500], d: 100, yaw: 0.55, pitch: 0.2, sx: 0.72 },
    use:   { t: [0, 16, -615], d: 150, yaw: 0.6, pitch: 0.22, sx: 0.70 },
    over:  { t: [0, 20, -330], d: 520, yaw: -0.6, pitch: 0.42, sx: 0.62 },
    over2: { t: [0, 20, -320], d: 470, yaw: -0.95, pitch: 0.55, sx: 0.5 },
    plan:  { t: [0, 0, -320],  d: 560, yaw: 0.25, pitch: 1.2, sx: 0.5 }
  };
  const cam = Object.assign({}, KEYS.hero, { t: KEYS.hero.t.slice() });
  let key = KEYS.hero, orbitYaw = 0, orbitPitch = 0, parX = 0, parY = 0, tParX = 0, tParY = 0;

  let W = 0, H = 0, DPR = 1;
  function resize() {
    DPR = Math.min(devicePixelRatio || 1, mobile ? 1.5 : 2);
    W = innerWidth; H = innerHeight;
    canvas.width = W * DPR | 0; canvas.height = H * DPR | 0;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  resize(); addEventListener('resize', resize);

  // glow sprites
  function sprite(r, g, b) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, `rgba(255,255,255,1)`); gr.addColorStop(.12, `rgba(${r},${g},${b},.95)`);
    gr.addColorStop(.4, `rgba(${r},${g},${b},.25)`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return c;
  }
  const SPR_G = sprite(61, 205, 88), SPR_H = sprite(224, 119, 63), SPR_W = sprite(242, 236, 205);

  // ---------------------------------------------------------------- render
  let C0, C1, C2, f0, f1, f2, r0, r1, r2, u0, u1, u2, F, SX, SY;
  const P = new Float32Array(3);
  function setCamera() {
    const yaw = cam.yaw + orbitYaw + parX, pitch = clamp(cam.pitch + orbitPitch + parY, 0.02, 1.5);
    const cp = Math.cos(pitch);
    C0 = cam.t[0] + Math.sin(yaw) * cp * cam.d; C1 = cam.t[1] + Math.sin(pitch) * cam.d; C2 = cam.t[2] + Math.cos(yaw) * cp * cam.d;
    f0 = cam.t[0] - C0; f1 = cam.t[1] - C1; f2 = cam.t[2] - C2;
    let n = Math.hypot(f0, f1, f2); f0 /= n; f1 /= n; f2 /= n;
    r0 = -f2; r1 = 0; r2 = f0; n = Math.hypot(r0, r2) || 1; r0 /= n; r2 /= n;      // right = f × up
    u0 = r1 * f2 - r2 * f1; u1 = r2 * f0 - r0 * f2; u2 = r0 * f1 - r1 * f0;
    F = Math.min(W, H * 1.6) * 0.95;
    SX = W * (mobile ? 0.5 : cam.sx); SY = H * 0.52;
  }
  function proj(x, y, z) {
    const dx = x - C0, dy = y - C1, dz = z - C2;
    const cz = dx * f0 + dy * f1 + dz * f2;
    if (cz < 4) return false;
    P[0] = SX + (dx * r0 + dy * r1 + dz * r2) * F / cz;
    P[1] = SY - (dx * u0 + dy * u1 + dz * u2) * F / cz;
    P[2] = cz; return true;
  }
  const NB = 6;
  function drawGroup(arr, color, alphaMul, width, fog) {
    const paths = Array.from({ length: NB }, () => new Path2D());
    const used = new Uint8Array(NB);
    for (let i = 0; i < arr.length; i += 6) {
      if (!proj(arr[i], arr[i + 1], arr[i + 2])) continue;
      const ax = P[0], ay = P[1], az = P[2];
      if (!proj(arr[i + 3], arr[i + 4], arr[i + 5])) continue;
      const z = (az + P[2]) * 0.5;
      const a = clamp(1 - z / fog, 0, 1);
      if (a <= 0.02) continue;
      const b = Math.min(NB - 1, a * NB | 0);
      paths[b].moveTo(ax, ay); paths[b].lineTo(P[0], P[1]); used[b] = 1;
    }
    ctx.lineWidth = width;
    for (let b = 0; b < NB; b++) if (used[b]) { ctx.strokeStyle = color((b + 1) / NB * alphaMul); ctx.stroke(paths[b]); }
  }

  let rotor = 0, energy = 0.4, sg = 0, use = 0, last = performance.now(), time = 0;
  function drawRotor() {
    ctx.lineWidth = 1.2;
    const path = new Path2D();
    for (let k = 0; k < 4; k++) {
      const a = rotor + k * Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(a + .32), sb = Math.sin(a + .32), cm = Math.cos(a - .32), sm = Math.sin(a - .32);
      const ring = [[cm * 4, sm * 4], [cm * 14, sm * 14], [ca * 15.2, sa * 15.2], [cb * 14, sb * 14], [cb * 4, sb * 4]];
      for (const zz of [-8, 8]) {
        let first = true;
        for (const [x, y] of ring) { if (!proj(x, GY + y, zz)) { first = true; continue; } first ? path.moveTo(P[0], P[1]) : path.lineTo(P[0], P[1]); first = false; }
      }
      for (const [x, y] of [ring[1], ring[3]]) { if (proj(x, GY + y, -8)) { const ax = P[0], ay = P[1]; if (proj(x, GY + y, 8)) { path.moveTo(ax, ay); path.lineTo(P[0], P[1]); } } }
    }
    ctx.strokeStyle = `rgba(61,205,88,${0.45 + energy * 0.5})`; ctx.stroke(path);
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; time += dt;
    const k = reduce ? 1 : 1 - Math.pow(0.0009, dt);   // ~ critically damped camera
    for (const p of ['d', 'yaw', 'pitch', 'sx']) cam[p] = lerp(cam[p], key[p], k);
    for (let i = 0; i < 3; i++) cam.t[i] = lerp(cam.t[i], key.t[i], k);
    parX = lerp(parX, tParX, 0.05); parY = lerp(parY, tParY, 0.05);
    if (!dragging) { orbitYaw *= 1 - dt * 0.35; orbitPitch *= 1 - dt * 0.6; }
    energy = lerp(energy, API.energy, 1 - Math.pow(0.2, dt)); API.energy = lerp(API.energy, 0.4, dt * 0.5);
    sg = lerp(sg, API.stage === 'dist' ? 1 : 0, dt * 2.5);
    use = lerp(use, API.stage === 'use' ? 1 : 0, dt * 2.5);
    if (!reduce) rotor += dt * (1.1 + energy * 3);

    ctx.clearRect(0, 0, W, H);
    setCamera();
    drawGroup(G.grid, a => `rgba(138,143,136,${a * 0.22})`, 1, 1, 700);
    drawGroup(G.struct, a => `rgba(242,241,234,${a * 0.62})`, 1, 1, 900);
    drawGroup(G.wire, a => `rgba(242,241,234,${a * 0.4})`, 1, 1, 900);
    ctx.globalCompositeOperation = 'lighter';
    drawGroup(G.accent, a => `rgba(61,205,88,${a * (0.12 + sg * 0.28)})`, 1, 4, 900);
    drawGroup(G.accent, a => `rgba(61,205,88,${a * (0.5 + sg * 0.5)})`, 1, 1.1, 900);
    drawRotor();

    // windows: brighter with efficiency
    const eta = API.eta;
    for (const w of WIN) if (proj(w[0], w[1], w[2])) {
      const s = clamp(160 / P[2], 0.6, 6);
      ctx.fillStyle = `rgba(242,241,234,${0.25 + eta * 0.6})`;
      ctx.fillRect(P[0] - s, P[1] - s * 0.6, s * 2, s * 1.2);
    }
    // street lights: light on the street vs light lost to the sky
    for (const l of LAMPS) {
      if (proj(l[0], 0.2, l[2])) {               // pool on the street
        const s = clamp(4200 / P[2], 6, 130) * (0.5 + eta * 0.7);
        ctx.globalAlpha = 0.25 + eta * 0.45; ctx.drawImage(SPR_W, P[0] - s, P[1] - s * 0.45, s * 2, s * 0.9);
      }
      if (proj(l[0], l[1], l[2])) {               // the lamp itself
        const s = clamp(1100 / P[2], 3, 26);
        ctx.globalAlpha = 0.9; ctx.drawImage(SPR_W, P[0] - s, P[1] - s, s * 2, s * 2);
      }
      const lost = 1 - eta;                         // upward glow = wasted light
      for (let h = 1; h <= 3; h++) if (proj(l[0], l[1] + h * 9 + Math.sin(time * 0.6 + l[2]) * 1.5, l[2])) {
        const s = clamp(2200 / P[2], 3, 70) * (0.6 + h * 0.35) * (0.3 + use * 0.7);
        ctx.globalAlpha = lost * (0.55 - h * 0.12); ctx.drawImage(SPR_H, P[0] - s, P[1] - s, s * 2, s * 2);
      }
    }
    ctx.globalAlpha = 1;

    // current pulses
    const speed = reduce ? 0 : (0.035 + energy * 0.09);
    const Q = [0, 0, 0];
    for (const p of PULSES) {
      const path = PATHS[p.k];
      p.s = (p.s + dt * speed * (300 / path.len)) % 1;
      for (let t = 0; t < 4; t++) {
        const s = p.s - t * 0.006; if (s < 0) continue;
        along(path, s, Q); if (!proj(Q[0], Q[1], Q[2])) continue;
        const sz = clamp(1100 / P[2], 3, 34) * (1 - t * 0.2) * (0.7 + energy * 0.6);
        ctx.globalAlpha = (1 - t * 0.24) * clamp(1 - P[2] / 1000, 0.1, 1) * (0.55 + energy * 0.45);
        ctx.drawImage(SPR_G, P[0] - sz, P[1] - sz, sz * 2, sz * 2);
      }
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';

    // labels on the drawing
    ctx.textBaseline = 'middle';
    for (const lb of LABELS) {
      if (!proj(lb.p[0], lb.p[1], lb.p[2])) continue;
      const on = API.stage === lb.k, far = API.stage === 'hero' || API.stage === 'over' || API.stage === 'over2' || API.stage === 'plan';
      if (!on && !far) continue;
      const x = P[0], y = P[1];
      ctx.globalAlpha = on ? 1 : 0.75;
      ctx.strokeStyle = on ? 'rgba(61,205,88,.9)' : 'rgba(242,241,234,.35)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 14, y - 14); ctx.lineTo(x + 26, y - 14); ctx.stroke();
      ctx.fillStyle = on ? '#3DCD58' : 'rgba(242,241,234,.5)';
      ctx.beginPath(); ctx.arc(x, y, 2.5, 0, 6.3); ctx.fill();
      ctx.font = '500 11px "JetBrains Mono", monospace';
      ctx.fillStyle = on ? '#3DCD58' : 'rgba(138,143,136,1)'; ctx.fillText(lb.n, x + 32, y - 14);
      ctx.font = '500 13px "Inter Tight", system-ui, sans-serif';
      ctx.fillStyle = on ? '#F2F1EA' : 'rgba(242,241,234,.75)'; ctx.fillText(lb.t, x + 54, y - 14);
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- input
  let dragging = false, lx = 0, ly = 0, moved = 0;
  canvas.addEventListener('pointerdown', e => {
    dragging = true; moved = 0; lx = e.clientX; ly = e.clientY;
    canvas.classList.add('dragging'); canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    if (!dragging) return;
    const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
    orbitYaw -= dx * 0.006; orbitPitch = clamp(orbitPitch + dy * 0.004, -0.4, 0.9);
    API.energy = Math.min(1, API.energy + (Math.abs(dx) + Math.abs(dy)) * 0.002);   // moving the system = work
  });
  const up = e => { if (!dragging) return; dragging = false; canvas.classList.remove('dragging'); if (moved < 6) API.surge(); };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  addEventListener('pointermove', e => { if (e.pointerType !== 'mouse' || reduce) return; tParX = (e.clientX / W - 0.5) * -0.12; tParY = (e.clientY / H - 0.5) * 0.06; }, { passive: true });

  API.surge = () => { API.energy = 1; };
  API.setStage = name => { if (KEYS[name]) { key = KEYS[name]; API.stage = name; } };
  requestAnimationFrame(frame);
})();
