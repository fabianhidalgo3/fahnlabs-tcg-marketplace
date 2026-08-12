import { Component, effect, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
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
    CommonModule, RouterLink, FormsModule, MatCardModule, MatButtonModule, MatIconModule,
    MatChipsModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatCheckboxModule,
  ],
  template: `
    @if (card(); as c) {
      <a mat-button routerLink="/catalogo" class="back"><mat-icon>arrow_back</mat-icon>{{ i18n.t('card.back') }}</a>
      <div class="layout">
        <mat-card class="art" appearance="outlined">
          @if (c.imageUrl) { <img [src]="c.imageUrl" [alt]="c.name" /> }
          @else { <div class="noimg">{{ i18n.isES() ? 'Sin imagen' : 'No image' }}</div> }
        </mat-card>

        <div class="info">
          <div class="crumbs muted">
            {{ c.game?.name }}
            @if (c.set) { · <a [routerLink]="['/sets', c.set.id]">{{ c.set.name }}</a> }
            · {{ c.number }}
          </div>
          <h1>{{ c.name }}</h1>
          <mat-chip-set class="badges">
            @if (c.cardType) { <mat-chip>{{ c.cardType }}</mat-chip> }
            @if (c.rarity) { <mat-chip>{{ c.rarity }}</mat-chip> }
          </mat-chip-set>

          @if (attrRows(c).length) {
            <mat-card class="attrs" appearance="outlined">
              <h3>{{ i18n.t('card.attributes') }}</h3>
              <div class="attr-grid">
                @for (row of attrRows(c); track row.key) {
                  <div class="attr"><span class="k muted">{{ row.key }}</span><span class="v">{{ row.value }}</span></div>
                }
              </div>
            </mat-card>
          }

          <h3 class="inv-title">{{ i18n.t('card.availability') }}</h3>
          @if (inventory().length === 0) {
            <p class="muted">{{ i18n.t('card.noStock') }}</p>
          } @else {
            <div class="inv">
              @for (it of inventory(); track it.id) {
                <mat-card class="row" appearance="outlined">
                  <div>
                    <div class="cond">{{ label(it.condition) }}@if (it.isFoil) { <span class="foil">FOIL</span> }</div>
                    <div class="muted sku">{{ it.language }} · {{ it.sku }}</div>
                  </div>
                  <div class="right">
                    <div class="price">{{ cur.format(it.price) }}</div>
                    <div class="muted">{{ it.quantity }} {{ i18n.t('card.available') }}</div>
                  </div>
                  <button mat-flat-button [disabled]="it.quantity === 0" (click)="addToCart(it, c)">
                    <mat-icon>add_shopping_cart</mat-icon>{{ i18n.t('card.add') }}
                  </button>
                </mat-card>
              }
            </div>
          }

          @if (auth.isAdmin()) {
            <mat-card class="edit" appearance="outlined">
              <h3><mat-icon>edit</mat-icon> {{ i18n.isES() ? 'Editar inventario' : 'Edit inventory' }}</h3>
              @for (it of inventory(); track it.id) {
                <div class="erow">
                  <span class="ec">{{ it.condition }}@if (it.isFoil) { · FOIL }</span>
                  <span class="muted">{{ it.language }}</span>
                  <span class="ep">{{ cur.format(it.price) }}</span>
                  <span class="es">stock: <b>{{ it.quantity }}</b></span>
                  <span class="eacts">
                    <button mat-icon-button (click)="adjustStock(it, -1)"><mat-icon>remove</mat-icon></button>
                    <button mat-icon-button (click)="adjustStock(it, 1)"><mat-icon>add</mat-icon></button>
                    <button mat-icon-button (click)="removeUnit(it)"><mat-icon>delete</mat-icon></button>
                  </span>
                </div>
              }
              <div class="eform">
                <mat-form-field appearance="outline">
                  <mat-label>{{ i18n.isES() ? 'Condición' : 'Condition' }}</mat-label>
                  <mat-select [(ngModel)]="form.condition">
                    @for (c2 of conditions; track c2) { <mat-option [value]="c2">{{ c2 }}</mat-option> }
                  </mat-select>
                </mat-form-field>
                <mat-form-field appearance="outline"><mat-label>{{ i18n.t('admin.language') }}</mat-label><input matInput [(ngModel)]="form.language" /></mat-form-field>
                <mat-checkbox [(ngModel)]="form.isFoil">Foil</mat-checkbox>
                <mat-form-field appearance="outline"><mat-label>{{ i18n.t('admin.price') }}</mat-label><input matInput type="number" [(ngModel)]="form.price" /></mat-form-field>
                <mat-form-field appearance="outline"><mat-label>{{ i18n.t('admin.qty') }}</mat-label><input matInput type="number" [(ngModel)]="form.quantity" /></mat-form-field>
                <button mat-flat-button (click)="addUnit()"><mat-icon>add</mat-icon>{{ i18n.t('admin.add') }}</button>
              </div>
              @if (editError()) { <p class="err">{{ editError() }}</p> }
            </mat-card>
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
      .eform { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-top: 12px; }
      .eform mat-form-field { width: 130px; --mat-form-field-container-vertical-padding: 6px; }
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
