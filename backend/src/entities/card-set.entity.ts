import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../common/schema.util';
import { Game } from './game.entity';

/**
 * Un set / expansión dentro de un juego (ej: "151", "OP-01 Romance Dawn").
 * `totalCards` es el tamaño oficial del set y es la base para calcular la completitud.
 */
@Schema(baseSchemaOptions('card_sets'))
export class CardSet {
  @Prop({ type: Types.ObjectId, ref: Game.name, required: true, index: true })
  game: Types.ObjectId;

  /** Código del set, ej: "SV3.5", "OP-01". */
  @Prop({ required: true })
  code: string;

  @Prop({ required: true })
  name: string;

  /** Serie / bloque, ej: "Scarlet & Violet". */
  @Prop()
  series?: string;

  /** Nº oficial de cartas del set. Denominador de la completitud. */
  @Prop({ default: 0 })
  totalCards: number;

  @Prop()
  releaseDate?: string;

  @Prop()
  symbolUrl?: string;

  /**
   * Cartas promocionales asociadas a este set (curadas por el admin), ej. las
   * promos SVP con sello "151". Viven en su propio set (svp…) pero se
   * coleccionan como apartado de este.
   */
  @Prop({ type: [Types.ObjectId], ref: 'CardModel', default: [] })
  promoCards: Types.ObjectId[];
}

export type CardSetDocument = HydratedDocument<CardSet>;
export const CardSetSchema = SchemaFactory.createForClass(CardSet);
// Un código de set es único dentro de cada juego.
CardSetSchema.index({ game: 1, code: 1 }, { unique: true });
