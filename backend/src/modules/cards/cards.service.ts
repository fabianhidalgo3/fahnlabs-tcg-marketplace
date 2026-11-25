import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { CardModel, CardModelDocument } from '../../entities/card-model.entity';
import { CardSet, CardSetDocument } from '../../entities/card-set.entity';
import {
  InventoryItem,
  InventoryItemDocument,
} from '../../entities/inventory-item.entity';
import {
  PriceSnapshot,
  PriceSnapshotDocument,
} from '../../entities/price-snapshot.entity';
import { Order, OrderDocument } from '../../entities/order.entity';
import { CreateCardDto, QueryCardDto, UpdateCardDto } from './dto/card.dto';
import { escapeRegex, parseCardQuery } from '../../common/card-search.util';

// Pisos retail CLP en USD (mismos de apply-price-floors.mjs, tasa 940).
const PRICE_FLOORS: Record<string, number> = { Normal: 0.53, 'Reverse Holo': 1.6, Holo: 2.13 };

// Pisos POR RAREZA en USD (2500/3500/4000/8000 CLP): una full art nunca
// puede quedar al piso genérico de Holo. Misma tabla que apply-price-floors.mjs.
const RARITY_FLOORS: Record<string, number> = {
  'Double Rare': 2.66, 'Rare Holo V': 2.66, 'Rare Holo EX': 2.66, 'Rare Holo GX': 2.66,
  'Rare BREAK': 2.66, 'Rare Prime': 2.66, 'Rare ACE': 2.66, 'Rare Prism Star': 2.66,
  'Radiant Rare': 2.66, 'ACE SPEC Rare': 2.66,
  'Ultra Rare': 3.72, 'Rare Ultra': 3.72, 'Full Art': 3.72, 'Rare Holo VMAX': 3.72,
  'Rare Holo VSTAR': 3.72, 'Rare Shiny': 3.72, 'Shiny Rare': 3.72, 'Rare Shiny GX': 3.72,
  'Shiny Ultra Rare': 3.72, 'Trainer Gallery Rare Holo': 3.72, 'Rare Holo LV.X': 3.72,
  'Amazing Rare': 3.72,
  'Illustration Rare': 4.26, 'Rare Holo Star': 4.26, 'Rare Shining': 4.26,
  'Special Illustration Rare': 8.51, 'Rare Secret': 8.51, 'Rare Rainbow': 8.51,
  'Hyper Rare': 8.51, LEGEND: 8.51,
};

/** Piso final de una variante considerando también la rareza de la carta. */
function floorFor(variant: string, rarity?: string | null): number {
  return Math.max(PRICE_FLOORS[variant] ?? 0.25, RARITY_FLOORS[rarity ?? ''] ?? 0);
}

@Injectable()
export class CardsService implements OnModuleInit {
  private readonly logger = new Logger(CardsService.name);

  /** Al arrancar (y cada 6 h) asegura el snapshot de precios de HOY. */
  onModuleInit() {
    const run = () =>
      this.ensureDailySnapshot().catch((e) =>
        this.logger.warn(`snapshot diario falló: ${e?.message}`),
      );
    run();
    const t = setInterval(run, 6 * 60 * 60 * 1000);
    (t as any).unref?.();
  }

  // ==== Actualizador de precios (job admin en segundo plano) ================
  private priceJob = {
    running: false,
    startedAt: null as string | null,
    finishedAt: null as string | null,
    totalSets: 0,
    processedSets: 0,
    updatedCards: 0,
    failedSets: [] as string[],
  };

  getPriceUpdateStatus() {
    return this.priceJob;
  }

  /** Lanza el refresco de precios de mercado para todos los sets (async). */
  startPriceUpdate(): { started: boolean } {
    if (this.priceJob.running) return { started: false };
    this.priceJob = {
      running: true,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      totalSets: 0,
      processedSets: 0,
      updatedCards: 0,
      failedSets: [],
    };
    this.runPriceUpdate()
      .catch((e) => this.logger.warn(`actualizador de precios falló: ${e?.message}`))
      .finally(() => {
        this.priceJob.running = false;
        this.priceJob.finishedAt = new Date().toISOString();
      });
    return { started: true };
  }

