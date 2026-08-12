import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CardLang, ChecklistSet, MyCollectionSet } from '../models/models';

@Injectable({ providedIn: 'root' })
export class CollectionService {
  private http = inject(HttpClient);
  private api = environment.apiUrl;

  mySets(): Observable<MyCollectionSet[]> {
    return this.http.get<MyCollectionSet[]>(`${this.api}/collection/sets`);
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
