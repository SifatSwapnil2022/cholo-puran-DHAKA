"""Draws image cards from places.json with Playwright.

  python3 tools/cards.py og              -> docs/og/<slug>.jpg (1200x630, link previews) + docs/og/site.jpg
  python3 tools/cards.py social OUTDIR   -> OUTDIR/<slug>.png (1080x1350, posts)
  python3 tools/cards.py shortcuts       -> icons/sc-*.png (96x96, app shortcut icons)

Fonts come from tools/fonts (Galada, Hind Siliguri, Bricolage Grotesque; SIL OFL).
"""
import asyncio, json, sys, pathlib, html, base64
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
FONTDIR = ROOT / 'tools' / 'fonts'

def font(name):
    return 'data:font/woff2;base64,' + base64.b64encode((FONTDIR / f'{name}-normal.woff2').read_bytes()).decode()

CAT = {'heritage': '#D2452B', 'food': '#E07F00', 'hidden-gem': '#6A3FD9', 'photo-spot': '#E5317A', 'market': '#2E9A3E', 'worship': '#0B7A57', 'river': '#0E8FB0', 'festival': '#E0263F'}
CATNAME = {'heritage': 'Heritage', 'food': 'Food', 'hidden-gem': 'Hidden gem', 'photo-spot': 'Photo spot', 'market': 'Market', 'worship': 'Worship', 'river': 'River', 'festival': 'Festival'}
LOGO = (ROOT / 'docs' / 'logo.svg').read_text()
e = html.escape

def mix(hex1, hex2='#14143A', t=0.62):
    a = [int(hex1[i:i + 2], 16) for i in (1, 3, 5)]; b = [int(hex2[i:i + 2], 16) for i in (1, 3, 5)]
    return '#' + ''.join(f'{round(x * t + y * (1 - t)):02x}' for x, y in zip(a, b))

FONT_CSS = f'''
@font-face{{font-family:Galada;src:url({font('galada-bengali-400')})}}
@font-face{{font-family:Galada;src:url({font('galada-latin-400')});unicode-range:U+0000-00FF}}
@font-face{{font-family:Hind;font-weight:400;src:url({font('hind-siliguri-bengali-400')})}}
@font-face{{font-family:Hind;font-weight:600;src:url({font('hind-siliguri-bengali-600')})}}
@font-face{{font-family:Hind;font-weight:700;src:url({font('hind-siliguri-bengali-700')})}}
@font-face{{font-family:Bri;font-weight:400;src:url({font('bricolage-grotesque-latin-400')})}}
@font-face{{font-family:Bri;font-weight:600;src:url({font('bricolage-grotesque-latin-600')})}}
@font-face{{font-family:Bri;font-weight:800;src:url({font('bricolage-grotesque-latin-800')})}}
*{{box-sizing:border-box;margin:0}}
body{{font-family:Bri,Hind,sans-serif;color:#FFFCF6}}
.panel{{position:relative;background:var(--bg)}}
.panel::before{{content:"";position:absolute;inset:16px;border:3px solid rgba(255,252,246,.5);border-radius:14px}}
.trim{{height:22px;background:radial-gradient(circle at 15px 0,var(--bg) 14px,transparent 14.5px) 0 0/30px 22px repeat-x}}
.bn{{font-family:Galada,Hind;line-height:1.15}}
.chip{{display:inline-flex;align-items:center;gap:10px;padding:8px 18px;border-radius:999px;background:rgba(255,252,246,.16);font-weight:600}}
.chip i{{width:14px;height:14px;border-radius:4px;background:var(--cc);box-shadow:0 0 0 2px rgba(255,255,255,.6)}}
.brand{{display:flex;align-items:center;gap:14px;color:#1C1B3A}}
.brand svg{{height:58px;width:auto}}
.brand b{{font-weight:800;font-size:28px;letter-spacing:-.02em;display:block}}
.brand small{{font-family:Galada,Hind;font-size:22px;color:#4A4868}}
'''

