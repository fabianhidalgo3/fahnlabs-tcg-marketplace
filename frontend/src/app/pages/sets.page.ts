import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CatalogService } from '../core/services/catalog.service';
import { I18nService } from '../core/services/i18n.service';
import { CardSet, Game } from '../core/models/models';
import { FavBtnComponent } from '../shared/fav-btn.component';
import { setLogoUrl } from '../core/utils/card-image';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, FavBtnComponent],
  template: `
    <header class="page-head">
      <div>
        <h1>{{ i18n.isES() ? 'Expansiones' : 'Expansions' }}</h1>
        <p class="muted">{{ i18n.isES() ? 'Explora todos los sets del catálogo y compra sus singles. Tu progreso vive en Mi Colección.' : 'Browse every set in the catalog and shop its singles. Your progress lives in My Collection.' }}</p>
      </div>
      <div class="ph-actions">
        <div class="ui-field game">
          <select class="ui-select" [(ngModel)]="gameId" (ngModelChange)="load()">
            <option value="">{{ i18n.t('catalog.allGames') }}</option>
            @for (g of games(); track g.id) { <option [value]="g.id">{{ g.name }}</option> }
          </select>
        </div>
        <button class="icon-btn" type="button" (click)="toggleDir()" [title]="dir() === 'desc' ? 'Más recientes primero' : 'Más antiguos primero'">
          <span class="mi">{{ dir() === 'desc' ? 'south' : 'north' }}</span>
        </button>
        <button class="icon-btn del" type="button" (click)="clearFilters()" title="Limpiar filtros y orden">
          <span class="mi">delete_sweep</span>
        </button>
      </div>
    </header>

    <div class="grid">
      @for (s of sets(); track s.id) {
        <div class="set card-surface" [routerLink]="['/sets', s.id]">
          <div class="top">
            <div class="ident">
              @if (logo(s.symbolUrl); as lg) { <img class="setlogo" [src]="lg" [alt]="s.name" loading="lazy" /> }
              @else if (s.symbolUrl) { <img class="symbol" [src]="s.symbolUrl" [alt]="s.name" loading="lazy" /> }
              <div>
                <div class="name">{{ s.name }}</div>
                <div class="muted code">{{ s.series }} · {{ s.code }}</div>
              </div>
            </div>
            <div class="pctcol">
              <app-fav-btn class="flat" kind="set" [id]="s.id" />
            </div>
          </div>
          <div class="stats">
            <span class="chip"><span class="mi">style</span>{{ s.totalCards ?? s.stats?.totalCards ?? 0 }} {{ i18n.isES() ? 'cartas' : 'cards' }}</span>
            @if (s.releaseDate) { <span class="chip"><span class="mi">event</span>{{ s.releaseDate }}</span> }
            @if ((s.stats?.collectedCards ?? 0) > 0) {
              <span class="chip stock"><span class="mi">storefront</span>{{ s.stats?.collectedCards }} {{ i18n.isES() ? 'con stock' : 'in stock' }}</span>
            }
          </div>
        </div>
      } @empty { <p class="muted">Sin sets.</p> }
    </div>
  `,
  styles: [
    `
      .game { width: 240px; }
      .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 18px; }
      .set { padding: 18px; cursor: pointer; transition: transform 0.12s; }
      .set:hover { transform: translateY(-3px); }
      .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
      .ident { display: flex; align-items: center; gap: 12px; min-width: 0; }
      .symbol { width: 40px; height: 40px; object-fit: contain; flex: 0 0 40px; }
      .setlogo { height: 46px; max-width: 130px; object-fit: contain; flex: none; }
      .name { font-weight: 800; font-size: 18px; }
      .code { font-size: 12px; margin-top: 2px; }
      .pctcol { display: flex; align-items: center; gap: 8px; }
      .stats { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
      .chip { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; color: var(--muted); background: var(--card-2); border: 1px solid var(--border); border-radius: 999px; padding: 3px 10px; }
      .chip .mi { font-size: 14px; }
      .chip.stock { color: var(--success, #12b76a); border-color: color-mix(in srgb, var(--success, #12b76a) 40%, var(--border)); }
    `,
  ],
})
export class SetsPage {
  logo = setLogoUrl;
  private catalog = inject(CatalogService);
  i18n = inject(I18nService);
  games = signal<Game[]>([]);
  sets = signal<CardSet[]>([]);
  gameId = '';

  constructor() {
    this.catalog.games().subscribe((g) => this.games.set(g));
    this.load();
  }
  dir = signal<'asc' | 'desc'>('desc');
  toggleDir() { this.dir.set(this.dir() === 'desc' ? 'asc' : 'desc'); this.load(); }
  clearFilters() { this.gameId = ''; this.dir.set('desc'); this.load(); }
  load() { this.catalog.sets(this.gameId || undefined, this.dir()).subscribe((s) => this.sets.set(s)); }
}
