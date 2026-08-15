import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TuiButton, TuiTextfield, TuiInput } from '@taiga-ui/core';
import { AuthService } from '../core/services/auth.service';
import { I18nService } from '../core/services/i18n.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TuiButton, TuiTextfield, TuiInput],
  template: `
    <div class="wrap">
      <div class="auth card-surface">
        <h1>{{ i18n.t('auth.register') }}</h1>
        <tui-textfield>
          <label tuiLabel>{{ i18n.t('auth.name') }}</label>
          <input tuiInput [(ngModel)]="name" />
        </tui-textfield>
        <tui-textfield>
          <label tuiLabel>{{ i18n.t('auth.email') }}</label>
          <input tuiInput type="email" [(ngModel)]="email" />
        </tui-textfield>
        <tui-textfield>
          <label tuiLabel>{{ i18n.t('auth.password') }}</label>
          <input tuiInput type="password" [(ngModel)]="password" (keyup.enter)="submit()" />
        </tui-textfield>
        @if (error()) { <p class="err">{{ error() }}</p> }
        <button tuiButton type="button" appearance="primary" [disabled]="loading()" (click)="submit()">
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
      tui-textfield { width: 100%; }
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
