import { Component, ElementRef, HostListener, inject, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CatalogService } from '../core/services/catalog.service';
import { CollectionService } from '../core/services/collection.service';
import { AuthService } from '../core/services/auth.service';
import { CardLangService } from '../core/services/card-lang.service';
import { I18nService } from '../core/services/i18n.service';
import { CurrencyService } from '../core/services/currency.service';
import { CardModel } from '../core/models/models';
import { thumbUrl } from '../core/utils/card-image';

/**
 * Búsqueda global del header: encuentra cualquier carta desde cualquier
 * pantalla ("pikachu 173", "066/98"…), navega a su ficha o súmala a tu
 * colección con un click. Atajo: tecla "/" enfoca el buscador.
 */
@Component({
  selector: 'app-global-search',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="gs">
      <div class="searchbox">
        <span class="mi">search</span>
        <input #inp class="ui-input" [placeholder]="i18n.isES() ? 'Buscar carta: nombre o número…  ( / )' : 'Search card: name or number…  ( / )'"
          [(ngModel)]="q" (ngModelChange)="debounced()" (focus)="onType()" (keydown.escape)="close()" />
      </div>
      @if (open() && q.trim()) {
        <div class="drop card-surface">
          @if (searching()) {
            <div class="row muted"><span class="mi spin">progress_activity</span>{{ i18n.isES() ? 'buscando…' : 'searching…' }}</div>
          } @else if (results().length === 0) {
            <div class="row muted">{{ i18n.isES() ? 'Sin resultados en la base.' : 'No results.' }}</div>
          } @else {
            @for (c of results(); track c.id) {
              <div class="row hit" (click)="goTo(c)">
                @if (c.imageUrl) { <img [src]="thumb(c.imageUrl)" [alt]="c.name" loading="lazy" /> }
                <div class="ri">
                  <b>{{ c.name }}</b>
                  <span class="muted">{{ c.set?.name }} · {{ c.number }}</span>
                </div>
                <span class="price">{{ cur.format(mainValue(c)) }}</span>
                @if (auth.isLoggedIn()) {
                  <button class="icon-btn sm" type="button" [disabled]="adding()" (click)="quickAdd(c, $event)"
                    [title]="i18n.isES() ? 'Sumar a mi colección' : 'Add to my collection'">
                    <span class="mi">{{ added() === c.id ? 'check' : 'add' }}</span>
                  </button>
                }
              </div>
            }
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .gs { position: relative; width: 340px; max-width: 44vw; }
      .gs .ui-input { height: 34px; font-size: 13px; }
      .drop {
        position: absolute; top: 40px; left: 0; right: 0; z-index: 80;
        padding: 6px; max-height: 420px; overflow-y: auto; box-shadow: var(--shadow);
      }
      .row { display: flex; align-items: center; gap: 10px; padding: 7px 8px; border-radius: 8px; font-size: 13px; }
      .row.hit { cursor: pointer; }
      .row.hit:hover { background: var(--card-2); }
      .row img { width: 30px; height: 42px; object-fit: contain; border-radius: 3px; flex: none; }
      .ri { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
      .ri b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
      .ri .muted { font-size: 11px; }
      .price { font-weight: 700; font-size: 12px; color: var(--accent); flex: none; }
      .spin { animation: gsspin 1s linear infinite; font-size: 16px; }
      @keyframes gsspin { to { transform: rotate(360deg); } }
      @media (max-width: 700px) { .gs { width: 200px; } }
    `,
  ],
})
export class GlobalSearchComponent {
  thumb = thumbUrl;
  private catalog = inject(CatalogService);
  private collection = inject(CollectionService);
  private cardLang = inject(CardLangService);
  private router = inject(Router);
  auth = inject(AuthService);
  i18n = inject(I18nService);
  cur = inject(CurrencyService);

  q = '';
  open = signal(false);
  searching = signal(false);
  results = signal<CardModel[]>([]);
  adding = signal(false);
  added = signal('');
  private timer: any;
  private inp = viewChild<ElementRef<HTMLInputElement>>('inp');

  /** "/" enfoca el buscador desde cualquier pantalla. */
  @HostListener('document:keydown./', ['$event'])
  focusShortcut(e: Event) {
    const t = e.target as HTMLElement;
    if (t?.tagName === 'INPUT' || t?.tagName === 'TEXTAREA' || t?.tagName === 'SELECT' || t?.isContentEditable) return;
    e.preventDefault();
    this.inp()?.nativeElement.focus();
  }
  @HostListener('document:click', ['$event'])
  outside(e: MouseEvent) {
    if (!(e.target as HTMLElement)?.closest('app-global-search')) this.close();
  }

  onType() { if (this.q.trim()) this.open.set(true); }
  debounced() {
    this.onType();
    clearTimeout(this.timer);
    if (!this.q.trim()) { this.results.set([]); return; }
    this.searching.set(true);
    this.timer = setTimeout(() => this.search(), 300);
  }
  private search() {
    this.catalog.cards({ q: this.q.trim(), limit: 6 }).subscribe({
      next: (r) => { this.results.set(r.data); this.searching.set(false); },
      error: () => this.searching.set(false),
    });
  }

  mainValue(c: CardModel): number {
    const v = (c.variants ?? ['Normal'])[0];
    return Number(c.variantValues?.[v]) || 0;
  }
  goTo(c: CardModel) {
    this.close();
    this.q = '';
    this.router.navigate(['/cartas', c.id]);
  }
  /** +1 directo: variante por defecto + idioma preferido de mis cartas. */
  quickAdd(c: CardModel, e: Event) {
    e.stopPropagation();
    this.adding.set(true);
    const variant = c.variants?.[0] ?? 'Normal';
    this.collection.adjust(c.id, variant, this.cardLang.lang(), 1).subscribe({
      next: () => {
        this.added.set(c.id);
        this.adding.set(false);
        setTimeout(() => this.added.set(''), 1500);
      },
      error: () => this.adding.set(false),
    });
  }
  close() { this.open.set(false); }
}