  private async runPriceUpdate() {
    const sets = await this.sets.find().select('code name releaseDate').exec();
    this.priceJob.totalSets = sets.length;

    for (const set of sets) {
      try {
        const body: any = await this.fetchWithRetry(
          `https://api.pokemontcg.io/v2/cards?q=set.id:${encodeURIComponent(set.code)}&pageSize=250&select=number,rarity,tcgplayer`,
          2,
        );
        const apiCards: any[] = body.data ?? [];
        if (apiCards.length) {
          // Mapa numerador → carta local del set (evita depender del formato exacto).
          const locals = await this.cards
            .find({ set: set._id })
            .select('number rarity variants variantValues')
            .exec();
          const byNum = new Map<number, any>();
          for (const l of locals) {
            const n = parseInt(String(l.number), 10);
            if (!Number.isNaN(n) && !byNum.has(n)) byNum.set(n, l);
          }

          const bulk: any[] = [];
          for (const c of apiCards) {
            const local = byNum.get(parseInt(String(c.number), 10));
            if (!local) continue;
            const prices = c.tcgplayer?.prices ?? {};
            const normal = prices.normal?.market ?? prices.normal?.mid;
            const holo = prices.holofoil?.market ?? prices.holofoil?.mid;
            const reverse = prices.reverseHolofoil?.market ?? prices.reverseHolofoil?.mid;
            const marketOf: Record<string, number | undefined> = {
              Normal: normal ?? holo,
              Holo: holo ?? normal,
              'Reverse Holo': reverse,
            };
            const vv = { ...(local.variantValues ?? {}) };
            let changed = false;
            for (const variant of local.variants ?? []) {
              const market = marketOf[variant];
              const target = Math.max(
                typeof market === 'number' ? Math.round(market * 100) / 100 : 0,
                floorFor(variant, local.rarity),
              );
              if (target > 0 && Math.abs((vv[variant] ?? 0) - target) >= 0.01) {
                vv[variant] = target;
                changed = true;
              }
            }
            if (changed) {
              bulk.push({ updateOne: { filter: { _id: local._id }, update: { $set: { variantValues: vv } } } });
            }
          }
          if (bulk.length) {
            await this.cards.bulkWrite(bulk);
            this.priceJob.updatedCards += bulk.length;
          }
        }
      } catch {
        this.priceJob.failedSets.push(set.code);
      }
      this.priceJob.processedSets++;
      await new Promise((r) => setTimeout(r, 250)); // cortesía con la API
    }

    // Deja la foto del día con los valores recién actualizados.
    await this.ensureDailySnapshot(true);
    this.logger.log(
      `Precios actualizados: ${this.priceJob.updatedCards} cartas · ${this.priceJob.failedSets.length} sets con error`,
    );
  }

  private async ensureDailySnapshot(force = false) {
    const date = new Date().toISOString().slice(0, 10);
    if (!force && (await this.snapshots.exists({ date }))) return;
    const cursor = this.cards.find().select('variantValues').lean().cursor();
    let bulk: any[] = [];
    let n = 0;
    for await (const card of cursor) {
      bulk.push({
        updateOne: {
          filter: { card: card._id, date },
          update: { $set: { values: (card as any).variantValues ?? {} } },
          upsert: true,
        },
      });
      if (bulk.length >= 1000) { await this.snapshots.bulkWrite(bulk); n += bulk.length; bulk = []; }
    }
    if (bulk.length) { await this.snapshots.bulkWrite(bulk); n += bulk.length; }
    this.logger.log(`Snapshot de precios ${date}: ${n} cartas`);
  }

  constructor(
    @InjectModel(CardModel.name) private readonly cards: Model<CardModelDocument>,
    @InjectModel(CardSet.name) private readonly sets: Model<CardSetDocument>,
    @InjectModel(InventoryItem.name)
    private readonly inventory: Model<InventoryItemDocument>,
    @InjectModel(PriceSnapshot.name)
    private readonly snapshots: Model<PriceSnapshotDocument>,
    @InjectModel(Order.name)
    private readonly orders: Model<OrderDocument>,
  ) {}

