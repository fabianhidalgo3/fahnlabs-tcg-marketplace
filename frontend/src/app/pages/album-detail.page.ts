import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { StorageLocationService } from '../core/services/storage-location.service';
import { CollectionService } from '../core/services/collection.service';
import { CardLangService } from '../core/services/card-lang.service';
import { I18nService } from '../core/services/i18n.service';
import { CurrencyService } from '../core/services/currency.service';
import { CardLang, ChecklistSet, StorageDetail, VariantView } from '../core/models/models';
import { thumbUrl } from '../core/utils/card-image';
import { SetChipComponent } from '../shared/set-chip.component';

interface BinderSlot { key: string; card: ChecklistSet['cards'][number]; v: VariantView; }

/**
 * Detalle de álbum. Si está vinculado a un set funciona como BINDER:
 * el set completo con check "la tengo / no la tengo" (al marcar, la carta
 * se agrega a la colección y el backend la ubica sola en este álbum).
 * Sin cantidades aquí — eso vive en el checklist del set.
 */
@Component({
  standalone: true,
  imports: [CommonModule, RouterLink, SetChipComponent],
  template: `
    @if (data(); as a) {
      <a routerLink="/almacenamiento" class="back muted"><span class="mi">arrow_back</span>{{ i18n.isES() ? 'Álbumes y cajas' : 'Binders & boxes' }}</a>

      <div class="header card-surface">
        <div class="top">
          <div>
            <h1>{{ a.name }}</h1>
            <p class="muted sub">
              {{ a.cards.length }} {{ i18n.isES() ? 'cartas guardadas' : 'stored cards' }} ·
              {{ i18n.isES() ? 'valor' : 'value' }} <b class="val">{{ cur.format(a.totalValue) }}</b>
              @if (a.set) {
                <app-set-chip [set]="a.set" [link]="['/coleccion', a.set.id]" />
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
        @if (a.setProgress; as p) {
          <div class="pbar"><div class="fill" [style.width.%]="p.percent"></div></div>
          <div class="muted mini">{{ i18n.isES() ? 'faltan' : 'missing' }} {{ p.missing }} {{ i18n.isES() ? 'de este set' : 'of this set' }}</div>
        }
      </div>

      @if (a.set) {
        <!-- BINDER: set completo, marcar tengo/no tengo -->
        <div class="binderbar">
          <h3 class="sec">{{ i18n.isES() ? 'Set completo — marca las que están' : 'Full set — check what is here' }}</h3>
          <div class="binderctl">
            <button class="btn btn-outline btn-s" type="button" [disabled]="pdfBusy()" (click)="exportMissingPdf(a)"
              [title]="i18n.isES() ? 'PDF con las faltantes a tamaño real (63×88mm) para imprimir y poner en el álbum' : 'Printable missing-cards PDF at real size'">
              <span class="mi">{{ pdfBusy() ? 'progress_activity' : 'picture_as_pdf' }}</span>{{ i18n.isES() ? 'PDF faltantes' : 'Missing PDF' }}
            </button>
            <span class="seg">
              <button type="button" [class.on]="layout() === 'grid'" (click)="layout.set('grid')" title="Grid"><span class="mi">grid_view</span></button>
              <button type="button" [class.on]="layout() === 'list'" (click)="layout.set('list')" title="Tabla"><span class="mi">table_rows</span></button>
            </span>
            <label class="onlymiss muted">
              <input type="checkbox" class="ui-check" [checked]="onlyMissing()" (change)="onlyMissing.set(!onlyMissing())" />
              {{ i18n.isES() ? 'Solo faltantes' : 'Missing only' }}
            </label>
            <label class="langsel muted">
              {{ i18n.isES() ? 'Idioma cartas' : 'Card language' }}
              <select class="ui-select mini" [value]="cardLang.lang()" (change)="setCardLang($event)">
                <option value="EN">EN</option>
                <option value="ES">ES</option>
              </select>
            </label>
          </div>
        </div>
        @if (!binder()) {
          <p class="muted">{{ i18n.t('catalog.loading') }}</p>
        } @else if (layout() === 'list') {
          <div class="tablewrap card-surface">
            <table class="ltable">
              <thead><tr><th></th><th>#</th><th>{{ i18n.isES() ? 'Carta' : 'Card' }}</th><th>{{ i18n.isES() ? 'Variante' : 'Variant' }}</th><th class="r">{{ i18n.isES() ? 'Valor' : 'Value' }}</th><th class="c">{{ i18n.isES() ? 'Estado' : 'Status' }}</th></tr></thead>
              <tbody>
                @for (s of visibleSlots(); track s.key) {
                  <tr [class.dimrow]="owned(s.v) === 0">
                    <td>@if (s.card.imageUrl) { <img class="lthumb" [src]="thumb(s.card.imageUrl)" [alt]="s.card.name" loading="lazy" [routerLink]="['/cartas', s.card.id]" style="cursor:pointer" /> }</td>
                    <td class="muted mono">{{ s.card.number }}</td>
                    <td><b>{{ s.card.name }}</b></td>
                    <td><span class="vtag" [class.rev]="s.v.variant !== 'Normal'">{{ s.v.variant }}</span></td>
                    <td class="r">{{ cur.format(s.v.value) }}</td>
                    <td class="c">
                      <button class="checkbtn inrow" type="button" [class.on]="owned(s.v) > 0" [disabled]="busy() === s.key" (click)="toggle(s)">
                        <span class="mi">{{ owned(s.v) > 0 ? 'check_circle' : 'radio_button_unchecked' }}</span>
                        {{ owned(s.v) > 0 ? (i18n.isES() ? 'La tengo' : 'Got it') : (i18n.isES() ? 'Me falta' : 'Missing') }}
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <div class="card-grid">
            @for (s of visibleSlots(); track s.key) {
              <div class="cell card-surface" [class.have]="owned(s.v) > 0" [class.miss]="owned(s.v) === 0">
                <div class="img" [class.reverse]="s.v.variant === 'Reverse Holo'" [routerLink]="['/cartas', s.card.id]">
                  @if (s.card.imageUrl) { <img [src]="thumb(s.card.imageUrl)" [alt]="s.card.name" loading="lazy" decoding="async" /> }
                  @else { <div class="noimg">{{ s.card.number }}</div> }
                  <span class="vbadge" [class.rev]="s.v.variant !== 'Normal'">{{ s.v.variant }}</span>
                </div>
                <button
                  class="checkbtn"
                  type="button"
                  [class.on]="owned(s.v) > 0"
                  [disabled]="busy() === s.key"
                  (click)="toggle(s)"
                >
                  <span class="mi">{{ owned(s.v) > 0 ? 'check_circle' : 'radio_button_unchecked' }}</span>
                  {{ owned(s.v) > 0 ? (i18n.isES() ? 'La tengo' : 'Got it') : (i18n.isES() ? 'Me falta' : 'Missing') }}
                </button>
                <div class="meta">
                  <div class="n muted">{{ s.card.number }}</div>
                  <div class="nm">{{ s.card.name }}</div>
                  <div class="v">{{ cur.format(s.v.value) }}</div>
                </div>
              </div>
            }
          </div>
        }
      } @else if (a.cards.length) {
        <!-- Caja sin set: solo lo guardado -->
        <h3 class="sec">{{ i18n.isES() ? 'Cartas guardadas' : 'Stored cards' }} <span class="muted">({{ a.cards.length }})</span></h3>
        <div class="card-grid">
          @for (c of a.cards; track c.cardId + c.variant + c.language) {
            <div class="cell card-surface">
              <div class="img" [class.reverse]="c.variant === 'Reverse Holo'" [routerLink]="['/cartas', c.cardId]">
                @if (c.imageUrl) { <img [src]="thumb(c.imageUrl)" [alt]="c.name" loading="lazy" decoding="async" /> }
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
          }
        </div>
      } @else {
        <p class="muted empty">{{ i18n.isES() ? 'Esta caja aún no tiene cartas.' : 'This box has no cards yet.' }}</p>
      }

      @if (a.set && a.extras.length) {
        <h3 class="sec">{{ i18n.isES() ? 'Extras (promos, otros sets…)' : 'Extras (promos, other sets…)' }} <span class="muted">({{ a.extras.length }})</span></h3>
        <div class="card-grid">
          @for (c of a.extras; track c.cardId + c.variant + c.language) {
            <div class="cell card-surface">
              <div class="img" [class.reverse]="c.variant === 'Reverse Holo'" [routerLink]="['/cartas', c.cardId]">
                @if (c.imageUrl) { <img [src]="thumb(c.imageUrl)" [alt]="c.name" loading="lazy" decoding="async" /> }
                @else { <div class="noimg">{{ c.number }}</div> }
                <span class="langbadge">{{ c.language }}</span>
              </div>
              <div class="meta">
                <div class="n muted">{{ c.number }} · {{ c.variant }}</div>
                <div class="nm">{{ c.name }}</div>
                <div class="v">{{ cur.format(c.lineValue) }}</div>
              </div>
            </div>
          }
        </div>
      }
    } @else {
      <p class="muted">{{ i18n.t('catalog.loading') }}</p>
    }
  `,
  styles: [
    `
      .back { display: inline-flex; align-items: center; gap: 4px; margin-bottom: 12px; font-weight: 600; }
      .header { padding: 20px; margin-bottom: 20px; }
      .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; }
      h1 { font-size: 26px; }
      .val { color: var(--accent); }
      .sub { display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; }
      .progress { text-align: right; }
      .pct { font-weight: 800; font-size: 24px; color: var(--primary); }
      .pbar { margin-top: 14px; }
      .mini { font-size: 12px; margin-top: 6px; }
      .binderbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin: 22px 0 12px; }
      .binderctl { display: inline-flex; align-items: center; gap: 18px; flex-wrap: wrap; }
      .onlymiss { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer; }
      .langsel { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; }
      .ui-select.mini { width: 72px; padding: 5px 26px 5px 10px; font-size: 12px; }
      .sec { margin: 0; font-size: 16px; }
      .cell { overflow: hidden; transition: opacity 0.15s ease; }
      .cell.miss .img img { filter: grayscale(1) opacity(0.55); }
      .img { position: relative; aspect-ratio: 63/88; background: var(--bg-soft); display: grid; place-items: center; cursor: pointer; }
      .img img { width: 100%; height: 100%; object-fit: contain; transition: filter 0.2s ease; }
      .noimg { color: var(--muted); font-weight: 700; }
      .vbadge { position: absolute; bottom: 6px; left: 6px; background: rgba(0,0,0,0.7); color: #fff; font-size: 10px; font-weight: 700; padding: 1px 7px; border-radius: 5px; }
      .vbadge.rev { background: linear-gradient(90deg, #7c3aed, #2563eb); }
      .langbadge { position: absolute; bottom: 6px; right: 6px; background: rgba(0,0,0,0.7); color: #fff; font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 5px; }
      .tablewrap { overflow-x: auto; margin-top: 10px; }
      .dimrow td { opacity: 0.55; }
      .checkbtn.inrow { margin: 0 auto; }
      .checkbtn {
        display: flex; align-items: center; justify-content: center; gap: 6px;
        width: 100%; border: none; border-top: 1px solid var(--border);
        background: var(--card-2); color: var(--muted);
        font: inherit; font-size: 12px; font-weight: 700; padding: 7px 4px; cursor: pointer;
        transition: background 0.15s ease, color 0.15s ease;
      }
      .checkbtn .mi { font-size: 16px; }
      .checkbtn:hover { color: var(--text); }
      .checkbtn.on { background: color-mix(in srgb, var(--success) 16%, transparent); color: var(--success); }
      .checkbtn:disabled { opacity: 0.5; cursor: wait; }
      .meta { padding: 8px 10px 10px; }
      .n { font-size: 11px; }
      .nm { font-weight: 700; font-size: 13px; line-height: 1.2; }
      .v { color: var(--accent); font-weight: 700; font-size: 13px; margin-top: 3px; }
      .empty { margin-top: 20px; }
    `,
  ],
})
export class AlbumDetailPage {
  layout = signal<'grid' | 'list'>('grid');
  thumb = thumbUrl;
  private storage = inject(StorageLocationService);
  private collection = inject(CollectionService);
  cardLang = inject(CardLangService);
  i18n = inject(I18nService);
  cur = inject(CurrencyService);

