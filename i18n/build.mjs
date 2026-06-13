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
const CAT_CONTENT = readJSON(path.join(__dirname, 'data', 'catalogo-content.json'));
const CAT_I18N = readJSON(path.join(__dirname, 'data', 'catalogo-i18n.json'));
const CAT_TERMS = readJSON(path.join(__dirname, 'data', 'catalogo-terms.json'));
const LEGAL = readJSON(path.join(__dirname, 'data', 'legal-i18n.json'));
const CAT_BY_SLUG = {};
for (const c of CAT_CONTENT.categorias) CAT_BY_SLUG[c.slug] = c;
const LEGAL_DOCS = ['aviso-legal', 'politica-privacidad', 'politica-cookies'];
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

// Helper: fija head (SEO/OG/hreflang/canonical/switcher) para una pagePath dada
function setHead(ctx, lang, pagePath, seo, ogImage) {
  Object.assign(ctx, altUrls(pagePath));
  ctx.canonical = `${DOMAIN}/${lang}/${pagePath}`;
  ctx.ogImage = ogImage || `${DOMAIN}/assets/images/marca/og-image.jpg`;
  ctx.seoTitle = seo.title;
  ctx.seoDesc = seo.desc;
  ctx.seoKeywords = seo.keywords || '';
  ctx.ogTitle = seo.ogTitle || seo.title;
  ctx.ogDesc = seo.ogDesc || seo.desc;
  ctx.twTitle = seo.ogTitle || seo.title;
  ctx.twDesc = seo.ogDesc || seo.desc;
  ctx.schema = seo.schema || '';
  ctx.loader = '';
  ctx.langSwitcher = langSwitcher(lang, pagePath);
  ctx.langSwitcherNav = langSwitcher(lang, pagePath);
}

function breadcrumbLD(items) {
  return ld({
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    "itemListElement": items.map((it, i) => ({ "@type": "ListItem", "position": i + 1, "name": it.name, "item": it.url }))
  });
}

function renderCatIndex(lang) {
  const ctx = baseContext(lang, 'catalogo');
  const ci = STRINGS[lang].catIndex;
  const pagePath = 'catalogo/';
  setHead(ctx, lang, pagePath, {
    title: ci.seoTitle, desc: ci.seoDesc, keywords: ci.seoKeywords, ogTitle: ci.ogTitle, ogDesc: ci.ogDesc,
    schema: breadcrumbLD([
      { name: STRINGS[lang].nav.inicio, url: `${DOMAIN}/${lang}/` },
      { name: ci.h1, url: `${DOMAIN}/${lang}/catalogo/` }
    ])
  }, `${DOMAIN}/assets/images/stock/vinedo-rioja-1.webp`);
  let main = render(tpl('catalogo-index'), ctx);
  main = main.replace('{{catCards}}', catCards(lang, `/${lang}/catalogo/`));
  ctx.main = main;
  writePage(lang, pagePath, render(tpl('base'), ctx));
}

// Genera el HTML de los grupos de producto de una categoria
function productGroups(lang, slug) {
  const c = CAT_BY_SLUG[slug];
  const termG = CAT_TERMS.groups, termS = CAT_TERMS.subs;
  return c.groups.map((g, gi) => {
    const title = lang === 'es' ? g.title : (termG[g.title] ? termG[g.title][lang] : g.title);
    const eus = g.eus ? ` <span class="basque-note">· ${g.eus}</span>` : '';
    const count = g.blocks.filter(b => b.type === 'list').reduce((n, b) => n + b.items.length, 0);
    const open = g.open ? ' open' : '';
    let inner = '';
    g.blocks.forEach(b => {
      if (b.type === 'h4') {
        const h4 = lang === 'es' ? b.es : (termS[b.es] ? termS[b.es][lang] : b.es);
        const h4eus = b.eus ? ` <span class="basque-note">· ${b.eus}</span>` : '';
        inner += `            <div style="padding: var(--s2) var(--s4) var(--s2);"><h4>${h4}${h4eus}</h4></div>\n`;
      } else {
        inner += '            <ul class="product-list">\n';
        b.items.forEach(it => { inner += `              <li>${it}</li>\n`; });
        inner += '            </ul>\n';
      }
    });
    return `          <details class="product-group" data-collapsible data-reveal${open}>
            <summary>${title}${eus} <span class="count">${count} ${STRINGS[lang].common.referencias}</span> <span class="chev" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m6 9 6 6 6-6"/></svg></span></summary>
${inner}            <button class="show-more btn btn--ghost" aria-expanded="false"><span>${STRINGS[lang].common.verTodo}</span></button>
          </details>`;
  }).join('\n');
}

