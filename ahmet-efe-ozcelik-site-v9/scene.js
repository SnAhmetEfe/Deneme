/* Ahmet Efe Özçelik · a small power system, rendered as an illustration.
   WebGL2: cel shading, cast shadows, ink outlines from normal + depth edges,
   hatching in shadow, painted skies with stylised clouds, glow, paper grain.
   Generator > transmission > substation > city. No libraries. */
(() => {
  'use strict';
  const canvas = document.getElementById('scene');
  const API = window.SCENE = { eta: 0.6, stage: 'hero', setStage() {}, surge() {}, isNight() { return false; } };
  const gl = canvas && canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  if (!gl) { document.body.classList.add('nogl'); return; }
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = innerWidth < 760;
  const floatOK = !!gl.getExtension('EXT_color_buffer_float');

  // ================================================================== math
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = a => { const l = Math.hypot(a[0], a[1], a[2]); return l > 1e-9 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 1, 0]; };
  const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

  const M4 = {
    persp(fovy, asp, n, f, cx, cy) {
      const t = 1 / Math.tan(fovy / 2), r = new Float32Array(16);
      r[0] = t / asp; r[5] = t; r[10] = (f + n) / (n - f); r[11] = -1; r[14] = 2 * f * n / (n - f);
      r[8] = -cx; r[9] = -cy; return r;
    },
    ortho(l, r_, b, t, n, f) {
      const r = new Float32Array(16);
      r[0] = 2 / (r_ - l); r[5] = 2 / (t - b); r[10] = -2 / (f - n);
      r[12] = -(r_ + l) / (r_ - l); r[13] = -(t + b) / (t - b); r[14] = -(f + n) / (f - n); r[15] = 1; return r;
    },
    look(e, c, up) {
      const z = norm(sub(e, c)), x = norm(cross(up, z)), y = cross(z, x), r = new Float32Array(16);
      r[0] = x[0]; r[4] = x[1]; r[8] = x[2]; r[1] = y[0]; r[5] = y[1]; r[9] = y[2]; r[2] = z[0]; r[6] = z[1]; r[10] = z[2];
      r[12] = -dot(x, e); r[13] = -dot(y, e); r[14] = -dot(z, e); r[15] = 1; return r;
    },
    mul(a, b) {
      const r = new Float32Array(16);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; r[i * 4 + j] = s; }
      return r;
    },
    id() { const r = new Float32Array(16); r[0] = r[5] = r[10] = r[15] = 1; return r; },
    rotZAbout(a, cx, cy) {
      const c = Math.cos(a), s = Math.sin(a), r = M4.id();
      r[0] = c; r[1] = s; r[4] = -s; r[5] = c; r[12] = cx - c * cx + s * cy; r[13] = cy - s * cx - c * cy; return r;
    },
    xform(m, p) {
      const x = p[0], y = p[1], z = p[2];
      return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14], m[3] * x + m[7] * y + m[11] * z + m[15]];
    }
  };

  // deterministic randomness + value noise
  let seed = 20261106;
  const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const hash2 = (x, y) => { let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263); h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0) / 4294967296; };
  const vnoise = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return lerp(lerp(hash2(xi, yi), hash2(xi + 1, yi), u), lerp(hash2(xi, yi + 1), hash2(xi + 1, yi + 1), u), v);
  };
  const fbm = (x, y) => { let s = 0, a = 0.5; for (let i = 0; i < 5; i++) { s += a * vnoise(x, y); x *= 2.03; y *= 2.03; a *= 0.5; } return s; };

  // ================================================================== palette
  const COL = {
    grass: [0.58, 0.66, 0.40], grass2: [0.46, 0.57, 0.35], field: [0.80, 0.70, 0.44], field2: [0.66, 0.60, 0.36],
    tree1: [0.25, 0.44, 0.31], tree2: [0.34, 0.53, 0.31], tree3: [0.78, 0.52, 0.27], trunk: [0.42, 0.30, 0.22],
    concrete: [0.76, 0.72, 0.65], pad: [0.62, 0.60, 0.56], gravel: [0.66, 0.63, 0.58],
    gen: [0.30, 0.54, 0.52], genTrim: [0.90, 0.82, 0.62], dark: [0.22, 0.27, 0.29], steel: [0.56, 0.63, 0.65], tower: [0.40, 0.45, 0.49],
    glassIns: [0.46, 0.70, 0.64], porcelain: [0.70, 0.36, 0.24],
    wall: [0.93, 0.86, 0.74], wall2: [0.85, 0.74, 0.60], wall3: [0.74, 0.80, 0.80], brick: [0.70, 0.40, 0.30],
    roof: [0.74, 0.38, 0.27], roofDark: [0.36, 0.36, 0.42], glass: [0.34, 0.47, 0.53],
    sg: [0.91, 0.90, 0.86], sgDark: [0.21, 0.25, 0.27], epoxy: [0.56, 0.23, 0.15], trafo: [0.52, 0.60, 0.54],
    road: [0.33, 0.32, 0.32], paving: [0.72, 0.67, 0.58], paint: [0.94, 0.90, 0.76],
    mountain: [0.46, 0.50, 0.64], blade: [0.95, 0.95, 0.93], pv: [0.15, 0.23, 0.40], pvLine: [0.52, 0.62, 0.74], pvFrame: [0.70, 0.72, 0.74], snow: [0.92, 0.92, 0.96], water: [0.30, 0.52, 0.62]
  };
  const jit = (c, a = 0.05) => { const k = 1 + (rnd() - 0.5) * a * 2; return [c[0] * k, c[1] * k, c[2] * k]; };

  // ================================================================== mesh building
  // vertex: pos3 nor3 col3 ext2 (emissive kind, flow coordinate)
  class Mesh {
    constructor() { this.a = []; }
    v(p, n, c, e, f) { this.a.push(p[0], p[1], p[2], n[0], n[1], n[2], c[0], c[1], c[2], e, f); }
    tri(p0, p1, p2, c, e = 0, f = -1) { const n = norm(cross(sub(p1, p0), sub(p2, p0))); this.v(p0, n, c, e, f); this.v(p1, n, c, e, f); this.v(p2, n, c, e, f); }
    quad(p0, p1, p2, p3, c, e = 0, f = -1) { this.tri(p0, p1, p2, c, e, f); this.tri(p0, p2, p3, c, e, f); }
  }
  const S = new Mesh(), ROT = new Mesh(), CONES = new Mesh(), WIND = new Mesh();

  function box(m, x0, y0, z0, x1, y1, z1, c, e = 0) {
    m.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], c, e);
    m.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], c, e);
    m.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], c, e);
    m.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], c, e);
    m.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], c, e);
    m.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], c, e);
  }
  function frame(axis) { const a = norm(axis), up = Math.abs(a[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0], u = norm(cross(a, up)), v = cross(a, u); return [a, u, v]; }
  function beam(m, a, b, t, c, e = 0) {
    const [, u0, v0] = frame(sub(b, a)), u = mul(u0, t / 2), v = mul(v0, t / 2);
    const off = [add(u, v), sub(v, u), mul(add(u, v), -1), sub(u, v)];
    const A = off.map(o => add(a, o)), B = off.map(o => add(b, o));
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; m.quad(A[i], A[j], B[j], B[i], c, e); }
    m.quad(A[0], A[1], A[2], A[3], c, e); m.quad(B[0], B[1], B[2], B[3], c, e);
  }
  // surface of revolution; prof = [[radius, height], ...]
  function lathe(m, o, axis, prof, seg, c, e = 0, flat = false, phase = 0) {
    const [A, U, V] = frame(axis);
    const pt = (r, h, t) => { const ct = Math.cos(t), st = Math.sin(t); return [o[0] + A[0] * h + (U[0] * ct + V[0] * st) * r, o[1] + A[1] * h + (U[1] * ct + V[1] * st) * r, o[2] + A[2] * h + (U[2] * ct + V[2] * st) * r]; };
    const nr = (t, a, b) => { const ct = Math.cos(t), st = Math.sin(t); return [(U[0] * ct + V[0] * st) * a + A[0] * b, (U[1] * ct + V[1] * st) * a + A[1] * b, (U[2] * ct + V[2] * st) * a + A[2] * b]; };
    for (let i = 0; i < prof.length - 1; i++) {
      const [r0, h0] = prof[i], [r1, h1] = prof[i + 1], L = Math.hypot(r1 - r0, h1 - h0) || 1, a = (h1 - h0) / L, b = -(r1 - r0) / L;
      for (let j = 0; j < seg; j++) {
        const t0 = phase + j / seg * TAU, t1 = phase + (j + 1) / seg * TAU;
        const p00 = pt(r0, h0, t0), p01 = pt(r0, h0, t1), p10 = pt(r1, h1, t0), p11 = pt(r1, h1, t1);
        if (flat) { m.quad(p00, p01, p11, p10, c, e); continue; }
        const n0 = nr(t0, a, b), n1 = nr(t1, a, b);
        m.v(p00, n0, c, e, -1); m.v(p01, n1, c, e, -1); m.v(p11, n1, c, e, -1);
        m.v(p00, n0, c, e, -1); m.v(p11, n1, c, e, -1); m.v(p10, n0, c, e, -1);
      }
    }
  }
  function tube(m, pts, r, sides, c, flow = false, e = 0) {
    let acc = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], len = Math.hypot(...sub(b, a)), [, U, V] = frame(sub(b, a));
      for (let j = 0; j < sides; j++) {
        const t0 = j / sides * TAU, t1 = (j + 1) / sides * TAU;
        const d0 = add(mul(U, Math.cos(t0)), mul(V, Math.sin(t0))), d1 = add(mul(U, Math.cos(t1)), mul(V, Math.sin(t1)));
        const f0 = flow ? acc : -1, f1 = flow ? acc + len : -1;
        m.v(add(a, mul(d0, r)), d0, c, e, f0); m.v(add(a, mul(d1, r)), d1, c, e, f0); m.v(add(b, mul(d1, r)), d1, c, e, f1);
        m.v(add(a, mul(d0, r)), d0, c, e, f0); m.v(add(b, mul(d1, r)), d1, c, e, f1); m.v(add(b, mul(d0, r)), d0, c, e, f1);
      }
      acc += len;
    }
  }
  const sheds = (n, len, rc, rs) => { const p = [[0, 0], [rc, 0]]; const s = len / n; for (let k = 0; k < n; k++) { const h = k * s; p.push([rc, h + s * 0.15], [rs, h + s * 0.35], [rc, h + s * 0.7]); } p.push([rc, len], [0, len]); return p; };

  // ================================================================== terrain
  function terrainH(x, z) {
    const dx = Math.max(Math.abs(x) - 62, 0), dz = Math.max(z - 110, 0, -720 - z);
    const d = Math.hypot(dx, dz);
    let m = sstep(0, 130, d);
    const sdx = Math.max(78 - x, 0, x - 190), sdz = Math.max(z - 60, 0, -100 - z);
    m = Math.min(m, sstep(0, 70, Math.hypot(sdx, sdz)));
    let h = Math.pow(fbm(x * 0.0055 + 7.1, z * 0.0055 - 3.3), 1.4) * 95 + fbm(x * 0.03, z * 0.03) * 6;
    h += Math.max(0, Math.abs(x) - 320) * 0.35 + Math.max(0, -z - 900) * 0.3;
    return h * m;
  }
  {
    const X0 = -760, X1 = 760, Z0 = 380, Z1 = -1180, NX = mobile ? 90 : 150, NZ = mobile ? 90 : 150;
    const P = [], Nn = [], C = [];
    for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) {
      const x = lerp(X0, X1, i / NX), z = lerp(Z0, Z1, j / NZ), y = terrainH(x, z);
      const e = 3, hx = terrainH(x + e, z) - terrainH(x - e, z), hz = terrainH(x, z + e) - terrainH(x, z - e);
      P.push([x, y, z]); Nn.push(norm([-hx, 2 * e, -hz]));
      const patch = fbm(x * 0.012 + 40, z * 0.012), stripes = Math.sin((x * 0.8 + z * 0.35) * 0.18) > 0.2;
      let c = mix3(COL.grass, COL.grass2, sstep(0.35, 0.65, fbm(x * 0.02, z * 0.02 + 9)));
      if (patch > 0.56 && y < 30 && y > 0.5) c = stripes ? COL.field : COL.field2;
      c = mix3(c, [0.52, 0.55, 0.42], sstep(40, 140, y));
      C.push(c);
    }
    const at = (i, j) => j * (NX + 1) + i;
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
      const q = [at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)];
      for (const k of [q[0], q[1], q[2], q[0], q[2], q[3]]) S.v(P[k], Nn[k], C[k], 0, -1);
    }
  }
  // a river in the valley on the left
  {
    const pts = []; for (let z = 360; z > -1150; z -= 20) pts.push([-118 + Math.sin(z * 0.006) * 34 + Math.sin(z * 0.017) * 10, z]);
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, z0] = pts[i], [x1, z1] = pts[i + 1], w = 9;
      const y = 0.25; if (terrainH(x0, z0) > 6) continue;
      S.quad([x0 - w, y, z0], [x0 + w, y, z0], [x1 + w, y, z1], [x1 - w, y, z1], COL.water, 5);
    }
  }
  const flat = (x0, z0, x1, z1, c, y = 0.06, e = 0) => S.quad([x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], c, e);

  // ================================================================== 01 generator + turbine hall
  flat(-46, 46, 46, -56, COL.concrete);
  box(S, -30, 0, -16, 30, 3, 26, COL.dark);
  for (const z of [-10, 10]) { box(S, -12, 3, z - 2, -6, 10, z + 2, COL.steel); box(S, 6, 3, z - 2, 12, 10, z + 2, COL.steel); }
  // stator with flanges and ribs (axis along z)
  lathe(S, [0, 22, -12], [0, 0, 1], [[0, 0], [16.2, 0], [16.2, 1.2], [15, 1.4], [15, 22.6], [16.2, 22.8], [16.2, 24], [0, 24]], 40, COL.gen);
  for (let i = 0; i < 18; i++) { const a = i / 18 * TAU; beam(S, [Math.cos(a) * 15.3, 22 + Math.sin(a) * 15.3, -10.6], [Math.cos(a) * 15.3, 22 + Math.sin(a) * 15.3, 10.6], 1.1, COL.genTrim); }
  box(S, -6, 36, -6, 6, 42.4, 4, COL.genTrim); box(S, -7, 42.4, -7, 7, 43.2, 5, COL.dark);
  for (let i = -1; i <= 1; i++) lathe(S, [i * 3.5, 43.2, -1], [0, 1, 0], sheds(3, 3.2, 0.45, 1.0), 10, COL.porcelain);
  // exciter, coupling and a glowing ring
  lathe(S, [0, 22, 12], [0, 0, 1], [[0, 0], [7.5, 0], [7.5, 6], [6.5, 6.6], [0, 6.6]], 28, COL.steel);
  lathe(S, [0, 22, 18.6], [0, 0, 1], [[0, 0], [10.5, 0], [10.5, 1.2], [9.2, 1.6], [0, 1.6]], 32, COL.dark);
  lathe(S, [0, 22, 20.15], [0, 0, 1], [[9.6, 0], [10.4, 0], [10.4, 0.3], [9.6, 0.3], [9.6, 0]], 40, COL.gen, 1);
  // rotor spokes (animated mesh)
  lathe(ROT, [0, 22, 20.3], [0, 0, 1], [[0, 0], [2.6, 0], [2.6, 0.9], [0, 0.9]], 18, COL.genTrim);
  for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; beam(ROT, [Math.cos(a) * 2.4, 22 + Math.sin(a) * 2.4, 20.7], [Math.cos(a) * 8.8, 22 + Math.sin(a) * 8.8, 20.7], 0.9, COL.gen, 1); }
  // turbine casing into the hall
  lathe(S, [0, 22, -12], [0, 0, -1], [[13, 0], [11, 6], [9, 14], [9, 26], [0, 26]], 32, COL.steel);
  // hall with gable roof and clerestory
  {
    const x0 = -30, x1 = 30, z0 = -86, z1 = -36, h = 34, rh = 48;
    box(S, x0, 0, z0, x1, h, z1, COL.wall2);
    const c = COL.roof;
    S.quad([x0 - 1.5, h, z1 + 1.5], [0, rh, z1 + 1.5], [0, rh, z0 - 1.5], [x0 - 1.5, h, z0 - 1.5], c);
    S.quad([0, rh, z1 + 1.5], [x1 + 1.5, h, z1 + 1.5], [x1 + 1.5, h, z0 - 1.5], [0, rh, z0 - 1.5], jit(c, 0.08));
    S.tri([x0, h, z1], [x1, h, z1], [0, rh, z1], COL.wall2); S.tri([x0, h, z0], [x1, h, z0], [0, rh, z0], COL.wall2);
    for (let x = x0 + 4; x < x1 - 4; x += 7) S.quad([x, 10, z1 + 0.08], [x + 4.5, 10, z1 + 0.08], [x + 4.5, 28, z1 + 0.08], [x, 28, z1 + 0.08], COL.glass, rnd() < 0.8 ? 2 : 4);
    for (let z = z0 + 4; z < z1 - 3; z += 7) for (const x of [x0 - 0.08, x1 + 0.08]) S.quad([x, 10, z], [x, 10, z + 4.5], [x, 28, z + 4.5], [x, 28, z], COL.glass, rnd() < 0.8 ? 2 : 4);
    S.quad([-8, 0.1, z1 + 0.1], [8, 0.1, z1 + 0.1], [8, 20, z1 + 0.1], [-8, 20, z1 + 0.1], COL.sgDark);
  }
  const ROTOR_C = [0, 22];

  // ================================================================== 01 renewables: solar farm + wind farm
  // solar farm: tilted panels on frames, facing the sun
  const PV = { tilt: 0.5, w: 8, d: 4.6 };
  function panel(m, cx, cz, roofY = 0) {
    const ct = Math.cos(PV.tilt), st = Math.sin(PV.tilt), hw = PV.w / 2, hd = PV.d / 2, y0 = roofY + (roofY ? 0.9 : 1.6);
    const P = (u, s, lift = 0) => [cx + u, y0 + (hd - s) * st + lift * ct, cz + s * ct - lift * st * 0];
    const n = norm([0, ct, st]);
    const off = p => add(p, mul(n, 0.06));
    // slab: top glass, edges in frame colour
    const a = P(-hw, -hd), b = P(hw, -hd), c = P(hw, hd), d = P(-hw, hd);
    const dn = q => sub(q, mul(n, 0.35));
    m.quad(a, b, c, d, COL.pv, 6);
    m.quad(dn(d), dn(c), c, d, COL.pvFrame); m.quad(dn(a), dn(b), b, a, COL.pvFrame);
    m.quad(dn(a), dn(d), d, a, COL.pvFrame); m.quad(dn(b), dn(c), c, b, COL.pvFrame);
    // cell grid
    for (let k = 1; k < 3; k++) { const s0 = -hd + k * PV.d / 3; m.quad(off(P(-hw + 0.2, s0 - 0.05)), off(P(hw - 0.2, s0 - 0.05)), off(P(hw - 0.2, s0 + 0.05)), off(P(-hw + 0.2, s0 + 0.05)), COL.pvLine, 6); }
    for (let k = 1; k < 6; k++) { const u = -hw + k * PV.w / 6; m.quad(off(P(u - 0.05, -hd + 0.2)), off(P(u + 0.05, -hd + 0.2)), off(P(u + 0.05, hd - 0.2)), off(P(u - 0.05, hd - 0.2)), COL.pvLine, 6); }
    // legs
    if (!roofY) for (const u of [-hw + 0.8, hw - 0.8]) { beam(m, [cx + u, 0, cz + hd * ct - 0.4], dn(P(u, hd - 0.4)), 0.25, COL.dark); beam(m, [cx + u, 0, cz - hd * ct + 0.4], dn(P(u, -hd + 0.4)), 0.25, COL.dark); }
  }
  {
    flat(76, 58, 192, -98, COL.field2, 0.04);
    for (let z = 48; z > -92; z -= 10.5) for (let x = 84; x < 186; x += 8.8) panel(S, x, z);
    // inverter houses and the cable to the generator yard
    for (const z of [10, -50]) { box(S, 80, 0, z - 3, 84, 3.2, z + 3, COL.sg); box(S, 79.8, 3.2, z - 3.2, 84.2, 3.5, z + 3.2, COL.roofDark); box(S, 84.02, 0.8, z - 1, 84.05, 2.6, z + 1, COL.sgDark); }
    tube(S, [[80, 0.45, 10], [60, 0.45, 10], [46, 0.45, 10]], 0.45, 5, COL.dark, true);
    tube(S, [[80, 0.45, -50], [60, 0.45, -50], [60, 0.45, 10]], 0.45, 5, COL.dark, true);
  }
  // wind farm on the hills
  const WIND_DIR = norm([0.55, 0, 0.84]), WIND_YAW = Math.atan2(WIND_DIR[0], WIND_DIR[2]);
  const TURBINES = [];
  {
    const spots = [[-230, 120], [-270, 10], [-250, -120], [-205, 250], [-330, -230], [250, 160], [300, 70], [330, -40], [265, -175], [370, 230], [-360, 120]];
    for (const [x, z] of spots) {
      const y = terrainH(x, z), H = 72;
      lathe(S, [x, y - 1, z], [0, 1, 0], [[4.2, 0], [4.2, 1.6], [2.6, 1.8], [2.4, 4], [1.35, H], [0, H]], 16, COL.blade);
      const top = [x, y + H, z];
      beam(S, add(top, mul(WIND_DIR, -6)), add(top, mul(WIND_DIR, 3)), 3.6, COL.blade);
      box(S, x - 1.2, y + H + 1.8, z - 1.2, x + 1.2, y + H + 2.2, z + 1.2, COL.dark);
      TURBINES.push({ hub: add(top, add(mul(WIND_DIR, 4.6), [0, 0.2, 0])), ph: rnd() * TAU, sp: 0.85 + rnd() * 0.3 });
    }
    // one rotor, built around its own origin; rotor plane is XY, the nose points to +z
    lathe(WIND, [0, 0, -0.4], [0, 0, 1], [[1.9, 0], [2.0, 1.2], [1.6, 2.6], [0.6, 3.6], [0, 3.9]], 14, COL.blade);
    for (let k = 0; k < 3; k++) {
      const a = k / 3 * TAU, D = [Math.cos(a), Math.sin(a), 0], Pp = [-Math.sin(a), Math.cos(a), 0];
      const st = [[1.6, 1.4, 0.7], [5, 2.6, 0.6], [14, 1.9, 0.45], [27, 1.0, 0.3], [33, 0.35, 0.2]];
      for (let i = 0; i < st.length - 1; i++) {
        const [r0, w0, t0] = st[i], [r1, w1, t1] = st[i + 1], c = i === st.length - 2 ? COL.roof : COL.blade;
        const q = (r, w, t, sw, sz) => add(add(mul(D, r), mul(Pp, w * sw * (sw > 0 ? 0.35 : 0.65))), [0, 0, t * sz + 1.2]);
        const A = [q(r0, w0, t0, 1, 1), q(r0, w0, t0, -1, 1), q(r0, w0, t0, -1, -1), q(r0, w0, t0, 1, -1)];
        const B = [q(r1, w1, t1, 1, 1), q(r1, w1, t1, -1, 1), q(r1, w1, t1, -1, -1), q(r1, w1, t1, 1, -1)];
        for (let j = 0; j < 4; j++) { const jj = (j + 1) % 4; WIND.quad(A[j], A[jj], B[jj], B[j], c); }
        if (i === st.length - 2) WIND.quad(B[0], B[1], B[2], B[3], c);
      }
    }
  }
  function windM(t, a) {
    const c = Math.cos(WIND_YAW), s = Math.sin(WIND_YAW), ca = Math.cos(a), sa = Math.sin(a), r = new Float32Array(16);
    r[0] = c * ca; r[1] = sa; r[2] = -s * ca;
    r[4] = -c * sa; r[5] = ca; r[6] = s * sa;
    r[8] = s; r[10] = c;
    r[12] = t.hub[0]; r[13] = t.hub[1]; r[14] = t.hub[2]; r[15] = 1; return r;
  }

  // ================================================================== 02 transmission
  const TOWERS = [-100, -180, -260, -340];
  const ATT = [[-15, 44], [0, 62], [15, 44]];
  function tower(z) {
    const lv = [0, 12, 24, 36, 46, 54], w = y => lerp(8.5, 2.6, y / 54), C = COL.tower;
    for (let i = 0; i < lv.length; i++) {
      const y = lv[i], s = w(y), sq = [[-s, y, z - s], [s, y, z - s], [s, y, z + s], [-s, y, z + s]];
      for (let k = 0; k < 4; k++) beam(S, sq[k], sq[(k + 1) % 4], 0.45, C);
      if (i < lv.length - 1) {
        const y2 = lv[i + 1], s2 = w(y2), sq2 = [[-s2, y2, z - s2], [s2, y2, z - s2], [s2, y2, z + s2], [-s2, y2, z + s2]];
        for (let k = 0; k < 4; k++) { beam(S, sq[k], sq2[k], 0.9, C); const n = (k + 1) % 4; beam(S, sq[k], sq2[n], 0.32, C); beam(S, sq[n], sq2[k], 0.32, C); }
      }
    }
    const t = w(54), top = [0, 68, z];
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) beam(S, [sx * t, 54, z + sz * t], top, 0.6, C);
    for (const dz of [-1.6, 1.6]) {
      beam(S, [-18, 48, z + dz], [18, 48, z + dz], 0.6, C);
      beam(S, [-18, 48, z + dz], [-t, 44, z + dz], 0.4, C); beam(S, [18, 48, z + dz], [t, 44, z + dz], 0.4, C);
      for (let x = -16; x <= 16; x += 4) beam(S, [x, 48, z + dz], [x + 2, 46.2, z + dz], 0.25, C);
    }
    for (const [x, y] of ATT) {
      const ty = x === 0 ? 68 : 48;
      lathe(S, [x, y, z], [0, 1, 0], sheds(6, ty - y - 0.3, 0.3, 1.05), 10, COL.glassIns);
    }
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) box(S, sx * 8.5 - 1.8, -0.5, z + sz * 8.5 - 1.8, sx * 8.5 + 1.8, 1.2, z + sz * 8.5 + 1.8, COL.concrete);
  }
  TOWERS.forEach(tower);

  // ================================================================== 03 substation
  flat(-50, -390, 50, -478, COL.gravel, 0.08);
  for (let x = -50; x <= 50; x += 6.25) for (const z of [-390, -478]) beam(S, [x, 0, z], [x, 7, z], 0.35, COL.tower);
  for (let z = -390; z >= -478; z -= 8) for (const x of [-50, 50]) beam(S, [x, 0, z], [x, 7, z], 0.35, COL.tower);
  for (const y of [3.5, 7]) { beam(S, [-50, y, -390], [50, y, -390], 0.2, COL.tower); beam(S, [-50, y, -478], [50, y, -478], 0.2, COL.tower); beam(S, [-50, y, -390], [-50, y, -478], 0.2, COL.tower); beam(S, [50, y, -390], [50, y, -478], 0.2, COL.tower); }
  const GZ = -404;
  for (const x of [-22, 22]) { beam(S, [x, 0, GZ], [x, 48, GZ], 1.8, COL.steel); box(S, x - 2, -0.2, GZ - 2, x + 2, 1, GZ + 2, COL.concrete); }
  beam(S, [-24, 47, GZ], [24, 47, GZ], 1.6, COL.steel);
  for (const [x] of ATT) lathe(S, [x, 41.5, GZ], [0, 1, 0], sheds(4, 5, 0.3, 0.95), 10, COL.glassIns);
  const TZ = -434;
  box(S, -18, 0, TZ - 11, 18, 2.4, TZ + 11, COL.concrete);
  box(S, -12, 2.4, TZ - 7.5, 12, 22, TZ + 7.5, COL.trafo);
  box(S, -12.6, 22, TZ - 8, 12.6, 23, TZ + 8, COL.dark);
  for (const sgn of [-1, 1]) for (let i = 0; i < 9; i++) { const z = TZ - 6 + i * 1.5; box(S, sgn > 0 ? 12 : -17, 5, z - 0.25, sgn > 0 ? 17 : -12, 20, z + 0.25, jit(COL.trafo, 0.03)); }
  lathe(S, [-11, 27, TZ - 4], [1, 0, 0], [[0, 0], [2.8, 0], [3, 0.5], [3, 21.5], [2.8, 22], [0, 22]], 18, COL.trafo);
  beam(S, [-6, 23, TZ - 4], [-6, 24.4, TZ - 4], 0.7, COL.dark); beam(S, [6, 23, TZ - 4], [6, 24.4, TZ - 4], 0.7, COL.dark);
  const BUSH = [-7, 0, 7];
  for (const x of BUSH) lathe(S, [x, 23, TZ + 2], [0, 1, 0], sheds(5, 11, 0.6, 1.5), 14, COL.porcelain);
  box(S, -4.5, 8, TZ + 7.5, 4.5, 15, TZ + 7.9, COL.dark);
  // MV switchgear lineup (fronts face +z) on a pad, under a light canopy
  const SWF = -452, SWB = -464;
  box(S, -31, 0, SWB - 3, 31, 0.6, SWF + 5, COL.pad);
  for (let i = 0; i < 6; i++) {
    const x0 = -27 + i * 9, x1 = x0 + 8.6, z = SWF, cx = (x0 + x1) / 2;
    box(S, x0, 0.6, SWB, x1, 22, SWF, COL.sg); box(S, x0 - 0.1, 22, SWB - 0.1, x1 + 0.1, 22.8, SWF + 0.4, COL.sgDark);
    box(S, x0 + 0.7, 1.6, z, x1 - 0.7, 13.2, z + 0.35, jit(COL.sg, 0.02));
    box(S, x0 + 0.7, 14.4, z, x1 - 0.7, 21.2, z + 0.25, COL.sgDark);
    box(S, x1 - 2.2, 6.6, z + 0.35, x1 - 1.5, 9, z + 0.8, COL.sgDark);
    box(S, cx - 1.1, 9.8, z + 0.35, cx + 1.1, 11.6, z + 0.45, COL.glass);
    // mimic diagram
    const mz = z + 0.3;
    box(S, cx - 0.12, 17.2, mz, cx + 0.12, 20.6, mz + 0.06, COL.gen, 1);
    beam(S, [cx, 17.2, mz + 0.03], [cx + 1.3, 15.8, mz + 0.03], 0.24, COL.gen, 1);
    box(S, cx - 0.12, 14.9, mz, cx + 0.12, 15.8, mz + 0.06, COL.gen, 1);
    box(S, x0 + 1.4, 19.6, mz, x0 + 2.0, 20.2, mz + 0.1, i % 3 === 1 ? COL.roof : COL.gen, 1);
  }
  box(S, -27.4, 20.4, SWF + 0.24, 26.6, 20.62, SWF + 0.3, COL.gen, 1);
  // a pallet of epoxy parts beside the line
  box(S, 34, 0.6, -462, 46, 1.6, -452, COL.wall2);
  for (let i = 0; i < 3; i++) for (let k = 0; k < 2; k++) lathe(S, [36.5 + i * 3.6, 1.6, -459.5 + k * 5], [0, 1, 0], sheds(4, 4.6, 0.7, 1.3), 14, COL.epoxy);
  // cable trench to the city
  flat(-1.4, -478, 1.4, -510, COL.dark, 0.1);

  // ================================================================== 04 city
  flat(-96, -505, 96, -690, COL.paving, 0.05);
  flat(-8, -505, 8, -690, COL.road, 0.08);
  for (let z = -510; z > -686; z -= 9) flat(-0.25, z, 0.25, z - 4.5, COL.paint, 0.1);
  flat(-96, -592, 96, -600, COL.road, 0.08);
  // factory with saw-tooth roof
  {
    const x0 = -60, x1 = -16, z0 = -545, z1 = -605, h = 12;
    box(S, x0, 0, z1, x1, h, z0, COL.wall);
    for (let z = z0; z > z1; z -= 10) {
      S.quad([x0, h, z - 10], [x1, h, z - 10], [x1, h + 8, z], [x0, h + 8, z], COL.roof);
      { const n = norm([0, 10, 8]); for (let x = x0 + 1.5; x < x1 - 2; x += 5.5) { const o = mul(n, 0.08); S.quad(add([x, h + 0.6, z - 9.4], o), add([x + 4.8, h + 0.6, z - 9.4], o), add([x + 4.8, h + 7.4, z - 0.9], o), add([x, h + 7.4, z - 0.9], o), COL.pv, 6); } }
      S.quad([x0, h, z], [x1, h, z], [x1, h + 8, z], [x0, h + 8, z], COL.glass, 2);
      S.tri([x0, h, z], [x0, h, z - 10], [x0, h + 8, z], COL.wall); S.tri([x1, h, z], [x1, h, z - 10], [x1, h + 8, z], COL.wall);
    }
    for (let z = z0 - 4; z > z1 + 2; z -= 7) S.quad([x1 + 0.08, 3, z], [x1 + 0.08, 3, z - 4], [x1 + 0.08, 9, z - 4], [x1 + 0.08, 9, z], COL.glass, rnd() < 0.85 ? 2 : 4);
    box(S, x1 + 0.1, 0, -566, x1 + 0.6, 8, -578, COL.sgDark);
    lathe(S, [-52, 12, -598], [0, 1, 0], [[2.2, 0], [1.8, 30], [2.4, 30], [2.4, 32], [0, 32]], 16, COL.brick);
  }
  const LOTS = [
    [14, -536, 32, -556, 34, 0], [40, -540, 64, -566, 20, 1], [70, -536, 90, -560, 26, 2],
    [14, -566, 34, -588, 46, 2], [42, -572, 62, -588, 28, 0], [70, -568, 92, -588, 16, 1],
    [14, -606, 36, -632, 22, 1], [44, -606, 64, -640, 38, 0], [72, -604, 92, -630, 18, 2],
    [-62, -614, -40, -640, 26, 2], [-34, -616, -14, -646, 40, 1], [-90, -540, -68, -566, 18, 0],
    [-90, -572, -68, -604, 30, 1], [-88, -612, -68, -640, 14, 0], [14, -646, 40, -676, 30, 2],
    [-40, -652, -14, -680, 22, 0], [-88, -650, -66, -680, 34, 2], [48, -650, 90, -680, 14, 1]
  ];
  const WALLS = [COL.wall, COL.wall2, COL.wall3];
  function facadeWindows(x0, z0, x1, z1, yb, yt) {
    // four faces: z0 (+z front), z1 (back), x0, x1
    const ww = 1.7, wh = 2.3, dy = 3.6, du = 3.4, o = 0.07;
    for (let y = yb + 2; y + wh < yt - 1; y += dy) {
      for (let u = x0 + 1.6; u + ww < x1 - 1; u += du) {
        S.quad([u, y, z0 + o], [u + ww, y, z0 + o], [u + ww, y + wh, z0 + o], [u, y + wh, z0 + o], COL.glass, rnd() < 0.66 ? 2 : 4);
        S.quad([u, y, z1 - o], [u + ww, y, z1 - o], [u + ww, y + wh, z1 - o], [u, y + wh, z1 - o], COL.glass, rnd() < 0.66 ? 2 : 4);
      }
      for (let u = z1 + 1.6; u + ww < z0 - 1; u += du) {
        S.quad([x0 - o, y, u], [x0 - o, y, u + ww], [x0 - o, y + wh, u + ww], [x0 - o, y + wh, u], COL.glass, rnd() < 0.66 ? 2 : 4);
        S.quad([x1 + o, y, u], [x1 + o, y, u + ww], [x1 + o, y + wh, u + ww], [x1 + o, y + wh, u], COL.glass, rnd() < 0.66 ? 2 : 4);
      }
    }
  }
  for (const [x0, z0, x1, z1, h, k] of LOTS) {
    const wc = jit(WALLS[k], 0.04);
    box(S, x0, 0, z1, x1, h, z0, wc);
    box(S, x0 - 0.4, h, z1 - 0.4, x1 + 0.4, h + 0.8, z0 + 0.4, jit(COL.roofDark, 0.05));
    facadeWindows(x0, z0, x1, z1, 0, h);
    box(S, x0, 0, z0, x1, 2.6, z0 + 0.15, jit(COL.brick, 0.05));
    if (h > 30) {           // setback tower
      const ix0 = x0 + 3, ix1 = x1 - 3, iz0 = z0 - 3, iz1 = z1 + 3, h2 = h + 10;
      box(S, ix0, h + 0.8, iz1, ix1, h2, iz0, wc); box(S, ix0 - 0.3, h2, iz1 - 0.3, ix1 + 0.3, h2 + 0.7, iz0 + 0.3, COL.roofDark);
      facadeWindows(ix0, iz0, ix1, iz1, h + 0.8, h2);
      lathe(S, [(ix0 + ix1) / 2, h2 + 0.7, (iz0 + iz1) / 2], [0, 1, 0], [[0, 0], [0.2, 0], [0.2, 9], [0, 9]], 6, COL.dark);
      box(S, (ix0 + ix1) / 2 - 0.3, h2 + 9.4, (iz0 + iz1) / 2 - 0.3, (ix0 + ix1) / 2 + 0.3, h2 + 10, (iz0 + iz1) / 2 + 0.3, COL.roof, 1);
    } else if (k !== 2 && (x1 - x0) > 18) {   // rooftop solar
      for (let z = z0 - 4; z > z1 + 3; z -= 5.4) for (let x = x0 + 5; x < x1 - 3; x += 8.6) panel(S, x, z, h + 0.8);
    } else {                // water tank on legs, roof units
      const cx = x0 + (x1 - x0) * 0.3, cz = z1 + (z0 - z1) * 0.35;
      for (const [a, b] of [[-1.4, -1.4], [1.4, -1.4], [1.4, 1.4], [-1.4, 1.4]]) beam(S, [cx + a, h + 0.8, cz + b], [cx + a * 0.8, h + 5, cz + b * 0.8], 0.3, COL.dark);
      lathe(S, [cx, h + 5, cz], [0, 1, 0], [[0, 0], [2.2, 0], [2.2, 4.2], [1.4, 5.6], [0, 6]], 12, COL.brick);
      box(S, x1 - 5, h + 0.8, z0 - 6, x1 - 2, h + 2.6, z0 - 2.5, COL.steel);
    }
  }
  // street trees in the city
  for (let z = -512; z > -686; z -= 22) for (const x of [-12.5, 12.5]) {
    lathe(S, [x, 0, z], [0, 1, 0], [[0.35, 0], [0.3, 3]], 6, COL.trunk);
    lathe(S, [x, 2.6, z], [0, 1, 0], [[0, 0], [2.0, 0.8], [2.4, 2.4], [1.6, 3.9], [0, 4.4]], 7, jit(COL.tree2, 0.08), 0, true, rnd());
  }
  // street lights + light cones
  const LAMP = { z0: -516, sp: mobile ? 24 : 16, n: 0, x: 6.6, y: 11.2 };
  for (let z = LAMP.z0; z >= -680; z -= LAMP.sp) {
    LAMP.n++;
    for (const sx of [-10, 10]) {
      const d = sx < 0 ? 1 : -1;
      lathe(S, [sx, 0, z], [0, 1, 0], [[0.32, 0], [0.32, 0.6], [0.18, 0.9], [0.16, 11.4], [0, 11.4]], 8, COL.dark);
      beam(S, [sx, 11.2, z], [sx + d * 3.4, 11.8, z], 0.22, COL.dark);
      box(S, sx + d * 3.4 - 0.7, 11.2, z - 0.35, sx + d * 3.4 + 0.7, 11.8, z + 0.35, COL.dark);
      box(S, sx + d * 3.4 - 0.55, 10.95, z - 0.25, sx + d * 3.4 + 0.55, 11.2, z + 0.25, COL.paint, 3);
      const lx = sx + d * 3.4;
      // up cone: light lost to the sky (kind 0); down cone: light on the street (kind 1)
      cone(CONES, [lx, 11.8, z], 1, 46, 0.6, 9, 0);
      cone(CONES, [lx, 10.9, z], -1, 10.8, 0.5, 6.5, 1);
    }
  }
  function cone(m, o, dir, len, r0, r1, kind) {
    const seg = 14;
    for (let j = 0; j < seg; j++) {
      const t0 = j / seg * TAU, t1 = (j + 1) / seg * TAU;
      const p = (t, r, h) => [o[0] + Math.cos(t) * r, o[1] + dir * h, o[2] + Math.sin(t) * r];
      const n = t => [Math.cos(t), 0, Math.sin(t)];
      m.v(p(t0, r0, 0), n(t0), [1, 1, 1], kind, 0); m.v(p(t1, r0, 0), n(t1), [1, 1, 1], kind, 0); m.v(p(t1, r1, len), n(t1), [1, 1, 1], kind, 1);
      m.v(p(t0, r0, 0), n(t0), [1, 1, 1], kind, 0); m.v(p(t1, r1, len), n(t1), [1, 1, 1], kind, 1); m.v(p(t0, r1, len), n(t0), [1, 1, 1], kind, 1);
    }
  }

  // ================================================================== conductors (with current)
  function catenary(pts, a, sagK) {
    const prev = pts[pts.length - 1], n = 18, sag = Math.abs(a[2] - prev[2]) * sagK;
    for (let i = 1; i <= n; i++) { const t = i / n; pts.push([lerp(prev[0], a[0], t), lerp(prev[1], a[1], t) - sag * 4 * t * (1 - t), lerp(prev[2], a[2], t)]); }
  }
  for (let p = 0; p < 3; p++) {
    const pts = [[(p - 1) * 3.5, 46.4, -1]];
    catenary(pts, [(p - 1) * 6, 52, -40], 0.02);
    for (const z of TOWERS) catenary(pts, [ATT[p][0], ATT[p][1], z], 0.05);
    catenary(pts, [ATT[p][0], 41.5, GZ], 0.03);
    catenary(pts, [BUSH[p], 34, TZ + 2], 0.01);
    tube(S, pts, 0.32, 5, COL.dark, true);
  }
  tube(S, [[0, 0.5, TZ + 11], [0, 0.5, SWF + 5]], 0.5, 5, COL.dark, true);
  tube(S, [[0, 0.5, SWB - 3], [0, 0.5, -510], [0, 0.5, -686]], 0.5, 5, COL.dark, true);
  for (const [z, x] of [[-575, -16], [-560, 14], [-628, 14], [-630, -14]]) tube(S, [[0, 0.5, z], [x, 0.5, z]], 0.45, 5, COL.dark, true);

  // ================================================================== trees
  {
    const n = mobile ? 260 : 620; let k = 0, guard = 0;
    while (k < n && guard++ < 20000) {
      const x = (rnd() - 0.5) * 1100, z = 300 - rnd() * 1350;
      if (Math.abs(x) < 58 && z > -505 && z < 110) continue;
      if (Math.abs(x) < 100 && z < -500 && z > -695) continue;
      if (x > 70 && x < 200 && z < 66 && z > -106) continue;
      if (TURBINES.some(t => Math.hypot(t.hub[0] - x, t.hub[2] - z) < 14)) continue;
      const y = terrainH(x, z); if (y > 120) continue;
      const cl = sstep(0.4, 0.7, fbm(x * 0.01 + 3, z * 0.01));
      if (rnd() > 0.25 + cl * 0.75) continue;
      const s = 0.8 + rnd() * 0.7, pine = rnd() < 0.55;
      lathe(S, [x, y - 0.5, z], [0, 1, 0], [[0.45 * s, 0], [0.35 * s, 3.2 * s]], 5, COL.trunk);
      if (pine) {
        const c = jit(COL.tree1, 0.1), ph = rnd();
        lathe(S, [x, y + 2 * s, z], [0, 1, 0], [[0, 0], [4.2 * s, 1.2 * s], [0, 7 * s]], 7, c, 0, true, ph);
        lathe(S, [x, y + 6 * s, z], [0, 1, 0], [[0, 0], [3.2 * s, 1 * s], [0, 6 * s]], 7, c, 0, true, ph + 0.4);
      } else {
        const c = jit(rnd() < 0.12 ? COL.tree3 : COL.tree2, 0.1);
        lathe(S, [x, y + 2.5 * s, z], [0, 1, 0], [[0, 0], [3.4 * s, 1.4 * s], [4 * s, 3.6 * s], [2.8 * s, 6 * s], [0, 7 * s]], 7, c, 0, true, rnd());
      }
      k++;
    }
  }
  // distant mountains, low poly with snow
  for (let i = 0; i < 46; i++) {
    const a = i / 46 * TAU + rnd() * 0.12, R = 1700 + rnd() * 900, h = 260 + rnd() * 420, r = 300 + rnd() * 320;
    const o = [Math.cos(a) * R, -10, -330 + Math.sin(a) * R], c = jit(COL.mountain, 0.07), ph = rnd() * TAU;
    lathe(S, o, [0, 1, 0], [[r, 0], [r * 0.55, h * 0.5], [r * 0.24, h * 0.8]], 7, c, 0, true, ph);
    lathe(S, o, [0, 1, 0], [[r * 0.24, h * 0.8], [0, h]], 7, COL.snow, 0, true, ph);
  }

  // ================================================================== GL setup
  function sh(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
  function prog(vs, fs) {
    const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name.replace('[0]', '')] = gl.getUniformLocation(p, info.name); }
    return { p, u };
  }
  function vao(mesh) {
    const data = new Float32Array(mesh.a), v = gl.createVertexArray(), b = gl.createBuffer();
    gl.bindVertexArray(v); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    const st = 44; [[0, 3, 0], [1, 3, 12], [2, 3, 24], [3, 2, 36]].forEach(([l, n, o]) => { gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, n, gl.FLOAT, false, st, o); });
    gl.bindVertexArray(null); return { v, n: data.length / 11 };
  }

  const NOISE = `
  float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
  float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
    return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
  float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*vn(p); p=p*2.02+vec2(17.1,9.2); a*=.5; } return s; }`;

  const VS_MAIN = `#version 300 es
  layout(location=0) in vec3 aP; layout(location=1) in vec3 aN; layout(location=2) in vec3 aC; layout(location=3) in vec2 aE;
  uniform mat4 uModel, uView, uProj, uLVP;
  out vec3 vW, vN, vC; out vec2 vE; out vec4 vL; out float vZ;
  void main(){ vec4 w=uModel*vec4(aP,1.); vW=w.xyz; vN=mat3(uModel)*aN; vC=aC; vE=aE; vL=uLVP*w; vec4 v=uView*w; vZ=-v.z; gl_Position=uProj*v; }`;

  const FS_MAIN = `#version 300 es
  precision highp float;
  in vec3 vW, vN, vC; in vec2 vE; in vec4 vL; in float vZ;
  uniform vec3 uSun, uSunC, uShade, uAmb, uFog, uHor, uCam; uniform float uFogD, uNight, uTime, uEta, uSurge, uDpr, uShOn;
  uniform mat4 uView; uniform highp sampler2D uShadow;
  uniform vec4 uLamp; // z0, spacing, count, x
  layout(location=0) out vec4 oC; layout(location=1) out vec4 oND;
  ${NOISE}
  float shadowAt(vec4 l, float ndl){
    if(uShOn<.5) return 1.;
    vec3 p=l.xyz/l.w*.5+.5; if(p.x<0.||p.x>1.||p.y<0.||p.y>1.||p.z>1.) return 1.;
    vec2 t=1./vec2(textureSize(uShadow,0)); float b=.0008+.0025*(1.-clamp(ndl,0.,1.)); float s=0.;
    for(int i=-1;i<=1;i++) for(int j=-1;j<=1;j++) s+= (p.z-b > texture(uShadow,p.xy+vec2(i,j)*t*1.2).r) ? 0. : 1.;
    return s/9.;
  }
  void main(){
    vec3 n=normalize(vN); vec3 V=normalize(uCam-vW); if(dot(n,V)<0.) n=-n;
    float kind=vE.x, flow=vE.y;
    vec3 base=vC;
    // painterly variation in large surfaces
    float pv=fbm(vW.xz*.08+vW.y*.05)-.5; base*=1.+pv*.10;
    float ndl=dot(n,uSun);
    float shd=shadowAt(vL,ndl);
    float lit=smoothstep(.0,.08,ndl)*smoothstep(.35,.65,shd);
    float hi=smoothstep(.55,.62,ndl)*lit;
    float sky=clamp(n.y*.5+.5,0.,1.);
    vec3 c=base*mix(uShade,uSunC,lit) + base*uAmb*(.6+.8*sky) + base*uSunC*.12*hi;
    // rim light, a thin warm edge toward the light
    float rim=pow(1.-max(dot(n,V),0.),3.)*smoothstep(-.2,.4,dot(-V,uSun));
    c+=uSunC*rim*.18*(1.-uNight*.5);
    // hatching in the shade
    vec2 fc=gl_FragCoord.xy/uDpr;
    float near=1.-smoothstep(120.,520.,vZ);
    float h1=1.-smoothstep(.0,.9,abs(fract((fc.x+fc.y)/5.)-.5)*5.);
    float h2=1.-smoothstep(.0,.9,abs(fract((fc.x-fc.y)/5.)-.5)*5.);
    float dark=1.-lit;
    c*=1.-near*dark*(.16*h1+.12*h2*smoothstep(-.05,-.4,ndl));
    float em=0.;
    if(kind>.5&&kind<1.5){ c=mix(c,vec3(.42,.92,.55),.92); em=.7+uSurge*.8; }
    else if(kind>1.5&&kind<2.5){ vec3 g=mix(base*.8,uHor*.7,.35); c=mix(g*mix(uShade,uSunC,.6),vec3(1.,.78,.46)*1.15,uNight); em=uNight*.55; }
    else if(kind>2.5&&kind<3.5){ c=mix(c,vec3(1.,.93,.75)*1.4,uNight); em=uNight*1.2; }
    else if(kind>3.5&&kind<4.5){ vec3 g=mix(base*.8,uHor*.7,.35); c=mix(g*mix(uShade,uSunC,.6),vec3(.09,.12,.17),uNight); }
    else if(kind>4.5&&kind<5.5){ // water: banded reflections of the sky
      float r=fbm(vW.xz*vec2(.05,.012)+vec2(0.,uTime*.05)); c=mix(uHor*.9,base,.45)+step(.62,r)*.18*uSunC*(1.-uNight); c=mix(c,c*.5,uNight*.5); }
    if(kind>5.5&&kind<6.5){ // solar glass: sky reflection and a sun glint
      float fr=pow(1.-max(dot(n,V),0.),2.); vec3 R=reflect(-V,n); float sp=pow(max(dot(R,uSun),0.),48.);
      c=mix(c,uHor*.8,.18+fr*.45)+uSunC*sp*.9*(1.-uNight)*lit; em=max(em,sp*.3*(1.-uNight)*lit); c=mix(c,c*.6,uNight*.4); }
    if(flow>=0.){
      float d=fract(flow/14.-uTime*(.9+uSurge*3.5));
      float dash=smoothstep(0.,.03,d)*(1.-smoothstep(.10,.16,d));
      c=mix(c,vec3(.6,1.,.66),dash); em=max(em,dash*.95);
    }
    // street light pools on the ground
    if(vW.y<.7 && vW.z<uLamp.x+8. && vW.z>uLamp.x-uLamp.y*uLamp.z-6. && abs(vW.x)<40.){
      float k=clamp(floor((uLamp.x-vW.z)/uLamp.y+.5),0.,uLamp.z-1.); float lz=uLamp.x-k*uLamp.y;
      vec2 d1=vec2(vW.x-uLamp.w,vW.z-lz), d2=vec2(vW.x+uLamp.w,vW.z-lz);
      float r=5.+uEta*5.; float pool=exp(-dot(d1,d1)/(r*r))+exp(-dot(d2,d2)/(r*r));
      c+=vec3(1.,.74,.42)*pool*uNight*(.2+.75*uEta); em=max(em,pool*uNight*(.1+.3*uEta));
    }
    float f=1.-exp(-pow(vZ*uFogD,1.5));
    c=mix(c,uFog,f);
    oC=vec4(c,em*(1.-f));
    oND=vec4(normalize(mat3(uView)*n)*.5+.5, min(vZ/3000.,.999));
  }`;

  const VS_FS = `#version 300 es
  out vec2 vUV; void main(){ vec2 p=vec2((gl_VertexID<<1)&2, gl_VertexID&2); vUV=p; gl_Position=vec4(p*2.-1.,0.,1.); }`;

  const FS_SKY = `#version 300 es
  precision highp float;
  in vec2 vUV;
  uniform vec3 uF, uR, uU, uSun, uSunC, uTop, uHor, uCL, uCS, uCity; uniform vec2 uCtr; uniform float uTanH, uAsp, uNight, uEta, uTime;
  layout(location=0) out vec4 oC; layout(location=1) out vec4 oND;
  ${NOISE}
  void main(){
    vec2 ndc=vUV*2.-1.;
    vec3 d=normalize(uF+(ndc.x-uCtr.x)*uTanH*uAsp*uR+(ndc.y-uCtr.y)*uTanH*uU);
    float el=d.y;
    vec3 c=mix(uHor,uTop,smoothstep(-.02,.5,el));
    c=mix(c,uHor*1.05,smoothstep(.12,0.,abs(el))*.5);
    float sd=max(dot(d,uSun),0.);
    c+=uSunC*pow(sd,10.)*.28*(1.-uNight*.7);
    c=mix(c,vec3(1.,.95,.84),smoothstep(.9990,.9993,sd)*(1.-uNight)*smoothstep(-.02,.02,el));
    float glow=0.;
    // stars, washed out by the light the city sends up
    if(el>0.){
      vec3 q=d*220.; vec3 id=floor(q); float h=fract(sin(dot(id,vec3(12.9898,78.233,37.719)))*43758.5453);
      float s=step(.9975,h)*smoothstep(.35,.0,length(fract(q)-.5));
      float vis=uNight*clamp((uEta-.35)*1.8,0.,1.)*smoothstep(0.,.25,el);
      c+=vec3(1.,.96,.88)*s*vis*1.6; glow+=s*vis;
    }
    // stylised clouds: flat shapes, a lit side and a shaded side
    if(el>.005){
      vec2 p=d.xz/(el+.12)*.9+vec2(uTime*.004,0.);
      float n=fbm(p*.55);
      float m=smoothstep(.53,.56,n)*smoothstep(.0,.12,el);
      float l=fbm(p*.55+normalize(uSun.xz+1e-4)*.06);
      vec3 cc=mix(uCL,uCS,smoothstep(-.01,.02,l-n));
      cc=mix(cc,uCL*1.08,smoothstep(.56,.6,n)*.3);
      c=mix(c,cc,m*.95);
      float edge=smoothstep(.53,.545,n)-smoothstep(.545,.56,n);
      c=mix(c,uCS*.7,edge*.35*smoothstep(0.,.1,el));
    }
    // the glow of the city on the sky
    vec3 hd=normalize(vec3(d.x,0.,d.z)+1e-5);
    float cg=pow(max(dot(hd,uCity),0.),5.)*exp(-max(el,0.)*5.5);
    c+=vec3(1.,.48,.18)*cg*uNight*(1.-uEta)*1.1;
    oC=vec4(c,glow*.6);
    oND=vec4(.5,.5,1.,1.);
  }`;

  const VS_CONE = `#version 300 es
  layout(location=0) in vec3 aP; layout(location=1) in vec3 aN; layout(location=3) in vec2 aE;
  uniform mat4 uView, uProj; uniform vec3 uCam;
  out float vK, vH, vF;
  void main(){ vK=aE.x; vH=aE.y; vec3 V=normalize(uCam-aP); vF=abs(dot(normalize(aN),V)); gl_Position=uProj*uView*vec4(aP,1.); }`;
  const FS_CONE = `#version 300 es
  precision highp float;
  in float vK, vH, vF; uniform float uUp, uDown;
  layout(location=0) out vec4 oC;
  void main(){
    float a=pow(1.-vH,2.)*pow(vF,1.6);
    vec3 c = vK<.5 ? vec3(1.,.52,.22)*uUp : vec3(1.,.8,.5)*uDown;
    oC=vec4(c*a,0.);
  }`;

  const VS_SH = `#version 300 es
  layout(location=0) in vec3 aP; uniform mat4 uModel, uLVP; void main(){ gl_Position=uLVP*uModel*vec4(aP,1.); }`;
  const FS_SH = `#version 300 es
  precision mediump float; void main(){}`;

  const FS_COMP = `#version 300 es
  precision highp float;
  in vec2 vUV;
  uniform sampler2D uCol, uND; uniform vec2 uPx; uniform vec3 uInk, uFog; uniform float uTime, uNight, uK;
  out vec4 o;
  ${NOISE}
  void main(){
    vec4 c=texture(uCol,vUV), nd=texture(uND,vUV);
    vec2 px=uPx*uK;
    vec4 a=texture(uND,vUV+vec2(px.x,0.)), b=texture(uND,vUV-vec2(px.x,0.)), d=texture(uND,vUV+vec2(0.,px.y)), e=texture(uND,vUV-vec2(0.,px.y));
    float z=nd.w;
    float zmin=min(min(a.w,b.w),min(d.w,e.w));
    float de=abs(a.w+b.w+d.w+e.w-4.*z)/max(min(z,zmin),1e-4);
    float ne=length(a.xyz-nd.xyz)+length(b.xyz-nd.xyz)+length(d.xyz-nd.xyz)+length(e.xyz-nd.xyz);
    float edge=max(smoothstep(.035,.09,de), smoothstep(.45,.75,ne));
    float zz=min(z,zmin);
    edge*=1.-smoothstep(.16,.42,zz);
    edge*=.55+.45*vn(gl_FragCoord.xy*.35); // a little unevenness, like a pen
    vec3 col=c.rgb;
    // glow from emissive parts
    vec3 g=vec3(0.); float tot=0.;
    for(int i=0;i<16;i++){ float an=float(i)*2.39996; float r=sqrt(float(i)+.5)/4.; vec2 off=vec2(cos(an),sin(an))*r*16.*px;
      vec4 s=texture(uCol,vUV+off); float w=1.-r*.6; g+=s.rgb*s.a*w; tot+=w; }
    col+=g/tot*1.6;
    col=mix(col,uInk,edge*.82);
    // paper: grain and soft fibres
    float gr=h21(gl_FragCoord.xy+fract(uTime*0.)*0.)-.5;
    float fib=fbm(gl_FragCoord.xy*vec2(.012,.03))-.5;
    col*=1.+fib*.06; col+=gr*.03;
    // grade
    float l=dot(col,vec3(.299,.587,.114)); col=mix(vec3(l),col,1.08);
    vec2 q=vUV-.5; col*=1.-dot(q,q)*.55;
    o=vec4(pow(max(col,0.),vec3(.98)),1.);
  }`;

  let P_MAIN, P_SKY, P_CONE, P_SH, P_COMP;
  try {
    P_MAIN = prog(VS_MAIN, FS_MAIN); P_SKY = prog(VS_FS, FS_SKY); P_CONE = prog(VS_CONE, FS_CONE);
    P_SH = prog(VS_SH, FS_SH); P_COMP = prog(VS_FS, FS_COMP);
  } catch (err) { console.error(err); document.body.classList.add('nogl'); return; }
  const V_S = vao(S), V_R = vao(ROT), V_C = vao(CONES), V_W = vao(WIND), V_E = gl.createVertexArray();
  S.a = ROT.a = CONES.a = WIND.a = null;

  // render targets
  let W = 0, H = 0, DPR = 1, fbo = null, tCol = null, tND = null, rbD = null;
  function tex(fmt, ifmt, type, w, h, filter) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, w, h, 0, fmt, type, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  function resize() {
    DPR = Math.min(devicePixelRatio || 1, mobile ? 1.5 : 1.75);
    W = innerWidth; H = innerHeight;
    const pw = Math.round(W * DPR), ph = Math.round(H * DPR);
    canvas.width = pw; canvas.height = ph;
    if (fbo) { gl.deleteFramebuffer(fbo); gl.deleteTexture(tCol); gl.deleteTexture(tND); gl.deleteRenderbuffer(rbD); }
    tCol = tex(gl.RGBA, gl.RGBA8, gl.UNSIGNED_BYTE, pw, ph, gl.LINEAR);
    tND = floatOK ? tex(gl.RGBA, gl.RGBA16F, gl.HALF_FLOAT, pw, ph, gl.NEAREST) : tex(gl.RGBA, gl.RGBA8, gl.UNSIGNED_BYTE, pw, ph, gl.NEAREST);
    rbD = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, rbD); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, pw, ph);
    fbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tCol, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, tND, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rbD);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  resize(); addEventListener('resize', resize);

  const SHS = mobile ? 1024 : 2048;
  const tSh = tex(gl.DEPTH_COMPONENT, gl.DEPTH_COMPONENT24, gl.UNSIGNED_INT, SHS, SHS, gl.NEAREST);
  const fboSh = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fboSh);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, tSh, 0);
  gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
  const shOK = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  // ================================================================== time of day
  const TOD = [
    { sun: [-0.62, 0.48, 0.62], sunC: [1.22, 1.04, 0.84], shade: [0.46, 0.46, 0.66], amb: [0.10, 0.10, 0.12], fog: [0.92, 0.82, 0.70], hor: [0.99, 0.88, 0.70], top: [0.40, 0.62, 0.80], cl: [1.0, 0.95, 0.86], cs: [0.74, 0.74, 0.86], ink: [0.20, 0.13, 0.11], fogD: 0.00042 },
    { sun: [-0.86, 0.14, 0.48], sunC: [1.28, 0.74, 0.48], shade: [0.34, 0.30, 0.54], amb: [0.07, 0.06, 0.11], fog: [0.86, 0.58, 0.50], hor: [1.0, 0.64, 0.44], top: [0.22, 0.26, 0.50], cl: [1.0, 0.66, 0.52], cs: [0.46, 0.34, 0.56], ink: [0.13, 0.08, 0.14], fogD: 0.00048 },
    { sun: [0.40, 0.62, -0.44], sunC: [0.40, 0.48, 0.72], shade: [0.11, 0.13, 0.24], amb: [0.04, 0.05, 0.09], fog: [0.10, 0.13, 0.22], hor: [0.14, 0.17, 0.30], top: [0.03, 0.05, 0.12], cl: [0.24, 0.27, 0.42], cs: [0.09, 0.11, 0.19], ink: [0.02, 0.03, 0.06], fogD: 0.00055 }
  ];
  function todAt(t) {
    const x = clamp(t, 0, 1) * 2, i = Math.min(1, Math.floor(x)), f = x - i, a = TOD[i], b = TOD[i + 1], r = {};
    for (const k in a) r[k] = Array.isArray(a[k]) ? mix3(a[k], b[k], f) : lerp(a[k], b[k], f);
    r.sun = norm(r.sun); return r;
  }

  // ================================================================== camera
  const KEYS = {
    hero: { t: [20, 30, -250], d: 640, yaw: 0.72, pitch: 0.15, sx: 0.68, tod: 0 },
    gen:  { t: [70, 30, -10], d: 300, yaw: 0.9, pitch: 0.17, sx: 0.7,  tod: 0.02 },
    tx:   { t: [0, 44, -214], d: 220, yaw: 1.22, pitch: 0.07, sx: 0.7,  tod: 0.36 },
    dist: { t: [0, 14, -444], d: 132, yaw: 0.6,  pitch: 0.2,  sx: 0.7,  tod: 0.62 },
    use:  { t: [4, 16, -596], d: 210, yaw: 0.7,  pitch: 0.27, sx: 0.7,  tod: 1 },
    over: { t: [0, 24, -330], d: 680, yaw: -0.62, pitch: 0.2, sx: 0.66, tod: 0.5 },
    plan: { t: [0, 10, -340], d: 720, yaw: 0.35, pitch: 0.55, sx: 0.5,  tod: 1 }
  };
  const cam = Object.assign({}, KEYS.hero, { t: KEYS.hero.t.slice() });
  let key = KEYS.hero, tod = 0;
  let orbitYaw = 0, orbitPitch = 0, parX = 0, parY = 0, tParX = 0, tParY = 0, dragging = false;

  // labels
  const LABELS = [
    { p: [135, 34, -20], n: '01', t: 'Solar, wind and generator', k: 'gen' },
    { p: [0, 80, -260], n: '02', t: 'Transmission', k: 'tx' },
    { p: [-4, 44, -436], n: '03', t: 'Substation', k: 'dist' },
    { p: [24, 64, -578], n: '04', t: 'City', k: 'use' }
  ];
  const labelBox = document.createElement('div'); labelBox.className = 'scene-labels'; labelBox.setAttribute('aria-hidden', 'true');
  for (const l of LABELS) { const el = document.createElement('span'); el.className = 'scene-label'; el.innerHTML = `<i></i><em>${l.n}</em>${l.t}`; labelBox.appendChild(el); l.el = el; }
  document.body.appendChild(labelBox);

  // ================================================================== frame
  let last = performance.now(), time = 0, rot = 0, windRot = 0, surge = 0;
  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; time += reduce ? 0 : dt;
    const k = reduce ? 1 : 1 - Math.pow(0.0015, dt);
    for (const p of ['d', 'yaw', 'pitch', 'sx']) cam[p] = lerp(cam[p], key[p], k);
    for (let i = 0; i < 3; i++) cam.t[i] = lerp(cam.t[i], key.t[i], k);
    tod = lerp(tod, key.tod, reduce ? 1 : 1 - Math.pow(0.15, dt));
    parX = lerp(parX, tParX, 0.05); parY = lerp(parY, tParY, 0.05);
    if (!dragging) { orbitYaw *= 1 - dt * 0.35; orbitPitch *= 1 - dt * 0.6; }
    surge = Math.max(0, surge - dt * 0.55);
    if (!reduce) { rot += dt * (0.8 + surge * 6); windRot += dt * (0.55 + surge * 2.2); }
    const T = todAt(tod), night = sstep(0.55, 0.95, tod), eta = API.eta;

    // camera
    const yaw = cam.yaw + orbitYaw + parX, pitch = clamp(cam.pitch + orbitPitch + parY, 0.02, 1.3), cp = Math.cos(pitch);
    const eye = [cam.t[0] + Math.sin(yaw) * cp * cam.d, cam.t[1] + Math.sin(pitch) * cam.d, cam.t[2] + Math.cos(yaw) * cp * cam.d];
    const view = M4.look(eye, cam.t, [0, 1, 0]);
    const asp = W / H, fovy = (mobile ? 46 : 36) * Math.PI / 180, cx = mobile ? 0 : (2 * cam.sx - 1), cy = mobile ? 0.1 : -0.2;
    const proj = M4.persp(fovy, asp, 1, 7000, cx, cy);
    const Fw = norm(sub(cam.t, eye)), Rw = norm(cross(Fw, [0, 1, 0])), Uw = cross(Rw, Fw);

    // shadow map from the sun (or moon), fitted to what the camera looks at
    const S0 = clamp(cam.d * 1.15, 140, 760), lc = [cam.t[0] - Fw[0] * 0, cam.t[1], cam.t[2]];
    const lv = M4.look(add(lc, mul(T.sun, 1200)), lc, Math.abs(T.sun[1]) > 0.98 ? [1, 0, 0] : [0, 1, 0]);
    const lvp = M4.mul(M4.ortho(-S0, S0, -S0, S0, 10, 2600), lv);
    const rotM = M4.rotZAbout(rot, ROTOR_C[0], ROTOR_C[1]), I = M4.id();
    const WM = TURBINES.map(t => windM(t, t.ph - windRot * t.sp));
    if (shOK) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fboSh); gl.viewport(0, 0, SHS, SHS);
      gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(2, 4);
      gl.useProgram(P_SH.p); gl.uniformMatrix4fv(P_SH.u.uLVP, false, lvp);
      gl.uniformMatrix4fv(P_SH.u.uModel, false, I); gl.bindVertexArray(V_S.v); gl.drawArrays(gl.TRIANGLES, 0, V_S.n);
      gl.uniformMatrix4fv(P_SH.u.uModel, false, rotM); gl.bindVertexArray(V_R.v); gl.drawArrays(gl.TRIANGLES, 0, V_R.n);
      gl.bindVertexArray(V_W.v); for (const w of WM) { gl.uniformMatrix4fv(P_SH.u.uModel, false, w); gl.drawArrays(gl.TRIANGLES, 0, V_W.n); }
      gl.disable(gl.POLYGON_OFFSET_FILL);
    }

    // main pass
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.viewport(0, 0, canvas.width, canvas.height);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    gl.clearBufferfv(gl.COLOR, 0, [...T.fog, 0]); gl.clearBufferfv(gl.COLOR, 1, [0.5, 0.5, 1, 1]); gl.clearBufferfv(gl.DEPTH, 0, [1]);
    // sky
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false);
    gl.useProgram(P_SKY.p); const u = P_SKY.u;
    gl.uniform3fv(u.uF, Fw); gl.uniform3fv(u.uR, Rw); gl.uniform3fv(u.uU, Uw); gl.uniform2f(u.uCtr, cx, cy);
    gl.uniform1f(u.uTanH, Math.tan(fovy / 2)); gl.uniform1f(u.uAsp, asp);
    gl.uniform3fv(u.uSun, T.sun); gl.uniform3fv(u.uSunC, T.sunC); gl.uniform3fv(u.uTop, T.top); gl.uniform3fv(u.uHor, T.hor);
    gl.uniform3fv(u.uCL, T.cl); gl.uniform3fv(u.uCS, T.cs); gl.uniform1f(u.uNight, night); gl.uniform1f(u.uEta, eta); gl.uniform1f(u.uTime, time);
    gl.uniform3fv(u.uCity, norm([0 - eye[0], 0, -596 - eye[2]]));
    gl.bindVertexArray(V_E); gl.drawArrays(gl.TRIANGLES, 0, 3);
    // geometry
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.depthFunc(gl.LESS);
    const m = P_MAIN.u; gl.useProgram(P_MAIN.p);
    gl.uniformMatrix4fv(m.uView, false, view); gl.uniformMatrix4fv(m.uProj, false, proj); gl.uniformMatrix4fv(m.uLVP, false, lvp);
    gl.uniform3fv(m.uSun, T.sun); gl.uniform3fv(m.uSunC, T.sunC); gl.uniform3fv(m.uShade, T.shade); gl.uniform3fv(m.uAmb, T.amb);
    gl.uniform3fv(m.uFog, T.fog); gl.uniform3fv(m.uHor, T.hor); gl.uniform3fv(m.uCam, eye); gl.uniform1f(m.uFogD, T.fogD);
    gl.uniform1f(m.uNight, night); gl.uniform1f(m.uTime, time); gl.uniform1f(m.uEta, eta); gl.uniform1f(m.uSurge, surge); gl.uniform1f(m.uDpr, DPR);
    gl.uniform1f(m.uShOn, shOK ? 1 : 0); gl.uniform4f(m.uLamp, LAMP.z0, LAMP.sp, LAMP.n, LAMP.x);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tSh); gl.uniform1i(m.uShadow, 0);
    gl.uniformMatrix4fv(m.uModel, false, I); gl.bindVertexArray(V_S.v); gl.drawArrays(gl.TRIANGLES, 0, V_S.n);
    gl.uniformMatrix4fv(m.uModel, false, rotM); gl.bindVertexArray(V_R.v); gl.drawArrays(gl.TRIANGLES, 0, V_R.n);
    gl.bindVertexArray(V_W.v); for (const w of WM) { gl.uniformMatrix4fv(m.uModel, false, w); gl.drawArrays(gl.TRIANGLES, 0, V_W.n); }
    // light volumes
    if (night > 0.01) {
      gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.NONE]);
      gl.depthMask(false); gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ZERO, gl.ONE);
      gl.useProgram(P_CONE.p); gl.uniformMatrix4fv(P_CONE.u.uView, false, view); gl.uniformMatrix4fv(P_CONE.u.uProj, false, proj);
      gl.uniform3fv(P_CONE.u.uCam, eye);
      gl.uniform1f(P_CONE.u.uUp, night * (1 - eta) * 0.55); gl.uniform1f(P_CONE.u.uDown, night * (0.1 + 0.4 * eta) * 0.5);
      gl.bindVertexArray(V_C.v); gl.drawArrays(gl.TRIANGLES, 0, V_C.n);
      gl.disable(gl.BLEND); gl.depthMask(true);
    }

    // composite
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, canvas.width, canvas.height); gl.disable(gl.DEPTH_TEST);
    gl.useProgram(P_COMP.p); const c = P_COMP.u;
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tCol); gl.uniform1i(c.uCol, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tND); gl.uniform1i(c.uND, 1);
    gl.uniform2f(c.uPx, 1 / canvas.width, 1 / canvas.height); gl.uniform1f(c.uK, Math.max(1, DPR * 0.8));
    gl.uniform3fv(c.uInk, T.ink); gl.uniform3fv(c.uFog, T.fog); gl.uniform1f(c.uTime, time); gl.uniform1f(c.uNight, night);
    gl.bindVertexArray(V_E); gl.drawArrays(gl.TRIANGLES, 0, 3);

    // labels
    const vp = M4.mul(proj, view), overview = API.stage === 'hero' || API.stage === 'over' || API.stage === 'plan';
    for (const l of LABELS) {
      const on = API.stage === l.k, show = on || overview;
      const q = M4.xform(vp, l.p);
      if (!show || q[3] <= 0) { l.el.style.opacity = 0; continue; }
      const x = (q[0] / q[3] * 0.5 + 0.5) * W, y = (1 - (q[1] / q[3] * 0.5 + 0.5)) * H;
      l.el.style.opacity = 1; l.el.style.transform = `translate(${x | 0}px,${y | 0}px)`; l.el.classList.toggle('on', on);
    }
    requestAnimationFrame(tick);
  }

  // ================================================================== input
  let lx = 0, ly = 0, moved = 0;
  canvas.addEventListener('pointerdown', e => { dragging = true; moved = 0; lx = e.clientX; ly = e.clientY; canvas.classList.add('dragging'); canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => {
    if (!dragging) return;
    const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
    orbitYaw -= dx * 0.005; orbitPitch = clamp(orbitPitch + dy * 0.004, -0.15, 0.8);
  });
  const up = () => { if (!dragging) return; dragging = false; canvas.classList.remove('dragging'); if (moved < 6) surge = 1; };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  addEventListener('pointermove', e => { if (e.pointerType !== 'mouse' || reduce) return; tParX = (e.clientX / innerWidth - 0.5) * -0.07; tParY = (e.clientY / innerHeight - 0.5) * 0.035; }, { passive: true });
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); document.body.classList.add('nogl'); });

  API.surge = () => { surge = 1; };
  API.setStage = name => { if (KEYS[name]) { key = KEYS[name]; API.stage = name; } };
  API.isNight = name => (KEYS[name] || {}).tod > 0.5;
  requestAnimationFrame(tick);
})();
