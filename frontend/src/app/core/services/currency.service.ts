import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export type Currency = 'USD' | 'CLP';
const CUR_KEY = 'tcg_currency';
const RATE_KEY = 'tcg_fx'; // { usdClp, date } cacheado para pintar sin parpadeo

/**
 * Los valores se guardan en USD (fuente: TCGplayer/Cardmarket).
 * La tasa USD→CLP es REAL: dólar observado de mindicador.cl vía el backend
 * (GET /config/rates), cacheada en localStorage; 940 solo como último recurso.
 */
@Injectable({ providedIn: 'root' })
export class CurrencyService {
  private http = inject(HttpClient);
  readonly currency = signal<Currency>(this.restore());
  readonly rate = signal<number>(this.restoreRate());
  readonly rateDate = signal<string>('');
  readonly rateSource = signal<string>('');

  constructor() {
    this.http
      .get<{ usdClp: number; date: string; source: string }>(`${environment.apiUrl}/config/rates`)
      .subscribe({
        next: (r) => {
          if (r?.usdClp > 0) {
            this.rate.set(r.usdClp);
            this.rateDate.set(r.date ?? '');
            this.rateSource.set(r.source ?? '');
            try { localStorage.setItem(RATE_KEY, JSON.stringify({ usdClp: r.usdClp, date: r.date })); } catch { /* privado */ }
          }
        },
        error: () => undefined, // mantiene la tasa cacheada
      });
  }

  toggle() {
    this.setCurrency(this.currency() === 'USD' ? 'CLP' : 'USD');
  }

  setCurrency(c: Currency) {
    this.currency.set(c);
    localStorage.setItem(CUR_KEY, c);
  }

  /** Convierte un monto en USD a la moneda seleccionada. */
  convert(usd: number): number {
    return this.currency() === 'USD' ? usd : usd * this.rate();
  }

  /** Convierte USD a CLP con la tasa real (independiente de la moneda activa). */
  toClp(usd: number): number {
    return Math.round((usd ?? 0) * this.rate());
  }

  /** Formatea un monto (dado en USD) en la moneda seleccionada. */
  format(usd: number): string {
    if (this.currency() === 'USD') {
      return '$' + usd.toFixed(2);
    }
    return '$' + this.toClp(usd).toLocaleString('es-CL') + ' CLP';
  }

  private restore(): Currency {
    return (localStorage.getItem(CUR_KEY) as Currency) ?? 'USD';
  }

  private restoreRate(): number {
    try {
      const cached = JSON.parse(localStorage.getItem(RATE_KEY) ?? 'null');
      if (cached?.usdClp > 0) return cached.usdClp;
    } catch { /* sin cache */ }
    return 940;
  }
}
