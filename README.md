<p align="center">
  <img src="docs/logo.svg" width="72" alt="Cholo Puran Dhaka logo">
</p>

<h1 align="center">Cholo Puran Dhaka · চলো পুরান ঢাকা</h1>

<p align="center">A walkable 3D guide to Old Dhaka for first-time visitors: 40 places (for now), ready-made walking routes,<br>a card to show your rickshaw driver, and practical tips, each with its source.</p>

<p align="center"><b><a href="https://cholopurandhaka.netlify.app">Open the live site →</a></b><br><sub>Works on desktop, Android and iPhone. No sign-up, no install.</sub></p>



<div align="center">
  <video src="https://github.com/user-attachments/assets/6822ec8d-0fea-49e7-a6aa-cfe1f780b196" width="480" controls playsinline></video>
</div>






## Why I built it

A lot of people want to visit Old Dhaka, but the practical details are scattered across Facebook posts and old blogs: which day Ahsan Manzil is shut, where the original Nanna Biryani is, whether a car can reach the gate. I live in Gendaria, so these lanes are home ground. I wanted one place that answers those questions on a map you can actually walk through.

Google Maps is still the best way to get from A to B. This is for deciding where to go, and when.

It is also an HCI question I care about: does a 3D street-level view help people find their way in dense, non-grid lanes better than a flat map?

## What it does

