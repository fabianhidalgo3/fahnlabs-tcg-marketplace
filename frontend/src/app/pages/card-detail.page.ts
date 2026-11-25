import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CatalogService } from '../core/services/catalog.service';
import { CartService } from '../core/services/cart.service';
import { AuthService } from '../core/services/auth.service';
import { AdminService } from '../core/services/admin.service';
import { I18nService } from '../core/services/i18n.service';
import { CurrencyService } from '../core/services/currency.service';
import { CardCondition, CardLang, CardModel, CardSale, InventoryItem, PricePoint } from '../core/models/models';
import { CollectionService, MyCopies } from '../core/services/collection.service';
import { fullUrl } from '../core/utils/card-image';
import { SetChipComponent } from '../shared/set-chip.component';
import { FavBtnComponent } from '../shared/fav-btn.component';

const CONDITION_LABEL: Record<string, string> = {
  M: 'Mint', NM: 'Near Mint', LP: 'Lightly Played', MP: 'Moderately Played', HP: 'Heavily Played', DMG: 'Damaged',
};

@Component({
  standalone: true,
  imports: [
    CommonModule, RouterLink, FormsModule, SetChipComponent, FavBtnComponent,
  ],
  template: `
    @if (card(); as c) {
      <a class="btn btn-ghost btn-s back" routerLink="/catalogo"><span class="mi">arrow_back</span>{{ i18n.t('card.back') }}</a>
      <div class="layout">
        <div class="art card-surface">
          @if (c.imageUrl) { <img [src]="full(c.imageUrl)" [alt]="c.name" decoding="async" /> }
          @else { <div class="noimg">{{ i18n.isES() ? 'Sin imagen' : 'No image' }}</div> }
        </div>

        <div class="info">
          <div class="crumbs muted">
            {{ c.game?.name }} ·
            <app-set-chip [set]="c.set" [link]="c.set ? ['/sets', c.set.id] : null" [extra]="c.number" />
          </div>
          <div class="titlerow">
            <h1>{{ c.name }}</h1>
            <app-fav-btn class="flat" kind="card" [id]="c.id" />
            <button class="icon-btn sm" type="button" (click)="share(c)" [title]="i18n.isES() ? 'Compartir' : 'Share'">
              <span class="mi">{{ shared() ? 'check' : 'share' }}</span>
            </button>
          </div>
          <div class="badge-set badges">
            @if (c.cardType) { <span class="badge">{{ c.cardType }}</span> }
            @if (c.rarity) { <span class="badge">{{ c.rarity }}</span> }
          </div>

          @if (attrRows(c).length) {
            <div class="attrs card-surface">
              <h3>{{ i18n.t('card.attributes') }}</h3>
              <div class="attr-grid">
                @for (row of attrRows(c); track row.key) {
                  <div class="attr"><span class="k muted">{{ row.key }}</span><span class="v">{{ row.value }}</span></div>
                }
              </div>
            </div>
          }

          @if (auth.isLoggedIn()) {
            <div class="mine card-surface">
              <h3>
                <span class="mi">collections_bookmark</span>
                {{ i18n.isES() ? 'Mi colección' : 'My collection' }}
                <span class="tot" [class.zero]="!copies()?.total">×{{ copies()?.total ?? 0 }}</span>
              </h3>
              @for (v of c.variants ?? ['Normal']; track v) {
                <div class="mrow">
                  <span class="vtag" [class.rev]="v !== 'Normal'">{{ v }}</span>
                  @for (lg of langs; track lg) {
                    <span class="lgroup">
                      <span class="muted lg">{{ lg }}</span>
                      <button class="icon-btn sm" type="button" [disabled]="qty(v, lg) === 0 || saving()" (click)="adj(v, lg, -1)"><span class="mi">remove</span></button>
                      <b class="q" [class.zero]="qty(v, lg) === 0">{{ qty(v, lg) }}</b>
                      <button class="icon-btn sm" type="button" [disabled]="saving()" (click)="adj(v, lg, 1)"><span class="mi">add</span></button>
                    </span>
                  }
                  <span class="malbums">
                    @for (a of albums(v); track a.id) {
                      <a class="albchip" [routerLink]="['/almacenamiento', a.id]" [style.border-left-color]="a.color || 'var(--primary)'">
                        <span class="mi">auto_stories</span>{{ a.name }}
                      </a>
                    }
                  </span>
                </div>
              }
            </div>
          }

          <!-- Referencia de precio por variante -->
          <div class="pref card-surface">
            <h3><span class="mi">payments</span> {{ i18n.isES() ? 'Referencia de precio' : 'Price reference' }}</h3>
            <table class="preft">
              <thead><tr><th>{{ i18n.isES() ? 'Variante' : 'Variant' }}</th><th class="r">CLP</th><th class="r">USD</th></tr></thead>
              <tbody>
                @for (v of c.variants ?? ['Normal']; track v) {
                  <tr>
                    <td><span class="vtag" [class.rev]="v !== 'Normal'">{{ v }}</span></td>
                    <td class="r clp">{{ '$' + (cur.toClp(c.variantValues?.[v] ?? 0) | number:'1.0-0') }} CLP</td>
                    <td class="r muted">{{ (c.variantValues?.[v] ?? 0) | number:'1.2-2' }} USD</td>
                  </tr>
                }
              </tbody>
            </table>
            <p class="srcnote muted">
              {{ i18n.isES() ? 'Mercado TCGplayer/Cardmarket con pisos retail CL' : 'TCGplayer/Cardmarket market with CL retail floors' }}
              @if (history().length) { · {{ i18n.isES() ? 'actualizado' : 'updated' }} {{ history()[history().length - 1].date }} }
              @if (cur.rateDate()) { · 1 USD = {{ cur.rate() | number:'1.0-2' }} CLP ({{ cur.rateDate() }}, mindicador.cl) }
            </p>
          </div>

          <!-- Historial de precio -->
          @if (history().length > 1) {
            <div class="hist card-surface">
              <h3>
                <span class="mi">show_chart</span> {{ i18n.isES() ? 'Historial de precio' : 'Price history' }}
                @if (histVariants().length > 1) {
                  <select class="ui-select hsel" [ngModel]="histVariant()" (ngModelChange)="histVariant.set($event)">
                    @for (v of histVariants(); track v) { <option [value]="v">{{ v }}</option> }
                  </select>
                }
                @if (histChange() !== null) {
                  <span class="delta" [class.up]="histChange()! > 0" [class.down]="histChange()! < 0">
                    {{ histChange()! > 0 ? '▲' : histChange()! < 0 ? '▼' : '' }} {{ histChange() | number:'1.1-1' }}%
                  </span>
                }
              </h3>
              <svg class="chart" viewBox="0 0 320 90" preserveAspectRatio="none">
                <polyline [attr.points]="histPoints()" fill="none" stroke="var(--primary)" stroke-width="2" vector-effect="non-scaling-stroke" />
              </svg>
              <div class="hlbl muted">
                <span>{{ history()[0].date }}</span>
                <span>{{ history()[history().length - 1].date }}</span>
              </div>
            </div>
          } @else if (history().length === 1) {
            <p class="muted hist-note">{{ i18n.isES() ? 'Historial de precio: registrando desde ' + history()[0].date + ' — el gráfico aparecerá con más días de datos.' : 'Price history: tracking since ' + history()[0].date + '.' }}</p>
          }

          <!-- Últimas ventas -->
          @if (sales().length) {
            <div class="sales card-surface">
              <h3><span class="mi">receipt_long</span> {{ i18n.isES() ? 'Últimas ventas' : 'Latest sales' }}</h3>
              @for (s of sales(); track $index) {
                <div class="srow">
                  <span class="muted sdate">{{ s.date | date:'dd/MM/yy' }}</span>
                  <span>{{ s.language }} · {{ label(s.condition ?? '') }}@if (s.isFoil) { <span class="foil">FOIL</span> }</span>
                  <span class="muted">{{ s.quantity }}x</span>
                  <b class="price">{{ cur.format(s.unitPrice) }}</b>
                </div>
              }
            </div>
          }

          <h3 class="inv-title">{{ i18n.t('card.availability') }}</h3>
          @if (inventory().length === 0) {
            <p class="muted">{{ i18n.t('card.noStock') }}</p>
          } @else {
            <div class="invfilters">
              <select class="ui-select isel" [ngModel]="invLang()" (ngModelChange)="invLang.set($event)">
                <option value="">{{ i18n.isES() ? 'Idioma: todos' : 'Language: all' }}</option>
                @for (l of invLangs(); track l) { <option [value]="l">{{ l }}</option> }
              </select>
              <select class="ui-select isel" [ngModel]="invCond()" (ngModelChange)="invCond.set($event)">
                <option value="">{{ i18n.isES() ? 'Condición: todas' : 'Condition: all' }}</option>
                @for (cd of invConds(); track cd) { <option [value]="cd">{{ label(cd) }}</option> }
              </select>
              <button class="icon-btn" type="button" (click)="invSort.set(invSort() === 'asc' ? 'desc' : 'asc')" [title]="invSort() === 'asc' ? 'Precio: menor a mayor' : 'Precio: mayor a menor'">
                <span class="mi">{{ invSort() === 'asc' ? 'north' : 'south' }}</span>
              </button>
            </div>
            @if (filteredInventory().length === 0) {
              <p class="muted">{{ i18n.isES() ? 'Sin unidades con ese filtro.' : 'No units match that filter.' }}</p>
            }
            <div class="inv">
              @for (it of filteredInventory(); track it.id) {
                <div class="row card-surface">
                  <div>
                    <div class="cond">{{ label(it.condition) }}@if (it.isFoil) { <span class="foil">FOIL</span> }</div>
                    <div class="muted sku">{{ it.language }} · {{ it.seller?.name ? ((i18n.isES() ? 'Vendido por ' : 'Sold by ') + it.seller?.name) : (i18n.isES() ? 'Tienda SingleTCG' : 'SingleTCG store') }}</div>
                  </div>
                  <div class="right">
                    <div class="price">{{ cur.format(it.price) }}</div>
                    <div class="muted">{{ it.quantity }} {{ i18n.t('card.available') }}</div>
                  </div>
                  <button class="btn btn-primary btn-s" type="button" [disabled]="it.quantity === 0" (click)="addToCart(it, c)">
                    <span class="mi">add_shopping_cart</span>{{ i18n.t('card.add') }}
                  </button>
                </div>
              }
            </div>
          }

          @if (auth.isAdmin()) {
            <div class="edit card-surface">
              <h3><span class="mi">edit</span> {{ i18n.isES() ? 'Editar inventario' : 'Edit inventory' }}</h3>
              @for (it of inventory(); track it.id) {
                <div class="erow">
                  <span class="ec">{{ it.condition }}@if (it.isFoil) { · FOIL }</span>
                  <span class="muted">{{ it.language }}</span>
                  <span class="ep">{{ cur.format(it.price) }}</span>
                  <span class="es">stock: <b>{{ it.quantity }}</b></span>
                  <span class="eacts">
                    <button class="icon-btn sm" (click)="adjustStock(it, -1)"><span class="mi">remove</span></button>
                    <button class="icon-btn sm" (click)="adjustStock(it, 1)"><span class="mi">add</span></button>
                    <button class="icon-btn sm del" (click)="removeUnit(it)"><span class="mi">delete</span></button>
                  </span>
                </div>
              }
              <div class="eform">
                <div class="ui-field f">
                  <span class="lbl">{{ i18n.isES() ? 'Condición' : 'Condition' }}</span>
                  <select class="ui-select" [(ngModel)]="form.condition">
                    @for (c2 of conditions; track c2) { <option [value]="c2">{{ c2 }}</option> }
                  </select>
                </div>
                <label class="ui-field f"><span class="lbl">{{ i18n.t('admin.language') }}</span><input class="ui-input" placeholder="EN" [(ngModel)]="form.language" /></label>
                <label class="cb-row"><input class="ui-check" type="checkbox" [(ngModel)]="form.isFoil" /> Foil</label>
                <label class="ui-field f"><span class="lbl">{{ i18n.t('admin.price') }} (USD)</span><input class="ui-input" type="number" placeholder="0.00" [(ngModel)]="form.price" /></label>
                <label class="ui-field f"><span class="lbl">{{ i18n.t('admin.qty') }}</span><input class="ui-input" type="number" placeholder="1" [(ngModel)]="form.quantity" /></label>
                <button class="btn btn-primary btn-s" type="button" (click)="addUnit()"><span class="mi">add</span>{{ i18n.t('admin.add') }}</button>
              </div>
              @if (editError()) { <p class="err">{{ editError() }}</p> }
            </div>
          }
        </div>
      </div>
    } @else {
      <p class="muted">{{ i18n.t('catalog.loading') }}</p>
    }
  `,
  styles: [
    `
      .back { margin-bottom: 12px; }
      .layout { display: grid; grid-template-columns: 340px 1fr; gap: 30px; }
      .art { padding: 16px; align-self: start; }
      .art img { width: 100%; border-radius: 8px; display: block; }
      .noimg { aspect-ratio: 63/88; display: grid; place-items: center; color: var(--muted); }
      .crumbs { font-size: 13px; }
      .titlerow { display: flex; align-items: center; gap: 10px; }
      .crumbs a { color: var(--primary); }
      h1 { font-size: 30px; margin: 6px 0 10px; }
      .badges { margin-bottom: 18px; }
      .attrs { padding: 16px; margin-bottom: 22px; }
      .attr-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; margin-top: 10px; }
      .attr { display: flex; flex-direction: column; gap: 2px; }
      .attr .k { font-size: 12px; text-transform: capitalize; }
      .attr .v { font-weight: 700; }
      .inv-title { margin-bottom: 12px; }
      /* Referencia de precio */
      .pref { padding: 16px; margin-bottom: 22px; }
      .pref h3 { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
      .preft { width: 100%; border-collapse: collapse; font-size: 13px; }
      .preft th { text-align: left; color: var(--muted); font-size: 12px; font-weight: 600; padding: 6px 4px; border-bottom: 1px solid var(--border); }
      .preft td { padding: 7px 4px; border-bottom: 1px solid var(--border); }
      .preft tr:last-child td { border-bottom: none; }
      .preft .r { text-align: right; }
      .preft .clp { font-weight: 800; color: var(--accent); }
      .srcnote { font-size: 11px; margin-top: 8px; }
      /* Historial de precio */
      .hist { padding: 16px; margin-bottom: 22px; }
      .hist h3 { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
      .hsel { width: auto; margin-left: 6px; padding: 2px 26px 2px 8px; font-size: 12px; height: 28px; }
      .delta { margin-left: auto; font-size: 13px; font-weight: 800; }
      .delta.up { color: var(--success, #12b76a); }
      .delta.down { color: var(--danger, #f04438); }
      .chart { width: 100%; height: 90px; display: block; background: var(--bg-soft); border-radius: 8px; }
      .hlbl { display: flex; justify-content: space-between; font-size: 11px; margin-top: 6px; }
      .hist-note { margin-bottom: 22px; font-size: 13px; }
      /* Últimas ventas */
      .sales { padding: 16px; margin-bottom: 22px; }
      .sales h3 { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
      .srow { display: flex; align-items: center; gap: 14px; padding: 7px 0; border-top: 1px solid var(--border); font-size: 13px; }
      .srow .sdate { min-width: 62px; }
      .srow .price { margin-left: auto; }
      /* Filtros de disponibilidad */
      .invfilters { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
      .isel { width: auto; min-width: 160px; }
      /* Mi colección: copias por variante+idioma */
      .mine { padding: 16px; margin-bottom: 22px; }
      .mine h3 { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
      .mine .tot { margin-left: auto; background: var(--primary); color: #fff; font-size: 13px; font-weight: 800; padding: 2px 10px; border-radius: 999px; }
      .mine .tot.zero { background: var(--card-2); color: var(--muted); border: 1px solid var(--border); }
      .mrow { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; padding: 8px 0; border-top: 1px solid var(--border); }
      .mine .vtag, .pref .vtag { min-width: 92px; text-align: center; }
      .lgroup { display: inline-flex; align-items: center; gap: 6px; }
      .lgroup .lg { font-size: 11px; font-weight: 700; }
      .lgroup .q { min-width: 18px; text-align: center; font-size: 14px; }
      .lgroup .q.zero { color: var(--muted); font-weight: 500; }
      .malbums { display: inline-flex; gap: 6px; flex-wrap: wrap; margin-left: auto; }
      .inv { display: flex; flex-direction: column; gap: 10px; }
      .row { display: grid; grid-template-columns: 1fr auto auto; align-items: center; gap: 16px; padding: 14px 16px; }
      .cond { font-weight: 700; }
      .foil { font-size: 11px; background: linear-gradient(90deg,#ffd54a,#ff6b6b); color: #000; padding: 1px 6px; border-radius: 5px; margin-left: 6px; }
      .sku { font-size: 12px; margin-top: 2px; }
      .price { font-weight: 800; color: var(--accent); font-size: 17px; }
      .edit { margin-top: 26px; padding: 18px; }
      .edit h3 { display: flex; align-items: center; gap: 6px; margin-bottom: 14px; }
      .erow { display: grid; grid-template-columns: 90px 50px 90px 1fr auto; align-items: center; gap: 10px; padding: 6px 4px; }
      .ec { font-weight: 700; } .ep { color: var(--accent); font-weight: 700; }
      .eacts { display: flex; gap: 2px; }
      .eform { display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-end; margin-top: 12px; }
      .eform .f { width: 130px; }
      .err { color: var(--danger); margin-top: 10px; }
      @media (max-width: 760px) { .layout { grid-template-columns: 1fr; } }
    `,
  ],
})
export class CardDetailPage {
  full = fullUrl;
  private catalog = inject(CatalogService);
  private cart = inject(CartService);
  private admin = inject(AdminService);
  private collection = inject(CollectionService);
  auth = inject(AuthService);
  i18n = inject(I18nService);
  cur = inject(CurrencyService);

