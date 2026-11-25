import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FavoritesService } from '../core/services/favorites.service';
import { I18nService } from '../core/services/i18n.service';
import { CurrencyService } from '../core/services/currency.service';
import { CardModel, CardSet } from '../core/models/models';
import { thumbUrl } from '../core/utils/card-image';
import { FavBtnComponent } from '../shared/fav-btn.component';

/** Mis favoritos: sets y cartas marcados con ♥. */
@Component({
  standalone: true,
  imports: [CommonModule, RouterLink, FavBtnComponent],
  template: `
    <header class="page-head">
      <div>
        <h1>{{ i18n.isES() ? 'Mis favoritos' : 'My favorites' }}</h1>
        <p class="muted">{{ i18n.isES() ? 'Los sets y cartas que marcaste con el corazón.' : 'The sets and cards you marked with a heart.' }}</p>
      </div>
    </header>

    @if (loading()) {
      <p class="muted">{{ i18n.t('catalog.loading') }}</p>
    } @else {
      <h3 class="sec">{{ i18n.isES() ? 'Sets' : 'Sets' }} <span class="muted">({{ sets().length }})</span></h3>
      @if (sets().length === 0) {
        <p class="muted empty">{{ i18n.isES() ? 'Aún no marcas sets. Usa el ♥ en la lista de sets o en tu colección.' : 'No favorite sets yet. Use the ♥ on the sets list or your collection.' }}</p>
      } @else {
        <div class="setgrid">
          @for (s of sets(); track s.id) {
            <div class="set card-surface" [routerLink]="['/sets', s.id]">
              @if (s.symbolUrl) { <img class="symbol" [src]="s.symbolUrl" [alt]="s.name" loading="lazy" /> }
              <div class="info">
                <div class="name">{{ s.name }}</div>
                <div class="muted code">{{ s.series }} · {{ s.code }} · {{ s.totalCards }} {{ i18n.isES() ? 'cartas' : 'cards' }}</div>
              </div>
              <app-fav-btn class="flat" kind="set" [id]="s.id" />
            </div>
          }
        </div>
      }

      <h3 class="sec">{{ i18n.isES() ? 'Cartas' : 'Cards' }} <span class="muted">({{ cards().length }})</span>
        <span class="seg segr">
          <button type="button" [class.on]="layout() === 'grid'" (click)="layout.set('grid')" title="Grid"><span class="mi">grid_view</span></button>
          <button type="button" [class.on]="layout() === 'list'" (click)="layout.set('list')" title="Tabla"><span class="mi">table_rows</span></button>
        </span>
      </h3>
      @if (cards().length === 0) {
        <p class="muted empty">{{ i18n.isES() ? 'Aún no marcas cartas. Usa el ♥ sobre cualquier carta.' : 'No favorite cards yet. Use the ♥ on any card.' }}</p>
      } @else if (layout() === 'list') {
        <div class="tablewrap card-surface">
          <table class="ltable">
            <thead><tr><th></th><th>#</th><th>{{ i18n.isES() ? 'Carta' : 'Card' }}</th><th>{{ i18n.isES() ? 'Rareza' : 'Rarity' }}</th><th class="c">♥</th></tr></thead>
            <tbody>
              @for (c of cards(); track c.id) {
                <tr [routerLink]="['/cartas', c.id]">
                  <td>@if (c.imageUrl) { <img class="lthumb" [src]="thumb(c.imageUrl)" [alt]="c.name" loading="lazy" /> }</td>
                  <td class="muted mono">{{ c.number }}</td>
                  <td><b>{{ c.name }}</b></td>
                  <td class="muted">{{ c.rarity }}</td>
                  <td class="c" (click)="$event.stopPropagation()"><app-fav-btn class="flat" kind="card" [id]="c.id" /></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <div class="card-grid">
          @for (c of cards(); track c.id) {
            <div class="card card-surface" [routerLink]="['/cartas', c.id]">
              <div class="img">
                @if (c.imageUrl) { <img [src]="thumb(c.imageUrl)" [alt]="c.name" loading="lazy" decoding="async" /> }
                @else { <div class="noimg">{{ c.number }}</div> }
                <app-fav-btn class="favpos" kind="card" [id]="c.id" />
              </div>
              <div class="body">
                <div class="name">{{ c.name }}</div>
                <div class="sub muted">{{ c.number }} @if (c.rarity) { · {{ c.rarity }} }</div>
              </div>
            </div>
          }
        </div>
      }
    }
  `,
  styles: [
    `
      .sec { display: flex; align-items: center; gap: 10px; }
      .segr { margin-left: auto; }
      .tablewrap { overflow-x: auto; }
      .ltable tbody tr { cursor: pointer; }
      h1 { margin-bottom: 2px; }
      .sec { margin: 24px 0 12px; font-size: 16px; }
      .empty { margin: 8px 0 4px; }
      .setgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; }
      .set { display: flex; align-items: center; gap: 12px; padding: 14px 16px; cursor: pointer; transition: transform 0.12s; }
      .set:hover { transform: translateY(-2px); }
      .symbol { width: 30px; height: 30px; object-fit: contain; flex: none; }
      .set .info { flex: 1; min-width: 0; }
      .set .name { font-weight: 700; }
      .code { font-size: 12px; }
      .card { padding: 0; overflow: hidden; cursor: pointer; transition: transform 0.12s; }
      .card:hover { transform: translateY(-4px); }
      .img { position: relative; aspect-ratio: 63/88; background: var(--bg-soft); display: flex; align-items: center; justify-content: center; }
      .img img { width: 100%; height: 100%; object-fit: contain; }
      .favpos { position: absolute; top: 8px; right: 8px; z-index: 2; }
      .noimg { color: var(--muted); font-weight: 700; }
      .body { padding: 10px 12px; }
      .name { font-weight: 700; font-size: 14px; }
      .sub { font-size: 12px; margin-top: 2px; }
    `,
  ],
})
export class FavoritesPage {
  layout = signal<'grid' | 'list'>('grid');
  thumb = thumbUrl;
  private favs = inject(FavoritesService);
  i18n = inject(I18nService);
  cur = inject(CurrencyService);

  sets = signal<CardSet[]>([]);
  cards = signal<CardModel[]>([]);
  loading = signal(true);

  constructor() {
    this.favs.list().subscribe((r) => {
      this.sets.set(r.sets);
      this.cards.set(r.cards);
      this.loading.set(false);
    });
  }
}
