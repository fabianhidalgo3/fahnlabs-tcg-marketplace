import { Component, effect, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatBadgeModule } from '@angular/material/badge';
import { AuthService } from './core/services/auth.service';
import { CartService } from './core/services/cart.service';
import { I18nService } from './core/services/i18n.service';
import { ThemeService } from './core/services/theme.service';
import { CurrencyService } from './core/services/currency.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet, RouterLink, RouterLinkActive,
    MatSidenavModule, MatToolbarModule, MatListModule, MatIconModule,
    MatButtonModule, MatBadgeModule,
  ],
  template: `
    <mat-sidenav-container class="shell" autosize>
      <mat-sidenav
        class="side"
        [mode]="isMobile() ? 'over' : 'side'"
        [opened]="sidenavOpen()"
        (openedChange)="sidenavOpen.set($event)"
      >
        <a routerLink="/catalogo" class="brand" (click)="onNav()">
          🃏 <span>TCG</span>Market
        </a>
        <mat-nav-list>
          <h3 matSubheader>{{ i18n.isES() ? 'Tienda' : 'Store' }}</h3>
          <a mat-list-item routerLink="/catalogo" routerLinkActive="on" (click)="onNav()">
            <mat-icon matListItemIcon>grid_view</mat-icon>
            <span matListItemTitle>{{ i18n.t('nav.catalog') }}</span>
          </a>
          <a mat-list-item routerLink="/sets" routerLinkActive="on" (click)="onNav()">
            <mat-icon matListItemIcon>folder</mat-icon>
            <span matListItemTitle>{{ i18n.t('nav.sets') }}</span>
          </a>
          <a mat-list-item routerLink="/carrito" routerLinkActive="on" (click)="onNav()">
            <mat-icon matListItemIcon [matBadge]="cart.count() || null" matBadgeSize="small" matBadgeColor="accent">shopping_cart</mat-icon>
            <span matListItemTitle>{{ i18n.t('nav.cart') }}</span>
          </a>

          @if (auth.isLoggedIn()) {
            <h3 matSubheader>{{ i18n.isES() ? 'Mi cuenta' : 'My account' }}</h3>
            <a mat-list-item routerLink="/coleccion" routerLinkActive="on" (click)="onNav()">
              <mat-icon matListItemIcon>collections_bookmark</mat-icon>
              <span matListItemTitle>{{ i18n.t('nav.collection') }}</span>
            </a>
            <a mat-list-item routerLink="/almacenamiento" routerLinkActive="on" (click)="onNav()">
              <mat-icon matListItemIcon>inventory_2</mat-icon>
              <span matListItemTitle>{{ i18n.isES() ? 'Almacenamiento' : 'Storage' }}</span>
            </a>
            <a mat-list-item routerLink="/ordenes" routerLinkActive="on" (click)="onNav()">
              <mat-icon matListItemIcon>receipt_long</mat-icon>
              <span matListItemTitle>{{ i18n.t('nav.orders') }}</span>
            </a>
          }
          @if (auth.isAdmin()) {
            <h3 matSubheader>Admin</h3>
            <a mat-list-item routerLink="/admin" routerLinkActive="on" (click)="onNav()">
              <mat-icon matListItemIcon>admin_panel_settings</mat-icon>
              <span matListItemTitle>{{ i18n.t('nav.admin') }}</span>
            </a>
          }
        </mat-nav-list>
      </mat-sidenav>

      <mat-sidenav-content>
        <mat-toolbar class="topbar">
          <button mat-icon-button (click)="sidenavOpen.set(!sidenavOpen())" aria-label="menu"><mat-icon>menu</mat-icon></button>
          <span class="spacer"></span>

          <div class="tools">
            <button mat-icon-button (click)="theme.toggle()" [title]="theme.theme() === 'dark' ? 'Light' : 'Dark'">
              <mat-icon>{{ theme.theme() === 'dark' ? 'light_mode' : 'dark_mode' }}</mat-icon>
            </button>
            <button mat-button (click)="i18n.toggle()">{{ i18n.isES() ? 'ES' : 'EN' }}</button>
            <button mat-button (click)="currency.toggle()">{{ currency.currency() }}</button>
          </div>

          @if (auth.isLoggedIn()) {
            <span class="user"><mat-icon>account_circle</mat-icon> {{ auth.user()?.name }}</span>
            <button mat-stroked-button (click)="auth.logout()">{{ i18n.t('nav.logout') }}</button>
          } @else {
            <a mat-flat-button routerLink="/login">{{ i18n.t('nav.login') }}</a>
          }
        </mat-toolbar>

        <main class="content"><router-outlet /></main>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [
    `
      .shell { height: 100vh; }
      .side {
        width: 256px;
        border-right: 1px solid var(--border);
        background: var(--card);
        padding: 8px 10px;
      }
      .brand { display: block; font-weight: 800; font-size: 20px; letter-spacing: -0.5px; padding: 14px 12px 10px; }
      .brand span { color: var(--primary); }
      h3[matSubheader] { color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; margin-top: 8px; }
      a.on { --mat-list-list-item-label-text-color: var(--primary); background: color-mix(in srgb, var(--primary) 14%, transparent); border-radius: 10px; }
      a.on mat-icon, a.on span { color: var(--primary); }
      .topbar {
        position: sticky; top: 0; z-index: 5;
        background: color-mix(in srgb, var(--card) 88%, transparent);
        backdrop-filter: blur(10px);
        border-bottom: 1px solid var(--border);
        display: flex; align-items: center; gap: 8px;
      }
      .spacer { flex: 1 1 auto; }
      .tools { display: inline-flex; align-items: center; gap: 2px; margin-right: 6px; }
      .user { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--muted); margin-right: 6px; }
      .user mat-icon { font-size: 20px; height: 20px; width: 20px; }
      .content { padding: 26px 24px 60px; max-width: 1260px; }
    `,
  ],
})
export class AppComponent {
  auth = inject(AuthService);
  cart = inject(CartService);
  i18n = inject(I18nService);
  theme = inject(ThemeService);
  currency = inject(CurrencyService);
  private bp = inject(BreakpointObserver);

  isMobile = toSignal(
    this.bp.observe([Breakpoints.XSmall, Breakpoints.Small]).pipe(map((r) => r.matches)),
    { initialValue: false },
  );
  sidenavOpen = signal(true);

  constructor() {
    // Al cambiar de tamaño: en móvil el sidebar arranca cerrado, en escritorio abierto.
    effect(() => this.sidenavOpen.set(!this.isMobile()));
  }

  onNav() {
    if (this.isMobile()) this.sidenavOpen.set(false);
  }
}
