import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CardSet, CardSetDocument } from '../../entities/card-set.entity';
import { CardModel, CardModelDocument } from '../../entities/card-model.entity';
import {
  InventoryItem,
  InventoryItemDocument,
} from '../../entities/inventory-item.entity';
import { CreateSetDto, UpdateSetDto } from './dto/set.dto';

export interface CompletionStats {
  totalCards: number; // tamaño oficial del set
  registeredCards: number; // modelos cargados en el catálogo
  collectedCards: number; // modelos con al menos 1 unidad en stock
  completionPercent: number; // collectedCards / totalCards * 100
  missingCards: number;
}

@Injectable()
export class SetsService {
  constructor(
    @InjectModel(CardSet.name) private readonly sets: Model<CardSetDocument>,
    @InjectModel(CardModel.name) private readonly cards: Model<CardModelDocument>,
    @InjectModel(InventoryItem.name)
    private readonly inventory: Model<InventoryItemDocument>,
  ) {}

  /** Asocia una carta promocional al set (idempotente). */
  async addPromo(setId: string, cardId: string): Promise<{ promoCards: string[] }> {
    if (!Types.ObjectId.isValid(cardId)) throw new NotFoundException('Carta inválida');
    const card = await this.cards.findById(cardId).select('_id').exec();
    if (!card) throw new NotFoundException('Carta no encontrada');
    const set = await this.sets
      .findByIdAndUpdate(setId, { $addToSet: { promoCards: card._id } }, { new: true })
      .exec();
    if (!set) throw new NotFoundException('Set no encontrado');
    return { promoCards: (set.promoCards ?? []).map((c) => c.toString()) };
  }

  /** Quita una promo asociada del set. */
  async removePromo(setId: string, cardId: string): Promise<{ promoCards: string[] }> {
    const set = await this.sets
      .findByIdAndUpdate(setId, { $pull: { promoCards: new Types.ObjectId(cardId) } }, { new: true })
      .exec();
    if (!set) throw new NotFoundException('Set no encontrado');
    return { promoCards: (set.promoCards ?? []).map((c) => c.toString()) };
  }

  /** Lista de sets (opcionalmente por juego) con estadísticas de completitud. */
  async findAll(gameId?: string, dir?: string): Promise<any[]> {
    const filter = gameId ? { game: new Types.ObjectId(gameId) } : {};
    const sets = await this.sets.find(filter).sort({ releaseDate: dir === 'asc' ? 1 : -1, name: 1 }).exec();
    if (sets.length === 0) return [];

    // Un solo aggregation calcula, por set: nº de cartas registradas y
    // nº de cartas con stock (>0), uniendo el inventario a cada carta.
    const rows = await this.cards.aggregate<{
      _id: Types.ObjectId;
      registered: number;
      collected: number;
    }>([
      {
        $lookup: {
          from: 'inventory_items',
          localField: '_id',
          foreignField: 'cardModel',
          as: 'inv',
        },
      },
      { $addFields: { stock: { $sum: '$inv.quantity' } } },
      {
        $group: {
          _id: '$set',
          registered: { $sum: 1 },
          collected: { $sum: { $cond: [{ $gt: ['$stock', 0] }, 1, 0] } },
        },
      },
    ]);

    const bySet = new Map(rows.map((r) => [r._id.toString(), r]));

    return sets.map((set) => {
      const agg = bySet.get(set.id);
      return {
        ...set.toJSON(),
        stats: this.buildStats(
          set.totalCards,
          agg?.registered ?? 0,
          agg?.collected ?? 0,
        ),
      };
    });
  }

  create(dto: CreateSetDto) {
    const { gameId, ...rest } = dto;
    return this.sets.create({ ...rest, game: new Types.ObjectId(gameId) });
  }

  async update(id: string, dto: UpdateSetDto) {
    const set = await this.sets.findByIdAndUpdate(id, dto, { new: true }).exec();
    if (!set) throw new NotFoundException('Set no encontrado');
    return set;
  }

  async remove(id: string) {
    await this.sets.findByIdAndDelete(id).exec();
    return { deleted: true };
  }

  /** Detalle del set: todas sus cartas con disponibilidad + resumen de completitud. */
  async findOneWithCards(id: string): Promise<any> {
    const set = await this.sets.findById(id).exec();
    if (!set) throw new NotFoundException('Set no encontrado');

    const cards = await this.cards
      .find({ set: new Types.ObjectId(id) })
      .sort({ number: 1 })
      .exec();

    // Stock y precio mínimo (solo unidades con stock) por carta.
    const stockRows = await this.inventory.aggregate<{
      _id: Types.ObjectId;
      totalStock: number;
      minPrice: number;
    }>([
      {
        $match: {
          cardModel: { $in: cards.map((c) => c._id) },
          quantity: { $gt: 0 },
        },
      },
      {
        $group: {
          _id: '$cardModel',
          totalStock: { $sum: '$quantity' },
          minPrice: { $min: '$price' },
        },
      },
    ]);
    const stockByCard = new Map(stockRows.map((r) => [r._id.toString(), r]));

    const cardsView = cards.map((card) => {
      const s = stockByCard.get(card.id);
      return {
        id: card.id,
        name: card.name,
        number: card.number,
        rarity: card.rarity,
        cardType: card.cardType,
        imageUrl: card.imageUrl,
        attributes: card.attributes,
        inStock: !!s,
        totalStock: s?.totalStock ?? 0,
        minPrice: s?.minPrice ?? null,
      };
    });

    const collectedCards = cardsView.filter((c) => c.inStock).length;
    return {
      ...set.toJSON(),
      stats: this.buildStats(set.totalCards, cards.length, collectedCards),
      cards: cardsView,
    };
  }

  private buildStats(
    totalCards: number,
    registeredCards: number,
    collectedCards: number,
  ): CompletionStats {
    const denom = totalCards > 0 ? totalCards : registeredCards;
    const completionPercent = denom
      ? Math.round((collectedCards / denom) * 1000) / 10
      : 0;
    return {
      totalCards,
      registeredCards,
      collectedCards,
      completionPercent,
      missingCards: Math.max(denom - collectedCards, 0),
    };
  }
}
