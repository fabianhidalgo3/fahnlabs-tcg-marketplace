import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { CardModel, CardModelDocument } from '../../entities/card-model.entity';
import {
  InventoryItem,
  InventoryItemDocument,
} from '../../entities/inventory-item.entity';
import { CreateCardDto, QueryCardDto, UpdateCardDto } from './dto/card.dto';

@Injectable()
export class CardsService {
  constructor(
    @InjectModel(CardModel.name) private readonly cards: Model<CardModelDocument>,
    @InjectModel(InventoryItem.name)
    private readonly inventory: Model<InventoryItemDocument>,
  ) {}

  async search(query: QueryCardDto): Promise<any> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 24;

    const filter: FilterQuery<CardModelDocument> = {};
    if (query.gameId) filter.game = new Types.ObjectId(query.gameId);
    if (query.setId) filter.set = new Types.ObjectId(query.setId);
    if (query.rarity) filter.rarity = query.rarity;
    if (query.cardType) filter.cardType = query.cardType;
    if (query.q) filter.name = { $regex: query.q, $options: 'i' };
    // Tipo específico del juego dentro de attributes.types (ej. tipo del Pokémon).
    // Mongo hace match si el array attributes.types contiene el valor.
    if (query.type) filter['attributes.types'] = query.type;

    // "con stock" = inventario con quantity > 0.
    if (query.inStock === 'true') {
      const withStock = await this.inventory.distinct('cardModel', {
        quantity: { $gt: 0 },
      });
      filter._id = { $in: withStock };
    } else if (query.forSale === 'true') {
      // "a la venta" = la carta tiene alguna publicación de inventario (con o sin stock).
      const listed = await this.inventory.distinct('cardModel', {});
      filter._id = { $in: listed };
    }

    // Dentro de un set, ordenar por número de coleccionista (1,2,3…);
    // en el catálogo general, por nombre.
    const sort: Record<string, 1 | -1> = query.setId ? { number: 1 } : { name: 1 };

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
      };
    });

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
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
    }>([
      { $match: { cardModel: { $in: cardIds }, quantity: { $gt: 0 } } },
      {
        $group: {
          _id: '$cardModel',
          count: { $sum: 1 },
          totalStock: { $sum: '$quantity' },
          minPrice: { $min: '$price' },
        },
      },
    ]);
    return new Map(rows.map((r) => [r._id.toString(), r]));
  }
}
