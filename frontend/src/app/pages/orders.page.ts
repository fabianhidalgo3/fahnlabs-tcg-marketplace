import { Component, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { OrdersService } from '../core/services/orders.service';
import { AuthService } from '../core/services/auth.service';
import { I18nService } from '../core/services/i18n.service';
import { CurrencyService } from '../core/services/currency.service';
import { Order, OrderStatus } from '../core/models/models';

const STATUSES: OrderStatus[] = ['pending', 'paid', 'shipped', 'delivered', 'cancelled'];

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, MatCardModule, MatButtonModule, MatSelectModule, MatFormFieldModule],
  template: `
    <div class="head">
      <h1>{{ auth.isAdmin() && adminView() ? i18n.t('orders.allTitle') : i18n.t('orders.title') }}</h1>
      @if (auth.isAdmin()) {
        <button mat-stroked-button (click)="toggleView()">
          {{ adminView() ? i18n.t('orders.viewMine') : i18n.t('orders.viewAll') }}
        </button>
      }
    </div>

    @if (orders().length === 0) {
      <p class="muted">{{ i18n.t('orders.none') }}</p>
    } @else {
      <div class="list">
        @for (o of orders(); track o.id) {
          <mat-card class="order" appearance="outlined">
            <div class="top">
              <div>
                <span class="id">#{{ o.id.slice(-6) }}</span>
                <span class="muted date">{{ o.createdAt | date: 'medium' }}</span>
              </div>
              <div class="right">
                @if (auth.isAdmin() && adminView()) {
                  <mat-form-field appearance="outline" class="st" subscriptSizing="dynamic">
                    <mat-select [ngModel]="o.status" (ngModelChange)="changeStatus(o, $event)">
                      @for (s of statuses; track s) { <mat-option [value]="s">{{ s }}</mat-option> }
                    </mat-select>
                  </mat-form-field>
                } @else {
                  <span class="badge status" [attr.data-s]="o.status">{{ o.status }}</span>
                }
                <span class="total">{{ cur.format(o.total) }}</span>
              </div>
            </div>
            <div class="items">
              @for (it of o.items; track it.inventoryItem) {
                <div class="it"><span>{{ it.quantity }}× {{ it.cardName }}</span><span class="muted">{{ cur.format(it.unitPrice * it.quantity) }}</span></div>
              }
            </div>
          </mat-card>
        }
      </div>
    }
  `,
  styles: [
    `
      .head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
      .list { display: flex; flex-direction: column; gap: 14px; }
      .order { padding: 16px 18px; }
      .top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; gap: 10px; }
      .id { font-weight: 800; margin-right: 10px; }
      .date { font-size: 13px; }
      .right { display: flex; align-items: center; gap: 14px; }
      .st { width: 150px; }
      .total { font-weight: 800; color: var(--accent); font-size: 18px; }
      .status { text-transform: capitalize; }
      .status[data-s='paid'], .status[data-s='delivered'] { color: var(--success); }
      .status[data-s='cancelled'] { color: var(--danger); }
      .items { display: flex; flex-direction: column; gap: 6px; border-top: 1px solid var(--border); padding-top: 12px; }
      .it { display: flex; justify-content: space-between; font-size: 14px; }
    `,
  ],
})
export class OrdersPage {
  auth = inject(AuthService);
  i18n = inject(I18nService);
  cur = inject(CurrencyService);
  private ordersSvc = inject(OrdersService);

  orders = signal<Order[]>([]);
  adminView = signal(false);
  statuses = STATUSES;

  constructor() { this.load(); }
  toggleView() { this.adminView.update((v) => !v); this.load(); }
  load() {
    const src = this.auth.isAdmin() && this.adminView() ? this.ordersSvc.all() : this.ordersSvc.mine();
    src.subscribe((o) => this.orders.set(o));
  }
  changeStatus(order: Order, status: OrderStatus) {
    this.ordersSvc.updateStatus(order.id, status).subscribe((u) => this.orders.update((l) => l.map((o) => (o.id === u.id ? u : o))));
  }
}
