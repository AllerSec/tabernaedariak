# Web multiidioma (EU · ES · EN · FR) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir el sitio estático de Manuel Taberna Edariak (26 páginas, hoy solo en español) en un sitio multiidioma real con páginas indexables por idioma — euskara (raíz/por defecto), español, inglés y francés — sin perder el diseño, las animaciones ni el SEO actual.

**Architecture:** Sitio estático puro servido en `.eus` (Netlify). Decisión de producto tomada por el usuario: **páginas reales por idioma** bajo prefijos de ruta (`/`=eu, `/es/`, `/en/`, `/fr/`), **euskara como idioma por defecto en la raíz**. Para que sea mantenible (1 cambio en vez de 104), NO se escriben 104 HTML a mano: se construye un **generador estático en Node** que combina (a) plantillas de página con marcadores `{{clave}}`, (b) un diccionario de traducción por idioma en JSON, y (c) datos de catálogo (las listas de referencias de producto, que NO se traducen). El generador emite el árbol final de HTML. El `index.html` actual y las páginas existentes se conservan como fuente de la versión española hasta que el generador reproduzca su salida 1:1; luego se sustituyen.

**Tech Stack:** HTML estático, CSS existente (`assets/css/main.css`), JS existente (`assets/js/main.js` + GSAP), Node.js para el script de build (sin dependencias externas: solo `fs`/`path` nativos), `hreflang` + `<link rel="alternate">` para SEO i18n, `_redirects` de Netlify para detección de idioma opcional.

---

## Contexto imprescindible (leer antes de empezar)

- **Estructura actual:** 26 `index.html`. Raíz: `/`, `/catalogo/`, `/empresa/`, `/contacto/`, `/aviso-legal/`, `/politica-privacidad/`, `/politica-cookies/`, más 18 `/catalogo/<categoria>/`. El `404.html` está en la raíz.
- **Rutas relativas:** cada página declara `<meta name="mt-base" content="...">` (`./`, `../`, `../../`) y usa rutas relativas a `assets/`. **Al meter todo bajo `/eu/`, `/es/`… cada página gana un nivel de profundidad**, así que `mt-base` y las rutas a assets se recalculan. Solución del generador: assets viven en `/assets/` (raíz, compartidos por todos los idiomas) y se referencian con ruta **absoluta desde la raíz** (`/assets/...`), eliminando el problema de profundidad por completo. `mt-base` pasa a apuntar a la raíz del idioma (`/eu/`, `/es/`…).
- **Qué se traduce y qué NO:**
  - SÍ se traduce: navegación, botones, eyebrows, titulares, leads, descripciones, FAQ, textos legales, SEO (title/description/keywords/OG/Twitter), `alt` de imágenes, breadcrumbs, aviso de cookies, footer, loader.
  - NO se traduce: nombres de producto/referencias comerciales (p. ej. `RIOTINTO BELTZA ROSCA 3/4`, `MARQUES CACERES CR`), marcas (Heineken…), datos de contacto, dirección, CIF, números de teléfono/fax, email. Las **glosas en euskara** existentes (`Ardoak`, `Garagardoa`…) se mantienen como dato del catálogo, no como traducción.
- **Idiomas y códigos:** eu (por defecto, raíz), es, en, fr. `hreflang`: `eu`, `es`, `en`, `fr`, más `x-default` → eu.
- **JS:** `assets/js/main.js` tiene una lista `pages` hardcodeada en `prefetchSite()` y `data-count`, loader con palabra "Edariak" (marca, no se traduce), textos "Ver todo"/"Ver menos" (líneas 335). Esos dos textos del JS deben localizarse vía `data-*` leídos del HTML.
- **No hay framework ni build actual.** El generador es nuevo y se ejecuta a mano (`node build.mjs`) o en el build de Netlify.

## Estructura de archivos final

