import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  InventoryItem,
  InventoryItemDocument,
} from '../../entities/inventory-item.entity';
import { CardModel, CardModelDocument } from '../../entities/card-model.entity';
import {
  AdjustStockDto,
  CreateInventoryDto,
  UpdateInventoryDto,
} from './dto/inventory.dto';

@Injectable()
export class InventoryService {
  constructor(
    @InjectModel(InventoryItem.name)
    private readonly items: Model<InventoryItemDocument>,
    @InjectModel(CardModel.name)
    private readonly cards: Model<CardModelDocument>,
  ) {}

  /** Unidades vendibles de una carta concreta (para la ficha de la carta). */
  findByCard(cardModelId: string) {
    return this.items
      .find({ cardModel: new Types.ObjectId(cardModelId) })
      .sort({ price: 1 })
      .exec();
  }

  findAll() {
    return this.items
      .find()
      .populate('cardModel')
      .sort({ updatedAt: -1 })
      .limit(200)
      .exec();
  }

  async create(dto: CreateInventoryDto) {
    const card = await this.cards
      .findById(dto.cardModelId)
      .populate('game')
      .exec();
    if (!card) throw new NotFoundException('Carta no encontrada');

    const sku = dto.sku ?? this.buildSku(card, dto);
    return this.items.create({
      cardModel: card._id,
      sku,
      condition: dto.condition,
      language: dto.language ?? 'EN',
      isFoil: dto.isFoil ?? false,
      price: dto.price,
      quantity: dto.quantity,
    });
  }

  async update(id: string, dto: UpdateInventoryDto) {
    const item = await this.items.findByIdAndUpdate(id, dto, { new: true }).exec();
    if (!item) throw new NotFoundException('Ítem de inventario no encontrado');
    return item;
  }

  async adjustStock(id: string, dto: AdjustStockDto) {
    // $inc atómico con guardia de no-negativo mediante filtro condicional.
    const filter =
      dto.delta < 0
        ? { _id: new Types.ObjectId(id), quantity: { $gte: -dto.delta } }
        : { _id: new Types.ObjectId(id) };
    const item = await this.items
      .findOneAndUpdate(filter, { $inc: { quantity: dto.delta } }, { new: true })
      .exec();
    if (!item) {
      // O no existe, o no había stock suficiente para el decremento.
      const exists = await this.items.exists({ _id: id });
      throw exists
        ? new BadRequestException('Stock insuficiente')
        : new NotFoundException('Ítem de inventario no encontrado');
    }
    return item;
  }

  async remove(id: string) {
    await this.items.findByIdAndDelete(id).exec();
    return { deleted: true };
  }

  private buildSku(
    card: CardModelDocument & { game: any },
    dto: CreateInventoryDto,
  ) {
    const parts = [
      card.game?.code ?? 'x',
      card.number,
      dto.condition,
      dto.language ?? 'EN',
      dto.isFoil ? 'FOIL' : 'REG',
    ];
    return parts.join('-').toUpperCase().replace(/\s+/g, '');
  }
}
