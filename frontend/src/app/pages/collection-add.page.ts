import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CatalogService } from '../core/services/catalog.service';
import { CollectionService } from '../core/services/collection.service';
import { CardLangService } from '../core/services/card-lang.service';
import { I18nService } from '../core/services/i18n.service';
import { CurrencyService } from '../core/services/currency.service';
import { CardLang, CardModel, CardSet, Game } from '../core/models/models';
import { thumbUrl } from '../core/utils/card-image';
import { SetChipComponent } from '../shared/set-chip.component';
import { FavBtnComponent } from '../shared/fav-btn.component';
import { PagerComponent } from '../shared/pager.component';

/**
 * Flujo "agregar carta a mi colección": el ÚNICO lugar donde se listan todas
 * las cartas de la base — como buscador para elegir una y sumarla.
 */
@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, SetChipComponent, FavBtnComponent, PagerComponent],
  template: `
    <a routerLink="/coleccion" class="back muted"><span class="mi">arrow_back</span>{{ i18n.t('nav.collection') }}</a>
    <header class="page-head">
      <div>
        <h1>{{ i18n.isES() ? 'Agregar carta a mi colección' : 'Add card to my collection' }}</h1>
        <p class="muted">{{ i18n.isES() ? 'Busca cualquier carta y súmala eligiendo variante e idioma.' : 'Search any card and add it choosing variant and language.' }}</p>
      </div>
    </header>

    <div class="toolbar">
      <div class="searchbox"><span class="mi">search</span><input class="ui-input" [placeholder]="i18n.t('catalog.search')" [(ngModel)]="q" (ngModelChange)="debouncedSearch()" /></div>
      <select class="ui-select fsel" [(ngModel)]="gameId" (ngModelChange)="onGameChange()" [title]="i18n.isES() ? 'Juego' : 'Game'">
        <option value="">{{ i18n.t('catalog.allGames') }}</option>
        @for (g of games(); track g.id) { <option [value]="g.id">{{ g.name }}</option> }
      </select>
      <select class="ui-select fsel" [(ngModel)]="setId" (ngModelChange)="search()" title="Set">
        <option value="">{{ i18n.t('catalog.allSets') }}</option>
        @for (s of sets(); track s.id) { <option [value]="s.id">{{ s.name }}</option> }
      </select>
      <select class="ui-select fsel" [(ngModel)]="sortBy" (ngModelChange)="search()" [title]="i18n.isES() ? 'Ordenar por' : 'Sort by'">
        <option value="">{{ i18n.isES() ? 'Orden: más recientes' : 'Sort: newest' }}</option>
        <option value="artist">{{ i18n.isES() ? 'Orden: artista (A–Z)' : 'Sort: artist (A–Z)' }}</option>
        <option value="name">{{ i18n.isES() ? 'Orden: nombre' : 'Sort: name' }}</option>
      </select>
      <button class="icon-btn" type="button" (click)="toggleDir()" [title]="dir() === 'desc' ? 'Más recientes primero' : 'Más antiguas primero'">
        <span class="mi">{{ dir() === 'desc' ? 'south' : 'north' }}</span>
      </button>
      <button class="icon-btn del" type="button" (click)="clearFilters()" [title]="i18n.isES() ? 'Limpiar filtros y orden' : 'Clear filters & sort'">
        <span class="mi">delete_sweep</span>
      </button>
      <div class="seg t-right">
        <button type="button" [class.on]="layout() === 'grid'" (click)="layout.set('grid')" title="Grid"><span class="mi">grid_view</span></button>
        <button type="button" [class.on]="layout() === 'list'" (click)="layout.set('list')" title="Tabla"><span class="mi">table_rows</span></button>
      </div>
    </div>

    @if (loading()) {
      <p class="muted">{{ i18n.t('catalog.loading') }}</p>
    } @else if (cards().length === 0) {
      <p class="muted">{{ i18n.t('catalog.empty') }}</p>
    } @else {
      @if (layout() === 'list') {
      <div class="tablewrap card-surface">
        <table class="ltable">
          <thead>
            <tr>
              <th></th><th>#</th>
              <th>{{ i18n.isES() ? 'Carta' : 'Card' }}</th>
              <th>Set</th>
              <th>{{ i18n.isES() ? 'Rareza' : 'Rarity' }}</th>
              <th>{{ i18n.isES() ? 'Variante' : 'Variant' }}</th>
              <th>{{ i18n.isES() ? 'Idioma' : 'Lang' }}</th>
              <th class="c"></th>
            </tr>
          </thead>
          <tbody>
            @for (c of cards(); track c.id) {
              <tr>
                <td>@if (c.imageUrl) { <img class="lthumb" [src]="thumb(c.imageUrl)" [alt]="c.name" loading="lazy" [routerLink]="['/cartas', c.id]" /> }</td>
                <td class="muted mono">{{ c.number }}</td>
                <td><b [routerLink]="['/cartas', c.id]" style="cursor:pointer">{{ c.name }}</b>
                  @if (justAdded()[c.id]; as n) { <span class="okmsg">✓ {{ n }}</span> }
                </td>
                <td><app-set-chip [set]="c.set" /></td>
                <td class="muted">{{ c.rarity }}</td>
                <td>
                  <select class="ui-select vsel" [(ngModel)]="variantSel[c.id]">
                    @for (v of c.variants ?? ['Normal']; track v) { <option [value]="v">{{ v }}</option> }
                  </select>
                </td>
                <td>
                  <select class="ui-select lsel" [(ngModel)]="langSel[c.id]">
                    <option value="EN">EN</option>
                    <option value="ES">ES</option>
                  </select>
                </td>
                <td class="c">
                  <button class="btn btn-primary btn-s" type="button" [disabled]="adding() === c.id" (click)="add(c)"><span class="mi">add</span></button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      } @else {
      <div class="card-grid">
        @for (c of cards(); track c.id) {
          <div class="card card-surface">
            <div class="img" [routerLink]="['/cartas', c.id]">
              <app-fav-btn class="favpos" kind="card" [id]="c.id" />
              @if (c.imageUrl) { <img [src]="thumb(c.imageUrl)" [alt]="c.name" loading="lazy" decoding="async" /> }
              @else { <div class="noimg">{{ c.name }}</div> }
            </div>
            <div class="body">
              <div class="name">{{ c.name }}</div>
              <div class="sub"><app-set-chip [set]="c.set" [extra]="c.number" /></div>
              <div class="addrow">
                <select class="ui-select vsel" [(ngModel)]="variantSel[c.id]">
                  @for (v of c.variants ?? ['Normal']; track v) { <option [value]="v">{{ v }}</option> }
                </select>
                <select class="ui-select lsel" [(ngModel)]="langSel[c.id]">
                  <option value="EN">EN</option>
                  <option value="ES">ES</option>
                </select>
                <button class="btn btn-primary btn-s" type="button" [disabled]="adding() === c.id" (click)="add(c)">
                  <span class="mi">add</span>
                </button>
              </div>
              @if (justAdded()[c.id]; as n) {
                <div class="okmsg">✓ {{ i18n.isES() ? 'en tu colección:' : 'in your collection:' }} {{ n }}</div>
              }
            </div>
          </div>
        }
      </div>
      }

      <app-pager [page]="page()" [pages]="totalPages()" (pageChange)="go($event)" />
    }

    <!-- Las cartas que no están en la base se buscan/importan con el Asistente (chat) -->
    @if (!loading() && q.trim() && cards().length === 0) {
      <p class="muted hint-chat">
        <span class="mi">forum</span>
        {{ i18n.isES() ? '¿No está en la base? Pídesela al Asistente de cartas (botón flotante) y la importa desde la web por ti.' : 'Not in the DB? Ask the card assistant (floating button) to import it from the web.' }}
      </p>
    }
  `,
  styles: [
    `
      .hint-chat { display: inline-flex; align-items: center; gap: 8px; margin-top: 20px; font-size: 13px; }
      .hint-chat .mi { color: var(--primary); font-size: 18px; }
      .tablewrap { margin-top: 4px; overflow-x: auto; }
      .ltable .okmsg { margin-left: 8px; color: var(--success); font-size: 12px; font-weight: 700; }
      .back { display: inline-flex; align-items: center; gap: 4px; margin-bottom: 12px; font-weight: 600; }
      .card { padding: 0; overflow: hidden; }
      .img { position: relative; aspect-ratio: 63/88; background: var(--bg-soft); display: flex; align-items: center; justify-content: center; cursor: pointer; }
      .favpos { position: absolute; top: 8px; right: 8px; z-index: 2; }
      .img img { width: 100%; height: 100%; object-fit: contain; }
      .noimg { padding: 20px; text-align: center; color: var(--muted); font-weight: 600; }
      .body { padding: 12px; }
      .name { font-weight: 700; font-size: 14px; }
      .sub { font-size: 12px; margin: 2px 0 8px; }
      .addrow { display: flex; gap: 8px; align-items: center; }
      .vsel { flex: 1; min-width: 0; }
      .lsel { width: 62px; flex: none; }
      .okmsg { margin-top: 6px; color: var(--success); font-size: 12px; font-weight: 700; }
    `,
  ],
})
export class CollectionAddPage {
  thumb = thumbUrl;
  private catalog = inject(CatalogService);
  private collection = inject(CollectionService);
  cardLang = inject(CardLangService);
  i18n = inject(I18nService);
  cur = inject(CurrencyService);

