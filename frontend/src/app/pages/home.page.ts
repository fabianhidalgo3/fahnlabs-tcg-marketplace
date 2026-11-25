import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { CatalogService } from '../core/services/catalog.service';
import { CollectionService, CollectionSummary } from '../core/services/collection.service';
import { I18nService } from '../core/services/i18n.service';
import { CurrencyService } from '../core/services/currency.service';
import { CardModel, InventoryItem } from '../core/models/models';
import { thumbUrl } from '../core/utils/card-image';

/**
 * INICIO del coleccionista: resumen de tu colección, sets en progreso y
 * accesos directos a lo que más se usa. Invitados → catálogo; admin → panel.
 */
@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <!-- Banner principal -->
    <section class="hero">
      <div class="hero-txt">
        <span class="hero-brand">SingleTCG <i>by FHAN Labs</i></span>
        <h2>{{ i18n.isES() ? 'Tu colección, completa y viva.' : 'Your collection, complete and alive.' }}</h2>
        <p>{{ i18n.isES() ? 'Registra tus cartas, sigue el valor de mercado día a día y vende tus repetidas en un click.' : 'Track your cards, follow daily market value and sell your duplicates in one click.' }}</p>
        <div class="hero-cta">
          <a class="btn hero-btn" routerLink="/coleccion/agregar"><span class="mi">playlist_add</span>{{ i18n.isES() ? 'Agregar carta' : 'Add card' }}</a>
          <a class="btn hero-btn ghost" routerLink="/catalogo"><span class="mi">style</span>{{ i18n.isES() ? 'Ver Singles' : 'Browse Singles' }}</a>
        </div>
      </div>
      <svg class="hero-fan" viewBox="0 0 48 40" aria-hidden="true">
        <g transform="rotate(-16 13 24)"><rect x="5" y="12" width="16" height="22" rx="3" fill="rgba(255,255,255,0.22)" /></g>
        <g transform="rotate(16 35 24)"><rect x="27" y="12" width="16" height="22" rx="3" fill="rgba(255,255,255,0.16)" /></g>
        <rect x="16" y="6" width="16" height="24" rx="3" fill="rgba(255,255,255,0.32)" />
        <path d="M24 11.2 L25.6 15.4 L29.8 17 L25.6 18.6 L24 22.8 L22.4 18.6 L18.2 17 L22.4 15.4 Z" fill="#fff" />
      </svg>
    </section>

    <header class="page-head">
      <div>
        <h1>{{ i18n.isES() ? 'Hola' : 'Hi' }}, {{ auth.user()?.name?.split(' ')?.[0] }} 👋</h1>
        <p class="muted">{{ i18n.isES() ? 'Así va tu colección hoy.' : 'How your collection is doing today.' }}</p>
      </div>
      <div class="ph-actions">
        <a class="btn btn-primary" routerLink="/coleccion/agregar"><span class="mi">playlist_add</span>{{ i18n.isES() ? 'Agregar carta' : 'Add card' }}</a>
        <a class="btn btn-outline" routerLink="/coleccion"><span class="mi">collections_bookmark</span>{{ i18n.isES() ? 'Mi Colección' : 'My Collection' }}</a>
      </div>
    </header>

    @if (summary(); as s) {
      <!-- Resumen -->
      <div class="statgrid">
        <div class="stat card-surface">
          <span class="mi ico val">payments</span>
          <div><span class="muted">{{ i18n.isES() ? 'Valor de tu colección' : 'Collection value' }}</span><b class="accent">{{ cur.format(s.collectionValue) }}</b></div>
        </div>
        <div class="stat card-surface">
          <span class="mi ico">style</span>
          <div><span class="muted">{{ i18n.isES() ? 'Cartas distintas' : 'Distinct cards' }}</span><b>{{ s.distinctSlots }}</b></div>
        </div>
        <div class="stat card-surface">
          <span class="mi ico">content_copy</span>
          <div><span class="muted">{{ i18n.isES() ? 'Copias en total' : 'Total copies' }}</span><b>{{ s.totalCopies }}</b></div>
        </div>
        <div class="stat card-surface">
          <span class="mi ico">auto_awesome_motion</span>
          <div><span class="muted">{{ i18n.isES() ? 'Sets en colección' : 'Sets collected' }}</span><b>{{ s.sets }}</b></div>
        </div>
      </div>

      <!-- Sets en progreso -->
      @if (s.setsInProgress.length) {
        <h3 class="sec"><span class="mi">flag</span>{{ i18n.isES() ? 'Sigue completando' : 'Keep completing' }}</h3>
        <div class="progressgrid">
          @for (p of s.setsInProgress; track p.id) {
            <a class="pset card-surface" [routerLink]="['/coleccion', p.id]">
              <div class="prow">
                @if (p.symbolUrl) { <img [src]="p.symbolUrl" [alt]="p.name" loading="lazy" /> }
                <b class="pname">{{ p.name }}</b>
                <span class="pct">{{ p.completionPercent }}%</span>
              </div>
              <div class="pbar"><div class="fill" [style.width.%]="p.completionPercent"></div></div>
              <span class="muted small">{{ p.ownedSlots }}/{{ p.totalSlots }} · {{ i18n.isES() ? 'faltan' : 'missing' }} {{ p.totalSlots - p.ownedSlots }}</span>
            </a>
          }
        </div>
      }
    } @else {
      <p class="muted">{{ i18n.t('catalog.loading') }}</p>
    }

    <!-- Recién publicados en el marketplace -->
    @if (recent().length) {
      <h3 class="sec"><span class="mi">new_releases</span>{{ i18n.isES() ? 'Recién publicados' : 'Just listed' }}
        <a class="more muted" routerLink="/catalogo">{{ i18n.isES() ? 'ver Singles →' : 'see Singles →' }}</a>
      </h3>
      <div class="rstrip">
        @for (r of recent(); track r.id) {
          <a class="ritem card-surface" [routerLink]="['/cartas', cardOf(r)?.id]">
            @if (cardOf(r)?.imageUrl) { <img [src]="thumb(cardOf(r)?.imageUrl)" [alt]="cardOf(r)?.name" loading="lazy" /> }
            <div class="rname">{{ cardOf(r)?.name }}</div>
            <div class="rprice">{{ cur.format(r.price) }}</div>
          </a>
        }
      </div>
    }

    <!-- Banner: vende tus repetidas -->
    <section class="promo card-surface">
      <span class="mi pico">sell</span>
      <div class="ptxt">
        <b>{{ i18n.isES() ? '¿Cartas repetidas juntando polvo?' : 'Duplicates gathering dust?' }}</b>
        <span class="muted">{{ i18n.isES() ? 'Publícalas a precio de mercado real — el stock se cuida solo: si vendes o pierdes copias, se ajusta.' : 'List them at real market price — stock takes care of itself.' }}</span>
      </div>
      <a class="btn btn-primary" routerLink="/publicaciones"><span class="mi">storefront</span>{{ i18n.isES() ? 'Vender repetidas' : 'Sell duplicates' }}</a>
    </section>

    <!-- Accesos directos -->
    <h3 class="sec"><span class="mi">bolt</span>{{ i18n.isES() ? 'Accesos directos' : 'Shortcuts' }}</h3>
    <div class="shortcuts">
      <a class="sc card-surface" routerLink="/almacenamiento"><span class="mi">auto_stories</span>{{ i18n.isES() ? 'Álbumes y cajas' : 'Binders & boxes' }}</a>
      <a class="sc card-surface" routerLink="/favoritos"><span class="mi">favorite</span>{{ i18n.isES() ? 'Favoritos' : 'Wishlist' }}</a>
      <a class="sc card-surface" routerLink="/sets"><span class="mi">auto_awesome_motion</span>{{ i18n.isES() ? 'Expansiones' : 'Expansions' }}</a>
      <a class="sc card-surface" routerLink="/ordenes"><span class="mi">receipt_long</span>{{ i18n.isES() ? 'Mis pedidos' : 'My orders' }}</a>
    </div>
  `,
  styles: [
    `
      /* Banner hero */
      .hero {
        position: relative; overflow: hidden;
        display: flex; align-items: center; justify-content: space-between; gap: 20px;
        border-radius: 14px; padding: 30px 34px; margin-bottom: 22px;
        background: linear-gradient(118deg, #3641f5 0%, #465fff 35%, #059669 100%);
        color: #fff;
      }
      .hero-txt { max-width: 640px; position: relative; z-index: 1; }
      .hero-brand { font-size: 12px; font-weight: 800; letter-spacing: 1.2px; text-transform: uppercase; opacity: 0.85; }
      .hero-brand i { font-style: normal; font-weight: 600; opacity: 0.75; text-transform: none; letter-spacing: 0.3px; }
      .hero h2 { color: #fff; font-size: clamp(22px, 3vw, 32px); margin: 6px 0 8px; line-height: 1.15; }
      .hero p { font-size: 14px; opacity: 0.92; margin-bottom: 16px; }
      .hero-cta { display: flex; gap: 10px; flex-wrap: wrap; }
      .hero-btn { background: #fff; color: #1d2939; border: none; font-weight: 700; }
      .hero-btn:hover { background: #ecfdf5; }
      .hero-btn.ghost { background: rgba(255,255,255,0.14); color: #fff; border: 1px solid rgba(255,255,255,0.45); }
      .hero-btn.ghost:hover { background: rgba(255,255,255,0.24); }
      .hero-fan { width: 190px; height: 160px; flex: none; margin-right: 6px; transform: rotate(8deg) scale(1.15); }
      @media (max-width: 760px) { .hero-fan { display: none; } .hero { padding: 24px; } }
      /* Banner promo repetidas */
      .promo {
        display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
        padding: 18px 20px; margin: 26px 0 4px;
        border-left: 4px solid var(--accent);
      }
      .promo .pico { font-size: 30px; color: var(--accent); background: color-mix(in srgb, var(--accent) 14%, transparent); border-radius: 10px; padding: 10px; }
      .promo .ptxt { flex: 1; min-width: 240px; display: flex; flex-direction: column; gap: 2px; font-size: 14px; }
      .promo .ptxt .muted { font-size: 13px; }
      .statgrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; margin-top: 16px; }
      .stat { display: flex; align-items: center; gap: 12px; padding: 16px; }
      .stat .ico { font-size: 26px; color: var(--primary); background: color-mix(in srgb, var(--primary) 12%, transparent); border-radius: 10px; padding: 9px; }
      .stat .ico.val { color: var(--accent); background: color-mix(in srgb, var(--accent) 14%, transparent); }
      .stat div { display: flex; flex-direction: column; gap: 1px; }
      .stat span { font-size: 12px; }
      .stat b { font-size: 20px; }
      .stat .accent { color: var(--accent); }
      .sec { display: flex; align-items: center; gap: 8px; margin: 26px 0 12px; }
      .sec .mi { color: var(--primary); font-size: 20px; }
      .sec .more { margin-left: auto; font-size: 12px; font-weight: 600; }
      .sec .more:hover { color: var(--primary); }
      .progressgrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; }
      .pset { padding: 14px 16px; cursor: pointer; transition: transform 0.12s; display: block; }
      .pset:hover { transform: translateY(-3px); }
      .prow { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
      .prow img { width: 22px; height: 22px; object-fit: contain; flex: none; }
      .pname { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; }
      .pct { font-weight: 800; color: var(--primary); }
      .small { font-size: 12px; display: block; margin-top: 6px; }
      .rstrip { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 8px; }
      .ritem { flex: 0 0 116px; padding: 8px; text-align: center; cursor: pointer; transition: transform 0.12s; }
      .ritem:hover { transform: translateY(-3px); }
      .ritem img { width: 100%; aspect-ratio: 63/88; object-fit: contain; border-radius: 6px; background: var(--bg-soft); }
      .rname { font-size: 12px; font-weight: 700; margin-top: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .rprice { font-size: 12px; font-weight: 800; color: var(--accent); }
      .shortcuts { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
      .sc { display: flex; align-items: center; gap: 10px; padding: 14px 16px; font-weight: 600; font-size: 14px; transition: transform 0.12s, border-color 0.12s; }
      .sc:hover { transform: translateY(-2px); border-color: color-mix(in srgb, var(--primary) 45%, var(--border)); }
      .sc .mi { color: var(--primary); font-size: 20px; }
    `,
  ],
})
export class HomePage {
  thumb = thumbUrl;
  auth = inject(AuthService);
  i18n = inject(I18nService);
  cur = inject(CurrencyService);
  private collection = inject(CollectionService);
  private catalog = inject(CatalogService);
  private router = inject(Router);

  summary = signal<CollectionSummary | null>(null);
  recent = signal<InventoryItem[]>([]);
  cardOf(it: InventoryItem): CardModel | null {
    return typeof it.cardModel === 'object' ? (it.cardModel as CardModel) : null;
  }

  constructor() {
    // Invitado → catálogo. El Inicio es del coleccionista (admin incluido:
    // el admin también colecciona — es la cuenta real del dueño).
    if (!this.auth.isLoggedIn()) { this.router.navigate(['/catalogo']); return; }
    this.collection.summary().subscribe((s) => this.summary.set(s));
    this.catalog.recentListings(8).subscribe((r) => this.recent.set(r.filter((i) => typeof i.cardModel === 'object')));
  }
}
