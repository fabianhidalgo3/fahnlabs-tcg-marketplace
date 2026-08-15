import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TuiProgress } from '@taiga-ui/kit';
import { CatalogService } from '../core/services/catalog.service';
import { I18nService } from '../core/services/i18n.service';
import { CardSet, Game } from '../core/models/models';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TuiProgress],
  template: `
    <div class="head">
      <div>
        <h1>{{ i18n.t('sets.title') }}</h1>
        <p class="muted">{{ i18n.t('sets.subtitle') }}</p>
      </div>
      <div class="ui-field game">
        <select class="ui-select" [(ngModel)]="gameId" (ngModelChange)="load()">
          <option value="">{{ i18n.t('catalog.allGames') }}</option>
          @for (g of games(); track g.id) { <option [value]="g.id">{{ g.name }}</option> }
        </select>
      </div>
    </div>

    <div class="grid">
      @for (s of sets(); track s.id) {
        <div class="set card-surface" [routerLink]="['/sets', s.id]">
          <div class="top">
            <div class="ident">
              @if (s.symbolUrl) { <img class="symbol" [src]="s.symbolUrl" [alt]="s.name" loading="lazy" /> }
              <div>
                <div class="name">{{ s.name }}</div>
                <div class="muted code">{{ s.series }} · {{ s.code }}</div>
              </div>
            </div>
            <div class="pct">{{ s.stats?.completionPercent ?? 0 }}%</div>
          </div>
          <progress tuiProgressBar max="100" [value]="s.stats?.completionPercent ?? 0"></progress>
          <div class="stats muted">
            <span>{{ s.stats?.collectedCards ?? 0 }} / {{ s.stats?.totalCards }} {{ i18n.t('sets.collected') }}</span>
            <span>{{ i18n.t('sets.missing') }} {{ s.stats?.missingCards ?? 0 }}</span>
          </div>
        </div>
      } @empty { <p class="muted">Sin sets.</p> }
    </div>
  `,
  styles: [
    `
      .head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
      .game { width: 240px; }
      .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 18px; }
      .set { padding: 18px; cursor: pointer; transition: transform 0.12s; }
      .set:hover { transform: translateY(-3px); }
      .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
      .ident { display: flex; align-items: center; gap: 12px; min-width: 0; }
      .symbol { width: 40px; height: 40px; object-fit: contain; flex: 0 0 40px; }
      .name { font-weight: 800; font-size: 18px; }
      .code { font-size: 12px; margin-top: 2px; }
      .pct { font-weight: 800; font-size: 22px; color: var(--primary); }
      progress[tuiProgressBar] { margin: 14px 0 10px; display: block; inline-size: 100%; }
      .stats { display: flex; justify-content: space-between; font-size: 13px; }
    `,
  ],
})
export class SetsPage {
  private catalog = inject(CatalogService);
  i18n = inject(I18nService);
  games = signal<Game[]>([]);
  sets = signal<CardSet[]>([]);
  gameId = '';

  constructor() {
    this.catalog.games().subscribe((g) => this.games.set(g));
    this.load();
  }
  load() { this.catalog.sets(this.gameId || undefined).subscribe((s) => this.sets.set(s)); }
}
