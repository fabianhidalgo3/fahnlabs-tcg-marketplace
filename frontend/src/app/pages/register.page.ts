import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '../core/services/auth.service';
import { I18nService } from '../core/services/i18n.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  template: `
    <div class="wrap">
      <mat-card class="auth" appearance="outlined">
        <h1>{{ i18n.t('auth.register') }}</h1>
        <mat-form-field appearance="fill">
          <mat-label>{{ i18n.t('auth.name') }}</mat-label>
          <input matInput [(ngModel)]="name" />
        </mat-form-field>
        <mat-form-field appearance="fill">
          <mat-label>{{ i18n.t('auth.email') }}</mat-label>
          <input matInput type="email" [(ngModel)]="email" />
        </mat-form-field>
        <mat-form-field appearance="fill">
          <mat-label>{{ i18n.t('auth.password') }}</mat-label>
          <input matInput type="password" [(ngModel)]="password" (keyup.enter)="submit()" />
        </mat-form-field>
        @if (error()) { <p class="err">{{ error() }}</p> }
        <button mat-flat-button [disabled]="loading()" (click)="submit()">
          {{ loading() ? i18n.t('cart.processing') : i18n.t('auth.register') }}
        </button>
        <p class="muted foot">{{ i18n.t('auth.hasAccount') }} <a routerLink="/login">{{ i18n.t('auth.login') }}</a></p>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .wrap { display: grid; place-items: center; padding-top: 24px; }
      .auth { max-width: 420px; width: 100%; padding: 28px; display: flex; flex-direction: column; gap: 6px; }
      .auth h1 { margin-bottom: 10px; }
      mat-form-field { width: 100%; }
      .err { color: var(--danger); font-size: 13px; }
      button { margin-top: 6px; }
      .foot { text-align: center; font-size: 13px; margin-top: 10px; }
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
