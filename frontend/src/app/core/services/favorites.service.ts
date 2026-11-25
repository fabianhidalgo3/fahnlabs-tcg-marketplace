import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { CardModel, CardSet } from '../models/models';

/**
 * Favoritos del usuario (cartas y sets). Mantiene los ids en signals para
 * pintar los ♥ en cualquier grilla sin repetir llamadas.
 */
@Injectable({ providedIn: 'root' })
export class FavoritesService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private api = environment.apiUrl;

  private cardIds = signal<ReadonlySet<string>>(new Set());
  private setIds = signal<ReadonlySet<string>>(new Set());
  private loaded = false;

  readonly cardCount = computed(() => this.cardIds().size);
  readonly setCount = computed(() => this.setIds().size);

  /** Carga los ids una vez por sesión (si hay usuario logueado). */
  ensureLoaded(): void {
    if (this.loaded || !this.auth.isLoggedIn()) return;
    this.loaded = true;
    this.http
      .get<{ cards: string[]; sets: string[] }>(`${this.api}/favorites/ids`)
      .subscribe({
        next: (r) => {
          this.cardIds.set(new Set(r.cards));
          this.setIds.set(new Set(r.sets));
        },
        error: () => (this.loaded = false),
      });
  }

  isCard(id: string): boolean { return this.cardIds().has(id); }
  isSet(id: string): boolean { return this.setIds().has(id); }

  toggle(kind: 'card' | 'set', id: string): void {
    // Optimista: actualiza el signal al tiro y revierte si falla.
    const src = kind === 'card' ? this.cardIds : this.setIds;
    const next = new Set(src());
    const was = next.has(id);
    if (was) next.delete(id); else next.add(id);
    src.set(next);

    this.http
      .post<{ favorite: boolean }>(`${this.api}/favorites/toggle`, { kind, id })
      .subscribe({
        error: () => {
          const revert = new Set(src());
          if (was) revert.add(id); else revert.delete(id);
          src.set(revert);
        },
      });
  }

  /** Favoritos poblados para la página "Mis favoritos". */
  list(): Observable<{ cards: CardModel[]; sets: CardSet[] }> {
    return this.http
      .get<{ cards: any[]; sets: any[] }>(`${this.api}/favorites`)
      .pipe(tap(() => this.ensureLoaded()));
  }
}