  id = input.required<string>();
  data = signal<StorageDetail | null>(null);
  binder = signal<ChecklistSet | null>(null);
  onlyMissing = signal(false);
  pdfBusy = signal(false);
  /** PDF imprimible de las faltantes del set vinculado a este álbum. */
  exportMissingPdf(a: any) {
    if (!a?.set?.id) return;
    this.pdfBusy.set(true);
    this.collection.exportMissingPdf(a.set.id).subscribe({
      next: (b) => {
        const slug = (a.set.name ?? 'set').toLowerCase().replace(/[^a-z0-9]+/gi, '-');
        this.collection.downloadBlob(b, `faltantes-${slug}.pdf`);
        this.pdfBusy.set(false);
      },
      error: () => this.pdfBusy.set(false),
    });
  }

  busy = signal<string | null>(null);

  constructor() {
    effect(() => {
      const id = this.id();
      if (!id) return;
      this.storage.get(id).subscribe((d) => {
        this.data.set(d);
        if (d.set) this.collection.checklist(d.set.id).subscribe((c) => this.binder.set(c));
      });
    });
  }

  private slots = computed<BinderSlot[]>(() => {
    const set = this.binder();
    if (!set) return [];
    const out: BinderSlot[] = [];
    for (const card of set.cards) for (const v of card.variants) out.push({ key: `${card.id}|${v.variant}`, card, v });
    return out;
  });
  visibleSlots = computed<BinderSlot[]>(() =>
    this.onlyMissing() ? this.slots().filter((s) => this.owned(s.v) === 0) : this.slots(),
  );

