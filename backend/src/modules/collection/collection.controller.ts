import { Body, Controller, Get, Param, Post, Put, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { CollectionService } from './collection.service';
import { MissingPdfService } from './missing-pdf.service';
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
  constructor(
    private readonly collection: CollectionService,
    private readonly missingPdf: MissingPdfService,
  ) {}

  /** Sets con el progreso de MI colección. */
  @Get('sets')
  mySets(@CurrentUser() user: AuthUser) {
    return this.collection.getMySets(user.id);
  }

  /** "Toda mi colección" plana: cartas que poseo con filtros de catálogo. */
  @Get('cards')
  myCards(@CurrentUser() user: AuthUser, @Query() query: Record<string, string>) {
    return this.collection.getMyCards(user.id, query);
  }

  /** Resumen para el Inicio: totales de la colección + sets en progreso. */
  @Get('summary')
  summary(@CurrentUser() user: AuthUser) {
    return this.collection.getSummary(user.id);
  }

  /** Facetas de MI colección: solo rarezas/variantes que realmente poseo. */
  @Get('cards/facets')
  myCardFacets(@CurrentUser() user: AuthUser) {
    return this.collection.getMyCardFacets(user.id);
  }

  /** Exportar Excel: cartas de mi colección con los filtros de la vista. */
  @Get('export/cards')
  async exportCards(
    @CurrentUser() user: AuthUser,
    @Query() query: Record<string, string>,
    @Res() res: Response,
  ) {
    const buffer = await this.collection.exportMyCardsXlsx(user.id, query);
    this.sendXlsx(res, buffer, 'mi-coleccion-cartas');
  }

  /** Exportar Excel: mis sets con progreso y valor. */
  @Get('export/sets')
  async exportSets(@CurrentUser() user: AuthUser, @Res() res: Response) {
    const buffer = await this.collection.exportMySetsXlsx(user.id);
    this.sendXlsx(res, buffer, 'mi-coleccion-sets');
  }

  /** PDF de FALTANTES a tamaño real de carta (63×88mm) para imprimir. */
  @Get('export/sets/:id/missing-pdf')
  async missingPdfExport(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { buffer, setName } = await this.missingPdf.build(user.id, id);
    const slug = setName.toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
    res
      .setHeader('Content-Type', 'application/pdf')
      .setHeader('Content-Disposition', `attachment; filename="faltantes-${slug || 'set'}.pdf"`)
      .send(buffer);
  }

  /** Exportar Excel: checklist de un set (cartas + promos, EN/ES).
   *  `mode` = all | missing | owned (mismo filtro que la vista). */
  @Get('export/sets/:id')
  async exportChecklist(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('mode') mode: string,
    @Res() res: Response,
  ) {
    const m = mode === 'missing' || mode === 'owned' ? mode : 'all';
    const { buffer, setName } = await this.collection.exportChecklistXlsx(user.id, id, m);
    const slug = setName.toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
    const suffix = m === 'missing' ? '-faltantes' : m === 'owned' ? '-tengo' : '';
    this.sendXlsx(res, buffer, `checklist-${slug || 'set'}${suffix}`);
  }

  private sendXlsx(res: Response, buffer: Buffer, baseName: string) {
    res
      .setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .setHeader('Content-Disposition', `attachment; filename="${baseName}.xlsx"`)
      .send(buffer);
  }

  /** Publica mis repetidas (quantity-1) a la venta a precio de mercado. */
  @Post('sell-duplicates')
  sellDuplicates(@CurrentUser() user: AuthUser) {
    return this.collection.sellDuplicates(user.id);
  }

  /** Mis copias de UNA carta: cantidades por variante+idioma y su álbum. */
  @Get('cards/:cardId/mine')
  myCopies(@CurrentUser() user: AuthUser, @Param('cardId') cardId: string) {
    return this.collection.getMyCopies(user.id, cardId);
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
