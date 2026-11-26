// Descarga un set Pokémon desde TCGdex (api.tcgdex.net) y lo guarda en el
// formato del seed: src/seed/data/sets/pokemon/<code>.json
//
// Sirve para sets nuevos que aún no están en pokemontcg.io.
//
// Uso:  node src/seed/scripts/import-tcgdex-set.mjs <idTcgdex> [codigo]
//       npm run import-set -- 30th
//
// - number: "001/128" (localId con 3 dígitos / total oficial del set).
// - imageUrl: <image>/high.webp de TCGdex (la grilla usa /low.webp).
// - variantValues: precio de mercado TCGplayer (USD) por variante; si no hay,
//   tendencia de Cardmarket convertida de EUR a USD.
// Después, para cargarlo en una base existente SIN borrar nada:
//       node src/seed/scripts/add-set-to-db.mjs src/seed/data/sets/pokemon/<code>.json
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const POKEMON_DIR = join(__dirname, '..', 'data', 'sets', 'pokemon');
const API = 'https://api.tcgdex.net/v2/en';
const EUR_TO_USD = 1.08;

const [tcgdexId, codeArg] = process.argv.slice(2);
if (!tcgdexId) {
  console.error('Uso: node src/seed/scripts/import-tcgdex-set.mjs <idTcgdex> [codigo]');
  process.exit(1);
}
const code = codeArg ?? tcgdexId;

async function getJson(url, retries = 3) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (i >= retries) throw new Error(`${url}: ${e.message}`);
      await new Promise((r) => setTimeout(r, 2000 * i));
    }
  }
}

const round2 = (n) => Math.round(n * 100) / 100;
const VARIANT_NAME = { normal: 'Normal', reverse: 'Reverse Holo', holo: 'Holo' };
const CATEGORY = { Pokemon: 'Pokémon' };
// TCGdex escribe algunas rarezas en minúscula ("Illustration rare"); el resto
// del seed usa mayúscula en cada palabra ("Illustration Rare"). Unificar evita
// que el filtro de rareza muestre dos opciones para lo mismo.
const titleCase = (r) => r?.replace(/\b([a-z])/g, (m) => m.toUpperCase());

/** Precio USD de una variante (TCGplayer market → mid → Cardmarket trend). */
function priceOf(pricing) {
  const tp = pricing?.tcgplayer;
  if (tp) {
    for (const [k, v] of Object.entries(tp)) {
      if (k === 'unit' || k === 'updated' || typeof v !== 'object') continue;
      const p = v.marketPrice ?? v.midPrice;
      if (p) return round2(p);
    }
  }
  const cm = pricing?.cardmarket;
  const eur = cm?.trend ?? cm?.avg;
  return eur ? round2(eur * EUR_TO_USD) : undefined;
}

const set = await getJson(`${API}/sets/${encodeURIComponent(tcgdexId)}`);
const official = set.cardCount?.official ?? set.cardCount?.total ?? set.cards.length;
console.log(`Set: ${set.name} (${set.id}) · ${set.cards.length} cartas · oficial ${official}`);

const cards = [];
for (const brief of set.cards) {
  const c = await getJson(`${API}/cards/${encodeURIComponent(brief.id)}`);
  const variants = Object.entries(VARIANT_NAME)
    .filter(([k]) => c.variants?.[k])
    .map(([, v]) => v);
  const variantValues = {};
  for (const vd of c.variants_detailed ?? []) {
    const name = VARIANT_NAME[vd.type];
    const p = priceOf(vd.pricing);
    if (name && p !== undefined && variantValues[name] === undefined) variantValues[name] = p;
  }
  const attributes = {};
  if (c.hp) attributes.hp = c.hp;
  if (c.types?.length) attributes.types = c.types;
  if (c.stage) attributes.stage = c.stage;
  if (c.weaknesses?.length) attributes.weakness = c.weaknesses[0].type;
  if (c.retreat !== undefined) attributes.retreat = c.retreat;
  if (c.trainerType) attributes.trainerType = c.trainerType;
  if (c.energyType) attributes.energyType = c.energyType;
  if (c.illustrator) attributes.illustrator = c.illustrator;

  cards.push({
    number: `${/^\d+$/.test(c.localId) ? String(c.localId).padStart(3, '0') : c.localId}/${official}`,
    name: c.name,
    rarity: titleCase(c.rarity),
    cardType: CATEGORY[c.category] ?? c.category,
    imageUrl: c.image ? `${c.image}/high.webp` : undefined,
    attributes,
    variants: variants.length ? variants : ['Normal'],
    variantValues,
  });
  process.stdout.write('.');
  await new Promise((r) => setTimeout(r, 120));
}
process.stdout.write('\n');

const out = {
  game: { code: 'pokemon', name: 'Pokémon TCG' },
  set: {
    code,
    name: set.name,
    series: set.serie?.name,
    totalCards: official,
    releaseDate: set.releaseDate,
    symbolUrl: set.serie?.id ? `https://assets.tcgdex.net/univ/${set.serie.id}/${set.id}/symbol.png` : undefined,
  },
  cards,
};
const file = join(POKEMON_DIR, `${code}.json`);
writeFileSync(file, JSON.stringify(out, null, 2) + '\n');
const noImg = cards.filter((c) => !c.imageUrl).length;
console.log(`✅ ${cards.length} cartas → ${file}${noImg ? ` · ⚠️ ${noImg} sin imagen` : ''}`);
