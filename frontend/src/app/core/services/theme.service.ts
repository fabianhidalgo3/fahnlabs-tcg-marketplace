import { Injectable, effect, signal } from '@angular/core';

export type Theme = 'dark' | 'light';
const THEME_KEY = 'tcg_theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<Theme>(this.restore());

  constructor() {
    // Refleja el tema en <html data-theme> + clase `dark` (Tailwind) y lo persiste.
    effect(() => {
      const t = this.theme();
      document.documentElement.setAttribute('data-theme', t);
      document.documentElement.classList.toggle('dark', t === 'dark');
      localStorage.setItem(THEME_KEY, t);
    });
  }

  toggle() {
    this.theme.set(this.theme() === 'dark' ? 'light' : 'dark');
  }

  private restore(): Theme {
    return (localStorage.getItem(THEME_KEY) as Theme) ?? 'dark';
  }
}
