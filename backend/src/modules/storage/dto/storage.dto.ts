import { IsEnum, IsHexColor, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { StorageType } from '../../../entities/storage-location.entity';

export class CreateStorageDto {
  @IsString() @IsNotEmpty() name: string;
  @IsEnum(StorageType) type: StorageType;
  @IsOptional() @IsHexColor() color?: string;
  @IsOptional() @IsString() notes?: string;
}

export class UpdateStorageDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsEnum(StorageType) type?: StorageType;
  @IsOptional() @IsHexColor() color?: string;
  @IsOptional() @IsString() notes?: string;
}
