import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CardModel,
  CardSet,
  Game,
  InventoryItem,
  Paginated,
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
  forSale?: boolean;
  page?: number;
  limit?: number;
}

@Injectable({ providedIn: 'root' })
export class CatalogService {
  private http = inject(HttpClient);
  private api = environment.apiUrl;

  games(): Observable<Game[]> {
    return this.http.get<Game[]>(`${this.api}/games`);
  }

  sets(gameId?: string): Observable<CardSet[]> {
    let params = new HttpParams();
    if (gameId) params = params.set('gameId', gameId);
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

  inventoryByCard(cardModelId: string): Observable<InventoryItem[]> {
    const params = new HttpParams().set('cardModelId', cardModelId);
    return this.http.get<InventoryItem[]>(`${this.api}/inventory`, { params });
  }
}
