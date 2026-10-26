#!/usr/bin/env node
// Photos from Wikimedia Commons.
//   node tools/commons.mjs candidates   search Commons for each place without a pick; thumbnails + candidates.json into out/
//   node tools/commons.mjs fetch        download each pick in tools/photo-picks.json, check its licence, write img/ + photos.json into out/
// Only free licences are accepted: CC BY, CC BY-SA, CC0, public domain. Nothing NC or ND.

import fs from 'node:fs/promises';

const API = 'https://commons.wikimedia.org/w/api.php';
const UA = 'CholoPuranDhaka/1.0 (https://github.com/SifatSwapnil2022/cholo-puran-DHAKA)';
const root = new URL('../', import.meta.url);
const OUT = new URL('out/', root);
const data = JSON.parse(await fs.readFile(new URL('places.json', root), 'utf8'));
const picks = JSON.parse(await fs.readFile(new URL('tools/photo-picks.json', root), 'utf8').catch(() => '{}'));

const sleep = ms => new Promise(r => setTimeout(r, ms));
export const freeLicence = l => /^(CC[ -]BY(-SA)?[ -]\d|CC0|Public domain|PD\b)/i.test(l || '') && !/\b(NC|ND)\b/i.test(l || '');
const plain = h => (h || '').replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

async function get(params, tries = 4) {
  const u = new URL(API);
  for (const [k, v] of Object.entries({ action: 'query', format: 'json', formatversion: 2, origin: '*', ...params })) u.searchParams.set(k, v);
  for (let i = 0; ; i++) {
    const r = await fetch(u, { headers: { 'User-Agent': UA, 'Api-User-Agent': UA } });
    const body = await r.text();
    if (r.ok && body.trimStart().startsWith('{')) return JSON.parse(body);
    console.log('API', r.status, r.headers.get('content-type'), body.replace(/\s+/g, ' ').slice(0, 600));
    if (i >= tries) throw new Error(`${r.status} ${u}`);
    await sleep(1500 * (i + 1));
  }
}

async function download(url, file) {
  for (let i = 0; i < 4; i++) {
    const r = await fetch(url, { headers: { 'User-Agent': UA } });
    if (r.ok) { await fs.writeFile(file, Buffer.from(await r.arrayBuffer())); return true; }
    await sleep(2000 * (i + 1));
  }
  return false;
}

