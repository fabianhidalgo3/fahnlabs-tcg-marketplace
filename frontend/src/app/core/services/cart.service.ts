import { Injectable, computed, signal } from '@angular/core';
import { CartLine, InventoryItem } from '../models/models';

const CART_KEY = 'tcg_cart';

@Injectable({ providedIn: 'root' })
export class CartService {
  readonly lines = signal<CartLine[]>(this.restore());

  readonly count = computed(() =>
    this.lines().reduce((n, l) => n + l.quantity, 0),
  );
  readonly total = computed(() =>
    this.lines().reduce((sum, l) => sum + l.price * l.quantity, 0),
  );

  add(item: InventoryItem, cardName: string, imageUrl?: string) {
    const lines = [...this.lines()];
    const existing = lines.find((l) => l.inventoryItemId === item.id);
    if (existing) {
      existing.quantity = Math.min(existing.quantity + 1, item.quantity);
    } else {
      lines.push({
        inventoryItemId: item.id,
        cardName,
        condition: item.condition,
        isFoil: item.isFoil,
        price: item.price,
        maxQuantity: item.quantity,
        quantity: 1,
        imageUrl,
      });
    }
    this.commit(lines);
  }

  setQuantity(inventoryItemId: string, quantity: number) {
    const lines = this.lines()
      .map((l) =>
        l.inventoryItemId === inventoryItemId
          ? { ...l, quantity: Math.max(1, Math.min(quantity, l.maxQuantity)) }
          : l,
      );
    this.commit(lines);
  }

  remove(inventoryItemId: string) {
    this.commit(this.lines().filter((l) => l.inventoryItemId !== inventoryItemId));
  }

  clear() {
    this.commit([]);
  }

  private commit(lines: CartLine[]) {
    this.lines.set(lines);
    localStorage.setItem(CART_KEY, JSON.stringify(lines));
  }

  private restore(): CartLine[] {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? (JSON.parse(raw) as CartLine[]) : [];
  }
}
