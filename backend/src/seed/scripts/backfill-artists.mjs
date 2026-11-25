/**
 * Puebla attributes.illustrator de todas las cartas Pokémon desde
 * pokemontcg.io (campo `artist`, 1 request por set, con reintentos).
 * Idempotente y re-ejecutable: los sets que fallen por 502 se completan
 * en la siguiente corrida. Los sets scrydex (ME) no están en esa API.
 *
 * Uso:  node src/seed/scripts/backfill-artists.mjs
 *       MONGO_URI=... node src/seed/scripts/backfill-artists.mjs
 */
import { MongoClient } from 'mongodb';

const MONGO_URI =
  process.env.MONGO_URI ??
  'mongodb://root:rootpass@localhost:27017/tcgdb?authSource=admin';

async function fetchJson(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
      if (res.ok) return await res.json();
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 1200 * (i + 1)));
  }
  return null;
}

const client = await MongoClient.connect(MONGO_URI);
const db = client.db();
const sets = await db.collection('card_sets').find({}, { projection: { code: 1, name: 1 } }).toArray();

let setsOk = 0, setsFail = [], cardsSet = 0;
for (const set of sets) {
  const body = await fetchJson(
    `https://api.pokemontcg.io/v2/cards?q=set.id:${encodeURIComponent(set.code)}&pageSize=250&select=number,artist`,
  );
  if (!body) { setsFail.push(set.code); continue; }
  const apiCards = body.data ?? [];
  if (apiCards.length) {
    const locals = await db.collection('card_models')
      .find({ set: set._id }, { projection: { number: 1 } }).toArray();
    const byNum = new Map();
    for (const l of locals) {
      const n = parseInt(String(l.number), 10);
      if (!Number.isNaN(n) && !byNum.has(n)) byNum.set(n, l._id);
    }
    const bulk = [];
    for (const c of apiCards) {
      if (!c.artist) continue;
      const id = byNum.get(parseInt(String(c.number), 10));
      if (id) bulk.push({ updateOne: { filter: { _id: id }, update: { $set: { 'attributes.illustrator': c.artist } } } });
    }
    if (bulk.length) { await db.collection('card_models').bulkWrite(bulk); cardsSet += bulk.length; }
  }
  setsOk++;
  await new Promise((r) => setTimeout(r, 250));
}

console.log(`Ilustradores: ${cardsSet} cartas actualizadas · ${setsOk}/${sets.length} sets ok · fallidos: ${setsFail.length}`);
if (setsFail.length) console.log('  reintentar luego:', setsFail.join(', '));
await client.close();
