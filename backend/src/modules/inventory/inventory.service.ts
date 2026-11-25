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
import { FxService } from '../../common/fx.service';

@Injectable()
export class InventoryService {
  constructor(
    @InjectModel(InventoryItem.name)
    private readonly items: Model<InventoryItemDocument>,
    @InjectModel(CardModel.name)
    private readonly cards: Model<CardModelDocument>,
    private readonly fx: FxService,
  ) {}

  /** Unidades vendibles de una carta concreta (para la ficha de la carta). */
  findByCard(cardModelId: string) {
    return this.items
      .find({ cardModel: new Types.ObjectId(cardModelId) })
      .populate('seller', 'name')
      .sort({ price: 1 })
      .exec();
  }

  /** Últimos singles publicados con stock (strip "Recién publicados"). */
  recent(limit = 12) {
    return this.items
      .find({ quantity: { $gt: 0 } })
      .populate({ path: 'cardModel', select: 'name number imageUrl set', populate: { path: 'set', select: 'name symbolUrl' } })
      .populate('seller', 'name')
      .sort({ createdAt: -1 })
      .limit(Math.min(24, limit))
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

  // ==== Publicaciones del usuario (marketplace) ====

  /** Mis publicaciones: unidades donde soy el vendedor. */
  mine(userId: string) {
    return this.items
      .find({ seller: new Types.ObjectId(userId) })
      .populate({ path: 'cardModel', select: 'name number imageUrl rarity set', populate: { path: 'set', select: 'name symbolUrl' } })
      .sort({ updatedAt: -1 })
      .exec();
  }

  /** Edita precio/stock de UNA publicación propia. */
  async updateMine(userId: string, id: string, dto: { price?: number; quantity?: number }) {
    const set: Record<string, number> = {};
    if (typeof dto.price === 'number' && dto.price >= 0) set.price = dto.price;
    if (typeof dto.quantity === 'number' && dto.quantity >= 0) set.quantity = Math.floor(dto.quantity);
    if (!Object.keys(set).length) throw new BadRequestException('Nada que actualizar');
    const item = await this.items
      .findOneAndUpdate({ _id: new Types.ObjectId(id), seller: new Types.ObjectId(userId) }, { $set: set }, { new: true })
      .exec();
    if (!item) throw new NotFoundException('Publicación no encontrada');
    return item;
  }

  /** Retira (elimina) una publicación propia. */
  async removeMine(userId: string, id: string) {
    const res = await this.items
      .deleteOne({ _id: new Types.ObjectId(id), seller: new Types.ObjectId(userId) })
      .exec();
    if (!res.deletedCount) throw new NotFoundException('Publicación no encontrada');
    return { deleted: true };
  }

  /** CSV de todo el stock (para importar en otras plataformas, ej. TCGmatch). */
  async exportCsv(): Promise<string> {
    const items = await this.items
      .find({ quantity: { $gt: 0 } })
      .populate({ path: 'cardModel', select: 'name number rarity set', populate: { path: 'set', select: 'name code' } })
      .sort({ createdAt: -1 })
      .exec();
    const esc = (v: any) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rate = (await this.fx.rates()).usdClp;
    const rows = [
      ['sku', 'carta', 'set', 'codigo_set', 'numero', 'rareza', 'idioma', 'condicion', 'foil', 'precio_clp', 'precio_usd', 'stock'].join(','),
      ...items.map((it: any) => [
        esc(it.sku), esc(it.cardModel?.name), esc(it.cardModel?.set?.name), esc(it.cardModel?.set?.code),
        esc(it.cardModel?.number), esc(it.cardModel?.rarity), esc(it.language), esc(it.condition),
        it.isFoil ? 'si' : 'no', Math.round((it.price ?? 0) * rate), it.price ?? 0, it.quantity,
      ].join(',')),
    ];
    return rows.join('\n');
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
