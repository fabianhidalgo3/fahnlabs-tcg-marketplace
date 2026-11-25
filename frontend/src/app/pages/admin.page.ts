import { Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CatalogService } from '../core/services/catalog.service';
import { AdminService } from '../core/services/admin.service';
import { OrdersService } from '../core/services/orders.service';
import { I18nService } from '../core/services/i18n.service';
import { CurrencyService } from '../core/services/currency.service';
import { CardCondition, CardModel, CardSet, Game, InventoryItem } from '../core/models/models';

const CONDITIONS: CardCondition[] = ['M', 'NM', 'LP', 'MP', 'HP', 'DMG'];

interface PriceJob {
  running: boolean; startedAt: string | null; finishedAt: string | null;
  totalSets: number; processedSets: number; updatedCards: number; failedSets: string[];
}

@Component({
  standalone: true,
  imports: [
    CommonModule, FormsModule,
  ],
  template: `
    <header class="page-head">
      <div>
        <h1>{{ es ? 'Administración' : 'Administration' }}</h1>
        <p class="muted">{{ es ? 'Gestiona juegos, sets, cartas e inventario.' : 'Manage games, sets, cards and inventory.' }}</p>
      </div>
      <div class="ph-actions">
        <button class="btn btn-primary btn-s" type="button" [disabled]="priceJob()?.running" (click)="updatePrices()"
          [title]="es ? 'Refresca los precios de mercado (TCGplayer) de todos los sets y aplica los pisos retail' : 'Refresh market prices for all sets'">
          <span class="mi">{{ priceJob()?.running ? 'progress_activity' : 'currency_exchange' }}</span>
          {{ priceJob()?.running
            ? (priceJob()?.processedSets + '/' + priceJob()?.totalSets + ' sets · ' + priceJob()?.updatedCards + ' precios')
            : (es ? 'Actualizar precios' : 'Update prices') }}
        </button>
        <button class="btn btn-outline btn-s" type="button" (click)="exportStockCsv()" [title]="es ? 'CSV del stock para importar en otras plataformas (ej. TCGmatch)' : 'Stock CSV for other platforms'">
          <span class="mi">download</span>{{ es ? 'Exportar stock CSV' : 'Export stock CSV' }}
        </button>
      </div>
    </header>

    <!-- Banner de estado de la tienda -->
    <section class="abanner">
      <div class="ab-txt">
        <span class="ab-brand">SingleTCG · {{ es ? 'Panel FHAN Labs' : 'FHAN Labs panel' }}</span>
        <h2>{{ es ? 'Así va la tienda hoy' : 'Store status today' }}</h2>
      </div>
      <div class="ab-stats">
        <div class="ab-stat"><b>{{ stats().cards | number }}</b><span>{{ es ? 'cartas en catálogo' : 'cards in catalog' }}</span></div>
        <div class="ab-stat"><b>{{ stats().sets }}</b><span>sets</span></div>
        <div class="ab-stat"><b>{{ stats().listings }}</b><span>{{ es ? 'publicaciones activas' : 'active listings' }}</span></div>
        <div class="ab-stat" [class.warn]="stats().pending > 0"><b>{{ stats().pending }}</b><span>{{ es ? 'pedidos pendientes' : 'pending orders' }}</span></div>
      </div>
    </section>

    @if (msg()) { <div class="msg ok"><span class="mi">check_circle</span>{{ msg() }}</div> }
    @if (err()) { <div class="msg err"><span class="mi">error</span>{{ err() }}</div> }

    <div class="tabbar tabs">
      <button class="tab" type="button" [class.on]="tab() === 0" (click)="tab.set(0)">{{ es ? 'Juegos' : 'Games' }}</button>
      <button class="tab" type="button" [class.on]="tab() === 1" (click)="tab.set(1)">Sets</button>
      <button class="tab" type="button" [class.on]="tab() === 2" (click)="tab.set(2)">{{ es ? 'Cartas' : 'Cards' }}</button>
      <button class="tab" type="button" [class.on]="tab() === 3" (click)="tab.set(3)">{{ es ? 'Inventario' : 'Inventory' }}</button>
    </div>

    <!-- ===================== JUEGOS ===================== -->
    @if (tab() === 0) {
      <section class="block card-surface">
        <div class="block-head">
          <h3>{{ es ? 'Nuevo juego' : 'New game' }}</h3>
          <p class="muted">{{ es ? 'Crea un juego para agrupar sets y cartas.' : 'Create a game to group sets and cards.' }}</p>
        </div>
        <div class="form-grid">
          <label class="ui-field"><span class="lbl">{{ es ? 'Código' : 'Code' }}</span><input class="ui-input" placeholder="pokemon" [(ngModel)]="gForm.code" /></label>
          <label class="ui-field"><span class="lbl">{{ es ? 'Nombre' : 'Name' }}</span><input class="ui-input" placeholder="Pokémon TCG" [(ngModel)]="gForm.name" /></label>
          <label class="ui-field"><span class="lbl">{{ es ? 'Ícono (URL)' : 'Icon (URL)' }}</span><input class="ui-input" placeholder="https://…" [(ngModel)]="gForm.iconUrl" /></label>
        </div>
        <div class="form-actions">
          <button class="btn btn-primary" type="button" [disabled]="!gForm.code || !gForm.name" (click)="createGame()"><span class="mi">add</span>{{ es ? 'Crear' : 'Create' }}</button>
        </div>
      </section>

      <section class="block card-surface tablecard">
        <table class="dtable">
          <thead>
            <tr>
              <th>{{ es ? 'Nombre' : 'Name' }}</th>
              <th>{{ es ? 'Código' : 'Code' }}</th>
              <th class="acol"></th>
            </tr>
          </thead>
          <tbody>
            @for (g of games(); track g.id) {
              <tr>
                <td><b>{{ g.name }}</b></td>
                <td class="muted mono">{{ g.code }}</td>
                <td class="acol"><button class="icon-btn sm del" (click)="deleteGame(g)"><span class="mi">delete</span></button></td>
              </tr>
            } @empty { <tr><td colspan="3" class="empty">{{ es ? 'Aún no hay juegos.' : 'No games yet.' }}</td></tr> }
          </tbody>
        </table>
      </section>
    }

    <!-- ===================== SETS ===================== -->
    @if (tab() === 1) {
      <div class="picker-row">
        <div class="ui-field">
          <span class="lbl">{{ es ? 'Juego' : 'Game' }}</span>
          <select class="ui-select" [(ngModel)]="setGameId" (ngModelChange)="loadSets()">
            <option value="">{{ es ? '— Selecciona juego —' : '— Select game —' }}</option>
            @for (g of games(); track g.id) { <option [value]="g.id">{{ g.name }}</option> }
          </select>
        </div>
      </div>

      @if (setGameId) {
        <section class="block card-surface">
          <div class="block-head">
            <h3>{{ es ? 'Nuevo set' : 'New set' }}</h3>
          </div>
          <div class="form-grid">
            <label class="ui-field"><span class="lbl">{{ es ? 'Código' : 'Code' }}</span><input class="ui-input" placeholder="sv3pt5" [(ngModel)]="sForm.code" /></label>
            <label class="ui-field"><span class="lbl">{{ es ? 'Nombre' : 'Name' }}</span><input class="ui-input" placeholder="151" [(ngModel)]="sForm.name" /></label>
            <label class="ui-field"><span class="lbl">{{ es ? 'Serie' : 'Series' }}</span><input class="ui-input" placeholder="Scarlet & Violet" [(ngModel)]="sForm.series" /></label>
            <label class="ui-field"><span class="lbl">{{ es ? 'Nº cartas' : 'Total cards' }}</span><input class="ui-input" type="number" placeholder="165" [(ngModel)]="sForm.totalCards" /></label>
            <label class="ui-field"><span class="lbl">{{ es ? 'Lanzamiento' : 'Release' }}</span><input class="ui-input" type="date" [(ngModel)]="sForm.releaseDate" /></label>
          </div>
          <div class="form-actions">
            <button class="btn btn-primary" type="button" [disabled]="!sForm.code || !sForm.name" (click)="createSet()"><span class="mi">add</span>{{ es ? 'Crear' : 'Create' }}</button>
          </div>
        </section>

        <section class="block card-surface tablecard">
          <table class="dtable">
            <thead>
              <tr>
                <th>{{ es ? 'Nombre' : 'Name' }}</th>
                <th>{{ es ? 'Código' : 'Code' }}</th>
                <th class="r">{{ es ? 'Nº cartas' : 'Total' }}</th>
                <th class="acol"></th>
              </tr>
            </thead>
            <tbody>
              @for (s of sets(); track s.id) {
                <tr>
                  <td><b>{{ s.name }}</b></td>
                  <td class="muted mono">{{ s.code }}</td>
                  <td class="r">{{ s.totalCards }}</td>
                  <td class="acol"><button class="icon-btn sm del" (click)="deleteSet(s)"><span class="mi">delete</span></button></td>
                </tr>
              } @empty { <tr><td colspan="4" class="empty">{{ es ? 'Sin sets.' : 'No sets.' }}</td></tr> }
            </tbody>
          </table>
        </section>
      }
    }

    <!-- ===================== CARTAS ===================== -->
    @if (tab() === 2) {
      <div class="picker-row two">
        <div class="ui-field">
          <span class="lbl">{{ es ? 'Juego' : 'Game' }}</span>
          <select class="ui-select" [(ngModel)]="cardGameId" (ngModelChange)="onCardGame()">
            <option value="">{{ es ? '— Selecciona juego —' : '— Select game —' }}</option>
            @for (g of games(); track g.id) { <option [value]="g.id">{{ g.name }}</option> }
          </select>
        </div>
        <div class="ui-field">
          <span class="lbl">Set</span>
          <select class="ui-select" [(ngModel)]="cardSetId" (ngModelChange)="loadCards()" [disabled]="!cardGameId">
            <option value="">{{ es ? '— Selecciona set —' : '— Select set —' }}</option>
            @for (s of cardSets(); track s.id) { <option [value]="s.id">{{ s.name }}</option> }
          </select>
        </div>
      </div>

      @if (cardSetId) {
        <section class="block card-surface">
          <div class="block-head"><h3>{{ es ? 'Nueva carta' : 'New card' }}</h3></div>
          <div class="form-grid">
            <label class="ui-field"><span class="lbl">{{ es ? 'Nombre' : 'Name' }}</span><input class="ui-input" placeholder="Pikachu" [(ngModel)]="cForm.name" /></label>
            <label class="ui-field"><span class="lbl">{{ es ? 'Número' : 'Number' }}</span><input class="ui-input" placeholder="025/165" [(ngModel)]="cForm.number" /></label>
            <label class="ui-field"><span class="lbl">{{ es ? 'Rareza' : 'Rarity' }}</span><input class="ui-input" placeholder="Common" [(ngModel)]="cForm.rarity" /></label>
            <label class="ui-field"><span class="lbl">{{ es ? 'Tipo de carta' : 'Card type' }}</span><input class="ui-input" placeholder="Pokémon" [(ngModel)]="cForm.cardType" /></label>
            <label class="ui-field"><span class="lbl">{{ es ? 'Imagen (URL)' : 'Image (URL)' }}</span><input class="ui-input" placeholder="https://…" [(ngModel)]="cForm.imageUrl" /></label>
            <label class="ui-field"><span class="lbl">{{ es ? 'Variantes (coma)' : 'Variants (comma)' }}</span><input class="ui-input" placeholder="Normal, Reverse Holo" [(ngModel)]="cForm.variantsCsv" /></label>
          </div>
          <div class="form-actions">
            <button class="btn btn-primary" type="button" [disabled]="!cForm.name || !cForm.number" (click)="createCard()"><span class="mi">add</span>{{ es ? 'Crear' : 'Create' }}</button>
          </div>
        </section>

        <section class="block card-surface tablecard">
          <table class="dtable">
            <thead>
              <tr>
                <th class="ncol">Nº</th>
                <th>{{ es ? 'Nombre' : 'Name' }}</th>
                <th>{{ es ? 'Rareza' : 'Rarity' }}</th>
                <th class="acol"></th>
              </tr>
            </thead>
            <tbody>
              @for (c of cards(); track c.id) {
                <tr>
                  <td class="mono muted">{{ c.number }}</td>
                  <td><b>{{ c.name }}</b></td>
                  <td class="muted">{{ c.rarity }}</td>
                  <td class="acol"><button class="icon-btn sm del" (click)="deleteCard(c)"><span class="mi">delete</span></button></td>
                </tr>
              } @empty { <tr><td colspan="4" class="empty">{{ es ? 'Sin cartas.' : 'No cards.' }}</td></tr> }
            </tbody>
          </table>
        </section>
      }
    }

    <!-- ===================== INVENTARIO ===================== -->
    @if (tab() === 3) {
      <section class="block card-surface">
        <div class="block-head"><h3>{{ es ? 'Buscar carta' : 'Find card' }}</h3></div>
        <div class="searchbox searchfield">
          <span class="mi">search</span>
          <input class="ui-input" [placeholder]="i18n.t('admin.search')" [(ngModel)]="q" (ngModelChange)="search()" />
        </div>
        @if (results().length) {
          <div class="results">
            @for (c of results(); track c.id) {
              <button class="res" [class.sel]="selected()?.id === c.id" (click)="select(c)">
                <span class="rname">{{ c.name }}</span>
                <span class="muted">{{ c.game?.name }} · {{ c.number }}</span>
              </button>
            }
          </div>
        }
      </section>

      @if (selected(); as c) {
        <section class="block card-surface tablecard">
          <div class="block-head manage-head">
            <h3>{{ c.name }} <span class="muted mono">{{ c.number }}</span></h3>
          </div>
          <table class="dtable">
            <thead>
              <tr>
                <th>{{ es ? 'Condición' : 'Condition' }}</th>
                <th>{{ es ? 'Idioma' : 'Language' }}</th>
                <th class="r">{{ i18n.t('admin.price') }}</th>
                <th class="c">Stock</th>
                <th class="acol"></th>
              </tr>
            </thead>
            <tbody>
              @for (it of inventory(); track it.id) {
                <tr>
                  <td><b>{{ it.condition }}</b>@if (it.isFoil) { <span class="foiltag">FOIL</span> }</td>
                  <td class="muted">{{ it.language }}</td>
                  <td class="r price">{{ cur.format(it.price) }}</td>
                  <td class="c"><b>{{ it.quantity }}</b></td>
                  <td class="acol">
                    <div class="rowacts">
                      <button class="icon-btn sm" (click)="adjustInv(it, -1)"><span class="mi">remove</span></button>
                      <button class="icon-btn sm" (click)="adjustInv(it, 1)"><span class="mi">add</span></button>
                      <button class="icon-btn sm del" (click)="removeInv(it)"><span class="mi">delete</span></button>
                    </div>
                  </td>
                </tr>
              } @empty { <tr><td colspan="5" class="empty">{{ i18n.t('admin.noInv') }}</td></tr> }
            </tbody>
          </table>

          <div class="addunit">
            <h4>{{ es ? 'Añadir unidad' : 'Add unit' }}</h4>
            <div class="form-grid inv-grid">
              <div class="ui-field">
                <span class="lbl">{{ es ? 'Condición' : 'Condition' }}</span>
                <select class="ui-select" [(ngModel)]="invForm.condition">
                  @for (cd of conditions; track cd) { <option [value]="cd">{{ cd }}</option> }
                </select>
              </div>
              <label class="ui-field"><span class="lbl">{{ i18n.t('admin.language') }}</span><input class="ui-input" placeholder="EN" [(ngModel)]="invForm.language" /></label>
              <label class="ui-field"><span class="lbl">{{ i18n.t('admin.price') }} (USD)</span><input class="ui-input" type="number" placeholder="0.00" [(ngModel)]="invForm.price" /></label>
              <label class="ui-field"><span class="lbl">{{ i18n.t('admin.qty') }}</span><input class="ui-input" type="number" placeholder="1" [(ngModel)]="invForm.quantity" /></label>
              <label class="cb-row foilbox"><input class="ui-check" type="checkbox" [(ngModel)]="invForm.isFoil" /> Foil</label>
            </div>
            <div class="form-actions">
              <button class="btn btn-primary" type="button" (click)="createInv(c)"><span class="mi">add</span>{{ i18n.t('admin.add') }}</button>
            </div>
          </div>
        </section>
      }
    }
  `,
  styles: [
    `
      .abanner {
        display: flex; align-items: center; justify-content: space-between; gap: 18px; flex-wrap: wrap;
        border-radius: 14px; padding: 20px 24px; margin: 14px 0 18px;
        background: linear-gradient(118deg, #10241c 0%, #0d1b2e 55%, #101433 100%);
        border: 1px solid color-mix(in srgb, var(--accent) 25%, var(--border));
      }
      .ab-txt .ab-brand { font-size: 11px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; color: var(--accent); }
      .ab-txt h2 { margin-top: 2px; font-size: 20px; }
      .ab-stats { display: flex; gap: 26px; flex-wrap: wrap; }
      .ab-stat { display: flex; flex-direction: column; gap: 1px; }
      .ab-stat b { font-size: 22px; color: var(--primary); }
      .ab-stat.warn b { color: var(--accent); }
      .ab-stat span { font-size: 12px; color: var(--muted); }
      .page-head { margin-bottom: 8px; display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
      .page-head h1 { margin-bottom: 2px; }
      .msg { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 12px; font-weight: 600; font-size: 14px; margin: 12px 0; }
      .msg .mi { font-size: 20px; }
      .msg.ok { background: color-mix(in srgb, var(--success) 14%, transparent); color: var(--success); }
      .msg.err { background: color-mix(in srgb, var(--danger) 14%, transparent); color: var(--danger); }
      .tabs { margin: 18px 0 22px; }
      .block { padding: 22px; margin-bottom: 18px; }
      .block-head { margin-bottom: 18px; }
      .block-head h3 { font-size: 17px; margin: 0 0 3px; }
      .block-head p { margin: 0; font-size: 13px; }
      .form-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
      @media (max-width: 900px) { .form-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
      @media (max-width: 560px) { .form-grid { grid-template-columns: 1fr; } }
      .form-actions { display: flex; justify-content: flex-end; margin-top: 18px; }
      .picker-row { display: flex; gap: 16px; margin-bottom: 18px; }
      .picker-row .ui-field { width: 320px; max-width: 100%; }
      .picker-row.two .ui-field { flex: 1; width: auto; }
      @media (max-width: 560px) { .picker-row, .picker-row.two { flex-direction: column; } .picker-row .ui-field { width: 100%; } }

      .tablecard { padding: 8px 8px; overflow-x: auto; }
      .dtable { width: 100%; border-collapse: collapse; }
      .dtable th { text-align: left; font-size: 12px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.4px; padding: 12px 14px; border-bottom: 1px solid var(--border); white-space: nowrap; }
      .dtable td { padding: 10px 14px; border-bottom: 1px solid var(--border); vertical-align: middle; font-size: 14px; }
      .dtable tbody tr { transition: background 0.12s ease; }
      .dtable tbody tr:hover { background: color-mix(in srgb, var(--text) 4%, transparent); }
      .dtable tbody tr:last-child td { border-bottom: none; }
      .dtable th.r, .dtable td.r { text-align: right; }
      .dtable th.c, .dtable td.c { text-align: center; }
      .dtable .acol { width: 1%; white-space: nowrap; text-align: right; }
      .dtable .ncol { width: 80px; }
      .dtable .mono { font-variant-numeric: tabular-nums; }
      .dtable .price { color: var(--accent); font-weight: 700; }
      .dtable .empty { text-align: center; color: var(--muted); padding: 24px; }
      .rowacts { display: inline-flex; gap: 2px; justify-content: flex-end; }
      .foiltag { font-size: 10px; font-weight: 700; background: linear-gradient(90deg,#ffd54a,#ff6b6b); color: #000; padding: 1px 6px; border-radius: 5px; margin-left: 8px; }

      .searchfield { max-width: 460px; }
      .results { display: flex; flex-direction: column; gap: 6px; margin-top: 14px; }
      .res {
        display: flex; justify-content: space-between; align-items: center; gap: 12px;
        text-align: left; padding: 11px 14px; border-radius: 12px;
        border: 1px solid var(--border); background: var(--bg-soft); color: var(--text);
        cursor: pointer; transition: border-color 0.12s ease, background 0.12s ease;
      }
      .res:hover { border-color: color-mix(in srgb, var(--primary) 50%, var(--border)); }
      .res.sel { border-color: var(--primary); box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary) 22%, transparent); }
      .rname { font-weight: 700; }

      .manage-head h3 { display: flex; align-items: baseline; gap: 8px; }
      .addunit { padding: 18px 12px 6px; }
      .addunit h4 { margin: 0 0 14px; font-size: 15px; }
      .inv-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
      @media (max-width: 900px) { .inv-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
      @media (max-width: 560px) { .inv-grid { grid-template-columns: 1fr; } }
      .foilbox { align-self: center; padding-top: 18px; }
    `,
  ],
})
export class AdminPage {
  private http = inject(HttpClient);

