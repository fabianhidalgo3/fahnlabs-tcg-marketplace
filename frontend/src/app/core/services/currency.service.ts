import { Injectable, signal } from '@angular/core';

export type Currency = 'USD' | 'CLP';
const CUR_KEY = 'tcg_currency';

// Los valores se guardan en USD (fuente: tcgplayer). Tasa aproximada a CLP.
const USD_TO_CLP = 940;

@Injectable({ providedIn: 'root' })
export class CurrencyService {
  readonly currency = signal<Currency>(this.restore());
  readonly rate = USD_TO_CLP;

  toggle() {
    this.setCurrency(this.currency() === 'USD' ? 'CLP' : 'USD');
  }

  setCurrency(c: Currency) {
    this.currency.set(c);
    localStorage.setItem(CUR_KEY, c);
  }

  /** Convierte un monto en USD a la moneda seleccionada. */
  convert(usd: number): number {
    return this.currency() === 'USD' ? usd : usd * USD_TO_CLP;
  }

  /** Formatea un monto (dado en USD) en la moneda seleccionada. */
  format(usd: number): string {
    if (this.currency() === 'USD') {
      return '$' + usd.toFixed(2);
    }
    const clp = Math.round(usd * USD_TO_CLP);
    return '$' + clp.toLocaleString('es-CL') + ' CLP';
  }

  private restore(): Currency {
    return (localStorage.getItem(CUR_KEY) as Currency) ?? 'USD';
  }
}
