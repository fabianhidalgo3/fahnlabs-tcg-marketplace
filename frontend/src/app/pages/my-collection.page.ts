import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { CollectionService } from '../core/services/collection.service';
import { I18nService } from '../core/services/i18n.service';
import { CurrencyService } from '../core/services/currency.service';
import { MyCollectionSet } from '../core/models/models';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink, MatCardModule, MatButtonModule, MatIconModule, MatProgressBarModule],
  template: `
    <div class="head">
      <div>
        <h1>{{ i18n.t('collection.title') }}</h1>
        <p class="muted">{{ i18n.t('collection.subtitle') }}</p>
      </div>
      <a mat-stroked-button routerLink="/almacenamiento">
        <mat-icon>inventory_2</mat-icon>{{ i18n.isES() ? 'Álbumes y cajas' : 'Albums & boxes' }}
      </a>
    </div>

    <div class="grid">
      @for (s of sets(); track s.id) {
        @if (s.collection.totalSlots > 0) {
          <mat-card class="set" appearance="outlined" [routerLink]="['/coleccion', s.id]">
            <div class="top">
              <div>
                <div class="name">{{ s.name }}</div>
                <div class="muted code">{{ s.series }} · {{ s.code }}</div>
              </div>
              <div class="pct">{{ s.collection.completionPercent }}%</div>
            </div>
            <mat-progress-bar mode="determinate" [value]="s.collection.completionPercent"></mat-progress-bar>
            <div class="stats">
              <div><span class="muted">{{ i18n.t('collection.owned') }}</span><b>{{ s.collection.ownedSlots }}/{{ s.collection.totalSlots }}</b></div>
              <div><span class="muted">{{ i18n.t('collection.value') }}</span><b class="val">{{ cur.format(s.collection.collectionValue) }}</b></div>
              <div><span class="muted">{{ i18n.t('collection.duplicates') }}</span><b>{{ s.collection.duplicates }}</b></div>
            </div>
          </mat-card>
        }
      }
    </div>
  `,
  styles: [
    `
      .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
      h1 { margin-bottom: 2px; }
      .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 18px; margin-top: 22px; }
      .set { padding: 18px; cursor: pointer; transition: transform 0.12s; }
      .set:hover { transform: translateY(-3px); }
      .top { display: flex; justify-content: space-between; align-items: flex-start; }
      .name { font-weight: 800; font-size: 18px; }
      .code { font-size: 12px; margin-top: 2px; }
      .pct { font-weight: 800; font-size: 24px; color: var(--primary); }
      mat-progress-bar { margin: 14px 0 12px; border-radius: 999px; }
      .stats { display: flex; justify-content: space-between; gap: 10px; font-size: 13px; }
      .stats > div { display: flex; flex-direction: column; gap: 2px; }
      .stats b { font-size: 15px; }
      .val { color: var(--accent); }
    `,
  ],
})
export class MyCollectionPage {
  private collection = inject(CollectionService);
  i18n = inject(I18nService);
  cur = inject(CurrencyService);
  sets = signal<MyCollectionSet[]>([]);

  constructor() { this.collection.mySets().subscribe((s) => this.sets.set(s)); }
}
