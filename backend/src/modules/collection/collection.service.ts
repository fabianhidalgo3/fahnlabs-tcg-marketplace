import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { parseCardQuery } from '../../common/card-search.util';
import { CardSet, CardSetDocument } from '../../entities/card-set.entity';
import { CardModel, CardModelDocument } from '../../entities/card-model.entity';
import {
  CardLanguage,
  CollectionEntry,
  CollectionEntryDocument,
} from '../../entities/collection-entry.entity';
import {
  StorageLocation,
  StorageLocationDocument,
} from '../../entities/storage-location.entity';
import {
  InventoryItem,
  InventoryItemDocument,
} from '../../entities/inventory-item.entity';
import { FxService } from '../../common/fx.service';
import {
  AdjustCollectionDto,
  AssignStorageDto,
  SetCollectionDto,
} from './dto/collection.dto';

const LANGS: CardLanguage[] = [CardLanguage.EN, CardLanguage.ES];

@Injectable()
export class CollectionService {
  constructor(
    @InjectModel(CardSet.name) private readonly sets: Model<CardSetDocument>,
    @InjectModel(CardModel.name) private readonly cards: Model<CardModelDocument>,
    @InjectModel(CollectionEntry.name)
    private readonly entries: Model<CollectionEntryDocument>,
    @InjectModel(StorageLocation.name)
    private readonly storage: Model<StorageLocationDocument>,
    @InjectModel(InventoryItem.name)
    private readonly inventory: Model<InventoryItemDocument>,
    private readonly fx: FxService,
  ) {}

  /**
   * Publica mis cartas REPETIDAS (quantity > 1) como unidades a la venta en el
   * marketplace, atribuidas a mí como vendedor. La colección no se toca: se
   * publica el excedente (quantity - 1) a precio de mercado (variantValues).
   * Idempotente: actualiza la publicación existente del mismo slot.
   */
  async sellDuplicates(userId: string): Promise<any> {
    const uid = new Types.ObjectId(userId);
    const dups = await this.entries
      .find({ user: uid, quantity: { $gt: 1 } })
      .populate('cardModel', 'name number variants variantValues')
      .exec();

    let created = 0, updated = 0, skipped = 0;
    for (const e of dups) {
      const card: any = e.cardModel;
      if (!card) { skipped++; continue; }
      const surplus = e.quantity - 1;
      const price = Number(card.variantValues?.[e.variant]) || 0;
      if (!price) { skipped++; continue; }
      const isFoil = e.variant !== 'Normal';
      const sku = `MKT-${card._id.toString().slice(-6)}-${uid.toString().slice(-6)}-${e.variant.replace(/\s+/g, '')}-${e.language}`.toUpperCase();
      const res = await this.inventory.updateOne(
        { sku },
        {
          $setOnInsert: {
            sku,
            cardModel: card._id,
            condition: 'NM',
            language: e.language,
            isFoil,
            seller: uid,
          },
          $set: { price, quantity: surplus },
        },
        { upsert: true },
      );
      if (res.upsertedCount) created++;
      else updated++;
    }
    return { duplicates: dups.length, created, updated, skipped };
  }

  /**
   * REGLA DEL MARKETPLACE: publicar es SIEMPRE una decisión del usuario
   * ("Vender repetidas" o Mis publicaciones) — nada se publica solo.
   * Esta sincronización solo protege hacia ABAJO: si las copias bajan,
   * el stock publicado se ajusta al excedente (o queda en 0); nunca crea
   * ni sube publicaciones por su cuenta.
   */
  private async syncMarketListing(
    user: Types.ObjectId,
    cardModel: Types.ObjectId,
    variant: string,
    language: CardLanguage,
  ): Promise<void> {
    try {
      const sku = `MKT-${cardModel.toString().slice(-6)}-${user.toString().slice(-6)}-${variant.replace(/\s+/g, '')}-${language}`.toUpperCase();
      const listing = await this.inventory.findOne({ sku, seller: user }).select('quantity').exec();
      if (!listing) return; // no publicada → no se toca
      const entry = await this.entries
        .findOne({ user, cardModel, variant, language })
        .select('quantity')
        .exec();
      const surplus = Math.max((entry?.quantity ?? 0) - 1, 0);
      if (listing.quantity > surplus) {
        await this.inventory.updateOne({ _id: listing._id }, { $set: { quantity: surplus } }).exec();
      }
    } catch {
      // la sincronización del marketplace nunca debe romper un cambio de colección
    }
  }

