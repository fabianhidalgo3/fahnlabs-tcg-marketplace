import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../common/schema.util';
import { Game } from './game.entity';
import { CardSet } from './card-set.entity';

/**
 * Carta "de catálogo" (el modelo impreso, no una copia física concreta).
 *
 * Diseño genérico para cualquier TCG:
 *  - Campos comunes a todos los juegos (name, number, rarity, cardType, imageUrl).
 *  - `attributes`: documento libre (Mongo es schemaless) con lo específico de cada juego:
 *      Pokémon:  { hp: 120, types: ["Fire"], stage: "Basic", weakness: "Water" }
 *      One Piece:{ color: ["Red"], cost: 4, power: 5000, counter: 1000, life: 5 }
 *      SWU:      { aspects: ["Vigilance"], cost: 3, power: 4, hp: 5, arena: "Ground" }
 */
@Schema(baseSchemaOptions('card_models'))
export class CardModel {
  @Prop({ type: Types.ObjectId, ref: Game.name, required: true, index: true })
  game: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: CardSet.name, required: true, index: true })
  set: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  /** Número de coleccionista dentro del set, ej: "025/165". */
  @Prop({ required: true })
  number: string;

  @Prop()
  rarity?: string;

  /**
   * Supertipo / categoría, genérico entre juegos.
   * Pokémon: "Pokémon" | "Trainer" | "Energy".
   * One Piece: "Leader" | "Character" | "Event" | "Stage".
   * SWU: "Unit" | "Event" | "Base" | "Leader".
   */
  @Prop()
  cardType?: string;

  @Prop()
  imageUrl?: string;

  /** releaseDate del set, denormalizado para ordenar "más reciente primero". */
  @Prop({ index: true })
  setReleaseDate?: string;

  @Prop()
  description?: string;

  /** Atributos específicos del juego (tipos del Pokémon, coste, poder, etc.). */
  @Prop({ type: Object, default: {} })
  attributes: Record<string, any>;

  /**
   * Variantes existentes de esta carta (para el checklist de colección).
   * Pokémon 151: ['Normal', 'Reverse Holo', 'Poké Ball', 'Master Ball'] o ['Holo'].
   */
  @Prop({ type: [String], default: ['Normal'] })
  variants: string[];

  /** Valor de mercado por variante (USD). Usado para el valor de la colección. */
  @Prop({ type: Object, default: {} })
  variantValues: Record<string, number>;

  /** ID en una API externa (para sincronización futura). */
  @Prop()
  externalId?: string;
}

export type CardModelDocument = HydratedDocument<CardModel>;
export const CardModelSchema = SchemaFactory.createForClass(CardModel);
