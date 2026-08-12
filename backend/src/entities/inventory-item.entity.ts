import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../common/schema.util';
import { CardModel } from './card-model.entity';

export enum CardCondition {
  MINT = 'M',
  NEAR_MINT = 'NM',
  LIGHTLY_PLAYED = 'LP',
  MODERATELY_PLAYED = 'MP',
  HEAVILY_PLAYED = 'HP',
  DAMAGED = 'DMG',
}

/**
 * Unidad vendible / de inventario: una copia física concreta de una carta,
 * con su condición, idioma, si es foil, precio y stock disponible.
 */
@Schema(baseSchemaOptions('inventory_items'))
export class InventoryItem {
  @Prop({ type: Types.ObjectId, ref: CardModel.name, required: true, index: true })
  cardModel: Types.ObjectId;

  @Prop({ required: true, unique: true })
  sku: string;

  @Prop({ type: String, enum: CardCondition, default: CardCondition.NEAR_MINT })
  condition: CardCondition;

  @Prop({ default: 'EN' })
  language: string;

  @Prop({ default: false })
  isFoil: boolean;

  @Prop({ required: true, min: 0 })
  price: number;

  @Prop({ required: true, min: 0, default: 0 })
  quantity: number;
}

export type InventoryItemDocument = HydratedDocument<InventoryItem>;
export const InventoryItemSchema = SchemaFactory.createForClass(InventoryItem);