  /** Sube/baja la cantidad poseída de (carta, variante, idioma). No baja de 0. */
  async adjust(userId: string, dto: AdjustCollectionDto): Promise<{ quantity: number }> {
    const key = {
      user: new Types.ObjectId(userId),
      cardModel: new Types.ObjectId(dto.cardModelId),
      variant: dto.variant,
      language: dto.language,
    };
    const current = await this.entries.findOne(key).exec();
    const next = Math.max((current?.quantity ?? 0) + dto.delta, 0);
    const entry = await this.entries
      .findOneAndUpdate(key, { $set: { quantity: next } }, { new: true, upsert: true })
      .exec();
    // Si la carta queda poseída y aún no tiene ubicación, se guarda sola en el
    // álbum/carpeta del usuario vinculado al set de la carta (si existe).
    if (entry.quantity > 0 && !entry.storage) {
      const auto = await this.defaultStorageFor(key.user, key.cardModel);
      if (auto) {
        entry.storage = auto;
        await entry.save();
      }
    }
    await this.syncMarketListing(key.user, key.cardModel, dto.variant, dto.language as CardLanguage);
    return { quantity: entry.quantity };
  }

  /** Álbum del usuario vinculado al set de la carta, si tiene uno. */
  private async defaultStorageFor(
    user: Types.ObjectId,
    cardModel: Types.ObjectId,
  ): Promise<Types.ObjectId | null> {
    const card = await this.cards.findById(cardModel).select('set').exec();
    if (!card?.set) return null;
    const album = await this.storage
      .findOne({ user, set: card.set })
      .select('_id')
      .exec();
    return album?._id ?? null;
  }

  /** Fija la cantidad exacta poseída. */
  async setQuantity(userId: string, dto: SetCollectionDto): Promise<{ quantity: number }> {
    const quantity = Math.max(dto.quantity, 0);
    const entry = await this.entries
      .findOneAndUpdate(
        {
          user: new Types.ObjectId(userId),
          cardModel: new Types.ObjectId(dto.cardModelId),
          variant: dto.variant,
          language: dto.language,
        },
        { $set: { quantity } },
        { new: true, upsert: true },
      )
      .exec();
    // Misma regla que adjust: auto-ubicar en el álbum vinculado al set.
    if (entry.quantity > 0 && !entry.storage) {
      const auto = await this.defaultStorageFor(entry.user as Types.ObjectId, entry.cardModel as Types.ObjectId);
      if (auto) {
        entry.storage = auto;
        await entry.save();
      }
    }
    await this.syncMarketListing(
      entry.user as Types.ObjectId,
      entry.cardModel as Types.ObjectId,
      dto.variant,
      dto.language as CardLanguage,
    );
    return { quantity: entry.quantity };
  }

  /** Asigna (o quita) el álbum/caja donde se guarda una carta poseída. */
  async assignStorage(userId: string, dto: AssignStorageDto): Promise<{ ok: boolean }> {
    await this.entries
      .findOneAndUpdate(
        {
          user: new Types.ObjectId(userId),
          cardModel: new Types.ObjectId(dto.cardModelId),
          variant: dto.variant,
          language: dto.language,
        },
        {
          $set: {
            storage: dto.storageId ? new Types.ObjectId(dto.storageId) : null,
          },
        },
        { new: true, upsert: true },
      )
      .exec();
    return { ok: true };
  }

