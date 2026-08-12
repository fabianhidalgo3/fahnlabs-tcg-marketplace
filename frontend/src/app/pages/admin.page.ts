import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { CatalogService } from '../core/services/catalog.service';
import { AdminService } from '../core/services/admin.service';
import { I18nService } from '../core/services/i18n.service';
import { CurrencyService } from '../core/services/currency.service';
import { CardCondition, CardModel, CardSet, Game, InventoryItem } from '../core/models/models';

const CONDITIONS: CardCondition[] = ['M', 'NM', 'LP', 'MP', 'HP', 'DMG'];

@Component({
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatTabsModule, MatCardModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatButtonModule, MatIconModule, MatCheckboxModule,
  ],
  template: `
    <h1>{{ es ? 'Administración' : 'Administration' }}</h1>
    <p class="muted">{{ es ? 'Gestiona juegos, sets, cartas e inventario.' : 'Manage games, sets, cards and inventory.' }}</p>

    @if (msg()) { <p class="ok">{{ msg() }}</p> }
    @if (err()) { <p class="err">{{ err() }}</p> }

    <mat-tab-group class="tabs" animationDuration="150ms">
      <!-- JUEGOS -->
      <mat-tab [label]="es ? 'Juegos' : 'Games'">
        <mat-card class="form" appearance="outlined">
          <mat-form-field appearance="outline"><mat-label>code</mat-label><input matInput [(ngModel)]="gForm.code" /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>{{ es ? 'Nombre' : 'Name' }}</mat-label><input matInput [(ngModel)]="gForm.name" /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>iconUrl</mat-label><input matInput [(ngModel)]="gForm.iconUrl" /></mat-form-field>
          <button mat-flat-button [disabled]="!gForm.code || !gForm.name" (click)="createGame()"><mat-icon>add</mat-icon>{{ es ? 'Crear' : 'Create' }}</button>
        </mat-card>
        <div class="list">
          @for (g of games(); track g.id) {
            <mat-card class="row" appearance="outlined">
              <span class="nm">{{ g.name }}</span><span class="muted">{{ g.code }}</span>
              <button mat-icon-button class="del" (click)="deleteGame(g)"><mat-icon>delete</mat-icon></button>
            </mat-card>
          }
        </div>
      </mat-tab>

      <!-- SETS -->
      <mat-tab label="Sets">
        <mat-form-field appearance="outline" class="picker">
          <mat-label>{{ es ? 'Juego' : 'Game' }}</mat-label>
          <mat-select [(ngModel)]="setGameId" (ngModelChange)="loadSets()">
            @for (g of games(); track g.id) { <mat-option [value]="g.id">{{ g.name }}</mat-option> }
          </mat-select>
        </mat-form-field>
        @if (setGameId) {
          <mat-card class="form" appearance="outlined">
            <mat-form-field appearance="outline"><mat-label>code</mat-label><input matInput [(ngModel)]="sForm.code" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>{{ es ? 'Nombre' : 'Name' }}</mat-label><input matInput [(ngModel)]="sForm.name" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>{{ es ? 'Serie' : 'Series' }}</mat-label><input matInput [(ngModel)]="sForm.series" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>{{ es ? 'Nº cartas' : 'Total' }}</mat-label><input matInput type="number" [(ngModel)]="sForm.totalCards" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>{{ es ? 'Lanzamiento' : 'Release' }}</mat-label><input matInput type="date" [(ngModel)]="sForm.releaseDate" /></mat-form-field>
            <button mat-flat-button [disabled]="!sForm.code || !sForm.name" (click)="createSet()"><mat-icon>add</mat-icon>{{ es ? 'Crear' : 'Create' }}</button>
          </mat-card>
          <div class="list">
            @for (s of sets(); track s.id) {
              <mat-card class="row" appearance="outlined">
                <span class="nm">{{ s.name }}</span><span class="muted">{{ s.code }} · {{ s.totalCards }}</span>
                <button mat-icon-button class="del" (click)="deleteSet(s)"><mat-icon>delete</mat-icon></button>
              </mat-card>
            } @empty { <p class="muted">{{ es ? 'Sin sets.' : 'No sets.' }}</p> }
          </div>
        }
      </mat-tab>

      <!-- CARTAS -->
      <mat-tab [label]="es ? 'Cartas' : 'Cards'">
        <div class="pickers">
          <mat-form-field appearance="outline">
            <mat-label>{{ es ? 'Juego' : 'Game' }}</mat-label>
            <mat-select [(ngModel)]="cardGameId" (ngModelChange)="onCardGame()">
              @for (g of games(); track g.id) { <mat-option [value]="g.id">{{ g.name }}</mat-option> }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Set</mat-label>
            <mat-select [(ngModel)]="cardSetId" (ngModelChange)="loadCards()">
              @for (s of cardSets(); track s.id) { <mat-option [value]="s.id">{{ s.name }}</mat-option> }
            </mat-select>
          </mat-form-field>
        </div>
        @if (cardSetId) {
          <mat-card class="form" appearance="outlined">
            <mat-form-field appearance="outline"><mat-label>{{ es ? 'Nombre' : 'Name' }}</mat-label><input matInput [(ngModel)]="cForm.name" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>Nº</mat-label><input matInput [(ngModel)]="cForm.number" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>{{ es ? 'Rareza' : 'Rarity' }}</mat-label><input matInput [(ngModel)]="cForm.rarity" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>cardType</mat-label><input matInput [(ngModel)]="cForm.cardType" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>imageUrl</mat-label><input matInput [(ngModel)]="cForm.imageUrl" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>{{ es ? 'Variantes' : 'Variants' }}</mat-label><input matInput [(ngModel)]="cForm.variantsCsv" /></mat-form-field>
            <button mat-flat-button [disabled]="!cForm.name || !cForm.number" (click)="createCard()"><mat-icon>add</mat-icon>{{ es ? 'Crear' : 'Create' }}</button>
          </mat-card>
          <div class="list">
            @for (c of cards(); track c.id) {
              <mat-card class="row" appearance="outlined">
                <span class="mono muted">{{ c.number }}</span><span class="nm">{{ c.name }}</span><span class="muted">{{ c.rarity }}</span>
                <button mat-icon-button class="del" (click)="deleteCard(c)"><mat-icon>delete</mat-icon></button>
              </mat-card>
            } @empty { <p class="muted">{{ es ? 'Sin cartas.' : 'No cards.' }}</p> }
          </div>
        }
      </mat-tab>

      <!-- INVENTARIO -->
      <mat-tab [label]="es ? 'Inventario' : 'Inventory'">
        <mat-form-field appearance="outline" class="picker">
          <mat-icon matPrefix>search</mat-icon>
          <mat-label>{{ i18n.t('admin.search') }}</mat-label>
          <input matInput [(ngModel)]="q" (ngModelChange)="search()" />
        </mat-form-field>
        @if (results().length) {
          <div class="results">
            @for (c of results(); track c.id) {
              <button mat-stroked-button class="res" [class.sel]="selected()?.id === c.id" (click)="select(c)">
                {{ c.name }} <span class="muted">· {{ c.game?.name }} · {{ c.number }}</span>
              </button>
            }
          </div>
        }
        @if (selected(); as c) {
          <mat-card class="manage" appearance="outlined">
            <h3>{{ c.name }} <span class="muted">{{ c.number }}</span></h3>
            <div class="inv">
              @for (it of inventory(); track it.id) {
                <div class="irow">
                  <span class="cond">{{ it.condition }}@if (it.isFoil) { · FOIL }</span>
                  <span class="muted">{{ it.language }}</span>
                  <span class="price">{{ cur.format(it.price) }}</span>
                  <span class="stock">stock: <b>{{ it.quantity }}</b></span>
                  <span class="acts">
                    <button mat-icon-button (click)="adjustInv(it, -1)"><mat-icon>remove</mat-icon></button>
                    <button mat-icon-button (click)="adjustInv(it, 1)"><mat-icon>add</mat-icon></button>
                    <button mat-icon-button (click)="removeInv(it)"><mat-icon>delete</mat-icon></button>
                  </span>
                </div>
              } @empty { <p class="muted">{{ i18n.t('admin.noInv') }}</p> }
            </div>
            <div class="form nopad">
              <mat-form-field appearance="outline"><mat-label>{{ es ? 'Condición' : 'Condition' }}</mat-label>
                <mat-select [(ngModel)]="invForm.condition">@for (cd of conditions; track cd) { <mat-option [value]="cd">{{ cd }}</mat-option> }</mat-select>
              </mat-form-field>
              <mat-form-field appearance="outline"><mat-label>{{ i18n.t('admin.language') }}</mat-label><input matInput [(ngModel)]="invForm.language" /></mat-form-field>
              <mat-checkbox [(ngModel)]="invForm.isFoil">Foil</mat-checkbox>
              <mat-form-field appearance="outline"><mat-label>{{ i18n.t('admin.price') }}</mat-label><input matInput type="number" [(ngModel)]="invForm.price" /></mat-form-field>
              <mat-form-field appearance="outline"><mat-label>{{ i18n.t('admin.qty') }}</mat-label><input matInput type="number" [(ngModel)]="invForm.quantity" /></mat-form-field>
              <button mat-flat-button (click)="createInv(c)"><mat-icon>add</mat-icon>{{ i18n.t('admin.add') }}</button>
            </div>
          </mat-card>
        }
      </mat-tab>
    </mat-tab-group>
  `,
  styles: [
    `
      h1 { margin-bottom: 2px; }
      .tabs { margin-top: 16px; }
      .form { display: flex; flex-wrap: wrap; gap: 12px; padding: 16px; margin: 18px 0; align-items: center; }
      .form.nopad { box-shadow: none; border: none; padding: 8px 0 0; }
      .form mat-form-field { width: 160px; --mat-form-field-container-vertical-padding: 6px; }
      .picker { width: 280px; margin: 16px 0; }
      .pickers { display: flex; gap: 12px; margin: 16px 0; }
      .pickers mat-form-field { width: 240px; }
      .list { display: flex; flex-direction: column; gap: 8px; }
      .row { display: flex; align-items: center; gap: 14px; padding: 10px 16px; }
      .row .nm { font-weight: 700; }
      .row .mono { font-variant-numeric: tabular-nums; min-width: 80px; }
      .row .del { margin-left: auto; }
      .results { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
      .res { justify-content: flex-start; text-align: left; }
      .res.sel { border-color: var(--primary); }
      .manage { padding: 20px; }
      .inv { display: flex; flex-direction: column; gap: 4px; margin: 12px 0 12px; }
      .irow { display: grid; grid-template-columns: 100px 60px 100px 1fr auto; align-items: center; gap: 12px; padding: 4px; }
      .cond { font-weight: 700; } .price { color: var(--accent); font-weight: 700; }
      .acts { display: flex; gap: 2px; }
      .ok { color: var(--success); } .err { color: var(--danger); }
      @media (max-width: 720px) { .irow { grid-template-columns: 1fr 1fr; } }
    `,
  ],
})
export class AdminPage {
  private catalog = inject(CatalogService);
  private admin = inject(AdminService);
  i18n = inject(I18nService);
  cur = inject(CurrencyService);
  get es() { return this.i18n.isES(); }

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
