import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CollectionService } from '../core/services/collection.service';
import { StorageLocationService } from '../core/services/storage-location.service';
import { I18nService } from '../core/services/i18n.service';
import { CurrencyService } from '../core/services/currency.service';
import { CardLang, ChecklistSet, StorageLocation, VariantView } from '../core/models/models';

type Mode = 'all' | 'missing' | 'owned';
const VARIANT_ABBR: Record<string, string> = {
  Normal: 'Normal', 'Reverse Holo': 'Reverse', 'Poké Ball': 'Poké Ball', 'Master Ball': 'Master Ball', Holo: 'Holo',
};
interface Slot { key: string; card: ChecklistSet['cards'][number]; v: VariantView; }
interface PendingChange { cardModelId: string; variant: string; language: CardLang; quantity: number; qtyDirty: boolean; storageId: string | null; storageDirty: boolean; }

@Component({
  standalone: true,
  imports: [
    CommonModule, RouterLink, FormsModule, MatCardModule, MatButtonModule, MatIconModule,
    MatButtonToggleModule, MatTableModule, MatFormFieldModule, MatSelectModule, MatProgressSpinnerModule,
  ],
  template: `
    @if (data(); as set) {
      <a mat-button routerLink="/coleccion" class="back"><mat-icon>arrow_back</mat-icon>{{ i18n.t('nav.collection') }}</a>

      <mat-card class="header" appearance="outlined">
        <div>
          <h1>{{ set.name }}</h1>
          <p class="muted">
            {{ set.series }} · {{ set.code }} · {{ set.cards.length }} {{ i18n.isES() ? 'cartas' : 'cards' }} ·
            <b>{{ stats()?.total }}</b> {{ i18n.isES() ? 'coleccionables' : 'collectibles' }}
          </p>
        </div>
        @if (stats(); as st) {
          <div class="summary">
            <div class="ring" [style.--p]="st.pct"><span>{{ st.pct }}%</span></div>
            <div class="numbers">
              <div><span class="muted">{{ i18n.t('collection.owned') }}</span><b>{{ st.owned }}/{{ st.total }}</b></div>
              <div><span class="muted">{{ i18n.t('collection.missing') }}</span><b class="miss">{{ st.missing }}</b></div>
              <div><span class="muted">{{ i18n.t('collection.duplicates') }}</span><b>{{ st.dupes }}</b></div>
              <div><span class="muted">{{ i18n.t('collection.collectionValue') }}</span><b class="val">{{ cur.format(st.value) }}</b></div>
              <div><span class="muted">{{ i18n.t('collection.setValue') }}</span><b>{{ cur.format(st.setValue) }}</b></div>
              <div class="both muted">EN {{ st.pctEN }}% · ES {{ st.pctES }}%</div>
            </div>
          </div>
        }
      </mat-card>

      <div class="toolbar">
        <mat-button-toggle-group [value]="mode()" (change)="mode.set($event.value)" hideSingleSelectionIndicator>
          <mat-button-toggle value="all">{{ i18n.isES() ? 'Set completo' : 'Full set' }}</mat-button-toggle>
          <mat-button-toggle value="missing">{{ i18n.isES() ? 'Faltantes' : 'Missing' }}</mat-button-toggle>
          <mat-button-toggle value="owned">{{ i18n.isES() ? 'Las que tengo' : 'Owned' }}</mat-button-toggle>
        </mat-button-toggle-group>
        <mat-button-toggle-group [value]="lang()" (change)="lang.set($event.value)" hideSingleSelectionIndicator>
          <mat-button-toggle value="EN">🇬🇧 EN</mat-button-toggle>
          <mat-button-toggle value="ES">🇪🇸 ES</mat-button-toggle>
        </mat-button-toggle-group>
        <mat-button-toggle-group [value]="view()" (change)="view.set($event.value)" hideSingleSelectionIndicator>
          <mat-button-toggle value="grid"><mat-icon>grid_view</mat-icon></mat-button-toggle>
          <mat-button-toggle value="table"><mat-icon>table_rows</mat-icon></mat-button-toggle>
        </mat-button-toggle-group>
      </div>

      @if (view() === 'grid') {
        <div class="grid">
          @for (slot of visibleSlots(); track slot.key) {
            <mat-card class="cell" appearance="outlined" [class.dim]="owned(slot.v) === 0">
              <div class="img">
                @if (slot.card.imageUrl) { <img [src]="slot.card.imageUrl" [alt]="slot.card.name" loading="lazy" /> }
                @else { <div class="noimg">{{ slot.card.number }}</div> }
                <span class="vbadge" [class.rev]="slot.v.variant !== 'Normal'">{{ abbr(slot.v.variant) }}</span>
                @if (owned(slot.v) > 0) { <mat-icon class="check">check_circle</mat-icon> }
              </div>
              <div class="meta">
                <div class="n muted">{{ slot.card.number }} · {{ abbr(slot.v.variant) }}</div>
                <div class="nm">{{ slot.card.name }}</div>
                <div class="vval muted">{{ cur.format(slot.v.value) }} {{ i18n.isES() ? 'c/u' : 'ea' }}</div>
              </div>
              <div class="ctrlrow">
                <button mat-icon-button [disabled]="owned(slot.v) === 0" (click)="adjust(slot.card.id, slot.v, -1)"><mat-icon>remove</mat-icon></button>
                <span class="qty" [class.zero]="owned(slot.v) === 0">{{ owned(slot.v) }}</span>
                <button mat-icon-button (click)="adjust(slot.card.id, slot.v, 1)"><mat-icon>add</mat-icon></button>
              </div>
              @if (owned(slot.v) > 1) {
                <div class="linetotal muted">{{ owned(slot.v) }} × = <b>{{ cur.format(slot.v.value * owned(slot.v)) }}</b></div>
              }
              @if (owned(slot.v) > 0) {
                <mat-form-field appearance="fill" class="store" subscriptSizing="dynamic">
                  <mat-select [ngModel]="storageId(slot.v)" (ngModelChange)="assignStorage(slot.card.id, slot.v, $event)"
                    [placeholder]="i18n.isES() ? 'Sin ubicación' : 'No location'">
                    <mat-option [value]="''">{{ i18n.isES() ? 'Sin ubicación' : 'No location' }}</mat-option>
                    @for (s of storages(); track s.id) { <mat-option [value]="s.id">{{ s.name }}</mat-option> }
                  </mat-select>
                </mat-form-field>
              }
            </mat-card>
          }
        </div>
      }

      @if (view() === 'table') {
        <mat-card class="tablewrap" appearance="outlined">
          <table mat-table [dataSource]="visibleSlots()">
            <ng-container matColumnDef="img">
              <th mat-header-cell *matHeaderCellDef></th>
              <td mat-cell *matCellDef="let s">@if (s.card.imageUrl) { <img class="thumb" [src]="s.card.imageUrl" [alt]="s.card.name" loading="lazy" /> }</td>
            </ng-container>
            <ng-container matColumnDef="num">
              <th mat-header-cell *matHeaderCellDef>#</th>
              <td mat-cell *matCellDef="let s" class="mono muted">{{ s.card.number }}</td>
            </ng-container>
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>{{ i18n.isES() ? 'Carta' : 'Card' }}</th>
              <td mat-cell *matCellDef="let s"><b>{{ s.card.name }}</b> <span class="tag" [class.rev]="s.v.variant !== 'Normal'">{{ abbr(s.v.variant) }}</span></td>
            </ng-container>
            <ng-container matColumnDef="rarity">
              <th mat-header-cell *matHeaderCellDef>{{ i18n.isES() ? 'Rareza' : 'Rarity' }}</th>
              <td mat-cell *matCellDef="let s" class="muted">{{ s.card.rarity }}</td>
            </ng-container>
            <ng-container matColumnDef="unit">
              <th mat-header-cell *matHeaderCellDef class="r">{{ i18n.isES() ? 'Valor u.' : 'Unit' }}</th>
              <td mat-cell *matCellDef="let s" class="r muted">{{ cur.format(s.v.value) }}</td>
            </ng-container>
            <ng-container matColumnDef="qty">
              <th mat-header-cell *matHeaderCellDef class="c">{{ i18n.isES() ? 'Cant.' : 'Qty' }}</th>
              <td mat-cell *matCellDef="let s" class="c">
                <div class="ctrlrow">
                  <button mat-icon-button [disabled]="owned(s.v) === 0" (click)="adjust(s.card.id, s.v, -1)"><mat-icon>remove</mat-icon></button>
                  <span class="qty" [class.zero]="owned(s.v) === 0">{{ owned(s.v) }}</span>
                  <button mat-icon-button (click)="adjust(s.card.id, s.v, 1)"><mat-icon>add</mat-icon></button>
                </div>
              </td>
            </ng-container>
            <ng-container matColumnDef="total">
              <th mat-header-cell *matHeaderCellDef class="r">Total</th>
              <td mat-cell *matCellDef="let s" class="r"><b class="val">{{ owned(s.v) > 0 ? cur.format(s.v.value * owned(s.v)) : '—' }}</b></td>
            </ng-container>
            <ng-container matColumnDef="storage">
              <th mat-header-cell *matHeaderCellDef>{{ i18n.isES() ? 'Ubicación' : 'Location' }}</th>
              <td mat-cell *matCellDef="let s">
                @if (owned(s.v) > 0) {
                  <mat-form-field appearance="fill" class="store" subscriptSizing="dynamic">
                    <mat-select [ngModel]="storageId(s.v)" (ngModelChange)="assignStorage(s.card.id, s.v, $event)">
                      <mat-option [value]="''">{{ i18n.isES() ? 'Sin ubicación' : 'None' }}</mat-option>
                      @for (loc of storages(); track loc.id) { <mat-option [value]="loc.id">{{ loc.name }}</mat-option> }
                    </mat-select>
                  </mat-form-field>
                } @else { <span class="muted">—</span> }
              </td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="cols"></tr>
            <tr mat-row *matRowDef="let row; columns: cols" [class.dim]="owned(row.v) === 0"></tr>
          </table>
        </mat-card>
      }

      @if (pendingCount() > 0) {
        <mat-card class="savebar" appearance="raised">
          <span class="pc">{{ pendingCount() }} {{ i18n.isES() ? (pendingCount() === 1 ? 'cambio sin guardar' : 'cambios sin guardar') : (pendingCount() === 1 ? 'unsaved change' : 'unsaved changes') }}</span>
          <button mat-button [disabled]="saving()" (click)="discard()">{{ i18n.isES() ? 'Descartar' : 'Discard' }}</button>
          <button mat-flat-button [disabled]="saving()" (click)="save()"><mat-icon>save</mat-icon>{{ saving() ? (i18n.isES() ? 'Guardando…' : 'Saving…') : (i18n.isES() ? 'Guardar' : 'Save') }}</button>
        </mat-card>
      }
    } @else {
      <div class="loading"><mat-spinner diameter="36"></mat-spinner></div>
    }
  `,
  styles: [
    `
      .back { margin-bottom: 12px; }
      .header { display: flex; justify-content: space-between; align-items: center; gap: 20px; padding: 22px; margin-bottom: 18px; flex-wrap: wrap; }
      h1 { font-size: 28px; }
      .summary { display: flex; align-items: center; gap: 22px; }
      .ring { --p: 0; width: 92px; height: 92px; border-radius: 50%; background: conic-gradient(var(--primary) calc(var(--p) * 1%), var(--bg-soft) 0); display: grid; place-items: center; position: relative; }
      .ring::before { content: ''; position: absolute; width: 68px; height: 68px; border-radius: 50%; background: var(--card); }
      .ring span { position: relative; font-weight: 800; }
      .numbers { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; font-size: 13px; }
      .numbers > div { display: flex; flex-direction: column; }
      .numbers b { font-size: 16px; }
      .miss { color: var(--accent); } .val { color: var(--accent); }
      .both { grid-column: 1 / -1; font-size: 12px; }
      .toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 10px; }
      .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 16px; }
      .cell { padding: 0; overflow: hidden; }
      .cell.dim { opacity: 0.6; }
      .cell.dim .img img { filter: grayscale(0.9); }
      .img { position: relative; aspect-ratio: 63/88; background: var(--bg-soft); display: grid; place-items: center; }
      .img img { width: 100%; height: 100%; object-fit: contain; }
      .noimg { color: var(--muted); font-weight: 700; }
      .check { position: absolute; top: 6px; right: 6px; color: var(--success); background: var(--card); border-radius: 50%; }
      .vbadge { position: absolute; bottom: 8px; left: 8px; background: rgba(0,0,0,0.7); color: #fff; font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 5px; }
      .vbadge.rev { background: linear-gradient(90deg, var(--primary), #fbbf24); color: #1a1d33; }
      .meta { padding: 8px 10px 2px; }
      .n { font-size: 11px; } .nm { font-weight: 700; font-size: 13px; line-height: 1.2; }
      .vval { font-size: 11px; margin-top: 2px; }
      .ctrlrow { display: flex; align-items: center; justify-content: center; gap: 4px; }
      .qty { min-width: 20px; text-align: center; font-weight: 800; }
      .qty.zero { color: var(--muted); }
      .linetotal { text-align: center; font-size: 11px; padding: 0 10px 4px; } .linetotal b { color: var(--accent); }
      .store { width: calc(100% - 16px); margin: 0 8px 8px; font-size: 12px; }
      .store ::ng-deep .mat-mdc-text-field-wrapper { background: transparent; }
      .tablewrap { padding: 0; overflow-x: auto; }
      table { width: 100%; }
      .thumb { width: 34px; height: 47px; object-fit: contain; border-radius: 4px; }
      .mono { font-variant-numeric: tabular-nums; }
      .r { text-align: right; } .c { text-align: center; }
      .tag { font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 999px; background: var(--card-2); margin-left: 6px; }
      .tag.rev { background: linear-gradient(90deg, var(--primary), #fbbf24); color: #1a1d33; }
      tr.dim { opacity: 0.55; }
      .table .store { width: 150px; }
      .savebar { position: fixed; left: 50%; transform: translateX(-50%); bottom: 24px; z-index: 40; display: flex; align-items: center; gap: 12px; padding: 10px 14px 10px 20px; border-radius: 999px; }
      .savebar .pc { font-weight: 700; font-size: 14px; }
      .loading { display: grid; place-items: center; padding: 60px; }
    `,
  ],
})
export class CollectionSetPage {
  private collection = inject(CollectionService);
  private storageSvc = inject(StorageLocationService);
  i18n = inject(I18nService);
  cur = inject(CurrencyService);