  /**
   * Checklist de un set para el usuario: cada carta con sus variantes, valor,
   * cuántas posee en cada idioma y en qué álbum/caja están guardadas.
   */
  async getSetChecklist(userId: string, setId: string): Promise<any> {
    const set = await this.sets.findById(setId).exec();
    if (!set) throw new NotFoundException('Set no encontrado');

    const [cards, promoDocs] = await Promise.all([
      this.cards.find({ set: new Types.ObjectId(setId) }).sort({ number: 1 }).exec(),
      set.promoCards?.length
        ? this.cards.find({ _id: { $in: set.promoCards } }).sort({ number: 1 }).exec()
        : Promise.resolve([]),
    ]);

    const owned = await this.entries
      .find({
        user: new Types.ObjectId(userId),
        cardModel: { $in: [...cards, ...promoDocs].map((c) => c._id) },
      })
      .populate('storage', 'name type color')
      .exec();

    // Mapa cardId -> variant -> language -> { quantity, storage }
    type Slot = { quantity: number; storage: any };
    const ownedMap = new Map<string, Record<string, Record<string, Slot>>>();
    for (const e of owned) {
      const cid = e.cardModel.toString();
      const byVariant = ownedMap.get(cid) ?? {};
      const byLang = byVariant[e.variant] ?? {};
      byLang[e.language] = {
        quantity: e.quantity,
        storage: e.storage ? (e.storage as any).toJSON?.() ?? e.storage : null,
      };
      byVariant[e.variant] = byLang;
      ownedMap.set(cid, byVariant);
    }

    const toView = (card: any) => {
      const byVariant = ownedMap.get(card.id) ?? {};
      const variants = (card.variants ?? ['Normal']).map((variant: string) => {
        const ownedByLang = byVariant[variant] ?? {};
        const en = ownedByLang[CardLanguage.EN]?.quantity ?? 0;
        const es = ownedByLang[CardLanguage.ES]?.quantity ?? 0;
        return {
          variant,
          value: card.variantValues?.[variant] ?? 0,
          owned: { EN: en, ES: es },
          ownedTotal: en + es,
          storage: {
            EN: ownedByLang[CardLanguage.EN]?.storage ?? null,
            ES: ownedByLang[CardLanguage.ES]?.storage ?? null,
          },
        };
      });
      return {
        id: card.id,
        name: card.name,
        number: card.number,
        rarity: card.rarity,
        cardType: card.cardType,
        imageUrl: card.imageUrl,
        attributes: card.attributes,
        variants,
      };
    };
    const cardsView = cards.map(toView);
    const promosView = promoDocs.map(toView);

    return {
      ...set.toJSON(),
      cards: cardsView,
      promos: promosView,
      stats: this.summarize(cardsView),
    };
  }

