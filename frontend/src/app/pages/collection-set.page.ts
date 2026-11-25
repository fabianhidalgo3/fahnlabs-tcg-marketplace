import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { CollectionService } from '../core/services/collection.service';
import { CatalogService } from '../core/services/catalog.service';
import { AdminService } from '../core/services/admin.service';
import { AuthService } from '../core/services/auth.service';
import { CardLangService } from '../core/services/card-lang.service';
import { StorageLocationService } from '../core/services/storage-location.service';
import { I18nService } from '../core/services/i18n.service';
import { CurrencyService } from '../core/services/currency.service';
import { CardLang, CardModel, ChecklistSet, StorageLocation, VariantView } from '../core/models/models';
import { setLogoUrl, thumbUrl } from '../core/utils/card-image';

type Mode = 'all' | 'missing' | 'owned';
const VARIANT_ABBR: Record<string, string> = {
  Normal: 'Normal', 'Reverse Holo': 'Reverse', 'Poké Ball': 'Poké Ball', 'Master Ball': 'Master Ball', Holo: 'Holo',
};
interface Slot { key: string; card: ChecklistSet['cards'][number]; v: VariantView; }
interface PendingChange { cardModelId: string; variant: string; language: CardLang; quantity: number; qtyDirty: boolean; storageId: string | null; storageDirty: boolean; }