  /** Métricas del banner. */
  stats = signal({ cards: 0, sets: 0, listings: 0, pending: 0 });

  private loadStats() {
    this.catalog.cards({ limit: 1 }).subscribe((r) => this.stats.update((s) => ({ ...s, cards: r.total })));
    this.catalog.sets().subscribe((r) => this.stats.update((s) => ({ ...s, sets: r.length })));
    this.orders.all().subscribe((o) => this.stats.update((s) => ({ ...s, pending: o.filter((x) => x.status === 'pending').length })));
    this.catalog.recentListings(24).subscribe((l) => this.stats.update((s) => ({ ...s, listings: l.length })));
  }

  /** Actualizador de precios: job del backend con progreso. */
  priceJob = signal<PriceJob | null>(null);
  private pollTimer: any;

  updatePrices() {
    this.http.post<{ started: boolean }>(environment.apiUrl + '/cards/update-prices', {}).subscribe((r) => {
      if (!r.started) { this.err.set(this.es ? 'Ya hay una actualización corriendo.' : 'An update is already running.'); return; }
      this.pollPriceJob();
    });
  }

  private pollPriceJob() {
    clearInterval(this.pollTimer);
    const tick = () => this.http.get<PriceJob>(environment.apiUrl + '/cards/update-prices/status').subscribe((j) => {
      this.priceJob.set(j);
      if (!j.running && j.finishedAt) {
        clearInterval(this.pollTimer);
        const fails = j.failedSets?.length ?? 0;
        this.msg.set((this.es
          ? `Precios actualizados: ${j.updatedCards} cartas · ${j.processedSets}/${j.totalSets} sets`
          : `Prices updated: ${j.updatedCards} cards · ${j.processedSets}/${j.totalSets} sets`)
          + (fails ? (this.es ? ` · ${fails} sets con error (reintenta más tarde)` : ` · ${fails} sets failed`) : ''));
        setTimeout(() => this.msg.set(''), 12000);
      }
    });
    tick();
    this.pollTimer = setInterval(tick, 2500);
  }