```
/                         → redirige a /eu/ (vía _redirects) o sirve eu directamente
/eu/index.html            (home euskara)
/eu/katalogoa/...         ← OJO: ¿slugs traducidos o slugs fijos? Ver Decisión D1
/es/index.html
/en/index.html
/fr/index.html
/assets/...               (compartido, sin cambios de contenido salvo main.js)
/404.html                 (multiidioma: detecta o cae a eu)
/sitemap.xml              (regenerado con las 104 URLs + hreflang)
/robots.txt               (sin cambios salvo loc del sitemap)
/_redirects               (nuevo: / → /eu/, y detección Accept-Language opcional)

# Fuente del generador (no se publica):
/i18n/
  build.mjs               generador estático
  templates/
    base.html             layout común (head, topbar, header, footer, cookie, scripts)
    home.html             bloque <main> de la home
    catalogo-index.html   bloque <main> del índice de catálogo
    categoria.html        bloque <main> de una página de categoría (data-driven)
    empresa.html
    contacto.html
    legal.html            aviso-legal / privacidad / cookies (3 variantes por clave)
  strings/
    eu.json               todas las cadenas de UI/SEO en euskara
    es.json               español (extraído del sitio actual, fuente de verdad inicial)
    en.json
    fr.json
  data/
    catalogo.json         18 categorías: slug, imagen, vídeo, glosa eu, y por idioma
                          {title, lead, seo...}, y las listas de referencias (comunes)
    site.json             datos no traducibles: tel, email, dirección, CIF, horario...
```

## Decisiones abiertas que el ejecutor debe confirmar con el usuario ANTES de Task 4

- **D1 — Slugs de URL por idioma.** ¿`/es/catalogo/vinos/` en todos los idiomas (slugs fijos en español, simple y sin redirects rotos) o slugs traducidos (`/eu/katalogoa/ardoak/`, `/en/catalogue/wines/`)? Recomendado: **slugs fijos** (los actuales) bajo cada prefijo de idioma — máximo SEO con mínimo riesgo de enlaces rotos, y el contenido scrapeado original ya usaba euskara mezclado. Por defecto el plan asume slugs fijos; si el usuario quiere traducidos, se añade un mapa de slugs en `catalogo.json` y se ajusta el sitemap/hreflang.
- **D2 — Comportamiento de la raíz `/`.** ¿`/` sirve euskara directamente (copia de `/eu/`) o redirige 302 a `/eu/`? Recomendado: `/` = redirect a idioma detectado por `Accept-Language` con fallback a `/eu/` (regla Netlify `_redirects`). Mantener también `/eu/` canónica.

---

## Task 1: Verificar Node y crear andamiaje del generador

**Files:**
- Create: `i18n/build.mjs`
- Create: `i18n/.gitignore-note.md` (documenta que `i18n/` es fuente, no se publica salvo que Netlify lo ignore en publish dir)

- [ ] **Step 1: Verificar Node disponible**

Run: `node --version`
Expected: v18+ (necesario para `fs.cpSync` y top-level await en `.mjs`). Si no hay Node, parar y avisar al usuario.

- [ ] **Step 2: Crear `i18n/build.mjs` mínimo que solo imprime un saludo**

```js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const LANGS = ['eu', 'es', 'en', 'fr'];
const DEFAULT_LANG = 'eu';

console.log('build.mjs OK — root:', ROOT, '— langs:', LANGS.join(', '));
```

- [ ] **Step 3: Ejecutar y verificar**

Run: `node i18n/build.mjs`
Expected: imprime `build.mjs OK — root: ... — langs: eu, es, en, fr`

- [ ] **Step 4: Commit**

```bash
git checkout -b feat/multiidioma
git add i18n/build.mjs i18n/.gitignore-note.md
git commit -m "chore(i18n): andamiaje del generador estatico multiidioma"
```

---

## Task 2: Extraer las cadenas del sitio actual a `strings/es.json` y datos a `data/`

El español actual es la fuente de verdad. Extraer TODO el texto visible y de SEO de cada plantilla de página a claves. Esta tarea es de lectura/catalogación; no genera HTML todavía.

