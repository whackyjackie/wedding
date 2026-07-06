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
const row = (label, sub, url) => {
  const arrow = url ? `<span class="linklist__arrow">→</span>` : '';
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
  const art = c.site.botanical
    ? `      <img class="cocoa-band__art" src="${esc(c.site.botanical)}" alt="">`
    : BOTANICAL_SVG;
  return `    <section class="cocoa-band">
${art}
      <div class="cocoa-band__signoff">${esc(c.site.signoff)}</div>
      <a class="cocoa-band__cta" href="${esc(c.site.rsvpUrl)}">REPLY NOW</a>
      <div class="cocoa-band__note">WE LOOK FORWARD TO RECEIVING YOUR RESPONSE</div>
    </section>`;
};

// ---------- schedule ----------

const eventBlock = e => `      <div class="event">
        <div class="event__name">${esc(e.name)}</div>
        <div class="event__detail">${esc(e.line1)}<br>${esc(e.line2)}</div>
        <div class="event__attire">${esc(e.attire)}</div>
      </div>`;

const days = c.schedule.days.map((day, i) => {
  const last = i === c.schedule.days.length - 1 ? ' schedule-day--last' : '';
  const events = day.events.length > 1
    ? `      <div class="event-pair">\n${day.events.map(eventBlock).join('\n')}\n      </div>`
    : eventBlock(day.events[0]);
  return `    <section class="schedule-day${last}">
      <div class="day-rule"><span>${esc(day.label)}</span></div>
${events}
    </section>`;
}).join('\n\n');

const photoBand = (src, alt) => src
  ? `    <section class="photo-band"><img src="${esc(src)}" alt="${esc(alt)}"></section>`
  : '';

// ---------- travel ----------

const modeRows = c.travel.modes
  .map(m => row(`${m.label} — ${m.route}`, m.body, m.url))
  .join('\n');

const stayRows = c.travel.stays
  .map(s => row(s.name, s.desc, s.url))
  .join('\n');

// ---------- faq ----------

const faqItems = c.faq.items.map(i => `          <div class="faq__item">
            <div class="faq__q">${esc(i.q)}</div>
            <div class="faq__a">${esc(i.a)}</div>
          </div>`).join('\n');

// ---------- token map ----------

const tokens = {
  BROWSER_TITLE: esc(c.site.browserTitle),
  MONOGRAM: esc(c.site.monogram),
  RSVP_URL: esc(c.site.rsvpUrl),
  FOOTER: esc(c.site.footer),
  HERO_IMAGE: esc(c.site.heroImage),
  HERO_ALT: esc(c.site.heroAlt),
  TAGLINE: esc(c.site.tagline),
  COCOA_BAND: cocoaBand(),
  SCHEDULE_EYEBROW: esc(c.schedule.eyebrow),
  SCHEDULE_TITLE: esc(c.schedule.title),
  SCHEDULE_PHOTO_BAND: photoBand(c.schedule.photo, c.schedule.photoAlt),
  SCHEDULE_DAYS: days,
  TRAVEL_EYEBROW: esc(c.travel.eyebrow),
  TRAVEL_TITLE: esc(c.travel.title),
  TRAVEL_INTRO: esc(c.travel.intro),
  TRAVEL_PHOTO: splitImg(c.travel.photo, c.travel.photoAlt),
  TRAVEL_MODES: modeRows,
  STAY_TITLE: esc(c.travel.stayTitle),
  STAY_INTRO: esc(c.travel.stayIntro),
  STAY_PHOTO: splitImg(c.travel.stayPhoto, c.travel.stayPhotoAlt),
  STAY_ITEMS: stayRows,
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

for (const f of fs.readdirSync(path.join(ROOT, 'templates'))) {
  let html = fs.readFileSync(path.join(ROOT, 'templates', f), 'utf8');
  html = html.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    if (!(k in tokens)) throw new Error(`Unknown token {{${k}}} in ${f}`);
    return tokens[k];
  });
  html = html.replace(/\n{3,}/g, '\n\n');
  fs.writeFileSync(path.join(DIST, f), html);
}

for (const dir of ['images', 'fonts']) {
  fs.cpSync(path.join(ROOT, dir), path.join(DIST, dir), { recursive: true });
}
fs.copyFileSync(path.join(ROOT, 'styles.css'), path.join(DIST, 'styles.css'));

console.log('Built', fs.readdirSync(DIST).join(', '));
