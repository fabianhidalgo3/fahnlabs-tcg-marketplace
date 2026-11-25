import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CardModel } from '../models/models';
import { WebCardResult } from './catalog.service';

export interface ChatApiTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatApiResponse {
  reply: string;
  localCards: CardModel[];
  webCards: WebCardResult[];
  actions: string[];
}

/** Chat IA del buscador de cartas (Claude con herramientas en el backend). */
@Injectable({ providedIn: 'root' })
export class ChatService {
  private http = inject(HttpClient);
  private api = environment.apiUrl;

  send(messages: ChatApiTurn[]): Observable<ChatApiResponse> {
    return this.http.post<ChatApiResponse>(`${this.api}/chat`, { messages });
  }
}