**Files:**
- Create: `i18n/strings/es.json`
- Create: `i18n/data/site.json`
- Create: `i18n/data/catalogo.json`

- [ ] **Step 1: Crear `i18n/data/site.json` con los datos no traducibles**

```json
{
  "tel1": "+34948631027",
  "tel1Display": "948 631 027",
  "tel2": "+34670598560",
  "tel2Display": "670 598 560",
  "email": "info@tabernaedariak.eus",
  "fax": "948 625 211",
  "vatID": "B31211402",
  "legalName": "Manuel Taberna S.L.",
  "brandName": "Edariak",
  "domain": "https://tabernaedariak.eus",
  "address": { "street": "Bidasoa karrika, 76", "postalCode": "31780", "locality": "Bera", "region": "Navarra", "country": "ES" },
  "geo": { "lat": 43.2797, "lng": -1.6839 },
  "foundingYear": "1949",
  "brands": ["Heineken","Schweppes","Insalus","Lacturale","Zapiain","Codorníu","Pago","Ur Daira"],
  "designerUrl": "https://unaxaller.com"
}
```

- [ ] **Step 2: Crear `i18n/data/catalogo.json` con las 18 categorías**

Estructura por categoría (la `eus` es la glosa que ya aparecía; `ref` = listas de producto NO traducibles, copiadas literalmente del HTML actual de cada `/catalogo/<slug>/index.html`):

```json
{
  "categorias": [
    {
      "slug": "vinos",
      "image": "vinos.webp",
      "video": "vino-sirviendo.web.mp4",
      "eus": "Ardoak",
      "groups": [
        { "titleKey": "vinos.g_mesa", "eus": "Ardo arruntak", "items": ["RIOTINTO BELTZA ROSCA 3/4","RIOROSO GORRIA ROSCA 3/4","RIOBLANCO XURIA ROSCA 3/4","VIÑA ALTA BELTZA 3/4 RET","MOSTO VIDA LT. N.R.","MOSTO VIDA BLLIN 200","VIÑACRUZ BELTZA LT N.R","TABERNA BELTZA LT. NR","TABERNA GORRIA LT. NR","IBERO XURIA Lt N.R."] }
      ]
    }
  ]
}
```

> NOTA AL EJECUTOR: copiar las listas `<li>` literalmente desde cada uno de los 18 HTML de catálogo. Los subtítulos de grupo (`Del año · Urtekoak`, `Crianza · Ondua`…) se traducen, así que van como `titleKey` que resuelve en cada `strings/*.json`; la glosa euskara (`Urtekoak`) se conserva aparte como `eus`. Mantener el atributo `data-collapsible`/`open` y el conteo de referencias (se calcula con `items.length`, no se hardcodea).

- [ ] **Step 3: Crear `i18n/strings/es.json` con TODAS las cadenas de UI/SEO en español**

Extraer literalmente del sitio actual. Estructura por secciones; claves estables:

