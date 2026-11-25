/**
 * Sincroniza los precios (variantValues) de los archivos de seed hacia Mongo,
 * SIN tocar nada más: ni usuarios, ni colección, ni inventario, ni cartas/sets.
 *
 * Uso:  node src/seed/scripts/sync-prices-to-db.mjs
 *       MONGO_URI=... node src/seed/scripts/sync-prices-to-db.mjs   (otro destino)
 *
 * Flujo típico: `npm run update-prices` (refresca los JSON desde la API)
 * y luego este script para aplicar esos precios a la base de datos.
 */
import { MongoClient } from 'mongodb';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SETS_DIR = join(__dirname, '..', 'data', 'sets', 'pokemon');
const MONGO_URI =
  process.env.MONGO_URI ??
  'mongodb://root:rootpass@localhost:27017/tcgdb?authSource=admin';

const client = await MongoClient.connect(MONGO_URI);
const db = client.db();
const setsCol = db.collection('card_sets');
const cardsCol = db.collection('card_models');

const files = readdirSync(SETS_DIR).filter((f) => f.endsWith('.json'));
let setsDone = 0;
let cardsUpdated = 0;
let setsMissing = 0;

for (const file of files) {
  const data = JSON.parse(readFileSync(join(SETS_DIR, file), 'utf8'));
  const code = data.set?.code;
  if (!code || !Array.isArray(data.cards)) continue;

  const setDoc = await setsCol.findOne({ code }, { projection: { _id: 1 } });
  if (!setDoc) {
    setsMissing++;
    continue; // set no cargado en esta DB — nada que actualizar
  }

  // Un updateOne por carta (número dentro del set), en lotes bulk.
  const ops = data.cards
    .filter((c) => c.number && c.variantValues)
    .map((c) => ({
      updateOne: {
        filter: { set: setDoc._id, number: c.number },
        update: { $set: { variantValues: c.variantValues } },
      },
    }));
  if (!ops.length) continue;

  const res = await cardsCol.bulkWrite(ops, { ordered: false });
  cardsUpdated += res.modifiedCount;
  setsDone++;
  process.stdout.write(`✓ ${code}: ${res.modifiedCount} cartas con precio nuevo\n`);
}

console.log('OJO: corre también npm run price-floors para re-aplicar los pisos retail CLP');
console.log(`\nListo: ${setsDone} sets procesados · ${cardsUpdated} cartas actualizadas` +
  (setsMissing ? ` · ${setsMissing} sets no estaban en la DB` : ''));
await client.close();
