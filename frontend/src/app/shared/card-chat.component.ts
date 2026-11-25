import { Component, ElementRef, inject, output, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService, ChatApiTurn } from '../core/services/chat.service';
import { CatalogService, WebCardResult } from '../core/services/catalog.service';
import { CollectionService } from '../core/services/collection.service';
import { CardLangService } from '../core/services/card-lang.service';
import { I18nService } from '../core/services/i18n.service';
import { CardModel } from '../core/models/models';
import { thumbUrl } from '../core/utils/card-image';

interface ChatMsg {
  role: 'user' | 'bot';
  text?: string;
  local?: CardModel[];
  web?: WebCardResult[];
}

/**
 * Chat lateral con IA (Claude): conversas en lenguaje natural y el asistente
 * busca en la base, busca en pokemontcg.io, importa cartas y las agrega a tu
 * colección usando herramientas del backend. Las cartas que encuentra se
 * muestran como tarjetas con acciones rápidas.
 */
@Component({
  selector: 'app-card-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (!open()) {
      <button class="fab" type="button" (click)="open.set(true)" [title]="i18n.isES() ? 'Asistente de cartas' : 'Card assistant'">
        <span class="mi">forum</span>
      </button>
    }

    @if (open()) {
      <div class="drawer card-surface">
        <div class="dhead">
          <span class="mi hico">smart_toy</span>
          <div class="ht">
            <b>{{ i18n.isES() ? 'Asistente de cartas' : 'Card assistant' }}</b>
            <span class="muted">{{ i18n.isES() ? 'busca, importa y agrega por ti' : 'finds, imports and adds for you' }}</span>
          </div>
          <button class="icon-btn sm" type="button" (click)="open.set(false)"><span class="mi">close</span></button>
        </div>

        <div class="msgs" #scroller>
          @if (!messages().length) {
            <div class="bubble bot">
              {{ i18n.isES()
                ? 'Hola 👋 Pídeme cartas en lenguaje natural: "busca la pikachu 173", "¿cuánto vale el charizard ex del 151?", "agrega la zorua 66 reverse a mi colección". Si no está en la base, la busco en la web y la importo.'
                : 'Hi 👋 Ask me for cards in natural language. If a card is missing from the DB I can fetch it from the web and import it.' }}
            </div>
          }
          @for (m of messages(); track $index) {
            <div class="bubble" [class.user]="m.role === 'user'" [class.bot]="m.role === 'bot'">
              @if (m.text) { <span class="txt" [innerText]="m.text"></span> }
              @for (c of m.local ?? []; track c.id) {
                <div class="row">
                  @if (c.imageUrl) { <img [src]="thumb(c.imageUrl)" [alt]="c.name" loading="lazy" /> }
                  <div class="ri"><b>{{ c.name }}</b><span class="muted">{{ c.set?.name }} · {{ c.number }}</span></div>
                  <button class="btn btn-primary btn-s" type="button" [disabled]="busy()" (click)="quickAdd(c)" [title]="i18n.isES() ? 'Agregar a mi colección' : 'Add to my collection'">
                    <span class="mi">add</span>
                  </button>
                </div>
              }
              @for (r of m.web ?? []; track r.apiId) {
                <div class="row">
                  @if (r.imageUrl) { <img [src]="r.imageUrl" [alt]="r.name" loading="lazy" /> }
                  <div class="ri"><b>{{ r.name }}</b><span class="muted">{{ r.setName }} · {{ r.number }}{{ r.printedTotal ? '/' + r.printedTotal : '' }}</span></div>
                  @if (r.inDb) {
                    <span class="okt"><span class="mi">check</span></span>
                  } @else if (r.setInDb) {
                    <button class="btn btn-outline btn-s" type="button" [disabled]="busy()" (click)="quickImport(r)" [title]="i18n.isES() ? 'Importar a la base' : 'Import to DB'">
                      <span class="mi">download</span>
                    </button>
                  }
                </div>
              }
            </div>
          }
          @if (busy()) { <div class="bubble bot typing"><span class="mi spin">progress_activity</span> {{ i18n.isES() ? 'pensando…' : 'thinking…' }}</div> }
        </div>

        <div class="dinput">
          <input class="ui-input" [placeholder]="i18n.isES() ? 'ej. busca la pikachu con gorro 173' : 'e.g. find pikachu 173'"
            [(ngModel)]="text" (keyup.enter)="send()" [disabled]="busy()" />
          <button class="btn btn-primary btn-s" type="button" [disabled]="busy() || !text.trim()" (click)="send()">
            <span class="mi">send</span>
          </button>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .fab {
        position: fixed; right: 22px; bottom: 22px; z-index: 60;
        width: 48px; height: 48px; border-radius: 50%; border: none; cursor: pointer;
        background: var(--primary); color: var(--on-primary, #fff);
        display: grid; place-items: center; box-shadow: var(--shadow);
      }
      .fab .mi { font-size: 22px; }
      .drawer {
        position: fixed; top: 0; right: 0; bottom: 0; z-index: 70;
        width: 400px; max-width: 96vw;
        display: flex; flex-direction: column;
        border-radius: 0; border-left: 1px solid var(--border);
        box-shadow: var(--shadow);
      }
      .dhead { display: flex; align-items: center; gap: 10px; padding: 14px 16px; border-bottom: 1px solid var(--border); }
      .hico { color: var(--primary); font-size: 24px; }
      .ht { flex: 1; display: flex; flex-direction: column; font-size: 13px; }
      .msgs { flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 10px; }
      .bubble { max-width: 94%; padding: 10px 12px; border-radius: 12px; font-size: 13px; display: flex; flex-direction: column; gap: 8px; }
      .bubble .txt { white-space: pre-wrap; }
      .bubble.bot { align-self: flex-start; background: var(--card-2); border: 1px solid var(--border); border-bottom-left-radius: 4px; }
      .bubble.user { align-self: flex-end; background: var(--primary); color: var(--on-primary, #fff); border-bottom-right-radius: 4px; }
      .bubble.typing { flex-direction: row; align-items: center; gap: 8px; color: var(--muted); }
      .spin { animation: chatspin 1s linear infinite; font-size: 16px; }
      @keyframes chatspin { to { transform: rotate(360deg); } }
      .row { display: flex; align-items: center; gap: 10px; background: var(--bg-soft); border: 1px solid var(--border); border-radius: 8px; padding: 6px 8px; }
      .row img { width: 36px; height: 50px; object-fit: contain; border-radius: 4px; flex: none; }
      .ri { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
      .ri b { font-size: 13px; }
      .ri .muted { font-size: 11px; }
      .okt { color: var(--success); }
      .dinput { display: flex; gap: 8px; padding: 12px 14px; border-top: 1px solid var(--border); }
      .dinput .ui-input { flex: 1; }
    `,
  ],
})
export class CardChatComponent {
  thumb = thumbUrl;
  private chatApi = inject(ChatService);
  private catalog = inject(CatalogService);
  private collection = inject(CollectionService);
  private cardLang = inject(CardLangService);
  i18n = inject(I18nService);

  /** Se emite cuando el chat importó o agregó algo (para refrescar la vista). */
  changed = output<void>();

  open = signal(false);
  busy = signal(false);
  messages = signal<ChatMsg[]>([]);
  text = '';
  private scroller = viewChild<ElementRef<HTMLDivElement>>('scroller');

  private push(m: ChatMsg) {
    this.messages.update((ms) => [...ms, m]);
    setTimeout(() => {
      const el = this.scroller()?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }

  /** Historial en el formato de la API (solo texto). */
  private turns(): ChatApiTurn[] {
    return this.messages()
      .filter((m) => m.text)
      .map((m) => ({ role: m.role === 'user' ? 'user' as const : 'assistant' as const, content: m.text! }));
  }

  send() {
    const q = this.text.trim();
    if (!q || this.busy()) return;
    this.text = '';
    this.push({ role: 'user', text: q });
    this.busy.set(true);

    this.chatApi.send(this.turns()).subscribe({
      next: (r) => {
        this.push({
          role: 'bot',
          text: r.reply,
          local: r.localCards?.length ? r.localCards : undefined,
          web: r.webCards?.filter((w) => !w.inDb).length ? r.webCards.filter((w) => !w.inDb) : undefined,
        });
        this.busy.set(false);
        if (r.actions?.length) this.changed.emit();
      },
      error: (e) => {
        this.push({ role: 'bot', text: e?.error?.message ?? (this.i18n.isES() ? 'El asistente falló, intenta de nuevo.' : 'The assistant failed, try again.') });
        this.busy.set(false);
      },
    });
  }

  /** Acción rápida: +1 a la colección (variante por defecto, idioma preferido). */
  quickAdd(c: CardModel) {
    this.busy.set(true);
    const variant = c.variants?.[0] ?? 'Normal';
    const lang = this.cardLang.lang();
    this.collection.adjust(c.id, variant, lang, 1).subscribe({
      next: (r) => {
        this.push({ role: 'bot', text: `✓ ${c.name} (${variant} ${lang}) — ${this.i18n.isES() ? 'tienes' : 'you have'} ${r.quantity}.` });
        this.busy.set(false);
        this.changed.emit();
      },
      error: () => { this.push({ role: 'bot', text: this.i18n.isES() ? 'No pude agregarla.' : 'Could not add it.' }); this.busy.set(false); },
    });
  }

  /** Acción rápida: importar desde la web sin pasar por el modelo. */
  quickImport(r: WebCardResult) {
    this.busy.set(true);
    this.catalog.importWeb(r.apiId).subscribe({
      next: (card) => {
        this.push({ role: 'bot', text: `✓ ${card.name} ${this.i18n.isES() ? 'importada a la base.' : 'imported.'}`, local: [card] });
        this.busy.set(false);
        this.changed.emit();
      },
      error: (e) => { this.push({ role: 'bot', text: e?.error?.message ?? 'Error al importar.' }); this.busy.set(false); },
    });
  }
}
