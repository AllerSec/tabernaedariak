import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const LANGS = ['eu', 'es', 'en', 'fr'];
const DEFAULT_LANG = 'eu';

// ---- CLI args ----
const args = process.argv.slice(2);
const only = (args.find(a => a.startsWith('--only=')) || '').split('=')[1];
const outArg = (args.find(a => a.startsWith('--out=')) || '').split('=')[1];
const OUT = outArg ? path.resolve(ROOT, outArg) : ROOT;
const buildLangs = only ? only.split(',') : LANGS;

// ---- Load sources ----
const readJSON = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const SITE = readJSON(path.join(__dirname, 'data', 'site.json'));
const CATALOGO = readJSON(path.join(__dirname, 'data', 'catalogo.json'));
const STRINGS = {};
for (const lang of LANGS) {
  const f = path.join(__dirname, 'strings', `${lang}.json`);
  if (fs.existsSync(f)) STRINGS[lang] = readJSON(f);
}
const tpl = (name) => fs.readFileSync(path.join(__dirname, 'templates', `${name}.html`), 'utf8');

// ---- Helpers ----
const DOMAIN = SITE.domain;

// flatten nested strings into "a.b.c" keys
function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else out[key] = v;
  }
  return out;
}

// site-level interpolation tokens reused inside string values
function siteTokens(lang) {
  return {
    tel1: SITE.tel1, tel1Display: SITE.tel1Display,
    tel2: SITE.tel2, tel2Display: SITE.tel2Display,
    email: SITE.email,
    tel1Link: `<a href="tel:${SITE.tel1}" class="link-line">${SITE.tel1Display}</a>`,
    tel2Link: `<a href="tel:${SITE.tel2}" class="link-line">${SITE.tel2Display}</a>`,
    emailLink: `<a href="mailto:${SITE.email}" class="link-line">${SITE.email}</a>`
  };
}

// interpolate {token} placeholders inside a string value
function interp(value, tokens) {
  if (typeof value !== 'string') return value;
  return value.replace(/\{(\w+)\}/g, (m, k) => (k in tokens ? tokens[k] : m));
}

// Build the full replacement map for one page render
function baseContext(lang, current) {
  const flat = flatten(STRINGS[lang]);
  const tokens = siteTokens(lang);
  const ctx = {};
  // localized strings (interpolated)
  for (const [k, v] of Object.entries(flat)) ctx[k] = interp(v, tokens);
  // site data
  ctx.lang = lang;
  ctx.localeOG = STRINGS[lang]._localeOG;
  ctx.tel1 = SITE.tel1; ctx.tel1Display = SITE.tel1Display;
  ctx.tel2 = SITE.tel2; ctx.tel2Display = SITE.tel2Display;
  ctx.email = SITE.email; ctx.fax = SITE.fax;
  ctx.addressShort = SITE.address.streetShort;
  ctx.postalCode = SITE.address.postalCode;
  ctx.locality = SITE.address.locality;
  ctx.region = SITE.address.region;
  // active nav
  ctx.currentInicio = current === 'inicio' ? ' aria-current="page"' : '';
  ctx.currentCatalogo = current === 'catalogo' ? ' aria-current="page"' : '';
  ctx.currentEmpresa = current === 'empresa' ? ' aria-current="page"' : '';
  ctx.currentContacto = current === 'contacto' ? ' aria-current="page"' : '';
  return ctx;
}

// Replace {{key}} (and {{a.b}}) markers. Leaves unknown markers as-is for debugging.
function render(template, ctx) {
  return template.replace(/\{\{([\w.]+)\}\}/g, (m, key) => (key in ctx ? ctx[key] : m));
}

// Language switcher: links to the SAME page path in the other languages.
// pagePath is the path AFTER /<lang>/  (e.g. "" for home, "catalogo/" etc.)
function langSwitcher(lang, pagePath) {
  return LANGS.map(l => {
    const active = l === lang ? ' is-active' : '';
    const aria = l === lang ? ' aria-current="true"' : '';
    const label = STRINGS[l] ? STRINGS[l]._name : l;
    const code = l.toUpperCase();
    return `<a class="lang-opt${active}" href="/${l}/${pagePath}" hreflang="${l}"${aria} title="${label}">${code}</a>`;
  }).join('');
}

// hreflang alternates for a given page path
function altUrls(pagePath) {
  return {
    altEu: `${DOMAIN}/eu/${pagePath}`,
    altEs: `${DOMAIN}/es/${pagePath}`,
    altEn: `${DOMAIN}/en/${pagePath}`,
    altFr: `${DOMAIN}/fr/${pagePath}`
  };
}

