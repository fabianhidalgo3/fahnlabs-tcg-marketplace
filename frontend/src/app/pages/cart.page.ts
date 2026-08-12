import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { CartService } from '../core/services/cart.service';
import { OrdersService } from '../core/services/orders.service';
import { AuthService } from '../core/services/auth.service';
import { I18nService } from '../core/services/i18n.service';
import { CurrencyService } from '../core/services/currency.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatCardModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule],
  template: `
    <h1>{{ i18n.t('cart.title') }}</h1>

    @if (cart.lines().length === 0) {
      <mat-card class="empty" appearance="outlined">
        <p class="muted">{{ i18n.t('cart.empty') }}</p>
        <a mat-flat-button routerLink="/catalogo">{{ i18n.t('cart.explore') }}</a>
      </mat-card>
    } @else {
      <div class="layout">
        <div class="items">
          @for (l of cart.lines(); track l.inventoryItemId) {
            <mat-card class="row" appearance="outlined">
              <div class="thumb">@if (l.imageUrl) { <img [src]="l.imageUrl" [alt]="l.cardName" /> }</div>
              <div class="info">
                <div class="nm">{{ l.cardName }}</div>
                <div class="muted">{{ l.condition }}@if (l.isFoil) { · FOIL } · {{ cur.format(l.price) }} c/u</div>
              </div>
              <div class="qty">
                <button mat-icon-button (click)="dec(l.inventoryItemId, l.quantity)"><mat-icon>remove</mat-icon></button>
                <span>{{ l.quantity }}</span>
                <button mat-icon-button [disabled]="l.quantity >= l.maxQuantity" (click)="inc(l.inventoryItemId, l.quantity)"><mat-icon>add</mat-icon></button>
              </div>
              <div class="line">{{ cur.format(l.price * l.quantity) }}</div>
              <button mat-icon-button (click)="cart.remove(l.inventoryItemId)"><mat-icon>close</mat-icon></button>
            </mat-card>
          }
        </div>

        <mat-card class="checkout" appearance="outlined">
          <h3>{{ i18n.t('cart.summary') }}</h3>
          <div class="sumline"><span class="muted">{{ i18n.t('cart.items') }}</span><span>{{ cart.count() }}</span></div>
          <div class="sumline total"><span>{{ i18n.t('cart.total') }}</span><span>{{ cur.format(cart.total()) }}</span></div>

          @if (auth.isLoggedIn()) {
            <mat-form-field appearance="fill"><mat-label>{{ i18n.t('cart.shipName') }}</mat-label><input matInput [(ngModel)]="shippingName" /></mat-form-field>
            <mat-form-field appearance="fill"><mat-label>{{ i18n.t('cart.shipAddr') }}</mat-label><textarea matInput rows="3" [(ngModel)]="shippingAddress"></textarea></mat-form-field>
            @if (error()) { <p class="err">{{ error() }}</p> }
            <button mat-flat-button class="block" [disabled]="submitting()" (click)="checkout()">
              {{ submitting() ? i18n.t('cart.processing') : i18n.t('cart.confirm') }}
            </button>
          } @else {
            <p class="muted">{{ i18n.t('cart.loginToBuy') }}</p>
            <a mat-flat-button class="block" routerLink="/login">{{ i18n.t('nav.login') }}</a>
          }
        </mat-card>
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
      .checkout { padding: 20px; display: flex; flex-direction: column; gap: 10px; position: sticky; top: 84px; }
      .checkout mat-form-field { width: 100%; }
      .sumline { display: flex; justify-content: space-between; }
      .sumline.total { font-size: 20px; font-weight: 800; border-top: 1px solid var(--border); padding-top: 12px; margin-top: 4px; }
      .block { width: 100%; }
      .err { color: var(--danger); font-size: 13px; }
      @media (max-width: 760px) { .layout { grid-template-columns: 1fr; } }
    `,
  ],
})
export class CartPage {
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
