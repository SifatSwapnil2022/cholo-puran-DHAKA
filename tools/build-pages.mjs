// Builds a plain web page for every place so search engines and link previews can read it,
// plus a list of all places, sitemap.xml and robots.txt. No dependencies.
//
//   node tools/build-pages.mjs
//
// Output: place/<slug>/index.html, place/index.html, sitemap.xml, robots.txt
// Each page links back into the 3D app at ../../#<slug>.

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(readFileSync(join(ROOT, 'places.json'), 'utf8'));
const SITE = (data.meta.siteUrl || '').replace(/\/?$/, '/');
if (!SITE.startsWith('https://')) throw new Error('meta.siteUrl must be the https address of the site');

const CAT = { heritage: ['Heritage', '#D2452B'], food: ['Food', '#E07F00'], 'hidden-gem': ['Hidden gem', '#6A3FD9'], 'photo-spot': ['Photo spot', '#E5317A'],
  market: ['Market', '#2E9A3E'], worship: ['Worship', '#0B7A57'], river: ['River', '#0E8FB0'], festival: ['Festival', '#E0263F'] };
const GOOD = { solo: 'Solo', friends: 'Friends', couples: 'Couples', 'family-elders': 'Family with elders', kids: 'Kids', photographers: 'Photographers', foodies: 'Food lovers' };
const KNOWN = ['', 'Famous', 'Well known', 'Known locally', 'Lesser-known', 'Hardly known'];
const WALK = { easy: 'Easy, mostly flat', moderate: 'Some crowds, uneven lanes', hard: 'Narrow, crowded or broken lanes' };
const DAY = { sat: 'Saturday', sun: 'Sunday', mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday' };
const MON = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const url = p => `${SITE}place/${p.slug}/`;
const og = slug => `${SITE}docs/og/${slug}.jpg`;
const dist = (a, b) => {
  const R = 6371000, r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
const walkMin = m => Math.max(2, Math.round(m * 1.35 / 75)); // road ≈ 1.35× straight line, 75 m a minute in the lanes
const priceBand = n => n ? '৳'.repeat(n) + '<span class="off">' + '৳'.repeat(3 - n) + '</span>' : '';

function hoursSpec(p) {
  // Only year-round hours go into structured data; seasonal ones stay in the text.
  return (p.open || []).filter(o => !o.m).map(o => {
    const [opens, closes] = o.t.split('-');
    return { '@type': 'OpeningHoursSpecification', dayOfWeek: o.d.split(',').map(d => `https://schema.org/${DAY[d]}`), opens, closes: closes === '24:00' ? '23:59' : closes };
  });
}

function jsonLd(p) {
  const food = p.categories[0] === 'food';
  const ld = {
    '@context': 'https://schema.org', '@type': food ? 'Restaurant' : 'TouristAttraction',
    name: p.name.en, alternateName: p.name.bn, description: p.whyGo, url: url(p), image: og(p.slug),
    geo: { '@type': 'GeoCoordinates', latitude: p.lat, longitude: p.lng },
    address: { '@type': 'PostalAddress', addressLocality: `${p.mahalla}, Old Dhaka`, addressRegion: 'Dhaka', addressCountry: 'BD' },
    isAccessibleForFree: !p.fees.length
  };
  const spec = hoursSpec(p); if (spec.length) ld.openingHoursSpecification = spec;
  if (food && p.priceBand) ld.priceRange = '৳'.repeat(p.priceBand);
  if (food && p.dishes?.length) ld.servesCuisine = 'Old Dhaka (Dhakaiya)';
  return JSON.stringify(ld).replace(/</g, '\\u003c');
}

const FONTS = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,600;12..96,800&family=Galada&family=Hind+Siliguri:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap';

const CSS = `
:root{--paper:#FFFCF6;--paper-2:#FFF2DC;--line:#ECDDC2;--ink:#1C1B3A;--ink-2:#4A4868;--ink-3:#6F6D8A;--green:#006A4E;--pink:#E5317A;--teal:#0E8FB0}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.6 'Bricolage Grotesque','Hind Siliguri',system-ui,sans-serif}
a{color:var(--teal);text-underline-offset:2px}
.bar{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--line);background:#fff}
.bar a.home{display:flex;align-items:center;gap:10px;color:var(--ink);text-decoration:none;font-weight:800;letter-spacing:-.01em}
.bar img{width:28px;height:28px}.bar .sp{flex:1}.bar a.all{font-weight:600;font-size:15px;margin-left:14px}
.era{margin:28px 0}.era h2{margin:6px 0}.era .yr{display:inline-block;padding:2px 10px;border-radius:99px;background:var(--ec);color:#fff;font-size:13px;font-weight:800}
.tl{list-style:none;padding:0;margin:10px 0 0;border-left:3px solid var(--line)}.tl li{padding:8px 0 8px 16px}.tl b{color:var(--ec)}
.jump{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 10px}.jump a{padding:6px 12px;border-radius:99px;background:#fff;border:1px solid var(--line);font-weight:600;font-size:14px;text-decoration:none;color:var(--ink)}
.hero{background:var(--c);color:#FFFCF6;padding:34px 16px 30px}
.hero .in,main,footer .in{max-width:760px;margin:0 auto}
.bn{font-family:Galada,'Hind Siliguri',sans-serif;font-size:clamp(36px,8vw,56px);line-height:1.15}
h1{font-size:clamp(28px,6vw,42px);line-height:1.1;letter-spacing:-.025em;margin:.1em 0 .25em}
.tag{font-size:19px;font-weight:600;opacity:.93;margin:0}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}
.chips span{display:inline-flex;align-items:center;gap:7px;padding:4px 12px;border-radius:99px;background:rgba(255,252,246,.17);font-size:14px;font-weight:600}
.chips i{width:10px;height:10px;border-radius:3px;background:var(--cc);box-shadow:0 0 0 1.5px rgba(255,255,255,.7)}
.trim{height:14px;background:radial-gradient(circle at 10px 0,var(--c) 9px,transparent 9.5px) 0 0/20px 14px repeat-x}
main{padding:20px 16px 40px}
.cta{display:flex;flex-wrap:wrap;gap:10px;margin:6px 0 22px}
.btn{display:inline-flex;align-items:center;gap:8px;min-height:46px;padding:10px 18px;border-radius:12px;font-weight:700;text-decoration:none;border:2px solid var(--ink)}
.btn.p{background:var(--pink);border-color:var(--pink);color:#fff}.btn.s{color:var(--ink);background:#fff}
h2{font-size:21px;letter-spacing:-.01em;margin:28px 0 8px}
.facts{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--line);border:1px solid var(--line);border-radius:14px;overflow:hidden;margin:0}
.facts div{background:#fff;padding:12px 14px}.facts .w{grid-column:1/-1}
dt{font-size:13px;font-weight:700;color:var(--ink-3);text-transform:uppercase;letter-spacing:.04em}dd{margin:2px 0 0}
table{width:100%;border-collapse:collapse;background:#fff;border:1px solid var(--line);border-radius:12px;overflow:hidden}
td{padding:9px 12px;border-top:1px solid var(--line)}tr:first-child td{border-top:0}td:last-child{text-align:right;white-space:nowrap;font-weight:600}
.small{font-size:14px;color:var(--ink-2)}.off{opacity:.3}
ul{padding-left:20px}li{margin:3px 0}
.near{list-style:none;padding:0;display:grid;gap:8px}
.near a{display:flex;justify-content:space-between;gap:10px;padding:12px 14px;background:#fff;border:1px solid var(--line);border-radius:12px;color:var(--ink);text-decoration:none}
.near a span{color:var(--ink-3);white-space:nowrap}
.note{background:var(--paper-2);border-radius:12px;padding:12px 14px;font-size:15px}
footer{border-top:1px solid var(--line);padding:22px 16px 40px;font-size:14px;color:var(--ink-2)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;list-style:none;padding:0}
.grid a{display:block;height:100%;padding:12px 14px;background:#fff;border:1px solid var(--line);border-left:5px solid var(--cc);border-radius:12px;color:var(--ink);text-decoration:none}
.grid b{display:block}.grid small{color:var(--ink-3)}
@media (max-width:520px){.facts{grid-template-columns:1fr}}
`;

function shell({ title, desc, canonical, image, ld, body, color = '#006A4E', depth }) {
  const up = '../'.repeat(depth);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canonical}">
<meta name="theme-color" content="${color}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Cholo Puran Dhaka">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${up}docs/logo.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="${up}icons/apple-touch-icon.png">
<link rel="manifest" href="${up}manifest.webmanifest">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}">
<style>${CSS}</style>
${ld ? `<script type="application/ld+json">${ld}</script>` : ''}
</head>
<body style="--c:${color}">
<header class="bar"><a class="home" href="${up}"><img src="${up}docs/logo.svg" alt="">Cholo Puran Dhaka</a><span class="sp"></span><a class="all" href="${up}history/">History</a><a class="all" href="${up}place/">All places</a></header>
${body}
<footer><div class="in">Facts come from the sources listed above and were researched on ${esc(data.meta.researched)}. Hours and prices change, so check before you go. Spotted a mistake? <a href="https://github.com/SifatSwapnil2022/cholo-puran-DHAKA/issues/new/choose">Tell us</a>.</div></footer>
<script>if('serviceWorker' in navigator)navigator.serviceWorker.register('${up}sw.js').catch(()=>{})</script>
<script data-goatcounter="https://sifat2000.goatcounter.com/count" async src="//gc.zgo.at/count.js"></script>
</body>
</html>
`;
}

function mix(hex, t = 0.62) {
  const a = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)), b = [0x14, 0x14, 0x3A];
  return '#' + a.map((x, i) => Math.round(x * t + b[i] * (1 - t)).toString(16).padStart(2, '0')).join('');
}

function placePage(p) {
  const color = mix(CAT[p.categories[0]][1]);
  const chips = p.categories.map(c => `<span style="--cc:${CAT[c][1]}"><i></i>${CAT[c][0]}</span>`).join('');
  const fees = p.fees.length
    ? `<table>${p.fees.map(f => `<tr><td>${esc(f.who)}${f.note ? ` <span class="small">(${esc(f.note)})</span>` : ''}</td><td>৳${f.bdt}</td></tr>`).join('')}</table>${p.ticketing ? `<p class="small">${esc(p.ticketing)}</p>` : ''}`
    : '<p>Free to enter.</p>';
  const dishes = p.dishes?.length ? `<h2>What to order</h2><table>${p.dishes.map(d => `<tr><td>${esc(d.en)} <span class="small">· ${esc(d.bn)}</span></td><td>${esc(d.price || '')}</td></tr>`).join('')}</table>
    ${p.dishes.some(d => d.price) ? `<p class="small">Prices${p.priceYear ? ` from ${p.priceYear}` : ''}, from the sources below. They go up often.</p>` : ''}` : '';
  const access = p.access;
  const facilities = [access.seating && 'Seating', access.washroom && 'Washroom'].filter(Boolean).join(' · ') || 'No washroom listed';
  const near = data.places.filter(q => q !== p).map(q => ({ q, d: dist(p, q) })).sort((a, b) => a.d - b.d).slice(0, 4);
  const maps = `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;
  const body = `
<section class="hero"><div class="in">
  <div class="bn" lang="bn">${esc(p.name.bn)}</div>
  <h1>${esc(p.name.en)}</h1>
  <p class="tag">${esc(p.tagline)}</p>
  <div class="chips">${chips}<span>${esc(p.mahalla)}</span></div>
</div></section>
<div class="trim"></div>
<main>
  <div class="cta">
    <a class="btn p" href="../../#${p.slug}">Open on the 3D map</a>
    <a class="btn s" href="${maps}" rel="noopener">Directions</a>
  </div>
  <h2>Why go</h2>
  <p>${esc(p.whyGo)}</p>
  <dl class="facts">
    <div class="w"><dt>Hours</dt><dd>${esc(p.hours)}</dd></div>
    ${p.closed.length ? `<div class="w"><dt>Closed</dt><dd>${esc(p.closed.join(', '))}</dd></div>` : ''}
    <div><dt>Quiet times</dt><dd>${esc(p.quiet.join('; ') || '—')}</dd></div>
    <div><dt>Busy times</dt><dd>${esc(p.peak.join('; ') || '—')}</dd></div>
    <div><dt>Time to spend</dt><dd>${p.spend[0]}–${p.spend[1]} min</dd></div>
    <div><dt>How well known</dt><dd>${KNOWN[p.underrated]}</dd></div>
    ${p.priceBand ? `<div><dt>Price</dt><dd>${priceBand(p.priceBand)}</dd></div>` : ''}
    <div${p.priceBand ? '' : ' class="w"'}><dt>Good for</dt><dd>${p.goodFor.map(g => GOOD[g] || g).join(' · ')}</dd></div>
  </dl>
  ${p.categories[0] === 'food' && !p.fees.length ? '' : `<h2>Entry</h2>${fees}`}
  ${dishes}
  <h2>Getting there</h2>
  <dl class="facts">
    <div><dt>Walking</dt><dd>${WALK[access.walking] || esc(access.walking)}</dd></div>
    <div><dt>Facilities</dt><dd>${facilities}</dd></div>
    ${access.note ? `<div class="w"><dt>Tip</dt><dd>${esc(access.note)}</dd></div>` : ''}
  </dl>
  ${p.pin === 'approx' ? '<p class="note">The pin is placed by street and has not been confirmed at the entrance yet. Ask a shopkeeper for the last few metres.</p>' : ''}
  ${(() => {
    const fs = (data.culture?.festivals || []).filter(f => f.places?.includes(p.slug));
    const cs = (data.culture?.crafts || []).filter(c => c.places?.includes(p.slug));
    return (fs.length ? `<h2>Festivals here</h2><ul>${fs.map(f => `<li><b>${esc(f.name.en)}</b>, ${esc(f.when)}. ${esc(f.what)}</li>`).join('')}</ul>` : '')
      + (cs.length ? `<h2>Crafts to see</h2><ul>${cs.map(c => `<li><b>${esc(c.name.en)}.</b> ${esc(c.see)}</li>`).join('')}</ul>` : '');
  })()}
  ${p.history ? `<h2>History</h2><p>${esc(p.history)}</p>` : ''}
  ${p.photo?.tips ? `<h2>Photos</h2><p>${esc(p.photo.tips)}${p.photo.inside ? ` <span class="small">Inside: ${esc(p.photo.inside)}.</span>` : ''}</p>` : ''}
  <h2>Nearby</h2>
  <ul class="near">${near.map(({ q, d }) => `<li><a href="../${q.slug}/"><b>${esc(q.name.en)}</b><span>${walkMin(d)} min walk</span></a></li>`).join('')}</ul>
  <h2>Sources</h2>
  <ul class="small">${p.sources.map(s => `<li><a href="${esc(s.url)}" rel="noopener">${esc(s.label)}</a></li>`).join('')}</ul>
  ${p.checked ? `<p class="note">Checked on site ${esc(p.checked.date)}${p.checked.by ? ` by ${esc(p.checked.by)}` : ''}.</p>` : ''}
</main>`;
  const title = `${p.name.en} (${p.name.bn}) · Old Dhaka guide`;
  const desc = `${p.tagline}. ${p.whyGo}`.slice(0, 300);
  return shell({ title, desc, canonical: url(p), image: og(p.slug), ld: jsonLd(p), body, color, depth: 2 });
}

