import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CatalogService } from '../core/services/catalog.service';
import { CollectionService } from '../core/services/collection.service';
import { I18nService } from '../core/services/i18n.service';
import { CurrencyService } from '../core/services/currency.service';
import { CardModel, InventoryItem } from '../core/models/models';
import { thumbUrl } from '../core/utils/card-image';
import { SetChipComponent } from '../shared/set-chip.component';

/**
 * MIS PUBLICACIONES: qué cartas mías están a la venta en el marketplace,
 * con precio y stock editables en línea, y botón para retirarlas.
 * Responde "¿cuáles de mis cartas están publicadas y cuáles no?".
 */
@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, SetChipComponent],
  template: `
    <header class="page-head">
      <div>
        <h1>{{ i18n.isES() ? 'Mis publicaciones' : 'My listings' }}</h1>
        <p class="muted">{{ i18n.isES() ? 'Lo que tienes a la venta en Singles. Publica más con "Vender repetidas" en Mi Colección.' : 'What you have for sale in Singles. List more with "Sell duplicates" in My Collection.' }}</p>
      </div>
      <div class="ph-actions">
        <button class="btn btn-primary" type="button" [disabled]="selling()" (click)="sellDuplicates()">
          <span class="mi">{{ selling() ? 'progress_activity' : 'sell' }}</span>{{ i18n.isES() ? 'Vender repetidas' : 'Sell duplicates' }}
        </button>
      </div>
    </header>
    @if (msg()) { <p class="okmsg">{{ msg() }}</p> }

    @if (loading()) {
      <p class="muted">{{ i18n.t('catalog.loading') }}</p>
    } @else if (items().length === 0) {
      <div class="empty card-surface">
        <span class="mi big">storefront</span>
        <p class="muted">{{ i18n.isES() ? 'No tienes cartas publicadas. Usa "Vender repetidas": publica el excedente de tus cartas (todas menos 1 copia) a precio de mercado.' : 'No listings yet. Use "Sell duplicates" to list your surplus copies at market price.' }}</p>
      </div>
    } @else {
      <div class="toolbar">
        <div class="seg">
          <button type="button" [class.on]="layout() === 'grid'" (click)="layout.set('grid')" title="Grid"><span class="mi">grid_view</span></button>
          <button type="button" [class.on]="layout() === 'list'" (click)="layout.set('list')" title="Tabla"><span class="mi">table_rows</span></button>
        </div>
      </div>
      <div class="countbar">
        <p class="muted count">
          <b>{{ items().length }}</b> {{ i18n.isES() ? 'publicaciones' : 'listings' }} ·
          <b>{{ totalStock() }}</b> {{ i18n.isES() ? 'copias a la venta' : 'copies for sale' }} ·
          {{ i18n.isES() ? 'valor total' : 'total value' }} <b class="price">{{ cur.format(totalValue()) }}</b>
        </p>
      </div>

      @if (layout() === 'grid') {
      <div class="card-grid">
        @for (it of items(); track it.id) {
          <div class="card card-surface" [routerLink]="['/cartas', card(it)?.id]">
            <div class="img">
              @if (card(it)?.imageUrl) { <img [src]="thumb(card(it)?.imageUrl)" [alt]="card(it)?.name" loading="lazy" decoding="async" /> }
              <span class="qtybadge">×{{ it.quantity }}</span>
              @if (it.quantity > 0) { <span class="st on ongrid">{{ i18n.isES() ? 'Publicada' : 'Listed' }}</span> }
              @else { <span class="st off ongrid">{{ i18n.isES() ? 'Agotada' : 'Sold out' }}</span> }
            </div>
            <div class="body">
              <div class="name">{{ card(it)?.name }}</div>
              <div class="sub muted">{{ card(it)?.number }} · {{ it.condition }} · {{ it.language }}@if (it.isFoil) { <span class="foil">FOIL</span> }</div>
              <div class="foot"><span class="price">{{ cur.format(it.price) }}</span></div>
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
              <th>{{ i18n.isES() ? 'Detalle' : 'Details' }}</th>
              <th class="r">{{ i18n.isES() ? 'Precio (USD)' : 'Price (USD)' }}</th>
              <th class="c">Stock</th>
              <th class="c">{{ i18n.isES() ? 'Estado' : 'Status' }}</th>
              <th class="acol"></th>
            </tr>
          </thead>
          <tbody>
            @for (it of items(); track it.id) {
              <tr>
                <td>
                  @if (card(it)?.imageUrl) {
                    <a [routerLink]="['/cartas', card(it)?.id]"><img class="lthumb" [src]="thumb(card(it)?.imageUrl)" [alt]="card(it)?.name" loading="lazy" /></a>
                  }
                </td>
                <td class="muted mono">{{ card(it)?.number }}</td>
                <td><a class="cardlink" [routerLink]="['/cartas', card(it)?.id]"><b>{{ card(it)?.name }}</b></a></td>
                <td><app-set-chip [set]="card(it)?.set" /></td>
                <td class="muted">{{ it.condition }} · {{ it.language }}@if (it.isFoil) { <span class="foil">FOIL</span> }</td>
                <td class="r">
                  <input class="ui-input mini" type="number" min="0" step="0.01" [(ngModel)]="draft[it.id].price" />
                </td>
                <td class="c">
                  <input class="ui-input mini qty" type="number" min="0" step="1" [(ngModel)]="draft[it.id].quantity" />
                </td>
                <td class="c">
                  @if (it.quantity > 0) { <span class="st on">{{ i18n.isES() ? 'Publicada' : 'Listed' }}</span> }
                  @else { <span class="st off">{{ i18n.isES() ? 'Agotada' : 'Sold out' }}</span> }
                </td>
                <td class="acol">
                  <button class="icon-btn sm" type="button" [disabled]="busy() || !dirty(it)" (click)="save(it)" [title]="i18n.isES() ? 'Guardar cambios' : 'Save changes'">
                    <span class="mi">{{ saved() === it.id ? 'check' : 'save' }}</span>
                  </button>
                  <button class="icon-btn sm del" type="button" [disabled]="busy()" (click)="remove(it)" [title]="i18n.isES() ? 'Retirar publicación' : 'Remove listing'">
                    <span class="mi">delete</span>
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      }
    }
  `,
  styles: [
    `
      .okmsg { margin-top: 10px; font-size: 13px; color: var(--success, #12b76a); font-weight: 600; }
      .empty { margin-top: 18px; padding: 34px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 10px; }
      .empty .big { font-size: 40px; color: var(--muted); }
      .tablewrap { margin-top: 14px; overflow-x: auto; }
      .ltable .acol { white-space: nowrap; text-align: right; }
      .cardlink:hover b { color: var(--primary); }
      .mini { width: 90px; height: 30px; font-size: 13px; text-align: right; }
      .mini.qty { width: 64px; text-align: center; }
      .foil { font-size: 10px; background: linear-gradient(90deg, #ffd54a, #ff6b6b); color: #000; padding: 1px 6px; border-radius: 5px; margin-left: 6px; font-weight: 700; }
      .st { font-size: 11px; font-weight: 700; padding: 2px 9px; border-radius: 999px; }
      .st.on { color: var(--success, #12b76a); background: color-mix(in srgb, var(--success, #12b76a) 14%, transparent); }
      .st.ongrid { position: absolute; bottom: 6px; left: 6px; }
      .card { padding: 0; overflow: hidden; cursor: pointer; }
      .img { position: relative; aspect-ratio: 63/88; background: var(--bg-soft); display: flex; align-items: center; justify-content: center; }
      .img img { width: 100%; height: 100%; object-fit: contain; }
      .body { padding: 10px 12px; }
      .name { font-weight: 700; font-size: 14px; }
      .sub { font-size: 12px; margin-top: 2px; }
      .foot { margin-top: 8px; font-weight: 800; }
      .st.off { color: var(--muted); background: var(--card-2); border: 1px solid var(--border); }
      .price { color: var(--accent); }
    `,
  ],
})
export class ListingsPage {
  thumb = thumbUrl;
  private catalog = inject(CatalogService);
  private collection = inject(CollectionService);
  i18n = inject(I18nService);
  cur = inject(CurrencyService);

