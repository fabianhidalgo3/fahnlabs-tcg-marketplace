import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CardCondition, CardModel, CardSet, Game, InventoryItem } from '../models/models';

export interface CreateInventoryPayload {
  cardModelId: string;
  condition: CardCondition;
  language?: string;
  isFoil?: boolean;
  price: number;
  quantity: number;
}

export interface CreateGamePayload {
  code: string;
  name: string;
  iconUrl?: string;
}

export interface CreateSetPayload {
  gameId: string;
  code: string;
  name: string;
  series?: string;
  totalCards: number;
  releaseDate?: string;
}

export interface CreateCardPayload {
  gameId: string;
  setId: string;
  name: string;
  number: string;
  rarity?: string;
  cardType?: string;
  imageUrl?: string;
  variants?: string[];
  variantValues?: Record<string, number>;
  attributes?: Record<string, any>;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private http = inject(HttpClient);
  private api = environment.apiUrl;

  createInventory(payload: CreateInventoryPayload): Observable<InventoryItem> {
    return this.http.post<InventoryItem>(`${this.api}/inventory`, payload);
  }

  adjustStock(id: string, delta: number): Observable<InventoryItem> {
    return this.http.patch<InventoryItem>(`${this.api}/inventory/${id}/stock`, {
      delta,
    });
  }

  deleteInventory(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.api}/inventory/${id}`);
  }

  // --- Juegos ---
  createGame(p: CreateGamePayload): Observable<Game> {
    return this.http.post<Game>(`${this.api}/games`, p);
  }
  deleteGame(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.api}/games/${id}`);
  }

  // --- Sets ---
  createSet(p: CreateSetPayload): Observable<CardSet> {
    return this.http.post<CardSet>(`${this.api}/sets`, p);
  }
  deleteSet(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.api}/sets/${id}`);
  }

  // --- Cartas (modelos) ---
  createCard(p: CreateCardPayload): Observable<CardModel> {
    return this.http.post<CardModel>(`${this.api}/cards`, p);
  }
  deleteCard(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.api}/cards/${id}`);
  }
}
