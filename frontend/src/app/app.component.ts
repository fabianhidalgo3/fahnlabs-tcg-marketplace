import { Component, effect, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { AuthService } from './core/services/auth.service';
import { CartService } from './core/services/cart.service';
import { I18nService } from './core/services/i18n.service';
import { ThemeService } from './core/services/theme.service';
import { CurrencyService } from './core/services/currency.service';
import { CardChatComponent } from './shared/card-chat.component';
import { GlobalSearchComponent } from './shared/global-search.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CardChatComponent, GlobalSearchComponent],
  template: `
    <div class="shell" [class.mobile]="isMobile()" [class.open]="sidenavOpen()" [class.collapsed]="!isMobile() && !sidenavOpen()">
      <!-- ===== Sidebar (layout TailAdmin) ===== -->
      <aside class="side">
        <a routerLink="/" class="brand" (click)="onNav()">
          <!-- Logo: abanico de cartas — Pokébola, estrella (SWU) y sombrero de paja (One Piece) -->
          <span class="logo">
            <svg viewBox="0 0 48 40" width="38" height="32" aria-hidden="true">
              <defs>
                <linearGradient id="lgG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stop-color="#10b981" /><stop offset="1" stop-color="#047857" />
                </linearGradient>
                <linearGradient id="lgB" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stop-color="#6d83ff" /><stop offset="1" stop-color="#3641f5" />
                </linearGradient>
                <linearGradient id="lgT" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stop-color="#2dd4bf" /><stop offset="1" stop-color="#0d9488" />
                </linearGradient>
              </defs>

              <!-- Carta Pokémon: Pokébola -->
              <g transform="rotate(-16 13 24)">
                <rect x="5" y="12" width="16" height="22" rx="3" fill="url(#lgG)" stroke="rgba(0,0,0,0.25)" stroke-width="0.6" />
                <rect x="6.2" y="13.2" width="13.6" height="8" rx="2" fill="#fff" opacity="0.14" />
                <circle cx="13" cy="23" r="4.6" fill="#fff" />
                <path d="M8.4 23 h9.2" stroke="#047857" stroke-width="1.3" />
                <circle cx="13" cy="23" r="1.5" fill="#047857" />
                <circle cx="13" cy="23" r="0.65" fill="#fff" />
              </g>

              <!-- Carta One Piece: sombrero de paja -->
              <g transform="rotate(16 35 24)">
                <rect x="27" y="12" width="16" height="22" rx="3" fill="url(#lgT)" stroke="rgba(0,0,0,0.25)" stroke-width="0.6" />
                <rect x="28.2" y="13.2" width="13.6" height="8" rx="2" fill="#fff" opacity="0.14" />
                <path d="M31 22.6 a4 4 0 0 1 8 0 z" fill="#fbbf24" />
                <rect x="31" y="21.3" width="8" height="1.5" fill="#ef4444" rx="0.7" />
                <ellipse cx="35" cy="23.1" rx="6" ry="1.5" fill="#fbbf24" />
              </g>

              <!-- Carta Star Wars Unlimited: estrella (al frente) -->
              <rect x="16" y="6" width="16" height="24" rx="3" fill="url(#lgB)" stroke="rgba(0,0,0,0.25)" stroke-width="0.6" />
              <rect x="17.2" y="7.2" width="13.6" height="9" rx="2" fill="#fff" opacity="0.16" />
              <path d="M24 11.2 L25.6 15.4 L29.8 17 L25.6 18.6 L24 22.8 L22.4 18.6 L18.2 17 L22.4 15.4 Z" fill="#fff" />
              <circle cx="28.6" cy="12.4" r="0.8" fill="#fff" opacity="0.9" />
              <circle cx="19.6" cy="21.6" r="0.7" fill="#fff" opacity="0.8" />
            </svg>
          </span>
          <span class="wordcol">
            <span class="word"><span class="hl">Single</span><span class="grn">TCG</span></span>
            <span class="byline">by FHAN Labs</span>
          </span>
        </a>

        <nav class="nav">
          @if (auth.isLoggedIn()) {
            <a routerLink="/" [routerLinkActiveOptions]="{ exact: true }" routerLinkActive="on" class="nav-item" (click)="onNav()">
              <span class="mi">home</span><span class="lbl">{{ i18n.isES() ? 'Inicio' : 'Home' }}</span>
            </a>
          }
          <!-- MARKETPLACE: compra/venta de cartas sueltas (singles) -->
          <h3 class="subheader"><span class="txt">Marketplace</span><span class="mi dots">more_horiz</span></h3>
          <a routerLink="/catalogo" routerLinkActive="on" class="nav-item" (click)="onNav()">
            <span class="mi">style</span><span class="lbl">Singles</span>
          </a>
          <a routerLink="/sets" routerLinkActive="on" class="nav-item" (click)="onNav()">
            <span class="mi">auto_awesome_motion</span><span class="lbl">{{ i18n.isES() ? 'Expansiones' : 'Expansions' }}</span>
          </a>
          @if (!auth.isAdmin()) {
            <a routerLink="/carrito" routerLinkActive="on" class="nav-item" (click)="onNav()">
              <span class="mi">shopping_cart</span><span class="lbl">{{ i18n.isES() ? 'Carrito' : 'Cart' }}</span>
              @if (cart.count()) { <span class="navbadge">{{ cart.count() }}</span> }
            </a>
          }
          @if (auth.isLoggedIn() && !auth.isAdmin()) {
            <a routerLink="/ordenes" routerLinkActive="on" class="nav-item" (click)="onNav()">
              <span class="mi">receipt_long</span><span class="lbl">{{ i18n.isES() ? 'Mis pedidos' : 'My orders' }}</span>
            </a>
          }

          <!-- COLECCIÓN: gestión personal (checklist, wishlist, binders) -->
          @if (auth.isLoggedIn()) {
            <h3 class="subheader"><span class="txt">{{ i18n.isES() ? 'Colección' : 'Collection' }}</span><span class="mi dots">more_horiz</span></h3>
            <a routerLink="/coleccion" routerLinkActive="on" class="nav-item" (click)="onNav()">
              <span class="mi">collections_bookmark</span><span class="lbl">{{ i18n.isES() ? 'Mi Colección' : 'My Collection' }}</span>
            </a>
            <a routerLink="/publicaciones" routerLinkActive="on" class="nav-item" (click)="onNav()">
              <span class="mi">storefront</span><span class="lbl">{{ i18n.isES() ? 'Mis publicaciones' : 'My listings' }}</span>
            </a>
            <a routerLink="/favoritos" routerLinkActive="on" class="nav-item" (click)="onNav()">
              <span class="mi">favorite</span><span class="lbl">{{ i18n.isES() ? 'Favoritos' : 'Wishlist' }}</span>
            </a>
            <a routerLink="/almacenamiento" routerLinkActive="on" class="nav-item" (click)="onNav()">
              <span class="mi">auto_stories</span><span class="lbl">{{ i18n.isES() ? 'Álbumes y cajas' : 'Binders & boxes' }}</span>
            </a>
          }

          <!-- ADMINISTRACIÓN -->
          @if (auth.isAdmin()) {
            <h3 class="subheader"><span class="txt">{{ i18n.isES() ? 'Administración' : 'Administration' }}</span><span class="mi dots">more_horiz</span></h3>
            <a routerLink="/admin" routerLinkActive="on" class="nav-item" (click)="onNav()">
              <span class="mi">space_dashboard</span><span class="lbl">{{ i18n.isES() ? 'Panel de control' : 'Dashboard' }}</span>
            </a>
            <a routerLink="/ordenes" routerLinkActive="on" class="nav-item" (click)="onNav()">
              <span class="mi">receipt_long</span><span class="lbl">{{ i18n.isES() ? 'Pedidos' : 'Orders' }}</span>
            </a>
          }
        </nav>

        <a class="sidefoot" href="https://fhanlabs.cl" target="_blank" rel="noopener">
          <span class="dot"></span>{{ i18n.isES() ? 'Un producto de' : 'A product by' }} <b>FHAN Labs</b>
        </a>
      </aside>

      @if (isMobile() && sidenavOpen()) {
        <div class="backdrop" (click)="sidenavOpen.set(false)"></div>
      }

      <div class="main-wrap">
        <!-- ===== Header (layout TailAdmin) ===== -->
        <header class="topbar">
          <button class="icon-btn menu" (click)="sidenavOpen.set(!sidenavOpen())" aria-label="menu"><span class="mi">menu</span></button>
          <app-global-search />
          <span class="spacer"></span>

          <div class="tools">
            <button class="icon-btn" (click)="theme.toggle()" [title]="theme.theme() === 'dark' ? 'Light' : 'Dark'">
              <span class="mi">{{ theme.theme() === 'dark' ? 'light_mode' : 'dark_mode' }}</span>
            </button>
            <button class="btn btn-ghost btn-s" type="button" (click)="i18n.toggle()">{{ i18n.isES() ? 'ES' : 'EN' }}</button>
            <button class="btn btn-ghost btn-s" type="button" (click)="currency.toggle()">{{ currency.currency() }}</button>
          </div>

          @if (auth.isLoggedIn()) {
            <span class="user" [title]="auth.user()?.name ?? ''"><span class="mi">account_circle</span><span class="uname">{{ auth.user()?.name }}</span></span>
            <button class="btn btn-outline btn-s logout" type="button" (click)="auth.logout()" [attr.aria-label]="i18n.t('nav.logout')">
              <span class="mi">logout</span><span class="lbl">{{ i18n.t('nav.logout') }}</span>
            </button>
          } @else {
            <a class="btn btn-primary btn-s" routerLink="/login">{{ i18n.t('nav.login') }}</a>
          }
        </header>

        <main class="content"><router-outlet /></main>
      </div>

      @if (auth.isLoggedIn()) {
        <app-card-chat />
      }
    </div>
  `,
  styles: [
    `
      .shell { display: flex; min-height: 100vh; }

      /* --- Sidebar --- */
      .side {
        display: flex;
        flex-direction: column;
        width: 260px;
        flex: 0 0 260px;
        border-right: 1px solid var(--border);
        background: var(--card);
        padding: 8px 12px;
        overflow-y: auto;
        overflow-x: hidden;
        transition: width 0.2s ease, flex-basis 0.2s ease;
        /* Fijo al hacer scroll: solo el contenido se desplaza */
        position: sticky;
        top: 0;
        height: 100vh;
        align-self: flex-start;
      }
      .brand {
        display: flex; align-items: center; gap: 8px;
        font-weight: 800; font-size: 20px; letter-spacing: -0.5px;
        padding: 16px 10px 14px; white-space: nowrap;
      }
      .brand .logo { flex: none; }
      .brand .hl { color: var(--primary); }
      .brand .grn { color: var(--accent); }
      .wordcol { display: flex; flex-direction: column; line-height: 1.05; }
      .byline { font-size: 10px; font-weight: 600; letter-spacing: 0.4px; color: var(--muted); }
      .shell.collapsed .wordcol { display: none; }
      .sidefoot {
        display: flex; align-items: center; gap: 6px;
        margin-top: auto; padding: 14px 10px 10px;
        font-size: 11px; color: var(--muted); white-space: nowrap;
      }
      .sidefoot b { color: var(--text); font-weight: 700; }
      .sidefoot:hover b { color: var(--primary); }
      .sidefoot .dot { width: 7px; height: 7px; border-radius: 50%; background: linear-gradient(135deg, #465fff, #059669); flex: none; }
      .shell.collapsed .sidefoot { justify-content: center; padding-left: 0; padding-right: 0; }
      .shell.collapsed .sidefoot b, .shell.collapsed .sidefoot span:not(.dot) { display: none; }
      .nav { display: flex; flex-direction: column; gap: 2px; }
      .subheader {
        display: flex; align-items: center;
        color: var(--muted); font-size: 11px; text-transform: uppercase;
        letter-spacing: 0.6px; font-weight: 600; margin: 14px 10px 6px;
      }
      .subheader .dots { display: none; font-size: 18px; }
      .nav-item {
        display: flex; align-items: center; gap: 12px;
        padding: 9px 10px; border-radius: 8px; font-size: 14px; font-weight: 500;
        color: var(--text); transition: background 0.15s ease, color 0.15s ease;
        white-space: nowrap;
      }
      .nav-item .mi { font-size: 20px; color: var(--muted); flex: none; }
      .nav-item .lbl { flex: 1; overflow: hidden; text-overflow: ellipsis; }
      .nav-item:hover { background: var(--card-2); }
      .nav-item.on { background: color-mix(in srgb, var(--primary) 12%, transparent); }
      .nav-item.on, .nav-item.on .mi { color: var(--primary); }
      .navbadge {
        min-width: 20px; height: 20px; padding: 0 6px; border-radius: 999px;
        background: var(--primary); color: #fff;
        font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center;
      }

      /* Colapsado (escritorio): riel de íconos estilo TailAdmin */
      .shell.collapsed .side { width: 76px; flex-basis: 76px; }
      .shell.collapsed .brand .word { display: none; }
      .shell.collapsed .subheader { justify-content: center; margin-left: 0; margin-right: 0; }
      .shell.collapsed .subheader .txt { display: none; }
      .shell.collapsed .subheader .dots { display: inline-block; }
      .shell.collapsed .nav-item { justify-content: center; padding: 9px 0; }
      .shell.collapsed .nav-item .lbl, .shell.collapsed .navbadge { display: none; }

      .backdrop { position: fixed; inset: 0; background: rgba(16, 24, 40, 0.55); z-index: 20; backdrop-filter: blur(2px); }

      /* --- Main --- */
      .main-wrap { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; }
      .topbar {
        position: sticky; top: 0; z-index: 10;
        background: color-mix(in srgb, var(--card) 90%, transparent);
        backdrop-filter: blur(10px);
        border-bottom: 1px solid var(--border);
        display: flex; align-items: center; gap: 8px;
        padding: 8px 16px; min-height: 58px;
      }
      .topbar .menu { width: 34px; height: 34px; }
      .topbar .menu .mi { font-size: 19px; }
      .spacer { flex: 1 1 auto; }
      .tools { display: inline-flex; align-items: center; gap: 4px; margin-right: 6px; }
      .tools .icon-btn { width: 34px; height: 34px; border-radius: 999px; }
      .tools .icon-btn .mi { font-size: 18px; }
      .user { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 500; color: var(--muted); margin-right: 6px; }
      .user .mi { font-size: 20px; }
      .content { padding: 26px clamp(16px, 3vw, 40px) 60px; max-width: 1600px; width: 100%; margin: 0 auto; }

      /* Móvil: la barra lateral se convierte en panel deslizante */
      .shell.mobile .side {
        position: fixed; top: 0; left: 0; bottom: 0; z-index: 30; width: 274px;
        transform: translateX(-100%); transition: transform 0.2s ease;
        box-shadow: var(--shadow);
      }
      .shell.mobile.open .side { transform: translateX(0); }
      .logout .mi { display: none; }

      /* Móvil: la barra superior usa dos filas (acciones arriba, buscador abajo a todo el ancho) */
      .shell.mobile .topbar { flex-wrap: wrap; row-gap: 8px; padding: 8px 12px; }
      .shell.mobile .topbar app-global-search { order: 10; flex: 1 0 100%; min-width: 0; }
      .shell.mobile .tools { margin-right: 0; gap: 2px; }
      .shell.mobile .user { margin-right: 0; }
      .shell.mobile .user .uname { display: none; }
      .shell.mobile .logout { width: 34px; height: 34px; padding: 0; border-radius: 999px; }
      .shell.mobile .logout .mi { display: inline-block; font-size: 18px; }
      .shell.mobile .logout .lbl { display: none; }
      .shell.mobile .content { padding: 18px 14px 96px; } /* margen inferior: el botón flotante del chat no tapa lo último */
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
