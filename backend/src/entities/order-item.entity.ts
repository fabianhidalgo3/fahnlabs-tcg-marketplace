import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

/**
 * Línea de una orden. Se embebe dentro del documento Order (patrón idiomático
 * de MongoDB: los ítems no se consultan por separado del pedido).
 * Guarda un snapshot del nombre y precio al momento de la compra.
 */
@Schema({ _id: false })
export class OrderItem {
  @Prop({ type: Types.ObjectId, ref: 'InventoryItem', required: true })
  inventoryItem: Types.ObjectId;

  @Prop({ required: true })
  cardName: string;

  @Prop({ required: true })
  unitPrice: number;

  @Prop({ required: true, min: 1 })
  quantity: number;
}

export const OrderItemSchema = SchemaFactory.createForClass(OrderItem);
