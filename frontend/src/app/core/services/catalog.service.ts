import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CardModel,
  CardSale,
  CardSet,
  Game,
  InventoryItem,
  Paginated,
  PricePoint,
  SetDetail,
} from '../models/models';

export interface CardQuery {
  gameId?: string;
  setId?: string;
  q?: string;
  rarity?: string;
  cardType?: string;
  type?: string;
  inStock?: boolean;
  seller?: string;
  sortBy?: string;
  forSale?: boolean;
  /** Dirección del orden por fecha del set (default desc = más nuevo primero). */
  dir?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

/** Resultado de búsqueda en pokemontcg.io (carta quizás no importada aún). */
export interface WebCardResult {
  apiId: string;
  name: string;
  number: string;
  printedTotal?: number;
  setName?: string;
  setCode?: string;
  rarity?: string;
  imageUrl?: string;
  setInDb: boolean;
  inDb: boolean;
  cardId?: string | null;
}

@Injectable({ providedIn: 'root' })
export class CatalogService {
  private http = inject(HttpClient);
  private api = environment.apiUrl;

  games(): Observable<Game[]> {
    return this.http.get<Game[]>(`${this.api}/games`);
  }

  sets(gameId?: string, dir?: 'asc' | 'desc'): Observable<CardSet[]> {
    let params = new HttpParams();
    if (gameId) params = params.set('gameId', gameId);
    if (dir) params = params.set('dir', dir);
    return this.http.get<CardSet[]>(`${this.api}/sets`, { params });
  }

  set(id: string): Observable<SetDetail> {
    return this.http.get<SetDetail>(`${this.api}/sets/${id}`);
  }

  cards(query: CardQuery): Observable<Paginated<CardModel>> {
    let params = new HttpParams();
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        params = params.set(k, String(v));
      }
    });
    return this.http.get<Paginated<CardModel>>(`${this.api}/cards`, { params });
  }

  card(id: string): Observable<CardModel> {
    return this.http.get<CardModel>(`${this.api}/cards/${id}`);
  }

  /** Busca cartas en pokemontcg.io (para las que no están en la base). */
  webSearch(q: string): Observable<WebCardResult[]> {
    return this.http.get<WebCardResult[]>(`${this.api}/cards/web-search`, {
      params: new HttpParams().set('q', q),
    });
  }

  /** Importa una carta desde la web a la base local. */
  importWeb(apiId: string): Observable<CardModel> {
    return this.http.post<CardModel>(`${this.api}/cards/import-web`, { apiId });
  }

  /** Rarezas y tipos disponibles para el juego/set elegido (selectores de filtro). */
  facets(gameId?: string, setId?: string): Observable<{ rarities: string[]; types: string[] }> {
    let params = new HttpParams();
    if (gameId) params = params.set('gameId', gameId);
    if (setId) params = params.set('setId', setId);
    return this.http.get<{ rarities: string[]; types: string[] }>(`${this.api}/cards/facets`, { params });
  }

  /** Historial de precio de una carta (snapshots diarios, USD por variante). */
  priceHistory(cardId: string): Observable<PricePoint[]> {
    return this.http.get<PricePoint[]>(`${this.api}/cards/${cardId}/price-history`);
  }

  /** Últimas ventas de una carta en el marketplace. */
  cardSales(cardId: string): Observable<CardSale[]> {
    return this.http.get<CardSale[]>(`${this.api}/cards/${cardId}/sales`);
  }

  /** Últimos singles publicados con stock (strip "Recién publicados"). */
  recentListings(limit = 12): Observable<InventoryItem[]> {
    return this.http.get<InventoryItem[]>(`${this.api}/inventory/recent`, {
      params: new HttpParams().set('limit', limit),
    });
  }

  /** Mis publicaciones en el marketplace. */
  myListings(): Observable<InventoryItem[]> {
    return this.http.get<InventoryItem[]>(`${this.api}/inventory/mine`);
  }
  updateMyListing(id: string, dto: { price?: number; quantity?: number }): Observable<InventoryItem> {
    return this.http.patch<InventoryItem>(`${this.api}/inventory/mine/${id}`, dto);
  }
  removeMyListing(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.api}/inventory/mine/${id}`);
  }

  inventoryByCard(cardModelId: string): Observable<InventoryItem[]> {
    const params = new HttpParams().set('cardModelId', cardModelId);
    return this.http.get<InventoryItem[]>(`${this.api}/inventory`, { params });
  }
}
