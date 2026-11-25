/* A small power system, drawn like a technical illustration.
   Generator > transmission > substation > city.
   Solid shaded geometry with ink outlines, painter-sorted. No libraries. */
(() => {
  'use strict';
  const canvas = document.getElementById('scene');
  const ctx = canvas && canvas.getContext('2d');
  if (!ctx) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = innerWidth < 760;
  const API = window.SCENE = { eta: 0.6, stage: 'hero', setStage() {}, surge() {} };

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;

  // ------------------------------------------------------------ palette (day, night)
  const PAL = {
    bg:    [[238, 236, 228], [15, 18, 15]],
    ink:   [[34, 36, 31],    [150, 158, 146]],
    plot:  [[230, 227, 217], [21, 25, 21]],
    road:  [[214, 211, 201], [27, 31, 27]],
    wall:  [[247, 245, 239], [40, 45, 40]],
    steel: [[218, 220, 214], [46, 52, 47]],
    dark:  [[176, 178, 170], [28, 32, 28]],
    roof:  [[229, 225, 214], [34, 39, 34]],
    glass: [[200, 207, 202], [30, 36, 33]],
    green: [[52, 176, 76],   [61, 205, 88]]
  };
  let night = 0;
  const C = {};
  function palette() { for (const k in PAL) { const p = PAL[k]; C[k] = [lerp(p[0][0], p[1][0], night), lerp(p[0][1], p[1][1], night), lerp(p[0][2], p[1][2], night)]; } }
  const rgb = (c, a = 1, m = 1) => `rgba(${c[0] * m | 0},${c[1] * m | 0},${c[2] * m | 0},${a})`;

  // ------------------------------------------------------------ geometry builders
  const FACES = [], LINES = [], GROUND = [], WIRES = [], LAMPS = [], WINDOWS = [];
  function normal(pts) {
    let x = 0, y = 0, z = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      x += (a[1] - b[1]) * (a[2] + b[2]); y += (a[2] - b[2]) * (a[0] + b[0]); z += (a[0] - b[0]) * (a[1] + b[1]);
    }
    const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l];
  }
  function centroid(pts) { const c = [0, 0, 0]; for (const p of pts) { c[0] += p[0]; c[1] += p[1]; c[2] += p[2]; } return c.map(v => v / pts.length); }
  function face(pts, mat, center, list = FACES) {
    const n = normal(pts), c = centroid(pts);
    if (center && (n[0] * (c[0] - center[0]) + n[1] * (c[1] - center[1]) + n[2] * (c[2] - center[2])) < 0) { n[0] = -n[0]; n[1] = -n[1]; n[2] = -n[2]; }
    const f = { pts, mat, n, c, ds: !center, det: [] };
    list.push(f); return f;
  }
  function box(x0, y0, z0, x1, y1, z1, mat, top) {
    const ctr = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
    return {
      front: face([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], mat, ctr),
      back:  face([[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], mat, ctr),
      left:  face([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], mat, ctr),
      right: face([[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], mat, ctr),
      top:   face([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], top || mat, ctr)
    };
  }
  // cylinder along an axis; base point b, length len
  function cyl(axis, b, r, len, n, mat, caps = 'end') {
    const P = (a, t) => {
      const u = Math.cos(a) * r, v = Math.sin(a) * r;
      if (axis === 'y') return [b[0] + u, b[1] + t, b[2] + v];
      if (axis === 'z') return [b[0] + u, b[1] + v, b[2] + t];
      return [b[0] + t, b[1] + u, b[2] + v];
    };
    const ctr = axis === 'y' ? [b[0], b[1] + len / 2, b[2]] : axis === 'z' ? [b[0], b[1], b[2] + len / 2] : [b[0] + len / 2, b[1], b[2]];
    const out = { sides: [], cap0: null, cap1: null };
    for (let i = 0; i < n; i++) {
      const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2;
      out.sides.push(face([P(a0, 0), P(a1, 0), P(a1, len), P(a0, len)], mat, ctr));
    }
    const ring = t => Array.from({ length: n }, (_, i) => P(i / n * Math.PI * 2, t));
    if (caps === 'both' || caps === 'start') out.cap0 = face(ring(0), mat, ctr);
    if (caps === 'both' || caps === 'end') out.cap1 = face(ring(len), mat, ctr);
    return out;
  }
  const line = (a, b, w = 1, kind = 'ink') => LINES.push({ a, b, w, kind });
  const rect = (pts, kind) => ({ pts, kind });

  // windows on a vertical face, plane given by axis ('z' or 'x') and coordinate
  function windows(f, axis, k, u0, u1, y0, y1, du, dy, ww, wh, litP = 0.72) {
    for (let y = y0; y <= y1 - wh; y += dy) for (let u = u0; u <= u1 - ww; u += du) {
      const pts = axis === 'z' ? [[u, y, k], [u + ww, y, k], [u + ww, y + wh, k], [u, y + wh, k]]
                               : [[k, y, u], [k, y, u + ww], [k, y + wh, u + ww], [k, y + wh, u]];
      const d = rect(pts, 'win'); d.lit = Math.random() < litP; f.det.push(d);
    }
  }

  // ------------------------------------------------------------ the system
  // site plots (drawn first, on the ground)
  const plot = (x0, z0, x1, z1, mat = 'plot') => face([[x0, 0, z0], [x1, 0, z0], [x1, 0, z1], [x0, 0, z1]], mat, null, GROUND);
  plot(-42, 34, 42, -46);
  plot(-48, -392, 48, -476);
  const city = plot(-82, -508, 82, -668);
  plot(-7, -508, 7, -668, 'road');
  for (let z = -512; z > -664; z -= 9) GROUND.push({ line: [[0, 0.05, z], [0, 0.05, z - 4.5]] });

  // 01 generator
  box(-30, 0, -18, 30, 3, 26, 'dark');                       // skid
  box(-11, 3, -9, -6, 9, 9, 'steel'); box(6, 3, -9, 11, 9, 9, 'steel');
  const stator = cyl('z', [0, 22, -12], 15, 24, mobile ? 20 : 28, 'wall', 'both');
  for (let i = 0; i < stator.sides.length; i += 2) stator.sides[i].det.push(rect(stator.sides[i].pts.slice(0, 2).concat(stator.sides[i].pts.slice(2)), 'none'));
  box(-6, 36, -6, 6, 42, 4, 'steel');                        // terminal box
  cyl('z', [0, 22, 12], 7, 6, 18, 'steel', 'end');           // exciter
  const disc = cyl('z', [0, 22, 18], 10, 2.4, 24, 'dark', 'end');
  box(-13, 3, -40, 13, 30, -18, 'wall', 'roof');            // turbine hall / source
  cyl('y', [6, 30, -30], 3, 12, 14, 'steel', 'end');         // stack
  const ROTOR = { c: [0, 22, 20.5], r: 9 };

  // 02 transmission towers (lattice as lines)
  const TOWERS = [-92, -172, -252, -332];
  const ATT = [[-15, 44], [0, 62], [15, 44]];
  function tower(z) {
    const lv = [0, 14, 28, 42, 52], w = y => lerp(8, 2.8, y / 52);
    for (let i = 0; i < lv.length; i++) {
      const y = lv[i], s = w(y), sq = [[-s, y, z - s], [s, y, z - s], [s, y, z + s], [-s, y, z + s]];
      for (let k = 0; k < 4; k++) line(sq[k], sq[(k + 1) % 4], 0.8);
      if (i < lv.length - 1) {
        const y2 = lv[i + 1], s2 = w(y2);
        for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) line([sx * s, y, z + sz * s], [sx * s2, y2, z + sz * s2], 1.3);
        line([-s, y, z - s], [s2, y2, z - s2], 0.6); line([s, y, z - s], [-s2, y2, z - s2], 0.6);
        line([-s, y, z + s], [s2, y2, z + s2], 0.6); line([s, y, z + s], [-s2, y2, z + s2], 0.6);
        line([-s, y, z - s], [-s2, y2, z + s2], 0.6); line([s, y, z + s], [s2, y2, z - s2], 0.6);
      }
    }
    const t = w(52);
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) line([sx * t, 52, z + sz * t], [0, 66, z], 1.1);
    for (const dz of [-1.5, 1.5]) { line([-17, 48, z + dz], [17, 48, z + dz], 1.1); line([-17, 48, z + dz], [-t, 44, z + dz], 0.7); line([17, 48, z + dz], [t, 44, z + dz], 0.7); }
    for (const [x, y] of ATT) line([x, x === 0 ? 66 : 48, z], [x, y, z], 2.2, 'ins');
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) box(sx * 8 - 1.5, 0, z + sz * 8 - 1.5, sx * 8 + 1.5, 1, z + sz * 8 + 1.5, 'dark');
  }
  TOWERS.forEach(tower);

  // 03 substation
  const GZ = -404;
  for (const x of [-22, 22]) box(x - 1.2, 0, GZ - 1.2, x + 1.2, 48, GZ + 1.2, 'steel');
  box(-24, 45, GZ - 1, 24, 48, GZ + 1, 'steel');
  const TZ = -434;
  box(-17, 0, TZ - 10, 17, 3, TZ + 10, 'dark');
  const tank = box(-12, 3, TZ - 7, 12, 22, TZ + 7, 'wall', 'roof');
  for (const sgn of [-1, 1]) {
    const rad = box(sgn > 0 ? 12 : -17, 5, TZ - 6, sgn > 0 ? 17 : -12, 20, TZ + 6, 'steel');
    const f = rad.front, x0 = sgn > 0 ? 12.6 : -16.4;
    for (let i = 0; i < 5; i++) f.det.push(rect([[x0 + i, 5.6, TZ + 6.02], [x0 + i, 19.4, TZ + 6.02]], 'line'));
  }
  cyl('x', [-9, 26, TZ - 4], 2.6, 18, 12, 'steel', 'both');   // conservator
  const BUSH = [-7, 0, 7];
  for (const x of BUSH) { cyl('y', [x, 22, TZ + 2], 1.3, 11, 10, 'glass', 'end'); for (let k = 0; k < 4; k++) line([x - 1.9, 24 + k * 2.4, TZ + 2], [x + 1.9, 24 + k * 2.4, TZ + 2], 0.8); }
  tank.front.det.push(rect([[-5, 8, TZ + 7.02], [5, 8, TZ + 7.02], [5, 15, TZ + 7.02], [-5, 15, TZ + 7.02]], 'line'));
  // MV switchgear lineup, fronts facing +z
  const SWF = -452, SWB = -464;
  box(-29, 0, SWB - 2, 29, 0.6, SWF + 4, 'dark');
  for (let i = 0; i < 6; i++) {
    const x0 = -27 + i * 9, x1 = x0 + 8.6, b = box(x0, 0.6, SWB, x1, 22, SWF, 'wall', 'roof'), f = b.front.det, z = SWF + 0.04, cx = (x0 + x1) / 2;
    f.push(rect([[x0 + 0.9, 2, z], [x1 - 0.9, 2, z], [x1 - 0.9, 13, z], [x0 + 0.9, 13, z]], 'line'));
    f.push(rect([[x0 + 0.9, 14.5, z], [x1 - 0.9, 14.5, z], [x1 - 0.9, 21, z], [x0 + 0.9, 21, z]], 'line'));
    f.push(rect([[cx, 20, z], [cx, 18.4, z], [cx + 1.4, 16.8, z]], 'acc'));
    f.push(rect([[cx, 16.4, z], [cx, 15.2, z]], 'acc'));
    f.push(rect([[x1 - 2.2, 7, z], [x1 - 2.2, 8.6, z]], 'line'));
  }

  // 04 city
  // factory with saw-tooth roof
  box(-58, 0, -605, -14, 12, -545, 'wall');
  for (let z = -545; z > -605; z -= 10) {
    const ctr = [-36, 14, z - 5];
    face([[-58, 12, z - 10], [-14, 12, z - 10], [-14, 20, z], [-58, 20, z]], 'roof', ctr);
    const g = face([[-58, 12, z], [-14, 12, z], [-14, 20, z], [-58, 20, z]], 'glass', ctr);
    for (let x = -56; x < -16; x += 4.4) { const d = rect([[x, 13, z + 0.04], [x + 3.4, 13, z + 0.04], [x + 3.4, 19, z + 0.04], [x, 19, z + 0.04]], 'win'); d.lit = true; g.det.push(d); }
    face([[-58, 12, z], [-58, 12, z - 10], [-58, 20, z]], 'wall', ctr);
    face([[-14, 12, z], [-14, 12, z - 10], [-14, 20, z]], 'wall', ctr);
  }
  { const f = FACES[FACES.length - 1]; }
  const fac = FACES.filter(f => f.c[0] === -14 && Math.abs(f.c[1] - 6) < 0.1);
  const BLOCKS = [
    [16, -540, 34, -558, 30], [40, -546, 62, -568, 18], [16, -572, 32, -596, 44],
    [40, -580, 60, -612, 24], [16, -612, 38, -642, 16], [-58, -616, -36, -646, 26], [-30, -622, -14, -650, 36], [44, -624, 64, -656, 34]
  ];
  for (const [x0, z0, x1, z1, h] of BLOCKS) {
    const b = box(x0, 0, z1, x1, h, z0, 'wall', 'roof');
    windows(b.front, 'z', z0 + 0.04, x0 + 1.6, x1 - 1, 3, h - 2, 3.4, 4, 1.8, 2.2);
    if (x0 > 0) windows(b.left, 'x', x0 - 0.04, z1 + 1.6, z0 - 1, 3, h - 2, 3.4, 4, 1.8, 2.2);
    else windows(b.right, 'x', x1 + 0.04, z1 + 1.6, z0 - 1, 3, h - 2, 3.4, 4, 1.8, 2.2);
    box((x0 + x1) / 2 - 2, h, (z0 + z1) / 2 - 2, (x0 + x1) / 2 + 2, h + 2.5, (z0 + z1) / 2 + 2, 'steel');
  }
  // streetlights
  for (let z = -516; z >= -662; z -= mobile ? 24 : 16) for (const sx of [-10, 10]) {
    const d = sx < 0 ? 1 : -1;
    line([sx, 0, z], [sx, 11, z], 1.1); line([sx, 11, z], [sx + d * 3.2, 11.6, z], 1.1);
    LAMPS.push([sx + d * 3.4, 11.2, z]);
  }

  // conductors
  function catenary(pts, a, sagK = 0.05) {
    const prev = pts[pts.length - 1], n = 16, sag = Math.abs(a[2] - prev[2]) * sagK;
    for (let i = 1; i <= n; i++) { const t = i / n; pts.push([lerp(prev[0], a[0], t), lerp(prev[1], a[1], t) - sag * 4 * t * (1 - t), lerp(prev[2], a[2], t)]); }
  }
  for (let p = 0; p < 3; p++) {
    const pts = [[(p - 1) * 3.5, 42, 0]];
    for (const z of TOWERS) catenary(pts, [ATT[p][0], ATT[p][1], z]);
    catenary(pts, [ATT[p][0], 46, GZ], 0.03);
    catenary(pts, [BUSH[p], 33, TZ + 2], 0.01);
    WIRES.push({ pts, w: 1, phase: p });
  }
  WIRES.push({ pts: [[0, 0.4, TZ + 10], [0, 0.4, SWF + 4]], w: 1.6, phase: 3 });
  WIRES.push({ pts: [[0, 0.4, SWB - 2], [0, 0.4, -512], [0, 0.4, -664]], w: 1.6, phase: 4 });
  WIRES.push({ pts: [[0, 0.4, -575], [-14, 0.4, -575]], w: 1.6, phase: 5 });
  WIRES.push({ pts: [[0, 0.4, -560], [16, 0.4, -560]], w: 1.6, phase: 5 });
  WIRES.push({ pts: [[0, 0.4, -628], [16, 0.4, -628]], w: 1.6, phase: 5 });

  const LABELS = [
    { p: [0, 48, 6], n: '01', t: 'Generator', k: 'gen' },
    { p: [0, 72, -252], n: '02', t: 'Transmission', k: 'tx' },
    { p: [-4, 40, -434], n: '03', t: 'Substation', k: 'dist' },
    { p: [24, 54, -584], n: '04', t: 'City', k: 'use' }
  ];

  // ------------------------------------------------------------ camera
  const KEYS = {
    hero:  { t: [0, 26, -300], d: 470, yaw: 0.72, pitch: 0.36, sx: 0.67, night: 0 },
    gen:   { t: [0, 20, -4],   d: 120, yaw: 0.82, pitch: 0.26, sx: 0.7,  night: 0 },
    tx:    { t: [0, 40, -212], d: 200, yaw: 1.22, pitch: 0.15, sx: 0.7,  night: 0 },
    dist:  { t: [0, 14, -440], d: 130, yaw: 0.62, pitch: 0.28, sx: 0.7,  night: 0.85 },
    use:   { t: [2, 12, -590], d: 190, yaw: 0.7,  pitch: 0.34, sx: 0.7,  night: 1 },
    over:  { t: [0, 20, -330], d: 600, yaw: -0.62, pitch: 0.46, sx: 0.66, night: 0 },
    plan:  { t: [0, 10, -330], d: 640, yaw: 0.35, pitch: 0.95, sx: 0.5,  night: 1 }
  };
  const cam = Object.assign({}, KEYS.hero, { t: KEYS.hero.t.slice() });
  let key = KEYS.hero;
  let orbitYaw = 0, orbitPitch = 0, parX = 0, parY = 0, tParX = 0, tParY = 0;
  let W = 0, H = 0, DPR = 1;
  function resize() {
    DPR = Math.min(devicePixelRatio || 1, mobile ? 1.5 : 2);
    W = innerWidth; H = innerHeight;
    canvas.width = W * DPR | 0; canvas.height = H * DPR | 0;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  resize(); addEventListener('resize', resize);

  let C0, C1, C2, f0, f1, f2, r0, r2, u0, u1, u2, FL, SX, SY;
  function setCamera() {
    const yaw = cam.yaw + orbitYaw + parX, pitch = clamp(cam.pitch + orbitPitch + parY, 0.04, 1.4), cp = Math.cos(pitch);
    C0 = cam.t[0] + Math.sin(yaw) * cp * cam.d; C1 = cam.t[1] + Math.sin(pitch) * cam.d; C2 = cam.t[2] + Math.cos(yaw) * cp * cam.d;
    f0 = cam.t[0] - C0; f1 = cam.t[1] - C1; f2 = cam.t[2] - C2;
    let n = Math.hypot(f0, f1, f2); f0 /= n; f1 /= n; f2 /= n;
    r0 = -f2; r2 = f0; n = Math.hypot(r0, r2) || 1; r0 /= n; r2 /= n;
    u0 = -r2 * f1; u1 = r2 * f0 - r0 * f2; u2 = r0 * f1;
    FL = Math.min(W, H * 1.6) * 1.0;
    SX = W * (mobile ? 0.5 : cam.sx); SY = H * (mobile ? 0.42 : 0.52);
  }
  function proj(p, out) {
    const dx = p[0] - C0, dy = p[1] - C1, dz = p[2] - C2, z = dx * f0 + dy * f1 + dz * f2;
    if (z < 3) return false;
    out[0] = SX + (dx * r0 + dz * r2) * FL / z; out[1] = SY - (dx * u0 + dy * u1 + dz * u2) * FL / z; out[2] = z;
    return true;
  }

  // ------------------------------------------------------------ render
  const L = (() => { const l = [-0.5, 0.78, 0.38], n = Math.hypot(...l); return l.map(v => v / n); })();
  const tmp = [0, 0, 0];
  function projPts(pts) {
    const out = []; let dsum = 0;
    for (const p of pts) { const q = [0, 0, 0]; if (!proj(p, q)) return null; out.push(q); dsum += q[2]; }
    out.d = dsum / pts.length; return out;
  }
  function pathOf(q, close) { ctx.beginPath(); ctx.moveTo(q[0][0], q[0][1]); for (let i = 1; i < q.length; i++) ctx.lineTo(q[i][0], q[i][1]); if (close) ctx.closePath(); }
  const fogOf = d => clamp((d - 260) / 1100, 0, 0.75);

  let rot = 0, flow = 0, surge = 0, last = performance.now(), time = 0;
  const WARM = [255, 205, 140];

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; time += dt;
    const k = reduce ? 1 : 1 - Math.pow(0.0012, dt);
    for (const p of ['d', 'yaw', 'pitch', 'sx']) cam[p] = lerp(cam[p], key[p], k);
    for (let i = 0; i < 3; i++) cam.t[i] = lerp(cam.t[i], key.t[i], k);
    night = lerp(night, key.night, reduce ? 1 : 1 - Math.pow(0.08, dt));
    parX = lerp(parX, tParX, 0.05); parY = lerp(parY, tParY, 0.05);
    if (!dragging) { orbitYaw *= 1 - dt * 0.4; orbitPitch *= 1 - dt * 0.7; }
    surge = Math.max(0, surge - dt * 0.6);
    if (!reduce) { rot += dt * (0.9 + surge * 5); flow += dt * (14 + surge * 60); }
    palette(); setCamera();

    ctx.fillStyle = rgb(C.bg); ctx.fillRect(0, 0, W, H);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';

    // ground
    for (const g of GROUND) {
      if (g.line) { const q = projPts(g.line); if (!q) continue; ctx.strokeStyle = rgb(C.ink, 0.35 * (1 - fogOf(q.d))); ctx.lineWidth = 1; pathOf(q); ctx.stroke(); continue; }
      const q = projPts(g.pts); if (!q) continue;
      ctx.fillStyle = rgb(C[g.mat]); pathOf(q, true); ctx.fill();
      ctx.strokeStyle = rgb(C.ink, 0.28); ctx.lineWidth = 0.8; ctx.stroke();
    }

    // sortable items
    const items = [];
    for (const f of FACES) {
      if (!f.ds) { const vx = f.c[0] - C0, vy = f.c[1] - C1, vz = f.c[2] - C2; if (f.n[0] * vx + f.n[1] * vy + f.n[2] * vz >= 0) continue; }
      const q = projPts(f.pts); if (!q) continue;
      items.push({ f, q, d: q.d });
    }
    for (const l of LINES) {
      const q = projPts([l.a, l.b]); if (!q) continue;
      items.push({ l, q, d: q.d });
    }
    items.sort((a, b) => b.d - a.d);

    const inkA = 0.9 - night * 0.25;
    for (const it of items) {
      const fog = fogOf(it.d);
      if (it.l) {
        ctx.strokeStyle = it.l.kind === 'ins' ? rgb(C.ink, inkA * (1 - fog) * 0.9) : rgb(C.ink, inkA * (1 - fog));
        ctx.lineWidth = it.l.w * clamp(220 / it.d, 0.55, 1.6); pathOf(it.q); ctx.stroke(); continue;
      }
      const f = it.f, base = C[f.mat];
      const s = f.n[0] * L[0] + f.n[1] * L[1] + f.n[2] * L[2];
      const tone = s > 0.55 ? 1 : s > 0.05 ? 0.9 : 0.8;
      const c = [lerp(base[0] * tone, C.bg[0], fog), lerp(base[1] * tone, C.bg[1], fog), lerp(base[2] * tone, C.bg[2], fog)];
      ctx.fillStyle = rgb(c); pathOf(it.q, true); ctx.fill();
      ctx.strokeStyle = rgb(C.ink, inkA * (1 - fog)); ctx.lineWidth = clamp(200 / it.d, 0.5, 1.25); ctx.stroke();
      for (const d of f.det) {
        if (d.kind === 'none') continue;
        const q = projPts(d.pts); if (!q) continue;
        if (d.kind === 'win') {
          const lit = d.lit ? night : 0;
          const wc = [lerp(lerp(C.glass[0] * 0.92, WARM[0], lit), C.bg[0], fog), lerp(lerp(C.glass[1] * 0.92, WARM[1], lit), C.bg[1], fog), lerp(lerp(C.glass[2] * 0.92, WARM[2], lit), C.bg[2], fog)];
          ctx.fillStyle = rgb(wc, 1); pathOf(q, true); ctx.fill();
          if (night < 0.5) { ctx.strokeStyle = rgb(C.ink, 0.35 * (1 - fog)); ctx.lineWidth = 0.6; ctx.stroke(); }
        } else if (d.kind === 'acc') {
          ctx.strokeStyle = rgb(C.green, 1 - fog); ctx.lineWidth = 1.4; pathOf(q); ctx.stroke();
        } else {
          ctx.strokeStyle = rgb(C.ink, 0.7 * (1 - fog)); ctx.lineWidth = 0.8; pathOf(q, q.length > 2); ctx.stroke();
        }
      }
    }

    // rotor on the coupling disc
    const rc = [0, 0, 0];
    if (proj(ROTOR.c, rc)) {
      ctx.strokeStyle = rgb(C.green, 0.95); ctx.lineWidth = clamp(260 / rc[2], 1, 2.2);
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = rot + i * Math.PI / 3, p = [ROTOR.c[0] + Math.cos(a) * ROTOR.r * 0.85, ROTOR.c[1] + Math.sin(a) * ROTOR.r * 0.85, ROTOR.c[2]];
        if (proj(p, tmp)) { ctx.moveTo(rc[0], rc[1]); ctx.lineTo(tmp[0], tmp[1]); }
      }
      ctx.stroke();
    }

    // conductors + current
    for (const w of WIRES) {
      const q = projPts(w.pts); if (!q) continue;
      const fog = fogOf(q.d);
      ctx.setLineDash([]); ctx.strokeStyle = rgb(C.ink, (0.75 - night * 0.2) * (1 - fog)); ctx.lineWidth = w.w * 0.9; pathOf(q); ctx.stroke();
      ctx.setLineDash([5, 16]); ctx.lineDashOffset = -flow - w.phase * 7;
      ctx.strokeStyle = rgb(C.green, (0.85 + surge * 0.15) * (1 - fog)); ctx.lineWidth = w.w * 1.8 + surge * 1.5; ctx.stroke();
    }
    ctx.setLineDash([]);

    // city lights at night: pools on the street, light lost upward, skyglow
    const eta = API.eta;
    if (night > 0.02) {
      ctx.globalCompositeOperation = 'lighter';
      const sg = [0, 0, 0];
      if (proj([0, 70, -590], sg)) {
        const R = FL / sg[2] * 190, g = ctx.createRadialGradient(sg[0], sg[1], 0, sg[0], sg[1], R);
        g.addColorStop(0, `rgba(255,160,80,${0.32 * (1 - eta) * night})`); g.addColorStop(1, 'rgba(255,160,80,0)');
        ctx.fillStyle = g; ctx.fillRect(sg[0] - R, sg[1] - R, R * 2, R * 2);
      }
      const lp = [0, 0, 0], gp = [0, 0, 0], up = [0, 0, 0];
      for (const l of LAMPS) {
        if (!proj(l, lp)) continue;
        if (proj([l[0], 0.1, l[2]], gp)) {
          const r = FL / gp[2] * (4 + eta * 6), g = ctx.createRadialGradient(gp[0], gp[1], 0, gp[0], gp[1], r);
          g.addColorStop(0, `rgba(255,214,150,${(0.15 + eta * 0.5) * night})`); g.addColorStop(1, 'rgba(255,214,150,0)');
          ctx.fillStyle = g; ctx.save(); ctx.translate(gp[0], gp[1]); ctx.scale(1, 0.42); ctx.translate(-gp[0], -gp[1]);
          ctx.fillRect(gp[0] - r, gp[1] - r, r * 2, r * 2); ctx.restore();
          const hw = FL / gp[2] * (2 + eta * 4);
          ctx.fillStyle = `rgba(255,214,150,${0.07 * eta * night})`;
          ctx.beginPath(); ctx.moveTo(lp[0], lp[1]); ctx.lineTo(gp[0] - hw, gp[1]); ctx.lineTo(gp[0] + hw, gp[1]); ctx.closePath(); ctx.fill();
        }
        if (proj([l[0], l[1] + 30, l[2]], up)) {
          const hw = FL / up[2] * 9;
          const g = ctx.createLinearGradient(lp[0], lp[1], up[0], up[1]);
          g.addColorStop(0, `rgba(255,150,70,${0.22 * (1 - eta) * night})`); g.addColorStop(1, 'rgba(255,150,70,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(lp[0], lp[1]); ctx.lineTo(up[0] - hw, up[1]); ctx.lineTo(up[0] + hw, up[1]); ctx.closePath(); ctx.fill();
        }
        const s = clamp(FL / lp[2] * 0.9, 1, 4);
        ctx.fillStyle = `rgba(255,236,200,${0.9 * night})`; ctx.beginPath(); ctx.arc(lp[0], lp[1], s, 0, 6.3); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    if (night < 0.98) {
      const lp = [0, 0, 0];
      ctx.fillStyle = rgb(C.ink, (1 - night) * 0.8);
      for (const l of LAMPS) if (proj(l, lp)) { ctx.beginPath(); ctx.arc(lp[0], lp[1], clamp(FL / lp[2] * 0.7, 0.8, 3), 0, 6.3); ctx.fill(); }
    }

    // labels
    const overview = API.stage === 'hero' || API.stage === 'over' || API.stage === 'plan';
    const lb = [0, 0, 0];
    for (const t of LABELS) {
      const on = API.stage === t.k;
      if ((!on && !overview) || !proj(t.p, lb)) continue;
      const x = lb[0], y = lb[1];
      ctx.strokeStyle = rgb(C.ink, 0.7); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 16, y - 16); ctx.lineTo(x + 30, y - 16); ctx.stroke();
      ctx.fillStyle = on ? rgb(C.green) : rgb(C.ink); ctx.beginPath(); ctx.arc(x, y, 2.6, 0, 6.3); ctx.fill();
      ctx.textBaseline = 'middle';
      ctx.font = 'italic 17px "Instrument Serif", Georgia, serif';
      ctx.fillStyle = on ? rgb(C.green) : rgb(C.ink, 0.75); ctx.fillText(t.n, x + 36, y - 16);
      ctx.font = '500 13px "Inter", system-ui, sans-serif';
      ctx.fillStyle = rgb(C.ink, on ? 1 : 0.85); ctx.fillText(t.t, x + 58, y - 16);
    }
    requestAnimationFrame(frame);
  }

  // ------------------------------------------------------------ input
  let dragging = false, lx = 0, ly = 0, moved = 0;
  canvas.addEventListener('pointerdown', e => { dragging = true; moved = 0; lx = e.clientX; ly = e.clientY; canvas.classList.add('dragging'); canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => {
    if (!dragging) return;
    const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
    orbitYaw -= dx * 0.005; orbitPitch = clamp(orbitPitch + dy * 0.004, -0.3, 0.8);
  });
  const up = () => { if (!dragging) return; dragging = false; canvas.classList.remove('dragging'); if (moved < 6) surge = 1; };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  addEventListener('pointermove', e => { if (e.pointerType !== 'mouse' || reduce) return; tParX = (e.clientX / W - 0.5) * -0.08; tParY = (e.clientY / H - 0.5) * 0.04; }, { passive: true });

  API.surge = () => { surge = 1; };
  API.setStage = name => { if (KEYS[name]) { key = KEYS[name]; API.stage = name; } };
  API.isNight = name => (KEYS[name] || {}).night > 0.5;
  requestAnimationFrame(frame);
})();
