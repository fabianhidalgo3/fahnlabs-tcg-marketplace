/**
 * Aplica PISOS de precio retail (mercado chileno) a las cartas Pokémon:
 * los precios de TCGplayer son mayoristas USA y dejan las comunes/reverses
 * muy por debajo del retail local. Solo SUBE al piso — nunca baja precios
 * de mercado que ya estén por encima (ex, Illustration Rare, chase cards).
 *
 * Pisos (validados contra tiendas chilenas 2026-08, ej. tiendalacomarca.cl):
 *   Normal        → 500 CLP
 *   Reverse Holo  → 1500 CLP
 *   Holo          → 2000 CLP
 *
 * Uso:  node src/seed/scripts/apply-price-floors.mjs
 *       MONGO_URI=... node src/seed/scripts/apply-price-floors.mjs
 */
import { MongoClient } from 'mongodb';

const USD_TO_CLP = 940; // misma tasa que CurrencyService del frontend
const FLOORS_CLP = { Normal: 500, 'Reverse Holo': 1500, Holo: 2000 };
const FLOORS_USD = Object.fromEntries(
  Object.entries(FLOORS_CLP).map(([v, clp]) => [v, Math.round((clp / USD_TO_CLP) * 100) / 100]),
);

/**
 * Pisos POR RAREZA (CLP): una full art / secreta nunca puede quedar al piso
 * genérico de Holo. Aplica a TODAS las variantes de la carta y solo sube.
 * (Misma tabla que fix-premium-prices.mjs y cards.service.ts.)
 */
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
  Object.entries(RARITY_FLOORS_CLP).map(([r, v]) => [r, Math.round((v / USD_TO_CLP) * 100) / 100]),
);

const MONGO_URI =
  process.env.MONGO_URI ??
  'mongodb://root:rootpass@localhost:27017/tcgdb?authSource=admin';

const client = await MongoClient.connect(MONGO_URI);
const db = client.db();

const pokemon = await db.collection('games').findOne({ code: 'pokemon' });
if (!pokemon) { console.log('juego pokemon no encontrado'); process.exit(1); }

const cursor = db.collection('card_models').find(
  { game: pokemon._id },
  { projection: { variantValues: 1, rarity: 1 } },
);

let updated = 0;
let slotsRaised = 0;
const bulk = [];
for await (const card of cursor) {
  const vv = card.variantValues ?? {};
  const rarityFloor = RARITY_FLOORS_USD[card.rarity] ?? 0;
  let changed = false;
  for (const variant of Object.keys(vv)) {
    const floor = Math.max(FLOORS_USD[variant] ?? 0, rarityFloor);
    if ((vv[variant] ?? 0) < floor) {
      vv[variant] = floor;
      changed = true;
      slotsRaised++;
    }
  }
  if (changed) {
    bulk.push({ updateOne: { filter: { _id: card._id }, update: { $set: { variantValues: vv } } } });
    updated++;
  }
  if (bulk.length >= 1000) { await db.collection('card_models').bulkWrite(bulk); bulk.length = 0; }
}
if (bulk.length) await db.collection('card_models').bulkWrite(bulk);

console.log(`Pisos aplicados (${FLOORS_USD.Normal}/${FLOORS_USD['Reverse Holo']}/${FLOORS_USD.Holo} USD ≈ 500/1500/2000 CLP): ` +
  `${updated} cartas actualizadas · ${slotsRaised} variantes subidas al piso`);
await client.close();
