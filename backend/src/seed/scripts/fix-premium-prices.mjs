/**
 * Corrige precios de cartas PREMIUM (full arts, ultra raras, secretas…) que
 * quedaron pegadas al piso genérico de Holo (2000 CLP) porque pokemontcg.io
 * no traía precio de mercado para ellas.
 *
 * Para cada carta premium con precio bajo su piso de rareza:
 *   1. Intenta recuperar el precio REAL de mercado desde TCGdex
 *      (tcgplayer USD o cardmarket EUR≈USD, por variante).
 *   2. Aplica el PISO POR RAREZA como mínimo (mercado chileno):
 *        Double Rare / V / EX / GX…        → 2.500 CLP
 *        Ultra Rare / VMAX / VSTAR / Shiny → 3.500 CLP
 *        Illustration Rare / Gold Star     → 4.000 CLP
 *        Special IR / Secret / Rainbow     → 8.000 CLP
 *      Nunca BAJA un precio que ya esté por encima.
 *
 * Uso:  node src/seed/scripts/fix-premium-prices.mjs
 *       MONGO_URI=... node src/seed/scripts/fix-premium-prices.mjs
 */
import { MongoClient } from 'mongodb';

const USD_TO_CLP = 940;
const clp = (n) => Math.round((n / USD_TO_CLP) * 100) / 100;

/** Piso por rareza en CLP (validado contra tiendas chilenas). */
const RARITY_FLOORS_CLP = {
  'Double Rare': 2500, 'Rare Holo V': 2500, 'Rare Holo EX': 2500, 'Rare Holo GX': 2500,
  'Rare BREAK': 2500, 'Rare Prime': 2500, 'Rare ACE': 2500, 'Rare Prism Star': 2500,
  'Radiant Rare': 2500, 'ACE SPEC Rare': 2500,
  'Ultra Rare': 3500, 'Rare Ultra': 3500, 'Full Art': 3500, 'Rare Holo VMAX': 3500,
  'Rare Holo VSTAR': 3500, 'Rare Shiny': 3500, 'Shiny Rare': 3500, 'Rare Shiny GX': 3500,
  'Shiny Ultra Rare': 3500, 'Trainer Gallery Rare Holo': 3500, 'Rare Holo LV.X': 3500,
  'Amazing Rare': 3500,
  'Illustration Rare': 4000, 'Rare Holo Star': 4000, 'Rare Shining': 4000,
  'Special Illustration Rare': 8000, 'Rare Secret': 8000, 'Rare Rainbow': 8000,
  'Hyper Rare': 8000, LEGEND: 8000,
};
const RARITY_FLOORS_USD = Object.fromEntries(
  Object.entries(RARITY_FLOORS_CLP).map(([r, v]) => [r, clp(v)]),
);

const MONGO_URI =
  process.env.MONGO_URI ??
  'mongodb://root:rootpass@localhost:27017/tcgdb?authSource=admin';

const client = await MongoClient.connect(MONGO_URI);
const db = client.db();

const pokemon = await db.collection('games').findOne({ code: 'pokemon' });
if (!pokemon) { console.log('juego pokemon no encontrado'); process.exit(1); }

// --- TCGdex: mapa de sets por nombre ---------------------------------------
async function fetchJson(url) {
  for (let i = 0; i < 2; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
      if (res.ok) return await res.json();
      if (res.status === 404) return null;
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 800));
  }
  return null;
}

const dexSets = (await fetchJson('https://api.tcgdex.net/v2/en/sets')) ?? [];
const dexByName = new Map(dexSets.map((s) => [s.name.toLowerCase(), s.id]));
console.log(`TCGdex: ${dexByName.size} sets indexados`);

const VARIANT_OF_TYPE = { normal: 'Normal', holo: 'Holo', reverse: 'Reverse Holo' };

/** Devuelve {Variante: usd} desde TCGdex, o null si no hay precio. */
async function marketPrices(setName, number) {
  const dexSetId = dexByName.get((setName ?? '').toLowerCase());
  if (!dexSetId) return null;
  const rawNum = String(number).split('/')[0].trim();
  const candidates = /^\d+$/.test(rawNum)
    ? [String(Number(rawNum)), rawNum.padStart(3, '0')]
    : [rawNum];
  let card = null;
  for (const local of [...new Set(candidates)]) {
    card = await fetchJson(`https://api.tcgdex.net/v2/en/cards/${dexSetId}-${local}`);
    if (card?.name) break;
  }
  if (!card?.name) return null;
  const out = {};
  for (const vd of card.variants_detailed ?? []) {
    const variant = VARIANT_OF_TYPE[vd.type];
    const tp = vd.pricing?.tcgplayer;
    const cm = vd.pricing?.cardmarket;
    const price = tp?.marketPrice ?? tp?.midPrice ?? tp?.lowPrice ?? cm?.trend ?? cm?.avg7 ?? cm?.avg;
    if (variant && typeof price === 'number' && price > 0) out[variant] = Math.round(price * 100) / 100;
  }
  return Object.keys(out).length ? out : null;
}

// --- Candidatas: premium cuyo mayor precio está bajo su piso de rareza ------
const rarities = Object.keys(RARITY_FLOORS_USD);
const cards = await db.collection('card_models').aggregate([
  { $match: { game: pokemon._id, rarity: { $in: rarities } } },
  { $addFields: { maxVal: { $max: { $map: {
    input: { $objectToArray: { $ifNull: ['$variantValues', {}] } },
    as: 'kv', in: { $toDouble: '$$kv.v' },
  } } } } },
  { $match: { $expr: { $lt: ['$maxVal', 2.2] } } },
  { $lookup: { from: 'card_sets', localField: 'set', foreignField: '_id', as: 's' } },
  { $unwind: '$s' },
  { $project: { name: 1, number: 1, rarity: 1, variantValues: 1, setName: '$s.name' } },
]).toArray();
console.log(`Candidatas al piso genérico: ${cards.length}`);

let fromMarket = 0, floored = 0, untouched = 0;
const CONCURRENCY = 8;
const bulk = [];

async function processCard(c) {
  const rarityFloor = RARITY_FLOORS_USD[c.rarity] ?? 0;
  const market = await marketPrices(c.setName, c.number);
  const vv = { ...(c.variantValues ?? {}) };
  let changed = false;
  for (const variant of Object.keys(vv)) {
    const current = Number(vv[variant]) || 0;
    const target = Math.max(market?.[variant] ?? 0, rarityFloor, current);
    if (target > current) { vv[variant] = target; changed = true; }
  }
  if (!changed) { untouched++; return; }
  if (market) fromMarket++; else floored++;
  bulk.push({ updateOne: { filter: { _id: c._id }, update: { $set: { variantValues: vv } } } });
}

for (let i = 0; i < cards.length; i += CONCURRENCY) {
  await Promise.all(cards.slice(i, i + CONCURRENCY).map(processCard));
  if ((i / CONCURRENCY) % 10 === 0) console.log(`  ${Math.min(i + CONCURRENCY, cards.length)}/${cards.length}…`);
}
if (bulk.length) await db.collection('card_models').bulkWrite(bulk);

console.log(`Listo: ${fromMarket} con precio de mercado (TCGdex) · ${floored} subidas al piso por rareza · ${untouched} sin cambio`);
await client.close();
