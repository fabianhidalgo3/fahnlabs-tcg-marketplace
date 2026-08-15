import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { TuiButton, TuiLoader } from '@taiga-ui/core';
import { TuiSegmented } from '@taiga-ui/kit';
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
    CommonModule, RouterLink, FormsModule, TuiButton, TuiLoader, TuiSegmented,
  ],
  template: `
    @if (data(); as set) {
      <a tuiButton appearance="flat" size="s" routerLink="/coleccion" class="back"><span class="mi">arrow_back</span>{{ i18n.t('nav.collection') }}</a>

      <div class="header card-surface">
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
      </div>

      <div class="toolbar">
        <tui-segmented [activeItemIndex]="modes.indexOf(mode())" (activeItemIndexChange)="mode.set(modes[$event])">
          <button type="button">{{ i18n.isES() ? 'Set completo' : 'Full set' }}</button>
          <button type="button">{{ i18n.isES() ? 'Faltantes' : 'Missing' }}</button>
          <button type="button">{{ i18n.isES() ? 'Las que tengo' : 'Owned' }}</button>
        </tui-segmented>
        <tui-segmented [activeItemIndex]="langs.indexOf(lang())" (activeItemIndexChange)="lang.set(langs[$event])">
          <button type="button">🇬🇧 EN</button>
          <button type="button">🇪🇸 ES</button>
        </tui-segmented>
        <tui-segmented [activeItemIndex]="views.indexOf(view())" (activeItemIndexChange)="view.set(views[$event])">
          <button type="button"><span class="mi">grid_view</span></button>
          <button type="button"><span class="mi">table_rows</span></button>
        </tui-segmented>
      </div>

      @if (view() === 'grid') {
        <div class="grid">
          @for (slot of visibleSlots(); track slot.key) {
            <div class="cell card-surface" [class.dim]="owned(slot.v) === 0">
              <div class="img">
                @if (slot.card.imageUrl) { <img [src]="slot.card.imageUrl" [alt]="slot.card.name" loading="lazy" /> }
                @else { <div class="noimg">{{ slot.card.number }}</div> }
                <span class="vbadge" [class.rev]="slot.v.variant !== 'Normal'">{{ abbr(slot.v.variant) }}</span>
                @if (owned(slot.v) > 0) { <span class="mi check">check_circle</span> }
              </div>
              <div class="meta">
                <div class="n muted">{{ slot.card.number }} · {{ abbr(slot.v.variant) }}</div>
                <div class="nm">{{ slot.card.name }}</div>
                <div class="vval muted">{{ cur.format(slot.v.value) }} {{ i18n.isES() ? 'c/u' : 'ea' }}</div>
              </div>
              <div class="ctrlrow">
                <button class="icon-btn sm" [disabled]="owned(slot.v) === 0" (click)="adjust(slot.card.id, slot.v, -1)"><span class="mi">remove</span></button>
                <span class="qty" [class.zero]="owned(slot.v) === 0">{{ owned(slot.v) }}</span>
                <button class="icon-btn sm" (click)="adjust(slot.card.id, slot.v, 1)"><span class="mi">add</span></button>
              </div>
              @if (owned(slot.v) > 1) {
                <div class="linetotal muted">{{ owned(slot.v) }} × = <b>{{ cur.format(slot.v.value * owned(slot.v)) }}</b></div>
              }
              @if (owned(slot.v) > 0) {
                <select class="ui-select store" [ngModel]="storageId(slot.v)" (ngModelChange)="assignStorage(slot.card.id, slot.v, $event)">
                  <option [value]="''">{{ i18n.isES() ? 'Sin ubicación' : 'No location' }}</option>
                  @for (s of storages(); track s.id) { <option [value]="s.id">{{ s.name }}</option> }
                </select>
              }
            </div>
          }
        </div>
      }

      @if (view() === 'table') {
        <div class="tablewrap card-surface">
          <table class="ctable">
            <thead>
              <tr>
                <th></th>
                <th>#</th>
                <th>{{ i18n.isES() ? 'Carta' : 'Card' }}</th>
                <th>{{ i18n.isES() ? 'Rareza' : 'Rarity' }}</th>
                <th class="r">{{ i18n.isES() ? 'Valor u.' : 'Unit' }}</th>
                <th class="c">{{ i18n.isES() ? 'Cant.' : 'Qty' }}</th>
                <th class="r">Total</th>
                <th>{{ i18n.isES() ? 'Ubicación' : 'Location' }}</th>
              </tr>
            </thead>
            <tbody>
              @for (s of visibleSlots(); track s.key) {
                <tr [class.dim]="owned(s.v) === 0">
                  <td>@if (s.card.imageUrl) { <img class="thumb" [src]="s.card.imageUrl" [alt]="s.card.name" loading="lazy" /> }</td>
                  <td class="mono muted">{{ s.card.number }}</td>
                  <td><b>{{ s.card.name }}</b> <span class="tag" [class.rev]="s.v.variant !== 'Normal'">{{ abbr(s.v.variant) }}</span></td>
                  <td class="muted">{{ s.card.rarity }}</td>
                  <td class="r muted">{{ cur.format(s.v.value) }}</td>
                  <td class="c">
                    <div class="ctrlrow">
                      <button class="icon-btn sm" [disabled]="owned(s.v) === 0" (click)="adjust(s.card.id, s.v, -1)"><span class="mi">remove</span></button>
                      <span class="qty" [class.zero]="owned(s.v) === 0">{{ owned(s.v) }}</span>
                      <button class="icon-btn sm" (click)="adjust(s.card.id, s.v, 1)"><span class="mi">add</span></button>
                    </div>
                  </td>
                  <td class="r"><b class="val">{{ owned(s.v) > 0 ? cur.format(s.v.value * owned(s.v)) : '—' }}</b></td>
                  <td>
                    @if (owned(s.v) > 0) {
                      <select class="ui-select store tstore" [ngModel]="storageId(s.v)" (ngModelChange)="assignStorage(s.card.id, s.v, $event)">
                        <option [value]="''">{{ i18n.isES() ? 'Sin ubicación' : 'None' }}</option>
                        @for (loc of storages(); track loc.id) { <option [value]="loc.id">{{ loc.name }}</option> }
                      </select>
                    } @else { <span class="muted">—</span> }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      @if (pendingCount() > 0) {
        <div class="savebar card-surface">
          <span class="pc">{{ pendingCount() }} {{ i18n.isES() ? (pendingCount() === 1 ? 'cambio sin guardar' : 'cambios sin guardar') : (pendingCount() === 1 ? 'unsaved change' : 'unsaved changes') }}</span>
          <button tuiButton type="button" appearance="flat" size="s" [disabled]="saving()" (click)="discard()">{{ i18n.isES() ? 'Descartar' : 'Discard' }}</button>
          <button tuiButton type="button" appearance="primary" size="s" [disabled]="saving()" (click)="save()"><span class="mi">save</span>{{ saving() ? (i18n.isES() ? 'Guardando…' : 'Saving…') : (i18n.isES() ? 'Guardar' : 'Save') }}</button>
        </div>
      }
    } @else {
      <div class="loading"><tui-loader size="l" /></div>
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
      .check { position: absolute; top: 6px; right: 6px; color: var(--success); background: var(--card); border-radius: 50%; font-size: 22px; }
      .vbadge { position: absolute; bottom: 8px; left: 8px; background: rgba(0,0,0,0.7); color: #fff; font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 5px; }
      .vbadge.rev { background: linear-gradient(90deg, var(--primary), #fbbf24); color: #1a1d33; }
      .meta { padding: 8px 10px 2px; }
      .n { font-size: 11px; } .nm { font-weight: 700; font-size: 13px; line-height: 1.2; }
      .vval { font-size: 11px; margin-top: 2px; }
      .ctrlrow { display: flex; align-items: center; justify-content: center; gap: 4px; }
      .qty { min-width: 20px; text-align: center; font-weight: 800; }
      .qty.zero { color: var(--muted); }
      .linetotal { text-align: center; font-size: 11px; padding: 0 10px 4px; } .linetotal b { color: var(--accent); }
      .store { margin: 6px 8px 8px; width: calc(100% - 16px); font-size: 12px; padding: 7px 30px 7px 10px; border-radius: 10px; }
      .tablewrap { padding: 0; overflow-x: auto; }
      .ctable { width: 100%; border-collapse: collapse; }
      .ctable th { text-align: left; font-size: 12px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.4px; padding: 12px 14px; border-bottom: 1px solid var(--border); white-space: nowrap; }
      .ctable td { padding: 10px 14px; border-bottom: 1px solid var(--border); vertical-align: middle; font-size: 14px; }
      .ctable tbody tr { transition: background 0.12s ease; }
      .ctable tbody tr:hover { background: color-mix(in srgb, var(--text) 4%, transparent); }
      .ctable tbody tr:last-child td { border-bottom: none; }
      .thumb { width: 34px; height: 47px; object-fit: contain; border-radius: 4px; display: block; }
      .mono { font-variant-numeric: tabular-nums; }
      .r { text-align: right; } .c { text-align: center; }
      th.r, td.r { text-align: right; } th.c, td.c { text-align: center; }
      .tstore { width: 150px; margin: 0; }
      .tag { font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 999px; background: var(--card-2); margin-left: 6px; }
      .tag.rev { background: linear-gradient(90deg, var(--primary), #fbbf24); color: #1a1d33; }
      tr.dim { opacity: 0.55; }
      .savebar { position: fixed; left: 50%; transform: translateX(-50%); bottom: 24px; z-index: 40; display: flex; align-items: center; gap: 12px; padding: 10px 14px 10px 20px; border-radius: 999px; box-shadow: var(--shadow); }
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

  modes: Mode[] = ['all', 'missing', 'owned'];
  langs: CardLang[] = ['EN', 'ES'];
  views: Array<'grid' | 'table'> = ['grid', 'table'];

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