  games = signal<Game[]>([]);
  sets = signal<CardSet[]>([]);
  cards = signal<CardModel[]>([]);
  page = signal(1);
  totalPages = signal(1);
  loading = signal(true);
  adding = signal<string | null>(null);
  /** cardId → cantidad total tras agregar (feedback "✓ en tu colección: N"). */
  justAdded = signal<Record<string, number>>({});

  layout = signal<'grid' | 'list'>('grid');
  q = ''; gameId = ''; setId = ''; sortBy = '';
  dir = signal<'asc' | 'desc'>('desc');
  toggleDir() { this.dir.set(this.dir() === 'desc' ? 'asc' : 'desc'); this.search(); }
  clearFilters() { this.q = ''; this.gameId = ''; this.setId = ''; this.sortBy = ''; this.dir.set('desc'); this.sets.set([]); this.search(); }
  variantSel: Record<string, string> = {};
  langSel: Record<string, CardLang> = {};
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
    this.catalog
      .cards({ q: this.q, gameId: this.gameId, setId: this.setId, dir: this.dir(), sortBy: this.sortBy || undefined, page: this.page(), limit: 32 })
      .subscribe((res) => {
        for (const c of res.data) {
          if (!this.variantSel[c.id]) this.variantSel[c.id] = c.variants?.[0] ?? 'Normal';
          if (!this.langSel[c.id]) this.langSel[c.id] = this.cardLang.lang();
        }
        this.cards.set(res.data);
        this.totalPages.set(res.totalPages);
        this.loading.set(false);
      });
  }
  add(c: CardModel) {
    const lang: CardLang = this.langSel[c.id] ?? this.cardLang.lang();
    const variant = this.variantSel[c.id] ?? 'Normal';
    this.adding.set(c.id);
    this.collection.adjust(c.id, variant, lang, 1).subscribe({
      next: (r) => {
        this.justAdded.update((m) => ({ ...m, [c.id]: r.quantity }));
        this.adding.set(null);
      },
      error: () => this.adding.set(null),
    });
  }
}
