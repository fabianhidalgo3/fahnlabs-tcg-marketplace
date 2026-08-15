import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CardSet, CardSetDocument } from '../../entities/card-set.entity';
import { CardModel, CardModelDocument } from '../../entities/card-model.entity';
import {
  CardLanguage,
  CollectionEntry,
  CollectionEntryDocument,
} from '../../entities/collection-entry.entity';
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
  ) {}

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
    return { quantity: entry.quantity };
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

    const cards = await this.cards
      .find({ set: new Types.ObjectId(setId) })
      .sort({ number: 1 })
      .exec();

    const owned = await this.entries
      .find({
        user: new Types.ObjectId(userId),
        cardModel: { $in: cards.map((c) => c._id) },
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

    const cardsView = cards.map((card) => {
      const byVariant = ownedMap.get(card.id) ?? {};
      const variants = (card.variants ?? ['Normal']).map((variant) => {
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
    });

    return {
      ...set.toJSON(),
      cards: cardsView,
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

    const [sets, totals, owned] = await Promise.all([
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
    ]);

    const totalsBySet = new Map(totals.map((t) => [t._id.toString(), t]));
    const ownedBySet = new Map(owned.map((o) => [o._id.toString(), o]));
    const round = (n: number) => Math.round(n * 100) / 100;

    return sets.map((set) => {
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