@Component({
  standalone: true,
  imports: [
    CommonModule, RouterLink, FormsModule,
  ],
  template: `
    @if (data(); as set) {
      <a class="btn btn-ghost btn-s back" routerLink="/coleccion"><span class="mi">arrow_back</span>{{ i18n.t('nav.collection') }}</a>

      <div class="header card-surface">
        <div class="idcol">
          @if (logo(set.symbolUrl)) {
            <img class="setlogo" [src]="logo(set.symbolUrl)" [alt]="set.name" (error)="logoBroken.set(true)" [hidden]="logoBroken()" />
          }
          <h1 class="ht">
            @if (set.symbolUrl) { <img class="symbol" [src]="set.symbolUrl" [alt]="set.name" /> }
            {{ set.name }}
          </h1>
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
        <div class="seg">
          <button type="button" [class.on]="mode() === 'all'" (click)="mode.set('all')">{{ i18n.isES() ? 'Set completo' : 'Full set' }}</button>
          <button type="button" [class.on]="mode() === 'missing'" (click)="mode.set('missing')">{{ i18n.isES() ? 'Faltantes' : 'Missing' }}</button>
          <button type="button" [class.on]="mode() === 'owned'" (click)="mode.set('owned')">{{ i18n.isES() ? 'Las que tengo' : 'Owned' }}</button>
        </div>
        <div class="seg">
          <button type="button" [class.on]="view() === 'grid'" (click)="view.set('grid')"><span class="mi">grid_view</span></button>
          <button type="button" [class.on]="view() === 'table'" (click)="view.set('table')"><span class="mi">table_rows</span></button>
        </div>
        <span class="t-right" style="display:inline-flex; gap:8px;">
          <button class="btn btn-outline btn-s" type="button" [disabled]="pdfBusy()" (click)="exportMissingPdf()"
            [title]="i18n.isES() ? 'PDF con las faltantes a tamaño real (63×88mm): imprime, recorta y márcalas en el álbum' : 'PDF of missing cards at real size to print for your binder'">
            <span class="mi">{{ pdfBusy() ? 'progress_activity' : 'picture_as_pdf' }}</span>{{ i18n.isES() ? 'PDF faltantes' : 'Missing PDF' }}
          </button>
          <button class="btn btn-outline btn-s" type="button" [disabled]="exporting()" (click)="exportXlsx()">
            <span class="mi">{{ exporting() ? 'progress_activity' : 'download' }}</span>{{ i18n.isES() ? 'Exportar Excel' : 'Export Excel' }}
          </button>
        </span>
      </div>

      @if (view() === 'grid') {
        <div class="grid">
          @for (slot of visibleSlots(); track slot.key) {
            <div class="cell card-surface" [class.dim]="owned(slot.v) === 0">
              <div class="img" [class.reverse]="slot.v.variant === 'Reverse Holo'">
                @if (slot.card.imageUrl) { <img [src]="thumb(slot.card.imageUrl)" [alt]="slot.card.name" loading="lazy" decoding="async" /> }
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
                  <td>@if (s.card.imageUrl) { <img class="thumb" [src]="thumb(s.card.imageUrl)" [alt]="s.card.name" loading="lazy" decoding="async" /> }</td>
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

      <!-- ===== PROMOCIONALES del set (curadas por el admin) ===== -->
      @if ((set.promos?.length ?? 0) > 0 || auth.isAdmin()) {
        <div class="promohead">
          <h3 class="ptitle">
            {{ i18n.isES() ? 'Cartas promocionales' : 'Promotional cards' }}
            @if (promoStats(); as ps) { <span class="muted"> · {{ ps.owned }}/{{ ps.total }}</span> }
          </h3>
          @if (auth.isAdmin()) {
            <button class="btn btn-outline btn-s" type="button" (click)="promoPicker.set(!promoPicker())">
              <span class="mi">add</span>{{ i18n.isES() ? 'Agregar promo' : 'Add promo' }}
            </button>
          }
        </div>

        @if (promoPicker()) {
          <div class="promosearch card-surface">
            <div class="searchbox">
              <span class="mi">search</span>
              <input class="ui-input" [placeholder]="i18n.isES() ? 'Buscar promo: nombre o número (ej. mewtwo 151)' : 'Search promo: name or number (e.g. mewtwo 151)'" [(ngModel)]="promoQ" (ngModelChange)="searchPromos()" />
            </div>
            @for (r of promoResults(); track r.id) {
              <button class="promores" type="button" (click)="addPromo(r)">
                @if (r.imageUrl) { <img [src]="thumb(r.imageUrl)" [alt]="r.name" /> }
                <span class="rn"><b>{{ r.name }}</b> <span class="muted">{{ r.set?.name }} · {{ r.number }}</span></span>
                <span class="mi">add_circle</span>
              </button>
            }
          </div>
        }

        @if ((set.promos?.length ?? 0) === 0 && auth.isAdmin()) {
          <p class="muted pempty">{{ i18n.isES() ? 'Sin promos asociadas aún. Usa "Agregar promo".' : 'No promos linked yet. Use "Add promo".' }}</p>
        }

        <div class="grid">
          @for (slot of promoSlots(); track slot.key) {
            <div class="cell card-surface promo" [class.dim]="owned(slot.v) === 0">
              <div class="img" [class.reverse]="slot.v.variant === 'Reverse Holo'">
                @if (slot.card.imageUrl) { <img [src]="thumb(slot.card.imageUrl)" [alt]="slot.card.name" loading="lazy" decoding="async" /> }
                @else { <div class="noimg">{{ slot.card.number }}</div> }
                <span class="vbadge promotag">PROMO</span>
                @if (owned(slot.v) > 0) { <span class="mi check">check_circle</span> }
                @if (auth.isAdmin()) {
                  <button class="icon-btn sm del prm" (click)="removePromo(slot.card.id)" title="Quitar promo"><span class="mi">close</span></button>
                }
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
            </div>
          }
        </div>
      }

      @if (pendingCount() > 0) {
        <div class="savebar card-surface">
          <span class="pc">{{ pendingCount() }} {{ i18n.isES() ? (pendingCount() === 1 ? 'cambio sin guardar' : 'cambios sin guardar') : (pendingCount() === 1 ? 'unsaved change' : 'unsaved changes') }}</span>
          <button class="btn btn-ghost btn-s" type="button" [disabled]="saving()" (click)="discard()">{{ i18n.isES() ? 'Descartar' : 'Discard' }}</button>
          <button class="btn btn-primary btn-s" type="button" [disabled]="saving()" (click)="save()"><span class="mi">save</span>{{ saving() ? (i18n.isES() ? 'Guardando…' : 'Saving…') : (i18n.isES() ? 'Guardar' : 'Save') }}</button>
        </div>
      }
    } @else {
      <div class="loading"><div class="spinner"></div></div>
    }
  `,
  styles: [
    `
      .back { margin-bottom: 12px; }
      .header { display: flex; justify-content: space-between; align-items: center; gap: 20px; padding: 22px; margin-bottom: 18px; flex-wrap: wrap; }
      h1 { font-size: 28px; }
      .ht { display: flex; align-items: center; gap: 10px; }
      .ht .symbol { width: 30px; height: 30px; object-fit: contain; }
      .idcol { display: flex; flex-direction: column; gap: 10px; align-items: flex-start; }
      .setlogo { max-height: 72px; max-width: 260px; object-fit: contain; }
      .summary { display: flex; align-items: center; gap: 22px; }
      .ring { --p: 0; width: 92px; height: 92px; border-radius: 50%; background: conic-gradient(var(--primary) calc(var(--p) * 1%), var(--bg-soft) 0); display: grid; place-items: center; position: relative; }
      .ring::before { content: ''; position: absolute; width: 68px; height: 68px; border-radius: 50%; background: var(--card); }
      .ring span { position: relative; font-weight: 800; }
      .numbers { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; font-size: 13px; }
      .numbers > div { display: flex; flex-direction: column; }
      .numbers b { font-size: 16px; }
      .miss { color: var(--accent); } .val { color: var(--accent); }
      .both { grid-column: 1 / -1; font-size: 12px; }
      .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 16px; }
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
      .thumb { width: 52px; height: 72px; object-fit: contain; border-radius: 5px; display: block; transition: transform 0.15s ease; position: relative; }
      .thumb:hover { transform: scale(3.4); z-index: 40; box-shadow: 0 10px 30px rgba(0,0,0,0.55); background: var(--card); }
      .mono { font-variant-numeric: tabular-nums; }
      .r { text-align: right; } .c { text-align: center; }
      th.r, td.r { text-align: right; } th.c, td.c { text-align: center; }
      .tstore { width: 150px; margin: 0; }
      .tag { font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 999px; background: var(--card-2); margin-left: 6px; }
      .tag.rev { background: linear-gradient(90deg, var(--primary), #fbbf24); color: #1a1d33; }
      tr.dim { opacity: 0.55; }
      .promohead { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 28px 0 12px; }
      .ptitle { font-size: 16px; margin: 0; }
      .promosearch { padding: 14px; margin-bottom: 14px; display: flex; flex-direction: column; gap: 8px; }
      .promores { display: flex; align-items: center; gap: 12px; text-align: left; padding: 8px 10px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-soft); color: var(--text); cursor: pointer; font: inherit; }
      .promores:hover { border-color: var(--primary); }
      .promores img { width: 34px; height: 47px; object-fit: contain; border-radius: 4px; }
      .promores .rn { flex: 1; font-size: 13px; }
      .promores .mi { color: var(--primary); }
      .pempty { margin: 6px 0 10px; font-size: 13px; }
      .promotag { background: linear-gradient(90deg, #d97706, #db2777); }
      .cell.promo .prm { position: absolute; top: 6px; right: 6px; z-index: 2; }
      .savebar { position: fixed; left: 50%; transform: translateX(-50%); bottom: 24px; z-index: 40; display: flex; align-items: center; gap: 12px; padding: 10px 14px 10px 20px; border-radius: 999px; box-shadow: var(--shadow); }
      .savebar .pc { font-weight: 700; font-size: 14px; }
      .loading { display: grid; place-items: center; padding: 60px; }
    `,
  ],
})
export class CollectionSetPage {
  logo = setLogoUrl;
  logoBroken = signal(false);
  thumb = thumbUrl;
  private collection = inject(CollectionService);
  cardLang = inject(CardLangService);
  private catalog = inject(CatalogService);
  private admin = inject(AdminService);
  auth = inject(AuthService);
  private storageSvc = inject(StorageLocationService);
  i18n = inject(I18nService);
  cur = inject(CurrencyService);

