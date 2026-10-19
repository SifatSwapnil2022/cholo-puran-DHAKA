// Checks places.json before it ships: required fields, types, coordinates inside Old Dhaka,
// opening-hours format, dishes, sources, and that routes and tips point at things that exist.
// Run: node tools/validate.mjs   (exits 1 on any error)
import { readFileSync } from 'node:fs';

const file = new URL('../places.json', import.meta.url);
const d = JSON.parse(readFileSync(file, 'utf8'));
const errors = [], warnings = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

const CATS = ['heritage', 'food', 'hidden-gem', 'photo-spot', 'market', 'worship', 'river', 'festival'];
const TYPES = ['palace', 'fort', 'mosque-star', 'mosque', 'church', 'temple', 'imambara', 'ruin', 'colonial-red', 'colonial-columns', 'colonial',
  'park', 'gurdwara', 'garden', 'cemetery', 'ghat', 'boat', 'street', 'market', 'shop-biryani', 'shop-lassi', 'shop-food', 'shop-boarding',
  'shop-bakery', 'festival', 'ruin-palace'];
const VEH = ['car-to-gate', 'rickshaw-only', 'walk-only'];
const WALK = ['easy', 'moderate', 'hard'];
const GOOD = ['solo', 'friends', 'couples', 'family-elders', 'kids'];
const DAYS = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'];
const WEEK = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const BOX = { lat: [23.690, 23.730], lng: [90.374, 90.433] }; // the area the 3D city covers

const isStr = v => typeof v === 'string' && v.trim().length > 0;
const strArr = v => Array.isArray(v) && v.every(x => typeof x === 'string');
const hhmm = s => /^([01]\d|2[0-4]):[0-5]\d$/.test(s);

