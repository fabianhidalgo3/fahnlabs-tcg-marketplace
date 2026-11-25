import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CartService } from '../core/services/cart.service';
import { thumbUrl } from '../core/utils/card-image';
import { OrdersService } from '../core/services/orders.service';
import { AuthService } from '../core/services/auth.service';
import { I18nService } from '../core/services/i18n.service';
import { CurrencyService } from '../core/services/currency.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <header class="page-head"><h1>{{ i18n.t('cart.title') }}</h1></header>

    @if (cart.lines().length === 0) {
      <div class="empty card-surface">
        <p class="muted">{{ i18n.t('cart.empty') }}</p>
        <a class="btn btn-primary" routerLink="/catalogo">{{ i18n.t('cart.explore') }}</a>
      </div>
    } @else {
      <div class="layout">
        <div class="items">
          @for (l of cart.lines(); track l.inventoryItemId) {
            <div class="row card-surface">
              <div class="thumb">@if (l.imageUrl) { <img [src]="thumb(l.imageUrl)" [alt]="l.cardName" loading="lazy" decoding="async" /> }</div>
              <div class="info">
                <div class="nm">{{ l.cardName }}</div>
                <div class="muted">{{ l.condition }}@if (l.isFoil) { · FOIL } · {{ cur.format(l.price) }} c/u</div>
              </div>
              <div class="qty">
                <button class="icon-btn sm" (click)="dec(l.inventoryItemId, l.quantity)"><span class="mi">remove</span></button>
                <span>{{ l.quantity }}</span>
                <button class="icon-btn sm" [disabled]="l.quantity >= l.maxQuantity" (click)="inc(l.inventoryItemId, l.quantity)"><span class="mi">add</span></button>
              </div>
              <div class="line">{{ cur.format(l.price * l.quantity) }}</div>
              <button class="icon-btn sm" (click)="cart.remove(l.inventoryItemId)"><span class="mi">close</span></button>
            </div>
          }
        </div>

        <div class="checkout card-surface">
          <h3>{{ i18n.t('cart.summary') }}</h3>
          <div class="sumline"><span class="muted">{{ i18n.t('cart.items') }}</span><span>{{ cart.count() }}</span></div>
          <div class="sumline total"><span>{{ i18n.t('cart.total') }}</span><span>{{ cur.format(cart.total()) }}</span></div>

          @if (auth.isLoggedIn()) {
            <label class="ui-field"><span class="lbl">{{ i18n.t('cart.shipName') }}</span><input class="ui-input" [(ngModel)]="shippingName" /></label>
            <label class="ui-field"><span class="lbl">{{ i18n.t('cart.shipAddr') }}</span><textarea class="ui-input ta" rows="3" [(ngModel)]="shippingAddress"></textarea></label>
            @if (error()) { <p class="err">{{ error() }}</p> }
            <button class="btn btn-primary block" type="button" [disabled]="submitting()" (click)="checkout()">
              {{ submitting() ? i18n.t('cart.processing') : i18n.t('cart.confirm') }}
            </button>
          } @else {
            <p class="muted">{{ i18n.t('cart.loginToBuy') }}</p>
            <a class="btn btn-primary block" routerLink="/login">{{ i18n.t('nav.login') }}</a>
          }
        </div>
      </div>
    }
  `,
  styles: [
    `
      h1 { margin-bottom: 20px; }
      .empty { padding: 40px; text-align: center; display: grid; gap: 14px; place-items: center; }
      .layout { display: grid; grid-template-columns: 1fr 340px; gap: 22px; align-items: start; }
      .items { display: flex; flex-direction: column; gap: 12px; }
      .row { display: grid; grid-template-columns: 54px 1fr auto auto auto; align-items: center; gap: 14px; padding: 12px 14px; }
      .thumb { width: 54px; height: 76px; background: var(--bg-soft); border-radius: 6px; overflow: hidden; }
      .thumb img { width: 100%; height: 100%; object-fit: contain; }
      .nm { font-weight: 700; }
      .qty { display: flex; align-items: center; gap: 6px; }
      .line { font-weight: 800; color: var(--accent); min-width: 84px; text-align: right; }
      .checkout { padding: 20px; display: flex; flex-direction: column; gap: 12px; position: sticky; top: 84px; }
      .checkout .ui-field { width: 100%; }
      .sumline { display: flex; justify-content: space-between; }
      .sumline.total { font-size: 20px; font-weight: 800; border-top: 1px solid var(--border); padding-top: 12px; margin-top: 4px; }
      .block { width: 100%; }
      .err { color: var(--danger); font-size: 13px; }
      @media (max-width: 760px) { .layout { grid-template-columns: 1fr; } }
    `,
  ],
})
export class CartPage {
  thumb = thumbUrl;
  cart = inject(CartService);
  auth = inject(AuthService);
  i18n = inject(I18nService);
  cur = inject(CurrencyService);
  private orders = inject(OrdersService);
  private router = inject(Router);

  shippingName = this.auth.user()?.name ?? '';
  shippingAddress = '';
  submitting = signal(false);
  error = signal('');

  inc(id: string, q: number) { this.cart.setQuantity(id, q + 1); }
  dec(id: string, q: number) { if (q <= 1) this.cart.remove(id); else this.cart.setQuantity(id, q - 1); }

  checkout() {
    this.submitting.set(true);
    this.error.set('');
    this.orders.create({
      items: this.cart.lines().map((l) => ({ inventoryItemId: l.inventoryItemId, quantity: l.quantity })),
      shippingName: this.shippingName, shippingAddress: this.shippingAddress,
    }).subscribe({
      next: () => { this.cart.clear(); this.router.navigate(['/ordenes']); },
      error: (e) => { this.error.set(e?.error?.message ?? 'No se pudo completar la compra'); this.submitting.set(false); },
    });
  }
}
