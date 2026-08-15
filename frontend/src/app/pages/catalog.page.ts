import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TuiTextfield, TuiInput } from '@taiga-ui/core';
import { TuiBadge, TuiSwitch } from '@taiga-ui/kit';
import { CatalogService } from '../core/services/catalog.service';
import { I18nService } from '../core/services/i18n.service';
import { CurrencyService } from '../core/services/currency.service';
import { CardModel, CardSet, Game } from '../core/models/models';

@Component({
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink, TuiTextfield, TuiInput, TuiBadge, TuiSwitch,
  ],
  template: `
    <h1>{{ i18n.t('catalog.title') }}</h1>
    <p class="muted">{{ total() }} {{ i18n.t('catalog.subtitle') }}</p>

    <div class="filters">
      <tui-textfield class="search" iconStart="@tui.search" [tuiTextfieldCleaner]="true">
        <input tuiInput [placeholder]="i18n.t('catalog.search')" [(ngModel)]="q" (ngModelChange)="debouncedSearch()" />
      </tui-textfield>

      <div class="chips">
        <select class="ui-select field" [(ngModel)]="gameId" (ngModelChange)="onGameChange()">
          <option value="">{{ i18n.t('catalog.allGames') }}</option>
          @for (g of games(); track g.id) { <option [value]="g.id">{{ g.name }}</option> }
        </select>
        <select class="ui-select field" [(ngModel)]="setId" (ngModelChange)="search()">
          <option value="">{{ i18n.t('catalog.allSets') }}</option>
          @for (s of sets(); track s.id) { <option [value]="s.id">{{ s.name }}</option> }
        </select>
        <tui-textfield class="field">
          <label tuiLabel>{{ i18n.t('catalog.type') }}</label>
          <input tuiInput [(ngModel)]="type" (ngModelChange)="debouncedSearch()" />
        </tui-textfield>
        <tui-textfield class="field">
          <label tuiLabel>{{ i18n.t('catalog.rarity') }}</label>
          <input tuiInput [(ngModel)]="rarity" (ngModelChange)="debouncedSearch()" />
        </tui-textfield>
        <label class="switch-row">
          <input tuiSwitch type="checkbox" [(ngModel)]="inStock" (ngModelChange)="search()" />
          {{ i18n.t('catalog.inStock') }}
        </label>
        <label class="switch-row">
          <input tuiSwitch type="checkbox" [(ngModel)]="showAll" (ngModelChange)="search()" />
          {{ i18n.isES() ? 'Ver todo el catálogo' : 'Show full catalog' }}
        </label>
      </div>
    </div>

    @if (loading()) {
      <p class="muted">{{ i18n.t('catalog.loading') }}</p>
    } @else if (cards().length === 0) {
      <p class="muted">{{ i18n.t('catalog.empty') }}</p>
    } @else {
      <div class="grid">
        @for (c of cards(); track c.id) {
          <div class="card card-surface" [routerLink]="['/cartas', c.id]">
            <div class="img">
              @if (c.imageUrl) { <img [src]="c.imageUrl" [alt]="c.name" loading="lazy" /> }
              @else { <div class="noimg">{{ c.name }}</div> }
              @if (c.cardType) { <span class="type-badge">{{ c.cardType }}</span> }
            </div>
            <div class="body">
              <div class="name">{{ c.name }}</div>
              <div class="sub muted">{{ c.game?.name }} · {{ c.number }}</div>
              @if (typesOf(c).length) {
                <div class="badge-set tags">
                  @for (t of typesOf(c); track t) { <span tuiBadge appearance="neutral">{{ t }}</span> }
                </div>
              }
              <div class="foot">
                @if (c.minPrice != null) {
                  <span class="price">{{ cur.format(c.minPrice) }}</span>
                  <span class="stock ok">{{ c.totalStock }} {{ i18n.t('catalog.inStockLabel') }}</span>
                } @else {
                  <span class="stock no">{{ i18n.t('catalog.noStock') }}</span>
                }
              </div>
            </div>
          </div>
        }
      </div>

      @if (totalPages() > 1) {
        <div class="pager">
          <button class="icon-btn" [disabled]="page() === 1" (click)="go(page() - 1)"><span class="mi">chevron_left</span></button>
          <span class="muted">{{ i18n.t('catalog.page') }} {{ page() }} {{ i18n.t('catalog.of') }} {{ totalPages() }}</span>
          <button class="icon-btn" [disabled]="page() === totalPages()" (click)="go(page() + 1)"><span class="mi">chevron_right</span></button>
        </div>
      }
    }
  `,
  styles: [
    `
      h1 { margin-bottom: 2px; }
      .filters { margin: 18px 0 24px; display: flex; flex-direction: column; gap: 14px; }
      .filters .search { width: 100%; max-width: 520px; }
      .chips { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
      .chips .field { width: 180px; }
      .grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 18px; }
      @media (max-width: 1300px) { .grid { grid-template-columns: repeat(5, minmax(0, 1fr)); } }
      @media (max-width: 1080px) { .grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
      @media (max-width: 820px) { .grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
      @media (max-width: 560px) { .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
      .card { padding: 0; overflow: hidden; cursor: pointer; transition: transform 0.12s; }
      .card:hover { transform: translateY(-4px); }
      .img { position: relative; aspect-ratio: 63/88; background: var(--bg-soft); display: flex; align-items: center; justify-content: center; }
      .img img { width: 100%; height: 100%; object-fit: contain; }
      .noimg { padding: 20px; text-align: center; color: var(--muted); font-weight: 600; }
      .type-badge { position: absolute; top: 8px; left: 8px; background: rgba(0,0,0,0.65); color: #fff; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; }
      .body { padding: 12px; }
      .name { font-weight: 700; font-size: 15px; }
      .sub { font-size: 12px; margin-top: 2px; }
      .tags { margin-top: 8px; }
      .foot { display: flex; align-items: center; justify-content: space-between; margin-top: 10px; }
      .price { font-weight: 800; font-size: 15px; color: var(--accent); }
      .stock { font-size: 12px; font-weight: 600; }
      .stock.ok { color: var(--success); }
      .stock.no { color: var(--muted); }
      .pager { display: flex; align-items: center; justify-content: center; gap: 14px; margin-top: 28px; }
    `,
  ],
})
export class CatalogPage {
  private catalog = inject(CatalogService);
  i18n = inject(I18nService);
  cur = inject(CurrencyService);

