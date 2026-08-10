// Builds the site: reads content.json, fills templates/, writes dist/.
// No dependencies — runs on Vercel as `node build.js`.
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const c = JSON.parse(fs.readFileSync(path.join(ROOT, 'content.json'), 'utf8'));

const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---------- shared pieces ----------

// image inside a split; empty src → omitted (section becomes centered column)
const splitImg = (src, alt) => src
  ? `      <img class="split__img" src="${esc(src)}" alt="${esc(alt)}">`
  : '';

// bold arrowed row; arrow + link only when a url is set
const ARROW_SVG = `<svg class="linklist__arrow" viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="M2.5 9.5 L9.5 2.5 M4 2.5 H9.5 V8" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>`;
const row = (label, sub, url) => {
  const arrow = url ? ARROW_SVG : '';
  const main = `<div class="linklist__main"><span class="linklist__label">${esc(label)}</span>${arrow}</div>`;
  const subLine = sub ? `\n            <div class="linklist__sub">${esc(sub)}</div>` : '';
  return url
    ? `          <a class="linklist__row" href="${esc(url)}">${main}${subLine}\n          </a>`
    : `          <div class="linklist__row">${main}${subLine}\n          </div>`;
};

// built-in botanical mark, replaced by site.botanical when set
const BOTANICAL_SVG = `      <svg class="cocoa-band__art" viewBox="0 0 90 110" fill="none" stroke="#F4EDE3" stroke-width="1.1" stroke-linecap="round">
        <path d="M45 108 C 44 78, 42 55, 38 34"/>
        <path d="M38 34 C 30 28, 24 18, 26 8 C 34 12, 40 22, 38 34 Z"/>
        <path d="M45 108 C 48 82, 52 62, 58 44"/>
        <path d="M58 44 C 66 40, 72 30, 70 20 C 62 24, 56 34, 58 44 Z"/>
        <path d="M45 108 C 42 92, 34 80, 22 74"/>
      </svg>`;

const cocoaBand = () => {
  if (c.site.bandHidden) return '';
  const art = c.site.botanicalHidden ? '' : c.site.botanical
    ? `      <img class="cocoa-band__art" src="${esc(c.site.botanical)}" alt="">`
    : BOTANICAL_SVG;
  const cta = c.site.rsvpHidden ? '' : `
      <a class="cocoa-band__cta" href="${esc(c.site.rsvpUrl)}">REPLY NOW</a>
      <div class="cocoa-band__note">WE LOOK FORWARD TO RECEIVING YOUR RESPONSE</div>`;
  return `    <section class="cocoa-band">
${art}
      <div class="cocoa-band__signoff">${esc(c.site.signoff)}</div>${cta}
    </section>`;
};

// ---------- schedule ----------

// one event inside a day row: name, venue · detail meta, optional note.
// the meta separator only appears between parts that exist.
const schedEvent = e => {
  const meta = [e.venue, e.detail].filter(Boolean)
    .map(t => `<span>${esc(t)}</span>`)
    .join(' <span class="schD-row__meta-sep">·</span> ');
  return `          <div class="schD-event">
            <div class="schD-row__name">${esc(e.name)}</div>${meta ? `
            <div class="schD-row__meta">${meta}</div>` : ''}${e.note ? `
            <p class="schD-row__note">${esc(e.note)}</p>` : ''}
          </div>`;
};

const schedRows = c.schedule.days.map(day => `        <div class="schD-row">
          <div>
            <div class="schD-row__date">${esc(day.date)}</div>
            <div class="schD-row__day">${esc(day.dow)}</div>
          </div>
          <div class="schD-events">
${day.events.map(schedEvent).join('\n')}
          </div>
        </div>`).join('\n\n');

const schedPhoto = c.schedule.photo
  ? `        <img class="schD__photo" src="${esc(c.schedule.photo)}" alt="${esc(c.schedule.photoAlt)}">`
  : '';

// ---------- travel ----------

const modeRows = c.travel.modes
  .map(m => row(`${m.label} — ${m.route}`, m.body, m.url))
  .join('\n');

const stayRows = c.travel.stays
  .map(s => row(s.name, s.desc, s.url))
  .join('\n');

