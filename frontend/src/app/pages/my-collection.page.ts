import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CollectionService } from '../core/services/collection.service';
import { CatalogService } from '../core/services/catalog.service';
import { StorageLocationService } from '../core/services/storage-location.service';
import { I18nService } from '../core/services/i18n.service';
import { CurrencyService } from '../core/services/currency.service';
import { CardSet, Game, MyCollectionSet, OwnedCard } from '../core/models/models';
import { FavBtnComponent } from '../shared/fav-btn.component';
import { PagerComponent } from '../shared/pager.component';
import { SetChipComponent } from '../shared/set-chip.component';
import { setLogoUrl, thumbUrl } from '../core/utils/card-image';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, FavBtnComponent, SetChipComponent, PagerComponent],
  template: `
    <header class="page-head">
      <div>
        <h1>{{ i18n.t('collection.title') }}</h1>
        <p class="muted">{{ i18n.t('collection.subtitle') }}</p>
      </div>
      <div class="ph-actions">
        <button class="btn btn-primary" type="button" (click)="picker.set(!picker())">
          <span class="mi">add</span>{{ i18n.isES() ? 'Agregar set' : 'Add set' }}
        </button>
        <a class="btn btn-outline" routerLink="/coleccion/agregar">
          <span class="mi">playlist_add</span>{{ i18n.isES() ? 'Agregar carta' : 'Add card' }}
        </a>
        <a class="btn btn-outline" routerLink="/almacenamiento">
          <span class="mi">inventory_2</span>{{ i18n.isES() ? 'Álbumes y cajas' : 'Albums & boxes' }}
        </a>
        <button class="btn btn-outline" type="button" [disabled]="selling()" (click)="sellDuplicates()">
          <span class="mi">{{ selling() ? 'progress_activity' : 'sell' }}</span>{{ i18n.isES() ? 'Vender repetidas' : 'Sell duplicates' }}
        </button>
      </div>
    </header>
    @if (sellMsg()) { <p class="sellmsg">{{ sellMsg() }} <a routerLink="/publicaciones">{{ i18n.isES() ? 'Ver mis publicaciones →' : 'See my listings →' }}</a></p> }

    @if (picker()) {
      <div class="picker card-surface">
        <p class="hint muted">{{ i18n.isES() ? 'Agrega un set a tu colección: se crea una carpeta vinculada donde irás completándolo.' : 'Add a set to your collection: a linked folder is created to track its completion.' }}</p>
        <div class="row">
          <div class="ui-field">
            <span class="lbl">{{ i18n.isES() ? 'Juego' : 'Game' }}</span>
            <select class="ui-select" [(ngModel)]="gameId" (ngModelChange)="onGame()">
              <option value="">{{ i18n.isES() ? '— Selecciona juego —' : '— Select game —' }}</option>
              @for (g of games(); track g.id) { <option [value]="g.id">{{ g.name }}</option> }
            </select>
          </div>
          <div class="ui-field grow">
            <span class="lbl">Set</span>
            <select class="ui-select" [(ngModel)]="setId" [disabled]="!gameId">
              <option value="">{{ i18n.isES() ? '— Selecciona set —' : '— Select set —' }}</option>
              @for (s of pickerSets(); track s.id) { <option [value]="s.id">{{ s.name }} ({{ s.code }})</option> }
            </select>
          </div>
          <button class="btn btn-primary" type="button" [disabled]="!setId || saving()" (click)="addSet()">
            {{ saving() ? '…' : (i18n.isES() ? 'Agregar' : 'Add') }}
          </button>
        </div>
      </div>
    }

    <!-- Toggle de vista: por sets/álbumes o por cartas (plano) -->
    <div class="toolbar">
      <div class="seg">
        <button type="button" [class.on]="view() === 'sets'" (click)="view.set('sets')">
          <span class="mi">auto_stories</span>{{ i18n.isES() ? 'Sets / Álbumes' : 'Sets / Binders' }}
        </button>
        <button type="button" [class.on]="view() === 'cards'" (click)="switchToCards()">
          <span class="mi">style</span>{{ i18n.isES() ? 'Cartas' : 'Cards' }}
        </button>
      </div>
      @if (view() === 'cards') {
        <div class="searchbox">
          <span class="mi">search</span>
          <input class="ui-input" [placeholder]="i18n.t('catalog.search')" [(ngModel)]="q" (ngModelChange)="debouncedCards()" />
        </div>
        <select class="ui-select fsel" [(ngModel)]="variant" (ngModelChange)="loadCards()" [title]="i18n.isES() ? 'Variante' : 'Variant'">
          <option value="">{{ i18n.isES() ? 'Variante: todas' : 'Variant: all' }}</option>
          @for (v of variants(); track v) { <option [value]="v">{{ v }}</option> }
        </select>
        <select class="ui-select fsel" [(ngModel)]="rarity" (ngModelChange)="loadCards()" [title]="i18n.isES() ? 'Rareza' : 'Rarity'">
          <option value="">{{ i18n.isES() ? 'Rareza: todas' : 'Rarity: all' }}</option>
          @for (r of rarities(); track r) { <option [value]="r">{{ r }}</option> }
        </select>
        <label class="switch-row" [title]="i18n.isES() ? 'Solo cartas con más de 1 copia (las que se publican en Singles)' : 'Only cards with more than 1 copy'">
          <input class="ui-switch" type="checkbox" [(ngModel)]="onlyDups" (ngModelChange)="loadCards()" />
          {{ i18n.isES() ? 'Solo repetidas' : 'Duplicates only' }}
        </label>
        <div class="seg">
          <button type="button" [class.on]="layout() === 'grid'" (click)="layout.set('grid')" title="Cuadrícula"><span class="mi">grid_view</span></button>
          <button type="button" [class.on]="layout() === 'list'" (click)="layout.set('list')" title="Lista"><span class="mi">table_rows</span></button>
        </div>
        <select class="ui-select fsel" [(ngModel)]="sortBy" (ngModelChange)="loadCards()" [title]="i18n.isES() ? 'Ordenar por' : 'Sort by'">
          <option value="">{{ i18n.isES() ? 'Orden: más recientes' : 'Sort: newest' }}</option>
          <option value="artist">{{ i18n.isES() ? 'Orden: artista (A–Z)' : 'Sort: artist (A–Z)' }}</option>
        </select>
        <button class="icon-btn" type="button" (click)="toggleDir()" [title]="dir() === 'desc' ? 'Más recientes primero' : 'Más antiguas primero'">
          <span class="mi">{{ dir() === 'desc' ? 'south' : 'north' }}</span>
        </button>
        <button class="icon-btn del" type="button" (click)="clearCardFilters()" [title]="'Limpiar filtros y orden'">
          <span class="mi">delete_sweep</span>
        </button>
      }
      <button class="btn btn-outline btn-s t-right" type="button" [disabled]="exporting()" (click)="exportXlsx()">
        <span class="mi">{{ exporting() ? 'progress_activity' : 'download' }}</span>{{ i18n.isES() ? 'Exportar Excel' : 'Export Excel' }}
      </button>
    </div>

    @if (view() === 'cards') {
      <!-- VISTA POR CARTAS: todo lo que poseo, plano -->
      @if (cardsLoading()) {
        <p class="muted">{{ i18n.t('catalog.loading') }}</p>
      } @else if (owned().length === 0) {
        <p class="muted">{{ i18n.isES() ? 'No tienes cartas con ese filtro.' : 'No cards match that filter.' }}</p>
      } @else {
        <div class="countbar">
          <p class="muted count">
            <b>{{ cardsTotal() }}</b> {{ i18n.isES() ? 'cartas distintas' : 'distinct cards' }} ·
            <b>{{ totalCopies() }}</b> {{ i18n.isES() ? 'copias en total' : 'total copies' }}
          </p>
          <app-pager [page]="cardsPage()" [pages]="cardsPages()" [top]="true" (pageChange)="goCards($event)" />
        </div>
        @if (layout() === 'grid') {
        <div class="card-grid">
          @for (c of owned(); track c.id + c.variant) {
            <div class="card card-surface" [routerLink]="['/cartas', c.id]">
              <div class="img" [class.reverse]="c.variant === 'Reverse Holo'">
                @if (c.imageUrl) { <img [src]="thumb(c.imageUrl)" [alt]="c.name" loading="lazy" decoding="async" /> }
                @else { <div class="noimg">{{ c.name }}</div> }
                <span class="qtybadge">×{{ c.quantity }}</span>
                <app-fav-btn class="favpos-l" kind="card" [id]="c.id" />
                <span class="varbadge" [class.rev]="c.variant !== 'Normal'">{{ c.variant }}</span>
              </div>
              <div class="body">
                <div class="name cname">{{ c.name }}</div>
                <div class="sub"><app-set-chip [set]="c.set" [link]="c.set ? ['/coleccion', c.set.id] : null" [extra]="c.number" /></div>
                @if (c.albums?.length) {
                  <div class="albums">
                    @for (a of c.albums; track a.id) {
                      <a class="albchip" [routerLink]="['/almacenamiento', a.id]" (click)="$event.stopPropagation()" [style.border-left-color]="a.color || 'var(--primary)'">
                        <span class="mi">auto_stories</span>{{ a.name }}
                      </a>
                    }
                  </div>
                }
                <div class="foot">
                  <span class="price">{{ cur.format(c.value) }}</span>
                  <span class="langs muted">{{ c.languages.join(' · ') }}</span>
                </div>
              </div>
            </div>
          }
        </div>
        } @else {
        <div class="tablewrap card-surface">
          <table class="ltable">
            <thead>
              <tr>
                <th></th>
                <th>#</th>
                <th>{{ i18n.isES() ? 'Carta' : 'Card' }}</th>
                <th>Set</th>
                <th class="c">{{ i18n.isES() ? 'Cant.' : 'Qty' }}</th>
                <th class="r">{{ i18n.isES() ? 'Valor' : 'Value' }}</th>
                <th>{{ i18n.isES() ? 'Idiomas' : 'Languages' }}</th>
                <th>{{ i18n.isES() ? 'Álbum(es)' : 'Album(s)' }}</th>
              </tr>
            </thead>
            <tbody>
              @for (c of owned(); track c.id + c.variant) {
                <tr [routerLink]="['/cartas', c.id]">
                  <td>@if (c.imageUrl) { <img class="lthumb" [src]="thumb(c.imageUrl)" [alt]="c.name" loading="lazy" decoding="async" /> }</td>
                  <td class="muted mono">{{ c.number }}</td>
                  <td><b>{{ c.name }}</b> <span class="vtag" [class.rev]="c.variant !== 'Normal'">{{ c.variant }}</span></td>
                  <td><app-set-chip [set]="c.set" /></td>
                  <td class="c"><b>×{{ c.quantity }}</b></td>
                  <td class="r"><b class="price">{{ cur.format(c.value) }}</b></td>
                  <td class="muted">{{ c.languages.join(' · ') }}</td>
                  <td>
                    <div class="albums">
                      @for (a of c.albums; track a.id) {
                        <a class="albchip" [routerLink]="['/almacenamiento', a.id]" (click)="$event.stopPropagation()" [style.border-left-color]="a.color || 'var(--primary)'">
                          <span class="mi">auto_stories</span>{{ a.name }}
                        </a>
                      } @empty { <span class="muted">—</span> }
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        }
        <app-pager [page]="cardsPage()" [pages]="cardsPages()" (pageChange)="goCards($event)" />
      }
    } @else {
    <div class="grid">
      @for (s of sets(); track s.id) {
        <div class="set card-surface" [routerLink]="['/coleccion', s.id]">
          <div class="top">
            <div class="tt">
              @if (logo(s.symbolUrl); as lg) { <img class="setlogo" [src]="lg" [alt]="s.name" loading="lazy" /> }
              @else if (s.symbolUrl) { <img class="symbol" [src]="s.symbolUrl" [alt]="s.name" loading="lazy" /> }
              <div>
                <div class="name">{{ s.name }}</div>
                <div class="muted code">{{ s.series }} · {{ s.code }}</div>
              </div>
            </div>
            <div class="pctcol">
              <app-fav-btn class="flat" kind="set" [id]="s.id" />
              <div class="pct">{{ s.collection.completionPercent }}%</div>
            </div>
          </div>
          <div class="pbar"><div class="fill" [style.width.%]="s.collection.completionPercent"></div></div>
          <div class="stats">
            <div><span class="muted">{{ i18n.t('collection.owned') }}</span><b>{{ s.collection.ownedSlots }}/{{ s.collection.totalSlots }}</b></div>
            <div><span class="muted">{{ i18n.t('collection.value') }}</span><b class="val">{{ cur.format(s.collection.collectionValue) }}</b></div>
            <div><span class="muted">{{ i18n.t('collection.duplicates') }}</span><b>{{ s.collection.duplicates }}</b></div>
          </div>
        </div>
      } @empty {
        <p class="muted empty">{{ i18n.isES() ? 'Aún no tienes sets. Usa “Agregar set” para empezar tu colección.' : 'No sets yet. Use “Add set” to start your collection.' }}</p>
      }
    </div>
    }
  `,
  styles: [
    `
      .picker { padding: 16px; margin-top: 18px; }
      .picker .hint { margin-bottom: 12px; font-size: 13px; }
      .picker .row { display: flex; gap: 14px; align-items: flex-end; flex-wrap: wrap; }
      .ui-field { min-width: 180px; }
      .ui-field.grow { flex: 1; }
      .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 18px; margin-top: 22px; }
      .set { padding: 18px; cursor: pointer; transition: transform 0.12s; }
      .set:hover { transform: translateY(-3px); }
      .top { display: flex; justify-content: space-between; align-items: flex-start; }
      .tt { display: flex; align-items: center; gap: 10px; min-width: 0; }
      .symbol { width: 28px; height: 28px; object-fit: contain; flex: none; }
      .setlogo { height: 44px; max-width: 120px; object-fit: contain; flex: none; }
      .name { font-weight: 800; font-size: 18px; }
      .code { font-size: 12px; margin-top: 2px; }
      .pctcol { display: flex; align-items: center; gap: 8px; }
      .pct { font-weight: 800; font-size: 24px; color: var(--primary); }
      .pbar { margin: 14px 0 12px; display: block; inline-size: 100%; }
      .stats { display: flex; justify-content: space-between; gap: 10px; font-size: 13px; }
      .stats > div { display: flex; flex-direction: column; gap: 2px; }
      .stats b { font-size: 15px; }
      .val { color: var(--accent); }
      .empty { grid-column: 1 / -1; }
      .toolbar .seg .mi { font-size: 16px; margin-right: 6px; }
      .sellmsg { margin-top: 10px; font-size: 13px; color: var(--success, #12b76a); font-weight: 600; }
      /* vista por cartas */
      .card { padding: 0; overflow: hidden; cursor: pointer; transition: transform 0.12s; }
      .card:hover { transform: translateY(-4px); }
      .img { position: relative; aspect-ratio: 63/88; background: var(--bg-soft); display: flex; align-items: center; justify-content: center; }
      .img img { width: 100%; height: 100%; object-fit: contain; }
      .noimg { padding: 16px; text-align: center; color: var(--muted); font-weight: 600; }
      .favpos-l { position: absolute; top: 8px; left: 8px; z-index: 2; }
      .body { padding: 10px 12px; }
      .cname { font-size: 14px; }
      .sub { font-size: 12px; margin-top: 2px; }
      .foot { display: flex; align-items: center; justify-content: space-between; margin-top: 8px; }
      .price { font-weight: 800; font-size: 14px; color: var(--accent); }
      .langs { font-size: 11px; font-weight: 600; }
      .ltable .vtag { margin-left: 6px; }
      .albums { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
      /* vista lista (tabla estándar global .ltable/.lthumb) */
      .tablewrap { margin-top: 14px; overflow-x: auto; }
      .ltable tbody tr { cursor: pointer; }
      .ltable .albums { margin-top: 0; }
      @media (max-width: 620px) { .picker .row { flex-direction: column; align-items: stretch; } }
    `,
  ],
})
export class MyCollectionPage {
  thumb = thumbUrl;
  logo = setLogoUrl;
  private collection = inject(CollectionService);
  private catalog = inject(CatalogService);
  private storage = inject(StorageLocationService);
  i18n = inject(I18nService);
  cur = inject(CurrencyService);
  sets = signal<MyCollectionSet[]>([]);

