# Jackie & Meredith — Wedding site

Live site: deployed on Vercel, auto-publishes on every change to `main`.

## How to edit the site (no code)

All words, links, and photos live in **`content.json`**. Edit it with
**Pages CMS** — a free editor with simple forms:

1. Go to **https://app.pagescms.org** and sign in with GitHub
2. Pick the **wedding** repo — you'll see "Wedding Site" with sections for
   Home, Schedule, Travel, Registry, and FAQ
3. Change any text, upload photos where you see an image field, hit **Save**
4. The site rebuilds and is live about a minute later

Photo slots that are empty (Schedule band, Registry photo, FAQ band) simply
don't appear on the site until you add a picture.

## How it works

- `content.json` — every word, link, and photo path on the site
- `templates/` — page layouts with `{{placeholders}}`
- `build.js` — fills templates from content.json into `dist/` (run by Vercel)
- `styles.css`, `fonts/`, `images/` — design system, self-hosted Archivo, photos
- `.pages.yml` — the editing-form definitions for Pages CMS

Local preview: `node build.js && npx serve dist`
