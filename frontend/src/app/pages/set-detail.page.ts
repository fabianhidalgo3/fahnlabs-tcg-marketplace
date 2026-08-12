import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CatalogService } from '../core/services/catalog.service';
import { I18nService } from '../core/services/i18n.service';
import { SetDetail } from '../core/models/models';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    @if (set(); as s) {
      <a routerLink="/sets" class="back muted">← {{ i18n.t('setd.allSets') }}</a>

      <div class="header panel">
        <div>
          <h1>{{ s.name }}</h1>
          <p class="muted">{{ s.series }} · {{ s.code }} · {{ i18n.t('common.released') }} {{ s.releaseDate }}</p>
        </div>
        <div class="summary">
          <div class="ring" [style.--p]="s.stats?.completionPercent ?? 0">
            <span>{{ s.stats?.completionPercent ?? 0 }}%</span>
          </div>
          <div class="numbers">
            <div><b>{{ s.stats?.collectedCards }}</b><span class="muted"> {{ i18n.t('setd.inStock') }}</span></div>
            <div><b>{{ s.stats?.registeredCards }}</b><span class="muted"> {{ i18n.t('setd.inCatalog') }}</span></div>
            <div><b>{{ s.stats?.totalCards }}</b><span class="muted"> {{ i18n.t('setd.officialTotal') }}</span></div>
            <div class="miss"><b>{{ s.stats?.missingCards }}</b><span class="muted"> {{ i18n.t('setd.toGet') }}</span></div>
          </div>
        </div>
      </div>

      <div class="toolbar">
        <div class="legend">
          <span class="dot ok"></span> {{ i18n.t('setd.inStock') }}
          <span class="dot no"></span> {{ i18n.t('setd.missing') }}
        </div>
        <label class="check muted">
          <input type="checkbox" [checked]="onlyMissing()" (change)="toggleMissing()" />
          {{ i18n.t('setd.onlyMissing') }}
        </label>
      </div>

      <div class="grid">
        @for (c of visibleCards(); track c.id) {
          <a
            class="cell panel"
            [class.missing]="!c.inStock"
            [routerLink]="['/cartas', c.id]"
          >
            <div class="img">
              @if (c.imageUrl) {
                <img [src]="c.imageUrl" [alt]="c.name" loading="lazy" />
              } @else {
                <div class="noimg">{{ c.number }}</div>
              }
              @if (!c.inStock) { <span class="flag">{{ i18n.t('setd.missing') }}</span> }
            </div>
            <div class="meta">
              <div class="n">{{ c.number }}</div>
              <div class="nm">{{ c.name }}</div>
              @if (c.inStock) {
                <div class="pr">\${{ c.minPrice?.toFixed(2) }}</div>
              }
            </div>
          </a>
        }
      </div>
    } @else {
      <p class="muted">Cargando…</p>
    }
  `,
  styles: [
    `
      .back { display: inline-block; margin-bottom: 16px; font-weight: 600; }
      .header { display: flex; justify-content: space-between; align-items: center; gap: 20px; padding: 22px; margin-bottom: 20px; flex-wrap: wrap; }
      h1 { font-size: 28px; }
      .summary { display: flex; align-items: center; gap: 22px; }
      .ring {
        --p: 0;
        width: 92px; height: 92px; border-radius: 50%;
        background: conic-gradient(var(--primary) calc(var(--p) * 1%), var(--bg-soft) 0);
        display: grid; place-items: center;
      }
      .ring::before { content: ''; position: absolute; width: 68px; height: 68px; border-radius: 50%; background: var(--card); }
      .ring span { position: relative; font-weight: 800; }
      .numbers { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 18px; font-size: 14px; }
      .numbers b { font-size: 18px; }
      .miss b { color: var(--accent); }
      .toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
      .legend { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--muted); }
      .dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; margin-left: 10px; }
      .dot.ok { background: var(--success); }
      .dot.no { background: var(--border); }
      .check { display: flex; align-items: center; gap: 8px; font-size: 13px; }
      .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 14px; }
      .cell { overflow: hidden; transition: transform 0.1s, border-color 0.1s; }
      .cell:hover { transform: translateY(-3px); border-color: var(--primary); }
      .cell.missing { opacity: 0.55; }
      .cell.missing:hover { opacity: 1; }
      .img { position: relative; aspect-ratio: 63/88; background: var(--bg-soft); display: grid; place-items: center; }
      .img img { width: 100%; height: 100%; object-fit: contain; }
      .cell.missing img { filter: grayscale(1); }
      .noimg { color: var(--muted); font-weight: 700; }
      .flag { position: absolute; bottom: 8px; left: 8px; background: rgba(0,0,0,0.7); color: var(--accent); font-size: 11px; font-weight: 700; padding: 2px 7px; border-radius: 5px; }
      .meta { padding: 8px 10px; }
      .n { font-size: 11px; color: var(--muted); }
      .nm { font-weight: 700; font-size: 13px; line-height: 1.2; }
      .pr { font-weight: 800; color: var(--accent); font-size: 13px; margin-top: 3px; }
    `,
  ],
})
export class SetDetailPage {
  private catalog = inject(CatalogService);
  i18n = inject(I18nService);

  id = input.required<string>();
  set = signal<SetDetail | null>(null);
  onlyMissing = signal(false);

  visibleCards = computed(() => {
    const s = this.set();
    if (!s) return [];
    return this.onlyMissing() ? s.cards.filter((c) => !c.inStock) : s.cards;
  });

  constructor() {
    effect(() => {
      const id = this.id();
      if (id) this.catalog.set(id).subscribe((s) => this.set.set(s));
    });
  }

  toggleMissing() {
    this.onlyMissing.update((v) => !v);
  }
}
