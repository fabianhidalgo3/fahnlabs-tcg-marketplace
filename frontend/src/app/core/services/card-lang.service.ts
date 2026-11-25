import { Injectable, signal } from '@angular/core';
import { CardLang } from '../models/models';

const KEY = 'tcg_card_lang';

/**
 * Idioma en que el usuario COLECCIONA sus cartas físicas (EN/ES).
 * Independiente del idioma de la interfaz: puedes usar la app en español
 * y coleccionar cartas en inglés (el caso típico en LATAM).
 * Lo usan todos los flujos que agregan cartas a la colección.
 */
@Injectable({ providedIn: 'root' })
export class CardLangService {
  readonly lang = signal<CardLang>(
    (localStorage.getItem(KEY) as CardLang) === 'ES' ? 'ES' : 'EN',
  );

  set(l: CardLang) {
    this.lang.set(l);
    localStorage.setItem(KEY, l);
  }
}
