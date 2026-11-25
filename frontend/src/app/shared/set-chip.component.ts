import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Chip de set reutilizable: símbolo + nombre, igual en TODA la app
 * (lista de sets, colección, checklist, catálogo, carpetas, detalle carta…).
 * Si `link` está definido navega a esa ruta; si no, es solo informativo.
 * Estilo: badge "light" de TailAdmin (Tailwind).
 */
@Component({
  selector: 'app-set-chip',
  standalone: true,
  imports: [RouterLink],
  template: `
    @if (set(); as s) {
      @if (link(); as l) {
        <a class="chip lnk" [routerLink]="l" (click)="$event.stopPropagation()">
          @if (s.symbolUrl) { <img [src]="s.symbolUrl" [alt]="s.name" loading="lazy" /> }
          <span class="nm">{{ s.name }}</span>
          @if (extra()) { <span class="xt">{{ extra() }}</span> }
        </a>
      } @else {
        <span class="chip">
          @if (s.symbolUrl) { <img [src]="s.symbolUrl" [alt]="s.name" loading="lazy" /> }
          <span class="nm">{{ s.name }}</span>
          @if (extra()) { <span class="xt">{{ extra() }}</span> }
        </span>
      }
    }
  `,
  styles: [
    `
      :host { display: inline-flex; max-width: 100%; }
      .chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        max-width: 100%;
        padding: 2px 9px 2px 4px;
        border-radius: 999px;
        background: var(--card-2);
        border: 1px solid var(--border);
        font-size: 12px;
        font-weight: 500;
        color: var(--muted);
        line-height: 1.5;
      }
      .chip img { width: 16px; height: 16px; object-fit: contain; flex: none; }
      .chip .nm { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .chip .xt { flex: none; opacity: 0.8; }
      .chip.lnk { cursor: pointer; transition: border-color 0.12s ease, color 0.12s ease; }
      .chip.lnk:hover { color: var(--text); border-color: color-mix(in srgb, var(--primary) 55%, var(--border)); }
    `,
  ],
})
export class SetChipComponent {
  /** Set a mostrar (necesita name; symbolUrl opcional). */
  set = input.required<{ name: string; symbolUrl?: string | null } | null | undefined>();
  /** Ruta opcional (ej. ['/coleccion', id] o ['/sets', id]). */
  link = input<any[] | null>(null);
  /** Texto extra al final (ej. número de carta o código del set). */
  extra = input<string>('');

  // computed para poder usar el mismo template con set() nulo sin romper.
  protected has = computed(() => !!this.set());
}
