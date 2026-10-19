# Field check: how to verify a place on site

Every fact in `places.json` comes from published sources. A field check means someone stood at the place and confirmed it. Checked places get a green **Checked on site** badge with the date.

## What to bring

- A phone with location on and this guide open at the place's card
- 10–15 minutes per place

## At the place

1. **Pin.** Stand at the entrance people actually use, not the middle of the building. Copy the coordinates (Google Maps: long-press, then copy). Write down five decimal places.
2. **Hours.** Photograph the signboard if there is one. Otherwise ask staff: opening and closing time, closed days, Friday prayer break, Ramadan hours.
3. **Prices.** Ticket prices for locals, SAARC and other foreign visitors. For food places, the price of each dish listed under "What to order", plus anything that should be added.
4. **Facilities.** Is there seating, a washroom visitors can use, card payment, a separate area for women and families?
5. **Getting in.** Can a car or CNG reach the gate, or only a rickshaw? Is the lane uneven or crowded?
6. **Photos.** Are photos allowed inside? Take one of the entrance, so the next visitor can recognise it.

Don't photograph people up close without asking, and be polite with shopkeepers: you are taking their time.

## Recording it

Open an issue with the **Report a mistake** form for any change, or edit `places.json` directly in a pull request:

```json
"lat": 23.70862,
"lng": 90.40604,
"pin": "checked",
"checked": {
  "date": "2026-11-02",
  "by": "Sifat",
  "notes": "Entrance on the river side. Ticket counter by the east gate. Hours on the board match."
}
```

- `pin` becomes `"checked"` once the coordinates come from standing there.
- `checked.date` is the day you were there, `YYYY-MM-DD`.
- `checked.by` is a name or handle that readers can trust.
- Update `hours`, `open`, `fees`, `dishes` and `priceYear` with what you saw.

Then run the checks and rebuild the place pages:

```bash
node tools/validate.mjs
node tools/build-pages.mjs
```

The validator rejects a check dated in the future, a check without a name, and warns if a checked place still has an approximate pin.

## Which places first

Start with the pins marked approximate (`"pin": "approx"`) and the food places on the routes, because visitors walk to those using this guide. Run:

```bash
node -e "const d=require('./places.json');console.log(d.places.filter(p=>p.pin==='approx').map(p=>p.slug).join('\n'))"
```
