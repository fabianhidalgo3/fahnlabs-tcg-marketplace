import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { StorageKind, StorageLocation } from '../models/models';

@Injectable({ providedIn: 'root' })
export class StorageLocationService {
  private http = inject(HttpClient);
  private api = environment.apiUrl;

  list(): Observable<StorageLocation[]> {
    return this.http.get<StorageLocation[]>(`${this.api}/storage`);
  }

  create(body: {
    name: string;
    type: StorageKind;
    color?: string;
    notes?: string;
  }): Observable<StorageLocation> {
    return this.http.post<StorageLocation>(`${this.api}/storage`, body);
  }

  remove(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.api}/storage/${id}`);
  }
}
