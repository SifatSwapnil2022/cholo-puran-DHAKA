#!/usr/bin/env node
// Builds data/city.bin from OpenStreetMap: real building footprints (with floors and material),
// streets and lanes, the Buriganga and ponds, and green spaces, in the app's local metres.
//
//   node tools/build-city.mjs <osm.json> <water.json>
//
// The two inputs come from tools/osm-fetch.mjs (Overpass). Data © OpenStreetMap contributors, ODbL.
// Floors that OSM doesn't have are estimated from the nearest buildings that do.

import fs from 'node:fs';

const [osmPath, waterPath] = process.argv.slice(2);
if (!osmPath || !waterPath) { console.error('usage: node tools/build-city.mjs <osm.json> <water.json>'); process.exit(1); }

const ORIGIN = { lat: 23.7085972, lng: 90.4060583 };
const MLAT = 110574, MLNG = 111320 * Math.cos(ORIGIN.lat * Math.PI / 180);
const W = (lat, lng) => [(lng - ORIGIN.lng) * MLNG, -(lat - ORIGIN.lat) * MLAT];
const Q = 0.25;                           // stored in quarter metres, Int16 → ±8 km
const [XMIN] = W(0, 90.374), [XMAX] = W(0, 90.436);
const ZMIN = W(23.731, 0)[1], ZMAX = W(23.689, 0)[1];
const inScene = ([x, z]) => x > XMIN && x < XMAX && z > ZMIN && z < ZMAX;

const osm = JSON.parse(fs.readFileSync(osmPath, 'utf8')).elements;
const water = JSON.parse(fs.readFileSync(waterPath, 'utf8')).elements;

/* ---------- geometry helpers ---------- */
const proj = g => g.map(p => W(p.lat, p.lon));
function area(r) { let a = 0; for (let i = 0, n = r.length; i < n; i++) { const [x0, z0] = r[i], [x1, z1] = r[(i + 1) % n]; a += x0 * z1 - x1 * z0; } return a / 2; }
function dp(pts, eps) {                   // Douglas–Peucker on an open polyline
  if (pts.length < 3) return pts;
  const [ax, az] = pts[0], [bx, bz] = pts[pts.length - 1]; let md = 0, mi = 0;
  const vx = bx - ax, vz = bz - az, L2 = vx * vx + vz * vz || 1e-9;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, pz] = pts[i]; const t = Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / L2));
    const d = Math.hypot(px - ax - t * vx, pz - az - t * vz); if (d > md) { md = d; mi = i; }
  }
  if (md <= eps) return [pts[0], pts[pts.length - 1]];
  return [...dp(pts.slice(0, mi + 1), eps).slice(0, -1), ...dp(pts.slice(mi), eps)];
}
function cleanRing(r, eps) {
  r = r.filter((p, i) => i === 0 || Math.hypot(p[0] - r[i - 1][0], p[1] - r[i - 1][1]) > 0.05);
  if (r.length > 1 && Math.hypot(r[0][0] - r.at(-1)[0], r[0][1] - r.at(-1)[1]) < 0.05) r.pop();
  if (r.length < 3) return null;
  // simplify as a closed ring: split at the vertex farthest from the first
  let fi = 0, fd = 0; for (let i = 1; i < r.length; i++) { const d = Math.hypot(r[i][0] - r[0][0], r[i][1] - r[0][1]); if (d > fd) { fd = d; fi = i; } }
  const a = dp(r.slice(0, fi + 1), eps), b = dp([...r.slice(fi), r[0]], eps);
  const out = [...a.slice(0, -1), ...b.slice(0, -1)];
  if (out.length < 3) return null;
  if (area(out) < 0) out.reverse();        // counter-clockwise in (x, z)
  return out;
}
function stitch(members) {                 // join outer member ways into closed rings
  const segs = members.filter(m => m.type === 'way' && (m.role === 'outer' || m.role === '') && m.geometry).map(m => proj(m.geometry));
  const rings = [];
  while (segs.length) {
    let ring = segs.shift();
    for (let guard = 0; guard < 5000; guard++) {
      const end = ring.at(-1); if (Math.hypot(end[0] - ring[0][0], end[1] - ring[0][1]) < 0.5 && ring.length > 3) break;
      const i = segs.findIndex(s => Math.hypot(s[0][0] - end[0], s[0][1] - end[1]) < 0.5 || Math.hypot(s.at(-1)[0] - end[0], s.at(-1)[1] - end[1]) < 0.5);
      if (i < 0) break;
      let s = segs.splice(i, 1)[0]; if (Math.hypot(s[0][0] - end[0], s[0][1] - end[1]) >= 0.5) s = s.reverse();
      ring = ring.concat(s.slice(1));
    }
    rings.push(ring);
  }
  return rings;
}
const rng = seed => { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };

/* ---------- buildings ---------- */
const MAT = { plaster: 1, brick: 2, tin: 3, concrete: 4 };
const matOf = v => { v = (v || '').toLowerCase(); if (/tin/.test(v)) return 3; if (/brick/.test(v)) return 2; if (/concrete|rcc|cement/.test(v)) return 4; if (/plaster|masonry|mesonry/.test(v)) return 1; return 0; };
const KIND = { construction: 1, mosque: 2, temple: 2, church: 2, school: 3, university: 3, college: 3, hospital: 3, government: 3, public: 3, shed: 4, garage: 4, industrial: 5, warehouse: 5, commercial: 6, retail: 6 };
const B = [];
for (const e of osm) {
  const t = e.tags || {}; if (!t.building || t.building === 'no' || t.building === 'roof') continue;
  const rings = e.type === 'way' ? (e.geometry ? [proj(e.geometry)] : []) : e.members ? stitch(e.members) : [];
  for (const raw of rings) {
    const r = cleanRing(raw, 0.35); if (!r) continue;
    const a = area(r); if (a < 7 || a > 60000) continue;
    const c = r.reduce((s, p) => [s[0] + p[0] / r.length, s[1] + p[1] / r.length], [0, 0]);
    if (!inScene(c)) continue;
    let lv = parseInt(t['building:levels'], 10); if (!(lv >= 1)) lv = 0; lv = Math.min(lv, 24);
    if (!lv && t.height) { const h = parseFloat(t.height); if (h > 0) lv = Math.max(1, Math.round(h / 3.2)); }
    B.push({ r: r.length > 60 ? cleanRing(r, 0.9) || r : r, a, c, lv, known: lv > 0, mat: matOf(t['building:material']), kind: KIND[t.building] || 0, id: e.id });
  }
}
// estimate missing floors from the nearest known buildings (median of up to 8 within 90 m)
const G = 60, grid = new Map(); const gk = (x, z) => `${Math.floor(x / G)},${Math.floor(z / G)}`;
for (const b of B) if (b.known) { const k = gk(...b.c); (grid.get(k) || grid.set(k, []).get(k)).push(b); }
let est = 0;
for (const b of B) {
  if (b.known) continue;
  const r = rng(b.id % 2147483647), [cx, cz] = b.c, near = [];
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (const o of grid.get(`${Math.floor(cx / G) + dx},${Math.floor(cz / G) + dz}`) || []) { const d = Math.hypot(o.c[0] - cx, o.c[1] - cz); if (d < 90) near.push([d, o.lv]); }
  near.sort((p, q) => p[0] - q[0]);
  let lv;
  if (near.length >= 2) { const v = near.slice(0, 8).map(n => n[1]).sort((p, q) => p - q); lv = v[Math.floor(v.length / 2)] + Math.round((r() - 0.5) * 2.2); }
  else lv = [2, 3, 3, 4, 4, 5, 5, 6][Math.floor(r() * 8)];
  if (b.mat === 3 || b.kind === 4) lv = 1;
  if (b.a < 25) lv = Math.min(lv, 2); else if (b.a < 50) lv = Math.min(lv, 4);
  b.lv = Math.max(1, Math.min(lv, 12)); est++;
}
// unknown material: mostly plastered concrete, some bare concrete and old brick
for (const b of B) if (!b.mat) { const r = rng((b.id * 7) % 2147483647)(); b.mat = b.lv === 1 && b.a < 60 && r < 0.45 ? 3 : r < 0.72 ? 1 : r < 0.88 ? 4 : 2; }