  id = input.required<string>();

  exporting = signal(false);
  pdfBusy = signal(false);
  /** PDF imprimible de las faltantes (tamaño real de carta). */
  exportMissingPdf() {
    this.pdfBusy.set(true);
    this.collection.exportMissingPdf(this.id()).subscribe({
      next: (b) => {
        const slug = (this.data()?.name ?? 'set').toLowerCase().replace(/[^a-z0-9]+/gi, '-');
        this.collection.downloadBlob(b, `faltantes-${slug}.pdf`);
        this.pdfBusy.set(false);
      },
      error: () => this.pdfBusy.set(false),
    });
  }

  /** Exporta el checklist con el filtro activo (completo / faltantes / las que tengo). */
  exportXlsx() {
    this.exporting.set(true);
    const mode = this.mode();
    this.collection.exportChecklistXlsx(this.id(), mode).subscribe({
      next: (b) => {
        const slug = (this.data()?.name ?? 'set').toLowerCase().replace(/[^a-z0-9]+/gi, '-');
        const suffix = mode === 'missing' ? '-faltantes' : mode === 'owned' ? '-tengo' : '';
        this.collection.downloadBlob(b, `checklist-${slug}${suffix}.xlsx`);
        this.exporting.set(false);
      },
      error: () => this.exporting.set(false),
    });
  }
  data = signal<ChecklistSet | null>(null);
  storages = signal<StorageLocation[]>([]);
  /** Idioma de las cartas: sigue al selector global del header (ES/EN). */
  lang = computed<CardLang>(() => (this.i18n.isES() ? 'ES' : 'EN'));
  mode = signal<Mode>('all');
  view = signal<'grid' | 'table'>('grid');
  dirty = signal<Record<string, PendingChange>>({});
  saving = signal(false);
  pendingCount = computed(() => Object.keys(this.dirty()).length);

