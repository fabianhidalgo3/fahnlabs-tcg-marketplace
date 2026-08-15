import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TuiButton, TuiTextfield, TuiInput, TuiCheckbox } from '@taiga-ui/core';
import { TuiTabs } from '@taiga-ui/kit';
import { TuiTable } from '@taiga-ui/addon-table';
import { CatalogService } from '../core/services/catalog.service';
import { AdminService } from '../core/services/admin.service';
import { I18nService } from '../core/services/i18n.service';
import { CurrencyService } from '../core/services/currency.service';
import { CardCondition, CardModel, CardSet, Game, InventoryItem } from '../core/models/models';

const CONDITIONS: CardCondition[] = ['M', 'NM', 'LP', 'MP', 'HP', 'DMG'];

@Component({
  standalone: true,
  imports: [
    CommonModule, FormsModule, TuiButton, TuiTextfield, TuiInput, TuiCheckbox, TuiTabs, TuiTable,
  ],
  template: `
    <header class="page-head">
      <h1>{{ es ? 'Administración' : 'Administration' }}</h1>
      <p class="muted">{{ es ? 'Gestiona juegos, sets, cartas e inventario.' : 'Manage games, sets, cards and inventory.' }}</p>
    </header>

    @if (msg()) { <div class="msg ok"><span class="mi">check_circle</span>{{ msg() }}</div> }
    @if (err()) { <div class="msg err"><span class="mi">error</span>{{ err() }}</div> }

    <tui-tabs class="tabs" [activeItemIndex]="tab()" (activeItemIndexChange)="tab.set($event)">
      <button tuiTab type="button">{{ es ? 'Juegos' : 'Games' }}</button>
      <button tuiTab type="button">Sets</button>
      <button tuiTab type="button">{{ es ? 'Cartas' : 'Cards' }}</button>
      <button tuiTab type="button">{{ es ? 'Inventario' : 'Inventory' }}</button>
    </tui-tabs>

    <!-- ===================== JUEGOS ===================== -->
    @if (tab() === 0) {
      <section class="block card-surface">
        <div class="block-head">
          <h3>{{ es ? 'Nuevo juego' : 'New game' }}</h3>
          <p class="muted">{{ es ? 'Crea un juego para agrupar sets y cartas.' : 'Create a game to group sets and cards.' }}</p>
        </div>
        <div class="form-grid">
          <tui-textfield><label tuiLabel>code</label><input tuiInput [(ngModel)]="gForm.code" /></tui-textfield>
          <tui-textfield><label tuiLabel>{{ es ? 'Nombre' : 'Name' }}</label><input tuiInput [(ngModel)]="gForm.name" /></tui-textfield>
          <tui-textfield><label tuiLabel>iconUrl</label><input tuiInput [(ngModel)]="gForm.iconUrl" /></tui-textfield>
        </div>
        <div class="form-actions">
          <button tuiButton type="button" appearance="primary" size="m" [disabled]="!gForm.code || !gForm.name" (click)="createGame()"><span class="mi">add</span>{{ es ? 'Crear' : 'Create' }}</button>
        </div>
      </section>

      <section class="block card-surface tablecard">
        <table tuiTable class="dtable">
          <thead>
            <tr>
              <th tuiTh>{{ es ? 'Nombre' : 'Name' }}</th>
              <th tuiTh>{{ es ? 'Código' : 'Code' }}</th>
              <th tuiTh class="acol"></th>
            </tr>
          </thead>
          <tbody tuiTbody>
            @for (g of games(); track g.id) {
              <tr>
                <td tuiTd><b>{{ g.name }}</b></td>
                <td tuiTd class="muted mono">{{ g.code }}</td>
                <td tuiTd class="acol"><button class="icon-btn sm" (click)="deleteGame(g)"><span class="mi">delete</span></button></td>
              </tr>
            } @empty { <tr><td tuiTd colspan="3" class="empty">{{ es ? 'Aún no hay juegos.' : 'No games yet.' }}</td></tr> }
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
            <option value="">{{ es ? '— Selecciona un juego —' : '— Select a game —' }}</option>
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
            <tui-textfield><label tuiLabel>code</label><input tuiInput [(ngModel)]="sForm.code" /></tui-textfield>
            <tui-textfield><label tuiLabel>{{ es ? 'Nombre' : 'Name' }}</label><input tuiInput [(ngModel)]="sForm.name" /></tui-textfield>
            <tui-textfield><label tuiLabel>{{ es ? 'Serie' : 'Series' }}</label><input tuiInput [(ngModel)]="sForm.series" /></tui-textfield>
            <tui-textfield><label tuiLabel>{{ es ? 'Nº cartas' : 'Total' }}</label><input tuiInput type="number" [(ngModel)]="sForm.totalCards" /></tui-textfield>
            <tui-textfield><label tuiLabel>{{ es ? 'Lanzamiento' : 'Release' }}</label><input tuiInput type="date" [(ngModel)]="sForm.releaseDate" /></tui-textfield>
          </div>
          <div class="form-actions">
            <button tuiButton type="button" appearance="primary" size="m" [disabled]="!sForm.code || !sForm.name" (click)="createSet()"><span class="mi">add</span>{{ es ? 'Crear' : 'Create' }}</button>
          </div>
        </section>

        <section class="block card-surface tablecard">
          <table tuiTable class="dtable">
            <thead>
              <tr>
                <th tuiTh>{{ es ? 'Nombre' : 'Name' }}</th>
                <th tuiTh>{{ es ? 'Código' : 'Code' }}</th>
                <th tuiTh class="r">{{ es ? 'Nº cartas' : 'Total' }}</th>
                <th tuiTh class="acol"></th>
              </tr>
            </thead>
            <tbody tuiTbody>
              @for (s of sets(); track s.id) {
                <tr>
                  <td tuiTd><b>{{ s.name }}</b></td>
                  <td tuiTd class="muted mono">{{ s.code }}</td>
                  <td tuiTd class="r">{{ s.totalCards }}</td>
                  <td tuiTd class="acol"><button class="icon-btn sm" (click)="deleteSet(s)"><span class="mi">delete</span></button></td>
                </tr>
              } @empty { <tr><td tuiTd colspan="4" class="empty">{{ es ? 'Sin sets.' : 'No sets.' }}</td></tr> }
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
            <option value="">{{ es ? '— Selecciona —' : '— Select —' }}</option>
            @for (g of games(); track g.id) { <option [value]="g.id">{{ g.name }}</option> }
          </select>
        </div>
        <div class="ui-field">
          <span class="lbl">Set</span>
          <select class="ui-select" [(ngModel)]="cardSetId" (ngModelChange)="loadCards()" [disabled]="!cardGameId">
            <option value="">{{ es ? '— Selecciona —' : '— Select —' }}</option>
            @for (s of cardSets(); track s.id) { <option [value]="s.id">{{ s.name }}</option> }
          </select>
        </div>
      </div>

      @if (cardSetId) {
        <section class="block card-surface">
          <div class="block-head"><h3>{{ es ? 'Nueva carta' : 'New card' }}</h3></div>
          <div class="form-grid">
            <tui-textfield><label tuiLabel>{{ es ? 'Nombre' : 'Name' }}</label><input tuiInput [(ngModel)]="cForm.name" /></tui-textfield>
            <tui-textfield><label tuiLabel>Nº</label><input tuiInput [(ngModel)]="cForm.number" /></tui-textfield>
            <tui-textfield><label tuiLabel>{{ es ? 'Rareza' : 'Rarity' }}</label><input tuiInput [(ngModel)]="cForm.rarity" /></tui-textfield>
            <tui-textfield><label tuiLabel>cardType</label><input tuiInput [(ngModel)]="cForm.cardType" /></tui-textfield>
            <tui-textfield><label tuiLabel>imageUrl</label><input tuiInput [(ngModel)]="cForm.imageUrl" /></tui-textfield>
            <tui-textfield><label tuiLabel>{{ es ? 'Variantes' : 'Variants' }}</label><input tuiInput [(ngModel)]="cForm.variantsCsv" /></tui-textfield>
          </div>
          <div class="form-actions">
            <button tuiButton type="button" appearance="primary" size="m" [disabled]="!cForm.name || !cForm.number" (click)="createCard()"><span class="mi">add</span>{{ es ? 'Crear' : 'Create' }}</button>
          </div>
        </section>

        <section class="block card-surface tablecard">
          <table tuiTable class="dtable">
            <thead>
              <tr>
                <th tuiTh class="ncol">Nº</th>
                <th tuiTh>{{ es ? 'Nombre' : 'Name' }}</th>
                <th tuiTh>{{ es ? 'Rareza' : 'Rarity' }}</th>
                <th tuiTh class="acol"></th>
              </tr>
            </thead>
            <tbody tuiTbody>
              @for (c of cards(); track c.id) {
                <tr>
                  <td tuiTd class="mono muted">{{ c.number }}</td>
                  <td tuiTd><b>{{ c.name }}</b></td>
                  <td tuiTd class="muted">{{ c.rarity }}</td>
                  <td tuiTd class="acol"><button class="icon-btn sm" (click)="deleteCard(c)"><span class="mi">delete</span></button></td>
                </tr>
              } @empty { <tr><td tuiTd colspan="4" class="empty">{{ es ? 'Sin cartas.' : 'No cards.' }}</td></tr> }
            </tbody>
          </table>
        </section>
      }
    }

    <!-- ===================== INVENTARIO ===================== -->
    @if (tab() === 3) {
      <section class="block card-surface">
        <div class="block-head"><h3>{{ es ? 'Buscar carta' : 'Find card' }}</h3></div>
        <tui-textfield class="searchfield" iconStart="@tui.search">
          <label tuiLabel>{{ i18n.t('admin.search') }}</label>
          <input tuiInput [(ngModel)]="q" (ngModelChange)="search()" />
        </tui-textfield>
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
          <table tuiTable class="dtable">
            <thead>
              <tr>
                <th tuiTh>{{ es ? 'Condición' : 'Condition' }}</th>
                <th tuiTh>{{ es ? 'Idioma' : 'Language' }}</th>
                <th tuiTh class="r">{{ i18n.t('admin.price') }}</th>
                <th tuiTh class="c">Stock</th>
                <th tuiTh class="acol"></th>
              </tr>
            </thead>
            <tbody tuiTbody>
              @for (it of inventory(); track it.id) {
                <tr>
                  <td tuiTd><b>{{ it.condition }}</b>@if (it.isFoil) { <span class="foiltag">FOIL</span> }</td>
                  <td tuiTd class="muted">{{ it.language }}</td>
                  <td tuiTd class="r price">{{ cur.format(it.price) }}</td>
                  <td tuiTd class="c"><b>{{ it.quantity }}</b></td>
                  <td tuiTd class="acol">
                    <div class="rowacts">
                      <button class="icon-btn sm" (click)="adjustInv(it, -1)"><span class="mi">remove</span></button>
                      <button class="icon-btn sm" (click)="adjustInv(it, 1)"><span class="mi">add</span></button>
                      <button class="icon-btn sm" (click)="removeInv(it)"><span class="mi">delete</span></button>
                    </div>
                  </td>
                </tr>
              } @empty { <tr><td tuiTd colspan="5" class="empty">{{ i18n.t('admin.noInv') }}</td></tr> }
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
              <tui-textfield><label tuiLabel>{{ i18n.t('admin.language') }}</label><input tuiInput [(ngModel)]="invForm.language" /></tui-textfield>
              <tui-textfield><label tuiLabel>{{ i18n.t('admin.price') }}</label><input tuiInput type="number" [(ngModel)]="invForm.price" /></tui-textfield>
              <tui-textfield><label tuiLabel>{{ i18n.t('admin.qty') }}</label><input tuiInput type="number" [(ngModel)]="invForm.quantity" /></tui-textfield>
              <label class="cb-row foilbox"><input tuiCheckbox type="checkbox" [(ngModel)]="invForm.isFoil" /> Foil</label>
            </div>
            <div class="form-actions">
              <button tuiButton type="button" appearance="primary" size="m" (click)="createInv(c)"><span class="mi">add</span>{{ i18n.t('admin.add') }}</button>
            </div>
          </div>
        </section>
      }
    }
  `,
  styles: [
    `
      .page-head { margin-bottom: 8px; }
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

      .tablecard { padding: 8px 8px; }
      .dtable { width: 100%; }
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
  private catalog = inject(CatalogService);
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

  constructor() { this.loadGames(); }
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