  owned(v: VariantView): number { return v.owned.EN + v.owned.ES; }

  setCardLang(ev: Event) {
    this.cardLang.set((ev.target as HTMLSelectElement).value as CardLang);
  }

  /** Marca/desmarca binario: al marcar se agrega 1 (el backend la ubica en este álbum). */
  toggle(s: BinderSlot) {
    this.busy.set(s.key);
    if (this.owned(s.v) === 0) {
      const lang: CardLang = this.cardLang.lang();
      this.collection.adjust(s.card.id, s.v.variant, lang, 1).subscribe({
        next: () => { s.v.owned[lang] = 1; this.afterToggle(); },
        error: () => this.busy.set(null),
      });
    } else {
      // Desmarcar = ya no está: deja en 0 todos los idiomas con copias.
      // Guardia: con más de 1 copia se pierde el conteo — confirmar antes.
      const total = this.owned(s.v);
      if (total > 1) {
        const msg = this.i18n.isES()
          ? `Tienes ${total} copias de ${s.card.name} (${s.v.variant}). Al desmarcar se quitan TODAS de tu colección. ¿Continuar?`
          : `You own ${total} copies of ${s.card.name} (${s.v.variant}). Unchecking removes ALL of them. Continue?`;
        if (!confirm(msg)) { this.busy.set(null); return; }
      }
      const calls = (['EN', 'ES'] as CardLang[])
        .filter((l) => s.v.owned[l] > 0)
        .map((l) => this.collection.setQuantity(s.card.id, s.v.variant, l, 0));
      forkJoin(calls).subscribe({
        next: () => { s.v.owned.EN = 0; s.v.owned.ES = 0; this.afterToggle(); },
        error: () => this.busy.set(null),
      });
    }
  }

  private afterToggle() {
    // refresca binder (signal inmutable) y el header del álbum (progreso/valor)
    const b = this.binder();
    if (b) this.binder.set({ ...b });
    this.storage.get(this.id()).subscribe((d) => { this.data.set(d); this.busy.set(null); });
  }
}
