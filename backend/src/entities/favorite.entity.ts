import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { User } from './user.entity';
import { CardModel } from './card-model.entity';
import { CardSet } from './card-set.entity';

export enum FavoriteKind {
  CARD = 'card',
  SET = 'set',
}

/** Favorito del usuario: una carta o un set marcados con ♥. */
@Schema({ collection: 'favorites', timestamps: true })
export class Favorite {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true, index: true })
  user: Types.ObjectId;

  @Prop({ type: String, enum: FavoriteKind, required: true })
  kind: FavoriteKind;

  @Prop({ type: Types.ObjectId, ref: CardModel.name, default: null })
  card?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: CardSet.name, default: null })
  set?: Types.ObjectId | null;
}

export type FavoriteDocument = HydratedDocument<Favorite>;
export const FavoriteSchema = SchemaFactory.createForClass(Favorite);

// Un mismo usuario no puede marcar dos veces la misma carta/set.
FavoriteSchema.index({ user: 1, kind: 1, card: 1, set: 1 }, { unique: true });