def og_html(p):
    c = CAT[p['cat']]; bg = mix(c)
    cats = ''.join(f'<span class="chip" style="--cc:{CAT[x]}"><i></i>{CATNAME[x]}</span>' for x in p['categories'][:3])
    return f'''<html><head><meta charset="utf-8"><style>{FONT_CSS}
body{{width:1200px;height:630px;background:#FFFCF6;display:flex;flex-direction:column}}
.panel{{flex:1;padding:40px 70px;display:flex;flex-direction:column;justify-content:center;--bg:{bg}}}
.bn{{font-size:84px}} h1{{font-size:54px;font-weight:800;letter-spacing:-.025em;line-height:1.08;margin-top:6px;max-width:1000px}}
.tag{{font-size:30px;font-weight:600;opacity:.92;margin-top:18px;max-width:1000px}}
.chips{{display:flex;gap:12px;margin-top:26px;font-size:22px}}
.foot{{display:flex;justify-content:space-between;align-items:center;padding:14px 70px 26px}}
.where{{font-size:24px;font-weight:600;color:#4A4868}}
</style></head><body>
<div class="panel" style="--bg:{bg}"><div class="bn">{e(p['name']['bn'])}</div><h1>{e(p['name']['en'])}</h1><p class="tag">{e(p['tagline'])}</p><div class="chips">{cats}</div></div>
<div class="trim" style="--bg:{bg}"></div>
<div class="foot"><div class="brand">{LOGO}<span><b>Cholo Puran Dhaka</b><small>চলো পুরান ঢাকা</small></span></div><div class="where">{e(p['mahalla'])}, Old Dhaka</div></div>
</body></html>'''

def site_html():
    bg = mix('#006A4E', t=0.85)
    return f'''<html><head><meta charset="utf-8"><style>{FONT_CSS}
body{{width:1200px;height:630px;background:#FFFCF6;display:flex;flex-direction:column}}
.panel{{flex:1;padding:40px 80px;display:flex;flex-direction:column;justify-content:center;--bg:{bg}}}
.bn{{font-size:110px}} h1{{font-size:60px;font-weight:800;letter-spacing:-.03em;margin-top:8px}}
.tag{{font-size:30px;font-weight:600;opacity:.92;margin-top:16px}}
.foot{{display:flex;justify-content:space-between;align-items:center;padding:14px 80px 26px;color:#4A4868;font-size:26px;font-weight:600}}
</style></head><body>
<div class="panel" style="--bg:{bg}"><div class="bn">চলো পুরান ঢাকা</div><h1>Cholo Puran Dhaka</h1><p class="tag">A walkable 3D guide to Old Dhaka: places, food, routes and tips.</p></div>
<div class="trim" style="--bg:{bg}"></div>
<div class="foot"><div class="brand">{LOGO}<span><b>Cholo Puran Dhaka</b><small>চলো পুরান ঢাকা</small></span></div><span>Walking routes · Open now · Show the driver</span></div>
</body></html>'''

