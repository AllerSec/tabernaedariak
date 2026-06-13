// Script de un solo uso: añade a strings/{eu,es,en,fr}.json las secciones
// catCommon, catIndex, empresa, contacto y legal (con sus textos por idioma).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const EXTRA = {
  es: {
    catCommon: {
      selection: "Nuestra selección", references: "Referencias",
      askEyebrow: "¿Buscas algo concreto?", keepExploring: "Seguir explorando",
      otherFamilies: "Otras familias del catálogo", listLead: "Estas son nuestras referencias habituales. Si buscas algo que no aparece, llámanos: lo conseguimos.",
      pideTarifa: "Pide tu tarifa", catalogoDe: "Catálogo de"
    },
    catIndex: {
      seoTitle: "Catálogo de Bebidas para Hostelería | Manuel Taberna Edariak",
      seoDesc: "Catálogo mayorista de bebidas para bares, restaurantes y tiendas: vinos, cervezas, refrescos, licores, cafés, aguas y más. 18 familias de producto con reparto semanal en Bortziriak, Malerreka y Baztán (Navarra).",
      seoKeywords: "catálogo bebidas hostelería, mayorista bebidas Navarra, distribuidor vinos cervezas refrescos, proveedor bares Bera, Manuel Taberna Edariak",
      ogTitle: "Catálogo de Bebidas para Hostelería | Manuel Taberna Edariak",
      ogDesc: "18 familias de producto para tu bar, restaurante o tienda: vinos, cervezas, refrescos, licores y mucho más. Reparto semanal en el norte de Navarra.",
      h1: "Catálogo", eus: "Katalogoa",
      heroLead: "Todo lo que tu bar, restaurante o tienda necesita, reunido en 18 familias de producto. Elige la tuya y descubre las referencias que repartimos cada semana por toda la comarca.",
      eyebrow: "Catálogo · Katalogoa", title: "18 familias de producto",
      lead: "De la bodega a la cafetera: trabajamos todas las familias que mueve la hostelería, con marcas oficiales y referencias de toda la vida.",
      ctaEyebrow: "Harremana · Contacto", ctaTitle: "¿No encuentras una referencia? La conseguimos",
      ctaLead: "Dinos qué necesitas para tu carta o tu tienda y lo buscamos. Llevamos desde 1949 consiguiendo lo que la hostelería de la zona pide."
    },
    empresa: {
      seoTitle: "Empresa — Distribuidor de Bebidas en Bera desde 1949 | Manuel Taberna Edariak",
      seoDesc: "Manuel Taberna S.L. es una empresa familiar de Bera (Navarra) dedicada a la distribución mayorista de bebidas desde 1949. Un equipo de unas 10 personas y reparto semanal en Bortziriak, Malerreka y Baztán.",
      seoKeywords: "empresa distribución bebidas Navarra, Manuel Taberna historia, mayorista bebidas Bera desde 1949, distribuidor familiar Bortziriak",
      ogTitle: "Empresa — Distribuidor de Bebidas en Bera desde 1949 | Manuel Taberna Edariak",
      ogDesc: "Empresa familiar de Bera con más de 75 años distribuyendo bebidas a la hostelería y el comercio del norte de Navarra.",
      h1: "La casa", eus: "Etxea",
      heroLead: "Más de 75 años sirviendo a la comarca. Desde 1949, las bebidas de los bares, restaurantes y tiendas de Bortziriak, Malerreka y Baztán salen de nuestro almacén de Bera.",
      historyEyebrow: "Historia · Historia", historyTitle: "De 1949 a hoy, sin soltar el volante",
      historyP1: "Manuel Taberna empezó a repartir bebidas por la comarca en 1949, cuando los pedidos se apuntaban a mano y los caminos eran otros. En 1988 la actividad se constituyó como Manuel Taberna S.L., pero la esencia no ha cambiado: una empresa familiar de Bera que conoce a cada cliente por su nombre.",
      historyP2: "Hoy somos un equipo de unas diez personas que sigue haciendo lo mismo que entonces, solo que con más familias de producto, más marcas oficiales y las mismas ganas: que a tu negocio no le falte nunca de nada.",
      statTeam: "Personas en el equipo",
      clientsEyebrow: "Clientes · Bezeroak", clientsTitle: "A quién servimos",
      clientsLead: "Trabajamos para quienes dan de comer y de beber a la comarca. Si tu negocio sirve un café, un pintxo o una mesa entera, somos tu proveedor.",
      clientsLi1: "<strong>Bares y cafeterías</strong> — de la caña de mediodía al café de la mañana.",
      clientsLi2: "<strong>Restaurantes</strong> — carta de vinos, aguas, cafés y todo lo que pasa por la mesa.",
      clientsLi3: "<strong>Sociedades gastronómicas</strong> — la despensa siempre llena para cenas y celebraciones.",
      clientsLi4: "<strong>Tiendas y comercios</strong> — reposición semanal sin que tengas que moverte del mostrador.",
      warehouseEyebrow: "Almacén y reparto · Biltegia eta banaketa", warehouseTitle: "De Agerra a tu puerta, cada semana",
      warehouseP1: "Nuestros repartidores recorren toda la comarca llevando nuestros productos a vuestros bares, restaurantes y tiendas. Aun así, también puedes venir a vernos si necesitas cualquier cosa: las puertas están abiertas.",
      warehouseP2: "El almacén está en el barrio de Agerra, en Bera, y abre de lunes a viernes de 08:00 a 15:00. Desde allí sale el reparto semanal a todas las localidades de Bortziriak —Bera, Lesaka, Etxalar, Arantza e Igantzi—, Malerreka y el valle de Baztán.",
      warehouseCta: "Cómo llegar y contacto",
      valuesEyebrow: "Valores · Balioak", valuesTitle: "Lo que no ha cambiado en 75 años",
      valuesLead: "Las furgonetas son otras y el catálogo ha crecido, pero la manera de trabajar es la misma de siempre.",
      value1Title: "Cercanía", value1Text: "Somos de aquí y trabajamos aquí. Conocemos cada bar, cada tienda y cada sociedad de la comarca, y nos puedes llamar o venir a vernos cuando quieras.",
      value2Title: "Confianza desde 1949", value2Text: "Tres generaciones de hosteleros han trabajado con nosotros. La confianza se gana pedido a pedido, y llevamos más de 75 años ganándola.",
      value3Title: "Servicio semanal", value3Text: "Cada semana pasamos por tu pueblo, llueva o haga sol. Tu pedido llega el día que toca, y si surge un imprevisto, el almacén está abierto cada mañana.",
      ctaEyebrow: "Harremana · Contacto", ctaTitle: "¿Hablamos de tu negocio?",
      ctaLead: "Cuéntanos qué necesitas y te preparamos el reparto. Una llamada basta para empezar."
    },
    contacto: {
      seoTitle: "Contacto — Pedidos y Atención en Bera (Navarra) | Manuel Taberna Edariak",
      seoDesc: "Llámanos al 948 631 027 o escríbenos a info@tabernaedariak.eus. Almacén en Bidasoa karrika 76, Bera (Navarra), abierto de lunes a viernes de 08:00 a 15:00. Pedidos y atención para hostelería y comercio.",
      seoKeywords: "contacto distribuidor bebidas Bera, pedidos bebidas hostelería Navarra, teléfono Manuel Taberna Edariak, almacén bebidas Bortziriak",
      ogTitle: "Contacto — Pedidos y Atención en Bera (Navarra) | Manuel Taberna Edariak",
      ogDesc: "Cualquier duda que tengas, estamos listos para ayudarte. Teléfono, email, dirección y horario del almacén de Bera.",
      h1: "Contacto", eus: "Harremana",
      heroLead: "Cualquier duda que tengas, estamos listos para ayudarte. ¡Llama y te ayudamos!",
      heroBasque: "Edozer zalantza duzula, laguntzeko prest gaude. Deitu eta lagunduko dizugu!",
      eyebrow: "Dónde y cómo · Non eta nola", title: "Todas las formas de encontrarnos",
      lead: "Por teléfono, por escrito o en persona: elige la que te venga mejor. Las puertas del almacén están abiertas.",
      labelPhone: "Teléfono", labelMessaging: "Mensajería", labelEmail: "Email",
      labelAddress: "Dirección", labelSchedule: "Horario", labelFax: "Fax",
      scheduleValue: "Lunes a viernes, 08:00 – 15:00",
      mapTitle: "Mapa de la ubicación de Manuel Taberna Edariak en Bera",
      meanwhileEyebrow: "Mientras tanto · Bitartean", meanwhileTitle: "Mientras tanto, echa un vistazo",
      ctaEyebrow: "Harremana · Contacto", ctaTitle: "Una llamada y listo",
      ctaLead: "De lunes a viernes, de 08:00 a 15:00, hay alguien al otro lado del teléfono."
    }
  }
};

// Para eu/en/fr cargamos un fichero de traduccion aparte
const T = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'pages-i18n.json'), 'utf8'));

for (const lang of ['es', 'eu', 'en', 'fr']) {
  const f = path.join(__dirname, 'strings', `${lang}.json`);
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  const src = lang === 'es' ? EXTRA.es : T[lang];
  j.catCommon = src.catCommon;
  j.catIndex = src.catIndex;
  j.empresa = src.empresa;
  j.contacto = src.contacto;
  fs.writeFileSync(f, JSON.stringify(j, null, 2) + '\n', 'utf8');
  console.log('actualizado', lang);
}