// Catalogue cards block (used in home + catalogo index). relBase is the href prefix.
function catCards(lang, hrefPrefix) {
  return CATALOGO.categorias.map(c => {
    const title = STRINGS[lang].cat[c.slug];
    return `          <a class="cat-card" href="${hrefPrefix}${c.slug}/" data-reveal>
            <img src="/assets/images/categorias/${c.image}" alt="${title} — ${c.eus}" loading="lazy" width="800" height="600">
            <div class="cat-card-body">
              <div><span class="cat-card-title">${title}</span><span class="cat-card-eus">${c.eus}</span></div>
              <span class="cat-card-arrow" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>
            </div>
          </a>`;
  }).join('\n');
}

function loaderBlock() {
  return `  <div class="loader" id="loader" aria-hidden="true">
    <div class="loader-inner">
      <div class="loader-dots"><i></i><i></i><i></i><i></i><i></i><i></i></div>
      <span class="loader-word">Edariak</span>
    </div>
  </div>
`;
}

function writePage(lang, pagePath, html) {
  const dir = path.join(OUT, lang, pagePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf8');
  console.log('  ✓', path.relative(ROOT, path.join(dir, 'index.html')));
}

// ---- Schema builders ----
function homeSchema(lang) {
  const s = STRINGS[lang];
  const business = {
    "@context": "https://schema.org",
    "@type": ["WholesaleStore", "LocalBusiness"],
    "@id": `${DOMAIN}/#negocio`,
    "name": "Manuel Taberna Edariak",
    "legalName": SITE.legalName,
    "description": s.home.ogDesc,
    "url": `${DOMAIN}/${lang}/`,
    "logo": `${DOMAIN}/assets/images/marca/og-image.jpg`,
    "image": `${DOMAIN}/assets/images/marca/og-image.jpg`,
    "foundingDate": SITE.foundingYear,
    "vatID": SITE.vatID,
    "telephone": SITE.tel1,
    "email": SITE.email,
    "address": {
      "@type": "PostalAddress",
      "streetAddress": SITE.address.street,
      "addressLocality": SITE.address.locality,
      "addressRegion": SITE.address.region,
      "postalCode": SITE.address.postalCode,
      "addressCountry": SITE.address.country
    },
    "geo": { "@type": "GeoCoordinates", "latitude": SITE.geo.lat, "longitude": SITE.geo.lng },
    "openingHoursSpecification": {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      "opens": "08:00", "closes": "15:00"
    },
    "brand": SITE.brands.map(b => ({ "@type": "Brand", "name": b })),
    "sameAs": [SITE.facebook]
  };
  const faq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [1, 2, 3, 4].map(n => ({
      "@type": "Question",
      "name": s.home[`faq${n}Q`],
      "acceptedAnswer": { "@type": "Answer", "text": stripTags(interp(s.home[`faq${n}A`], siteTokens(lang))) }
    }))
  };
  return ld(business) + '\n' + ld(faq);
}
function stripTags(str) { return String(str).replace(/<[^>]+>/g, ''); }
function ld(obj) {
  return '  <script type="application/ld+json">\n  ' + JSON.stringify(obj, null, 2).replace(/\n/g, '\n  ') + '\n  </script>';
}

// ---- Page renderers ----
function renderHome(lang) {
  const ctx = baseContext(lang, 'inicio');
  const pagePath = '';
  Object.assign(ctx, altUrls(pagePath));
  ctx.canonical = `${DOMAIN}/${lang}/`;
  ctx.ogImage = `${DOMAIN}/assets/images/marca/og-image.jpg`;
  ctx.seoTitle = ctx['home.seoTitle'];
  ctx.seoDesc = ctx['home.seoDesc'];
  ctx.seoKeywords = ctx['home.seoKeywords'];
  ctx.ogTitle = ctx['home.ogTitle'];
  ctx.ogDesc = ctx['home.ogDesc'];
  ctx.twTitle = ctx['home.twTitle'];
  ctx.twDesc = ctx['home.twDesc'];
  ctx.schema = homeSchema(lang);
  ctx.loader = loaderBlock();
  ctx.langSwitcher = langSwitcher(lang, pagePath);
  ctx.langSwitcherNav = langSwitcher(lang, pagePath);

  let main = render(tpl('home'), ctx);
  main = main.replace('{{catCards}}', catCards(lang, `/${lang}/catalogo/`));
  ctx.main = main;

  const html = render(tpl('base'), ctx);
  writePage(lang, pagePath, html);
}

// ---- Run ----
console.log(`build.mjs → out: ${path.relative(ROOT, OUT) || '.'} — langs: ${buildLangs.join(', ')}`);
for (const lang of buildLangs) {
  if (!STRINGS[lang]) { console.warn('  ! sin strings para', lang, '— saltado'); continue; }
  console.log('•', lang);
  renderHome(lang);
}
console.log('Listo.');