  modes: Mode[] = ['all', 'missing', 'owned'];
  views: Array<'grid' | 'table'> = ['grid', 'table'];

  constructor() {
    this.storageSvc.list().subscribe((s) => this.storages.set(s));
    effect(() => {
      const id = this.id();
      if (id) { this.dirty.set({}); this.collection.checklist(id).subscribe((s) => this.data.set(s)); }
    });
  }

  /** Total poseído en CUALQUIER idioma: la colección se marca aunque la UI esté en otro idioma. */
  owned(v: VariantView): number { return v.owned.EN + v.owned.ES; }
  abbr(v: string): string { return VARIANT_ABBR[v] ?? v; }

  // ---- Promocionales del set ----
  promoPicker = signal(false);
  promoQ = '';
  promoResults = signal<CardModel[]>([]);
  private promoTimer: any;
  promoSlots = computed<Slot[]>(() => {
    const set = this.data();
    const out: Slot[] = [];
    for (const card of set?.promos ?? []) for (const v of card.variants) out.push({ key: `${card.id}|${v.variant}`, card, v });
    return out;
  });
  promoStats = computed(() => {
    const slots = this.promoSlots();
    if (!slots.length) return null;
    return { total: slots.length, owned: slots.filter((s) => this.owned(s.v) > 0).length };
  });
  searchPromos() {
    clearTimeout(this.promoTimer);
    this.promoTimer = setTimeout(() => {
      if (!this.promoQ.trim()) { this.promoResults.set([]); return; }
      this.catalog
        .cards({ q: this.promoQ.trim(), gameId: this.data()?.game, limit: 8 })
        .subscribe((r) => this.promoResults.set(r.data));
    }, 300);
  }
  addPromo(card: CardModel) {
    const id = this.id();
    if (!id) return;
    this.admin.addPromo(id, card.id).subscribe(() => {
      this.promoResults.set([]); this.promoQ = ''; this.promoPicker.set(false);
      this.collection.checklist(id).subscribe((s) => this.data.set(s));
    });
  }
  removePromo(cardId: string) {
    const id = this.id();
    if (!id) return;
    this.admin.removePromo(id, cardId).subscribe(() => {
      this.collection.checklist(id).subscribe((s) => this.data.set(s));
    });
  }
  storageId(v: VariantView): string { return v.storage[this.effLang(v)]?.id ?? ''; }

