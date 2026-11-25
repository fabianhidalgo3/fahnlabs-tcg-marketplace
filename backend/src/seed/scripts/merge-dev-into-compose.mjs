/**
 * Fusiona la colección personal (carpetas + cartas + asignaciones) desde la
 * Mongo de DESARROLLO hacia la Mongo del stack Docker, SIN borrar nada:
 *  - usuarios emparejados por email
 *  - cartas mapeadas por (código de set + número) — los ObjectIds difieren
 *  - carpetas emparejadas por nombre (se crean si faltan)
 *  - cantidades: se toma el MÁXIMO entre ambas (no se suman → no duplica)
 *
 * Pensado para correr DENTRO del stack (servicio seed):
 *   docker compose --profile seed run --rm \
 *     -v ./backend/src/seed/scripts:/app/src/seed/scripts:ro \
 *     seed node src/seed/scripts/merge-dev-into-compose.mjs
 */
import { MongoClient } from 'mongodb';

const DEV_URI =
  process.env.DEV_MONGO_URI ??
  'mongodb://root:rootpass@host.docker.internal:27017/tcgdb?authSource=admin';
const COMP_URI =
  process.env.MONGO_URI ??
  'mongodb://root:rootpass@mongo:27017/tcgdb?authSource=admin';

const dev = (await MongoClient.connect(DEV_URI)).db();
const comp = (await MongoClient.connect(COMP_URI)).db();

// --- mapas de referencia en la base destino (compose) ---
const compSetsByCode = new Map(
  (await comp.collection('card_sets').find({}, { projection: { code: 1 } }).toArray())
    .map((s) => [s.code, s._id]),
);
// dev: carta id → { setCode, number } para traducir entradas
const devSets = new Map(
  (await dev.collection('card_sets').find({}, { projection: { code: 1 } }).toArray())
    .map((s) => [s._id.toString(), s.code]),
);
const devCards = new Map(
  (await dev.collection('card_models')
    .find({}, { projection: { set: 1, number: 1 } })
    .toArray())
    .map((c) => [c._id.toString(), { setCode: devSets.get(c.set?.toString()), number: c.number }]),
);

// caché de búsqueda de carta destino por setCode|number
const compCardCache = new Map();
async function findCompCard(setCode, number) {
  const key = setCode + '|' + number;
  if (compCardCache.has(key)) return compCardCache.get(key);
  const setId = compSetsByCode.get(setCode);
  const card = setId
    ? await comp.collection('card_models').findOne({ set: setId, number }, { projection: { _id: 1 } })
    : null;
  compCardCache.set(key, card?._id ?? null);
  return card?._id ?? null;
}

let foldersCreated = 0;
let entriesCreated = 0;
let entriesRaised = 0;
let assigned = 0;
let unmatchedCards = 0;

const devUsers = await dev.collection('users').find({}, { projection: { email: 1 } }).toArray();
for (const du of devUsers) {
  const cu = await comp.collection('users').findOne({ email: du.email }, { projection: { _id: 1 } });
  if (!cu) { console.log(`(salto ${du.email}: no existe en destino)`); continue; }

  // 1) Carpetas: crear las que falten (por nombre), mapeando el set por código.
  const devFolders = await dev.collection('storage_locations').find({ user: du._id }).toArray();
  const folderIdByName = new Map();
  for (const f of devFolders) {
    let existing = await comp.collection('storage_locations').findOne({ user: cu._id, name: f.name });
    if (!existing) {
      const devSetCode = f.set ? devSets.get(f.set.toString()) : null;
      const doc = {
        user: cu._id,
        name: f.name,
        type: f.type,
        color: f.color ?? '#6c5ce7',
        notes: f.notes ?? '',
        set: devSetCode ? (compSetsByCode.get(devSetCode) ?? null) : null,
        createdAt: f.createdAt ?? new Date(),
        updatedAt: new Date(),
      };
      const res = await comp.collection('storage_locations').insertOne(doc);
      existing = { _id: res.insertedId };
      foldersCreated++;
      console.log(`+ carpeta "${f.name}" creada para ${du.email}`);
    }
    folderIdByName.set(f._id.toString(), existing._id);
  }

  // 2) Entradas de colección: max(cantidades), crear las que falten.
  const devEntries = await dev.collection('collection_entries')
    .find({ user: du._id, quantity: { $gt: 0 } })
    .toArray();
  for (const e of devEntries) {
    const ref = devCards.get(e.cardModel?.toString());
    if (!ref?.setCode || !ref.number) { unmatchedCards++; continue; }
    const compCardId = await findCompCard(ref.setCode, ref.number);
    if (!compCardId) { unmatchedCards++; continue; }

    const storageId = e.storage ? (folderIdByName.get(e.storage.toString()) ?? null) : null;
    const filter = { user: cu._id, cardModel: compCardId, variant: e.variant, language: e.language };
    const existing = await comp.collection('collection_entries').findOne(filter);
    if (!existing) {
      await comp.collection('collection_entries').insertOne({
        ...filter,
        quantity: e.quantity,
        storage: storageId,
        createdAt: e.createdAt ?? new Date(),
        updatedAt: new Date(),
      });
      entriesCreated++;
      if (storageId) assigned++;
    } else {
      const patch = {};
      if (e.quantity > existing.quantity) { patch.quantity = e.quantity; entriesRaised++; }
      if (!existing.storage && storageId) { patch.storage = storageId; assigned++; }
      if (Object.keys(patch).length) {
        await comp.collection('collection_entries').updateOne(filter, { $set: { ...patch, updatedAt: new Date() } });
      }
    }
  }
}

console.log(`\nListo: ${foldersCreated} carpetas creadas · ${entriesCreated} entradas nuevas · ` +
  `${entriesRaised} cantidades subidas · ${assigned} asignaciones a carpeta` +
  (unmatchedCards ? ` · ${unmatchedCards} cartas sin match (set no cargado en destino)` : ''));

process.exit(0);
