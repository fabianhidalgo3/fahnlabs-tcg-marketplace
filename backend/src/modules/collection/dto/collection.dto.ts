import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { CardLanguage } from '../../../entities/collection-entry.entity';

export class AdjustCollectionDto {
  @IsString() @IsNotEmpty() cardModelId: string;
  @IsString() @IsNotEmpty() variant: string;
  @IsEnum(CardLanguage) language: CardLanguage;
  /** Delta a aplicar (puede ser negativo). El total nunca baja de 0. */
  @IsInt() delta: number;
}

export class AssignStorageDto {
  @IsString() @IsNotEmpty() cardModelId: string;
  @IsString() @IsNotEmpty() variant: string;
  @IsEnum(CardLanguage) language: CardLanguage;
  /** Id del álbum/caja, o null para desasignar. */
  @IsOptional() @IsString() storageId?: string | null;
}

export class SetCollectionDto {
  @IsString() @IsNotEmpty() cardModelId: string;
  @IsString() @IsNotEmpty() variant: string;
  @IsEnum(CardLanguage) language: CardLanguage;
  @IsInt() quantity: number;
}

export class ChecklistQueryDto {
  @IsOptional() @IsEnum(CardLanguage) language?: CardLanguage;
}
