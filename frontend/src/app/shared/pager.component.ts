import { Component, input, output } from '@angular/core';

/**
 * Paginador estándar de la app (estilos globales `.pager` en styles.css).
 * Uso: <app-pager [page]="page()" [pages]="pages()" (pageChange)="go($event)" />
 * `top` lo hace compacto para usarlo dentro de un `.countbar`.
 */
@Component({
  selector: 'app-pager',
  standalone: true,
  template: `
    @if (pages() > 1) {
      <div class="pager" [class.top]="top()">
        <button class="icon-btn" type="button" [disabled]="page() === 1" (click)="pageChange.emit(page() - 1)">
          <span class="mi">chevron_left</span>
        </button>
        <span class="muted">{{ page() }} / {{ pages() }}</span>
        <button class="icon-btn" type="button" [disabled]="page() === pages()" (click)="pageChange.emit(page() + 1)">
          <span class="mi">chevron_right</span>
        </button>
      </div>
    }
  `,
})
export class PagerComponent {
  page = input.required<number>();
  pages = input.required<number>();
  top = input(false);
  pageChange = output<number>();
}
