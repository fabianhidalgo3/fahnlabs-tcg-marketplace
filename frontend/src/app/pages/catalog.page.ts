import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CatalogService } from '../core/services/catalog.service';
import { CollectionService } from '../core/services/collection.service';
import { AuthService } from '../core/services/auth.service';
import { I18nService } from '../core/services/i18n.service';
import { CurrencyService } from '../core/services/currency.service';
import { CardModel, CardSet, Game, OwnedCard, InventoryItem } from '../core/models/models';
import { thumbUrl } from '../core/utils/card-image';
import { SetChipComponent } from '../shared/set-chip.component';
import { FavBtnComponent } from '../shared/fav-btn.component';
import { PagerComponent } from '../shared/pager.component';

@Component({
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink, SetChipComponent, FavBtnComponent, PagerComponent,
  ],
  template: `
    <header class="page-head">
      <div>
        <h1>{{ mine() ? (i18n.isES() ? 'Mi colección' : 'My collection') : i18n.t('catalog.title') }}</h1>
        <p class="muted">
          {{ total() }}
          {{ mine() ? (i18n.isES() ? 'cartas en tu colección' : 'cards in your collection') : i18n.t('catalog.subtitle') }}
          @if (!mine() && mineTotal() !== null) {
            <b class="minecount">· {{ mineTotal() }} {{ i18n.isES() ? 'tuyas' : 'yours' }}</b>
          }
        </p>
      </div>
    </header>

    <!-- Recién publicados: últimos singles con stock -->
    @if (!mine() && recent().length) {
      <div class="recent">
        <h3><span class="mi">new_releases</span> {{ i18n.isES() ? 'Recién publicados' : 'Just listed' }}</h3>
        <div class="rstrip">
          @for (r of recent(); track r.id) {
            <a class="ritem card-surface" [routerLink]="['/cartas', cardOf(r)?.id]">
              @if (cardOf(r)?.imageUrl) { <img [src]="thumb(cardOf(r)?.imageUrl)" [alt]="cardOf(r)?.name" loading="lazy" /> }
              <div class="rname">{{ cardOf(r)?.name }}</div>
              <div class="rprice">{{ cur.format(r.price) }}</div>
              <div class="rseller muted">{{ r.seller?.name ?? 'SingleTCG' }}</div>
            </a>
          }
        </div>
      </div>
    }

    <div class="toolbar">
      <div class="searchbox">
        <span class="mi">search</span>
        <input class="ui-input" [placeholder]="i18n.t('catalog.search')" [(ngModel)]="q" (ngModelChange)="debouncedSearch()" />
      </div>
      <select class="ui-select fsel" [(ngModel)]="gameId" (ngModelChange)="onGameChange()" [title]="i18n.isES() ? 'Juego' : 'Game'">
        <option value="">{{ i18n.t('catalog.allGames') }}</option>
        @for (g of games(); track g.id) { <option [value]="g.id">{{ g.name }}</option> }
      </select>
      <select class="ui-select fsel" [(ngModel)]="setId" (ngModelChange)="onSetChange()" title="Set">
        <option value="">{{ i18n.t('catalog.allSets') }}</option>
        @for (s of sets(); track s.id) { <option [value]="s.id">{{ s.name }}</option> }
      </select>
      <select class="ui-select fsel" [(ngModel)]="type" (ngModelChange)="search()" [title]="i18n.t('catalog.type')">
        <option value="">{{ i18n.isES() ? 'Tipo: todos' : 'Type: all' }}</option>
        @for (t of typeOptions(); track t) { <option [value]="t">{{ t }}</option> }
      </select>
      <select class="ui-select fsel" [(ngModel)]="rarity" (ngModelChange)="search()" [title]="i18n.t('catalog.rarity')">
        <option value="">{{ i18n.isES() ? 'Rareza: todas' : 'Rarity: all' }}</option>
        @for (r of rarityOptions(); track r) { <option [value]="r">{{ r }}</option> }
      </select>
      <select class="ui-select fsel" [(ngModel)]="sortBy" (ngModelChange)="search()" [title]="i18n.isES() ? 'Ordenar por' : 'Sort by'">
        <option value="">{{ i18n.isES() ? 'Orden: más recientes' : 'Sort: newest' }}</option>
        <option value="artist">{{ i18n.isES() ? 'Orden: artista (A–Z)' : 'Sort: artist (A–Z)' }}</option>
        <option value="name">{{ i18n.isES() ? 'Orden: nombre' : 'Sort: name' }}</option>
      </select>
      <button class="icon-btn" type="button" (click)="toggleDir()"
        [title]="dir() === 'desc' ? (i18n.isES() ? 'Más recientes primero' : 'Newest first') : (i18n.isES() ? 'Más antiguas primero' : 'Oldest first')">
        <span class="mi">{{ dir() === 'desc' ? 'south' : 'north' }}</span>
      </button>
      <button class="icon-btn del" type="button" (click)="clearFilters()" [title]="i18n.isES() ? 'Limpiar filtros y orden' : 'Clear filters & sort'">
        <span class="mi">delete_sweep</span>
      </button>
      <div class="seg">
        <button type="button" [class.on]="layout() === 'grid'" (click)="layout.set('grid')" title="Grid"><span class="mi">grid_view</span></button>
        <button type="button" [class.on]="layout() === 'list'" (click)="layout.set('list')" title="Tabla"><span class="mi">table_rows</span></button>
      </div>
      <span class="t-right">
        @if (auth.isLoggedIn()) {
          <label class="switch-row" [title]="i18n.isES() ? 'Solo las cartas que TÚ tienes publicadas (tus repetidas)' : 'Only cards YOU have listed (your duplicates)'">
            <input class="ui-switch" type="checkbox" [(ngModel)]="onlyMine" (ngModelChange)="search()" />
            {{ i18n.isES() ? 'Mis repetidas' : 'My duplicates' }}
          </label>
        }
        @if (auth.isLoggedIn()) {
          <label class="switch-row">
            <input class="ui-switch" type="checkbox" [ngModel]="mine()" (ngModelChange)="mine.set($event); search()" />
            {{ i18n.isES() ? 'Toda mi colección' : 'All my collection' }}
          </label>
        }
      </span>
    </div>

    @if (loading()) {
      <p class="muted">{{ i18n.t('catalog.loading') }}</p>
    } @else if (mine()) {
      <!-- MI COLECCIÓN plana: lo que poseo, con cantidad y valor -->
      @if (owned().length === 0) {
        <p class="muted">{{ i18n.isES() ? 'No tienes cartas con esos filtros.' : 'No cards match those filters.' }}</p>
      } @else if (layout() === 'list') {
        <div class="tablewrap card-surface">
          <table class="ltable">
            <thead>
              <tr><th></th><th>#</th><th>{{ i18n.isES() ? 'Carta' : 'Card' }}</th><th>Set</th><th class="c">{{ i18n.isES() ? 'Cant.' : 'Qty' }}</th><th class="r">{{ i18n.isES() ? 'Valor' : 'Value' }}</th><th>{{ i18n.isES() ? 'Idiomas' : 'Langs' }}</th></tr>
            </thead>
            <tbody>
              @for (c of owned(); track c.id + c.variant) {
                <tr [routerLink]="['/cartas', c.id]">
                  <td>@if (c.imageUrl) { <img class="lthumb" [src]="thumb(c.imageUrl)" [alt]="c.name" loading="lazy" /> }</td>
                  <td class="muted mono">{{ c.number }}</td>
                  <td><b>{{ c.name }}</b> <span class="vtag" [class.rev]="c.variant !== 'Normal'">{{ c.variant }}</span></td>
                  <td><app-set-chip [set]="c.set" /></td>
                  <td class="c"><b>×{{ c.quantity }}</b></td>
                  <td class="r"><b class="price">{{ cur.format(c.value) }}</b></td>
                  <td class="muted">{{ c.languages.join(' · ') }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <div class="card-grid">
          @for (c of owned(); track c.id + c.variant) {
            <div class="card card-surface" [routerLink]="['/cartas', c.id]">
              <div class="img" [class.reverse]="c.variant === 'Reverse Holo'">
                @if (c.imageUrl) { <img [src]="thumb(c.imageUrl)" [alt]="c.name" loading="lazy" decoding="async" /> }
                @else { <div class="noimg">{{ c.name }}</div> }
                <span class="qtybadge">×{{ c.quantity }}</span>
                <app-fav-btn class="favpos-l" kind="card" [id]="c.id" />
              </div>
              <div class="body">
                <div class="name">{{ c.name }}</div>
                <div class="sub">
                  <app-set-chip [set]="c.set" [link]="c.set ? ['/coleccion', c.set.id] : null" [extra]="c.number" />
                </div>
                <div class="badge-set tags">
                  <span class="badge" [class.rev]="c.variant !== 'Normal'">{{ c.variant }}</span>
                </div>
                <div class="foot">
                  <span class="price">{{ cur.format(c.value) }}</span>
                  <span class="stock ok">{{ c.languages.join(' · ') }}</span>
                </div>
              </div>
            </div>
          }
        </div>
      }
    } @else if (cards().length === 0) {
      <p class="muted">{{ i18n.t('catalog.empty') }}</p>
    } @else if (layout() === 'list') {
      <!-- TIENDA en tabla -->
      <div class="tablewrap card-surface">
        <table class="ltable">
          <thead>
            <tr><th></th><th>#</th><th>{{ i18n.isES() ? 'Carta' : 'Card' }}</th><th>Set</th><th>{{ i18n.isES() ? 'Rareza' : 'Rarity' }}</th><th class="r">{{ i18n.isES() ? 'Desde' : 'From' }}</th><th class="c">Stock</th><th class="c">{{ i18n.isES() ? 'Vendedor' : 'Seller' }}</th></tr>
          </thead>
          <tbody>
            @for (c of cards(); track c.id) {
              <tr [routerLink]="['/cartas', c.id]">
                <td>@if (c.imageUrl) { <img class="lthumb" [src]="thumb(c.imageUrl)" [alt]="c.name" loading="lazy" /> }</td>
                <td class="muted mono">{{ c.number }}</td>
                <td><b>{{ c.name }}</b></td>
                <td><app-set-chip [set]="c.set" /></td>
                <td class="muted">{{ c.rarity }}</td>
                <td class="r">@if (c.minPrice != null) { <b class="price">{{ cur.format(c.minPrice) }}</b> } @else { <span class="muted">—</span> }</td>
                <td class="c">{{ c.totalStock ?? 0 }}</td>
                <td class="c">
                  @if (isMineForSale(c)) { <span class="minetag">{{ i18n.isES() ? 'Tuya' : 'Yours' }}</span> }
                  @else { <span class="muted">{{ (c.sellerIds?.length ?? 0) > 0 ? ((i18n.isES() ? 'otro' : 'other') + ((c.sellerIds?.length ?? 0) > 1 ? 's' : '')) : '—' }}</span> }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    } @else {
      <!-- TIENDA: solo cartas a la venta -->
      <div class="card-grid">
        @for (c of cards(); track c.id) {
          <div class="card card-surface" [routerLink]="['/cartas', c.id]">
            <div class="img">
              @if (c.imageUrl) { <img [src]="thumb(c.imageUrl)" [alt]="c.name" loading="lazy" decoding="async" /> }
              @else { <div class="noimg">{{ c.name }}</div> }
              @if (c.cardType) { <span class="type-badge">{{ c.cardType }}</span> }
              @if (isMineForSale(c)) { <span class="minebadge">{{ i18n.isES() ? 'Tuya' : 'Yours' }}</span> }
              <app-fav-btn class="favpos" kind="card" [id]="c.id" />
            </div>
            <div class="body">
              <div class="name">{{ c.name }}</div>
              <div class="sub">
                <app-set-chip [set]="c.set" [link]="c.set ? ['/sets', c.set.id] : null" [extra]="c.number" />
              </div>
              @if (typesOf(c).length) {
                <div class="badge-set tags">
                  @for (t of typesOf(c); track t) { <span class="badge">{{ t }}</span> }
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
    }

    @if (!loading()) {
      <app-pager [page]="page()" [pages]="totalPages()" (pageChange)="go($event)" />
    }
  `,
  styles: [
    `
      .tablewrap { overflow-x: auto; }
      .ltable tbody tr { cursor: pointer; }
      .card { padding: 0; overflow: hidden; cursor: pointer; transition: transform 0.12s; }
      .card:hover { transform: translateY(-4px); }
      .img { position: relative; aspect-ratio: 63/88; background: var(--bg-soft); display: flex; align-items: center; justify-content: center; }
      .img img { width: 100%; height: 100%; object-fit: contain; }
      .noimg { padding: 20px; text-align: center; color: var(--muted); font-weight: 600; }
      .minebadge { position: absolute; bottom: 6px; left: 6px; background: var(--accent); color: #04110b; font-size: 10px; font-weight: 800; padding: 1px 8px; border-radius: 5px; }
      .minetag { font-size: 11px; font-weight: 800; color: var(--accent); }
      .minecount { color: var(--accent); }
      .type-badge { position: absolute; top: 8px; left: 8px; background: rgba(0,0,0,0.65); color: #fff; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; }
      .favpos { position: absolute; top: 8px; right: 8px; z-index: 2; }
      .favpos-l { position: absolute; top: 8px; left: 8px; z-index: 2; }
      .body { padding: 12px; }
      .name { font-weight: 700; font-size: 15px; }
      .sub { font-size: 12px; margin-top: 2px; }
      .tags { margin-top: 8px; }
      .foot { display: flex; align-items: center; justify-content: space-between; margin-top: 10px; }
      .price { font-weight: 800; font-size: 15px; color: var(--accent); }
      .stock { font-size: 12px; font-weight: 600; }
      .stock.ok { color: var(--success); }
      .stock.no { color: var(--muted); }
      /* Recién publicados */
      .recent { margin: 18px 0 4px; }
      .recent h3 { display: flex; align-items: center; gap: 6px; font-size: 15px; margin-bottom: 10px; }
      .recent h3 .mi { color: var(--primary); font-size: 18px; }
      .rstrip { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 8px; }
      .ritem { flex: 0 0 120px; padding: 8px; text-align: center; cursor: pointer; transition: transform 0.12s; }
      .ritem:hover { transform: translateY(-3px); }
      .ritem img { width: 100%; aspect-ratio: 63/88; object-fit: contain; border-radius: 6px; background: var(--bg-soft); }
      .rname { font-size: 12px; font-weight: 700; margin-top: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .rprice { font-size: 12px; font-weight: 800; color: var(--accent); }
      .rseller { font-size: 10px; }
    `,
  ],
})
export class CatalogPage {
  thumb = thumbUrl;
  private catalog = inject(CatalogService);
  private collection = inject(CollectionService);
  auth = inject(AuthService);
  i18n = inject(I18nService);
  cur = inject(CurrencyService);

