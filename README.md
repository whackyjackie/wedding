# Jackie & Meredith — Wedding site

Clean, static implementation of the Claude Design mockups. Plain HTML + one
shared stylesheet — no build step, no framework. Portable enough to paste into
a host like withjoy or drop on any static host.

## Pages

| File            | Design source        | Content                                            |
|-----------------|----------------------|----------------------------------------------------|
| `index.html`    | `Home.dc.html`       | Full-screen hero: ferry photo, nav, "MEET US IN THE ISLANDS" |
| `schedule.html` | `Schedule.dc.html`   | Friday / Saturday / Sunday events                  |
| `travel.html`   | `Travel.dc.html`     | Ferry / air / on-island + where to stay            |
| `registry.html` | `Registry.dc.html`   | Note on gifts + registry button                    |
| `faq.html`      | `FAQ.dc.html`        | Four questions                                     |

- `styles.css` — shared, class-based styles for every page
- `images/hero.jpg` — the hero photo

## Design system

- **Font:** Archivo (loaded from Google Fonts in `styles.css`)
- **Ink:** `#1B1B1B` · **Paper:** `#FDFDFC`
- Uppercase, wide letter-spacing throughout; light (300) weights for headings.

## Things to swap before going live

- **RSVP links** — every `href="#"` on the `RSVP` / `VIEW REGISTRY` buttons is a
  placeholder. Point them at your Zola / Google Form / registry URL.
- **Travel photo** — `travel.html` shows a `PHOTO — THE ISLAND` placeholder box.
  Replace `<div class="stay__photo photo-slot">…</div>` with
  `<img class="stay__photo" src="images/island.jpg" alt="The island">`.
- **Copy** — Schedule times/venues/attire and all Lorem ipsum on Travel /
  Registry / FAQ are placeholders from the mockups.

## Note on the mockups

The `project/*.dc.html` files are Claude Design prototypes. Their `<x-dc>`
wrapper, `support.js`, and `image-slot.js` (drag-and-drop upload targets) are
editor scaffolding and are intentionally not carried into this build. The one
decorative "DOODLE" upload slot next to the Schedule title had no asset, so it
is omitted — add a doodle image there later if you want one.