function relatedCards(lang, slugs) {
  return slugs.map(slug => {
    const c = CATALOGO.categorias.find(x => x.slug === slug);
    const title = STRINGS[lang].cat[slug];
    return `          <a class="cat-card" href="/${lang}/catalogo/${slug}/" data-reveal>
            <img src="/assets/images/categorias/${c.image}" alt="${title} — ${c.eus}" loading="lazy" width="800" height="600">
            <div class="cat-card-body">
              <div><span class="cat-card-title">${title}</span><span class="cat-card-eus">${c.eus}</span></div>
              <span class="cat-card-arrow" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>
            </div>
          </a>`;
  }).join('\n');
}

function renderCategoria(lang, slug) {
  const ctx = baseContext(lang, 'catalogo');
  const c = CAT_BY_SLUG[slug];
  const meta = CATALOGO.categorias.find(x => x.slug === slug);
  const i18n = lang === 'es' ? null : CAT_I18N[slug][lang];
  const catTitle = STRINGS[lang].cat[slug];
  const pagePath = `catalogo/${slug}/`;

  // Textos por idioma (es viene de CAT_CONTENT; otros de CAT_I18N)
  const heroLead = lang === 'es' ? c.heroLead : i18n.heroLead;
  const introH2 = lang === 'es' ? c.introH2 : i18n.introH2;
  const introLead = lang === 'es' ? c.introLead : i18n.introLead;
  const ctaH2 = lang === 'es' ? c.ctaH2 : i18n.ctaH2;
  const ctaLead = lang === 'es' ? c.ctaLead : i18n.ctaLead;

  // SEO: es de CAT_CONTENT.seo; otros reutilizan title pattern traducido
  const seo = lang === 'es'
    ? { title: c.seo.title, desc: c.seo.desc, keywords: c.seo.keywords, ogTitle: c.seo.ogTitle, ogDesc: c.seo.ogDesc }
    : { title: `${catTitle} | Manuel Taberna Edariak`, desc: introLead, ogTitle: `${catTitle} | Manuel Taberna Edariak`, ogDesc: heroLead };
  seo.schema = breadcrumbLD([
    { name: STRINGS[lang].nav.inicio, url: `${DOMAIN}/${lang}/` },
    { name: STRINGS[lang].nav.catalogo, url: `${DOMAIN}/${lang}/catalogo/` },
    { name: catTitle, url: `${DOMAIN}/${lang}/catalogo/${slug}/` }
  ]);
  const ogImg = c.seo.ogImage ? c.seo.ogImage.replace(/^https?:\/\/[^/]+/, DOMAIN) : `${DOMAIN}/assets/images/categorias/${meta.image}`;
  setHead(ctx, lang, pagePath, seo, ogImg);

  ctx.catTitle = catTitle;
  ctx.catTitleLower = catTitle.toLowerCase();
  ctx.catEus = meta.eus;
  ctx.heroLead = heroLead;
  ctx.introH2 = introH2;
  ctx.introLead = introLead;
  ctx.introImg = c.introImg ? c.introImg.src : `/assets/images/categorias/${meta.image}`;
  ctx.introImgAlt = catTitle;
  ctx.ctaH2 = ctaH2;
  ctx.ctaLead = ctaLead;
  ctx.ctaImg = c.ctaImg ? c.ctaImg.src : `/assets/images/categorias/${meta.image}`;
  ctx.ctaImgAlt = catTitle;

  // hero media: video si existe, si no imagen
  ctx.heroMedia = meta.video
    ? `        <video autoplay muted loop playsinline preload="metadata" poster="/assets/images/categorias/${meta.image}">\n          <source src="/assets/videos/${meta.video}" type="video/mp4">\n        </video>`
    : `        <img src="/assets/images/categorias/${meta.image}" alt="" width="1600" height="900" fetchpriority="high">`;

  let main = render(tpl('categoria'), ctx);
  main = main.replace('{{productGroups}}', productGroups(lang, slug));
  main = main.replace('{{relatedCards}}', relatedCards(lang, c.related));
  ctx.main = main;
  writePage(lang, pagePath, render(tpl('base'), ctx));
}