  id = input.required<string>();
  card = signal<CardModel | null>(null);
  inventory = signal<InventoryItem[]>([]);
  editError = signal('');
  conditions: CardCondition[] = ['M', 'NM', 'LP', 'MP', 'HP', 'DMG'];
  form = { condition: 'NM' as CardCondition, language: 'EN', isFoil: false, price: 0, quantity: 1 };

  /** Mis copias de esta carta (variante+idioma). */
  copies = signal<MyCopies | null>(null);
  saving = signal(false);
  langs: CardLang[] = ['EN', 'ES'];

  /** Historial de precio, ventas y filtros de disponibilidad. */
  history = signal<PricePoint[]>([]);
  sales = signal<CardSale[]>([]);
  histVariant = signal<string>('');
  invLang = signal('');
  invCond = signal('');
  invSort = signal<'asc' | 'desc'>('asc');
  shared = signal(false);

  histVariants = computed(() => {
    const keys = new Set<string>();
    for (const p of this.history()) Object.keys(p.values ?? {}).forEach((k) => keys.add(k));
    return [...keys];
  });
  private histSeries = computed(() => {
    const v = this.histVariant() || this.histVariants()[0];
    return this.history().map((p) => Number(p.values?.[v] ?? 0)).filter((n) => !Number.isNaN(n));
  });
  histChange = computed<number | null>(() => {
    const s = this.histSeries();
    if (s.length < 2 || !s[0]) return null;
    return ((s[s.length - 1] - s[0]) / s[0]) * 100;
  });
  histPoints = computed(() => {
    const s = this.histSeries();
    if (s.length < 2) return '';
    const min = Math.min(...s), max = Math.max(...s);
    const span = max - min || 1;
    return s
      .map((v, i) => `${(i / (s.length - 1)) * 320},${85 - ((v - min) / span) * 75}`)
      .join(' ');
  });

