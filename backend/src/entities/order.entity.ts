import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../common/schema.util';
import { User } from './user.entity';
import { OrderItem, OrderItemSchema } from './order-item.entity';

export enum OrderStatus {
  PENDING = 'pending',
  PAID = 'paid',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
}

@Schema(baseSchemaOptions('orders'))
export class Order {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true, index: true })
  user: Types.ObjectId;

  @Prop({ type: String, enum: OrderStatus, default: OrderStatus.PENDING })
  status: OrderStatus;

  @Prop({ required: true, default: 0 })
  total: number;

  @Prop()
  shippingName?: string;

  @Prop()
  shippingAddress?: string;

  @Prop({ type: [OrderItemSchema], default: [] })
  items: OrderItem[];
}

export type OrderDocument = HydratedDocument<Order>;
export const OrderSchema = SchemaFactory.createForClass(Order);
