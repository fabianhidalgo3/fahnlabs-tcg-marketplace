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
import { CardsService } from './cards.service';
import { ScanService } from './scan.service';
import { CreateCardDto, QueryCardDto, UpdateCardDto } from './dto/card.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/roles.guard';
import { Roles } from '../../common/roles.decorator';
import { UserRole } from '../../entities/user.entity';

@Controller('cards')
export class CardsController {
  constructor(
    private readonly cards: CardsService,
    private readonly scan: ScanService,
  ) {}

  @Get()
  search(@Query() query: QueryCardDto) {
    return this.cards.search(query);
  }

  /** Rarezas y tipos disponibles (para los selectores del catálogo). */
  @Get('facets')
  facets(@Query('gameId') gameId?: string, @Query('setId') setId?: string) {
    return this.cards.facets(gameId, setId);
  }

  /** Busca cartas en pokemontcg.io (las que aún no están en la base). */
  @Get('web-search')
  @UseGuards(JwtAuthGuard)
  webSearch(@Query('q') q: string) {
    return this.cards.webSearch(q ?? '');
  }

  /** Escanea una foto de carta (base64) y la identifica contra la base/web. */
  @Post('scan')
  @UseGuards(JwtAuthGuard)
  scanCard(@Body() body: { image: string; mediaType?: string }) {
    return this.scan.scan(body.image, body.mediaType);
  }

  /** Importa una carta desde la web a la base local. */
  @Post('import-web')
  @UseGuards(JwtAuthGuard)
  importWeb(@Body() body: { apiId: string }) {
    return this.cards.importFromWeb(body.apiId);
  }

  /** Admin: lanza el refresco de precios de mercado (job en segundo plano). */
  @Post('update-prices')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  updatePrices() {
    return this.cards.startPriceUpdate();
  }

  /** Admin: estado/progreso del refresco de precios. */
  @Get('update-prices/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  updatePricesStatus() {
    return this.cards.getPriceUpdateStatus();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.cards.findOne(id);
  }

  /** Historial de precio de la carta (snapshots diarios por variante). */
  @Get(':id/price-history')
  priceHistory(@Param('id') id: string) {
    return this.cards.priceHistory(id);
  }

  /** Últimas ventas de la carta en el marketplace (desde las órdenes). */
  @Get(':id/sales')
  sales(@Param('id') id: string) {
    return this.cards.recentSales(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateCardDto) {
    return this.cards.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateCardDto) {
    return this.cards.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.cards.remove(id);
  }
}
