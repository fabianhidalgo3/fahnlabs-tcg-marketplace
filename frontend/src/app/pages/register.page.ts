import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { I18nService } from '../core/services/i18n.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="wrap">
      <div class="auth card-surface">
        <h1>{{ i18n.t('auth.register') }}</h1>
        <label class="ui-field"><span class="lbl">{{ i18n.t('auth.name') }}</span><input class="ui-input" [placeholder]="i18n.isES() ? 'Ej. Juana Pérez' : 'E.g. Jane Doe'" [(ngModel)]="name" /></label>
        <label class="ui-field"><span class="lbl">{{ i18n.t('auth.email') }}</span><input class="ui-input" type="email" placeholder="tu@correo.com" [(ngModel)]="email" /></label>
        <label class="ui-field"><span class="lbl">{{ i18n.t('auth.password') }}</span><input class="ui-input" type="password" placeholder="••••••••" [(ngModel)]="password" (keyup.enter)="submit()" /></label>
        @if (error()) { <p class="err">{{ error() }}</p> }
        <button class="btn btn-primary" type="button" [disabled]="loading()" (click)="submit()">
          {{ loading() ? i18n.t('cart.processing') : i18n.t('auth.register') }}
        </button>
        <p class="muted foot">{{ i18n.t('auth.hasAccount') }} <a routerLink="/login">{{ i18n.t('auth.login') }}</a></p>
      </div>
    </div>
  `,
  styles: [
    `
      .wrap { display: grid; place-items: center; padding-top: 24px; }
      .auth { max-width: 420px; width: 100%; padding: 28px; display: flex; flex-direction: column; gap: 14px; }
      .auth h1 { margin-bottom: 0; }
      .ui-field { width: 100%; }
      .err { color: var(--danger); font-size: 13px; margin: 0; }
      button { margin-top: 4px; }
      .foot { text-align: center; font-size: 13px; margin: 6px 0 0; }
      .foot a { color: var(--primary); font-weight: 600; }
    `,
  ],
})
export class RegisterPage {
  private auth = inject(AuthService);
  private router = inject(Router);
  i18n = inject(I18nService);

  name = '';
  email = '';
  password = '';
  loading = signal(false);
  error = signal('');

  async submit() {
    this.loading.set(true);
    this.error.set('');
    try {
      await this.auth.register(this.name, this.email, this.password);
      this.router.navigate(['/catalogo']);
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'No se pudo crear la cuenta');
      this.loading.set(false);
    }
  }
}
