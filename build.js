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

// prose fields may contain [link text](https://url); everything else is escaped.
// A stray space before the ( is tolerated. External links open in a new tab;
// links within the site (relative, or absolute to our own domain) stay put.
const LINK_RE = /\[([^\]]+)\] ?\(([^)\s]+)\)/g;
const OWN_SITE = /^https?:\/\/(www\.)?jackieandmeredith\.com(\/|$)/i;
const rich = s => emphasize(esc(educate(s)).replace(LINK_RE, (match, text, url) => {
  const external = /^(https?:|mailto:)/i.test(url);
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(url);
  if (!external && hasScheme) return match; // javascript: etc. stays literal
  const tgt = external && !OWN_SITE.test(url) ? ' target="_blank" rel="noopener"' : '';
  return `<a class="txt-link" href="${url}"${tgt}>${text}</a>`;
})).replace(/\n/g, '<br>');
// for text that already sits inside a link — keep the words, drop the url
const stripLinks = s => String(s ?? '').replace(LINK_RE, '$1');

// Apfel draws the straight " as a closing-quote glyph, so straight quotes
// read backwards at the start of a phrase. Educate them: opening after a
// space/bracket/dash or at the start, closing everywhere else.
const educate = s => s.replace(/"/g, (q, i, str) =>
  i === 0 || /[\s([{—–-]/.test(str[i - 1]) ? '“' : '”');
// same, for sanitized HTML — only text between tags, never attributes
const educateHtml = html => html.split(/(<[^>]*>)/)
  .map(part => part.startsWith('<') ? part : educate(part)).join('');

// **bold** and *italic* — same mini-markdown family as [text](url).
// Runs after esc(), so the markers must pair on one line to count.
const emphasize = s => s
  .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
  .replace(/(^|[^*])\*([^*\s][^*\n]*?)\*(?!\*)/g, '$1<em>$2</em>');

// rich-text CMS fields save HTML. Keep only simple formatting tags, drop every
// attribute, and rebuild links with the same rules as rich(). Headings become
// bold paragraphs so an accidental "Heading 1" can't shout across the page.
const TAGS_OK = new Set(['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'ul', 'ol', 'li', 'blockquote']);
const sanitizeHtml = html => String(html ?? '')
  .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
  .replace(/<[^>]*>/g, tag => {
    const m = tag.match(/^<\s*(\/?)\s*([a-zA-Z0-9]+)([\s\S]*?)\/?>$/);
    if (!m) return '';
    const close = m[1] === '/';
    const name = m[2].toLowerCase();
    if (/^h[1-6]$/.test(name)) return close ? '</strong></p>' : '<p><strong>';
    if (name === 'a') {
      if (close) return '</a>';
      const hm = m[3].match(/href\s*=\s*"([^"]*)"/i) || m[3].match(/href\s*=\s*'([^']*)'/i);
      const href = hm ? hm[1] : '';
      const external = /^(https?:|mailto:)/i.test(href);
      const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(href);
      if (!href || (!external && hasScheme)) return '<a>'; // unsafe href dropped
      const tgt = external && !OWN_SITE.test(href) ? ' target="_blank" rel="noopener"' : '';
      return `<a class="txt-link" href="${href.replace(/"/g, '&quot;')}"${tgt}>`;
    }
    if (!TAGS_OK.has(name)) return '';
    return close ? `</${name}>` : name === 'br' ? '<br>' : `<${name}>`;
  });

// prose fields hold either rich-text HTML (new) or plain text with optional
// [text](url) links (legacy + non-rich fields) — render whichever this is
const HTMLISH = /<\/?(p|br|strong|b|em|i|u|s|ul|ol|li|blockquote|a|h[1-6])[\s>/]/i;
const prose = v => HTMLISH.test(String(v ?? '')) ? emphasize(educateHtml(sanitizeHtml(v))) : rich(v);

// ---------- shared pieces ----------

// image inside a split; empty src → omitted (section becomes centered column)
const splitImg = (src, alt) => src
  ? `      <img class="split__img" src="${esc(src)}" alt="${esc(alt)}">`
  : '';

// bold arrowed row; arrow + link only when a url is set
const ARROW_SVG = `<svg class="linklist__arrow" viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="M2.5 9.5 L9.5 2.5 M4 2.5 H9.5 V8" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>`;
// the spur star — same mark as the save-the-dates; spins once, rowel-style
const FAV_STAR = `<svg class="fav-star" viewBox="0 0 34 34" role="img" aria-label="one of our favorites"><path d="M16.28 4.62L18.92 12.43L26.29 8.79L21.74 15.66L29.16 18.99L20.97 19.88L22.99 27.83L17.25 21.95L12.06 28.52L13.31 20.26L4.94 20.31L12.08 16.15L6.87 9.61L14.6 12.7Z" fill="currentColor"/></svg>`;
const row = (label, sub, url, fav) => {
  const arrow = url ? ARROW_SVG : '';
  const star = fav ? FAV_STAR : '';
  const main = `<div class="linklist__main"><span class="linklist__label">${esc(label)}</span>${star}${arrow}</div>`;
  // a linked row can't nest another link inside it — keep just the words there
  const subHtml = url ? emphasize(esc(stripLinks(sub))) : rich(sub);
  const subLine = sub ? `\n            <div class="linklist__sub">${subHtml}</div>` : '';
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
            <p class="schD-row__note">${prose(e.note)}</p>` : ''}
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

// getting-here rows fold shut — the words only appear on click. Each option
// holds one or more steps (fly, then ferry…); a step's url becomes a small
// arrowed link under its text so the summary stays a pure toggle.
const PLUS_SVG = `<svg class="linklist__plus" viewBox="0 0 12 12" width="11" height="11" aria-hidden="true"><path d="M6 1.2 V10.8 M1.2 6 H10.8" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>`;

const modeStep = s => {
  const heading = [s.label, s.route].filter(Boolean).join(' — ');
  const paras = String(s.body ?? '').split(/\n\s*\n/).filter(p => p.trim())
    .map(p => `                <p>${rich(p)}</p>`).join('\n');
  const link = s.url ? `
              <a class="linklist__go" href="${esc(s.url)}" target="_blank" rel="noopener"><span>${esc(s.linkText || 'MORE INFO')}</span>${ARROW_SVG}</a>` : '';
  return `            <div class="linklist__step">${heading ? `
              <div class="linklist__stephead">${esc(heading)}</div>` : ''}
              <div class="linklist__sub">
${paras}
              </div>${link}
            </div>`;
};

const modeRows = c.travel.modes.map(m => {
  const steps = (m.steps || []).map(modeStep).join('\n');
  // optional route-map visual at the bottom of the expanded panel
  const img = m.image
    ? `\n              <img class="linklist__visual" src="${m.image}" alt="${esc(m.imageAlt || '')}" loading="lazy">`
    : '';
  return `          <details class="linklist__row linklist__row--fold">
            <summary class="linklist__main">
              <span class="linklist__label">${esc([m.label, m.route].filter(Boolean).join(' — '))}</span>
              ${PLUS_SVG}
            </summary>
            <div class="linklist__fold">
${steps}${img}
            </div>
          </details>`;
}).join('\n');

const stayRows = c.travel.stays
  .map(s => row(s.name, s.desc, s.url))
  .join('\n');

const staySection = c.travel.stayHidden ? '' : `    <section class="split split--flip">
      <div class="split__txt">
        <h2>${esc(c.travel.stayTitle)}</h2>
        <p class="split__intro">${prose(c.travel.stayIntro)}</p>
        <div class="linklist">
${stayRows}
        </div>
      </div>
${splitImg(c.travel.stayPhoto, c.travel.stayPhotoAlt)}
    </section>`;

// ---------- things to do ----------

// alternating split sections; each row can carry the fav star
const thingsSections = (c.things.sections || []).map((s, i) => {
  const rows = (s.items || []).map(it => row(it.name, it.desc, it.url, it.fav)).join('\n');
  const intro = s.intro ? `
        <p class="split__intro">${prose(s.intro)}</p>` : '';
  const flip = i % 2 ? ' split--flip' : '';
  return `    <section class="split split--compact${flip}">
      <div class="split__txt">
        <h2>${esc(s.title)}</h2>${intro}
        <div class="linklist">
${rows}
        </div>
      </div>
${splitImg(s.photo, s.photoAlt)}
    </section>`;
}).join('\n\n');

// the key only appears once something is actually starred
const thingsKey = (c.things.sections || []).some(s => (s.items || []).some(it => it.fav))
  ? `        <div class="fav-key">${FAV_STAR}<span>= ${esc(c.things.favKey || 'OUR FAV')}</span></div>`
  : '';

// ---------- pages + nav (hidden pages drop out of the menu) ----------

const PAGES = [
  { file: 'index.html', label: 'HOME', hidden: false },
  { file: 'schedule.html', label: 'SCHEDULE', hidden: !!c.schedule.hidden },
  { file: 'travel.html', label: 'TRAVEL', hidden: !!c.travel.hidden },
  { file: 'things.html', label: 'THINGS TO DO', hidden: !!c.things.hidden },
  { file: 'registry.html', label: 'REGISTRY', hidden: !!c.registry.hidden },
  { file: 'faq.html', label: 'FAQ', hidden: !!c.faq.hidden },
];

const DEFAULT_ORDER = ['schedule', 'travel', 'things', 'registry', 'faq'];
const KEY_TO_FILE = { schedule: 'schedule.html', travel: 'travel.html', things: 'things.html', registry: 'registry.html', faq: 'faq.html' };
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
            <div class="faq__a">${prose(i.a)}</div>
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
  RSVP_INTRO: prose(c.rsvp.intro),
  RSVP_DEADLINE: c.rsvp.deadline
    ? `          <div class="rsvpF__deadline">${esc(c.rsvp.deadline)}</div>`
    : '',
  RSVP_WEDDING_LABEL: esc(c.rsvp.weddingLabel),
  RSVP_ACCEPT: esc(c.rsvp.acceptLabel),
  RSVP_DECLINE: esc(c.rsvp.declineLabel),
  RSVP_WELCOME_LABEL: esc(c.rsvp.welcomeLabel),
  RSVP_WELCOME_YES: esc(c.rsvp.welcomeYes),
  RSVP_WELCOME_NO: esc(c.rsvp.welcomeNo),
  RSVP_THANKS_TITLE: esc(c.rsvp.thanksTitle),
  RSVP_THANKS_NOTE: esc(c.rsvp.thanksNote),
  // JS string literals, not HTML — JSON-encoded so quotes can't break the script
  RSVP_VIDEO_ID: JSON.stringify(
    ((c.rsvp.video || '').match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/)([A-Za-z0-9_-]{11})/) || [])[1] || ''
  ),
  RSVP_SCRIPT_URL: JSON.stringify(c.rsvp.scriptUrl || ''),
  RSVP_ACCEPT_JS: JSON.stringify(c.rsvp.acceptLabel),
  RSVP_DECLINE_JS: JSON.stringify(c.rsvp.declineLabel),
  RSVP_WELCOME_YES_JS: JSON.stringify(c.rsvp.welcomeYes),
  RSVP_WELCOME_NO_JS: JSON.stringify(c.rsvp.welcomeNo),
  RSVP_WEDDING_LABEL_JS: JSON.stringify(c.rsvp.weddingLabel),
  RSVP_WELCOME_LABEL_JS: JSON.stringify(c.rsvp.welcomeLabel),
  RSVP_FTRANS_LABEL_JS: JSON.stringify(c.rsvp.ftransLabel || ''),
  RSVP_STRANS_LABEL_JS: JSON.stringify(c.rsvp.stransLabel || ''),
  RSVP_TRANS_YES_JS: JSON.stringify(c.rsvp.transYes || ''),
  RSVP_TRANS_NO_JS: JSON.stringify(c.rsvp.transNo || ''),
  RSVP_LOCKED_NOTE_JS: JSON.stringify(c.rsvp.lockedNote || ''),
  TRAVEL_EYEBROW: esc(c.travel.eyebrow),
  TRAVEL_TITLE: esc(c.travel.title),
  TRAVEL_INTRO: prose(c.travel.intro),
  TRAVEL_PHOTO: splitImg(c.travel.photo, c.travel.photoAlt),
  TRAVEL_MODES: modeRows,
  // the maps section — static images, fully CMS-managed (toggle, heading,
  // and both map files via travel.journeyMap / travel.islandsMap)
  MAPS_SECTION: c.travel.mapsHidden ? '' : `
    <section class="mapstory">
      <h2 class="mapstory__title">${esc(c.travel.mapTitle || 'GETTING HERE')}</h2>
      <div class="mapstory__duo">
        <figure class="mapstory__map mapstory__map--region">
          <img class="mapstory__img" src="${c.travel.journeyMap || 'images/journey-map.svg'}" alt="${esc(c.travel.journeyMapAlt || '')}" loading="lazy">
        </figure>
        <figure class="mapstory__map mapstory__map--islands">
          <img class="mapstory__img" src="${c.travel.islandsMap || 'images/islands-map.svg'}" alt="${esc(c.travel.islandsMapAlt || '')}" loading="lazy">
        </figure>
      </div>
    </section>`,
  // static maps need no animation script; the shared lightbox in the
  // template handles fullscreen (kept as a token in case animation returns)
  MAPS_SCRIPTS: '',
  STAY_SECTION: staySection,
  THINGS_EYEBROW: esc(c.things.eyebrow),
  THINGS_TITLE: esc(c.things.title),
  THINGS_INTRO: prose(c.things.intro),
  THINGS_KEY: thingsKey,
  THINGS_SECTIONS: thingsSections,
  REGISTRY_EYEBROW: esc(c.registry.eyebrow),
  REGISTRY_TITLE: esc(c.registry.title),
  REGISTRY_NOTE: prose(c.registry.note),
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
  // Vercel Web Analytics — the /_vercel/insights/ route only exists on the deployed site
  html = html.replace('</head>', '  <script defer src="/_vercel/insights/script.js"></script>\n</head>');
  html = html.replace('href="styles.css"', `href="styles.css?v=${CSS_V}"`);
  for (const m of ['maps/travel-map.css', 'maps/travel-map.js']) {
    if (fs.existsSync(path.join(ROOT, m))) {
      html = html.split(`"${m}"`).join(`"${m}?v=${hashOf(m)}"`);
    }
  }
  for (const font of FONTS) {
    html = html.replace(`href="${font}"`, `href="${font}?v=${FONT_V[font]}"`);
  }
  for (const a of HASHED_ASSETS) {
    html = html.split(`"${a}"`).join(`"${a}?v=${ASSET_V[a]}"`);
  }
  fs.writeFileSync(path.join(DIST, f), html);
}

for (const dir of ['images', 'fonts', 'maps']) {
  fs.cpSync(path.join(ROOT, dir), path.join(DIST, dir), { recursive: true });
}
fs.copyFileSync(path.join(ROOT, 'styles.css'), path.join(DIST, 'styles.css'));
// the "set a calendar reminder" link on the travel page
fs.copyFileSync(path.join(ROOT, 'ferry-reminder.ics'), path.join(DIST, 'ferry-reminder.ics'));

console.log('Built', fs.readdirSync(DIST).join(', '));
