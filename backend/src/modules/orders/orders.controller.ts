import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto, UpdateOrderStatusDto } from './dto/order.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/roles.guard';
import { Roles } from '../../common/roles.decorator';
import { UserRole } from '../../entities/user.entity';
import { CurrentUser, AuthUser } from '../../common/current-user.decorator';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  /** Checkout del carrito. */
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateOrderDto) {
    return this.orders.create(user.id, dto);
  }

  /** Órdenes del usuario autenticado. */
  @Get('mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.orders.findMine(user.id);
  }

  /** Todas las órdenes (solo admin). */
  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  all() {
    return this.orders.findAll();
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    // admin ve cualquiera; el resto solo las propias
    return this.orders.findOne(
      id,
      user.role === UserRole.ADMIN ? undefined : user.id,
    );
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  updateStatus(@Param('id') id: string, @Body() dto: UpdateOrderStatusDto) {
    return this.orders.updateStatus(id, dto.status);
  }
}