  id = input.required<string>();
  data = signal<ChecklistSet | null>(null);
  storages = signal<StorageLocation[]>([]);
  lang = signal<CardLang>('EN');
  mode = signal<Mode>('all');
  view = signal<'grid' | 'table'>('grid');
  dirty = signal<Record<string, PendingChange>>({});
  saving = signal(false);
  pendingCount = computed(() => Object.keys(this.dirty()).length);
  cols = ['img', 'num', 'name', 'rarity', 'unit', 'qty', 'total', 'storage'];

  constructor() {
    this.storageSvc.list().subscribe((s) => this.storages.set(s));
    effect(() => {
      const id = this.id();
      if (id) { this.dirty.set({}); this.collection.checklist(id).subscribe((s) => this.data.set(s)); }
    });
  }

  owned(v: VariantView): number { return v.owned[this.lang()]; }
  abbr(v: string): string { return VARIANT_ABBR[v] ?? v; }
  storageId(v: VariantView): string { return v.storage[this.lang()]?.id ?? ''; }

  private slots = computed<Slot[]>(() => {
    const set = this.data();
    if (!set) return [];
    const out: Slot[] = [];
    for (const card of set.cards) for (const v of card.variants) out.push({ key: `${card.id}|${v.variant}`, card, v });
    return out;
  });
  visibleSlots = computed<Slot[]>(() => {
    const mode = this.mode(); const lang = this.lang(); const slots = this.slots();
    if (mode === 'all') return slots;
    if (mode === 'owned') return slots.filter((s) => s.v.owned[lang] > 0);
    return slots.filter((s) => s.v.owned[lang] === 0);
  });

