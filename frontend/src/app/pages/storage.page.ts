import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TuiButton, TuiTextfield, TuiInput } from '@taiga-ui/core';
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
  imports: [CommonModule, FormsModule, TuiButton, TuiTextfield, TuiInput],
  template: `
    <h1>{{ i18n.t('storage.title') }}</h1>
    <p class="muted">{{ i18n.t('storage.subtitle') }}</p>

    <div class="new card-surface">
      <tui-textfield class="grow">
        <label tuiLabel>{{ i18n.t('storage.name') }}</label>
        <input tuiInput [(ngModel)]="name" />
      </tui-textfield>
      <div class="ui-field type">
        <span class="lbl">{{ i18n.isES() ? 'Tipo' : 'Type' }}</span>
        <select class="ui-select" [(ngModel)]="type">
          @for (t of types; track t.value) { <option [value]="t.value">{{ t.label }}</option> }
        </select>
      </div>
      <input class="color" type="color" [(ngModel)]="color" />
      <button tuiButton type="button" appearance="primary" [disabled]="!name.trim()" (click)="create()">
        <span class="mi">add</span>{{ i18n.t('storage.create') }}
      </button>
    </div>

    <div class="grid">
      @for (s of locations(); track s.id) {
        <div class="loc card-surface" [style.border-left-color]="s.color">
          <span class="mi ic" [style.color]="s.color">{{ icon(s.type) }}</span>
          <div class="info">
            <div class="nm">{{ s.name }}</div>
            <div class="muted">{{ label(s.type) }} · {{ s.cardCount }} {{ i18n.t('storage.cards') }}</div>
          </div>
          <button class="icon-btn" (click)="remove(s)"><span class="mi">delete</span></button>
        </div>
      } @empty {
        <p class="muted">{{ i18n.t('storage.empty') }}</p>
      }
    </div>
  `,
  styles: [
    `
      h1 { margin-bottom: 2px; }
      .new { display: flex; flex-wrap: wrap; gap: 14px; align-items: flex-end; padding: 16px; margin: 20px 0; }
      .new .grow { flex: 1; min-width: 180px; }
      .new .type { width: 180px; }
      .color { height: 44px; width: 52px; border: 1px solid var(--border); border-radius: 10px; background: var(--bg-soft); padding: 3px; cursor: pointer; }
      .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; }
      .loc { display: flex; align-items: center; gap: 14px; padding: 14px 16px; border-left: 4px solid var(--primary); }
      .ic { font-size: 30px; }
      .info { flex: 1; }
      .nm { font-weight: 800; font-size: 16px; }
      @media (max-width: 620px) { .new { flex-direction: column; align-items: stretch; } .new .type { width: 100%; } }
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
