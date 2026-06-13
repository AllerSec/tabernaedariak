// Script de un solo uso: extrae la estructura de las 18 paginas de categoria
// del sitio ES actual hacia data/catalogo-content.json (datos + textos ES).
// No se publica; sirve para construir catalogo.json y los strings de categoria.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const SLUGS = ['vinos','cervezas','whiskies','licores','ginebra-vodka-ron-tequila',
  'anis-brandy-pacharan','refrescos','cavas','sidra-txakoli','aperitivos','cafes',
  'leche','aguas','cristaleria','aceite','conservas','zumos-jarabes','miniaturas'];

const dec = (s) => s
  .replace(/&amp;/g, '&').replace(/&aacute;/g,'á').replace(/&eacute;/g,'é')
  .replace(/&iacute;/g,'í').replace(/&oacute;/g,'ó').replace(/&uacute;/g,'ú')
  .replace(/&ntilde;/g,'ñ').replace(/&nbsp;/g,' ').replace(/&#39;/g,"'").trim();

function extract(slug) {
  const html = fs.readFileSync(path.join(ROOT, 'catalogo', slug, 'index.html'), 'utf8');
  const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));

  const out = { slug };

  // Hero h1 lead
  const h1 = main.match(/<h1>([^<]*)<span class="basque-note"[^>]*>([^<]*)<\/span>/);
  out.h1 = h1 ? dec(h1[1]) : slug;
  out.eus = h1 ? dec(h1[2]) : '';
  const heroLead = main.match(/<\/h1>\s*<p class="lead">([\s\S]*?)<\/p>/);
  out.heroLead = heroLead ? dec(heroLead[1]) : '';

  // Intro eyebrow/h2/lead
  const introH2 = main.match(/Nuestra selección<\/span>\s*<h2 data-reveal>([\s\S]*?)<\/h2>\s*<p class="lead" data-reveal>([\s\S]*?)<\/p>/);
  out.introH2 = introH2 ? dec(introH2[1]) : '';
  out.introLead = introH2 ? dec(introH2[2]) : '';
  const introImg = main.match(/Nuestra selección[\s\S]*?<img src="([^"]+)" alt="([^"]*)"/);
  out.introImg = introImg ? { src: introImg[1].replace(/\.\.\/\.\.\//,'/'), alt: dec(introImg[2]) } : null;

  // Listado: titulo seccion
  const listHead = main.match(/Referencias<\/span>\s*<h2>([\s\S]*?)<\/h2>\s*<p class="lead">([\s\S]*?)<\/p>/);
  out.listTitle = listHead ? dec(listHead[1]) : '';
  out.listLead = listHead ? dec(listHead[2]) : '';

  // Grupos de producto
  out.groups = [];
  const groupRe = /<details class="product-group"([^>]*)>([\s\S]*?)<\/details>/g;
  let gm;
  while ((gm = groupRe.exec(main))) {
    const attrs = gm[1];
    const body = gm[2];
    const sum = body.match(/<summary>([\s\S]*?)<\/summary>/);
    let title = '', eus = '';
    if (sum) {
      const raw = sum[1];
      const eusM = raw.match(/<span class="basque-note">·?\s*([^<]*)<\/span>/);
      eus = eusM ? dec(eusM[1]) : '';
      title = dec(raw.replace(/<span class="basque-note">[\s\S]*?<\/span>/,'')
        .replace(/<span class="count">[\s\S]*?<\/span>/,'')
        .replace(/<span class="chev"[\s\S]*$/,''));
    }
    // subtitulos h4 + listas, en orden
    const blocks = [];
    const partRe = /<h4>([\s\S]*?)<\/h4>|<ul class="product-list">([\s\S]*?)<\/ul>/g;
    let pm;
    while ((pm = partRe.exec(body))) {
      if (pm[1] !== undefined) {
        const h4 = dec(pm[1]);
        const eusH = h4.match(/·\s*(.+)$/);
        blocks.push({ type: 'h4', es: dec(h4.replace(/·.*$/,'')), eus: eusH ? dec(eusH[1]) : '' });
      } else {
        const items = [];
        const liRe = /<li>([\s\S]*?)<\/li>/g; let lm;
        while ((lm = liRe.exec(pm[2]))) items.push(dec(lm[1]));
        blocks.push({ type: 'list', items });
      }
    }
    const open = /\bopen\b/.test(attrs);
    out.groups.push({ title, eus, open, blocks });
  }

  // CTA final (eyebrow personalizado + h2 + lead) — segundo split tras el listado
  const cta = main.match(/¿Buscas algo concreto\?[\s\S]*?<\/span>\s*<h2 data-reveal>([\s\S]*?)<\/h2>\s*<p class="lead" data-reveal>([\s\S]*?)<\/p>/);
  if (cta) { out.ctaEyebrow = '¿Buscas algo concreto?'; out.ctaH2 = dec(cta[1]); out.ctaLead = dec(cta[2]); }
  const ctaImg = main.match(/<!-- Imagen ambiental[\s\S]*?<img src="([^"]+)" alt="([^"]*)"/);
  out.ctaImg = ctaImg ? { src: ctaImg[1].replace(/\.\.\/\.\.\//,'/'), alt: dec(ctaImg[2]) } : null;

  // Categorias relacionadas (slugs)
  out.related = [];
  const relRe = /<a class="cat-card" href="\.\.\/([^/"]+)\//g; let rm;
  while ((rm = relRe.exec(main))) out.related.push(rm[1]);

  // SEO del <head>
  const head = html.slice(0, html.indexOf('</head>'));
  const g = (re) => { const m = head.match(re); return m ? dec(m[1]) : ''; };
  out.seo = {
    title: g(/<title>([\s\S]*?)<\/title>/),
    desc: g(/<meta name="description" content="([\s\S]*?)">/),
    keywords: g(/<meta name="keywords" content="([\s\S]*?)">/),
    ogTitle: g(/<meta property="og:title" content="([\s\S]*?)">/),
    ogDesc: g(/<meta property="og:description" content="([\s\S]*?)">/),
    ogImage: (head.match(/<meta property="og:image" content="([\s\S]*?)">/)||[])[1] || ''
  };

  return out;
}

const data = { categorias: SLUGS.map(extract) };
fs.writeFileSync(path.join(__dirname, 'data', 'catalogo-content.json'), JSON.stringify(data, null, 2), 'utf8');
console.log('Extraidas', data.categorias.length, 'categorias →');
for (const c of data.categorias) {
  console.log(' -', c.slug, '|', c.groups.length, 'grupos |', c.groups.reduce((n,g)=>n+g.blocks.filter(b=>b.type==='list').reduce((m,b)=>m+b.items.length,0),0), 'items | rel:', c.related.join(','));
}
