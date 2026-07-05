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

// ---------- repeated blocks ----------

const eventBlock = e => `      <div class="event">
        <div class="event__name">${esc(e.name)}</div>
        <div class="event__detail">${esc(e.line1)}<br>${esc(e.line2)}</div>
        <div class="event__divider"></div>
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

const modes = c.travel.modes.map(m => `      <div class="travel-mode">
        <div class="travel-mode__label">${esc(m.label)}</div>
        <div class="travel-mode__route">${esc(m.route)}</div>
        <p class="travel-mode__body">${esc(m.body)}</p>
      </div>`).join('\n');

const stays = c.travel.stays.map(s => `          <div class="stay__item">
            <div class="stay__name">${esc(s.name)}</div>
            <div class="stay__desc">${esc(s.desc)}</div>
          </div>`).join('\n');

const stayPhoto = c.travel.stayPhoto
  ? `      <img class="stay__photo" src="${esc(c.travel.stayPhoto)}" alt="${esc(c.travel.stayPhotoAlt)}">`
  : `      <div class="stay__photo photo-slot">PHOTO — THE ISLAND</div>`;

const faqItems = c.faq.items.map(i => `      <div class="faq__item">
        <div class="faq__q">${esc(i.q)}</div>
        <div class="faq__a">${esc(i.a)}</div>
      </div>`).join('\n');

// optional wide photo band; omitted entirely until a photo is set
const photoBand = (src, alt) => src
  ? `    <section class="photo-band"><img src="${esc(src)}" alt="${esc(alt)}"></section>`
  : '';

const registryPhoto = c.registry.photo
  ? `    <img class="registry__photo" src="${esc(c.registry.photo)}" alt="${esc(c.registry.photoAlt)}">`
  : '';

// ---------- token map ----------

const tokens = {
  BROWSER_TITLE: esc(c.site.browserTitle),
  MONOGRAM: esc(c.site.monogram),
  RSVP_URL: esc(c.site.rsvpUrl),
  FOOTER: esc(c.site.footer),
  HERO_IMAGE: esc(c.site.heroImage),
  HERO_ALT: esc(c.site.heroAlt),
  TAGLINE: esc(c.site.tagline),
  SCHEDULE_EYEBROW: esc(c.schedule.eyebrow),
  SCHEDULE_TITLE: esc(c.schedule.title),
  SCHEDULE_PHOTO_BAND: photoBand(c.schedule.photo, c.schedule.photoAlt),
  SCHEDULE_DAYS: days,
  TRAVEL_EYEBROW: esc(c.travel.eyebrow),
  TRAVEL_TITLE: esc(c.travel.title),
  TRAVEL_MODES: modes,
  STAY_EYEBROW: esc(c.travel.stayEyebrow),
  STAY_PHOTO: stayPhoto,
  STAY_ITEMS: stays,
  REGISTRY_EYEBROW: esc(c.registry.eyebrow),
  REGISTRY_TITLE: esc(c.registry.title),
  REGISTRY_NOTE: esc(c.registry.note),
  REGISTRY_BUTTON: esc(c.registry.buttonLabel),
  REGISTRY_URL: esc(c.registry.registryUrl),
  REGISTRY_PHOTO: registryPhoto,
  FAQ_EYEBROW: esc(c.faq.eyebrow),
  FAQ_TITLE: esc(c.faq.title),
  FAQ_ITEMS: faqItems,
  FAQ_PHOTO_BAND: photoBand(c.faq.photo, c.faq.photoAlt),
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
  // collapse blank lines left by empty optional sections
  html = html.replace(/\n{3,}/g, '\n\n');
  fs.writeFileSync(path.join(DIST, f), html);
}

for (const dir of ['images', 'fonts']) {
  fs.cpSync(path.join(ROOT, dir), path.join(DIST, dir), { recursive: true });
}
fs.copyFileSync(path.join(ROOT, 'styles.css'), path.join(DIST, 'styles.css'));

console.log('Built', fs.readdirSync(DIST).join(', '));
