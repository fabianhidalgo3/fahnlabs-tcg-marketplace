import { Controller, Get, Global, Module } from '@nestjs/common';
import { FxService } from './fx.service';

/** Expone el tipo de cambio real al frontend. */
@Controller('config')
export class FxController {
  constructor(private readonly fx: FxService) {}

  /** { usdClp, date, source } — dólar observado de mindicador.cl. */
  @Get('rates')
  rates() {
    return this.fx.rates();
  }
}

@Global()
@Module({
  controllers: [FxController],
  providers: [FxService],
  exports: [FxService],
})
export class FxModule {}