  private catalog = inject(CatalogService);
  private orders = inject(OrdersService);

  /** Descarga el CSV del stock (para importar en otras plataformas). */
  exportStockCsv() {
    this.http.get(environment.apiUrl + '/inventory/export.csv', { responseType: 'blob' }).subscribe((b) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = 'stock-singletcg.csv';
      a.click();
      URL.revokeObjectURL(a.href);
    });
  }

  private admin = inject(AdminService);
  i18n = inject(I18nService);
  cur = inject(CurrencyService);
  get es() { return this.i18n.isES(); }

  tab = signal(0);
  games = signal<Game[]>([]);
  msg = signal(''); err = signal('');
  conditions = CONDITIONS;

  gForm = { code: '', name: '', iconUrl: '' };
  setGameId = ''; sets = signal<CardSet[]>([]);
  sForm = { code: '', name: '', series: '', totalCards: 0, releaseDate: '' };
  cardGameId = ''; cardSetId = ''; cardSets = signal<CardSet[]>([]); cards = signal<CardModel[]>([]);
  cForm = { name: '', number: '', rarity: '', cardType: '', imageUrl: '', variantsCsv: 'Normal,Reverse Holo' };
  q = ''; results = signal<CardModel[]>([]); selected = signal<CardModel | null>(null); inventory = signal<InventoryItem[]>([]);
  invForm = { condition: 'NM' as CardCondition, language: 'EN', isFoil: false, price: 0, quantity: 1 };
  private timer: any;

  constructor() {
    this.loadStats();
    // Si hay una actualización de precios corriendo, retomar el progreso.
    this.http.get<PriceJob>(environment.apiUrl + '/cards/update-prices/status').subscribe((j) => {
      if (j?.running) this.pollPriceJob();
      else if (j?.startedAt) this.priceJob.set(j);
    });
 this.loadGames(); }
  private flash(ok: string) { this.msg.set(ok); this.err.set(''); setTimeout(() => this.msg.set(''), 2500); }
  private fail(e: any) { this.err.set(e?.error?.message ?? 'Error'); }
  loadGames() { this.catalog.games().subscribe((g) => this.games.set(g)); }

  createGame() { this.admin.createGame({ ...this.gForm }).subscribe({ next: () => { this.gForm = { code: '', name: '', iconUrl: '' }; this.loadGames(); this.flash(this.es ? 'Juego creado' : 'Game created'); }, error: (e) => this.fail(e) }); }
  deleteGame(g: Game) { if (!confirm(`${this.es ? 'Eliminar' : 'Delete'} ${g.name}?`)) return; this.admin.deleteGame(g.id).subscribe(() => this.loadGames()); }

  loadSets() { if (this.setGameId) this.catalog.sets(this.setGameId).subscribe((s) => this.sets.set(s)); else this.sets.set([]); }
  createSet() { this.admin.createSet({ gameId: this.setGameId, code: this.sForm.code, name: this.sForm.name, series: this.sForm.series || undefined, totalCards: Number(this.sForm.totalCards), releaseDate: this.sForm.releaseDate || undefined }).subscribe({ next: () => { this.sForm = { code: '', name: '', series: '', totalCards: 0, releaseDate: '' }; this.loadSets(); this.flash(this.es ? 'Set creado' : 'Set created'); }, error: (e) => this.fail(e) }); }
  deleteSet(s: CardSet) { if (!confirm(`${this.es ? 'Eliminar set' : 'Delete set'} ${s.name}?`)) return; this.admin.deleteSet(s.id).subscribe(() => this.loadSets()); }

  onCardGame() { this.cardSetId = ''; this.cards.set([]); if (this.cardGameId) this.catalog.sets(this.cardGameId).subscribe((s) => this.cardSets.set(s)); else this.cardSets.set([]); }
  loadCards() { if (this.cardSetId) this.catalog.cards({ setId: this.cardSetId, limit: 100 }).subscribe((r) => this.cards.set(r.data)); else this.cards.set([]); }
  createCard() {
    const variants = this.cForm.variantsCsv.split(',').map((v) => v.trim()).filter(Boolean);
    this.admin.createCard({ gameId: this.cardGameId, setId: this.cardSetId, name: this.cForm.name, number: this.cForm.number, rarity: this.cForm.rarity || undefined, cardType: this.cForm.cardType || undefined, imageUrl: this.cForm.imageUrl || undefined, variants: variants.length ? variants : ['Normal'] })
      .subscribe({ next: () => { this.cForm = { name: '', number: '', rarity: '', cardType: '', imageUrl: '', variantsCsv: 'Normal,Reverse Holo' }; this.loadCards(); this.flash(this.es ? 'Carta creada' : 'Card created'); }, error: (e) => this.fail(e) });
  }
  deleteCard(c: CardModel) { if (!confirm(`${this.es ? 'Eliminar' : 'Delete'} ${c.name}?`)) return; this.admin.deleteCard(c.id).subscribe(() => this.loadCards()); }

  search() { clearTimeout(this.timer); this.timer = setTimeout(() => { if (!this.q.trim()) { this.results.set([]); return; } this.catalog.cards({ q: this.q, limit: 10 }).subscribe((r) => this.results.set(r.data)); }, 300); }
  select(c: CardModel) { this.selected.set(c); this.loadInv(c.id); }
  loadInv(id: string) { this.catalog.inventoryByCard(id).subscribe((inv) => this.inventory.set(inv)); }
  adjustInv(it: InventoryItem, delta: number) { this.admin.adjustStock(it.id, delta).subscribe({ next: (u) => this.inventory.update((l) => l.map((x) => (x.id === u.id ? u : x))), error: (e) => this.fail(e) }); }
  removeInv(it: InventoryItem) { this.admin.deleteInventory(it.id).subscribe(() => this.inventory.update((l) => l.filter((x) => x.id !== it.id))); }
  createInv(c: CardModel) { this.admin.createInventory({ cardModelId: c.id, condition: this.invForm.condition, language: this.invForm.language, isFoil: this.invForm.isFoil, price: Number(this.invForm.price), quantity: Number(this.invForm.quantity) }).subscribe({ next: () => this.loadInv(c.id), error: (e) => this.fail(e) }); }
}