  /** Historial de precio (snapshots diarios) de una carta, ascendente. */
  async priceHistory(cardId: string): Promise<any[]> {
    return this.snapshots
      .find({ card: new Types.ObjectId(cardId) })
      .sort({ date: 1 })
      .select('date values -_id')
      .lean()
      .exec();
  }

  /** Últimas ventas de una carta (líneas de órdenes pagadas/enviadas). */
  async recentSales(cardId: string): Promise<any[]> {
    const itemIds = await this.inventory
      .find({ cardModel: new Types.ObjectId(cardId) })
      .distinct('_id');
    if (!itemIds.length) return [];
    const orders = await this.orders
      .find({ 'items.inventoryItem': { $in: itemIds }, status: { $ne: 'cancelled' } })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('items.inventoryItem', 'condition language isFoil')
      .select('items createdAt')
      .lean()
      .exec();
    const idSet = new Set(itemIds.map((i) => i.toString()));
    const sales: any[] = [];
    for (const o of orders) {
      for (const it of o.items ?? []) {
        const inv: any = it.inventoryItem;
        const invId = inv?._id?.toString() ?? inv?.toString();
        if (!invId || !idSet.has(invId)) continue;
        sales.push({
          date: (o as any).createdAt,
          condition: inv?.condition ?? null,
          language: inv?.language ?? null,
          isFoil: inv?.isFoil ?? false,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
        });
      }
    }
    return sales.slice(0, 10);
  }

  /** Registra el snapshot de HOY para una carta (al importar/re-precificar). */
  private async snapshotToday(cardId: Types.ObjectId, values: Record<string, number>) {
    const date = new Date().toISOString().slice(0, 10);
    await this.snapshots
      .updateOne({ card: cardId, date }, { $set: { values } }, { upsert: true })
      .exec()
      .catch(() => undefined); // el historial nunca debe romper un import
  }

