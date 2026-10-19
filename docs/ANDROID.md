# Putting Cholo Puran Dhaka on Android

The site is already an installable web app (PWA): it has a manifest, icons, shortcuts, screenshots and a service worker, so it works offline once opened. There are two ways onto a phone.

## 1. Install from the browser (free, works today)

On Android, open the site in Chrome, then **⋮ → Add to Home screen → Install**. On iPhone, open it in Safari, then **Share → Add to Home Screen**.

It gets its own icon, opens full screen without the browser bar, and long-pressing the icon on Android shows the shortcuts: Routes, Near me, Festivals, Tips.

## 2. Publish on Google Play

Google Play accepts a PWA wrapped as a Trusted Web Activity (TWA). The app is the website, so every update to the site reaches the app with no new release.

### What you need

| Need | Notes |
|---|---|
| Google Play developer account | One-time US$25 fee. New personal accounts must run a closed test with at least 12 testers for 14 days before going public. |
| A domain you control at its root | Play checks `https://<domain>/.well-known/assetlinks.json`. A GitHub Pages *project* site (`sifatswapnil2022.github.io/cholo-puran-DHAKA/`) can't serve files at the domain root. Use a custom domain, or a repo named `sifatswapnil2022.github.io` to hold that one file. |
| Privacy policy page | Play requires a link. The app collects nothing; location is used on the phone only for "Near me" and never sent anywhere. |

### Steps

1. **Package it.** Go to [PWABuilder](https://www.pwabuilder.com/), enter the site address, and choose **Package for stores → Android**. Package ID suggestion: `io.github.sifatswapnil2022.puran`. Keep the signing key it gives you somewhere safe: losing it means you can never update the app.
2. **Link the app to the site.** The download includes `assetlinks.json`. Put it at `https://<your-domain>/.well-known/assetlinks.json`. Without it, the app shows a browser bar at the top.
3. **Create the app in Play Console.** Category *Travel & Local*. Use `icons/icon-512.png` as the icon and the images in `docs/screenshots/` for the store listing (phone screenshots need at least 2).
4. **Upload the `.aab`** from PWABuilder to a closed test track, invite at least 12 testers, wait 14 days, then apply for production.
5. **Data safety form:** no data collected, no data shared. Location: "not collected" (it never leaves the device).

### After it's live

Site updates go straight to the app. Only rebuild the package if you change the app name, icon, package ID or start address.

## Why not a native app?

The 3D map, offline mode, sharing and Bangla text already work in the browser. A native rewrite would double the work for every new place. The TWA route gets a Play Store listing without that cost.

References:
- [Trusted Web Activity overview (Android Developers)](https://developer.chrome.com/docs/android/trusted-web-activity/)
- [PWABuilder Android packaging docs](https://docs.pwabuilder.com/#/builder/android)
- [Play Console: testing requirements for new personal accounts](https://support.google.com/googleplay/android-developer/answer/14151465)
