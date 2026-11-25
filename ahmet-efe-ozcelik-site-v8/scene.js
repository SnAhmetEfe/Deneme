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

  // ------------------------------------------------------------ materials and light
  const MAT = {
    plot:  [104, 108, 84],  road: [78, 76, 72],   wall: [214, 200, 176], steel: [150, 160, 164],
    dark:  [82, 84, 82],    roof: [156, 96, 68],  glass: [92, 124, 130], green: [95, 217, 122], tree: [48, 66, 46]
  };
  const LIGHT = [
    { key: [1.25, 0.82, 0.52], amb: [0.30, 0.36, 0.42], fog: [214, 132, 86],  ink: [40, 24, 20],  ground: [54, 50, 38] },
    { key: [0.55, 0.50, 0.62], amb: [0.20, 0.27, 0.36], fog: [70, 82, 104],   ink: [14, 18, 26],  ground: [26, 32, 38] },
    { key: [0.28, 0.34, 0.48], amb: [0.13, 0.18, 0.24], fog: [40, 40, 50],    ink: [6, 9, 12],    ground: [14, 18, 20] }
  ];
  let tod = 0; const LT = {};
  function light() {
    const t = tod * 2, i = Math.min(1, t | 0), f = t - i, a = LIGHT[i], b = LIGHT[i + 1];
    for (const k in a) LT[k] = a[k].map((v, j) => lerp(v, b[k][j], f));
  }
  const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  const mix = (c, d, t) => [lerp(c[0], d[0], t), lerp(c[1], d[1], t), lerp(c[2], d[2], t)];
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
    hero:  { t: [0, 30, -300], d: 470, yaw: 0.72, pitch: 0.09, sx: 0.67, tod: 0 },
    gen:   { t: [0, 22, -4],   d: 120, yaw: 0.82, pitch: 0.12, sx: 0.7,  tod: 0.12 },
    tx:    { t: [0, 44, -212], d: 200, yaw: 1.22, pitch: 0.05, sx: 0.7,  tod: 0.35 },
    dist:  { t: [0, 16, -440], d: 130, yaw: 0.62, pitch: 0.17, sx: 0.7,  tod: 0.6 },
    use:   { t: [2, 14, -590], d: 190, yaw: 0.7,  pitch: 0.24, sx: 0.7,  tod: 1 },
    over:  { t: [0, 20, -330], d: 600, yaw: -0.62, pitch: 0.3, sx: 0.66, tod: 0.5 },
    plan:  { t: [0, 10, -330], d: 640, yaw: 0.35, pitch: 0.75, sx: 0.5,  tod: 1 }
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
    SX = W * (mobile ? 0.5 : cam.sx); SY = H * (mobile ? 0.46 : 0.6);
  }
  function proj(p, out) {
    const dx = p[0] - C0, dy = p[1] - C1, dz = p[2] - C2, z = dx * f0 + dy * f1 + dz * f2;
    if (z < 3) return false;
    out[0] = SX + (dx * r0 + dz * r2) * FL / z; out[1] = SY - (dx * u0 + dy * u1 + dz * u2) * FL / z; out[2] = z;
    return true;
  }

  // trees around the system
  const TREES = [];
  { let sd = 11; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    const n = mobile ? 110 : 260;
    while (TREES.length < n) {
      const x = (r() - 0.5) * 560, z = 80 - r() * 800;
      if (Math.abs(x) < 40 && z > -500) continue;
      if (Math.abs(x) < 95 && z < -490 && z > -690) continue;
      if (Math.abs(x) < 55 && z < -380 && z > -490) continue;
      TREES.push([x, z, 6 + r() * 9, 0.8 + r() * 0.4]);
    } }
  // ------------------------------------------------------------ render
  const L = (() => { const l = [-0.62, 0.42, 0.32], n = Math.hypot(...l); return l.map(v => v / n); })();
  const tmp = [0, 0, 0];

  // painted skies
  const SKY = ['dusk', 'blue', 'night'].map(n => { const i = new Image(); i.decoding = 'async'; i.src = `assets/sky/${n}.jpg`; return i; });
  const SKY_HORIZON = 0.86;

  // brush texture laid over the whole frame, so the geometry reads as painted
  const brush = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d'); x.fillStyle = '#808080'; x.fillRect(0, 0, 256, 256);
    let s = 3; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 900; i++) {
      const v = 90 + r() * 80 | 0, a = r() * 6.28, l = 6 + r() * 22, px = r() * 256, py = r() * 256;
      x.strokeStyle = `rgba(${v},${v},${v},${0.25 + r() * 0.35})`; x.lineWidth = 1 + r() * 3; x.lineCap = 'round';
      x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l * 0.35); x.stroke();
    }
    return ctx.createPattern(c, 'repeat');
  })();

  function projPts(pts) {
    const out = []; let dsum = 0;
    for (const p of pts) { const q = [0, 0, 0]; if (!proj(p, q)) return null; out.push(q); dsum += q[2]; }
    out.d = dsum / pts.length; return out;
  }
  function pathOf(q, close) { ctx.beginPath(); ctx.moveTo(q[0][0], q[0][1]); for (let i = 1; i < q.length; i++) ctx.lineTo(q[i][0], q[i][1]); if (close) ctx.closePath(); }
  const fogOf = d => clamp((d - 220) / 900, 0, 0.85);

  function shade(mat, n, y) {
    const a = MAT[mat], k = Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]);
    const sky = Math.max(0, n[1]) * 0.25;                                   // light from the sky above
    const ao = clamp(0.62 + y / 40, 0.62, 1);                               // darker near the ground
    return [0, 1, 2].map(j => clamp(a[j] * (LT.amb[j] + sky * LT.amb[j] + LT.key[j] * k) * ao, 0, 255));
  }

  let rot = 0, flow = 0, surge = 0, last = performance.now(), time = 0;
  const WARM = [255, 196, 120];

  function drawSky(hy) {
    const t = tod * 2, i = Math.min(1, t | 0), f = t - i;
    const yawNow = cam.yaw + orbitYaw + parX;
    for (const [img, a] of [[SKY[i], 1], [SKY[i + 1], f]]) {
      if (a < 0.01 || !img.complete || !img.naturalWidth) continue;
      const s = Math.max(W * 1.5 / img.naturalWidth, (hy + 40) / (img.naturalHeight * SKY_HORIZON));
      const iw = img.naturalWidth * s, ih = img.naturalHeight * s;
      let x0 = -(iw - W) / 2 + ((yawNow * 0.35) % 1) * (iw - W) * 0.5;
      x0 = clamp(x0, W - iw, 0);
      ctx.globalAlpha = a; ctx.drawImage(img, x0, hy - ih * SKY_HORIZON, iw, ih);
    }
    ctx.globalAlpha = 1;
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; time += dt;
    const k = reduce ? 1 : 1 - Math.pow(0.0012, dt);
    for (const p of ['d', 'yaw', 'pitch', 'sx']) cam[p] = lerp(cam[p], key[p], k);
    for (let i = 0; i < 3; i++) cam.t[i] = lerp(cam.t[i], key.t[i], k);
    tod = lerp(tod, key.tod, reduce ? 1 : 1 - Math.pow(0.12, dt));
    parX = lerp(parX, tParX, 0.05); parY = lerp(parY, tParY, 0.05);
    if (!dragging) { orbitYaw *= 1 - dt * 0.4; orbitPitch *= 1 - dt * 0.7; }
    surge = Math.max(0, surge - dt * 0.6);
    if (!reduce) { rot += dt * (0.9 + surge * 5); flow += dt * (14 + surge * 60); }
    light(); setCamera();
    const night = clamp((tod - 0.35) / 0.55, 0, 1);

    // horizon on screen
    const fx = f0, fz = f2, fl = Math.hypot(fx, fz) || 1;
    let hy = -1e4; if (proj([C0 + fx / fl * 1e5, C1, C2 + fz / fl * 1e5], tmp)) hy = tmp[1];

    ctx.fillStyle = rgb(LT.fog); ctx.fillRect(0, 0, W, H);
    drawSky(hy);
    // ground: fades into the haze at the horizon
    const gy = clamp(hy, -10, H);
    const gg = ctx.createLinearGradient(0, gy, 0, H);
    gg.addColorStop(0, rgb(mix(LT.ground, LT.fog, 0.75)));
    gg.addColorStop(0.12, rgb(mix(LT.ground, LT.fog, 0.35)));
    gg.addColorStop(1, rgb(LT.ground));
    ctx.fillStyle = gg; ctx.fillRect(0, gy, W, H - gy);

    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (const g of GROUND) {
      if (g.line) { const q = projPts(g.line); if (!q) continue; ctx.strokeStyle = rgb(mix([220, 200, 150], LT.fog, fogOf(q.d)), 0.5 * (1 - night * 0.5)); ctx.lineWidth = 1; pathOf(q); ctx.stroke(); continue; }
      const q = projPts(g.pts); if (!q) continue;
      ctx.fillStyle = rgb(mix(shade(g.mat, [0, 1, 0], 40), LT.fog, fogOf(q.d)));
      pathOf(q, true); ctx.fill();
    }

    const items = [];
    for (const f of FACES) {
      if (!f.ds) { const vx = f.c[0] - C0, vy = f.c[1] - C1, vz = f.c[2] - C2; if (f.n[0] * vx + f.n[1] * vy + f.n[2] * vz >= 0) continue; }
      const q = projPts(f.pts); if (!q) continue;
      items.push({ f, q, d: q.d });
    }
    for (const l of LINES) { const q = projPts([l.a, l.b]); if (!q) continue; items.push({ l, q, d: q.d }); }
    for (const t of TREES) { const b = [0, 0, 0], top = [0, 0, 0]; if (!proj([t[0], 0, t[1]], b) || !proj([t[0], t[2], t[1]], top)) continue; items.push({ t, b, top, d: b[2] }); }
    items.sort((a, b) => b.d - a.d);

    const rim = mix([255, 214, 160], [150, 190, 230], night);
    for (const it of items) {
      const fog = fogOf(it.d);
      if (it.t) {
        const hw = (it.b[1] - it.top[1]) * 0.32, lc = mix(shade('tree', [-0.7, 0.4, 0.3], 14), LT.fog, fog), dc = mix(shade('tree', [0.6, 0.3, 0.4], 6), LT.fog, fog);
        ctx.fillStyle = rgb(lc); ctx.beginPath(); ctx.moveTo(it.top[0], it.top[1]); ctx.lineTo(it.b[0] - hw, it.b[1]); ctx.lineTo(it.b[0], it.b[1] + hw * 0.12); ctx.closePath(); ctx.fill();
        ctx.fillStyle = rgb(dc); ctx.beginPath(); ctx.moveTo(it.top[0], it.top[1]); ctx.lineTo(it.b[0] + hw, it.b[1]); ctx.lineTo(it.b[0], it.b[1] + hw * 0.12); ctx.closePath(); ctx.fill();
        continue;
      }
      if (it.l) {
        const w = it.l.w * clamp(240 / it.d, 0.6, 2.2);
        ctx.strokeStyle = rgb(mix(LT.ink, LT.fog, fog * 0.8), 0.95); ctx.lineWidth = w; pathOf(it.q); ctx.stroke();
        if (it.l.kind === 'ins') { ctx.strokeStyle = rgb(mix([150, 200, 190], LT.fog, fog), 0.8); ctx.lineWidth = w * 0.6; ctx.stroke(); }
        continue;
      }
      const f = it.f, q = it.q;
      let yTop = Infinity, yBot = -Infinity, wy0 = Infinity, wy1 = -Infinity;
      for (let i = 0; i < q.length; i++) { yTop = Math.min(yTop, q[i][1]); yBot = Math.max(yBot, q[i][1]); wy0 = Math.min(wy0, f.pts[i][1]); wy1 = Math.max(wy1, f.pts[i][1]); }
      const cTop = mix(shade(f.mat, f.n, wy1), LT.fog, fog), cBot = mix(shade(f.mat, f.n, wy0), LT.fog, fog);
      if (yBot - yTop > 2 && Math.abs(f.n[1]) < 0.9) {
        const g = ctx.createLinearGradient(0, yTop, 0, yBot);
        g.addColorStop(0, rgb(cTop)); g.addColorStop(1, rgb(cBot)); ctx.fillStyle = g;
      } else ctx.fillStyle = rgb(cTop);
      pathOf(q, true); ctx.fill();
      const lit = Math.max(0, f.n[0] * L[0] + f.n[1] * L[1] + f.n[2] * L[2]);
      ctx.strokeStyle = lit > 0.55 ? rgb(mix(rim, LT.fog, fog), 0.55) : rgb(mix(LT.ink, LT.fog, fog * 0.7), 0.7);
      ctx.lineWidth = clamp(220 / it.d, 0.5, 1.4); ctx.stroke();

      for (const d of f.det) {
        if (d.kind === 'none') continue;
        const dq = projPts(d.pts); if (!dq) continue;
        if (d.kind === 'win') {
          const on = d.lit ? night : 0;
          ctx.fillStyle = rgb(mix(mix([46, 62, 70], WARM, on), LT.fog, fog * (1 - on * 0.6))); pathOf(dq, true); ctx.fill();
        } else if (d.kind === 'acc') {
          ctx.strokeStyle = rgb(MAT.green, 1 - fog * 0.8); ctx.lineWidth = 1.6; ctx.shadowColor = 'rgba(95,217,122,.9)'; ctx.shadowBlur = 6 * (0.4 + night);
          pathOf(dq); ctx.stroke(); ctx.shadowBlur = 0;
        } else {
          ctx.strokeStyle = rgb(mix(LT.ink, LT.fog, fog), 0.55); ctx.lineWidth = 0.8; pathOf(dq, dq.length > 2); ctx.stroke();
        }
      }
    }

    // rotor
    const rc = [0, 0, 0];
    if (proj(ROTOR.c, rc)) {
      ctx.strokeStyle = rgb(MAT.green, 0.95); ctx.lineWidth = clamp(260 / rc[2], 1, 2.4);
      ctx.shadowColor = 'rgba(95,217,122,.9)'; ctx.shadowBlur = 8 + surge * 14;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = rot + i * Math.PI / 3, p = [ROTOR.c[0] + Math.cos(a) * ROTOR.r * 0.85, ROTOR.c[1] + Math.sin(a) * ROTOR.r * 0.85, ROTOR.c[2]];
        if (proj(p, tmp)) { ctx.moveTo(rc[0], rc[1]); ctx.lineTo(tmp[0], tmp[1]); }
      }
      ctx.stroke(); ctx.shadowBlur = 0;
    }

    // conductors with current
    for (const w of WIRES) {
      const q = projPts(w.pts); if (!q) continue;
      const fog = fogOf(q.d);
      ctx.setLineDash([]); ctx.strokeStyle = rgb(mix(LT.ink, LT.fog, fog * 0.6), 0.85); ctx.lineWidth = w.w; pathOf(q); ctx.stroke();
      ctx.setLineDash([4, 18]); ctx.lineDashOffset = -flow - w.phase * 7;
      ctx.shadowColor = 'rgba(95,217,122,1)'; ctx.shadowBlur = 8 + surge * 10;
      ctx.strokeStyle = rgb([150, 240, 165], (0.8 + surge * 0.2) * (1 - fog * 0.7)); ctx.lineWidth = w.w * 1.6 + surge * 1.5; ctx.stroke();
      ctx.shadowBlur = 0;
    }
    ctx.setLineDash([]);

    // city light: on the street, and lost to the sky
    const eta = API.eta;
    if (night > 0.02) {
      ctx.globalCompositeOperation = 'lighter';
      const sg = [0, 0, 0];
      if (proj([0, 80, -590], sg)) {
        const R = FL / sg[2] * 240, g = ctx.createRadialGradient(sg[0], sg[1], 0, sg[0], sg[1], R);
        g.addColorStop(0, `rgba(255,140,60,${0.4 * (1 - eta) * night})`); g.addColorStop(1, 'rgba(255,140,60,0)');
        ctx.fillStyle = g; ctx.fillRect(sg[0] - R, sg[1] - R, R * 2, R * 2);
      }
      const lp = [0, 0, 0], gp = [0, 0, 0], up = [0, 0, 0];
      for (const l of LAMPS) {
        if (!proj(l, lp)) continue;
        if (proj([l[0], 0.1, l[2]], gp)) {
          const r = FL / gp[2] * (4 + eta * 7), g = ctx.createRadialGradient(gp[0], gp[1], 0, gp[0], gp[1], r);
          g.addColorStop(0, `rgba(255,206,140,${(0.2 + eta * 0.55) * night})`); g.addColorStop(1, 'rgba(255,206,140,0)');
          ctx.fillStyle = g; ctx.save(); ctx.translate(gp[0], gp[1]); ctx.scale(1, 0.42); ctx.translate(-gp[0], -gp[1]);
          ctx.fillRect(gp[0] - r, gp[1] - r, r * 2, r * 2); ctx.restore();
          const hw = FL / gp[2] * (2 + eta * 4);
          ctx.fillStyle = `rgba(255,206,140,${0.08 * eta * night})`;
          ctx.beginPath(); ctx.moveTo(lp[0], lp[1]); ctx.lineTo(gp[0] - hw, gp[1]); ctx.lineTo(gp[0] + hw, gp[1]); ctx.closePath(); ctx.fill();
        }
        if (proj([l[0], l[1] + 34, l[2]], up)) {
          const hw = FL / up[2] * 10, g = ctx.createLinearGradient(lp[0], lp[1], up[0], up[1]);
          g.addColorStop(0, `rgba(255,140,60,${0.26 * (1 - eta) * night})`); g.addColorStop(1, 'rgba(255,140,60,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(lp[0], lp[1]); ctx.lineTo(up[0] - hw, up[1]); ctx.lineTo(up[0] + hw, up[1]); ctx.closePath(); ctx.fill();
        }
        const s = clamp(FL / lp[2] * 1.1, 1.2, 5), g2 = ctx.createRadialGradient(lp[0], lp[1], 0, lp[0], lp[1], s * 4);
        g2.addColorStop(0, `rgba(255,236,200,${night})`); g2.addColorStop(0.25, `rgba(255,200,130,${0.5 * night})`); g2.addColorStop(1, 'rgba(255,200,130,0)');
        ctx.fillStyle = g2; ctx.fillRect(lp[0] - s * 4, lp[1] - s * 4, s * 8, s * 8);
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    // atmosphere: warm haze at the horizon, brush texture, vignette
    if (hy > -200 && hy < H + 200) {
      const hz = ctx.createLinearGradient(0, hy - H * 0.18, 0, hy + H * 0.12);
      hz.addColorStop(0, rgb(LT.fog, 0)); hz.addColorStop(0.6, rgb(LT.fog, 0.28 * (1 - night * 0.5))); hz.addColorStop(1, rgb(LT.fog, 0));
      ctx.fillStyle = hz; ctx.fillRect(0, hy - H * 0.18, W, H * 0.3);
    }
    ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.35; ctx.fillStyle = brush; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    const vg = ctx.createRadialGradient(W * 0.6, H * 0.5, Math.min(W, H) * 0.35, W * 0.6, H * 0.5, Math.max(W, H) * 0.8);
    vg.addColorStop(0, 'rgba(8,10,12,0)'); vg.addColorStop(1, 'rgba(8,10,12,0.55)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

    // labels
    const overview = API.stage === 'hero' || API.stage === 'over' || API.stage === 'plan';
    const lb = [0, 0, 0];
    for (const t of LABELS) {
      const on = API.stage === t.k;
      if ((!on && !overview) || !proj(t.p, lb)) continue;
      const x = lb[0], y = lb[1];
      ctx.shadowColor = 'rgba(0,0,0,.8)'; ctx.shadowBlur = 6;
      ctx.strokeStyle = 'rgba(241,235,221,.75)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 16, y - 16); ctx.lineTo(x + 30, y - 16); ctx.stroke();
      ctx.fillStyle = on ? '#5FD97A' : '#F1EBDD'; ctx.beginPath(); ctx.arc(x, y, 2.8, 0, 6.3); ctx.fill();
      ctx.textBaseline = 'middle';
      ctx.font = 'italic 18px "Instrument Serif", Georgia, serif'; ctx.fillStyle = on ? '#5FD97A' : 'rgba(241,235,221,.8)'; ctx.fillText(t.n, x + 36, y - 16);
      ctx.font = '500 13px "Inter", system-ui, sans-serif'; ctx.fillStyle = '#F1EBDD'; ctx.fillText(t.t, x + 58, y - 16);
      ctx.shadowBlur = 0;
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
  API.isNight = name => (KEYS[name] || {}).tod > 0.5;
  requestAnimationFrame(frame);
})();
