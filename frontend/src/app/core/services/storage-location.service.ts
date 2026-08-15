import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { StorageDetail, StorageKind, StorageLocation } from '../models/models';

@Injectable({ providedIn: 'root' })
export class StorageLocationService {
  private http = inject(HttpClient);
  private api = environment.apiUrl;

  list(): Observable<StorageLocation[]> {
    return this.http.get<StorageLocation[]>(`${this.api}/storage`);
  }

  get(id: string): Observable<StorageDetail> {
    return this.http.get<StorageDetail>(`${this.api}/storage/${id}`);
  }

  create(body: {
    name: string;
    type: StorageKind;
    color?: string;
    notes?: string;
    setId?: string | null;
  }): Observable<StorageLocation> {
    return this.http.post<StorageLocation>(`${this.api}/storage`, body);
  }

  update(id: string, body: { setId?: string | null; name?: string }): Observable<StorageLocation> {
    return this.http.patch<StorageLocation>(`${this.api}/storage/${id}`, body);
  }

  remove(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.api}/storage/${id}`);
  }
}
