import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { StorageLocationService } from '../core/services/storage-location.service';
import { I18nService } from '../core/services/i18n.service';
import { StorageKind, StorageLocation } from '../core/models/models';

const TYPES: { value: StorageKind; label: string; icon: string }[] = [
  { value: 'album', label: 'Álbum', icon: 'photo_album' },
  { value: 'binder', label: 'Carpeta', icon: 'folder' },
  { value: 'box', label: 'Caja', icon: 'inventory_2' },
  { value: 'deckbox', label: 'Deck box', icon: 'style' },
];

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, MatIconModule],
  template: `
    <h1>{{ i18n.t('storage.title') }}</h1>
    <p class="muted">{{ i18n.t('storage.subtitle') }}</p>

    <mat-card class="new" appearance="outlined">
      <mat-form-field appearance="outline" class="grow">
        <mat-label>{{ i18n.t('storage.name') }}</mat-label>
        <input matInput [(ngModel)]="name" />
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>{{ i18n.isES() ? 'Tipo' : 'Type' }}</mat-label>
        <mat-select [(ngModel)]="type">
          @for (t of types; track t.value) { <mat-option [value]="t.value">{{ t.label }}</mat-option> }
        </mat-select>
      </mat-form-field>
      <input class="color" type="color" [(ngModel)]="color" />
      <button mat-flat-button [disabled]="!name.trim()" (click)="create()">
        <mat-icon>add</mat-icon>{{ i18n.t('storage.create') }}
      </button>
    </mat-card>

    <div class="grid">
      @for (s of locations(); track s.id) {
        <mat-card class="loc" appearance="outlined" [style.border-left-color]="s.color">
          <mat-icon class="ic" [style.color]="s.color">{{ icon(s.type) }}</mat-icon>
          <div class="info">
            <div class="nm">{{ s.name }}</div>
            <div class="muted">{{ label(s.type) }} · {{ s.cardCount }} {{ i18n.t('storage.cards') }}</div>
          </div>
          <button mat-icon-button (click)="remove(s)"><mat-icon>delete</mat-icon></button>
        </mat-card>
      } @empty {
        <p class="muted">{{ i18n.t('storage.empty') }}</p>
      }
    </div>
  `,
  styles: [
    `
      h1 { margin-bottom: 2px; }
      .new { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; padding: 16px; margin: 20px 0; }
      .new .grow { flex: 1; min-width: 180px; }
      mat-form-field { --mat-form-field-container-vertical-padding: 8px; }
      .color { height: 40px; width: 52px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-soft); padding: 3px; }
      .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; }
      .loc { display: flex; align-items: center; gap: 14px; padding: 14px 16px; border-left: 4px solid var(--primary); }
      .ic { font-size: 30px; height: 30px; width: 30px; }
      .info { flex: 1; }
      .nm { font-weight: 800; font-size: 16px; }
      @media (max-width: 620px) { .new { flex-direction: column; align-items: stretch; } }
    `,
  ],
})
export class StoragePage {
  private storage = inject(StorageLocationService);
  i18n = inject(I18nService);
  locations = signal<StorageLocation[]>([]);
  types = TYPES;

  name = '';
  type: StorageKind = 'album';
  color = '#6c5ce7';

  constructor() { this.load(); }
  load() { this.storage.list().subscribe((l) => this.locations.set(l)); }
  create() {
    this.storage.create({ name: this.name.trim(), type: this.type, color: this.color }).subscribe(() => { this.name = ''; this.load(); });
  }
  remove(s: StorageLocation) { this.storage.remove(s.id).subscribe(() => this.load()); }
  icon(t: StorageKind) { return TYPES.find((x) => x.value === t)?.icon ?? 'inventory_2'; }
  label(t: StorageKind) { return TYPES.find((x) => x.value === t)?.label ?? t; }
}
