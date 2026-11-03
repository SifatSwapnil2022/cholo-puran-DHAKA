// Pull buildings, roads and water for Old Dhaka from OpenStreetMap (Overpass) and summarise what's there.
import fs from 'node:fs/promises';
const BBOX = '23.695,90.375,23.735,90.435';
const UA = 'CholoPuranDhaka/1.0 (https://github.com/SifatSwapnil2022/cholo-puran-DHAKA)';
const Q = `[out:json][timeout:180];(way["building"](${BBOX});relation["building"](${BBOX});way["highway"](${BBOX});way["waterway"](${BBOX});way["natural"="water"](${BBOX});way["leisure"="park"](${BBOX});way["landuse"](${BBOX}););out tags geom;`;
await fs.mkdir('out', { recursive: true });
let j;
for (const ep of ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter']) {
  try {
    const r = await fetch(ep, { method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(Q) });
    const t = await r.text(); console.log(ep, r.status, t.length);
    if (r.ok && t.startsWith('{')) { j = JSON.parse(t); break; }
  } catch (e) { console.log(ep, 'ERR', e.message); }
}
if (!j) process.exit(1);
await fs.writeFile('out/osm.json', JSON.stringify(j));
const els = j.elements, B = els.filter(e => e.tags?.building), H = els.filter(e => e.tags?.highway);
const count = (arr, k) => { const m = {}; for (const e of arr) { const v = e.tags[k]; if (v != null) m[v] = (m[v] || 0) + 1; } return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 25); };
const has = (arr, k) => arr.filter(e => e.tags[k] != null).length;
const sum = {
  buildings: B.length, withLevels: has(B, 'building:levels'), withHeight: has(B, 'height'), withName: has(B, 'name'),
  levels: count(B, 'building:levels'), types: count(B, 'building'), roofColour: has(B, 'roof:colour'), colour: has(B, 'building:colour'), material: count(B, 'building:material'),
  roads: H.length, highway: count(H, 'highway'), withWidth: has(H, 'width'), lanes: has(H, 'lanes'),
  water: els.filter(e => e.tags?.waterway || e.tags?.natural === 'water').length, landuse: count(els.filter(e => e.tags?.landuse), 'landuse'),
};
// coverage grid: buildings per ~250 m cell, to see holes
const grid = {}; for (const b of B) { const g = b.geometry?.[0]; if (!g) continue; const k = `${Math.floor((g.lat - 23.695) / 0.00225)},${Math.floor((g.lon - 90.375) / 0.00245)}`; grid[k] = (grid[k] || 0) + 1; }
sum.grid = []; for (let r = 17; r >= 0; r--) { let row = ''; for (let c = 0; c < 25; c++) { const n = grid[`${r},${c}`] || 0; row += n === 0 ? ' .' : n < 20 ? ' -' : n < 80 ? ' o' : ' #'; } sum.grid.push(row); }
await fs.writeFile('out/summary.json', JSON.stringify(sum, null, 1));
console.log(JSON.stringify(sum, null, 1));
