import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { CardCondition } from '../../../entities/inventory-item.entity';

export class CreateInventoryDto {
  @IsString() @IsNotEmpty() cardModelId: string;

  @IsOptional() @IsString() sku?: string;

  @IsEnum(CardCondition) condition: CardCondition;

  @IsOptional() @IsString() language?: string;

  @IsOptional() @IsBoolean() isFoil?: boolean;

  @IsNumber() @Min(0) price: number;

  @IsInt() @Min(0) quantity: number;
}

export class UpdateInventoryDto {
  @IsOptional() @IsEnum(CardCondition) condition?: CardCondition;
  @IsOptional() @IsString() language?: string;
  @IsOptional() @IsBoolean() isFoil?: boolean;
  @IsOptional() @IsNumber() @Min(0) price?: number;
  @IsOptional() @IsInt() @Min(0) quantity?: number;
}

export class AdjustStockDto {
  /** Delta a aplicar sobre el stock (puede ser negativo). */
  @Type(() => Number) @IsInt() delta: number;
}