  picker = signal(false);
  games = signal<Game[]>([]);
  pickerSets = signal<CardSet[]>([]);
  saving = signal(false);
  gameId = '';
  setId = '';

  /** Vista: agrupado por sets/álbumes o listado plano de cartas. */
  view = signal<'sets' | 'cards'>('sets');
  /** Dentro de "Cartas": cuadrícula o lista. */
  layout = signal<'grid' | 'list'>('grid');
  owned = signal<OwnedCard[]>([]);
  cardsLoading = signal(false);
  cardsPage = signal(1);
  cardsPages = signal(1);
  cardsTotal = signal(0);
  totalCopies = signal(0);
  q = '';
  variant = '';
  rarity = '';
  /** Solo slots con más de 1 copia. */
  onlyDups = false;
  sortBy = '';
  rarities = signal<string[]>([]);
  variants = signal<string[]>([]);
  dir = signal<'asc' | 'desc'>('desc');
  toggleDir() { this.dir.set(this.dir() === 'desc' ? 'asc' : 'desc'); this.loadCards(); }
  clearCardFilters() { this.q = ''; this.variant = ''; this.rarity = ''; this.onlyDups = false; this.sortBy = ''; this.dir.set('desc'); this.loadCards(); }
  private cardsLoaded = false;
  private timer: any;