def social_html(p):
    c = CAT[p['cat']]; bg = mix(c)
    why = p['whyGo'].split('. ')[0].rstrip('.') + '.'
    dish = p.get('dishes', [{}])[0] if p.get('dishes') else None
    facts = []
    if dish: facts.append(('Order', f"{dish['en']}{' · ' + dish['price'] if dish.get('price') else ''}"))
    facts.append(('Hours', p['hours']))
    if p['quiet']: facts.append(('Quietest', p['quiet'][0]))
    if p['fees']: facts.append(('Entry', ' · '.join(f"{f['who']} ৳{f['bdt']}" for f in p['fees'][-1:])))
    facts.append(('Where', f"{p['mahalla']}, Old Dhaka"))
    rows = ''.join(f'<div class="f"><b>{e(k)}</b><span>{e(v)}</span></div>' for k, v in facts[:5])
    return f'''<html><head><meta charset="utf-8"><style>{FONT_CSS}
body{{width:1080px;height:1350px;background:#FFFCF6;display:flex;flex-direction:column}}
.panel{{flex:1;padding:70px 76px 56px;display:flex;flex-direction:column;justify-content:center;--bg:{bg}}}
.kick{{font-size:26px;font-weight:600;opacity:.85;margin-bottom:44px}}
.bn{{font-size:120px}} h1{{font-size:64px;font-weight:800;letter-spacing:-.03em;line-height:1.05;margin-top:8px}}
.tag{{font-size:34px;font-weight:600;opacity:.92;margin-top:20px}}
.body{{flex:none;padding:44px 76px 10px;color:#1C1B3A;display:flex;flex-direction:column;gap:26px}}
.why{{font-size:34px;line-height:1.35;color:#2E2C4D}}
.f{{display:grid;grid-template-columns:170px 1fr;gap:16px;font-size:28px;padding:14px 0;border-top:2px solid #ECDDC2}}
.f b{{color:{c}}} .f span{{color:#2E2C4D}}
.foot{{display:flex;justify-content:space-between;align-items:center;padding:24px 76px 44px;color:#4A4868;font-size:26px;font-weight:600}}
</style></head><body>
<div class="panel" style="--bg:{bg}"><div class="kick">Place of the week · Old Dhaka</div><div class="bn">{e(p['name']['bn'])}</div><h1>{e(p['name']['en'])}</h1><p class="tag">{e(p['tagline'])}</p></div>
<div class="trim" style="--bg:{bg}"></div>
<div class="body"><p class="why">{e(why)}</p><div>{rows}</div></div>
<div class="foot"><div class="brand">{LOGO}<span><b>Cholo Puran Dhaka</b><small>চলো পুরান ঢাকা</small></span></div><span>Find it on the 3D map</span></div>
</body></html>'''

SHORTCUTS = {
    'routes': ('#E5317A', '<circle cx="6" cy="18" r="2.4"/><circle cx="18" cy="6" r="2.4"/><path d="M8.4 18H15a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h6.6"/>'),
    'near': ('#0E8FB0', '<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/>'),
    'festivals': ('#E0263F', '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
    'tips': ('#006A4E', '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V17h5v-1.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>'),
}

async def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else 'og'
    d = json.loads((ROOT / 'places.json').read_text(encoding='utf-8'))
    for p in d['places']: p['cat'] = p['categories'][0]
    async with async_playwright() as pw:
        b = await pw.chromium.launch()
        if mode == 'shortcuts':
            pg = await b.new_page(viewport={'width': 96, 'height': 96})
            for k, (col, path) in SHORTCUTS.items():
                await pg.set_content(f'<body style="margin:0;width:96px;height:96px;display:grid;place-items:center;background:{col}">'
                                     f'<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">{path}</svg></body>')
                await pg.screenshot(path=str(ROOT / 'icons' / f'sc-{k}.png'))
            print(f'{len(SHORTCUTS)} shortcut icons in icons/')
        elif mode == 'og':
            out = ROOT / 'docs' / 'og'; out.mkdir(parents=True, exist_ok=True)
            pg = await b.new_page(viewport={'width': 1200, 'height': 630})
            jobs = [('site', site_html())] + [(p['slug'], og_html(p)) for p in d['places']]
            for slug, h in jobs:
                await pg.set_content(h); await pg.evaluate('document.fonts.ready')
                await pg.screenshot(path=str(out / f'{slug}.jpg'), type='jpeg', quality=82)
            print(f'{len(jobs)} link-preview images in {out}')
        else:
            out = pathlib.Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
            pg = await b.new_page(viewport={'width': 1080, 'height': 1350})
            for p in d['places']:
                await pg.set_content(social_html(p)); await pg.evaluate('document.fonts.ready')
                await pg.screenshot(path=str(out / f"{p['slug']}.png"))
            print(f"{len(d['places'])} social cards in {out}")
        await b.close()

asyncio.run(main())
