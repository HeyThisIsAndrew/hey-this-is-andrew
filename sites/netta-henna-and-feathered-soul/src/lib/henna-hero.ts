/**
 * henna-hero.ts
 * Builds the hero henna frame around Netta's round logo, at build time. Original
 * SVG in her gold (#a8821d / #c59b27) and teal (#0e7c7b / #1a999d), in the same
 * vocabulary as the border strip: kangura scallops, ogee petals, paisleys, lotus
 * flowers, small mandala rosettes, beaded dots.
 *
 * Coordinates: the logo centre is (0, 0) and the logo radius is 100 units.
 *   halo  a full mandala ring from r = 106 to r = 151 around the logo
 *   arm   one henna vine drawing outward to the left, from x = -150 to x = -790,
 *         kept within |y| <= 84 so it never reaches the nav, titles or buttons.
 *         The right arm is the same group mirrored with <use>.
 *
 * Every motif is one group with one draw-in delay (centre first, then outward),
 * and every path has pathLength = 1, exactly like the border strip (henna.css).
 */

export const GOLD_DARK = '#a8821d';
export const GOLD_BRIGHT = '#c59b27';
export const TEAL_DEEP = '#0e7c7b';
export const TEAL_BRIGHT = '#1a999d';

export interface HeroPath { d: string; stroke: string; width: number }
export interface HeroGroup { delay: number; paths: HeroPath[] }
export interface HeroDot { cx: number; cy: number; radius: number; fill: string }
export interface HeroDotGroup { td: number; radius: number; dots: HeroDot[] }

const r2 = (n: number) => Math.round(n * 100) / 100;
const P = (x: number, y: number) => `${r2(x)} ${r2(y)}`;

type Pt = [number, number];
/** Affine transform for a motif drawn in its own local coordinates. */
function makeT(cx: number, cy: number, scale: number, rot = 0, flipX = 1, flipY = 1) {
  const c = Math.cos(rot), s = Math.sin(rot);
  return ([x, y]: Pt): Pt => {
    const lx = x * scale * flipX, ly = y * scale * flipY;
    return [cx + lx * c - ly * s, cy + lx * s + ly * c];
  };
}

/** Local path mini-language: M/L/Q/C commands with local points, mapped through T. */
function tp(T: (p: Pt) => Pt, cmds: (string | Pt)[]): string {
  return cmds.map((c) => (typeof c === 'string' ? c : P(...T(c)))).join(' ');
}

// ---------------------------------------------------------------- collectors
const halo: HeroGroup[] = [];
const arm: HeroGroup[] = [];
const haloDots: HeroDot[] = [];
const armDots: { u: number; dot: HeroDot }[] = [];

function group(list: HeroGroup[], delay: number) {
  const g: HeroGroup = { delay: r2(delay), paths: [] };
  list.push(g);
  return (d: string, stroke = GOLD_DARK, width = 1.1) => g.paths.push({ d, stroke, width });
}

/** Arm draw-in delay from the distance u (= -x) from the logo centre. */
const armDelay = (u: number) => 0.2 + ((u - 150) / 640) * 0.9;
function armDot(x: number, y: number, radius: number, fill: string) {
  armDots.push({ u: -x, dot: { cx: r2(x), cy: r2(y), radius: r2(radius), fill } });
}

// ---------------------------------------------------------------- halo
{
  const ring = group(halo, 0);
  ring(`M 106 0 A 106 106 0 1 1 -106 0 A 106 106 0 1 1 106 0`, GOLD_DARK, 1.25);
  ring(`M 111 0 A 111 111 0 1 1 -111 0 A 111 111 0 1 1 111 0`, TEAL_DEEP, 0.75);

  const sc = group(halo, 0.06);
  const n = 36;
  let d = `M ${P(111, 0)}`;
  for (let i = 0; i < n; i++) {
    const am = ((i + 0.5) / n) * Math.PI * 2;
    const a2 = ((i + 1) / n) * Math.PI * 2;
    d += ` Q ${P(Math.cos(am) * 119, Math.sin(am) * 119)} ${P(Math.cos(a2) * 111, Math.sin(a2) * 111)}`;
    haloDots.push({ cx: r2(Math.cos(am) * 123.5), cy: r2(Math.sin(am) * 123.5), radius: 1.2, fill: i % 2 ? TEAL_BRIGHT : GOLD_BRIGHT });
  }
  sc(d, GOLD_BRIGHT, 0.85);

  const pet = group(halo, 0.12);
  const np = 18;
  for (let i = 0; i < np; i++) {
    const a0 = (i / np) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((i + 1) / np) * Math.PI * 2 - Math.PI / 2;
    const am = (a0 + a1) / 2;
    const at = (a: number, rr: number): string => P(Math.cos(a) * rr, Math.sin(a) * rr);
    // Ogee petal from r = 127 to a tip at r = 147
    pet(`M ${at(a0 + 0.012, 127)} C ${at(a0 + 0.02, 138)} ${at(am - 0.07, 141)} ${at(am, 147)} C ${at(am + 0.07, 141)} ${at(a1 - 0.02, 138)} ${at(a1 - 0.012, 127)}`, GOLD_DARK, 1.0);
    pet(`M ${at(am - 0.09, 129)} Q ${at(am - 0.05, 138)} ${at(am, 142)} Q ${at(am + 0.05, 138)} ${at(am + 0.09, 129)}`, GOLD_BRIGHT, 0.65);
    haloDots.push({ cx: r2(Math.cos(am) * 133), cy: r2(Math.sin(am) * 133), radius: 1.35, fill: i % 2 ? GOLD_BRIGHT : TEAL_DEEP });
    haloDots.push({ cx: r2(Math.cos(am) * 151.5), cy: r2(Math.sin(am) * 151.5), radius: 1.6, fill: i % 2 ? TEAL_BRIGHT : GOLD_DARK });
  }
  const base = group(halo, 0.1);
  base(`M 127 0 A 127 127 0 1 1 -127 0 A 127 127 0 1 1 127 0`, GOLD_DARK, 0.8);
}

