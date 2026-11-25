import { Component, inject, input } from '@angular/core';
import { AuthService } from '../core/services/auth.service';
import { FavoritesService } from '../core/services/favorites.service';

/**
 * Botón corazón para marcar cartas o sets como favoritos.
 * Solo se muestra con sesión iniciada (y no admin). Uso:
 *   <app-fav-btn kind="card" [id]="c.id" />
 */
@Component({
  selector: 'app-fav-btn',
  standalone: true,
  template: `
    @if (auth.isLoggedIn() && !auth.isAdmin()) {
      <button
        type="button"
        class="fav"
        [class.on]="on"
        [attr.aria-label]="on ? 'Quitar de favoritos' : 'Agregar a favoritos'"
        (click)="toggle($event)"
      >
        <span class="mi">{{ on ? 'favorite' : 'favorite_border' }}</span>
      </button>
    }
  `,
  styles: [
    `
      :host { display: inline-flex; }
      .fav {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: 6px;
        border: none;
        background: rgba(0, 0, 0, 0.45);
        color: #fff;
        cursor: pointer;
        transition: color 0.12s ease, transform 0.12s ease, background 0.12s ease;
      }
      .fav .mi { font-size: 17px; }
      .fav:hover { transform: scale(1.08); background: rgba(0, 0, 0, 0.6); }
      .fav.on { color: #f43f5e; }
      /* variante "plana" para usar fuera de imágenes (headers, filas) */
      :host(.flat) .fav { background: var(--card-2); border: 1px solid var(--border); color: var(--muted); }
      :host(.flat) .fav.on { color: #f43f5e; border-color: color-mix(in srgb, #f43f5e 40%, var(--border)); }
    `,
  ],
})
export class FavBtnComponent {
  auth = inject(AuthService);
  private favs = inject(FavoritesService);

  kind = input.required<'card' | 'set'>();
  id = input.required<string>();

  constructor() { this.favs.ensureLoaded(); }

  get on(): boolean {
    return this.kind() === 'card' ? this.favs.isCard(this.id()) : this.favs.isSet(this.id());
  }

  toggle(ev: Event) {
    ev.stopPropagation();
    ev.preventDefault();
    this.favs.toggle(this.kind(), this.id());
  }
}