  games = signal<Game[]>([]);
  sets = signal<CardSet[]>([]);
  cards = signal<CardModel[]>([]);
  owned = signal<OwnedCard[]>([]);
  rarityOptions = signal<string[]>([]);
  typeOptions = signal<string[]>([]);
  total = signal(0);
  page = signal(1);
  totalPages = signal(1);
  loading = signal(true);
  /** true = "toda mi colección" (lo que poseo); false = tienda (a la venta). */
  mine = signal(false);

  layout = signal<'grid' | 'list'>('grid');
  q = ''; gameId = ''; setId = ''; type = ''; rarity = ''; sortBy = '';
  /** Regla fija: el catálogo SOLO muestra repetidas publicadas con stock. */
  readonly inStock = true;
  /** Solo mis publicaciones (mis repetidas a la venta). */
  onlyMine = false;
  /** Total de cartas a la venta que son mías (para el desglose). */
  mineTotal = signal<number | null>(null);

  isMineForSale(c: CardModel): boolean {
    const uid = this.auth.user()?.id;
    return !!uid && !!c.sellerIds?.includes(uid);
  }
  /** Orden por fecha del set: desc = más nuevo primero (default). */
  dir = signal<'asc' | 'desc'>('desc');
  private timer: any;

  toggleDir() { this.dir.set(this.dir() === 'desc' ? 'asc' : 'desc'); this.search(); }
  clearFilters() {
    this.q = ''; this.gameId = ''; this.setId = ''; this.type = ''; this.rarity = ''; this.sortBy = ''; this.onlyMine = false;
    this.dir.set('desc'); this.sets.set([]);
    this.loadFacets(); this.search();
  }