  layout = signal<'grid' | 'list'>('list');
  items = signal<InventoryItem[]>([]);
  loading = signal(true);
  busy = signal(false);
  saved = signal('');
  msg = signal('');
  selling = signal(false);
  /** Borrador editable por publicación (precio/stock). */
  draft: Record<string, { price: number; quantity: number }> = {};

  constructor() { this.load(); }

  card(it: InventoryItem): CardModel | null {
    return typeof it.cardModel === 'object' ? (it.cardModel as CardModel) : null;
  }
  totalStock() { return this.items().reduce((s, i) => s + i.quantity, 0); }
  totalValue() { return this.items().reduce((s, i) => s + i.price * i.quantity, 0); }
  dirty(it: InventoryItem) {
    const d = this.draft[it.id];
    return d && (Number(d.price) !== it.price || Number(d.quantity) !== it.quantity);
  }

  load() {
    this.loading.set(true);
    this.catalog.myListings().subscribe((r) => {
      this.items.set(r);
      this.draft = Object.fromEntries(r.map((i) => [i.id, { price: i.price, quantity: i.quantity }]));
      this.loading.set(false);
    });
  }

  save(it: InventoryItem) {
    const d = this.draft[it.id];
    this.busy.set(true);
    this.catalog.updateMyListing(it.id, { price: Number(d.price), quantity: Number(d.quantity) }).subscribe({
      next: () => {
        this.saved.set(it.id);
        this.busy.set(false);
        setTimeout(() => this.saved.set(''), 1500);
        this.load();
      },
      error: () => this.busy.set(false),
    });
  }

  remove(it: InventoryItem) {
    const q = this.i18n.isES()
      ? `¿Retirar la publicación de ${this.card(it)?.name ?? 'esta carta'}? Tu colección no cambia.`
      : `Remove the listing for ${this.card(it)?.name ?? 'this card'}? Your collection is not affected.`;
    if (!confirm(q)) return;
    this.busy.set(true);
    this.catalog.removeMyListing(it.id).subscribe({
      next: () => { this.busy.set(false); this.load(); },
      error: () => this.busy.set(false),
    });
  }

  /** El mismo "Vender repetidas" de Mi Colección, aquí a mano. */
  sellDuplicates() {
    const q = this.i18n.isES()
      ? 'Se publicará el excedente de tus repetidas (todas menos 1 copia) a precio de mercado. ¿Continuar?'
      : 'Your surplus duplicates (all but 1 copy) will be listed at market price. Continue?';
    if (!confirm(q)) return;
    this.selling.set(true);
    this.collection.sellDuplicates().subscribe({
      next: (r) => {
        this.msg.set(this.i18n.isES()
          ? `✓ ${r.created} publicaciones nuevas, ${r.updated} actualizadas.`
          : `✓ ${r.created} new listings, ${r.updated} updated.`);
        this.selling.set(false);
        setTimeout(() => this.msg.set(''), 8000);
        this.load();
      },
      error: () => this.selling.set(false),
    });
  }
}
