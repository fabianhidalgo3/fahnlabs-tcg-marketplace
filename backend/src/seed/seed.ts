import 'reflect-metadata';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../app.module';
import { User, UserRole } from '../entities/user.entity';
import { Game } from '../entities/game.entity';
import { CardSet } from '../entities/card-set.entity';
import { CardModel } from '../entities/card-model.entity';
import { CardCondition, InventoryItem } from '../entities/inventory-item.entity';
import { Order } from '../entities/order.entity';
import {
  CardLanguage,
  CollectionEntry,
} from '../entities/collection-entry.entity';
import {
  StorageLocation,
  StorageType,
} from '../entities/storage-location.entity';

interface SeedSet {
  game?: { code: string; name: string };
  set: {
    code: string;
    name: string;
    series?: string;
    totalCards: number;
    releaseDate?: string;
    symbolUrl?: string;
  };
  cards: any[];
}

// Juegos soportados (el nombre de la subcarpeta en data/sets/ es el código).
const GAMES: { code: string; name: string }[] = [
  { code: 'pokemon', name: 'Pokémon TCG' },
  { code: 'onepiece', name: 'One Piece Card Game' },
  { code: 'swu', name: 'Star Wars Unlimited' },
];

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const users = app.get<Model<User>>(getModelToken(User.name));
  const games = app.get<Model<Game>>(getModelToken(Game.name));
  const sets = app.get<Model<CardSet>>(getModelToken(CardSet.name));
  const cards = app.get<Model<CardModel>>(getModelToken(CardModel.name));
  const inv = app.get<Model<InventoryItem>>(getModelToken(InventoryItem.name));
  const orders = app.get<Model<Order>>(getModelToken(Order.name));
  const collection = app.get<Model<CollectionEntry>>(
    getModelToken(CollectionEntry.name),
  );
  const storage = app.get<Model<StorageLocation>>(
    getModelToken(StorageLocation.name),
  );

  await Promise.all([
    users.deleteMany({}), games.deleteMany({}), sets.deleteMany({}),
    cards.deleteMany({}), inv.deleteMany({}), orders.deleteMany({}),
    collection.deleteMany({}), storage.deleteMany({}),
  ]);

  // --- Usuarios ---------------------------------------------------------
  const [, cliente] = await users.create([
    { email: 'admin@tcg.local', name: 'Administrador', passwordHash: await bcrypt.hash('admin123', 10), role: UserRole.ADMIN },
    { email: 'cliente@tcg.local', name: 'Cliente Demo', passwordHash: await bcrypt.hash('cliente123', 10), role: UserRole.CUSTOMER },
  ]);
  console.log('👤 admin@tcg.local / admin123  ·  cliente@tcg.local / cliente123');

  // --- Cartas: carga todos los sets desde data/sets/<juego>/*.json ------
  const dataRoot = join(__dirname, 'data', 'sets');
  const setsByCode: Record<string, { setId: any; cards: any[]; gameCode: string }> = {};
  let totalCards = 0;

  for (const g of GAMES) {
    const dir = join(dataRoot, g.code);
    if (!existsSync(dir)) continue;
    const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
    if (!files.length) continue;

    const gameDoc = await games.create({ code: g.code, name: g.name });
    let gameCards = 0;

    for (const file of files) {
      const doc: SeedSet = JSON.parse(readFileSync(join(dir, file), 'utf-8'));
      const setDoc = await sets.create({
        game: gameDoc._id,
        code: doc.set.code,
        name: doc.set.name,
        series: doc.set.series,
        totalCards: doc.set.totalCards,
        releaseDate: doc.set.releaseDate,
        symbolUrl: doc.set.symbolUrl,
      });
      const cardDocs = await cards.insertMany(
        doc.cards.map((c) => ({
          game: gameDoc._id,
          set: setDoc._id,
          name: c.name,
          number: c.number,
          rarity: c.rarity,
          cardType: c.cardType,
          imageUrl: c.imageUrl,
          attributes: c.attributes ?? {},
          variants: c.variants ?? ['Normal'],
          variantValues: c.variantValues ?? {},
        })),
      );
      setsByCode[doc.set.code] = { setId: setDoc._id, cards: cardDocs, gameCode: g.code };
      gameCards += cardDocs.length;
      totalCards += cardDocs.length;
    }
    console.log(`🃏 ${g.name}: ${files.length} sets · ${gameCards} cartas`);
  }

  // --- Inventario de la TIENDA (algunas cartas Pokémon del 151) ---------
  const set151 = setsByCode['sv3pt5'];
  const pokeByName = new Map((set151?.cards ?? []).map((c) => [c.name, c]));
  const shop: Array<[any, CardCondition, number, number, boolean]> = [
    [pokeByName.get('Charizard ex'), CardCondition.NEAR_MINT, 89.99, 3, true],
    [pokeByName.get('Blastoise ex'), CardCondition.NEAR_MINT, 24.0, 5, false],
    [pokeByName.get('Pikachu'), CardCondition.NEAR_MINT, 1.5, 40, false],
    [pokeByName.get('Bulbasaur'), CardCondition.LIGHTLY_PLAYED, 0.5, 12, false],
  ];
  for (const [card, condition, price, qty, foil] of shop) {
    if (!card) continue;
    const sku = ['pokemon', card.number, condition, foil ? 'FOIL' : 'REG']
      .join('-').toUpperCase().replace(/\s+/g, '');
    await inv.create({ cardModel: card._id, sku, condition, language: 'EN', isFoil: foil, price, quantity: qty });
  }

  // --- Colección PERSONAL de ejemplo (cliente) --------------------------
  const entries: any[] = [];
  const seedCollection = (setCards: any[] | undefined, take: number) => {
    (setCards ?? []).slice(0, take).forEach((card, i) => {
      const has = (v: string) => (card.variants ?? []).includes(v);
      const add = (variant: string, language: CardLanguage, quantity: number) => {
        if (has(variant) && quantity > 0)
          entries.push({ user: cliente._id, cardModel: card._id, variant, language, quantity });
      };
      add('Normal', CardLanguage.EN, i % 3 === 0 ? 2 : 1);
      if (i % 4 === 0) add('Reverse Holo', CardLanguage.EN, 1);
      if (i % 5 === 0) add('Normal', CardLanguage.ES, i % 10 === 0 ? 2 : 1);
      if (i % 6 === 0) add('Holo', CardLanguage.EN, 1);
    });
  };
  seedCollection(set151?.cards, 70);
  seedCollection(setsByCode['me4']?.cards, 25);
  const savedEntries = await collection.insertMany(entries);

  // --- Almacenamiento (álbumes / cajas) de ejemplo ----------------------
  const [album151, cajaDupes] = await storage.create([
    { user: cliente._id, name: 'Álbum 151', type: StorageType.ALBUM, color: '#e11d48', notes: 'Binder principal del set 151' },
    { user: cliente._id, name: 'Caja de repetidas', type: StorageType.BOX, color: '#f59e0b' },
  ]);
  await Promise.all(
    savedEntries.map((e: any, i: number) =>
      collection.updateOne(
        { _id: e._id },
        { $set: { storage: e.quantity > 1 ? cajaDupes._id : i % 2 === 0 ? album151._id : null } },
      ),
    ),
  );

  console.log(`📚 Total: ${totalCards} cartas · ${await sets.countDocuments()} sets · ${await games.countDocuments()} juegos`);
  console.log(`👤 Colección de cliente@tcg.local: ${entries.length} entradas (EN/ES, con duplicadas)`);
  console.log('✅ Seed completado');
  await app.close();
}

run().catch((err) => {
  console.error('❌ Error en el seed:', err);
  process.exit(1);
});
