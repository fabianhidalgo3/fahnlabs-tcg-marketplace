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

  /** Lista de sets con el progreso de la colección del usuario. */
  async getMySets(userId: string): Promise<any> {
    const [sets, cards, owned] = await Promise.all([
      this.sets.find().sort({ releaseDate: -1, name: 1 }).exec(),
      this.cards.find().exec(),
      this.entries.find({ user: new Types.ObjectId(userId) }).exec(),
    ]);

    const cardById = new Map(cards.map((c) => [c.id, c]));
    // Slots totales y valor por set (una copia de cada variante = set completo).
    const bySet = new Map<
      string,
      { totalSlots: number; setValue: number; cardIds: Set<string> }
    >();
    for (const c of cards) {
      const sid = c.set.toString();
      const agg = bySet.get(sid) ?? { totalSlots: 0, setValue: 0, cardIds: new Set() };
      const variants = c.variants ?? ['Normal'];
      agg.totalSlots += variants.length;
      agg.setValue += variants.reduce((s, v) => s + (c.variantValues?.[v] ?? 0), 0);
      agg.cardIds.add(c.id);
      bySet.set(sid, agg);
    }

    // Slots poseídos (en cualquier idioma), valor y duplicadas por set.
    const ownedSlotKeys = new Map<string, Set<string>>(); // setId -> "cardId|variant"
    const ownedValue = new Map<string, number>();
    const dupes = new Map<string, number>();
    for (const e of owned) {
      const card = cardById.get(e.cardModel.toString());
      if (!card || e.quantity <= 0) continue;
      const sid = card.set.toString();
      const slots = ownedSlotKeys.get(sid) ?? new Set();
      slots.add(`${card.id}|${e.variant}`);
      ownedSlotKeys.set(sid, slots);
      const val = (card.variantValues?.[e.variant] ?? 0) * e.quantity;
      ownedValue.set(sid, (ownedValue.get(sid) ?? 0) + val);
      dupes.set(sid, (dupes.get(sid) ?? 0) + Math.max(e.quantity - 1, 0));
    }

    return sets.map((set) => {
      const agg = bySet.get(set.id) ?? { totalSlots: 0, setValue: 0, cardIds: new Set() };
      const ownedSlots = ownedSlotKeys.get(set.id)?.size ?? 0;
      return {
        ...set.toJSON(),
        collection: {
          totalSlots: agg.totalSlots,
          ownedSlots,
          missingSlots: Math.max(agg.totalSlots - ownedSlots, 0),
          completionPercent: agg.totalSlots
            ? Math.round((ownedSlots / agg.totalSlots) * 1000) / 10
            : 0,
          setValue: Math.round(agg.setValue * 100) / 100,
          collectionValue: Math.round((ownedValue.get(set.id) ?? 0) * 100) / 100,
          duplicates: dupes.get(set.id) ?? 0,
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