const slugs = new Set();
for (const [i, p] of (d.places || []).entries()) {
  const w = p.slug || `places[${i}]`;
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.slug || '')) err(w, 'slug must be lower-case words joined by hyphens');
  if (slugs.has(p.slug)) err(w, 'duplicate slug'); slugs.add(p.slug);
  if (!isStr(p.name?.en) || !isStr(p.name?.bn)) err(w, 'name.en and name.bn are required');
  if (!TYPES.includes(p.type)) err(w, `unknown type "${p.type}"`);
  if (!Array.isArray(p.categories) || !p.categories.length || p.categories.some(c => !CATS.includes(c))) err(w, 'categories must be a non-empty list of known categories');
  for (const k of ['mahalla', 'tagline', 'whyGo', 'hours']) if (!isStr(p[k])) err(w, `${k} is required`);
  if (typeof p.lat !== 'number' || typeof p.lng !== 'number') err(w, 'lat and lng must be numbers');
  else if (p.lat < BOX.lat[0] || p.lat > BOX.lat[1] || p.lng < BOX.lng[0] || p.lng > BOX.lng[1]) err(w, `coordinates ${p.lat}, ${p.lng} fall outside Old Dhaka`);
  if (!['source', 'approx', 'checked'].includes(p.pin)) err(w, 'pin must be "source", "approx" or "checked"');
  if (!Number.isInteger(p.underrated) || p.underrated < 1 || p.underrated > 5) err(w, 'underrated must be 1 to 5');
  for (const k of ['quiet', 'peak', 'closed']) if (!strArr(p[k])) err(w, `${k} must be a list of strings`);
  if (!Array.isArray(p.spend) || p.spend.length !== 2 || p.spend[0] > p.spend[1]) err(w, 'spend must be [min, max] minutes');
  if (!Array.isArray(p.goodFor) || p.goodFor.some(g => !GOOD.includes(g))) err(w, 'goodFor has an unknown value');
  if (!Array.isArray(p.fees) || p.fees.some(f => !isStr(f.who) || typeof f.bdt !== 'number')) err(w, 'fees must be [{who, bdt}]');
  if (!isStr(p.photo?.tips) || !isStr(p.photo?.inside)) err(w, 'photo.tips and photo.inside are required');
  const a = p.access || {};
  if (!VEH.includes(a.vehicle) || !WALK.includes(a.walking) || typeof a.seating !== 'boolean' || typeof a.washroom !== 'boolean') err(w, 'access needs vehicle, walking, seating, washroom');
  if (!Array.isArray(p.sources) || !p.sources.length) err(w, 'at least one source is required');
  else for (const s of p.sources) {
    if (!isStr(s.label)) err(w, 'every source needs a label');
    if (s.url && !/^https:\/\//.test(s.url)) err(w, `source url must be https: ${s.url}`);
  }
  if (p.open !== undefined) {
    if (!Array.isArray(p.open) || !p.open.length) err(w, 'open must be a non-empty list');
    else for (const o of p.open) {
      const days = (o.d || '').split(',');
      if (!days.length || days.some(x => !DAYS.includes(x))) err(w, `open.d has an unknown day: "${o.d}"`);
      const [s, e] = (o.t || '').split('-');
      if (!hhmm(s || '') || !hhmm(e || '') || s >= e) err(w, `open.t must be "HH:MM-HH:MM" with start before end: "${o.t}"`);
      if (o.m !== undefined && !/^(1[0-2]|[1-9])-(1[0-2]|[1-9])$/.test(o.m)) err(w, `open.m must be "fromMonth-toMonth": "${o.m}"`);
      for (const day of days) if (p.closed.includes(WEEK[DAYS.indexOf(day)])) err(w, `open on ${day} but also listed as closed that day`);
    }
  }
  if (p.dishes !== undefined) {
    if (!Array.isArray(p.dishes) || p.dishes.some(x => !isStr(x.en) || !isStr(x.bn))) err(w, 'dishes must be [{en, bn, price?}]');
    if (p.dishes?.some(x => x.price) && !p.priceYear) warn(w, 'dish prices without priceYear');
  }
  if (p.priceBand !== undefined && ![1, 2, 3].includes(p.priceBand)) err(w, 'priceBand must be 1, 2 or 3');
  if (p.checked != null) {
    const c = p.checked;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(c.date || '') || isNaN(Date.parse(c.date))) err(w, 'checked.date must be YYYY-MM-DD');
    else if (c.date > new Date().toISOString().slice(0, 10)) err(w, 'checked.date is in the future');
    if (!isStr(c.by)) err(w, 'checked.by is required (who stood there)');
    if (c.notes !== undefined && typeof c.notes !== 'string') err(w, 'checked.notes must be text');
    if (p.pin === 'approx') warn(w, 'checked on site but pin is still approx; update lat/lng and set pin to "checked"');
  }
  if (p.categories?.includes('food') && !p.dishes) warn(w, 'food place without dishes');
}

