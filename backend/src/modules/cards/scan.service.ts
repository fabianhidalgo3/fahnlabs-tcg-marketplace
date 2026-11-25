import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { CardsService } from './cards.service';

/** Lo que Claude extrae de la foto de la carta. */
interface ScanReading {
  name: string | null;
  number: string | null;
  total: string | null;
  setHint: string | null;
}

/**
 * ESCANEO DE CARTAS: recibe una foto (base64), Claude (visión) lee nombre y
 * número impreso, y se busca la carta en la base local; si no está, se busca
 * en la web (pokemontcg.io/TCGdex) para poder importarla y agregarla.
 * Usa la misma ANTHROPIC_API_KEY del chat.
 */
@Injectable()
export class ScanService {
  private readonly logger = new Logger(ScanService.name);
  private client: Anthropic | null = null;

  private getClient(): Anthropic {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new ServiceUnavailableException(
        'El escaneo no está configurado: define ANTHROPIC_API_KEY en el backend.',
      );
    }
    if (!this.client) this.client = new Anthropic();
    return this.client;
  }

  constructor(private readonly cards: CardsService) {}

  async scan(imageBase64: string, mediaType = 'image/jpeg'): Promise<any> {
    const client = this.getClient();

    const msg = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 300,
      system:
        'Eres un identificador de cartas TCG (Pokémon, One Piece, Star Wars Unlimited). ' +
        'Lee la carta de la foto y responde SOLO un JSON válido, sin markdown: ' +
        '{"name": string|null, "number": string|null, "total": string|null, "setHint": string|null}. ' +
        '"name" es el nombre impreso de la carta; "number" el numerador del coleccionista ' +
        '(ej. de "066/198" es "066"); "total" el denominador (ej. "198"); ' +
        '"setHint" el nombre o código del set si es legible. null si no se distingue.',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType as any, data: imageBase64 },
            },
            { type: 'text', text: 'Identifica esta carta.' },
          ],
        },
      ],
    });

    const text = msg.content.find((b) => b.type === 'text')?.text ?? '';
    let reading: ScanReading = { name: null, number: null, total: null, setHint: null };
    try {
      const jsonStr = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
      reading = { ...reading, ...JSON.parse(jsonStr) };
    } catch {
      this.logger.warn(`escaneo: respuesta no parseable: ${text.slice(0, 120)}`);
    }

    if (!reading.name && !reading.number) {
      return { reading, matches: [], webMatches: [], message: 'No se pudo leer la carta — intenta con mejor luz y la carta completa en cuadro.' };
    }

    // Búsqueda local con la MISMA sintaxis del buscador ("nombre número").
    const q = [reading.name, reading.number ? parseInt(reading.number, 10) : '']
      .filter(Boolean)
      .join(' ')
      .trim();
    const local = await this.cards.search({ q, limit: 5 } as any);
    let matches = local.data ?? [];

    // Si el set es legible, prioriza las de ese set.
    if (matches.length > 1 && reading.setHint) {
      const hint = reading.setHint.toLowerCase();
      const preferred = matches.filter((c: any) =>
        (c.set?.name ?? '').toLowerCase().includes(hint) || (c.set?.code ?? '').toLowerCase() === hint,
      );
      if (preferred.length) matches = preferred;
    }

    // Fallback: buscar en la web para poder importarla.
    let webMatches: any[] = [];
    if (!matches.length) {
      try {
        webMatches = (await this.cards.webSearch(q)).slice(0, 5);
      } catch {
        // la web puede estar intermitente; se informa igual la lectura
      }
    }

    return { reading, matches, webMatches };
  }
}
