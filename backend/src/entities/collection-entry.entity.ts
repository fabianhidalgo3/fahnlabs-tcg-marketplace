import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../common/schema.util';
import { User } from './user.entity';
import { CardModel } from './card-model.entity';
import { StorageLocation } from './storage-location.entity';

export enum CardLanguage {
  EN = 'EN',
  ES = 'ES',
}

/**
 * Una entrada en la colección PERSONAL de un usuario: cuántas copias posee de
 * una carta concreta, en una variante (Normal / Reverse Holo / Poké Ball…) y un
 * idioma (EN / ES). La clave (user, cardModel, variant, language) es única;
 * `quantity` cuenta las copias (duplicadas = quantity - 1).
 */
@Schema(baseSchemaOptions('collection_entries'))
export class CollectionEntry {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true, index: true })
  user: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: CardModel.name, required: true, index: true })
  cardModel: Types.ObjectId;

  @Prop({ required: true })
  variant: string;

  @Prop({ type: String, enum: CardLanguage, default: CardLanguage.EN })
  language: CardLanguage;

  @Prop({ required: true, min: 0, default: 0 })
  quantity: number;

  /** Álbum / caja donde está guardada esta carta (opcional). */
  @Prop({ type: Types.ObjectId, ref: StorageLocation.name, default: null })
  storage?: Types.ObjectId | null;
}

export type CollectionEntryDocument = HydratedDocument<CollectionEntry>;
export const CollectionEntrySchema =
  SchemaFactory.createForClass(CollectionEntry);
// Una fila por (usuario, carta, variante, idioma).
CollectionEntrySchema.index(
  { user: 1, cardModel: 1, variant: 1, language: 1 },
  { unique: true },
);