const staySection = c.travel.stayHidden ? '' : `    <section class="split split--flip">
      <div class="split__txt">
        <h2>${esc(c.travel.stayTitle)}</h2>
        <p class="split__intro">${esc(c.travel.stayIntro)}</p>
        <div class="linklist">
${stayRows}
        </div>
      </div>
${splitImg(c.travel.stayPhoto, c.travel.stayPhotoAlt)}
    </section>`;

// ---------- pages + nav (hidden pages drop out of the menu) ----------

const PAGES = [
  { file: 'index.html', label: 'HOME', hidden: false },
  { file: 'schedule.html', label: 'SCHEDULE', hidden: !!c.schedule.hidden },
  { file: 'travel.html', label: 'TRAVEL', hidden: !!c.travel.hidden },
  { file: 'registry.html', label: 'REGISTRY', hidden: !!c.registry.hidden },
  { file: 'faq.html', label: 'FAQ', hidden: !!c.faq.hidden },
];

const DEFAULT_ORDER = ['schedule', 'travel', 'registry', 'faq'];
const KEY_TO_FILE = { schedule: 'schedule.html', travel: 'travel.html', registry: 'registry.html', faq: 'faq.html' };
const orderedKeys = [];
for (const o of (c.site.navOrder || [])) {
  const k = o && o.page;
  if (KEY_TO_FILE[k] && !orderedKeys.includes(k)) orderedKeys.push(k);
}
for (const k of DEFAULT_ORDER) if (!orderedKeys.includes(k)) orderedKeys.push(k);
const NAV_PAGES = [PAGES[0], ...orderedKeys.map(k => PAGES.find(p => p.file === KEY_TO_FILE[k]))];

const navLinksFor = current => {
  const links = NAV_PAGES.filter(p => !p.hidden).map(p => {
    const cls = p.file === current ? ' class="is-current"' : '';
    return `      <a${cls} href="${p.file}">${p.label}</a>`;
  });
  if (!c.site.rsvpHidden) {
    links.push(`      <a class="nav__rsvp" href="${esc(c.site.rsvpUrl)}">RSVP</a>`);
  }
  return `    <div class="nav__links">\n${links.join('\n')}\n    </div>`;
};

