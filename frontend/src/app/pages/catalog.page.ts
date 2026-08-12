import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CatalogService } from '../core/services/catalog.service';
import { I18nService } from '../core/services/i18n.service';
import { CurrencyService } from '../core/services/currency.service';
import { CardModel, CardSet, Game } from '../core/models/models';

@Component({
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink, MatCardModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatSlideToggleModule, MatChipsModule, MatButtonModule, MatIconModule,
  ],
  template: `
    <h1>{{ i18n.t('catalog.title') }}</h1>
    <p class="muted">{{ total() }} {{ i18n.t('catalog.subtitle') }}</p>

    <div class="filters">
      <mat-form-field appearance="outline" class="search" subscriptSizing="dynamic">
        <mat-icon matPrefix>search</mat-icon>
        <input matInput [placeholder]="i18n.t('catalog.search')" [(ngModel)]="q" (ngModelChange)="debouncedSearch()" />
        @if (q) { <button matSuffix mat-icon-button (click)="q=''; search()"><mat-icon>close</mat-icon></button> }
      </mat-form-field>

      <div class="chips">
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>{{ i18n.t('catalog.allGames') }}</mat-label>
          <mat-select [(ngModel)]="gameId" (ngModelChange)="onGameChange()">
            <mat-option value="">{{ i18n.t('catalog.allGames') }}</mat-option>
            @for (g of games(); track g.id) { <mat-option [value]="g.id">{{ g.name }}</mat-option> }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>{{ i18n.t('catalog.allSets') }}</mat-label>
          <mat-select [(ngModel)]="setId" (ngModelChange)="search()">
            <mat-option value="">{{ i18n.t('catalog.allSets') }}</mat-option>
            @for (s of sets(); track s.id) { <mat-option [value]="s.id">{{ s.name }}</mat-option> }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>{{ i18n.t('catalog.type') }}</mat-label>
          <input matInput [(ngModel)]="type" (ngModelChange)="debouncedSearch()" />
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>{{ i18n.t('catalog.rarity') }}</mat-label>
          <input matInput [(ngModel)]="rarity" (ngModelChange)="debouncedSearch()" />
        </mat-form-field>
        <mat-slide-toggle [(ngModel)]="inStock" (ngModelChange)="search()">{{ i18n.t('catalog.inStock') }}</mat-slide-toggle>
      </div>
    </div>

    @if (loading()) {
      <p class="muted">{{ i18n.t('catalog.loading') }}</p>
    } @else if (cards().length === 0) {
      <p class="muted">{{ i18n.t('catalog.empty') }}</p>
    } @else {
      <div class="grid">
        @for (c of cards(); track c.id) {
          <mat-card class="card" appearance="outlined" [routerLink]="['/cartas', c.id]">
            <div class="img">
              @if (c.imageUrl) { <img [src]="c.imageUrl" [alt]="c.name" loading="lazy" /> }
              @else { <div class="noimg">{{ c.name }}</div> }
              @if (c.cardType) { <span class="type-badge">{{ c.cardType }}</span> }
            </div>
            <div class="body">
              <div class="name">{{ c.name }}</div>
              <div class="sub muted">{{ c.game?.name }} · {{ c.number }}</div>
              @if (typesOf(c).length) {
                <mat-chip-set class="tags">
                  @for (t of typesOf(c); track t) { <mat-chip>{{ t }}</mat-chip> }
                </mat-chip-set>
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
          </mat-card>
        }
      </div>

      @if (totalPages() > 1) {
        <div class="pager">
          <button mat-icon-button [disabled]="page() === 1" (click)="go(page() - 1)"><mat-icon>chevron_left</mat-icon></button>
          <span class="muted">{{ i18n.t('catalog.page') }} {{ page() }} {{ i18n.t('catalog.of') }} {{ totalPages() }}</span>
          <button mat-icon-button [disabled]="page() === totalPages()" (click)="go(page() + 1)"><mat-icon>chevron_right</mat-icon></button>
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
      .chips mat-form-field { width: 180px; }
      .chips mat-slide-toggle { margin-left: 4px; }
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
      .tags mat-chip { --mat-chip-container-height: 22px; font-size: 11px; }
      .foot { display: flex; align-items: center; justify-content: space-between; margin-top: 10px; }
      .price { font-weight: 800; font-size: 15px; color: var(--accent); }
      .stock { font-size: 12px; font-weight: 600; }
      .stock.ok { color: var(--success); }
      .stock.no { color: var(--muted); }
      .pager { display: flex; align-items: center; justify-content: center; gap: 14px; margin-top: 28px; }
      @media (max-width: 760px) { .filters { grid-template-columns: 1fr 1fr; } }
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

  q = ''; gameId = ''; setId = ''; type = ''; rarity = ''; inStock = false;
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
    this.catalog.cards({ q: this.q, gameId: this.gameId, setId: this.setId, type: this.type, rarity: this.rarity, inStock: this.inStock, page: this.page() })
      .subscribe((res) => { this.cards.set(res.data); this.total.set(res.total); this.totalPages.set(res.totalPages); this.loading.set(false); });
  }
  typesOf(c: CardModel): string[] {
    const a = c.attributes || {};
    return a['types'] || a['color'] || a['aspects'] || [];
  }
}