```json
{
  "_lang": "es",
  "_localeOG": "es_ES",
  "nav": { "inicio": "Inicio", "catalogo": "Catálogo", "empresa": "Empresa", "contacto": "Contacto", "pedido": "Haz tu pedido", "skip": "Saltar al contenido" },
  "common": {
    "verCatalogo": "Ver catálogo", "explorarTodo": "Explorar todo el catálogo",
    "verTodo": "Ver todo", "verMenos": "Ver menos",
    "llamanos": "Llámanos", "escribenos": "Escríbenos",
    "referencias": "referencias", "descubre": "Descubre"
  },
  "loader": { "word": "Edariak" },
  "cookies": { "text": "Utilizamos cookies técnicas propias para el correcto funcionamiento de la web. Puedes consultar más información en nuestra ", "link": "política de cookies", "accept": "Aceptar", "reject": "Rechazar", "title": "Aviso de cookies" },
  "footer": {
    "tagline": "Distribuidor mayorista de bebidas en Bera desde 1949. Reparto semanal a la hostelería y el comercio de Bortziriak, Malerreka y Baztán.",
    "navTitle": "Navegación", "contactTitle": "Contacto", "scheduleTitle": "Horario",
    "scheduleDays": "Lunes a viernes", "scheduleWarehouse": "Almacén de Agerra, Bera",
    "faxLabel": "Fax", "messaging": "mensajería", "designedBy": "Diseñado por",
    "rights": "Manuel Taberna S.L. · CIF B31211402",
    "legalAviso": "Aviso legal", "legalPriv": "Privacidad", "legalCookies": "Cookies"
  },
  "home": {
    "seoTitle": "Distribuidor de Bebidas en Bera (Navarra) desde 1949 | Manuel Taberna Edariak",
    "seoDesc": "Distribuidor mayorista de bebidas en Bera, Navarra. Reparto semanal a bares, restaurantes y tiendas de Bortziriak, Malerreka y Baztán. Vinos, cervezas, refrescos y más desde 1949.",
    "seoKeywords": "distribuidor bebidas Navarra, mayorista bebidas Bera, reparto bebidas hostelería, Manuel Taberna Edariak, distribuidor vinos Bortziriak, bebidas Baztán Malerreka",
    "ogTitle": "Distribuidor de Bebidas en Bera (Navarra) desde 1949 | Manuel Taberna Edariak",
    "ogDesc": "Reparto semanal de bebidas a la hostelería de Bortziriak, Malerreka y Baztán. 18 familias de producto y marcas oficiales.",
    "heroEyebrow": "Bera · Navarra · Desde 1949",
    "heroTitleA": "Todo lo que tu bar necesita, ", "heroTitleEm": "de un solo proveedor", "heroTitleB": ".",
    "heroLead": "Distribuidor mayorista de bebidas para la hostelería y el comercio. Cada semana visitamos y repartimos en todos los pueblos de Bortziriak, Malerreka y Baztán.",
    "heroCtaCall": "Llámanos · 948 631 027",
    "metaYears": "años repartiendo", "metaFamilies": "familias de producto", "metaWeekly": "Semanal", "metaWeeklyText": "visita y reparto", "metaRegions": "comarcas servidas",
    "brandsTitle": "Somos distribuidores oficiales de estas marcas",
    "brandsBasque": "Marka hauen banatzaile ofizialak gara",
    "catEyebrow": "Catálogo · Katalogoa", "catTitle": "Un catálogo pensado para la hostelería",
    "aboutEyebrow": "La casa · Etxea", "aboutTitle": "Tres cuartos de siglo sirviendo a la comarca",
    "aboutLead": "Manuel Taberna S.L. es una empresa familiar de Bera dedicada a la distribución mayorista de bebidas desde 1949. Conocemos cada bar, cada restaurante y cada tienda de la zona, porque llevamos generaciones entrando por sus puertas.",
    "aboutLi1": "<strong>Visita y reparto semanal</strong> en todos los pueblos de Bortziriak, Malerreka y Baztán.",
    "aboutLi2": "<strong>Atención directa en el almacén</strong> de Agerra, en Bera: ven cuando lo necesites, las puertas están abiertas.",
    "aboutLi3": "<strong>Distribuidores oficiales</strong> de Heineken, Schweppes, Insalus, Lacturale, Zapiain, Codorníu, Pago y Ur Daira.",
    "aboutCta": "Conoce la empresa",
    "serviceEyebrow": "Servicio · Zerbitzua", "serviceTitle": "Así trabajamos contigo",
    "serviceLead": "Nuestros repartidores recorren toda la comarca llevando los productos a tu bar, restaurante o tienda. Tú te ocupas de tus clientes; del resto, nosotros.",
    "service1Title": "Reparto semanal a tu puerta", "service1Text": "Cada semana pasamos por todas las localidades de la zona. Tu pedido llega siempre el día que toca, sin que tengas que preocuparte de nada.",
    "service2Title": "Marcas oficiales, precio justo", "service2Text": "Distribuimos oficialmente las marcas que tus clientes piden: Heineken, Schweppes, Insalus, Lacturale, Zapiain, Codorníu, Pago y Ur Daira.",
    "service3Title": "Almacén abierto en Bera", "service3Text": "¿Necesitas algo entre reparto y reparto? Acércate al almacén de Agerra, de lunes a viernes de 08:00 a 15:00. Las puertas están abiertas.",
    "statsFound": "Año de fundación", "statsFamilies": "Familias de producto", "statsBrands": "Marcas oficiales", "statsRegions": "Comarcas con reparto",
    "zoneEyebrow": "Zona de reparto", "zoneTitle": "Donde estés, llegamos", "zoneLead": "Reparto semanal en cada pueblo de estas tres comarcas del norte de Navarra.",
    "zone1Title": "Bortziriak · Cinco Villas", "zone1Text": "Bera, Lesaka, Etxalar, Arantza e Igantzi. Nuestra casa: aquí está el almacén y aquí empezó todo en 1949.",
    "zone2Title": "Malerreka", "zone2Text": "Doneztebe/Santesteban y todos los pueblos del valle. Visita semanal a bares, sociedades y comercios.",
    "zone3Title": "Baztán", "zone3Text": "Elizondo y todo el valle de Baztán, de Oronoz a Amaiur. Reparto puntual cada semana, también en temporada alta.",
    "faqEyebrow": "Preguntas frecuentes", "faqTitle": "Lo que nos suelen preguntar",
    "faq1Q": "¿En qué zonas hacéis reparto?", "faq1A": "Visitamos y repartimos cada semana en todas las localidades de Bortziriak (Bera, Lesaka, Etxalar, Arantza e Igantzi), Malerreka y el valle de Baztán.",
    "faq2Q": "¿Qué productos distribuís?", "faq2A": "Todo tipo de bebidas con y sin alcohol — vinos, cervezas, whiskies, licores, refrescos, cavas, sidra y txakoli — además de café, leche, agua, aceite, conservas, zumos, cristalería y miniaturas. 18 familias de producto en total.",
    "faq3Q": "¿Puedo comprar directamente en el almacén?", "faq3A": "Sí. Estamos en Bidasoa karrika 76, en Bera, de lunes a viernes de 08:00 a 15:00. Si necesitas cualquier cosa, las puertas están abiertas.",
    "faq4Q": "¿Cómo hago un pedido?", "faq4A": "Llámanos al {tel1} o al {tel2}, escríbenos a {email} o díselo a tu repartidor en la visita semanal.",
    "ctaEyebrow": "Harremana · Contacto", "ctaTitle": "Tu próximo pedido, a una llamada", "ctaLead": "Cualquier duda que tengas, estamos para ayudarte. Llama y te atendemos.", "ctaContactPage": "Página de contacto"
  }
}
```