  stats = computed(() => {
    const set = this.data();
    if (!set) return null;
    let total = 0, setValue = 0, ownEN = 0, ownES = 0, valEN = 0, valES = 0, dEN = 0, dES = 0;
    for (const c of set.cards) for (const v of c.variants) {
      total++; setValue += v.value;
      if (v.owned.EN > 0) ownEN++; if (v.owned.ES > 0) ownES++;
      valEN += v.value * v.owned.EN; valES += v.value * v.owned.ES;
      dEN += Math.max(v.owned.EN - 1, 0); dES += Math.max(v.owned.ES - 1, 0);
    }
    const lang = this.lang(); const owned = lang === 'EN' ? ownEN : ownES;
    const pct = (n: number) => (total ? Math.round((n / total) * 1000) / 10 : 0);
    return { total, setValue, owned, missing: total - owned, dupes: lang === 'EN' ? dEN : dES, value: lang === 'EN' ? valEN : valES, pct: pct(owned), pctEN: pct(ownEN), pctES: pct(ownES) };
  });

  private touch() { const set = this.data(); if (set) this.data.set({ ...set }); }
  private markDirty(cardId: string, v: VariantView, patch: Partial<PendingChange>) {
    const lang = this.lang(); const key = `${cardId}|${v.variant}|${lang}`; const cur = this.dirty();
    const prev = cur[key] ?? { cardModelId: cardId, variant: v.variant, language: lang, quantity: v.owned[lang], qtyDirty: false, storageId: v.storage[lang]?.id ?? null, storageDirty: false };
    this.dirty.set({ ...cur, [key]: { ...prev, ...patch } });
  }
  adjust(cardId: string, v: VariantView, delta: number) {
    const lang = this.lang(); const next = Math.max(0, v.owned[lang] + delta); v.owned[lang] = next;
    const patch: Partial<PendingChange> = { quantity: next, qtyDirty: true };
    if (next === 0 && v.storage[lang]) { v.storage[lang] = null; patch.storageId = null; patch.storageDirty = true; }
    this.markDirty(cardId, v, patch); this.touch();
  }
  assignStorage(cardId: string, v: VariantView, id: string) {
    const lang = this.lang(); const loc = this.storages().find((s) => s.id === id) ?? null;
    v.storage[lang] = loc ? { id: loc.id, name: loc.name, type: loc.type, color: loc.color } : null;
    this.markDirty(cardId, v, { storageId: id || null, storageDirty: true }); this.touch();
  }
  save() {
    const changes = Object.values(this.dirty());
    if (!changes.length) return;
    this.saving.set(true);
    const calls = [];
    for (const c of changes) {
      if (c.qtyDirty) calls.push(this.collection.setQuantity(c.cardModelId, c.variant, c.language, c.quantity));
      if (c.storageDirty) calls.push(this.collection.assign(c.cardModelId, c.variant, c.language, c.storageId));
    }
    forkJoin(calls).subscribe({ next: () => { this.dirty.set({}); this.saving.set(false); }, error: () => this.saving.set(false) });
  }
  discard() { this.dirty.set({}); const id = this.id(); if (id) this.collection.checklist(id).subscribe((s) => this.data.set(s)); }
}