  /** Últimos singles publicados (strip superior). */
  recent = signal<InventoryItem[]>([]);
  cardOf(it: InventoryItem): CardModel | null {
    return typeof it.cardModel === 'object' ? (it.cardModel as CardModel) : null;
  }

  constructor() {
    this.catalog.games().subscribe((g) => this.games.set(g));
    this.loadFacets();
    this.search();
    this.catalog.recentListings(10).subscribe((r) => this.recent.set(r.filter((i) => typeof i.cardModel === 'object')));
  }
  onGameChange() {
    this.setId = ''; this.sets.set([]);
    if (this.gameId) this.catalog.sets(this.gameId).subscribe((s) => this.sets.set(s));
    this.onSetChange();
  }
  onSetChange() {
    // Rareza/tipo dependen del juego/set elegido → recargar opciones y limpiar selección.
    this.type = ''; this.rarity = '';
    this.loadFacets();
    this.search();
  }
  private loadFacets() {
    this.catalog.facets(this.gameId || undefined, this.setId || undefined).subscribe((f) => {
      this.rarityOptions.set(f.rarities);
      this.typeOptions.set(f.types);
    });
  }
  debouncedSearch() { clearTimeout(this.timer); this.timer = setTimeout(() => this.search(), 300); }
  go(p: number) { this.page.set(p); this.search(false); }
  search(resetPage = true) {
    if (resetPage) this.page.set(1);
    this.loading.set(true);
    if (this.mine()) {
      this.collection
        .myCards({ q: this.q, gameId: this.gameId, setId: this.setId, type: this.type, rarity: this.rarity, dir: this.dir(), page: this.page(), limit: 32 })
        .subscribe((res) => { this.owned.set(res.data); this.total.set(res.total); this.totalPages.set(res.totalPages); this.loading.set(false); });
      return;
    }
    this.catalog
      .cards({ q: this.q, gameId: this.gameId, setId: this.setId, type: this.type, rarity: this.rarity, inStock: this.inStock, forSale: true, seller: this.onlyMine ? this.auth.user()?.id : undefined, sortBy: this.sortBy || undefined, dir: this.dir(), page: this.page(), limit: 32 })
      .subscribe((res) => { this.cards.set(res.data); this.total.set(res.total); this.totalPages.set(res.totalPages); this.loading.set(false); });
  }
  typesOf(c: CardModel): string[] {
    const a = c.attributes || {};
    return a['types'] || a['color'] || a['aspects'] || [];
  }
}