> El ejecutor DEBE completar también las claves de `catalogo-index`, `categoria` (genérica + por-categoría: title/lead/seo/relacionadas), `empresa`, `contacto`, y `legal` (3 documentos) extrayéndolas de sus HTML actuales con el mismo método. Una clave por cada cadena visible. No inventar texto: copiar el español existente.

- [ ] **Step 4: Validar que los JSON parsean**

Run: `node -e "['site','catalogo'].forEach(f=>JSON.parse(require('fs').readFileSync('i18n/data/'+f+'.json')));JSON.parse(require('fs').readFileSync('i18n/strings/es.json'));console.log('JSON OK')"`
Expected: `JSON OK`

- [ ] **Step 5: Commit**

```bash
git add i18n/strings/es.json i18n/data/site.json i18n/data/catalogo.json
git commit -m "feat(i18n): extraer cadenas y datos del sitio actual (es como fuente)"
```

---

## Task 3: Plantillas + generador que reproduce el sitio ES 1:1

Objetivo de paridad: el generador, alimentado solo con `es.json`, debe producir HTML equivalente al actual (mismo markup, clases, SVGs, animaciones), pero con rutas de assets absolutas (`/assets/...`) y bajo `/es/`. Esto valida la maquinaria antes de traducir nada.

**Files:**
- Create: `i18n/templates/base.html`, `home.html`, `catalogo-index.html`, `categoria.html`, `empresa.html`, `contacto.html`, `legal.html`
- Modify: `i18n/build.mjs`