const INFO = { prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata|user', iiextmetadatafilter: 'Artist|LicenseShortName|LicenseUrl|Restrictions|DateTimeOriginal|ImageDescription' };

function describe(pg) {
  const ii = pg.imageinfo?.[0]; if (!ii) return null;
  const m = ii.extmetadata || {};
  return {
    file: pg.title, page: ii.descriptionurl, thumb: ii.thumburl, w: ii.thumbwidth, h: ii.thumbheight, ow: ii.width, oh: ii.height, mime: ii.mime,
    author: plain(m.Artist?.value) || ii.user, licence: plain(m.LicenseShortName?.value), licenceUrl: m.LicenseUrl?.value || '',
    restrictions: plain(m.Restrictions?.value), date: plain(m.DateTimeOriginal?.value).slice(0, 10), desc: plain(m.ImageDescription?.value).slice(0, 160)
  };
}

const usable = d => d && /jpeg|png|webp/.test(d.mime) && d.ow >= 640 && freeLicence(d.licence);

async function candidates() {
  await fs.mkdir(new URL('cand/', OUT), { recursive: true });
  const all = {};
  for (const p of data.places) {
    if (picks[p.slug]) continue;
    try { await one(p); } catch (e) { console.log('FAIL', p.slug, e.message); }
  }
  await fs.writeFile(new URL('candidates.json', OUT), JSON.stringify(all, null, 1));
  async function one(p) {
    const en = p.name.en || p.name;
    const names = [...new Set([en, en.replace(/\s*\(.*\)/, ''), (en.match(/\((.*)\)/) || [])[1]].filter(Boolean))];
    const found = new Map();
    for (const n of names) {
      for (const q of [`"${n}"`, `${n} Dhaka`]) {
        const j = await get({ generator: 'search', gsrnamespace: 6, gsrsearch: `${q} filetype:bitmap`, gsrlimit: 8, iiurlwidth: 360, ...INFO });
        for (const pg of (j.query?.pages || []).sort((a, b) => a.index - b.index)) { const d = describe(pg); if (usable(d) && !found.has(d.file)) found.set(d.file, { ...d, via: q }); }
        await sleep(150);
      }
    }
    const g = await get({ generator: 'geosearch', ggsnamespace: 6, ggscoord: `${p.lat}|${p.lng}`, ggsradius: 120, ggslimit: 10, iiurlwidth: 360, ...INFO });
    for (const pg of g.query?.pages || []) { const d = describe(pg); if (usable(d) && !found.has(d.file)) found.set(d.file, { ...d, via: 'nearby' }); }
    await sleep(150);
    const list = [...found.values()].slice(0, 10);
    for (const [i, d] of list.entries()) { d.n = i + 1; d.local = `cand/${p.slug}-${i + 1}.jpg`; await download(d.thumb, new URL(d.local, OUT)); await sleep(100); }
    all[p.slug] = list;
    console.log(p.slug, list.length);
  }
}

async function fetchPicks() {
  await fs.mkdir(new URL('img/', OUT), { recursive: true });
  const slugs = Object.keys(picks), photos = {}, bad = [];
  for (let i = 0; i < slugs.length; i += 40) {
    const part = slugs.slice(i, i + 40);
    const j = await get({ titles: part.map(s => picks[s]).join('|'), iiurlwidth: 960, ...INFO });
    const norm = Object.fromEntries((j.query?.normalized || []).map(n => [n.from, n.to]));
    const byTitle = Object.fromEntries((j.query?.pages || []).map(pg => [pg.title, pg]));
    for (const s of part) {
      const d = describe(byTitle[norm[picks[s]] || picks[s]] || {});
      if (!d) { bad.push(`${s}: ${picks[s]} not found`); continue; }
      if (!freeLicence(d.licence)) { bad.push(`${s}: licence "${d.licence}" is not free`); continue; }
      const ok = await download(d.thumb, new URL(`img/${s}.jpg`, OUT));
      if (!ok) { bad.push(`${s}: download failed`); continue; }
      photos[s] = { file: d.file.replace(/^File:/, ''), author: d.author, licence: d.licence, licenceUrl: d.licenceUrl, page: d.page, w: d.w, h: d.h };
      if (d.restrictions) photos[s].restrictions = d.restrictions;
      await sleep(150);
    }
  }
  await fs.writeFile(new URL('photos.json', OUT), JSON.stringify(photos, null, 1));
  console.log(`${Object.keys(photos).length} photos`); for (const b of bad) console.log('SKIP', b);
}

const mode = process.argv[2];
if (mode === 'probe') {
  for (const [name, u, h] of [
    ['api', `${API}?action=query&list=search&srsearch=Ahsan%20Manzil&srnamespace=6&format=json&srlimit=2`, { 'User-Agent': UA }],
    ['api-noUA', `${API}?action=query&list=search&srsearch=Ahsan%20Manzil&srnamespace=6&format=json&srlimit=2`, {}],
    ['rest', 'https://api.wikimedia.org/core/v1/commons/search/page?q=Ahsan%20Manzil&limit=2', { 'User-Agent': UA }],
    ['upload', 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Ahsan_Manzil_Dhaka.jpg/320px-Ahsan_Manzil_Dhaka.jpg', { 'User-Agent': UA }]]) {
    try { const r = await fetch(u, { headers: h }); const b = await r.text(); console.log(name, r.status, r.headers.get('content-type'), b.replace(/\s+/g, ' ').slice(0, 700)); }
    catch (e) { console.log(name, 'ERR', e.message); }
  }
} else if (mode === 'candidates') await candidates();
else if (mode === 'fetch') await fetchPicks();
else { console.log('usage: node tools/commons.mjs candidates|fetch'); process.exit(1); }
