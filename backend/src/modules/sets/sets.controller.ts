import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SetsService } from './sets.service';
import { CreateSetDto, UpdateSetDto } from './dto/set.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/roles.guard';
import { Roles } from '../../common/roles.decorator';
import { UserRole } from '../../entities/user.entity';

@Controller('sets')
export class SetsController {
  constructor(private readonly sets: SetsService) {}

  /** Lista de sets con completitud. ?gameId= filtra; ?dir=asc invierte el orden por fecha. */
  @Get()
  findAll(@Query('gameId') gameId?: string, @Query('dir') dir?: string) {
    return this.sets.findAll(gameId, dir);
  }

  /** Set completo: todas sus cartas + resumen de completitud. */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.sets.findOneWithCards(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateSetDto) {
    return this.sets.create(dto);
  }

  /** Asocia una carta promocional a este set (curado por el admin). */
  @Post(':id/promos')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  addPromo(@Param('id') id: string, @Body() body: { cardId: string }) {
    return this.sets.addPromo(id, body.cardId);
  }

  /** Quita una promo asociada. */
  @Delete(':id/promos/:cardId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  removePromo(@Param('id') id: string, @Param('cardId') cardId: string) {
    return this.sets.removePromo(id, cardId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateSetDto) {
    return this.sets.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.sets.remove(id);
  }
}
