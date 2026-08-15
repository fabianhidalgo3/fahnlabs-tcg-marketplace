import { Component, effect, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { TuiRoot, TuiButton, TUI_DARK_MODE } from '@taiga-ui/core';
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
    TuiRoot, TuiButton,
  ],
  template: `
    <tui-root>
      <div class="shell" [class.mobile]="isMobile()" [class.open]="sidenavOpen()">
        <aside class="side">
          <a routerLink="/catalogo" class="brand" (click)="onNav()">
            🃏 <span>TCG</span>Market
          </a>

          <nav class="nav">
            <h3 class="subheader">{{ i18n.isES() ? 'Tienda' : 'Store' }}</h3>
            <a routerLink="/catalogo" routerLinkActive="on" class="nav-item" (click)="onNav()">
              <span class="mi">grid_view</span><span class="lbl">{{ i18n.t('nav.catalog') }}</span>
            </a>
            <a routerLink="/sets" routerLinkActive="on" class="nav-item" (click)="onNav()">
              <span class="mi">folder</span><span class="lbl">{{ i18n.t('nav.sets') }}</span>
            </a>
            <a routerLink="/carrito" routerLinkActive="on" class="nav-item" (click)="onNav()">
              <span class="mi">shopping_cart</span><span class="lbl">{{ i18n.t('nav.cart') }}</span>
              @if (cart.count()) { <span class="navbadge">{{ cart.count() }}</span> }
            </a>

            @if (auth.isLoggedIn()) {
              <h3 class="subheader">{{ i18n.isES() ? 'Mi cuenta' : 'My account' }}</h3>
              <a routerLink="/coleccion" routerLinkActive="on" class="nav-item" (click)="onNav()">
                <span class="mi">collections_bookmark</span><span class="lbl">{{ i18n.t('nav.collection') }}</span>
              </a>
              <a routerLink="/almacenamiento" routerLinkActive="on" class="nav-item" (click)="onNav()">
                <span class="mi">inventory_2</span><span class="lbl">{{ i18n.isES() ? 'Almacenamiento' : 'Storage' }}</span>
              </a>
              <a routerLink="/ordenes" routerLinkActive="on" class="nav-item" (click)="onNav()">
                <span class="mi">receipt_long</span><span class="lbl">{{ i18n.t('nav.orders') }}</span>
              </a>
            }
            @if (auth.isAdmin()) {
              <h3 class="subheader">Admin</h3>
              <a routerLink="/admin" routerLinkActive="on" class="nav-item" (click)="onNav()">
                <span class="mi">admin_panel_settings</span><span class="lbl">{{ i18n.t('nav.admin') }}</span>
              </a>
            }
          </nav>
        </aside>

        @if (isMobile() && sidenavOpen()) {
          <div class="backdrop" (click)="sidenavOpen.set(false)"></div>
        }

        <div class="main-wrap">
          <header class="topbar">
            <button class="icon-btn" (click)="sidenavOpen.set(!sidenavOpen())" aria-label="menu"><span class="mi">menu</span></button>
            <span class="spacer"></span>

            <div class="tools">
              <button class="icon-btn" (click)="theme.toggle()" [title]="theme.theme() === 'dark' ? 'Light' : 'Dark'">
                <span class="mi">{{ theme.theme() === 'dark' ? 'light_mode' : 'dark_mode' }}</span>
              </button>
              <button tuiButton type="button" appearance="flat" size="s" (click)="i18n.toggle()">{{ i18n.isES() ? 'ES' : 'EN' }}</button>
              <button tuiButton type="button" appearance="flat" size="s" (click)="currency.toggle()">{{ currency.currency() }}</button>
            </div>

            @if (auth.isLoggedIn()) {
              <span class="user"><span class="mi">account_circle</span> {{ auth.user()?.name }}</span>
              <button tuiButton type="button" appearance="secondary" size="s" (click)="auth.logout()">{{ i18n.t('nav.logout') }}</button>
            } @else {
              <a tuiButton appearance="primary" size="s" routerLink="/login">{{ i18n.t('nav.login') }}</a>
            }
          </header>

          <main class="content"><router-outlet /></main>
        </div>
      </div>
    </tui-root>
  `,
  styles: [
    `
      .shell { display: flex; min-height: 100vh; }
      .side {
        width: 256px;
        flex: 0 0 256px;
        border-right: 1px solid var(--border);
        background: var(--card);
        padding: 8px 10px;
        overflow-y: auto;
      }
      .main-wrap { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; }
      .brand { display: block; font-weight: 800; font-size: 20px; letter-spacing: -0.5px; padding: 14px 12px 10px; }
      .brand span { color: var(--primary); }
      .nav { display: flex; flex-direction: column; gap: 2px; }
      .subheader { color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; margin: 12px 12px 4px; }
      .nav-item {
        display: flex; align-items: center; gap: 12px;
        padding: 10px 12px; border-radius: 10px; font-size: 14px; font-weight: 500;
        color: var(--text); transition: background 0.15s ease;
      }
      .nav-item .mi { font-size: 20px; color: var(--muted); }
      .nav-item .lbl { flex: 1; }
      .nav-item:hover { background: var(--card-2); }
      .nav-item.on { background: color-mix(in srgb, var(--primary) 14%, transparent); }
      .nav-item.on, .nav-item.on .mi { color: var(--primary); }
      .navbadge {
        min-width: 20px; height: 20px; padding: 0 6px; border-radius: 999px;
        background: var(--primary); color: var(--on-primary);
        font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center;
      }
      .backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 20; }
      .topbar {
        position: sticky; top: 0; z-index: 5;
        background: color-mix(in srgb, var(--card) 88%, transparent);
        backdrop-filter: blur(10px);
        border-bottom: 1px solid var(--border);
        display: flex; align-items: center; gap: 8px;
        padding: 8px 14px; min-height: 60px;
      }
      .spacer { flex: 1 1 auto; }
      .tools { display: inline-flex; align-items: center; gap: 4px; margin-right: 6px; }
      .user { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--muted); margin-right: 6px; }
      .user .mi { font-size: 20px; }
      .content { padding: 26px 24px 60px; max-width: 1260px; width: 100%; }

      /* Móvil: la barra lateral se convierte en panel deslizante */
      .shell.mobile .side {
        position: fixed; top: 0; left: 0; bottom: 0; z-index: 30;
        transform: translateX(-100%); transition: transform 0.2s ease;
      }
      .shell.mobile.open .side { transform: translateX(0); }
    `,
  ],
})
export class AppComponent {
  auth = inject(AuthService);
  cart = inject(CartService);
  i18n = inject(I18nService);
  theme = inject(ThemeService);
  currency = inject(CurrencyService);
  private darkMode = inject(TUI_DARK_MODE);
  private bp = inject(BreakpointObserver);

  isMobile = toSignal(
    this.bp.observe([Breakpoints.XSmall, Breakpoints.Small]).pipe(map((r) => r.matches)),
    { initialValue: false },
  );
  sidenavOpen = signal(true);

  constructor() {
    // Al cambiar de tamaño: en móvil el sidebar arranca cerrado, en escritorio abierto.
    effect(() => this.sidenavOpen.set(!this.isMobile()));
    // Liga el tema de Taiga (body[tuiTheme=dark]) al ThemeService (html[data-theme]).
    effect(() => this.darkMode.set(this.theme.theme() === 'dark'));
  }

  onNav() {
    if (this.isMobile()) this.sidenavOpen.set(false);
  }
}
