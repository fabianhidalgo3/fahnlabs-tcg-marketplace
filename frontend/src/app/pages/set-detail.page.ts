import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CatalogService } from '../core/services/catalog.service';
import { I18nService } from '../core/services/i18n.service';
import { SetDetail } from '../core/models/models';
import { setLogoUrl, thumbUrl } from '../core/utils/card-image';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    @if (set(); as s) {
      <a routerLink="/sets" class="back muted">← {{ i18n.t('setd.allSets') }}</a>

      <div class="header panel">
        <div class="ident">
          @if (logo(s.symbolUrl)) {
            <img class="setlogo" [src]="logo(s.symbolUrl)" [alt]="s.name" (error)="logoBroken.set(true)" [hidden]="logoBroken()" />
          } @else if (s.symbolUrl) { <img class="symbol" [src]="s.symbolUrl" [alt]="s.name" /> }
          <div>
            <h1>{{ s.name }}</h1>
            <p class="muted">{{ s.series }} · {{ s.code }} · {{ i18n.t('common.released') }} {{ s.releaseDate }}</p>
          </div>
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
        <div class="seg t-right">
          <button type="button" [class.on]="layout() === 'grid'" (click)="layout.set('grid')" title="Grid"><span class="mi">grid_view</span></button>
          <button type="button" [class.on]="layout() === 'list'" (click)="layout.set('list')" title="Tabla"><span class="mi">table_rows</span></button>
        </div>
      </div>

      @if (layout() === 'list') {
      <div class="tablewrap card-surface">
        <table class="ltable">
          <thead><tr><th></th><th>#</th><th>{{ i18n.isES() ? 'Carta' : 'Card' }}</th><th>{{ i18n.isES() ? 'Rareza' : 'Rarity' }}</th><th class="r">{{ i18n.isES() ? 'Desde' : 'From' }}</th><th class="c">Stock</th></tr></thead>
          <tbody>
            @for (c of visibleCards(); track c.id) {
              <tr [routerLink]="['/cartas', c.id]" [class.dimrow]="!c.inStock">
                <td>@if (c.imageUrl) { <img class="lthumb" [src]="thumb(c.imageUrl)" [alt]="c.name" loading="lazy" /> }</td>
                <td class="muted mono">{{ c.number }}</td>
                <td><b>{{ c.name }}</b></td>
                <td class="muted">{{ c.rarity }}</td>
                <td class="r">@if (c.inStock) { <b class="pr">\${{ c.minPrice?.toFixed(2) }}</b> } @else { <span class="muted">—</span> }</td>
                <td class="c">{{ c.totalStock ?? 0 }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      } @else {
      <div class="grid">
        @for (c of visibleCards(); track c.id) {
          <a
            class="cell panel"
            [class.missing]="!c.inStock"
            [routerLink]="['/cartas', c.id]"
          >
            <div class="img">
              @if (c.imageUrl) {
                <img [src]="thumb(c.imageUrl)" [alt]="c.name" loading="lazy" decoding="async" />
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
      }
    } @else {
      <p class="muted">Cargando…</p>
    }
  `,
  styles: [
    `
      .back { display: inline-block; margin-bottom: 16px; font-weight: 600; }
      .header { display: flex; justify-content: space-between; align-items: center; gap: 20px; padding: 22px; margin-bottom: 20px; flex-wrap: wrap; }
      .ident { display: flex; align-items: center; gap: 16px; }
      .symbol { width: 56px; height: 56px; object-fit: contain; flex: 0 0 56px; }
      .setlogo { max-height: 64px; max-width: 230px; object-fit: contain; }
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
      .tablewrap { overflow-x: auto; }
      .ltable tbody tr { cursor: pointer; }
      .dimrow td { opacity: 0.55; }
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
  layout = signal<'grid' | 'list'>('grid');
  logo = setLogoUrl;
  logoBroken = signal(false);
  thumb = thumbUrl;
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
