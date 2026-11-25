import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { I18nService } from '../core/services/i18n.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="wrap">
      <div class="auth card-surface">
        <h1>{{ i18n.t('auth.login') }}</h1>
        @if (expired()) {
          <p class="notice">{{ i18n.isES() ? 'Tu sesión expiró — vuelve a iniciar sesión para ver tu colección.' : 'Your session expired — sign in again to see your collection.' }}</p>
        }
        <p class="muted demo">Demo: <b>admin&#64;tcg.local</b> / admin123 · <b>cliente&#64;tcg.local</b> / cliente123</p>
        <label class="ui-field"><span class="lbl">{{ i18n.t('auth.email') }}</span><input class="ui-input" type="email" placeholder="tu@correo.com" [(ngModel)]="email" /></label>
        <label class="ui-field"><span class="lbl">{{ i18n.t('auth.password') }}</span><input class="ui-input" type="password" placeholder="••••••••" [(ngModel)]="password" (keyup.enter)="submit()" /></label>
        @if (error()) { <p class="err">{{ error() }}</p> }
        <button class="btn btn-primary" type="button" [disabled]="loading()" (click)="submit()">
          {{ loading() ? i18n.t('cart.processing') : i18n.t('auth.login') }}
        </button>
        <p class="muted foot">{{ i18n.t('auth.noAccount') }} <a routerLink="/registro">{{ i18n.t('auth.register') }}</a></p>
        <p class="prod muted">SingleTCG · {{ i18n.isES() ? 'un producto de' : 'a product by' }} <a href="https://fhanlabs.cl" target="_blank" rel="noopener">FHAN Labs</a></p>
      </div>
    </div>
  `,
  styles: [
    `
      .prod { margin-top: 14px; text-align: center; font-size: 11px; }
      .prod a { color: var(--accent); font-weight: 700; }
      .wrap { display: grid; place-items: center; padding-top: 24px; }
      .auth { max-width: 420px; width: 100%; padding: 28px; display: flex; flex-direction: column; gap: 14px; }
      .auth h1 { margin-bottom: 0; }
      .demo { font-size: 12px; margin: -6px 0 2px; }
      .ui-field { width: 100%; }
      .err { color: var(--danger); font-size: 13px; margin: 0; }
      .notice { background: color-mix(in srgb, var(--primary) 12%, transparent); color: var(--primary); font-size: 13px; font-weight: 600; padding: 9px 12px; border-radius: 8px; margin: 0; }
      button { margin-top: 4px; }
      .foot { text-align: center; font-size: 13px; margin: 6px 0 0; }
      .foot a { color: var(--primary); font-weight: 600; }
    `,
  ],
})
export class LoginPage {
  private auth = inject(AuthService);
  private router = inject(Router);
  i18n = inject(I18nService);

  email = '';
  password = '';
  loading = signal(false);
  error = signal('');
  /** true si llegó redirigido por un 401 (sesión vencida/antigua). */
  expired = signal(inject(ActivatedRoute).snapshot.queryParamMap.has('expired'));

  async submit() {
    this.loading.set(true);
    this.error.set('');
    try {
      await this.auth.login(this.email, this.password);
      this.router.navigate(['/catalogo']);
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'No se pudo iniciar sesión');
      this.loading.set(false);
    }
  }
}