const REDIRECT_STUB = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta http-equiv="refresh" content="0;url=index.html">
<title>Redirecting…</title></head>
<body><a href="index.html">Continue to the site</a></body></html>`;

// ---------- faq ----------

const faqItems = c.faq.items.map(i => `          <div class="faq__item">
            <div class="faq__q">${esc(i.q)}</div>
            <div class="faq__a">${esc(i.a)}</div>
          </div>`).join('\n');

// ---------- token map ----------

// uploaded monogram images win over the text monogram.
// Home (bright photo) gets the light version; interior pages (cream)
// get the dark version — never each other's.
const monogramImg = src => `<img src="${esc(src)}" alt="${esc(c.site.monogram)}">`;
const monogramHero = c.site.monogramImage ? monogramImg(c.site.monogramImage)
  : c.site.monogramImageDark ? monogramImg(c.site.monogramImageDark)
  : esc(c.site.monogram);
const monogramPage = c.site.monogramImageDark ? monogramImg(c.site.monogramImageDark)
  : esc(c.site.monogram);

const tokens = {
  BROWSER_TITLE: esc(c.site.browserTitle),
  MONOGRAM: monogramPage,
  MONOGRAM_HERO: monogramHero,
  RSVP_URL: esc(c.site.rsvpUrl),
  FOOTER: esc(c.site.footer),
  HERO_IMAGE: esc(c.site.heroImage),
  HERO_ALT: esc(c.site.heroAlt),
  TAGLINE: esc(c.site.tagline),
  COCOA_BAND: cocoaBand(),
  SCHEDULE_WORD: esc(c.schedule.title),
  SCHEDULE_PHOTO: schedPhoto,
  SCHEDULE_ROWS: schedRows,
  RSVP_WORD: esc(c.rsvp.title),
  RSVP_EYEBROW: esc(c.rsvp.eyebrow),
  RSVP_INTRO: esc(c.rsvp.intro),
  RSVP_DEADLINE: c.rsvp.deadline
    ? `          <div class="rsvpF__deadline">${esc(c.rsvp.deadline)}</div>`
    : '',
  RSVP_ACCEPT: esc(c.rsvp.acceptLabel),
  RSVP_DECLINE: esc(c.rsvp.declineLabel),
  RSVP_THANKS_TITLE: esc(c.rsvp.thanksTitle),
  RSVP_THANKS_NOTE: esc(c.rsvp.thanksNote),
  // JS string literals, not HTML — JSON-encoded so quotes can't break the script
  RSVP_FORM_URL: JSON.stringify(c.rsvp.formUrl || ''),
  RSVP_ENTRY_NAME: JSON.stringify(c.rsvp.entryName || ''),
  RSVP_ENTRY_ATTENDING: JSON.stringify(c.rsvp.entryAttending || ''),
  RSVP_ENTRY_NOTE: JSON.stringify(c.rsvp.entryNote || ''),
  TRAVEL_EYEBROW: esc(c.travel.eyebrow),
  TRAVEL_TITLE: esc(c.travel.title),
  TRAVEL_INTRO: esc(c.travel.intro),
  TRAVEL_PHOTO: splitImg(c.travel.photo, c.travel.photoAlt),
  TRAVEL_MODES: modeRows,
  STAY_SECTION: staySection,
  REGISTRY_EYEBROW: esc(c.registry.eyebrow),
  REGISTRY_TITLE: esc(c.registry.title),
  REGISTRY_NOTE: esc(c.registry.note),
  REGISTRY_BUTTON: esc(c.registry.buttonLabel),
  REGISTRY_URL: esc(c.registry.registryUrl),
  REGISTRY_PHOTO: splitImg(c.registry.photo, c.registry.photoAlt),
  FAQ_EYEBROW: esc(c.faq.eyebrow),
  FAQ_TITLE: esc(c.faq.title),
  FAQ_ITEMS: faqItems,
  FAQ_PHOTO: splitImg(c.faq.photo, c.faq.photoAlt),
};

// ---------- render + copy ----------

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

// content-hashed asset URLs so browsers never serve a stale stylesheet/font
const crypto = require('crypto');
const hashOf = p => crypto.createHash('md5')
  .update(fs.readFileSync(path.join(ROOT, p))).digest('hex').slice(0, 10);
const CSS_V = hashOf('styles.css');
// font preload hrefs stay unhashed so they match the URLs inside styles.css —
// a ?v= query on the preload alone would make the browser download fonts twice
const FONTS = [];
const FONT_V = Object.fromEntries(FONTS.map(f => [f, hashOf(f)]));
const HASHED_ASSETS = ['images/favicon.png', 'images/apple-touch-icon.png', 'images/og.jpg']
  .filter(p => fs.existsSync(path.join(ROOT, p)));
const ASSET_V = Object.fromEntries(HASHED_ASSETS.map(p => [p, hashOf(p)]));

for (const f of fs.readdirSync(path.join(ROOT, 'templates'))) {
  const page = PAGES.find(p => p.file === f);
  if (page && page.hidden) {
    // WIP page: keep the URL alive but bounce visitors to the home page
    fs.writeFileSync(path.join(DIST, f), REDIRECT_STUB);
    console.log(`(hidden) ${f} → redirect stub`);
    continue;
  }
  let html = fs.readFileSync(path.join(ROOT, 'templates', f), 'utf8');
  html = html.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    if (k === 'NAV_LINKS') return navLinksFor(f);
    if (!(k in tokens)) throw new Error(`Unknown token {{${k}}} in ${f}`);
    return tokens[k];
  });
  html = html.replace(/\n{3,}/g, '\n\n');
  html = html.replace('href="styles.css"', `href="styles.css?v=${CSS_V}"`);
  for (const font of FONTS) {
    html = html.replace(`href="${font}"`, `href="${font}?v=${FONT_V[font]}"`);
  }
  for (const a of HASHED_ASSETS) {
    html = html.split(`"${a}"`).join(`"${a}?v=${ASSET_V[a]}"`);
  }
  fs.writeFileSync(path.join(DIST, f), html);
}

for (const dir of ['images', 'fonts']) {
  fs.cpSync(path.join(ROOT, dir), path.join(DIST, dir), { recursive: true });
}
fs.copyFileSync(path.join(ROOT, 'styles.css'), path.join(DIST, 'styles.css'));

console.log('Built', fs.readdirSync(DIST).join(', '));