  /**
   * Lista de sets con el progreso de la colección del usuario.
   * Optimizado: en vez de cargar todas las cartas (20k+) en memoria, se agregan
   * los totales por set en Mongo (dos aggregations que devuelven ~1 fila por set).
   */
  async getMySets(userId: string): Promise<any> {
    const uid = new Types.ObjectId(userId);

    const [sets, totals, owned, albumSetIds] = await Promise.all([
      this.sets.find().sort({ releaseDate: -1, name: 1 }).exec(),
      // Totales por set: nº de slots (Σ variantes) y valor del set (Σ variantValues).
      this.cards.aggregate<{ _id: Types.ObjectId; totalSlots: number; setValue: number }>([
        {
          $group: {
            _id: '$set',
            totalSlots: { $sum: { $size: { $ifNull: ['$variants', []] } } },
            setValue: {
              $sum: {
                $sum: {
                  $map: {
                    input: { $objectToArray: { $ifNull: ['$variantValues', {}] } },
                    as: 'kv',
                    in: '$$kv.v',
                  },
                },
              },
            },
          },
        },
      ]),
      // Poseídas por set: slots distintos, valor de la colección y duplicadas.
      this.entries.aggregate<{ _id: Types.ObjectId; ownedSlots: number; value: number; duplicates: number }>([
        { $match: { user: uid, quantity: { $gt: 0 } } },
        { $lookup: { from: 'card_models', localField: 'cardModel', foreignField: '_id', as: 'c' } },
        { $unwind: '$c' },
        {
          $group: {
            _id: '$c.set',
            slots: { $addToSet: { $concat: [{ $toString: '$cardModel' }, '|', '$variant'] } },
            value: {
              $sum: {
                $multiply: [
                  '$quantity',
                  {
                    $let: {
                      vars: {
                        m: {
                          $first: {
                            $filter: {
                              input: { $objectToArray: { $ifNull: ['$c.variantValues', {}] } },
                              as: 'kv',
                              cond: { $eq: ['$$kv.k', '$variant'] },
                            },
                          },
                        },
                      },
                      in: { $toDouble: { $ifNull: ['$$m.v', 0] } },
                    },
                  },
                ],
              },
            },
            duplicates: { $sum: { $max: [{ $subtract: ['$quantity', 1] }, 0] } },
          },
        },
        { $project: { ownedSlots: { $size: '$slots' }, value: 1, duplicates: 1 } },
      ]),
      // Sets con un álbum/carpeta vinculado (aunque aún no tengan cartas).
      this.storage.distinct('set', { user: uid, set: { $ne: null } }),
    ]);

    const totalsBySet = new Map(totals.map((t) => [t._id.toString(), t]));
    const ownedBySet = new Map(owned.map((o) => [o._id.toString(), o]));
    const albumSets = new Set(
      (albumSetIds as Types.ObjectId[]).map((s) => s.toString()),
    );
    const round = (n: number) => Math.round(n * 100) / 100;

    // "Mi colección" solo muestra sets donde tengo cartas o que agregué como carpeta.
    return sets
      .filter((set) => {
        const o = ownedBySet.get(set.id);
        return (o?.ownedSlots ?? 0) > 0 || albumSets.has(set.id);
      })
      .map((set) => {
        const t = totalsBySet.get(set.id);
        const o = ownedBySet.get(set.id);
        const totalSlots = t?.totalSlots ?? 0;
        const ownedSlots = o?.ownedSlots ?? 0;
        return {
          ...set.toJSON(),
          collection: {
            totalSlots,
            ownedSlots,
            missingSlots: Math.max(totalSlots - ownedSlots, 0),
            completionPercent: totalSlots
              ? Math.round((ownedSlots / totalSlots) * 1000) / 10
              : 0,
            setValue: round(t?.setValue ?? 0),
            collectionValue: round(o?.value ?? 0),
            duplicates: o?.duplicates ?? 0,
          },
        };
      });
  }

  /**
   * "Toda mi colección" plana: una fila por carta que poseo (sumando variantes
   * e idiomas), con filtros de catálogo (juego/set/rareza/tipo/nombre) y paginación.
   */
  // ==== Exportar a Excel =====================================================

