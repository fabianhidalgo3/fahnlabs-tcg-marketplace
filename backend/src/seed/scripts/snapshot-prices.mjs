/**
 * Toma la "foto" de HOY de los precios de todas las cartas (variantValues USD)
 * y la guarda en price_snapshots — alimenta el gráfico "Historial de precio".
 * Correr después de sync-prices / price-floors (o por cron diario).
 *
 * Uso:  node src/seed/scripts/snapshot-prices.mjs
 *       MONGO_URI=... node src/seed/scripts/snapshot-prices.mjs
 */
import { MongoClient } from 'mongodb';

const MONGO_URI =
  process.env.MONGO_URI ??
  'mongodb://root:rootpass@localhost:27017/tcgdb?authSource=admin';

const client = await MongoClient.connect(MONGO_URI);
const db = client.db();
const date = new Date().toISOString().slice(0, 10);

const cursor = db.collection('card_models').find({}, { projection: { variantValues: 1 } });
let n = 0;
let bulk = [];
for await (const card of cursor) {
  bulk.push({
    updateOne: {
      filter: { card: card._id, date },
      update: { $set: { values: card.variantValues ?? {} } },
      upsert: true,
    },
  });
  if (bulk.length >= 1000) { await db.collection('price_snapshots').bulkWrite(bulk); n += bulk.length; bulk = []; }
}
if (bulk.length) { await db.collection('price_snapshots').bulkWrite(bulk); n += bulk.length; }
await db.collection('price_snapshots').createIndex({ card: 1, date: 1 }, { unique: true });

console.log(`Snapshot ${date}: ${n} cartas registradas en price_snapshots`);
await client.close();
