import { Injectable, Logger } from '@nestjs/common';

/**
 * Tipo de cambio REAL USD→CLP desde mindicador.cl (dólar observado, dato
 * oficial diario del Banco Central). Cache en memoria 12 h; si la API no
 * responde se usa el último valor conocido (o 940 como último recurso).
 */
@Injectable()
export class FxService {
  private readonly log = new Logger(FxService.name);
  private usdClp = 940; // último recurso si nunca se pudo consultar
  private date = '';
  private fetchedAt = 0;
  private static readonly TTL_MS = 12 * 60 * 60 * 1000;

  async rates(): Promise<{ usdClp: number; date: string; source: string }> {
    await this.refreshIfStale();
    return {
      usdClp: this.usdClp,
      date: this.date,
      source: 'mindicador.cl (dólar observado)',
    };
  }

  async usdToClp(usd: number): Promise<number> {
    await this.refreshIfStale();
    return Math.round((usd ?? 0) * this.usdClp);
  }

  private async refreshIfStale() {
    if (Date.now() - this.fetchedAt < FxService.TTL_MS) return;
    try {
      const res = await fetch('https://mindicador.cl/api/dolar', {
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body: any = await res.json();
      const latest = body?.serie?.[0];
      if (typeof latest?.valor === 'number' && latest.valor > 0) {
        this.usdClp = latest.valor;
        this.date = String(latest.fecha ?? '').slice(0, 10);
        this.fetchedAt = Date.now();
        this.log.log(`Dólar observado: $${this.usdClp} CLP (${this.date})`);
      }
    } catch (e: any) {
      // Mantiene el último valor conocido; reintenta en la próxima consulta.
      this.fetchedAt = Date.now() - FxService.TTL_MS + 10 * 60 * 1000;
      this.log.warn(`mindicador.cl no disponible (${e?.message}); usando $${this.usdClp}`);
    }
  }
}