  /** Genera un workbook xlsx con una hoja: cabecera con estilo + filas. */
  private async buildXlsx(
    sheetName: string,
    columns: { header: string; key: string; width?: number; numFmt?: string }[],
    rows: Record<string, any>[],
  ): Promise<Buffer> {
    const ExcelJS = await import('exceljs');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(sheetName);
    ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 18 }));
    for (const c of columns) if (c.numFmt) ws.getColumn(c.key).numFmt = c.numFmt;
    ws.addRows(rows);
    const head = ws.getRow(1);
    head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4C66C3' } };
    head.alignment = { vertical: 'middle' };
    head.height = 20;
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  /** Excel de "Cartas": todo lo que poseo con los MISMOS filtros de la vista. */
  async exportMyCardsXlsx(userId: string, query: any): Promise<Buffer> {
    const rate = (await this.fx.rates()).usdClp;
    const clp = (usd: number) => Math.round((usd ?? 0) * rate);
    const res = await this.getMyCards(userId, { ...query, page: 1, limit: 10000 });
    const rows = (res.data ?? []).map((c: any) => ({
      number: c.number,
      name: c.name,
      set: c.set?.name ?? '',
      variant: c.variant,
      rarity: c.rarity ?? '',
      languages: (c.languages ?? []).join(' · '),
      quantity: c.quantity,
      unitClp: clp(c.value),
      totalClp: clp(c.value) * (c.quantity ?? 0),
      unitUsd: c.value ?? 0,
      albums: (c.albums ?? []).map((a: any) => a.name).join(' · '),
    }));
    return this.buildXlsx('Mis cartas', [
      { header: '#', key: 'number', width: 10 },
      { header: 'Carta', key: 'name', width: 26 },
      { header: 'Set', key: 'set', width: 26 },
      { header: 'Variante', key: 'variant', width: 14 },
      { header: 'Rareza', key: 'rarity', width: 20 },
      { header: 'Idiomas', key: 'languages', width: 10 },
      { header: 'Copias', key: 'quantity', width: 8 },
      { header: 'Valor unit. (CLP)', key: 'unitClp', width: 14 },
      { header: 'Valor total (CLP)', key: 'totalClp', width: 14 },
      { header: 'Valor unit. (USD)', key: 'unitUsd', width: 14 },
      { header: 'Álbum(es)', key: 'albums', width: 30 },
    ], rows);
  }

  /** Excel de "Sets / Álbumes": progreso por set. */
  async exportMySetsXlsx(userId: string): Promise<Buffer> {
    const rate = (await this.fx.rates()).usdClp;
    const clp = (usd: number) => Math.round((usd ?? 0) * rate);
    const sets = await this.getMySets(userId);
    const rows = (sets ?? []).map((s: any) => ({
      name: s.name,
      code: s.code,
      series: s.series ?? '',
      releaseDate: s.releaseDate ?? '',
      owned: s.collection?.ownedSlots ?? 0,
      total: s.collection?.totalSlots ?? 0,
      pct: (s.collection?.completionPercent ?? 0) / 100,
      duplicates: s.collection?.duplicates ?? 0,
      valueClp: clp(s.collection?.collectionValue ?? 0),
      valueUsd: s.collection?.collectionValue ?? 0,
    }));
    const buf = await this.buildXlsx('Mis sets', [
      { header: 'Set', key: 'name', width: 30 },
      { header: 'Código', key: 'code', width: 12 },
      { header: 'Serie', key: 'series', width: 20 },
      { header: 'Lanzamiento', key: 'releaseDate', width: 13 },
      { header: 'Poseídas', key: 'owned', width: 10 },
      { header: 'Total', key: 'total', width: 8 },
      { header: '% Completado', key: 'pct', width: 13, numFmt: '0.0%' },
      { header: 'Duplicadas', key: 'duplicates', width: 11 },
      { header: 'Valor (CLP)', key: 'valueClp', width: 13 },
      { header: 'Valor (USD)', key: 'valueUsd', width: 12 },
    ], rows);
    return buf;
  }

  /** Excel del checklist de UN set: una fila por carta+variante (incluye promos).
   *  `mode` replica el filtro de la vista: all | missing (faltantes) | owned. */
  async exportChecklistXlsx(
    userId: string,
    setId: string,
    mode: 'all' | 'missing' | 'owned' = 'all',
  ): Promise<{ buffer: Buffer; setName: string }> {
    const rate = (await this.fx.rates()).usdClp;
    const clp = (usd: number) => Math.round((usd ?? 0) * rate);
    const checklist = await this.getSetChecklist(userId, setId);
    const rows: Record<string, any>[] = [];
    const push = (card: any, promo: boolean) => {
      for (const v of card.variants ?? []) {
        const ownedTotal = v.ownedTotal ?? 0;
        if (mode === 'missing' && ownedTotal > 0) continue;
        if (mode === 'owned' && ownedTotal === 0) continue;
        rows.push({
          number: card.number,
          name: card.name,
          rarity: card.rarity ?? '',
          promo: promo ? 'Sí' : '',
          variant: v.variant,
          en: v.owned?.EN ?? 0,
          es: v.owned?.ES ?? 0,
          total: v.ownedTotal ?? 0,
          have: (v.ownedTotal ?? 0) > 0 ? 'La tengo' : 'Me falta',
          valueClp: clp(v.value),
          valueUsd: v.value ?? 0,
          album: v.storage?.EN?.name ?? v.storage?.ES?.name ?? '',
        });
      }
    };
    for (const c of checklist.cards ?? []) push(c, false);
    for (const c of checklist.promos ?? []) push(c, true);
    const buffer = await this.buildXlsx(String(checklist.name ?? 'Set').slice(0, 31), [
      { header: '#', key: 'number', width: 10 },
      { header: 'Carta', key: 'name', width: 26 },
      { header: 'Rareza', key: 'rarity', width: 20 },
      { header: 'Promo', key: 'promo', width: 8 },
      { header: 'Variante', key: 'variant', width: 14 },
      { header: 'EN', key: 'en', width: 6 },
      { header: 'ES', key: 'es', width: 6 },
      { header: 'Total', key: 'total', width: 7 },
      { header: 'Estado', key: 'have', width: 10 },
      { header: 'Valor (CLP)', key: 'valueClp', width: 12 },
      { header: 'Valor (USD)', key: 'valueUsd', width: 12 },
      { header: 'Álbum', key: 'album', width: 24 },
    ], rows);
    return { buffer, setName: checklist.name ?? 'set' };
  }

  /** Resumen de MI colección para el Inicio: totales + sets en progreso. */
  async getSummary(userId: string): Promise<any> {
    const uid = new Types.ObjectId(userId);
    const [sets, [totals]] = await Promise.all([
      this.getMySets(userId),
      this.entries.aggregate<any>([
        { $match: { user: uid, quantity: { $gt: 0 } } },
        { $group: { _id: { card: '$cardModel', variant: '$variant' }, qty: { $sum: '$quantity' } } },
        { $group: { _id: null, distinctSlots: { $sum: 1 }, totalCopies: { $sum: '$qty' } } },
      ]),
    ]);
    const inProgress = (sets ?? [])
      .filter((s: any) => (s.collection?.completionPercent ?? 0) > 0 && s.collection.completionPercent < 100)
      .sort((a: any, b: any) => b.collection.completionPercent - a.collection.completionPercent)
      .slice(0, 4)
      .map((s: any) => ({
        id: s.id,
        name: s.name,
        symbolUrl: s.symbolUrl ?? null,
        completionPercent: s.collection.completionPercent,
        ownedSlots: s.collection.ownedSlots,
        totalSlots: s.collection.totalSlots,
      }));
    return {
      sets: sets?.length ?? 0,
      distinctSlots: totals?.distinctSlots ?? 0,
      totalCopies: totals?.totalCopies ?? 0,
      collectionValue: (sets ?? []).reduce((sum: number, s: any) => sum + (s.collection?.collectionValue ?? 0), 0),
      duplicates: (sets ?? []).reduce((sum: number, s: any) => sum + (s.collection?.duplicates ?? 0), 0),
      setsInProgress: inProgress,
    };
  }

  /** Rarezas y variantes presentes en las cartas que el usuario posee. */
  async getMyCardFacets(userId: string): Promise<{ rarities: string[]; variants: string[] }> {
    const uid = new Types.ObjectId(userId);
    const [res] = await this.entries.aggregate<any>([
      { $match: { user: uid, quantity: { $gt: 0 } } },
      { $lookup: { from: 'card_models', localField: 'cardModel', foreignField: '_id', as: 'c' } },
      { $unwind: '$c' },
      { $group: { _id: null, rarities: { $addToSet: '$c.rarity' }, variants: { $addToSet: '$variant' } } },
    ]);
    const clean = (xs: any[]) => (xs ?? []).filter((x) => typeof x === 'string' && x.trim());
    const VARIANT_ORDER = ['Normal', 'Reverse Holo', 'Holo'];
    return {
      rarities: clean(res?.rarities).sort(),
      variants: clean(res?.variants).sort(
        (a, b) => VARIANT_ORDER.indexOf(a) - VARIANT_ORDER.indexOf(b),
      ),
    };
  }

  /** Mis copias de UNA carta: por variante+idioma, con álbum y total. */
  async getMyCopies(userId: string, cardModelId: string): Promise<any> {
    const rows = await this.entries
      .find({
        user: new Types.ObjectId(userId),
        cardModel: new Types.ObjectId(cardModelId),
        quantity: { $gt: 0 },
      })
      .populate('storage', 'name color')
      .sort({ variant: 1, language: 1 })
      .exec();
    const items = rows.map((e: any) => ({
      variant: e.variant,
      language: e.language,
      quantity: e.quantity,
      album: e.storage
        ? { id: e.storage.id, name: e.storage.name, color: e.storage.color ?? null }
        : null,
    }));
    return { total: items.reduce((s, r) => s + r.quantity, 0), items };
  }

  async getMyCards(userId: string, query: any): Promise<any> {
    const uid = new Types.ObjectId(userId);
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 24));

    const cardMatch: Record<string, any> = {};
    if (query.gameId) cardMatch['c.game'] = new Types.ObjectId(query.gameId);
    if (query.setId) cardMatch['c.set'] = new Types.ObjectId(query.setId);
    if (query.rarity) cardMatch['c.rarity'] = query.rarity;
    if (query.type) cardMatch['c.attributes.types'] = query.type;
    if (query.sortBy === 'artist') cardMatch['c.attributes.illustrator'] = { $exists: true, $ne: '' };
    // Filtro por variante del slot (Normal / Reverse Holo / Holo).
    const entryMatch: Record<string, any> = { user: uid, quantity: { $gt: 0 } };
    if (query.variant) entryMatch.variant = query.variant;
    if (query.q) {
      const parsed = parseCardQuery(query.q);
      if (parsed.name) {
        cardMatch.$or = [
          { 'c.name': parsed.name },
          { 'c.attributes.illustrator': parsed.name },
        ];
      }
      if (parsed.number) cardMatch['c.number'] = parsed.number;
    }

    const res = await this.entries.aggregate<any>([
      { $match: entryMatch },
      { $lookup: { from: 'card_models', localField: 'cardModel', foreignField: '_id', as: 'c' } },
      { $unwind: '$c' },
      ...(Object.keys(cardMatch).length ? [{ $match: cardMatch }] : []),
      {
        // Valor unitario de ESTA variante (variantValues[variant]).
        $addFields: {
          unit: {
            $let: {
              vars: {
                m: {
                  $first: {
                    $filter: {
                      input: { $objectToArray: { $ifNull: ['$c.variantValues', {}] } },
                      as: 'kv',
                      cond: { $eq: ['$$kv.k', '$variant'] },
                    },
                  },
                },
              },
              in: { $toDouble: { $ifNull: ['$$m.v', 0] } },
            },
          },
        },
      },
      {
        // Un slot por (carta, variante): Normal y Reverse son coleccionables
        // distintos, NO duplicados entre sí.
        $group: {
          _id: { card: '$c._id', variant: '$variant' },
          card: { $first: '$c' },
          quantity: { $sum: '$quantity' },
          value: { $sum: { $multiply: ['$quantity', '$unit'] } },
          languages: { $addToSet: '$language' },
          storages: { $addToSet: '$storage' },
          // mayor cantidad en UN idioma: define si hay excedente vendible
          maxLangQty: { $max: '$quantity' },
        },
      },
      // "Solo repetidas" = regla del marketplace: 2+ copias de la MISMA
      // carta+variante+idioma (1 EN + 1 ES no es repetida vendible).
      ...(query.dups === 'true' ? [{ $match: { maxLangQty: { $gt: 1 } } }] : []),
      // "Más reciente primero" por defecto; `dir=asc` invierte la fecha.
      {
        $sort: (query.sortBy === 'artist'
          ? { 'card.attributes.illustrator': query.dir === 'desc' ? -1 : 1, 'card.name': 1, '_id.variant': 1 }
          : {
              'card.setReleaseDate': query.dir === 'asc' ? 1 : -1,
              'card.number': 1,
              '_id.variant': 1,
            }) as any,
      },
      {
        $facet: {
          data: [{ $skip: (page - 1) * limit }, { $limit: limit }],
          meta: [{ $count: 'total' }],
          copies: [{ $group: { _id: null, n: { $sum: '$quantity' } } }],
        },
      },
    ]);

    const total = res[0]?.meta?.[0]?.total ?? 0;
    const totalCopies = res[0]?.copies?.[0]?.n ?? 0;
    const rows: any[] = res[0]?.data ?? [];
    const [setDocs, storageDocs] = await Promise.all([
      this.sets
        .find({ _id: { $in: rows.map((r) => r.card.set) } })
        .select('name code symbolUrl')
        .exec(),
      this.storage
        .find({ _id: { $in: rows.flatMap((r) => r.storages).filter(Boolean) } })
        .select('name color type')
        .exec(),
    ]);
    const setById = new Map(setDocs.map((s) => [s.id, s]));
    const storageById = new Map(storageDocs.map((s) => [s.id, s]));

    const data = rows.map((r: any) => ({
      id: r._id.card.toString(),
      variant: r._id.variant,
      name: r.card.name,
      number: r.card.number,
      rarity: r.card.rarity,
      cardType: r.card.cardType,
      imageUrl: r.card.imageUrl,
      attributes: r.card.attributes,
      set: setById.get(r.card.set?.toString())?.toJSON() ?? null,
      quantity: r.quantity,
      value: Math.round(r.value * 100) / 100,
      languages: r.languages,
      // Álbumes/cajas donde hay copias de esta carta (puede ser más de uno).
      albums: (r.storages ?? [])
        .filter(Boolean)
        .map((id: Types.ObjectId) => storageById.get(id.toString()))
        .filter(Boolean)
        .map((s: any) => ({ id: s.id, name: s.name, color: s.color })),
    }));

    return { data, total, totalCopies, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /** Resumen de completitud/valor del checklist (para un set concreto). */
  private summarize(cardsView: any[]) {
    let totalSlots = 0;
    let setValue = 0;
    const owned = { all: 0, EN: 0, ES: 0 };
    const value = { all: 0, EN: 0, ES: 0 };
    let duplicates = 0;

    for (const card of cardsView) {
      for (const v of card.variants) {
        totalSlots += 1;
        setValue += v.value;
        if (v.ownedTotal > 0) owned.all += 1;
        if (v.owned.EN > 0) owned.EN += 1;
        if (v.owned.ES > 0) owned.ES += 1;
        value.EN += v.value * v.owned.EN;
        value.ES += v.value * v.owned.ES;
        value.all += v.value * v.ownedTotal;
        duplicates += Math.max(v.owned.EN - 1, 0) + Math.max(v.owned.ES - 1, 0);
      }
    }

    const pct = (n: number) =>
      totalSlots ? Math.round((n / totalSlots) * 1000) / 10 : 0;
    const money = (n: number) => Math.round(n * 100) / 100;

    return {
      totalSlots,
      setValue: money(setValue),
      duplicates,
      owned,
      missing: {
        all: totalSlots - owned.all,
        EN: totalSlots - owned.EN,
        ES: totalSlots - owned.ES,
      },
      completionPercent: {
        all: pct(owned.all),
        EN: pct(owned.EN),
        ES: pct(owned.ES),
      },
      collectionValue: {
        all: money(value.all),
        EN: money(value.EN),
        ES: money(value.ES),
      },
    };
  }
}
