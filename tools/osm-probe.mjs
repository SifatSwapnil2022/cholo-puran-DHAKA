// Water bodies stored as relations (the Buriganga) for Old Dhaka, with member geometry.
import fs from 'node:fs/promises';
const BBOX = "23.680,90.355,23.745,90.455";
const UA = 'CholoPuranDhaka/1.0 (https://github.com/SifatSwapnil2022/cholo-puran-DHAKA)';
const Q = `[out:json][timeout:180];(relation["natural"="water"](${BBOX});relation["waterway"="riverbank"](${BBOX});way["natural"="water"]["water"="river"](${BBOX});way["waterway"="river"](${BBOX});relation["landuse"](${BBOX});relation["leisure"="park"](${BBOX}););out geom;`;
await fs.mkdir('out', { recursive: true });
let j;
for (const ep of ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']) {
  try { const r = await fetch(ep, { method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(Q) });
    const t = await r.text(); console.log(ep, r.status, t.length); if (r.ok && t.startsWith('{')) { j = JSON.parse(t); break; } } catch (e) { console.log(ep, 'ERR', e.message); }
}
if (!j) process.exit(1);
await fs.writeFile('out/water.json', JSON.stringify(j));
for (const e of j.elements) console.log(e.type, e.id, JSON.stringify(e.tags).slice(0, 140), e.members ? e.members.length + ' members' : (e.geometry || []).length + ' pts');
