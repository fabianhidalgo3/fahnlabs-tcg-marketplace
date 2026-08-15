import { Component, effect, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TuiButton, TuiTextfield, TuiInput, TuiCheckbox } from '@taiga-ui/core';
import { TuiBadge } from '@taiga-ui/kit';
import { CatalogService } from '../core/services/catalog.service';
import { CartService } from '../core/services/cart.service';
import { AuthService } from '../core/services/auth.service';
import { AdminService } from '../core/services/admin.service';
import { I18nService } from '../core/services/i18n.service';
import { CurrencyService } from '../core/services/currency.service';
import { CardCondition, CardModel, InventoryItem } from '../core/models/models';

const CONDITION_LABEL: Record<string, string> = {
  M: 'Mint', NM: 'Near Mint', LP: 'Lightly Played', MP: 'Moderately Played', HP: 'Heavily Played', DMG: 'Damaged',
};

@Component({
  standalone: true,
  imports: [
    CommonModule, RouterLink, FormsModule, TuiButton, TuiTextfield, TuiInput, TuiCheckbox, TuiBadge,
  ],
  template: `
    @if (card(); as c) {
      <a tuiButton appearance="flat" size="s" routerLink="/catalogo" class="back"><span class="mi">arrow_back</span>{{ i18n.t('card.back') }}</a>
      <div class="layout">
        <div class="art card-surface">
          @if (c.imageUrl) { <img [src]="c.imageUrl" [alt]="c.name" /> }
          @else { <div class="noimg">{{ i18n.isES() ? 'Sin imagen' : 'No image' }}</div> }
        </div>

        <div class="info">
          <div class="crumbs muted">
            {{ c.game?.name }}
            @if (c.set) { · <a [routerLink]="['/sets', c.set.id]">{{ c.set.name }}</a> }
            · {{ c.number }}
          </div>
          <h1>{{ c.name }}</h1>
          <div class="badge-set badges">
            @if (c.cardType) { <span tuiBadge appearance="neutral">{{ c.cardType }}</span> }
            @if (c.rarity) { <span tuiBadge appearance="neutral">{{ c.rarity }}</span> }
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

          <h3 class="inv-title">{{ i18n.t('card.availability') }}</h3>
          @if (inventory().length === 0) {
            <p class="muted">{{ i18n.t('card.noStock') }}</p>
          } @else {
            <div class="inv">
              @for (it of inventory(); track it.id) {
                <div class="row card-surface">
                  <div>
                    <div class="cond">{{ label(it.condition) }}@if (it.isFoil) { <span class="foil">FOIL</span> }</div>
                    <div class="muted sku">{{ it.language }} · {{ it.sku }}</div>
                  </div>
                  <div class="right">
                    <div class="price">{{ cur.format(it.price) }}</div>
                    <div class="muted">{{ it.quantity }} {{ i18n.t('card.available') }}</div>
                  </div>
                  <button tuiButton type="button" appearance="primary" size="s" [disabled]="it.quantity === 0" (click)="addToCart(it, c)">
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
                    <button class="icon-btn sm" (click)="removeUnit(it)"><span class="mi">delete</span></button>
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
                <tui-textfield class="f"><label tuiLabel>{{ i18n.t('admin.language') }}</label><input tuiInput [(ngModel)]="form.language" /></tui-textfield>
                <label class="cb-row"><input tuiCheckbox type="checkbox" [(ngModel)]="form.isFoil" /> Foil</label>
                <tui-textfield class="f"><label tuiLabel>{{ i18n.t('admin.price') }}</label><input tuiInput type="number" [(ngModel)]="form.price" /></tui-textfield>
                <tui-textfield class="f"><label tuiLabel>{{ i18n.t('admin.qty') }}</label><input tuiInput type="number" [(ngModel)]="form.quantity" /></tui-textfield>
                <button tuiButton type="button" appearance="primary" size="s" (click)="addUnit()"><span class="mi">add</span>{{ i18n.t('admin.add') }}</button>
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
      .crumbs a { color: var(--primary); }
      h1 { font-size: 30px; margin: 6px 0 10px; }
      .badges { margin-bottom: 18px; }
      .attrs { padding: 16px; margin-bottom: 22px; }
      .attr-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; margin-top: 10px; }
      .attr { display: flex; flex-direction: column; gap: 2px; }
      .attr .k { font-size: 12px; text-transform: capitalize; }
      .attr .v { font-weight: 700; }
      .inv-title { margin-bottom: 12px; }
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
  private catalog = inject(CatalogService);
  private cart = inject(CartService);
  private admin = inject(AdminService);
  auth = inject(AuthService);
  i18n = inject(I18nService);
  cur = inject(CurrencyService);

  id = input.required<string>();
  card = signal<CardModel | null>(null);
  inventory = signal<InventoryItem[]>([]);
  editError = signal('');
  conditions: CardCondition[] = ['M', 'NM', 'LP', 'MP', 'HP', 'DMG'];
  form = { condition: 'NM' as CardCondition, language: 'EN', isFoil: false, price: 0, quantity: 1 };

  constructor() {
    effect(() => {
      const id = this.id();
      if (!id) return;
      this.catalog.card(id).subscribe((c) => this.card.set(c));
      this.catalog.inventoryByCard(id).subscribe((inv) => this.inventory.set(inv));
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