// ---------------------------------------------------------------- arm motifs
/** Vine height at distance u: a gentle henna wave that settles near the logo. */
const vineY = (u: number) => 9 * Math.sin((u - 150) / 52) * Math.min(1, (u - 150) / 60);

function vineSegment(u0: number, u1: number) {
  const add = group(arm, armDelay(u0));
  const pts: Pt[] = [];
  for (let u = u0; u <= u1 + 0.01; u += 10) pts.push([-u, vineY(u)]);
  // Catmull-Rom to cubic Bezier
  const toD = (off: number) => {
    const q = pts.map(([x, y]) => [x, y + off] as Pt);
    let d = `M ${P(...q[0])}`;
    for (let i = 0; i < q.length - 1; i++) {
      const p0 = q[Math.max(0, i - 1)], p1 = q[i], p2 = q[i + 1], p3 = q[Math.min(q.length - 1, i + 2)];
      const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C ${P(...c1)} ${P(...c2)} ${P(...p2)}`;
    }
    return d;
  };
  add(toD(0), GOLD_DARK, 1.25);
  add(toD(4.2), GOLD_BRIGHT, 0.65);
}

function leaf(u: number, up: boolean) {
  const add = group(arm, armDelay(u) + 0.05);
  const y0 = vineY(u);
  const s = up ? -1 : 1;
  const T = makeT(-u, y0, 1, 0, 1, s);
  // almond leaf leaning outward (toward -x) and away from the vine
  add(tp(T, ['M', [0, 0], 'Q', [-2, -11], [-13, -16], 'Q', [-8, -5], [0, 0]]), GOLD_DARK, 0.85);
  add(tp(T, ['M', [-1.5, -2], 'Q', [-5, -9], [-10.5, -13.2]]), GOLD_BRIGHT, 0.55);
}

/** Teardrop paisley, local units: belly round at the bottom, tip curling at top. */
function paisley(cx: number, cy: number, size: number, rot: number, flipY: 1 | -1, delay: number) {
  const add = group(arm, delay);
  const T = makeT(cx, cy, size, rot, 1, flipY);
  add(tp(T, ['M', [0, 1], 'C', [0.62, 1], [0.95, 0.55], [0.92, 0.05], 'C', [0.88, -0.62], [0.42, -1.12], [-0.05, -1.6],
    'C', [-0.22, -1.78], [-0.5, -1.62], [-0.38, -1.4], 'C', [-0.28, -1.24], [-0.08, -1.32], [-0.14, -1.47]]), GOLD_DARK, 1.2);
  add(tp(T, ['M', [-0.05, -1.6], 'C', [-0.5, -1.05], [-0.93, -0.6], [-0.92, 0.05], 'C', [-0.95, 0.55], [-0.62, 1], [0, 1]]), GOLD_DARK, 1.2);
  // inner contour
  add(tp(T, ['M', [0, 0.78], 'C', [0.45, 0.78], [0.7, 0.42], [0.68, 0.04], 'C', [0.64, -0.45], [0.3, -0.85], [-0.03, -1.2],
    'C', [-0.36, -0.82], [-0.7, -0.45], [-0.68, 0.04], 'C', [-0.7, 0.42], [-0.45, 0.78], [0, 0.78]]), GOLD_BRIGHT, 0.7);
  // seed floweret in the belly
  const [sx, sy] = T([0, 0.22]);
  const sr = 0.27 * size;
  add(`M ${P(sx - sr, sy)} A ${r2(sr)} ${r2(sr)} 0 1 0 ${P(sx + sr, sy)} A ${r2(sr)} ${r2(sr)} 0 1 0 ${P(sx - sr, sy)}`, GOLD_DARK, 0.8);
  // jaali ribs across the neck
  for (const yy of [-0.42, -0.7, -0.95]) {
    const w = 0.58 + yy * 0.32;
    add(tp(T, ['M', [-w, yy + 0.05], 'Q', [0, yy - 0.12], [w * 0.92, yy - 0.02]]), TEAL_DEEP, 0.6);
  }
  const push = (lp: Pt, radius: number, fill: string) => { const [x, y] = T(lp); armDot(x, y, radius, fill); };
  push([0, 0.22], 1.7, TEAL_DEEP);
  push([0, 1.32], 1.6, GOLD_DARK);
  push([0.42, 1.25], 1.1, TEAL_BRIGHT);
  push([-0.42, 1.25], 1.1, TEAL_BRIGHT);
  push([-0.62, -1.9], 1.3, GOLD_BRIGHT);
  push([-0.9, -2.15], 1.0, TEAL_BRIGHT);
}

/** Lotus pointing along +y in local units, rotated to point outward. */
function lotus(cx: number, cy: number, size: number, rot: number, delay: number) {
  const add = group(arm, delay);
  const T = makeT(cx, cy, size, rot);
  // cup
  add(tp(T, ['M', [-0.62, 0], 'Q', [0, 0.38], [0.62, 0]]), GOLD_DARK, 1.1);
  // central spear petal
  add(tp(T, ['M', [-0.2, 0.05], 'C', [-0.3, -0.5], [-0.12, -0.95], [0, -1.32], 'C', [0.12, -0.95], [0.3, -0.5], [0.2, 0.05]]), GOLD_DARK, 1.15);
  add(tp(T, ['M', [0, -0.08], 'L', [0, -1.0]]), TEAL_DEEP, 0.6);
  // side petals
  for (const s of [-1, 1]) {
    add(tp(T, ['M', [s * 0.18, 0.02], 'C', [s * 0.52, -0.22], [s * 0.78, -0.62], [s * 0.86, -1.02], 'C', [s * 0.58, -0.82], [s * 0.36, -0.52], [s * 0.14, -0.2]]), GOLD_DARK, 1.0);
    add(tp(T, ['M', [s * 0.44, -0.02], 'C', [s * 0.8, -0.08], [s * 1.12, -0.32], [s * 1.28, -0.62], 'C', [s * 0.98, -0.52], [s * 0.72, -0.34], [s * 0.5, -0.16]]), GOLD_BRIGHT, 0.85);
    const [px, py] = T([s * 0.92, -1.12]); armDot(px, py, 1.3, TEAL_BRIGHT);
    const [qx, qy] = T([s * 1.36, -0.7]); armDot(qx, qy, 1.1, GOLD_BRIGHT);
  }
  const [tx, ty] = T([0, -1.5]); armDot(tx, ty, 1.7, GOLD_DARK);
  const [bx, by] = T([0, 0.26]); armDot(bx, by, 1.5, TEAL_DEEP);
}

/** Small full mandala rosette centred on the vine. */
function rosette(cx: number, cy: number, R: number, delay: number) {
  const add = group(arm, delay);
  const circ = (rr: number) => `M ${P(cx + rr, cy)} A ${r2(rr)} ${r2(rr)} 0 1 1 ${P(cx - rr, cy)} A ${r2(rr)} ${r2(rr)} 0 1 1 ${P(cx + rr, cy)}`;
  add(circ(R * 0.22), GOLD_DARK, 1.0);
  add(circ(R * 0.34), TEAL_DEEP, 0.7);
  const n = 12;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2, am = (a0 + a1) / 2;
    const at = (a: number, rr: number) => P(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    add(`M ${at(a0, R * 0.36)} Q ${at(am - 0.06, R * 0.62)} ${at(am, R * 0.72)} Q ${at(am + 0.06, R * 0.62)} ${at(a1, R * 0.36)}`, GOLD_DARK, 0.95);
    armDot(cx + Math.cos(am) * R * 0.52, cy + Math.sin(am) * R * 0.52, 1.0, i % 2 ? GOLD_BRIGHT : TEAL_BRIGHT);
    armDot(cx + Math.cos(am) * R * 0.98, cy + Math.sin(am) * R * 0.98, 1.3, i % 2 ? TEAL_DEEP : GOLD_DARK);
  }
  let sc = `M ${P(cx + R * 0.76, cy)}`;
  const ns = 24;
  for (let i = 0; i < ns; i++) {
    const am = ((i + 0.5) / ns) * Math.PI * 2, a2 = ((i + 1) / ns) * Math.PI * 2;
    sc += ` Q ${P(cx + Math.cos(am) * R * 0.88, cy + Math.sin(am) * R * 0.88)} ${P(cx + Math.cos(a2) * R * 0.76, cy + Math.sin(a2) * R * 0.76)}`;
  }
  add(sc, GOLD_BRIGHT, 0.75);
  armDot(cx, cy, 2.2, TEAL_DEEP);
}

/** Hanging drop above or below a rosette: a fine stem, a teardrop and a bead. */
function drop(cx: number, cy: number, dir: 1 | -1, len: number, delay: number) {
  const add = group(arm, delay);
  add(`M ${P(cx, cy)} L ${P(cx, cy + dir * len)}`, GOLD_BRIGHT, 0.7);
  const ty = cy + dir * (len + 9);
  add(`M ${P(cx, cy + dir * len)} C ${P(cx + 5, cy + dir * (len + 3))} ${P(cx + 4.5, ty)} ${P(cx, ty)} C ${P(cx - 4.5, ty)} ${P(cx - 5, cy + dir * (len + 3))} ${P(cx, cy + dir * len)}`, GOLD_DARK, 0.9);
  armDot(cx, cy + dir * (len + 5), 1.2, TEAL_DEEP);
  armDot(cx, ty + dir * 4, 1.4, GOLD_DARK);
}

/** Spiral curl that ends the vine, with a graduated bead trail. */
function curl(u: number, delay: number) {
  const add = group(arm, delay);
  const x = -u, y = vineY(u);
  add(`M ${P(x, y)} C ${P(x - 14, y - 2)} ${P(x - 22, y - 14)} ${P(x - 14, y - 20)} C ${P(x - 7, y - 25)} ${P(x + 1, y - 16)} ${P(x - 6, y - 12)}`, GOLD_DARK, 1.1);
  armDot(x - 30, y - 4, 1.6, GOLD_DARK);
  armDot(x - 37, y + 1, 1.25, TEAL_BRIGHT);
  armDot(x - 43, y + 5, 0.95, GOLD_BRIGHT);
}

// ---------------------------------------------------------------- assemble the arm
for (let u = 150; u < 760; u += 80) vineSegment(u, Math.min(u + 80, 760));

const motifAt = [215, 300, 400, 490, 570, 655, 730];
for (let u = 166; u < 750; u += 26) {
  if (motifAt.some((m) => Math.abs(m - u) < 24)) continue;
  leaf(u, Math.round((u - 166) / 26) % 2 === 0);
}

// paisley pair framing the logo like wings
paisley(-226, vineY(226) - 27, 21, -0.95, 1, armDelay(215));
paisley(-226, vineY(226) + 27, 21, 0.95, -1, armDelay(215));
lotus(-306, vineY(306), 30, -Math.PI / 2, armDelay(300));
rosette(-400, vineY(400), 38, armDelay(400));
drop(-400, vineY(400) - 38, -1, 18, armDelay(400) + 0.1);
drop(-400, vineY(400) + 38, 1, 18, armDelay(400) + 0.1);
paisley(-492, vineY(492) - 23, 17, -0.95, 1, armDelay(490));
paisley(-492, vineY(492) + 23, 17, 0.95, -1, armDelay(490));
lotus(-566, vineY(566), 25, -Math.PI / 2, armDelay(570));
rosette(-655, vineY(655), 30, armDelay(655));
drop(-655, vineY(655) - 30, -1, 13, armDelay(655) + 0.1);
drop(-655, vineY(655) + 30, 1, 13, armDelay(655) + 0.1);
paisley(-722, vineY(722) - 18, 13, -0.95, 1, armDelay(730));
paisley(-722, vineY(722) + 18, 13, 0.95, -1, armDelay(730));
curl(760, armDelay(760));

// ---------------------------------------------------------------- dot groups
function byRadius(list: HeroDot[], td: number): HeroDotGroup[] {
  const m = new Map<number, HeroDot[]>();
  for (const d of list) { if (!m.has(d.radius)) m.set(d.radius, []); m.get(d.radius)!.push(d); }
  return [...m.entries()].map(([radius, dots]) => ({ td, radius, dots }));
}

export const HALO_GROUPS = halo;
export const ARM_GROUPS = arm;
export const HALO_DOT_GROUPS = byRadius(haloDots, 0);
/** Arm dots appear band by band, outward, as their motifs finish drawing. */
export const ARM_DOT_GROUPS: HeroDotGroup[] = [
  ...byRadius(armDots.filter((a) => a.u < 350).map((a) => a.dot), 0.3),
  ...byRadius(armDots.filter((a) => a.u >= 350 && a.u < 560).map((a) => a.dot), 0.6),
  ...byRadius(armDots.filter((a) => a.u >= 560).map((a) => a.dot), 0.9),
];
