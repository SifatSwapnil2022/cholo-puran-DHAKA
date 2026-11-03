#!/usr/bin/env node
// Downloads the OpenStreetMap data for Old Dhaka that tools/build-city.mjs turns into data/city.bin.
//   node tools/osm-fetch.mjs <outdir>     → <outdir>/osm.json and <outdir>/water.json
// Data © OpenStreetMap contributors, available under the Open Database Licence (ODbL).
import fs from 'node:fs/promises';
const out = process.argv[2] || 'osm-out';
const UA = 'CholoPuranDhaka/1.0 (https://github.com/SifatSwapnil2022/cholo-puran-DHAKA)';
const CITY = '23.695,90.375,23.735,90.435', WIDE = '23.680,90.355,23.745,90.455';
const QUERIES = {
  'osm.json': `[out:json][timeout:240];(way["building"](${CITY});relation["building"](${CITY});way["highway"](${CITY});way["waterway"](${CITY});way["natural"="water"](${CITY});way["leisure"](${CITY});way["landuse"](${CITY});way["natural"="wood"](${CITY}););out geom;`,
  'water.json': `[out:json][timeout:180];(relation["natural"="water"](${WIDE});relation["waterway"="riverbank"](${WIDE});way["natural"="water"]["water"="river"](${WIDE}););out geom;`,
};
const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
await fs.mkdir(out, { recursive: true });
for (const [file, q] of Object.entries(QUERIES)) {
  let ok = false;
  for (const ep of ENDPOINTS) {
    try {
      const r = await fetch(ep, { method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q) });
      const t = await r.text();
      if (r.ok && t.startsWith('{')) { await fs.writeFile(`${out}/${file}`, t); console.log(file, (t.length / 1e6).toFixed(1), 'MB from', ep); ok = true; break; }
      console.log(ep, r.status);
    } catch (e) { console.log(ep, e.message); }
  }
  if (!ok) { console.error('could not fetch', file); process.exit(1); }
}