  invLangs = computed(() => [...new Set(this.inventory().map((i) => i.language))].sort());
  invConds = computed(() => [...new Set(this.inventory().map((i) => i.condition))]);
  filteredInventory = computed(() => {
    const lang = this.invLang(), cond = this.invCond(), dir = this.invSort() === 'asc' ? 1 : -1;
    return this.inventory()
      .filter((i) => (!lang || i.language === lang) && (!cond || i.condition === cond))
      .slice()
      .sort((a, b) => (a.price - b.price) * dir);
  });

  share(c: CardModel) {
    const url = location.href;
    const data = { title: `${c.name} · SingleTCG`, url };
    if (navigator.share) { navigator.share(data).catch(() => undefined); return; }
    navigator.clipboard?.writeText(url).then(() => {
      this.shared.set(true);
      setTimeout(() => this.shared.set(false), 1500);
    });
  }

  constructor() {
    effect(() => {
      const id = this.id();
      if (!id) return;
      this.catalog.card(id).subscribe((c) => this.card.set(c));
      this.catalog.inventoryByCard(id).subscribe((inv) => this.inventory.set(inv));
      this.catalog.priceHistory(id).subscribe((h) => {
        this.history.set(h);
        if (!this.histVariant()) {
          const first = Object.keys(h[h.length - 1]?.values ?? {})[0];
          if (first) this.histVariant.set(first);
        }
      });
      this.catalog.cardSales(id).subscribe((s) => this.sales.set(s));
      if (this.auth.isLoggedIn()) this.reloadCopies();
    });
  }