function renderEmpresa(lang) {
  const ctx = baseContext(lang, 'empresa');
  const e = STRINGS[lang].empresa;
  const pagePath = 'empresa/';
  setHead(ctx, lang, pagePath, {
    title: e.seoTitle, desc: e.seoDesc, keywords: e.seoKeywords, ogTitle: e.ogTitle, ogDesc: e.ogDesc,
    schema: breadcrumbLD([
      { name: STRINGS[lang].nav.inicio, url: `${DOMAIN}/${lang}/` },
      { name: e.h1, url: `${DOMAIN}/${lang}/empresa/` }
    ])
  }, `${DOMAIN}/assets/images/stock/bera-navarra-1.webp`);
  ctx.main = render(tpl('empresa'), ctx);
  writePage(lang, pagePath, render(tpl('base'), ctx));
}

function renderContacto(lang) {
  const ctx = baseContext(lang, 'contacto');
  const co = STRINGS[lang].contacto;
  const pagePath = 'contacto/';
  setHead(ctx, lang, pagePath, {
    title: co.seoTitle, desc: co.seoDesc, keywords: co.seoKeywords, ogTitle: co.ogTitle, ogDesc: co.ogDesc,
    schema: breadcrumbLD([
      { name: STRINGS[lang].nav.inicio, url: `${DOMAIN}/${lang}/` },
      { name: co.h1, url: `${DOMAIN}/${lang}/contacto/` }
    ])
  }, `${DOMAIN}/assets/images/stock/bera-navarra-2.webp`);
  let main = render(tpl('contacto'), ctx);
  main = main.replace('{{relatedCards}}', relatedCards(lang, ['vinos', 'cervezas', 'refrescos']));
  ctx.main = main;
  writePage(lang, pagePath, render(tpl('base'), ctx));
}

function renderLegal(lang, doc) {
  const ctx = baseContext(lang, '');
  const L = LEGAL[doc][lang];
  const pagePath = `${doc}/`;
  setHead(ctx, lang, pagePath, {
    title: L.title, desc: L.desc,
    schema: breadcrumbLD([
      { name: STRINGS[lang].nav.inicio, url: `${DOMAIN}/${lang}/` },
      { name: L.h1, url: `${DOMAIN}/${lang}/${doc}/` }
    ])
  });
  ctx.legalH1 = L.h1;
  ctx.legalLead = L.lead;
  ctx.legalBody = L.body;
  ctx.main = render(tpl('legal'), ctx);
  writePage(lang, pagePath, render(tpl('base'), ctx));
}

// ---- Sitemap con hreflang ----
function buildSitemap() {
  const paths = ['', 'catalogo/', 'empresa/', 'contacto/',
    ...CATALOGO.categorias.map(c => `catalogo/${c.slug}/`),
    'aviso-legal/', 'politica-privacidad/', 'politica-cookies/'];
  const today = '2026-06-13';
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n';
  for (const lang of LANGS) {
    for (const p of paths) {
      const loc = `${DOMAIN}/${lang}/${p}`;
      xml += `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${today}</lastmod>\n`;
      for (const alt of LANGS) xml += `    <xhtml:link rel="alternate" hreflang="${alt}" href="${DOMAIN}/${alt}/${p}"/>\n`;
      xml += `    <xhtml:link rel="alternate" hreflang="x-default" href="${DOMAIN}/${DEFAULT_LANG}/${p}"/>\n`;
      xml += '  </url>\n';
    }
  }
  xml += '</urlset>\n';
  fs.writeFileSync(path.join(OUT, 'sitemap.xml'), xml, 'utf8');
  console.log('  ✓ sitemap.xml (' + (LANGS.length * paths.length) + ' URLs)');
}

// ---- Run ----
console.log(`build.mjs → out: ${path.relative(ROOT, OUT) || '.'} — langs: ${buildLangs.join(', ')}`);
for (const lang of buildLangs) {
  if (!STRINGS[lang]) { console.warn('  ! sin strings para', lang, '— saltado'); continue; }
  console.log('•', lang);
  renderHome(lang);
  renderCatIndex(lang);
  for (const c of CATALOGO.categorias) renderCategoria(lang, c.slug);
  renderEmpresa(lang);
  renderContacto(lang);
  for (const doc of LEGAL_DOCS) renderLegal(lang, doc);
}
if (!only) buildSitemap();
console.log('Listo.');