/* ---------- streets ---------- */
const HW = { trunk: [1, 16], primary: [1, 14], secondary: [2, 11], tertiary: [2, 9], unclassified: [3, 6], residential: [3, 6], living_street: [4, 4], service: [4, 4],
  pedestrian: [5, 4], footway: [5, 2.2], path: [5, 1.8], steps: [5, 2], trunk_link: [1, 10], primary_link: [1, 9], secondary_link: [2, 8], tertiary_link: [2, 7], track: [4, 3] };
const R = [];
for (const e of osm) {
  const t = e.tags || {}; const h = HW[t.highway]; if (!h || !e.geometry || t.area === 'yes') continue;
  let pts = dp(proj(e.geometry), 0.6); if (!pts.some(inScene)) continue;
  let w = parseFloat(t.width); w = w > 1 && w < 30 ? w : h[1];
  R.push({ cls: h[0] | (t.bridge && t.bridge !== 'no' ? 64 : 0) | (t.tunnel && t.tunnel !== 'no' ? 128 : 0), w, pts, name: t.name || t['name:en'] || '' });
}

/* ---------- water and green ---------- */
const WP = [];
const river = water.find(e => e.type === 'relation' && e.id === 5347205);
for (const r of stitch(river.members)) { const c = cleanRing(r, 1.5); if (c && Math.abs(area(c)) > 1e4) WP.push({ kind: 1, r: c }); }
for (const e of water) if (e.type === 'way' && e.tags?.natural === 'water' && e.geometry) { const c = cleanRing(proj(e.geometry), 1.5); if (c && area(c) > 2e3) WP.push({ kind: 1, r: c }); }
for (const e of osm) {
  const t = e.tags || {}; if (!e.geometry || t.building) continue;
  const isWater = t.natural === 'water' || t.waterway === 'riverbank' || t.landuse === 'reservoir' || t.landuse === 'basin';
  const isGreen = ['grass', 'forest', 'recreation_ground', 'cemetery', 'village_green', 'meadow', 'flowerbed', 'greenfield'].includes(t.landuse) || t.leisure === 'park' || t.leisure === 'garden' || t.leisure === 'pitch' || t.natural === 'wood' || t.natural === 'scrub';
  if (!isWater && !isGreen) continue;
  const c = cleanRing(proj(e.geometry), 0.6); if (!c || !inScene(c[0]) || Math.abs(area(c)) < 30) continue;
  WP.push({ kind: isWater ? 2 : t.leisure === 'pitch' ? 4 : 3, r: c });
}

/* ---------- river banks as functions of x (for boats, launches and roads) ---------- */
const mainRiver = WP.filter(w => w.kind === 1).sort((a, b) => Math.abs(area(b.r)) - Math.abs(area(a.r)))[0].r;
const BX0 = Math.floor(XMIN / 25) * 25, BX1 = Math.ceil(XMAX / 25) * 25, bankN = [], bankS = [];
let prevN = W(23.7083, 90.4040)[1];
for (let x = BX0; x <= BX1; x += 25) {
  const hits = [];
  for (let i = 0, n = mainRiver.length; i < n; i++) { const [x0, z0] = mainRiver[i], [x1, z1] = mainRiver[(i + 1) % n]; if ((x0 <= x) !== (x1 <= x)) hits.push(z0 + (z1 - z0) * (x - x0) / (x1 - x0)); }
  hits.sort((a, b) => a - b);
  let best = null;
  for (let i = 0; i + 1 < hits.length; i += 2) { const w = hits[i + 1] - hits[i]; if (w > 60 && (!best || Math.abs(hits[i] - prevN) < Math.abs(best[0] - prevN))) best = [hits[i], hits[i + 1]]; }
  if (best) prevN = best[0];
  bankN.push(best ? best[0] : NaN); bankS.push(best ? best[1] : NaN);
}
const fill = a => { for (let i = 0; i < a.length; i++) if (isNaN(a[i])) { let j = i; while (j < a.length && isNaN(a[j])) j++; const L = i > 0 ? a[i - 1] : a[j], Rv = j < a.length ? a[j] : a[i - 1]; for (let k = i; k < j; k++) a[k] = L + (Rv - L) * (k - i + 1) / (j - i + 1); i = j; } };
fill(bankN); fill(bankS);

