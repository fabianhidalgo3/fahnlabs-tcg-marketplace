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
import { InventoryService } from './inventory.service';
import {
  AdjustStockDto,
  CreateInventoryDto,
  UpdateInventoryDto,
} from './dto/inventory.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
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