- **Walking routes.** Four ready-made days out: *Old Dhaka in one day*, a food crawl, a golden-hour river walk, and a morning of Old Dhaka's many faiths. The route is drawn on the 3D map with numbered stops, suggested times, walking minutes between stops (longer hops marked for a rickshaw), and the days each stop is closed. Every route has its own link, for example [`#route-one-day`](https://cholopurandhaka.netlify.app/#route-one-day).
- **Show the driver.** One tap shows the place name in large Bangla with its area and a well-known landmark nearby, plus "Please take me here" and "How much will the fare be?" in Bangla, each with an English line underneath. The screen stays on while it is open.
- **Before you go.** Getting there, getting around the lanes, what to wear, money, food and water, staying safe, when to go and dates to know, with a 999 emergency button (press 2 for English). Every section lists its sources.
- **Start here.** First-time visitors get a short welcome with the four routes, the tips and an option to explore the map on their own.
- **3D Old Dhaka.** Orbit, pan and zoom over the old city and the Buriganga. Tap a marker and the camera flies to the place.
- **Walk mode.** Drop to street level in front of any place and walk with W A S D, the arrow keys or an on-screen pad. Walls and the river block you, and nearby places show distance and direction.
- **Place cards.** Why go, history, entry fees, hours and closed days (with a warning if it is closed today), quieter and busiest times, photo tips, vehicle access, seating and washrooms, nearby places, and the sources for every fact.
- **Time of day.** A slider moves the light from dawn to night and suggests places that suit that hour.
- **Guide view.** The same 40 places as a plain list that works without 3D, sortable by neighbourhood or by how little known they are.
- **Bangla and English** throughout the interface. Place names are shown in both scripts.
- **Shareable links.** Every place has its own address, for example [`#ahsan-manzil`](https://cholopurandhaka.netlify.app/#ahsan-manzil).

| | |
|---|---|
| ![Ahsan Manzil place card](docs/screenshots/place-card.jpg) | ![Walking down the Shankhari Bazar lane](docs/screenshots/walk-shankhari.jpg) |
| Place card for Ahsan Manzil | Street level in Shankhari Bazar |
| ![Nanna Biryani shopfront](docs/screenshots/walk-nanna.jpg) | ![Lalbagh Fort through the south gate](docs/screenshots/walk-lalbagh.jpg) |
| Nanna Biryani in walk mode | Lalbagh Fort through the south gate |
| ![Launches at Sadarghat](docs/screenshots/walk-sadarghat.jpg) | ![Old Dhaka at night](docs/screenshots/night.jpg) |
| Named launches at Sadarghat | The same streets at night |

![The "Old Dhaka in one day" route on the 3D map](docs/screenshots/route.jpg)

## On phones

The site is built to feel like an app on Android and iPhone:

- **Tab bar.** Map, Routes, Tips, Places and About sit at the bottom, within thumb reach.
- **Bottom-sheet place cards.** Drag a card down to shrink it, down again to close it, or up to expand it.
- **Back button.** Android's back button and the iPhone back swipe close the card or leave walk mode instead of leaving the site.
- **Add to Home Screen.** Installs with its own icon and opens full screen.
- **Share.** The place card uses the phone's own share sheet.
- **Fits every screen.** Respects the notch and home bar, has a compact layout for phones held sideways, and stops iOS zooming in when you tap the search box.
- **Lighter on phones.** The app detects low-power devices and uses lighter settings.

<p align="center">
  <img src="docs/screenshots/phone-start.jpg" width="230" alt="Start-here sheet with the four walking routes">
  <img src="docs/screenshots/phone-driver.jpg" width="230" alt="Show-the-driver card with the place name in large Bangla">
  <img src="docs/screenshots/phone-tips.jpg" width="230" alt="Before-you-go tips with the 999 emergency button">
</p>

<p align="center">
  <img src="docs/screenshots/phone-card.jpg" width="230" alt="Place card as a bottom sheet on a phone">
  <img src="docs/screenshots/phone-map.jpg" width="230" alt="Map with the card swiped down on a phone">
  <img src="docs/screenshots/phone-walk.jpg" width="230" alt="Walk mode with the on-screen pad on a phone">
</p>

## The places

Heritage sites (Ahsan Manzil, Lalbagh Fort, Tara Masjid, the Armenian Church, Dhakeshwari Temple, Hussaini Dalan, Bara and Choto Katra, Ruplal House, Northbrook Hall, Jinjira Palace across the river and more), food (Haji Biryani, Nanna Biryani, Beauty Lassi, Nirob Hotel, Bismillah Kabab, Beauty Boarding, bakarkhani on Agamasi Lane and others), markets (Shankhari Bazar, Islampur, Banglabazar, the Chawkbazar iftar market), the river (Sadarghat and a nouka ride on the Buriganga) and festivals (Shakrain).

Lesser-known places are marked with a red dot so visitors can go beyond the usual three. More places are being added.

## How it works

- **No framework, no build step.** Plain HTML, CSS and JavaScript (ES modules) in one `index.html`, with [three.js](https://threejs.org/) r160 from a CDN for the 3D and `places.json` for the data.
- **Real positions.** Every place's latitude and longitude is projected to local metres around Ahsan Manzil, so landmarks sit where they are on the map:

  ```js
  x = (lng − 90.4060583) × 111320 × cos(23.7086°)
  z = −(lat − 23.7085972) × 110574
  ```

- **Landmarks** are modelled in code: Ahsan Manzil's arcades, staircase and lotus dome, Lalbagh Fort's walls, gate and Pari Bibi's tomb, Tara Masjid with a star-mosaic texture, shopfronts with Bangla signboards, and so on.
- **The city around them is generated** for now: about 30,000 houses with painted shutters, iron grilles, balconies, signboards, rooftop water tanks and overhead wires, drawn with instancing and a custom GLSL facade shader. Rickshaws, CNGs, buses, pushcarts, motorbikes, people and boats move along the roads and the river.
- **Performance.** Instanced meshes keep draw calls under about 100. The app uses lighter settings on low-power devices and steps down further if the frame rate drops.

## Run it locally

The page loads `places.json` with `fetch`, so it needs a local server rather than opening the file directly:

```bash
git clone https://github.com/SifatSwapnil2022/cholo-puran-DHAKA.git
cd cholo-puran-DHAKA
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy

It is a static site and is live on Netlify at **[cholopurandhaka.netlify.app](https://cholopurandhaka.netlify.app)**, redeploying on every push to `main`.

Any static host works with no build command and the repo root as the publish folder: Netlify, GitHub Pages (Settings → Pages → deploy from `main`, root folder) or Cloudflare (`wrangler.jsonc` is included).

## Data

`places.json` holds one record per place: bilingual name, categories, coordinates, why go, history, fees, hours, closed days, crowd times, time to spend, who it suits, photography notes, access, and sources. It also holds the walking routes (stops, suggested times and notes) and the traveller tips with their sources.

- Facts were collected from published sources on 12 October 2026: Wikipedia, The Daily Star, Dhaka Tribune, The Financial Express, The Business Standard, Daily Observer, Bangladesh Monitor, Nijhoom Tours and food writers. Each place lists its own sources.
- **Nothing has been checked on site yet.** 17 coordinates come from sources; 23 are placed by street or neighbourhood and are marked approximate in the app.
- The traveller tips draw on UK FCDO travel advice (updated 9 October 2026), The Business Standard (official CNG fares, February 2025), UNB (999 in English, February 2025), Wikipedia (Metro Line 6), Wikivoyage, Nijhoom Tours and weather data. Each tips section links its sources.
- Route walking times are estimates from straight-line distance (× 1.3 for the lanes, at about 75 m a minute). Legs over about 900 m are suggested by rickshaw.
- Hours and fees change. If you spot something wrong, please open an issue.

## Roadmap

- [x] Phone support: bottom sheets, back gesture, Add to Home Screen
- [ ] More places
- [ ] Replace the generated streets and houses with real OpenStreetMap data
- [ ] Field-check every card and fix the approximate pins
- [ ] Full Bangla descriptions
- [x] Walking routes, a show-the-driver card and traveller tips
- [ ] Offline mode for use in the lanes
- [ ] A small user study comparing 3D and 2D maps for wayfinding

## Project structure

```
index.html            the whole app: UI, 3D scene, landmarks, walk mode
places.json           the places and their sources
manifest.webmanifest  app name, colours and icons for Add to Home Screen
icons/                home-screen and app icons
docs/                 logo, profile picture, screenshots, video cover
tools/music.py        generates the original soundtrack used in the demo video
wrangler.jsonc        optional config for Cloudflare deploys
```

## Credits and licence

- Code: MIT, see [LICENSE](LICENSE).
- Place descriptions and data: [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/). Share with credit; not for resale.
- [three.js](https://threejs.org/) (MIT). Fonts: Bricolage Grotesque, Hind Siliguri, Galada and IBM Plex Mono (SIL Open Font License). Bangladesh outline: Natural Earth via world-atlas.
- The demo video's music is original: a soft piano piece in D major, synthesized by `tools/music.py`.

## Author

**Md Sifatullah Sheikh**, CSE, East West University · [Portfolio](https://mywebsite-j7mf.onrender.com/#/)
