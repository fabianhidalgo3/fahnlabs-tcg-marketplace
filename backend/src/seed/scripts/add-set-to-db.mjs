// Carga uno o más archivos de set del seed en una base EXISTENTE, sin borrar
// nada (a diferencia de `npm run seed`, que vacía la base y la recrea).
//
// - El juego y el set se buscan por código; si no existen se crean.
// - Las cartas se buscan por (set, number): se actualizan si existen y se
//   insertan si son nuevas. Así colecciones, inventario y órdenes que apuntan
//   a esas cartas siguen siendo válidos y el script se puede correr varias veces.
//
// Uso:  node src/seed/scripts/add-set-to-db.mjs src/seed/data/sets/pokemon/30th.json [...]
//       MONGO_URI=... npm run add-set -- src/seed/data/sets/pokemon/30th.json
import { readFileSync } from 'node:fs';
import { MongoClient } from 'mongodb';

const MONGO_URI =
  process.env.MONGO_URI ??
  'mongodb://root:rootpass@localhost:27017/tcgdb?authSource=admin';

const files = process.argv.slice(2);
if (!files.length) {
  console.error('Uso: node src/seed/scripts/add-set-to-db.mjs <archivo.json> [...]');
  process.exit(1);
}

const client = await MongoClient.connect(MONGO_URI);
const db = client.db();
const now = new Date();

try {
  for (const file of files) {
    const doc = JSON.parse(readFileSync(file, 'utf-8'));
    const gameCode = typeof doc.game === 'string' ? doc.game : doc.game.code;

    const game = await db.collection('games').findOneAndUpdate(
      { code: gameCode },
      {
        $setOnInsert: { code: gameCode, name: doc.game?.name ?? gameCode, createdAt: now },
        $set: { updatedAt: now },
      },
      { upsert: true, returnDocument: 'after' },
    );

    const s = doc.set;
    const set = await db.collection('card_sets').findOneAndUpdate(
      { game: game._id, code: s.code },
      {
        $set: {
          name: s.name,
          series: s.series,
          totalCards: s.totalCards,
          releaseDate: s.releaseDate,
          symbolUrl: s.symbolUrl,
          updatedAt: now,
        },
        $setOnInsert: { game: game._id, code: s.code, promoCards: [], createdAt: now },
      },
      { upsert: true, returnDocument: 'after' },
    );

    const ops = doc.cards.map((c) => ({
      updateOne: {
        filter: { set: set._id, number: c.number },
        update: {
          $set: {
            name: c.name,
            rarity: c.rarity,
            cardType: c.cardType,
            imageUrl: c.imageUrl,
            attributes: c.attributes ?? {},
            variants: c.variants ?? ['Normal'],
            variantValues: c.variantValues ?? {},
            updatedAt: now,
          },
          $setOnInsert: { game: game._id, set: set._id, number: c.number, createdAt: now },
        },
        upsert: true,
      },
    }));
    const r = ops.length ? await db.collection('card_models').bulkWrite(ops) : null;
    console.log(
      `✅ ${s.name} (${s.code}): ${r?.upsertedCount ?? 0} cartas nuevas · ${r?.modifiedCount ?? 0} actualizadas`,
    );
  }
} finally {
  await client.close();
}
