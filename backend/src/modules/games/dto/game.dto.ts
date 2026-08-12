import { IsOptional, IsString, IsNotEmpty } from 'class-validator';

export class CreateGameDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  iconUrl?: string;
}

export class UpdateGameDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  iconUrl?: string;
}
