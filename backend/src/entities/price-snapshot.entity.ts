import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../common/schema.util';
import { CardModel } from './card-model.entity';

/**
 * Foto diaria del precio de una carta (por variante, en USD).
 * Se escribe al correr sync-prices / price-floors y al importar desde la web;
 * alimenta el gráfico "Historial de precio" de la ficha de la carta.
 */
@Schema(baseSchemaOptions('price_snapshots'))
export class PriceSnapshot {
  @Prop({ type: Types.ObjectId, ref: CardModel.name, required: true, index: true })
  card: Types.ObjectId;

  /** Día del snapshot en formato YYYY-MM-DD (uno por carta por día). */
  @Prop({ required: true })
  date: string;

  /** { Normal: 0.53, 'Reverse Holo': 1.6, … } en USD. */
  @Prop({ type: Object, default: {} })
  values: Record<string, number>;
}

export type PriceSnapshotDocument = HydratedDocument<PriceSnapshot>;
export const PriceSnapshotSchema = SchemaFactory.createForClass(PriceSnapshot);
PriceSnapshotSchema.index({ card: 1, date: 1 }, { unique: true });