  constructor() {
    this.load();
    this.catalog.games().subscribe((g) => this.games.set(g));
  }

  load() { this.collection.mySets().subscribe((s) => this.sets.set(s)); }

  selling = signal(false);
  sellMsg = signal('');
  /** Publica el excedente (copias - 1) al marketplace a precio de mercado. */
  sellDuplicates() {
    const msg = this.i18n.isES()
      ? 'Se publicarán tus cartas repetidas (todas menos 1 copia de cada una) a la venta a precio de mercado. Tu colección no se modifica. ¿Continuar?'
      : 'Your duplicate cards (all but 1 copy of each) will be listed for sale at market price. Your collection is not modified. Continue?';
    if (!confirm(msg)) return;
    this.selling.set(true);
    this.collection.sellDuplicates().subscribe({
      next: (r) => {
        this.sellMsg.set(this.i18n.isES()
          ? `✓ ${r.created} publicaciones nuevas, ${r.updated} actualizadas (de ${r.duplicates} cartas con repetidas).`
          : `✓ ${r.created} new listings, ${r.updated} updated (from ${r.duplicates} cards with duplicates).`);
        this.selling.set(false);
        setTimeout(() => this.sellMsg.set(''), 8000);
      },
      error: () => { this.sellMsg.set(this.i18n.isES() ? 'No se pudieron publicar.' : 'Could not publish.'); this.selling.set(false); },
    });
  }

