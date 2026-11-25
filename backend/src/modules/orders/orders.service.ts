import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order, OrderDocument, OrderStatus } from '../../entities/order.entity';
import {
  InventoryItem,
  InventoryItemDocument,
} from '../../entities/inventory-item.entity';
import {
  CollectionEntry,
  CollectionEntryDocument,
} from '../../entities/collection-entry.entity';
import { CreateOrderDto } from './dto/order.dto';

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name) private readonly orders: Model<OrderDocument>,
    @InjectModel(InventoryItem.name)
    private readonly inventory: Model<InventoryItemDocument>,
    @InjectModel(CollectionEntry.name)
    private readonly entries: Model<CollectionEntryDocument>,
  ) {}

  /** SKU de marketplace: MKT-<carta>-<vendedor>-<VARIANTE>-<IDIOMA>. */
  private static readonly SKU_VARIANT: Record<string, string> = {
    NORMAL: 'Normal',
    REVERSEHOLO: 'Reverse Holo',
    HOLO: 'Holo',
  };

  /** Si la unidad vendida es una publicación de coleccionista (MKT), descuenta
   *  las copias vendidas de SU colección (sin bajar de 0). */
  private async decrementSellerCollection(inv: any, qty: number): Promise<void> {
    try {
      if (!inv?.seller || !String(inv.sku ?? '').startsWith('MKT-')) return;
      const token = String(inv.sku).split('-')[3] ?? '';
      const variant = OrdersService.SKU_VARIANT[token];
      if (!variant) return;
      const cardModel = inv.cardModel?._id ?? inv.cardModel;
      await this.entries.updateOne(
        { user: inv.seller, cardModel, variant, language: inv.language },
        [{ $set: { quantity: { $max: [{ $subtract: ['$quantity', qty] }, 0] } } }],
      );
    } catch {
      // el descuento de colección no debe abortar la venta
    }
  }

  /**
   * Checkout. Mongo standalone no soporta transacciones multi-documento, así que
   * descontamos stock con un update atómico condicional por ítem
   * (findOneAndUpdate con quantity >= qty). Si alguna línea falla, compensamos
   * devolviendo el stock ya descontado y abortamos.
   */
  async create(userId: string, dto: CreateOrderDto) {
    const applied: Array<{ id: Types.ObjectId; qty: number }> = [];
    const items: Order['items'] = [];
    let total = 0;

    try {
      for (const line of dto.items) {
        const inv = await this.inventory
          .findOneAndUpdate(
            {
              _id: new Types.ObjectId(line.inventoryItemId),
              quantity: { $gte: line.quantity },
            },
            { $inc: { quantity: -line.quantity } },
            { new: true },
          )
          .populate<{ cardModel: { name: string } }>('cardModel')
          .exec();

        if (!inv) {
          const exists = await this.inventory.exists({
            _id: line.inventoryItemId,
          });
          throw new BadRequestException(
            exists
              ? `Stock insuficiente para el ítem ${line.inventoryItemId}`
              : `Ítem de inventario ${line.inventoryItemId} no encontrado`,
          );
        }

        applied.push({ id: inv._id, qty: line.quantity });

        // Marketplace de repetidas: lo vendido sale de la colección del vendedor
        // (la colección es la fuente de verdad del stock publicado).
        await this.decrementSellerCollection(inv, line.quantity);

        const lineTotal = inv.price * line.quantity;
        total += lineTotal;
        items.push({
          inventoryItem: inv._id,
          cardName: inv.cardModel?.name ?? inv.sku,
          unitPrice: inv.price,
          quantity: line.quantity,
        });
      }

      return await this.orders.create({
        user: new Types.ObjectId(userId),
        status: OrderStatus.PENDING,
        shippingName: dto.shippingName,
        shippingAddress: dto.shippingAddress,
        items,
        total,
      });
    } catch (err) {
      // Compensación: devolver el stock descontado en las líneas ya aplicadas.
      await Promise.all(
        applied.map((a) =>
          this.inventory
            .updateOne({ _id: a.id }, { $inc: { quantity: a.qty } })
            .exec(),
        ),
      );
      throw err;
    }
  }

  findMine(userId: string) {
    return this.orders
      .find({ user: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  findAll() {
    return this.orders
      .find()
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .limit(200)
      .exec();
  }

  async findOne(id: string, userId?: string) {
    const order = await this.orders.findById(id).exec();
    if (!order) throw new NotFoundException('Orden no encontrada');
    if (userId && order.user.toString() !== userId) {
      throw new NotFoundException('Orden no encontrada');
    }
    return order;
  }

  async updateStatus(id: string, status: OrderStatus) {
    const order = await this.orders
      .findByIdAndUpdate(id, { status }, { new: true })
      .exec();
    if (!order) throw new NotFoundException('Orden no encontrada');
    return order;
  }
}