- [ ] **Step 1: Escribir `base.html`** con marcadores `{{head}}`, `{{lang}}`, `{{localeOG}}`, `{{hreflang}}`, `{{topbar}}`, `{{header}}`, `{{main}}`, `{{footer}}`, `{{cookie}}`, `{{langSwitcher}}`. Copiar topbar/header/footer/cookie del HTML actual, sustituyendo: textos por `{{nav.*}}`/`{{footer.*}}`, rutas `assets/...`→`/assets/...`, enlaces de navegación por `/<lang>/...`, y añadiendo el selector de idioma (Task 6).

- [ ] **Step 2: Escribir las plantillas de `<main>`** (`home.html`, etc.) copiando el `<main>` actual y reemplazando cada texto por su `{{clave}}` y cada lista de catálogo/tarjeta por un bucle generado desde `catalogo.json`.

- [ ] **Step 3: Implementar el motor en `build.mjs`**: cargar strings+data, función `t(lang, key)` con interpolación `{tel1}` desde `site.json`, función `render(tpl, ctx)` que sustituye `{{...}}`, y emisión de archivos a `<ROOT>/<lang>/<ruta>/index.html`. Generar sitemap y dejar assets intactos.

- [ ] **Step 4: Generar SOLO español a un dir temporal y comparar con el actual**

Run: `node i18n/build.mjs --only=es --out=.build-check`
Luego comparar textos visibles (ignorando diferencias esperadas de rutas) de `/.build-check/es/index.html` vs `/index.html`.
Expected: mismo contenido textual y estructura; única diferencia intencionada = rutas `/assets/` y prefijo `/es/`.

- [ ] **Step 5: Commit**

```bash
git add i18n/templates i18n/build.mjs
git commit -m "feat(i18n): plantillas + generador con paridad 1:1 del sitio ES"
```

---

## Task 4: Traducir a euskara (`eu.json`) — idioma por defecto

**Files:** Create `i18n/strings/eu.json`; Modify `i18n/data/catalogo.json` (campos traducibles por idioma de catálogo).

- [ ] **Step 1:** Duplicar `es.json` → `eu.json`, cambiar `_lang`/`_localeOG` (`eu`/`eu_ES`) y traducir TODOS los valores a euskara batua, respetando HTML inline (`<strong>`), placeholders (`{tel1}`) y sin traducir marcas/nombres propios. Mantener glosas existentes.
- [ ] **Step 2:** Traducir los campos traducibles de catálogo (subtítulos de grupo, leads, SEO por categoría) en su sección `eu`.
- [ ] **Step 3:** `node i18n/build.mjs --only=eu --out=.build-check` y revisar `/.build-check/eu/index.html` visualmente.
- [ ] **Step 4:** Commit `feat(i18n): traduccion completa a euskara (idioma por defecto)`.

> Aviso al usuario: el euskara batua puede necesitar ajuste al euskara local de la zona; se entrega para revisión.

## Task 5: Traducir a inglés (`en.json`) y francés (`fr.json`)

Mismo procedimiento que Task 4, una tarea por idioma, con `_localeOG` `en_US` y `fr_FR`. Commits separados por idioma.

---

## Task 6: Selector de idioma + hreflang + JS localizado

**Files:** Modify `i18n/templates/base.html`, `i18n/build.mjs`, `assets/js/main.js`.