  exporting = signal(false);
  /** Exporta la vista activa: sets, o cartas con los filtros en pantalla. */
  exportXlsx() {
    this.exporting.set(true);
    const done = { next: (b: Blob) => { this.collection.downloadBlob(b, this.view() === 'sets' ? 'mi-coleccion-sets.xlsx' : 'mi-coleccion-cartas.xlsx'); this.exporting.set(false); }, error: () => this.exporting.set(false) };
    if (this.view() === 'sets') this.collection.exportSetsXlsx().subscribe(done);
    else this.collection.exportCardsXlsx({ q: this.q, variant: this.variant || undefined, rarity: this.rarity || undefined, dir: this.dir() }).subscribe(done);
  }

  switchToCards() {
    this.view.set('cards');
    if (!this.cardsLoaded) {
      this.loadCards();
      // Solo rarezas/variantes que existen en MI colección, no el catálogo completo.
      this.collection.myCardFacets().subscribe((f) => {
        this.rarities.set(f.rarities);
        this.variants.set(f.variants);
      });
    }
  }
  debouncedCards() { clearTimeout(this.timer); this.timer = setTimeout(() => this.loadCards(), 300); }
  goCards(p: number) { this.cardsPage.set(p); this.loadCards(false); }
  loadCards(resetPage = true) {
    if (resetPage) this.cardsPage.set(1);
    this.cardsLoading.set(true);
    this.cardsLoaded = true;
    this.collection
      .myCards({
        q: this.q,
        variant: this.variant || undefined,
        rarity: this.rarity || undefined,
        dups: this.onlyDups ? 'true' : undefined,
        sortBy: this.sortBy || undefined,
        dir: this.dir(),
        page: this.cardsPage(),
        limit: 32,
      })
      .subscribe((r) => {
        this.owned.set(r.data);
        this.cardsTotal.set(r.total);
        this.totalCopies.set(r.totalCopies ?? 0);
        this.cardsPages.set(r.totalPages);
        this.cardsLoading.set(false);
      });
  }

  onGame() {
    this.setId = '';
    this.pickerSets.set([]);
    if (this.gameId) this.catalog.sets(this.gameId).subscribe((s) => this.pickerSets.set(s));
  }

  addSet() {
    const set = this.pickerSets().find((s) => s.id === this.setId);
    if (!set) return;
    this.saving.set(true);
    this.storage
      .create({ name: set.name, type: 'binder', setId: set.id })
      .subscribe(() => {
        this.saving.set(false);
        this.picker.set(false);
        this.setId = '';
        this.gameId = '';
        this.pickerSets.set([]);
        this.load();
      });
  }
}
