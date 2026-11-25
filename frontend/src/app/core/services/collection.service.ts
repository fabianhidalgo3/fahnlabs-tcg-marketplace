import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CardLang, ChecklistSet, MyCollectionSet, OwnedCardsPage } from '../models/models';

/** Resumen de la colección para el Inicio. */
export interface CollectionSummary {
  sets: number;
  distinctSlots: number;
  totalCopies: number;
  collectionValue: number;
  duplicates: number;
  setsInProgress: {
    id: string; name: string; symbolUrl: string | null;
    completionPercent: number; ownedSlots: number; totalSlots: number;
  }[];
}

/** Mis copias de una carta agrupadas por variante+idioma. */
export interface MyCopies {
  total: number;
  items: {
    variant: string;
    language: CardLang;
    quantity: number;
    album: { id: string; name: string; color: string | null } | null;
  }[];
}

@Injectable({ providedIn: 'root' })
export class CollectionService {
  private http = inject(HttpClient);
  private api = environment.apiUrl;

  mySets(): Observable<MyCollectionSet[]> {
    return this.http.get<MyCollectionSet[]>(`${this.api}/collection/sets`);
  }

  /** "Toda mi colección" plana con filtros de catálogo. */
  myCards(query: Record<string, string | number | undefined>): Observable<OwnedCardsPage> {
    let params = new HttpParams();
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params = params.set(k, String(v));
    });
    return this.http.get<OwnedCardsPage>(`${this.api}/collection/cards`, { params });
  }

  /** Rarezas/variantes que existen en MI colección (para poblar filtros). */
  myCardFacets(): Observable<{ rarities: string[]; variants: string[] }> {
    return this.http.get<{ rarities: string[]; variants: string[] }>(`${this.api}/collection/cards/facets`);
  }

  /** Mis copias de una carta: por variante+idioma, con álbum y total. */
  myCopies(cardId: string): Observable<MyCopies> {
    return this.http.get<MyCopies>(`${this.api}/collection/cards/${cardId}/mine`);
  }

  /** Resumen de mi colección para el Inicio. */
  summary(): Observable<CollectionSummary> {
    return this.http.get<CollectionSummary>(`${this.api}/collection/summary`);
  }

  /** Publica mis repetidas (quantity-1) a la venta a precio de mercado. */
  sellDuplicates(): Observable<{ duplicates: number; created: number; updated: number; skipped: number }> {
    return this.http.post<{ duplicates: number; created: number; updated: number; skipped: number }>(
      `${this.api}/collection/sell-duplicates`, {},
    );
  }

  // ==== Exportar a Excel ====
  exportCardsXlsx(query: Record<string, string | number | undefined>): Observable<Blob> {
    let params = new HttpParams();
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params = params.set(k, String(v));
    });
    return this.http.get(`${this.api}/collection/export/cards`, { params, responseType: 'blob' });
  }
  exportSetsXlsx(): Observable<Blob> {
    return this.http.get(`${this.api}/collection/export/sets`, { responseType: 'blob' });
  }
  /** PDF de faltantes a tamaño real de carta (63×88mm) para imprimir. */
  exportMissingPdf(setId: string): Observable<Blob> {
    return this.http.get(`${this.api}/collection/export/sets/${setId}/missing-pdf`, { responseType: 'blob' });
  }

  exportChecklistXlsx(setId: string, mode: 'all' | 'missing' | 'owned' = 'all'): Observable<Blob> {
    return this.http.get(`${this.api}/collection/export/sets/${setId}`, {
      params: new HttpParams().set('mode', mode),
      responseType: 'blob',
    });
  }

  /** Dispara la descarga de un blob como archivo. */
  downloadBlob(blob: Blob, filename: string) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  checklist(setId: string): Observable<ChecklistSet> {
    return this.http.get<ChecklistSet>(`${this.api}/collection/sets/${setId}`);
  }

  adjust(
    cardModelId: string,
    variant: string,
    language: CardLang,
    delta: number,
  ): Observable<{ quantity: number }> {
    return this.http.post<{ quantity: number }>(
      `${this.api}/collection/adjust`,
      { cardModelId, variant, language, delta },
    );
  }

  setQuantity(
    cardModelId: string,
    variant: string,
    language: CardLang,
    quantity: number,
  ): Observable<{ quantity: number }> {
    return this.http.put<{ quantity: number }>(`${this.api}/collection/set`, {
      cardModelId,
      variant,
      language,
      quantity,
    });
  }

  assign(
    cardModelId: string,
    variant: string,
    language: CardLang,
    storageId: string | null,
  ): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.api}/collection/assign`, {
      cardModelId,
      variant,
      language,
      storageId,
    });
  }
}