  /**
   * Busca cartas en VARIOS sitios a la vez (pokemontcg.io + TCGdex) y fusiona
   * los resultados: si una fuente está caída, la otra responde. Marca cuáles
   * ya existen en la base local.
   */
  async webSearch(q: string): Promise<any[]> {
    const parsed = parseCardQuery(q ?? '');
    if (!parsed.name && !parsed.number) return [];

    const [pk, dex] = await Promise.allSettled([
      this.searchPokemonTcgIo(q, parsed),
      this.searchTcgdex(q, parsed),
    ]);

    const results: any[] = [];
    if (pk.status === 'fulfilled') results.push(...pk.value);
    if (dex.status === 'fulfilled') results.push(...dex.value);
    if (!results.length && pk.status === 'rejected' && dex.status === 'rejected') {
      throw new NotFoundException(
        'Las fuentes de cartas (pokemontcg.io y TCGdex) están caídas — intenta en unos minutos',
      );
    }

    // Dedup entre fuentes por set+número (prefiere pokemontcg.io, que trae precios).
    const seen = new Set<string>();
    const merged = results.filter((r) => {
      const key = `${(r.setName ?? '').toLowerCase()}|${r.number}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 12);

    // Marcar las que ya existen en la base local.
    for (const r of merged) {
      const set = r.setCode
        ? await this.sets.findOne({ code: r.setCode }).select('_id').exec()
        : await this.sets
            .findOne({ name: new RegExp(`^${escapeRegex(r.setName ?? '')}$`, 'i') })
            .select('_id')
            .exec();
      if (!set) { r.setInDb = false; r.inDb = false; continue; }
      r.setInDb = true;
      const existing = await this.cards
        .findOne({ set: set._id, number: this.formatNumber(r.number, r.printedTotal) })
        .select('_id')
        .exec();
      r.inDb = !!existing;
      r.cardId = existing?.id ?? null;
    }
    return merged;
  }

  /** Fuente 1: pokemontcg.io (trae precios de tcgplayer, pero es intermitente). */
  private async searchPokemonTcgIo(q: string, parsed: ReturnType<typeof parseCardQuery>): Promise<any[]> {
    const parts: string[] = [];
    if (parsed.name) {
      const raw = parsed.name.source.replace(/\\/g, '').replace(/[^\w\sáéíóúñ'-]/gi, '');
      parts.push(`name:*${raw.trim().split(/\s+/).join('* *')}*`);
    }
    if (parsed.number) {
      const num = (q.match(/(\d{1,4})/) ?? [])[1];
      if (num) parts.push(`number:${Number(num)}`);
    }
    const url =
      'https://api.pokemontcg.io/v2/cards?q=' +
      encodeURIComponent(parts.join(' ')) +
      '&pageSize=12&orderBy=-set.releaseDate';
    const body: any = await this.fetchWithRetry(url, 2);
    return (body.data ?? []).map((c: any) => ({
      apiId: c.id,
      source: 'pokemontcg.io',
      name: c.name,
      number: c.number,
      printedTotal: c.set?.printedTotal,
      setName: c.set?.name,
      setCode: c.set?.id,
      rarity: c.rarity,
      imageUrl: c.images?.small,
    }));
  }

  /** Fuente 2: TCGdex (api.tcgdex.net — estable y sin API key; sin precios). */
  private async searchTcgdex(q: string, parsed: ReturnType<typeof parseCardQuery>): Promise<any[]> {
    const name = parsed.name
      ? parsed.name.source.replace(/\\/g, '').replace(/[^\w\sáéíóúñ'-]/gi, '').trim()
      : '';
    if (!name) return []; // TCGdex no busca solo por número
    const num = parsed.number ? Number((q.match(/(\d{1,4})/) ?? [])[1]) : null;

    const list: any = await this.fetchWithRetry(
      `https://api.tcgdex.net/v2/en/cards?name=${encodeURIComponent(name)}`,
      2,
    );
    const setsMap = await this.tcgdexSets();
    return (Array.isArray(list) ? list : [])
      .filter((c: any) => (num == null ? true : Number(c.localId) === num))
      .slice(0, 12)
      .map((c: any) => {
        const setId = String(c.id).slice(0, String(c.id).lastIndexOf('-'));
        const setInfo = setsMap.get(setId);
        return {
          apiId: `tcgdex:${c.id}`,
          source: 'tcgdex',
          name: c.name,
          number: String(c.localId),
          printedTotal: setInfo?.count,
          setName: setInfo?.name,
          setCode: null,
          rarity: undefined,
          imageUrl: c.image ? `${c.image}/low.webp` : undefined,
        };
      });
  }

  /** Mapa id→(nombre, total) de sets de TCGdex, cacheado en memoria. */
  private tcgdexSetsCache: Map<string, { name: string; count?: number }> | null = null;
  private async tcgdexSets(): Promise<Map<string, { name: string; count?: number }>> {
    if (this.tcgdexSetsCache) return this.tcgdexSetsCache;
    const list: any = await this.fetchWithRetry('https://api.tcgdex.net/v2/en/sets', 2);
    this.tcgdexSetsCache = new Map(
      (Array.isArray(list) ? list : []).map((s: any) => [
        s.id,
        { name: s.name, count: s.cardCount?.official ?? s.cardCount?.total },
      ]),
    );
    return this.tcgdexSetsCache;
  }

  /** Importa una carta desde la web a la base (pokemontcg.io o TCGdex). */
  async importFromWeb(apiId: string): Promise<any> {
    if (apiId.startsWith('tcgdex:')) return this.importFromTcgdex(apiId.slice(7));

    const body: any = await this.fetchWithRetry(
      `https://api.pokemontcg.io/v2/cards/${encodeURIComponent(apiId)}`,
    );
    const c: any = body.data;
    if (!c) throw new NotFoundException('Carta no encontrada en la web');

    const set = await this.sets.findOne({ code: c.set?.id }).exec();
    if (!set) {
      throw new NotFoundException(
        `El set "${c.set?.name}" (${c.set?.id}) no está importado en la base`,
      );
    }

    const number = this.formatNumber(c.number, c.set?.printedTotal);
    const isPromo = /promo/i.test(set.name ?? '');
    const variants = this.inferVariants(c.rarity, set.releaseDate ?? '', isPromo);
    const prices = c.tcgplayer?.prices ?? {};
    const normal = prices.normal?.market ?? prices.normal?.mid ?? prices.holofoil?.market ?? 0.25;
    const reverse = prices.reverseHolofoil?.market ?? prices.reverseHolofoil?.mid ?? Math.round(normal * 160) / 100;
    const holo = prices.holofoil?.market ?? prices.holofoil?.mid ?? normal;
    const priceOf: Record<string, number> = { Normal: normal, 'Reverse Holo': reverse, Holo: holo };
    const variantValues: Record<string, number> = {};
    for (const v of variants) {
      variantValues[v] = Math.max(
        Math.round((priceOf[v] ?? 0.25) * 100) / 100,
        floorFor(v, c.rarity),
      );
    }

    const doc = await this.cards.findOneAndUpdate(
      { set: set._id, number },
      {
        $setOnInsert: { set: set._id, game: set.game, number },
        $set: {
          name: c.name,
          rarity: c.rarity,
          cardType: c.supertype,
          imageUrl: c.images?.large ?? c.images?.small,
          attributes: {
            types: c.types ?? [],
            ...(c.artist ? { illustrator: c.artist } : {}),
            ...(c.flavorText ? { text: c.flavorText } : {}),
          },
          variants,
          variantValues,
          setReleaseDate: set.releaseDate ?? '',
        },
      },
      { new: true, upsert: true },
    ).exec();
    await this.snapshotToday(doc._id as Types.ObjectId, variantValues);
    return doc.toJSON();
  }

  /** Importa desde TCGdex: el set local se ubica por nombre (no trae precios → pisos). */
  private async importFromTcgdex(id: string): Promise<any> {
    const c: any = await this.fetchWithRetry(
      `https://api.tcgdex.net/v2/en/cards/${encodeURIComponent(id)}`,
      2,
    );
    if (!c?.name) throw new NotFoundException('Carta no encontrada en TCGdex');

    const set = await this.sets
      .findOne({ name: new RegExp(`^${escapeRegex(c.set?.name ?? '')}$`, 'i') })
      .exec();
    if (!set) {
      throw new NotFoundException(
        `El set "${c.set?.name}" no está importado en la base`,
      );
    }

    const printedTotal = c.set?.cardCount?.official ?? c.set?.cardCount?.total;
    const number = this.formatNumber(String(c.localId), printedTotal);
    const isPromo = /promo/i.test(set.name ?? '');

    // TCGdex declara las variantes reales de la carta (normal/reverse/holo).
    let variants: string[] = [];
    if (c.variants?.normal) variants.push('Normal');
    if (c.variants?.holo) variants.push('Holo');
    if (c.variants?.reverse && !isPromo) variants.push('Reverse Holo');
    if (!variants.length) variants = this.inferVariants(c.rarity, set.releaseDate ?? '', isPromo);

    // Precios: TCGdex trae pricing por variante (tcgplayer USD / cardmarket EUR≈USD)
    // en variants_detailed; si no hay, quedan los pisos retail.
    const VARIANT_NAME: Record<string, string> = { normal: 'Normal', holo: 'Holo', reverse: 'Reverse Holo' };
    const marketOf: Record<string, number> = {};
    for (const vd of c.variants_detailed ?? []) {
      const name = VARIANT_NAME[vd.type];
      const tp = vd.pricing?.tcgplayer;
      const cm = vd.pricing?.cardmarket;
      const price = tp?.marketPrice ?? tp?.midPrice ?? tp?.lowPrice ?? cm?.trend ?? cm?.avg7 ?? cm?.avg;
      if (name && typeof price === 'number' && price > 0) marketOf[name] = price;
    }
    const variantValues: Record<string, number> = {};
    for (const v of variants) {
      variantValues[v] = Math.max(
        Math.round((marketOf[v] ?? 0) * 100) / 100,
        floorFor(v, c.rarity),
      );
    }

    const doc = await this.cards.findOneAndUpdate(
      { set: set._id, number },
      {
        $setOnInsert: { set: set._id, game: set.game, number },
        $set: {
          name: c.name,
          rarity: c.rarity,
          cardType: c.category,
          imageUrl: c.image ? `${c.image}/high.png` : undefined,
          attributes: {
            types: c.types ?? [],
            ...(c.illustrator ? { illustrator: c.illustrator } : {}),
            ...(c.effect ? { text: c.effect } : {}),
          },
          variants,
          variantValues,
          setReleaseDate: set.releaseDate ?? '',
        },
      },
      { new: true, upsert: true },
    ).exec();
    await this.snapshotToday(doc._id as Types.ObjectId, variantValues);
    return doc.toJSON();
  }

  /** Las APIs de cartas responden 502/500 intermitentes: reintenta con backoff. */
  private async fetchWithRetry(url: string, tries = 3): Promise<any> {
    let lastErr: any;
    for (let i = 0; i < tries; i++) {
      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': 'SingleTCG/1.0' },
          signal: AbortSignal.timeout(20_000),
        });
        if (res.ok) return await res.json();
        lastErr = new Error(`HTTP ${res.status}`);
      } catch (e) {
        lastErr = e;
      }
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
    const host = (() => { try { return new URL(url).hostname; } catch { return 'la API'; } })();
    throw new NotFoundException(
      `La fuente de cartas (${host}) está intermitente — intenta de nuevo en unos segundos`,
    );
  }

  /** "6" + total 98 → "006/98" (formato usado por el seed). */
  private formatNumber(n: string, printedTotal?: number): string {
    const padded = /^\d+$/.test(n) ? n.padStart(3, '0') : n;
    return printedTotal ? `${padded}/${printedTotal}` : padded;
  }

  /** Regla de variantes por era (versión resumida del import masivo). */
  private inferVariants(rarity?: string, releaseDate?: string, isPromo = false): string[] {
    const r = (rarity ?? '').toLowerCase();
    const modern = (releaseDate ?? '') >= '2020';
    const hasReverse = (releaseDate ?? '') >= '2002-05';
    // Las promos (Black Star Promos etc.) NO tienen reverse: una sola variante.
    if (isPromo) return r.includes('holo') || r.includes('rare') ? ['Holo'] : ['Normal'];
    if (!hasReverse) return r.includes('holo') ? ['Holo'] : ['Normal'];
    if (r === 'common' || r === 'uncommon') return ['Normal', 'Reverse Holo'];
    if (r === 'rare') return modern ? ['Holo', 'Reverse Holo'] : ['Normal', 'Reverse Holo'];
    if (r === 'rare holo') return ['Holo', 'Reverse Holo'];
    if (r) return ['Holo'];
    return ['Normal'];
  }

  async search(query: QueryCardDto): Promise<any> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 24;

    const filter: FilterQuery<CardModelDocument> = {};
    if (query.gameId) filter.game = new Types.ObjectId(query.gameId);
    if (query.setId) filter.set = new Types.ObjectId(query.setId);
    if (query.rarity) filter.rarity = query.rarity;
    if (query.cardType) filter.cardType = query.cardType;
    if (query.q) {
      // Soporta "nombre número" ("zorua 66"), "066/98", solo nombre o ARTISTA:
      // el texto matchea nombre de carta O ilustrador.
      const parsed = parseCardQuery(query.q);
      if (parsed.name) {
        filter.$or = [
          { name: parsed.name },
          { 'attributes.illustrator': parsed.name },
        ];
      }
      if (parsed.number) filter.number = parsed.number;
    }
    // Tipo específico del juego dentro de attributes.types (ej. tipo del Pokémon).
    // Mongo hace match si el array attributes.types contiene el valor.
    if (query.type) filter['attributes.types'] = query.type;

    // "con stock" = inventario con quantity > 0.
    if (query.seller) {
      // "Mis repetidas": solo cartas publicadas por ese vendedor (con stock).
      const mine = await this.inventory.distinct('cardModel', {
        seller: new Types.ObjectId(query.seller),
        quantity: { $gt: 0 },
      });
      filter._id = { $in: mine };
    } else if (query.inStock === 'true') {
      const withStock = await this.inventory.distinct('cardModel', {
        quantity: { $gt: 0 },
      });
      filter._id = { $in: withStock };
    } else if (query.forSale === 'true') {
      // "a la venta" = la carta tiene alguna publicación de inventario (con o sin stock).
      const listed = await this.inventory.distinct('cardModel', {});
      filter._id = { $in: listed };
    }

    // Orden: por defecto "más reciente primero" (fecha del set desc + número);
    // dentro de un set, por número. `dir` invierte la dirección.
    const dir: 1 | -1 = query.dir === 'asc' ? 1 : -1;
    let sort: Record<string, 1 | -1>;
    if (query.sortBy === 'artist') {
      // A–Z por defecto (dir asc); el toggle lo invierte. Solo cartas CON
      // ilustrador (si no, las sin dato encabezan la lista y es puro ruido).
      filter['attributes.illustrator'] = { $exists: true, $ne: '' };
      sort = { 'attributes.illustrator': query.dir === 'desc' ? -1 : 1, name: 1 };
    } else if (query.sortBy === 'name') {
      sort = { name: query.dir === 'desc' ? -1 : 1 };
    } else {
      sort = query.setId
        ? { number: query.dir === 'desc' ? -1 : 1 }
        : { setReleaseDate: dir, number: 1 };
    }

    const total = await this.cards.countDocuments(filter).exec();
    const cards = await this.cards
      .find(filter)
      .populate('game')
      .populate('set')
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();

    const stockByCard = await this.stockSummary(cards.map((c) => c._id));

    const data = cards.map((card) => {
      const s = stockByCard.get(card.id);
      return {
        ...card.toJSON(),
        inventoryCount: s?.count ?? 0,
        totalStock: s?.totalStock ?? 0,
        minPrice: s?.minPrice ?? null,
        sellerIds: (s?.sellerIds ?? []).filter(Boolean).map(String),
      };
    });

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Valores disponibles para armar los selectores de filtro del catálogo
   * (rarezas y tipos reales del juego/set elegido, no texto libre).
   */
  async facets(gameId?: string, setId?: string): Promise<any> {
    const filter: FilterQuery<CardModelDocument> = {};
    if (gameId) filter.game = new Types.ObjectId(gameId);
    if (setId) filter.set = new Types.ObjectId(setId);
    const [rarities, types] = await Promise.all([
      this.cards.distinct('rarity', filter),
      this.cards.distinct('attributes.types', filter),
    ]);
    const clean = (xs: any[]) =>
      xs.filter((x) => typeof x === 'string' && x.trim()).sort();
    return { rarities: clean(rarities), types: clean(types) };
  }

  async findOne(id: string): Promise<any> {
    const card = await this.cards
      .findById(id)
      .populate('game')
      .populate('set')
      .exec();
    if (!card) throw new NotFoundException('Carta no encontrada');

    const inventoryItems = await this.inventory
      .find({ cardModel: card._id })
      .sort({ price: 1 })
      .exec();

    return { ...card.toJSON(), inventoryItems };
  }

  create(dto: CreateCardDto) {
    const { gameId, setId, ...rest } = dto;
    return this.cards.create({
      ...rest,
      game: new Types.ObjectId(gameId),
      set: new Types.ObjectId(setId),
      attributes: dto.attributes ?? {},
    });
  }

  async update(id: string, dto: UpdateCardDto) {
    const card = await this.cards.findByIdAndUpdate(id, dto, { new: true }).exec();
    if (!card) throw new NotFoundException('Carta no encontrada');
    return card;
  }

  async remove(id: string) {
    await this.cards.findByIdAndDelete(id).exec();
    return { deleted: true };
  }

  /** Resumen de stock (nº de unidades, stock total y precio mínimo) por carta. */
  private async stockSummary(cardIds: Types.ObjectId[]) {
    const rows = await this.inventory.aggregate<{
      _id: Types.ObjectId;
      count: number;
      totalStock: number;
      minPrice: number;
      sellerIds: (Types.ObjectId | null)[];
    }>([
      { $match: { cardModel: { $in: cardIds }, quantity: { $gt: 0 } } },
      {
        $group: {
          _id: '$cardModel',
          count: { $sum: 1 },
          totalStock: { $sum: '$quantity' },
          minPrice: { $min: '$price' },
          sellerIds: { $addToSet: '$seller' },
        },
      },
    ]);
    return new Map(rows.map((r) => [r._id.toString(), r]));
  }
}
