import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateCardDto {
  @IsString() @IsNotEmpty() gameId: string;
  @IsString() @IsNotEmpty() setId: string;
  @IsString() @IsNotEmpty() name: string;
  @IsString() @IsNotEmpty() number: string;
  @IsOptional() @IsString() rarity?: string;
  @IsOptional() @IsString() cardType?: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsObject() attributes?: Record<string, any>;
  @IsOptional() @IsString() externalId?: string;
}

export class UpdateCardDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() number?: string;
  @IsOptional() @IsString() rarity?: string;
  @IsOptional() @IsString() cardType?: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsObject() attributes?: Record<string, any>;
}

/** Filtros de búsqueda del catálogo. */
export class QueryCardDto {
  @IsOptional() @IsString() gameId?: string;
  @IsOptional() @IsString() setId?: string;
  @IsOptional() @IsString() q?: string; // texto en el nombre
  @IsOptional() @IsString() rarity?: string;
  @IsOptional() @IsString() cardType?: string;
  /** Tipo específico del juego (ej. tipo del Pokémon: "Fire"). Filtra attributes.types. */
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsString() inStock?: string; // "true" para solo con stock
  @IsOptional() @IsString() forSale?: string; // "true" para solo cartas a la venta (con inventario)
  @IsOptional() @IsString() seller?: string; // id de vendedor: solo SUS publicaciones (ej. "mis repetidas")
  @IsOptional() @IsString() sortBy?: string; // date (default) | artist | name
  /** Dirección del orden por fecha del set: 'asc' | 'desc' (default desc = más nuevo primero). */
  @IsOptional() @IsString() dir?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number = 24;
}