  /**
   * Idioma "efectivo" para editar un slot: si ya tienes copias en un idioma,
   * se sigue operando ahí (ej. coleccionas en EN con la UI en español);
   * si no tienes ninguna, se usa el idioma de la UI.
   */
  private effLang(v: VariantView): CardLang {
    // Preferencia "idioma de mis cartas" (no el idioma de la interfaz).
    const pref = this.cardLang.lang();
    const other: CardLang = pref === 'ES' ? 'EN' : 'ES';
    if (v.owned[pref] > 0) return pref;
    if (v.owned[other] > 0) return other;
    return pref;
  }

  private slots = computed<Slot[]>(() => {
    const set = this.data();
    if (!set) return [];
    const out: Slot[] = [];
    for (const card of set.cards) for (const v of card.variants) out.push({ key: `${card.id}|${v.variant}`, card, v });
    return out;
  });
  visibleSlots = computed<Slot[]>(() => {
    const mode = this.mode(); const slots = this.slots();
    if (mode === 'all') return slots;
    if (mode === 'owned') return slots.filter((s) => this.owned(s.v) > 0);
    return slots.filter((s) => this.owned(s.v) === 0);
  });

  stats = computed(() => {
    const set = this.data();
    if (!set) return null;
    let total = 0, setValue = 0, ownAll = 0, ownEN = 0, ownES = 0, value = 0, dupes = 0;
    for (const c of set.cards) for (const v of c.variants) {
      total++; setValue += v.value;
      const tot = v.owned.EN + v.owned.ES;
      if (tot > 0) ownAll++;
      if (v.owned.EN > 0) ownEN++; if (v.owned.ES > 0) ownES++;
      value += v.value * tot;
      dupes += Math.max(tot - 1, 0);
    }
    const pct = (n: number) => (total ? Math.round((n / total) * 1000) / 10 : 0);
    return { total, setValue, owned: ownAll, missing: total - ownAll, dupes, value, pct: pct(ownAll), pctEN: pct(ownEN), pctES: pct(ownES) };
  });

  private touch() { const set = this.data(); if (set) this.data.set({ ...set }); }
  private markDirty(cardId: string, v: VariantView, lang: CardLang, patch: Partial<PendingChange>) {
    const key = `${cardId}|${v.variant}|${lang}`; const cur = this.dirty();
    const prev = cur[key] ?? { cardModelId: cardId, variant: v.variant, language: lang, quantity: v.owned[lang], qtyDirty: false, storageId: v.storage[lang]?.id ?? null, storageDirty: false };
    this.dirty.set({ ...cur, [key]: { ...prev, ...patch } });
  }
  adjust(cardId: string, v: VariantView, delta: number) {
    const lang = this.effLang(v); const next = Math.max(0, v.owned[lang] + delta); v.owned[lang] = next;
    const patch: Partial<PendingChange> = { quantity: next, qtyDirty: true };
    if (next === 0 && v.storage[lang]) { v.storage[lang] = null; patch.storageId = null; patch.storageDirty = true; }
    this.markDirty(cardId, v, lang, patch); this.touch();
  }
  assignStorage(cardId: string, v: VariantView, id: string) {
    const lang = this.effLang(v); const loc = this.storages().find((s) => s.id === id) ?? null;
    v.storage[lang] = loc ? { id: loc.id, name: loc.name, type: loc.type, color: loc.color } : null;
    this.markDirty(cardId, v, lang, { storageId: id || null, storageDirty: true }); this.touch();
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
    forkJoin(calls).subscribe({
      next: () => {
        this.dirty.set({});
        // Recargar desde el servidor: refleja ubicaciones auto-asignadas,
        // totales y cualquier ajuste hecho por el backend al guardar.
        const id = this.id();
        if (id) this.collection.checklist(id).subscribe((s) => { this.data.set(s); this.saving.set(false); });
        else this.saving.set(false);
      },
      error: () => this.saving.set(false),
    });
  }
  discard() { this.dirty.set({}); const id = this.id(); if (id) this.collection.checklist(id).subscribe((s) => this.data.set(s)); }
}