function listPage() {
  const groups = Object.keys(CAT).map(c => [c, data.places.filter(p => p.categories[0] === c)]).filter(([, l]) => l.length);
  const body = `
<section class="hero"><div class="in">
  <div class="bn" lang="bn">চলো পুরান ঢাকা</div>
  <h1>All places in Old Dhaka</h1>
  <p class="tag">${data.places.length} places: palaces, mosques, temples, markets and where to eat.</p>
</div></section>
<div class="trim"></div>
<main>
  <div class="cta"><a class="btn p" href="../">Open the 3D map</a></div>
  ${groups.map(([c, l]) => `<h2>${CAT[c][0]}</h2><ul class="grid">${l.sort((a, b) => a.name.en.localeCompare(b.name.en)).map(p =>
    `<li><a href="${p.slug}/" style="--cc:${CAT[c][1]}"><b>${esc(p.name.en)}</b><small>${esc(p.tagline)}</small></a></li>`).join('')}</ul>`).join('')}
</main>`;
  return shell({
    title: 'All places · Cholo Puran Dhaka', desc: `Every place in the Cholo Puran Dhaka guide to Old Dhaka: ${data.places.length} palaces, mosques, temples, markets and food spots, with hours, fees and tips.`,
    canonical: `${SITE}place/`, image: og('site'), body, depth: 1,
    ld: JSON.stringify({ '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: data.places.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: url(p), name: p.name.en })) })
  });
}

function historyPage() {
  const H = data.history, S = data.tips.sources;
  const src = keys => (keys || []).map(k => S[k]).filter(Boolean).map(x => `<a href="${esc(x.url)}" rel="noopener">${esc(x.label)}</a>`).join('; ');
  const pl = slugs => (slugs || []).map(sl => data.places.find(q => q.slug === sl)).filter(Boolean).map(q => `<a href="../place/${q.slug}/">${esc(q.name.en)}</a>`).join(', ');
  const body = `
<section class="hero"><div class="in">
  <div class="bn" lang="bn">${esc(H.title.bn)}</div>
  <h1>${esc(H.title.en)}</h1>
  <p class="tag">From Mughal capital to today's old city, with a source for every event.</p>
</div></section>
<div class="trim"></div>
<main>
  <div class="cta"><a class="btn p" href="../#history">Open in the 3D guide</a></div>
  <p>${esc(H.intro)}</p>
  <nav class="jump">${H.eras.map(e => `<a href="#${e.id}">${esc(e.years)}</a>`).join('')}</nav>
  ${H.eras.map(e => `<section class="era" id="${e.id}" style="--ec:${e.color}"><span class="yr">${esc(e.years)}</span><h2>${esc(e.title.en)} <span class="small" lang="bn">${esc(e.title.bn)}</span></h2><p>${esc(e.summary)}</p>
    <ol class="tl">${e.events.map(ev => `<li><b>${esc(ev.year)}</b> ${esc(ev.text)}${ev.places?.length ? ` <span class="small">See: ${pl(ev.places)}.</span>` : ''}${ev.src?.length ? ` <span class="small">Source: ${src(ev.src)}.</span>` : ''}</li>`).join('')}</ol></section>`).join('')}
  <p class="note">Events without a listed source come from the linked place page, which lists its own sources.</p>
</main>`;
  const ld = JSON.stringify({ '@context': 'https://schema.org', '@type': 'Article', headline: H.title.en, about: { '@type': 'Place', name: 'Old Dhaka', geo: { '@type': 'GeoCoordinates', latitude: 23.71, longitude: 90.405 } }, url: `${SITE}history/`, image: og('site'), dateModified: data.meta.updated, inLanguage: 'en' }).replace(/</g, '\\u003c');
  return shell({ title: 'History of Old Dhaka, 1608 to today · Cholo Puran Dhaka', desc: H.intro.slice(0, 290), canonical: `${SITE}history/`, image: og('site'), ld, body, depth: 1 });
}

const out = join(ROOT, 'place');
if (existsSync(out)) rmSync(out, { recursive: true });
for (const p of data.places) {
  mkdirSync(join(out, p.slug), { recursive: true });
  writeFileSync(join(out, p.slug, 'index.html'), placePage(p));
}
writeFileSync(join(out, 'index.html'), listPage());
if (data.history) { mkdirSync(join(ROOT, 'history'), { recursive: true }); writeFileSync(join(ROOT, 'history', 'index.html'), historyPage()); }

const today = data.meta.updated;
const urls = [[SITE, '1.0'], [`${SITE}place/`, '0.8'], ...(data.history ? [[`${SITE}history/`, '0.8']] : []), ...data.places.map(p => [url(p), '0.7'])];
writeFileSync(join(ROOT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(([u, pr]) => `  <url><loc>${u}</loc><lastmod>${today}</lastmod><priority>${pr}</priority></url>`).join('\n')}
</urlset>
`);
writeFileSync(join(ROOT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}sitemap.xml\n`);
console.log(`${data.places.length} place pages, place/index.html, sitemap.xml (${urls.length} urls), robots.txt → ${SITE}`);
