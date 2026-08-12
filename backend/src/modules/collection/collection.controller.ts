import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { CollectionService } from './collection.service';
import {
  AdjustCollectionDto,
  AssignStorageDto,
  SetCollectionDto,
} from './dto/collection.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../../common/current-user.decorator';

@Controller('collection')
@UseGuards(JwtAuthGuard)
export class CollectionController {
  constructor(private readonly collection: CollectionService) {}

  /** Sets con el progreso de MI colección. */
  @Get('sets')
  mySets(@CurrentUser() user: AuthUser) {
    return this.collection.getMySets(user.id);
  }

  /** Checklist de un set: cartas, variantes, valor y lo que poseo por idioma. */
  @Get('sets/:id')
  checklist(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.collection.getSetChecklist(user.id, id);
  }

  /** +/- una copia de (carta, variante, idioma). */
  @Post('adjust')
  adjust(@CurrentUser() user: AuthUser, @Body() dto: AdjustCollectionDto) {
    return this.collection.adjust(user.id, dto);
  }

  /** Fijar cantidad exacta. */
  @Put('set')
  setQty(@CurrentUser() user: AuthUser, @Body() dto: SetCollectionDto) {
    return this.collection.setQuantity(user.id, dto);
  }

  /** Asignar álbum/caja a una carta poseída (o desasignar con storageId null). */
  @Post('assign')
  assign(@CurrentUser() user: AuthUser, @Body() dto: AssignStorageDto) {
    return this.collection.assignStorage(user.id, dto);
  }
}