/* ---------- drop buildings standing in the river ---------- */
function inRing(x, z, r) { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, zi] = r[i], [xj, zj] = r[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; }
const kept = B.filter(b => !inRing(b.c[0], b.c[1], mainRiver));

/* ---------- pack ---------- */
const q = v => Math.max(-32767, Math.min(32767, Math.round(v / Q)));
const polys = [], meta = [];
const pushPolys = (list, getRing) => { let n = 0; for (const it of list) { const r = getRing(it); if (r.length > 255) continue; polys.push(r); n++; } return n; };
let coordN = 0;
const bl = kept.filter(b => b.r.length <= 255); bl.forEach(b => coordN += b.r.length);
const rl = R.filter(r => r.pts.length <= 255); rl.forEach(r => coordN += r.pts.length);
const wl = []; for (const w of WP) { const r = w.r.length > 4000 ? null : w.r; if (r) { wl.push(w); coordN += r.length; } }
const bigRing = WP.filter(w => w.r.length > 4000); // the river may exceed one record: store separately as Uint16 counts
bigRing.forEach(w => coordN += w.r.length);
const coords = new Int16Array(coordN * 2); let ci = 0;
const put = r => { for (const [x, z] of r) { coords[ci++] = q(x); coords[ci++] = q(z); } };
const bN = new Uint8Array(bl.length), bLv = new Uint8Array(bl.length), bMat = new Uint8Array(bl.length), bKind = new Uint8Array(bl.length);
bl.forEach((b, i) => { bN[i] = b.r.length; bLv[i] = b.lv | (b.known ? 128 : 0); bMat[i] = b.mat; bKind[i] = b.kind; put(b.r); });
const rN = new Uint8Array(rl.length), rCls = new Uint8Array(rl.length), rW = new Uint8Array(rl.length);
rl.forEach((r, i) => { rN[i] = r.pts.length; rCls[i] = r.cls; rW[i] = Math.round(r.w * 4); put(r.pts); });
const all = [...wl, ...bigRing];
const wN = new Uint32Array(all.length), wK = new Uint8Array(all.length);
all.forEach((w, i) => { wN[i] = w.r.length; wK[i] = w.kind; put(w.r); });
const banks = new Int16Array([...bankN, ...bankS].map(q));

const parts = { coords, bN, bLv, bMat, bKind, rN, rCls, rW, wN, wK, banks };
const head = { v: 1, q: Q, bankX0: BX0, bankStep: 25, bankLen: bankN.length, counts: { b: bl.length, r: rl.length, w: all.length }, parts: {}, credit: '© OpenStreetMap contributors (ODbL)' };
let off = 0; for (const [k, a] of Object.entries(parts)) { off = Math.ceil(off / 4) * 4; head.parts[k] = [off, a.length, a.constructor.name]; off += a.byteLength; }
const hj = Buffer.from(JSON.stringify(head)); const hl = Math.ceil((hj.length + 4) / 4) * 4;
const buf = Buffer.alloc(hl + off); buf.writeUInt32LE(hj.length, 0); hj.copy(buf, 4);
for (const [k, a] of Object.entries(parts)) Buffer.from(a.buffer, a.byteOffset, a.byteLength).copy(buf, hl + head.parts[k][0]);
fs.mkdirSync(new URL('../data/', import.meta.url), { recursive: true });
fs.writeFileSync(new URL('../data/city.bin', import.meta.url), buf);
const lvH = {}; for (const b of bl) lvH[b.lv] = (lvH[b.lv] || 0) + 1;
console.log(`buildings ${bl.length} (floors from OSM ${bl.filter(b => b.known).length}, estimated ${est}), streets ${rl.length}, water/green ${all.length}, coords ${coordN}, ${(buf.length / 1024 / 1024).toFixed(2)} MB`);
console.log('floors', JSON.stringify(lvH), 'materials', JSON.stringify(Object.fromEntries(Object.entries(MAT).map(([k, v]) => [k, bl.filter(b => b.mat === v).length]))));