  private reloadCopies() {
    this.collection.myCopies(this.id()).subscribe((r) => this.copies.set(r));
  }
  qty(variant: string, lang: CardLang): number {
    return this.copies()?.items.find((i) => i.variant === variant && i.language === lang)?.quantity ?? 0;
  }
  albums(variant: string): { id: string; name: string; color: string | null }[] {
    const seen = new Map<string, { id: string; name: string; color: string | null }>();
    for (const i of this.copies()?.items ?? []) {
      if (i.variant === variant && i.album) seen.set(i.album.id, i.album);
    }
    return [...seen.values()];
  }
  adj(variant: string, lang: CardLang, delta: number) {
    this.saving.set(true);
    this.collection.adjust(this.id(), variant, lang, delta).subscribe({
      next: () => { this.reloadCopies(); this.saving.set(false); },
      error: () => this.saving.set(false),
    });
  }

  label(c: string) { return CONDITION_LABEL[c] ?? c; }
  addToCart(it: InventoryItem, card: CardModel) { this.cart.add(it, card.name, card.imageUrl); }
  attrRows(c: CardModel): { key: string; value: string }[] {
    return Object.entries(c.attributes || {}).map(([key, value]) => ({ key, value: Array.isArray(value) ? value.join(', ') : String(value) }));
  }
  private reloadInventory() { this.catalog.inventoryByCard(this.id()).subscribe((inv) => this.inventory.set(inv)); }
  addUnit() {
    const card = this.card();
    if (!card) return;
    this.editError.set('');
    this.admin.createInventory({ cardModelId: card.id, condition: this.form.condition, language: this.form.language, isFoil: this.form.isFoil, price: Number(this.form.price), quantity: Number(this.form.quantity) })
      .subscribe({ next: () => this.reloadInventory(), error: (e) => this.editError.set(e?.error?.message ?? 'Error') });
  }
  adjustStock(it: InventoryItem, delta: number) {
    this.admin.adjustStock(it.id, delta).subscribe({ next: () => this.reloadInventory(), error: (e) => this.editError.set(e?.error?.message ?? 'Error') });
  }
  removeUnit(it: InventoryItem) { this.admin.deleteInventory(it.id).subscribe(() => this.reloadInventory()); }
}