for (const r of d.routes || []) {
  const w = `route ${r.id}`;
  if (!isStr(r.name?.en) || !isStr(r.name?.bn)) err(w, 'name.en and name.bn are required');
  if (!/^#[0-9A-Fa-f]{6}$/.test(r.color || '')) err(w, 'color must be #RRGGBB');
  if (!Array.isArray(r.stops) || r.stops.length < 2) err(w, 'needs at least two stops');
  let prev = -1;
  for (const s of r.stops || []) {
    if (!slugs.has(s.slug)) err(w, `stop "${s.slug}" is not a place`);
    const m = /^(\d{1,2}):(\d{2})$/.exec(s.at || ''); if (!m) { err(w, `stop ${s.slug}: at must be H:MM`); continue; }
    const t = +m[1] * 60 + +m[2]; if (t <= prev) err(w, `stop ${s.slug}: times must increase`); prev = t;
    if (!isStr(s.tip)) err(w, `stop ${s.slug}: tip is required`);
  }
  for (const day of r.best || []) if (!WEEK.includes(day)) err(w, `unknown best day "${day}"`);
}

const tips = d.tips;
if (tips) {
  for (const sec of tips.sections) for (const k of sec.src) if (!tips.sources[k]) err(`tips ${sec.id}`, `unknown source key "${k}"`);
  if (!tips.sources[tips.emergency?.src]) err('tips emergency', 'unknown source key');
}

const cul = d.culture;
if (cul) {
  const src = k => tips?.sources?.[k];
  const date = s => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
  for (const f of cul.festivals || []) {
    const w = `festival ${f.id}`;
    if (!isStr(f.name?.en) || !isStr(f.name?.bn) || !isStr(f.when) || !isStr(f.what)) err(w, 'name.en, name.bn, when and what are required');
    if (f.from || f.to) err(w, 'use dates: [{from, to}] instead of from/to');
    if (f.dates !== undefined) {
      if (!Array.isArray(f.dates) || !f.dates.length) err(w, 'dates must be a non-empty list');
      let prev = '';
      for (const x of f.dates || []) {
        if (!(date(x.from) && date(x.to) && x.from <= x.to)) err(w, `dates entry needs from and to as YYYY-MM-DD, from first: ${JSON.stringify(x)}`);
        else if (x.from <= prev) err(w, 'dates must be in order'); else prev = x.to;
      }
      const last = (f.dates || []).at(-1)?.to;
      if (last && last < (d.meta.updated || '')) warn(w, `every date has passed (last ${last}); add the next one`);
    }
    if (!['everyone', 'muslim', 'hindu', 'christian', 'sikh', 'buddhist'].includes(f.community)) err(w, 'community must be everyone, muslim, hindu, christian, sikh or buddhist');
    if (!['festive', 'devotional', 'mourning'].includes(f.mood)) err(w, 'mood must be festive, devotional or mourning');
    if (f.moon !== undefined && typeof f.moon !== 'boolean') err(w, 'moon must be true or false');
    for (const s of f.places || []) if (!slugs.has(s)) err(w, `place "${s}" does not exist`);
    if (!f.src?.length) err(w, 'needs at least one source');
    for (const k of f.src || []) if (!src(k)) err(w, `unknown source key "${k}"`);
  }
  for (const c of cul.crafts || []) {
    const w = `craft ${c.id}`;
    if (!isStr(c.name?.en) || !isStr(c.name?.bn) || !isStr(c.what)) err(w, 'name.en, name.bn and what are required');
    for (const s of c.places || []) if (!slugs.has(s)) err(w, `place "${s}" does not exist`);
    for (const k of c.src || []) if (!src(k)) err(w, `unknown source key "${k}"`);
    if (!c.src?.length && !c.places?.length) err(w, 'needs a source or a place whose sources cover it');
  }
  const ph = cul.phrases;
  if (ph) {
    for (const k of ph.src || []) if (!src(k)) err('phrases', `unknown source key "${k}"`);
    for (const x of ph.items || []) if (!isStr(x.en) || !isStr(x.kutti) || !isStr(x.say)) err('phrases', `"${x.en}" needs en, kutti and say`);
  }
}

const hist = d.history;
if (hist) {
  if (!isStr(hist.title?.en) || !isStr(hist.intro)) err('history', 'title.en and intro are required');
  for (const k of hist.src || []) if (!tips?.sources?.[k]) err('history', `unknown source key "${k}"`);
  for (const era of hist.eras || []) {
    const w = `history ${era.id}`;
    if (!isStr(era.years) || !isStr(era.title?.en) || !isStr(era.title?.bn) || !isStr(era.summary)) err(w, 'years, title.en, title.bn and summary are required');
    if (!/^#[0-9A-Fa-f]{6}$/.test(era.color || '')) err(w, 'color must be #RRGGBB');
    for (const ev of era.events || []) {
      const we = `${w} ${ev.year}`;
      if (!isStr(ev.year) || !isStr(ev.text)) err(we, 'year and text are required');
      for (const s of ev.places || []) if (!slugs.has(s)) err(we, `place "${s}" does not exist`);
      for (const k of ev.src || []) if (!tips?.sources?.[k]) err(we, `unknown source key "${k}"`);
      if (!ev.src?.length && !ev.places?.length) err(we, 'needs a source, or a place whose sources cover it');
    }
  }
}

for (const m of warnings) console.warn('warn  ' + m);
for (const m of errors) console.error('ERROR ' + m);
console.log(`${d.places.length} places, ${(d.routes || []).length} routes: ${errors.length} errors, ${warnings.length} warnings`);
process.exit(errors.length ? 1 : 0);
