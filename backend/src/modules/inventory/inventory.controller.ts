import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { InventoryService } from './inventory.service';
import {
  AdjustStockDto,
  CreateInventoryDto,
  UpdateInventoryDto,
} from './dto/inventory.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../../common/current-user.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { Roles } from '../../common/roles.decorator';
import { UserRole } from '../../entities/user.entity';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  /** Público: unidades disponibles de una carta. ?cardModelId= requerido. */
  @Get()
  find(@Query('cardModelId') cardModelId?: string) {
    return cardModelId
      ? this.inventory.findByCard(cardModelId)
      : this.inventory.findAll();
  }

  /** Público: últimos singles publicados con stock. */
  @Get('recent')
  recent(@Query('limit') limit?: string) {
    return this.inventory.recent(Number(limit) || 12);
  }

  /** Mis publicaciones en el marketplace (vendedor = yo). */
  @Get('mine')
  @UseGuards(JwtAuthGuard)
  mine(@CurrentUser() user: AuthUser) {
    return this.inventory.mine(user.id);
  }

  /** Edita precio/stock de una publicación propia. */
  @Patch('mine/:id')
  @UseGuards(JwtAuthGuard)
  updateMine(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: { price?: number; quantity?: number },
  ) {
    return this.inventory.updateMine(user.id, id, dto);
  }

  /** Retira una publicación propia. */
  @Delete('mine/:id')
  @UseGuards(JwtAuthGuard)
  removeMine(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.inventory.removeMine(user.id, id);
  }

  /** Admin: CSV del stock (para importar en otras plataformas, ej. TCGmatch). */
  @Get('export.csv')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async exportCsv(@Res() res: Response) {
    const csv = await this.inventory.exportCsv();
    res
      .setHeader('Content-Type', 'text/csv; charset=utf-8')
      .setHeader('Content-Disposition', 'attachment; filename="stock-singletcg.csv"')
      .send('﻿' + csv);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateInventoryDto) {
    return this.inventory.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateInventoryDto) {
    return this.inventory.update(id, dto);
  }

  @Patch(':id/stock')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  adjust(@Param('id') id: string, @Body() dto: AdjustStockDto) {
    return this.inventory.adjustStock(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.inventory.remove(id);
  }
}
