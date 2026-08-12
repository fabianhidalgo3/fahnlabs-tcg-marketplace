import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateSetDto {
  @IsString()
  @IsNotEmpty()
  gameId: string;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  series?: string;

  @IsInt()
  @Min(0)
  totalCards: number;

  @IsOptional()
  @IsString()
  releaseDate?: string;

  @IsOptional()
  @IsString()
  symbolUrl?: string;
}

export class UpdateSetDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() series?: string;
  @IsOptional() @IsInt() @Min(0) totalCards?: number;
  @IsOptional() @IsString() releaseDate?: string;
  @IsOptional() @IsString() symbolUrl?: string;
}
