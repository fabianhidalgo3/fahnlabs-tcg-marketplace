import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../common/schema.util';
import { User } from './user.entity';
import { CardSet } from './card-set.entity';

export enum StorageType {
  ALBUM = 'album',
  BINDER = 'binder',
  BOX = 'box',
  DECKBOX = 'deckbox',
}

/**
 * Un lugar físico donde el usuario guarda sus cartas: álbum, carpeta (binder),
 * caja, etc. Cada entrada de la colección puede asignarse a un storage.
 */
@Schema(baseSchemaOptions('storage_locations'))
export class StorageLocation {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true, index: true })
  user: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop({ type: String, enum: StorageType, default: StorageType.BINDER })
  type: StorageType;

  /** Color para identificarlo visualmente (hex). */
  @Prop({ default: '#6c5ce7' })
  color: string;

  @Prop()
  notes?: string;

  /** Set opcional al que está dedicado este álbum (para ver su progreso). */
  @Prop({ type: Types.ObjectId, ref: CardSet.name, default: null })
  set?: Types.ObjectId | null;
}

export type StorageLocationDocument = HydratedDocument<StorageLocation>;
export const StorageLocationSchema =
  SchemaFactory.createForClass(StorageLocation);
