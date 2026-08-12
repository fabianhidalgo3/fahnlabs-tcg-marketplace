export interface Game {
  id: string;
  code: string;
  name: string;
  iconUrl?: string;
}

export interface CompletionStats {
  totalCards: number;
  registeredCards: number;
  collectedCards: number;
  completionPercent: number;
  missingCards: number;
}

export interface CardSet {
  id: string;
  code: string;
  name: string;
  series?: string;
  totalCards: number;
  releaseDate?: string;
  symbolUrl?: string;
  stats?: CompletionStats;
}

export interface CardModel {
  id: string;
  name: string;
  number: string;
  rarity?: string;
  cardType?: string;
  imageUrl?: string;
  description?: string;
  attributes: Record<string, any>;
  variants?: string[];
  variantValues?: Record<string, number>;
  game?: Game;
  set?: CardSet;
  inventoryCount?: number;
  totalStock?: number;
  minPrice?: number | null;
  inventoryItems?: InventoryItem[];
}

/** Vista de carta dentro del detalle de un set (incluye disponibilidad). */
export interface SetCard {
  id: string;
  name: string;
  number: string;
  rarity?: string;
  cardType?: string;
  imageUrl?: string;
  attributes: Record<string, any>;
  inStock: boolean;
  totalStock: number;
  minPrice: number | null;
}

export interface SetDetail extends CardSet {
  cards: SetCard[];
}

export type CardCondition = 'M' | 'NM' | 'LP' | 'MP' | 'HP' | 'DMG';

export interface InventoryItem {
  id: string;
  cardModel: string | CardModel;
  sku: string;
  condition: CardCondition;
  language: string;
  isFoil: boolean;
  price: number;
  quantity: number;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type OrderStatus =
  | 'pending'
  | 'paid'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export interface OrderItem {
  inventoryItem: string;
  cardName: string;
  unitPrice: number;
  quantity: number;
}

export interface Order {
  id: string;
  user: string | { id: string; name: string; email: string };
  status: OrderStatus;
  total: number;
  shippingName?: string;
  shippingAddress?: string;
  items: OrderItem[];
  createdAt: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'customer';
}

export interface CartLine {
  inventoryItemId: string;
  cardName: string;
  condition: CardCondition;
  isFoil: boolean;
  price: number;
  maxQuantity: number;
  quantity: number;
  imageUrl?: string;
}

// ---- Colección personal ----
export type CardLang = 'EN' | 'ES';

export type StorageKind = 'album' | 'binder' | 'box' | 'deckbox';

export interface StorageLocation {
  id: string;
  name: string;
  type: StorageKind;
  color: string;
  notes?: string;
  cardCount?: number;
}

export interface StorageRef {
  id: string;
  name: string;
  type: StorageKind;
  color: string;
}

export interface VariantView {
  variant: string;
  value: number;
  owned: { EN: number; ES: number };
  ownedTotal: number;
  storage: { EN: StorageRef | null; ES: StorageRef | null };
}

export interface ChecklistCard {
  id: string;
  name: string;
  number: string;
  rarity?: string;
  cardType?: string;
  imageUrl?: string;
  attributes: Record<string, any>;
  variants: VariantView[];
}

export interface ChecklistStats {
  totalSlots: number;
  setValue: number;
  duplicates: number;
  owned: { all: number; EN: number; ES: number };
  missing: { all: number; EN: number; ES: number };
  completionPercent: { all: number; EN: number; ES: number };
  collectionValue: { all: number; EN: number; ES: number };
}

export interface ChecklistSet extends Omit<CardSet, 'stats'> {
  cards: ChecklistCard[];
  stats: ChecklistStats;
}

export interface CollectionSetSummary {
  totalSlots: number;
  ownedSlots: number;
  missingSlots: number;
  completionPercent: number;
  setValue: number;
  collectionValue: number;
  duplicates: number;
}

export interface MyCollectionSet extends CardSet {
  collection: CollectionSetSummary;
}
