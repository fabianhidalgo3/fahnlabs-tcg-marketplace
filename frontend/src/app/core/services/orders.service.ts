import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Order, OrderStatus } from '../models/models';

export interface CreateOrderPayload {
  items: { inventoryItemId: string; quantity: number }[];
  shippingName?: string;
  shippingAddress?: string;
}

@Injectable({ providedIn: 'root' })
export class OrdersService {
  private http = inject(HttpClient);
  private api = environment.apiUrl;

  create(payload: CreateOrderPayload): Observable<Order> {
    return this.http.post<Order>(`${this.api}/orders`, payload);
  }

  mine(): Observable<Order[]> {
    return this.http.get<Order[]>(`${this.api}/orders/mine`);
  }

  all(): Observable<Order[]> {
    return this.http.get<Order[]>(`${this.api}/orders`);
  }

  updateStatus(id: string, status: OrderStatus): Observable<Order> {
    return this.http.patch<Order>(`${this.api}/orders/${id}/status`, { status });
  }
}
