import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { betaTool } from '@anthropic-ai/sdk/helpers/beta/json-schema';
import { CardsService } from '../cards/cards.service';
import { CollectionService } from '../collection/collection.service';

/** Turno de conversación que envía el frontend (solo texto). */
export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

const SYSTEM_PROMPT = `Eres el asistente de SingleTCG, una app de colección y venta de cartas TCG (Pokémon, One Piece, Star Wars Unlimited). Ayudas al usuario a encontrar cartas y gestionarlas en su colección, conversando en el idioma del usuario (normalmente español chileno — puedes ser cercano, pero claro).

Herramientas:
- buscar_local: busca en la base de datos de la app (174 sets de Pokémon ya importados). SIEMPRE busca aquí primero. Soporta nombre y/o número ("pikachu 173", "066/98").
- buscar_web: busca en varios sitios a la vez (pokemontcg.io y TCGdex). Úsala cuando la carta no aparezca en la base, o el usuario pida explícitamente buscar en la web. Si una fuente está caída la otra suele responder; si ambas fallan, dilo y sugiere reintentar.
- importar_carta: importa una carta de la web a la base local (usa el apiId de buscar_web). Solo si su set existe en la base (setInDb=true).
- agregar_a_coleccion: suma una copia (carta+variante+idioma) a la colección del usuario. El idioma por defecto de sus cartas es EN salvo que diga otra cosa. Si la carta tiene varias variantes y el usuario no especificó, pregunta cuál (Normal / Reverse Holo / Holo).

Flujo típico: el usuario describe una carta → buscar_local → si no está, buscar_web → ofrecer importar → importar → ofrecer agregar a la colección. Confirma cada acción realizada con una línea breve. Sé conciso: respuestas cortas, sin listas enormes (máximo 5-6 cartas por respuesta, menciona si hay más). Los precios están en USD; la app los muestra también en CLP.

No inventes cartas ni precios: todo dato de cartas debe salir de las herramientas.`;

@Injectable()
export class ChatService {
  private client: Anthropic | null = null;

  constructor(
    private readonly cards: CardsService,
    private readonly collection: CollectionService,
  ) {
    if (process.env.ANTHROPIC_API_KEY) {
      this.client = new Anthropic();
    }
  }

  /**
   * Corre un turno del chat: Claude decide qué herramientas usar (buscar,
   * importar, agregar) y devuelve la respuesta final + las cartas que
   * encontró (para que la UI pinte tarjetas con botones).
   */
  async chat(userId: string, turns: ChatTurn[]): Promise<any> {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'El chat IA no está configurado: define ANTHROPIC_API_KEY en el backend.',
      );
    }

    // Artefactos que las herramientas van juntando para la UI.
    const artifacts: { localCards: any[]; webCards: any[]; actions: string[] } = {
      localCards: [],
      webCards: [],
      actions: [],
    };

    const tools = [
      betaTool({
        name: 'buscar_local',
        description:
          'Busca cartas en la base de datos local de SingleTCG. Soporta nombre y/o número ("pikachu 173", "066/98"). Devuelve hasta 6 resultados con id, set y variantes.',
        inputSchema: {
          type: 'object',
          properties: {
            q: { type: 'string', description: 'Texto de búsqueda: nombre y/o número' },
          },
          required: ['q'],
        } as const,
        run: async (input: any) => {
          const res = await this.cards.search({ q: input.q, limit: 6 } as any);
          const slim = res.data.map((c: any) => ({
            id: c.id,
            name: c.name,
            number: c.number,
            set: c.set?.name,
            rarity: c.rarity,
            variants: c.variants,
            preciosUSD: c.variantValues,
          }));
          artifacts.localCards.push(...res.data);
          return JSON.stringify({ total: res.total, cartas: slim });
        },
      }),
      betaTool({
        name: 'buscar_web',
        description:
          'Busca cartas en la web en varios sitios (pokemontcg.io y TCGdex). Usar cuando no están en la base local. Devuelve candidatas con apiId, si ya existen en la base (inDb) y si su set está importado (setInDb).',
        inputSchema: {
          type: 'object',
          properties: {
            q: { type: 'string', description: 'Nombre y/o número de la carta' },
          },
          required: ['q'],
        } as const,
        run: async (input: any) => {
          const res = await this.cards.webSearch(input.q);
          artifacts.webCards.push(...res);
          return JSON.stringify(
            res.map((r: any) => ({
              apiId: r.apiId,
              name: r.name,
              number: `${r.number}${r.printedTotal ? '/' + r.printedTotal : ''}`,
              set: r.setName,
              rarity: r.rarity,
              inDb: r.inDb,
              setInDb: r.setInDb,
            })),
          );
        },
      }),
      betaTool({
        name: 'importar_carta',
        description:
          'Importa una carta desde la web (pokemontcg.io o TCGdex) a la base local (variantes por regla de era + precios con pisos CLP). Requiere el apiId de buscar_web y que setInDb sea true.',
        inputSchema: {
          type: 'object',
          properties: {
            apiId: { type: 'string', description: 'apiId devuelto por buscar_web, ej "sv3pt5-173" o "tcgdex:sv03.5-173"' },
          },
          required: ['apiId'],
        } as const,
        run: async (input: any) => {
          const card = await this.cards.importFromWeb(input.apiId);
          artifacts.localCards.push(card);
          artifacts.actions.push(`importada:${card.name}`);
          return JSON.stringify({
            ok: true,
            id: card.id,
            name: card.name,
            number: card.number,
            variants: card.variants,
          });
        },
      }),
      betaTool({
        name: 'agregar_a_coleccion',
        description:
          'Agrega una copia de una carta a la colección del usuario. Requiere el id local de la carta (de buscar_local o importar_carta), la variante exacta y el idioma (EN/ES). Si el set de la carta tiene un álbum vinculado, se guarda ahí automáticamente.',
        inputSchema: {
          type: 'object',
          properties: {
            cardId: { type: 'string', description: 'Id local de la carta' },
            variant: { type: 'string', description: 'Variante exacta: Normal, Reverse Holo, Holo…' },
            language: { type: 'string', enum: ['EN', 'ES'], description: 'Idioma de la carta física' },
          },
          required: ['cardId', 'variant', 'language'],
        } as const,
        run: async (input: any) => {
          const res = await this.collection.adjust(userId, {
            cardModelId: input.cardId,
            variant: input.variant,
            language: input.language,
            delta: 1,
          } as any);
          artifacts.actions.push(`agregada:${input.cardId}:${input.variant}`);
          return JSON.stringify({ ok: true, cantidadTotal: res.quantity });
        },
      }),
    ];

    const runner = this.client.beta.messages.toolRunner({
      model: 'claude-opus-5',
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      tools,
      messages: turns.map((t) => ({ role: t.role, content: t.content })),
      max_iterations: 8,
    });

    const final = await runner.runUntilDone();

    const reply = final.content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('\n')
      .trim();

    // dedup de cartas por id para la UI
    const seen = new Set<string>();
    const localCards = artifacts.localCards.filter((c: any) => {
      const id = c.id ?? c._id?.toString();
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    return {
      reply: reply || '…',
      localCards: localCards.slice(0, 8),
      webCards: artifacts.webCards.slice(0, 8),
      actions: artifacts.actions,
    };
  }
}
