import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TuiButton, TuiTextfield, TuiInput } from '@taiga-ui/core';
import { StorageLocationService } from '../core/services/storage-location.service';
import { CatalogService } from '../core/services/catalog.service';
import { I18nService } from '../core/services/i18n.service';
import { CardSet, Game, StorageKind, StorageLocation } from '../core/models/models';

const TYPES: { value: StorageKind; label: string; icon: string }[] = [
  { value: 'album', label: 'Álbum', icon: 'photo_album' },
  { value: 'binder', label: 'Carpeta', icon: 'folder' },
  { value: 'box', label: 'Caja', icon: 'inventory_2' },
  { value: 'deckbox', label: 'Deck box', icon: 'style' },
];

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TuiButton, TuiTextfield, TuiInput],
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
      <div class="ui-field">
        <span class="lbl">{{ i18n.isES() ? 'Juego (opcional)' : 'Game (optional)' }}</span>
        <select class="ui-select" [(ngModel)]="gameId" (ngModelChange)="onGame()">
          <option value="">—</option>
          @for (g of games(); track g.id) { <option [value]="g.id">{{ g.name }}</option> }
        </select>
      </div>
      <div class="ui-field">
        <span class="lbl">{{ i18n.isES() ? 'Set (opcional)' : 'Set (optional)' }}</span>
        <select class="ui-select" [(ngModel)]="setId" [disabled]="!gameId">
          <option value="">{{ i18n.isES() ? 'Sin set' : 'No set' }}</option>
          @for (s of sets(); track s.id) { <option [value]="s.id">{{ s.name }}</option> }
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
          <a class="link" [routerLink]="['/almacenamiento', s.id]">
            <span class="mi ic" [style.color]="s.color">{{ icon(s.type) }}</span>
            <div class="info">
              <div class="nm">{{ s.name }}</div>
              <div class="muted">
                {{ label(s.type) }} · {{ s.cardCount }} {{ i18n.t('storage.cards') }}
                @if (s.set) { · <span class="setbadge">{{ i18n.isES() ? 'Set:' : 'Set:' }} {{ s.set.name }}</span> }
              </div>
            </div>
            <span class="mi chev">chevron_right</span>
          </a>
          <button class="icon-btn del" (click)="remove(s)"><span class="mi">delete</span></button>
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
      .new .type { width: 150px; }
      .new .ui-field { min-width: 160px; }
      .color { height: 44px; width: 52px; border: 1px solid var(--border); border-radius: 10px; background: var(--bg-soft); padding: 3px; cursor: pointer; }
      .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; }
      .loc { display: flex; align-items: center; gap: 6px; padding: 6px 8px 6px 12px; border-left: 4px solid var(--primary); }
      .link { flex: 1; display: flex; align-items: center; gap: 14px; padding: 10px 6px; border-radius: 10px; }
      .link:hover { background: var(--card-2); }
      .ic { font-size: 30px; }
      .info { flex: 1; }
      .nm { font-weight: 800; font-size: 16px; }
      .setbadge { color: var(--primary); font-weight: 600; }
      .chev { color: var(--muted); }
      .del { color: var(--danger); }
      @media (max-width: 620px) { .new { flex-direction: column; align-items: stretch; } .new .type, .new .ui-field { width: 100%; } }
    `,
  ],
})
export class StoragePage {
  private storage = inject(StorageLocationService);
  private catalog = inject(CatalogService);
  i18n = inject(I18nService);
  locations = signal<StorageLocation[]>([]);
  games = signal<Game[]>([]);
  sets = signal<CardSet[]>([]);
  types = TYPES;

  name = '';
  type: StorageKind = 'album';
  color = '#6c5ce7';
  gameId = '';
  setId = '';

  constructor() {
    this.load();
    this.catalog.games().subscribe((g) => this.games.set(g));
  }
  load() { this.storage.list().subscribe((l) => this.locations.set(l)); }
  onGame() {
    this.setId = '';
    this.sets.set([]);
    if (this.gameId) this.catalog.sets(this.gameId).subscribe((s) => this.sets.set(s));
  }
  create() {
    this.storage
      .create({ name: this.name.trim(), type: this.type, color: this.color, setId: this.setId || null })
      .subscribe(() => { this.name = ''; this.setId = ''; this.gameId = ''; this.sets.set([]); this.load(); });
  }
  remove(s: StorageLocation) { this.storage.remove(s.id).subscribe(() => this.load()); }
  icon(t: StorageKind) { return TYPES.find((x) => x.value === t)?.icon ?? 'inventory_2'; }
  label(t: StorageKind) { return TYPES.find((x) => x.value === t)?.label ?? t; }
}