  games = signal<Game[]>([]);
  sets = signal<CardSet[]>([]);
  cards = signal<CardModel[]>([]);
  total = signal(0);
  page = signal(1);
  totalPages = signal(1);
  loading = signal(true);

  q = ''; gameId = ''; setId = ''; type = ''; rarity = ''; inStock = false; showAll = false;
  private timer: any;

  constructor() {
    this.catalog.games().subscribe((g) => this.games.set(g));
    this.search();
  }
  onGameChange() {
    this.setId = ''; this.sets.set([]);
    if (this.gameId) this.catalog.sets(this.gameId).subscribe((s) => this.sets.set(s));
    this.search();
  }
  debouncedSearch() { clearTimeout(this.timer); this.timer = setTimeout(() => this.search(), 300); }
  go(p: number) { this.page.set(p); this.search(false); }
  search(resetPage = true) {
    if (resetPage) this.page.set(1);
    this.loading.set(true);
    this.catalog.cards({ q: this.q, gameId: this.gameId, setId: this.setId, type: this.type, rarity: this.rarity, inStock: this.inStock, forSale: !this.showAll, page: this.page() })
      .subscribe((res) => { this.cards.set(res.data); this.total.set(res.total); this.totalPages.set(res.totalPages); this.loading.set(false); });
  }
  typesOf(c: CardModel): string[] {
    const a = c.attributes || {};
    return a['types'] || a['color'] || a['aspects'] || [];
  }
}
