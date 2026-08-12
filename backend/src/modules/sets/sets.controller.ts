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

  /** Lista de sets con completitud. ?gameId= para filtrar por juego. */
  @Get()
  findAll(@Query('gameId') gameId?: string) {
    return this.sets.findAll(gameId);
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