- [ ] **Step 1:** Selector de idioma en header y footer (lista EU/ES/EN/FR) que enlaza a la MISMA página en el otro idioma (el generador conoce el path equivalente). Marcar el activo con `aria-current`.
- [ ] **Step 2:** En `<head>`, emitir `<link rel="alternate" hreflang="eu|es|en|fr" href=...>` para las 4 variantes + `x-default`→eu, y `<html lang>` correcto.
- [ ] **Step 3:** Localizar JS: `main.js` lee "Ver todo"/"Ver menos" desde `data-more`/`data-less` del botón (emitidos por el generador) en vez de literales españoles; y `prefetchSite()` usa `mt-base` del idioma actual.
- [ ] **Step 4:** Regenerar todo y verificar el cambio de idioma navegando entre páginas equivalentes. Commit.

## Task 7: Raíz, redirects, 404, sitemap y robots

**Files:** Create `_redirects`; Modify `404.html`, `sitemap.xml` (generado), `robots.txt` (loc).

- [ ] **Step 1:** `_redirects` Netlify: `/` → idioma por `Accept-Language` con fallback `/eu/` (200/302 según D2); rutas viejas (`/catalogo/...`) → `/eu/catalogo/...` (301) para no perder enlaces/SEO existentes.
- [ ] **Step 2:** `404.html` multiidioma (texto en los 4 o detección JS) con enlaces a las 4 home.
- [ ] **Step 3:** Sitemap regenerado con las 104 URLs y bloques `xhtml:link rel="alternate" hreflang"`. `robots.txt` apunta al nuevo sitemap.
- [ ] **Step 4:** Commit.

## Task 8: Publicar la salida y retirar el sitio mono-idioma

**Files:** mover/eliminar los 26 HTML antiguos; ejecutar build final.

- [ ] **Step 1:** `node i18n/build.mjs` (genera `/eu /es /en /fr` + sitemap en la raíz publicable).
- [ ] **Step 2:** Eliminar los HTML antiguos de la raíz que ahora viven bajo prefijo de idioma (conservando `/assets`, `/404.html`, favicons). Verificar que no quedan rutas relativas rotas.
- [ ] **Step 3:** Verificación final (Task 9) ANTES de borrar nada de forma irreversible: trabajar en rama, no en `main`.
- [ ] **Step 4:** Commit `feat(i18n): publicar arbol multiidioma y retirar paginas mono-idioma`.

## Task 9: Verificación (REQUIRED SUB-SKILL: superpowers:verification-before-completion)

- [ ] Servir el sitio (`npx serve` o equivalente) y comprobar manualmente: las 4 home cargan, navegación interna por idioma sin 404, selector de idioma salta a la página equivalente, assets/vídeos/fuentes cargan (rutas absolutas), animaciones GSAP intactas, cookie-notice y "Ver todo/menos" en el idioma correcto.
- [ ] Validar `hreflang` (sin errores de reciprocidad) y que cada `<html lang>` es correcto.
- [ ] Validar los 4 JSON y el sitemap (XML bien formado, 104 URLs).
- [ ] Revisar visualmente al menos: 1 home, 1 índice de catálogo, 2 categorías, empresa, contacto, 1 legal — en los 4 idiomas.
- [ ] Solo tras evidencia: subir a GitHub (rama → push → PR), según pidió el usuario.

---

## Self-review (cobertura del encargo)

- "Toda la web, hasta el último detalle, en 4 idiomas" → Tasks 2–5 cubren todo el texto visible y de SEO de las 26 páginas; nombres de producto/marca quedan excluidos a propósito (no traducibles).
- "Euskara por defecto en la raíz" → Tasks 4, 7 (D2).
- "Yo redacto, tú revisas" → entregas con aviso de revisión (Tasks 4–5).
- "Cuando termines, súbelo a GitHub" → Task 9, último paso (rama `feat/multiidioma` ya creada en Task 1).
- Riesgo principal: volumen de cadenas a extraer (Task 2) y calidad de traducción al euskara local (Tasks 4). Mitigación: español como fuente única, generador con paridad 1:1 antes de traducir, todo en rama hasta verificar.
