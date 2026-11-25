import { Injectable, Logger } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { CollectionService } from './collection.service';

/** mm → puntos PDF (72 pt = 25.4 mm). */
const mm = (v: number) => (v * 72) / 25.4;

/** Tamaño REAL de una carta TCG: 63 × 88 mm. */
const CARD_W = mm(63);
const CARD_H = mm(88);
const GAP = mm(4);
const MARGIN = mm(10);
// A4: 210 × 297 mm → caben 3 × 3 cartas por página.
const COLS = 3;
const ROWS = 3;

interface MissingSlot {
  name: string;
  number: string;
  variant: string;
  imageUrl?: string;
  promo?: boolean;
}

/**
 * PDF DE FALTANTES: una "carta" impresa a tamaño real por cada slot que falta
 * (imagen + número + variante — la Reverse va marcada), lista para recortar
 * y poner en la funda del álbum como marcador de posición.
 */
@Injectable()
export class MissingPdfService {
  private readonly logger = new Logger(MissingPdfService.name);

  constructor(private readonly collection: CollectionService) {}

  async build(userId: string, setId: string): Promise<{ buffer: Buffer; setName: string; count: number }> {
    const checklist = await this.collection.getSetChecklist(userId, setId);

    const missing: MissingSlot[] = [];
    const collect = (cards: any[], promo: boolean) => {
      for (const card of cards ?? []) {
        for (const v of card.variants ?? []) {
          if ((v.ownedTotal ?? 0) === 0) {
            missing.push({ name: card.name, number: card.number, variant: v.variant, imageUrl: card.imageUrl, promo });
          }
        }
      }
    };
    // SOLO las cartas del set (las promos son una sección aparte del álbum).
    collect(checklist.cards, false);

    // Imagen liviana (suficiente para marcador impreso) y cacheada por URL:
    // Normal y Reverse comparten arte, no se descarga dos veces.
    const imgCache = new Map<string, Buffer | null>();
    const thumb = (url?: string) => {
      if (!url) return undefined;
      if (url.includes('images.scrydex.com')) return url.replace(/\/large$/, '/small');
      return url.replace('_hires.png', '.png');
    };
    const fetchImg = async (url?: string): Promise<Buffer | null> => {
      const u = thumb(url);
      if (!u) return null;
      if (imgCache.has(u)) return imgCache.get(u)!;
      try {
        const res = await fetch(u, { signal: AbortSignal.timeout(15_000) });
        const buf = res.ok ? Buffer.from(await res.arrayBuffer()) : null;
        imgCache.set(u, buf);
        return buf;
      } catch {
        imgCache.set(u, null);
        return null;
      }
    };
    // Pre-descarga con concurrencia controlada.
    const urls = [...new Set(missing.map((m) => thumb(m.imageUrl)).filter(Boolean))] as string[];
    for (let i = 0; i < urls.length; i += 8) {
      await Promise.all(urls.slice(i, i + 8).map((u) => fetchImg(u)));
    }

    const doc = new PDFDocument({ size: 'A4', margin: 0, info: { Title: `Faltantes · ${checklist.name}` } });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

    // Portada compacta en la primera página (franja superior).
    const header = () => {
      doc.rect(0, 0, doc.page.width, mm(14)).fill('#0e0e11');
      doc.fill('#ffffff').font('Helvetica-Bold').fontSize(11)
        .text(`SingleTCG · Faltantes de ${checklist.name}`, MARGIN, mm(4), { continued: true })
        .font('Helvetica').fontSize(9).fill('#9a9aa3')
        .text(`   ${missing.length} cartas · recorta y ponlas en el álbum · ${new Date().toISOString().slice(0, 10)}`);
    };
    header();
    const firstTop = mm(18);

    let idx = 0;
    for (const slot of missing) {
      const pageIdx = idx % (COLS * ROWS);
      if (idx > 0 && pageIdx === 0) { doc.addPage(); }
      const isFirstPage = idx < COLS * ROWS;
      const col = pageIdx % COLS;
      const row = Math.floor(pageIdx / COLS);
      const x = MARGIN + col * (CARD_W + GAP);
      const y = (isFirstPage ? firstTop : MARGIN) + row * (CARD_H + GAP);

      // Imagen de la carta (o placeholder con el nombre).
      const img = await fetchImg(slot.imageUrl);
      if (img) {
        try { doc.image(img, x, y, { width: CARD_W, height: CARD_H }); }
        catch { this.drawPlaceholder(doc, x, y, slot); }
      } else {
        this.drawPlaceholder(doc, x, y, slot);
      }

      // Banda inferior: número + variante (clave para la funda correcta).
      const bandH = mm(7);
      doc.save();
      doc.rect(x, y + CARD_H - bandH, CARD_W, bandH).fillOpacity(0.78).fill('#000000');
      doc.fillOpacity(1).fill('#ffffff').font('Helvetica-Bold').fontSize(9)
        .text(
          `${slot.number}  ·  ${slot.variant.toUpperCase()}${slot.promo ? '  ·  PROMO' : ''}`,
          x, y + CARD_H - bandH + mm(1.8),
          { width: CARD_W, align: 'center' },
        );
      doc.restore();

      // La REVERSE va además con cinta diagonal arriba para no confundir fundas.
      if (slot.variant !== 'Normal' && slot.variant !== 'Holo') {
        doc.save();
        doc.rect(x, y, CARD_W, mm(6)).fillOpacity(0.85).fill('#7c3aed');
        doc.fillOpacity(1).fill('#ffffff').font('Helvetica-Bold').fontSize(8)
          .text('· REVERSE HOLO ·', x, y + mm(1.4), { width: CARD_W, align: 'center' });
        doc.restore();
      }

      // Línea de corte.
      doc.save().lineWidth(0.6).strokeOpacity(0.7).stroke('#8a8a8a');
      doc.rect(x, y, CARD_W, CARD_H).stroke();
      doc.restore();

      idx++;
    }

    if (!missing.length) {
      doc.font('Helvetica-Bold').fontSize(16).fill('#059669')
        .text('¡Set completo! No te falta ninguna carta 🎉', MARGIN, mm(40));
    }

    doc.end();
    const buffer = await done;
    this.logger.log(`PDF faltantes ${checklist.name}: ${missing.length} cartas · ${(buffer.length / 1e6).toFixed(1)} MB`);
    return { buffer, setName: checklist.name ?? 'set', count: missing.length };
  }

  private drawPlaceholder(doc: PDFKit.PDFDocument, x: number, y: number, slot: MissingSlot) {
    doc.save();
    doc.rect(x, y, CARD_W, CARD_H).fill('#17171b');
    doc.fill('#ececef').font('Helvetica-Bold').fontSize(12)
      .text(slot.name, x + mm(4), y + CARD_H / 2 - mm(8), { width: CARD_W - mm(8), align: 'center' });
    doc.fill('#9a9aa3').font('Helvetica').fontSize(10)
      .text(slot.number, x, y + CARD_H / 2 + mm(2), { width: CARD_W, align: 'center' });
    doc.restore();
  }
}
