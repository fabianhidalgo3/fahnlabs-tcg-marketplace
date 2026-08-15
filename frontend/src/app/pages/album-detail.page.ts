import { Component, effect, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TuiButton } from '@taiga-ui/core';
import { TuiProgress } from '@taiga-ui/kit';
import { StorageLocationService } from '../core/services/storage-location.service';
import { I18nService } from '../core/services/i18n.service';
import { CurrencyService } from '../core/services/currency.service';
import { StorageDetail, StoredCard } from '../core/models/models';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink, TuiButton, TuiProgress],
  template: `
    @if (data(); as a) {
      <a routerLink="/almacenamiento" class="back muted"><span class="mi">arrow_back</span>{{ i18n.isES() ? 'Almacenamiento' : 'Storage' }}</a>

      <div class="header card-surface">
        <div class="top">
          <div>
            <h1>{{ a.name }}</h1>
            <p class="muted">
              {{ a.cards.length }} {{ i18n.isES() ? 'cartas guardadas' : 'stored cards' }} ·
              {{ i18n.isES() ? 'valor' : 'value' }} <b class="val">{{ cur.format(a.totalValue) }}</b>
              @if (a.set) {
                · {{ i18n.isES() ? 'álbum del set' : 'album for set' }}
                <a class="setlink" [routerLink]="['/coleccion', a.set.id]">{{ a.set.name }}</a>
              }
            </p>
          </div>
          @if (a.setProgress; as p) {
            <div class="progress">
              <div class="pct">{{ p.percent }}%</div>
              <div class="muted">{{ p.inAlbumSlots }}/{{ p.totalSlots }} {{ i18n.isES() ? 'del set aquí' : 'of set here' }}</div>
            </div>
          }
        </div>
        @if (a.set) {
          <button tuiButton type="button" appearance="secondary" size="s" class="fill" [disabled]="filling()" (click)="fill()">
            <span class="mi">library_add</span>
            {{ filling() ? (i18n.isES() ? 'Agregando…' : 'Adding…') : (i18n.isES() ? 'Agregar las que tengo del set aquí' : 'Add my owned cards of this set') }}
          </button>
        }
        @if (a.setProgress; as p) {
          <progress tuiProgressBar max="100" [value]="p.percent"></progress>
          <div class="muted mini">{{ i18n.isES() ? 'faltan' : 'missing' }} {{ p.missing }} {{ i18n.isES() ? 'de este set' : 'of this set' }}</div>
        }
      </div>

      @if (a.set && a.fromSet.length) {
        <h3 class="sec">{{ i18n.isES() ? 'Del set' : 'From the set' }} <span class="muted">({{ a.fromSet.length }})</span></h3>
        <div class="grid">@for (c of a.fromSet; track c.cardId + c.variant + c.language) { <ng-container [ngTemplateOutlet]="cell" [ngTemplateOutletContext]="{ c }"></ng-container> }</div>
      }

      @if (a.extras.length) {
        <h3 class="sec">{{ i18n.isES() ? 'Extras (promos, otros sets…)' : 'Extras (promos, other sets…)' }} <span class="muted">({{ a.extras.length }})</span></h3>
        <div class="grid">@for (c of a.extras; track c.cardId + c.variant + c.language) { <ng-container [ngTemplateOutlet]="cell" [ngTemplateOutletContext]="{ c }"></ng-container> }</div>
      }

      @if (!a.cards.length) {
        <p class="muted empty">{{ i18n.isES() ? 'Este álbum aún no tiene cartas. Asígnalas desde el checklist de la colección.' : 'This album has no cards yet. Assign them from the collection checklist.' }}</p>
      }
    } @else {
      <p class="muted">{{ i18n.t('catalog.loading') }}</p>
    }

    <ng-template #cell let-c="c">
      <div class="cell card-surface">
        <div class="img">
          @if (c.imageUrl) { <img [src]="c.imageUrl" [alt]="c.name" loading="lazy" /> }
          @else { <div class="noimg">{{ c.number }}</div> }
          @if (c.quantity > 1) { <span class="qtybadge">×{{ c.quantity }}</span> }
          <span class="langbadge">{{ c.language }}</span>
        </div>
        <div class="meta">
          <div class="n muted">{{ c.number }} · {{ c.variant }}</div>
          <div class="nm">{{ c.name }}</div>
          <div class="v">{{ cur.format(c.lineValue) }}</div>
        </div>
      </div>
    </ng-template>
  `,
  styles: [
    `
      .back { display: inline-flex; align-items: center; gap: 4px; margin-bottom: 12px; font-weight: 600; }
      .header { padding: 20px; margin-bottom: 20px; }
      .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; }
      h1 { font-size: 26px; }
      .val { color: var(--accent); }
      .setlink { color: var(--primary); font-weight: 600; }
      .progress { text-align: right; }
      .pct { font-weight: 800; font-size: 24px; color: var(--primary); }
      progress[tuiProgressBar] { margin-top: 14px; display: block; inline-size: 100%; }
      .mini { font-size: 12px; margin-top: 6px; }
      .fill { margin-top: 14px; }
      .sec { margin: 22px 0 12px; font-size: 16px; }
      .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 14px; }
      .cell { overflow: hidden; }
      .img { position: relative; aspect-ratio: 63/88; background: var(--bg-soft); display: grid; place-items: center; }
      .img img { width: 100%; height: 100%; object-fit: contain; }
      .noimg { color: var(--muted); font-weight: 700; }
      .qtybadge { position: absolute; top: 6px; right: 6px; background: var(--primary); color: #fff; font-size: 11px; font-weight: 700; padding: 1px 7px; border-radius: 999px; }
      .langbadge { position: absolute; bottom: 6px; left: 6px; background: rgba(0,0,0,0.7); color: #fff; font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 5px; }
      .meta { padding: 8px 10px 10px; }
      .n { font-size: 11px; }
      .nm { font-weight: 700; font-size: 13px; line-height: 1.2; }
      .v { color: var(--accent); font-weight: 700; font-size: 13px; margin-top: 3px; }
      .empty { margin-top: 20px; }
    `,
  ],
})
export class AlbumDetailPage {
  private storage = inject(StorageLocationService);
  i18n = inject(I18nService);
  cur = inject(CurrencyService);

  id = input.required<string>();
  data = signal<StorageDetail | null>(null);
  filling = signal(false);

  constructor() {
    effect(() => {
      const id = this.id();
      if (id) this.storage.get(id).subscribe((d) => this.data.set(d));
    });
  }

  fill() {
    this.filling.set(true);
    this.storage.fill(this.id()).subscribe({
      next: () => this.storage.get(this.id()).subscribe((d) => { this.data.set(d); this.filling.set(false); }),
      error: () => this.filling.set(false),
    });
  }
}
