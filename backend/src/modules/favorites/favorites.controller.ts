import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { IsEnum, IsMongoId } from 'class-validator';
import { FavoritesService } from './favorites.service';
import { FavoriteKind } from '../../entities/favorite.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../../common/current-user.decorator';

class ToggleFavoriteDto {
  @IsEnum(FavoriteKind) kind: FavoriteKind;
  @IsMongoId() id: string;
}

@Controller('favorites')
@UseGuards(JwtAuthGuard)
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  /** Ids de mis favoritos (cartas y sets) — para pintar los ♥. */
  @Get('ids')
  ids(@CurrentUser() user: AuthUser) {
    return this.favorites.ids(user.id);
  }

  /** Favoritos poblados para la vista "Mis favoritos". */
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.favorites.list(user.id);
  }

  /** Marca/desmarca una carta o set. Devuelve { favorite: boolean }. */
  @Post('toggle')
  toggle(@CurrentUser() user: AuthUser, @Body() dto: ToggleFavoriteDto) {
    return this.favorites.toggle(user.id, dto.kind, dto.id);
  }
}
