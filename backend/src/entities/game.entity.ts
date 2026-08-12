import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { baseSchemaOptions } from '../common/schema.util';

/**
 * Un juego de cartas coleccionables (TCG): Pokémon, One Piece, Star Wars Unlimited, etc.
 * Jerarquía: Game -> CardSet -> CardModel -> InventoryItem.
 */
@Schema(baseSchemaOptions('games'))
export class Game {
  /** Código corto y único, ej: "pokemon", "onepiece", "swu". */
  @Prop({ required: true, unique: true, trim: true })
  code: string;

  @Prop({ required: true })
  name: string;

  @Prop()
  iconUrl?: string;
}

export type GameDocument = HydratedDocument<Game>;
export const GameSchema = SchemaFactory.createForClass(Game);
