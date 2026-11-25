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
  /** Ids de vendedores con stock de esta carta (marketplace). */
  sellerIds?: string[];
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
  /** Vendedor del marketplace (null/ausente = inventario de la tienda). */
  seller?: { id: string; name: string } | null;
}

/** Punto del historial de precio de una carta (USD por variante). */
export interface PricePoint {
  date: string;
  values: Record<string, number>;
}

/** Venta reciente de una carta (desde las órdenes). */
export interface CardSale {
  date: string;
  condition: string | null;
  language: string | null;
  isFoil: boolean;
  quantity: number;
  unitPrice: number;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Fila de "toda mi colección" plana: UN slot por (carta, variante). */
export interface OwnedCard {
  id: string;
  /** Variante de este slot (Normal / Reverse Holo / Holo…). */
  variant: string;
  name: string;
  number: string;
  rarity?: string;
  cardType?: string;
  imageUrl?: string;
  attributes?: Record<string, any>;
  set?: { id: string; name: string; code: string; symbolUrl?: string } | null;
  quantity: number;
  value: number;
  languages: string[];
  /** Álbumes/cajas donde hay copias (puede ser más de uno). */
  albums?: { id: string; name: string; color?: string }[];
}

/** Paginado de "mis cartas" con total de copias además de cartas distintas. */
export interface OwnedCardsPage extends Paginated<OwnedCard> {
  totalCopies: number;
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
  set?: { id: string; name: string; code: string; totalCards: number; symbolUrl?: string } | null;
}

export interface StoredCard {
  cardId: string;
  name: string;
  number: string;
  imageUrl?: string;
  rarity?: string;
  setId: string;
  variant: string;
  language: 'EN' | 'ES';
  quantity: number;
  value: number;
  lineValue: number;
  inLinkedSet: boolean;
}

export interface StorageDetail extends StorageLocation {
  cards: StoredCard[];
  fromSet: StoredCard[];
  extras: StoredCard[];
  setProgress: { totalSlots: number; inAlbumSlots: number; missing: number; percent: number } | null;
  totalValue: number;
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

export interface ChecklistSet extends Omit<CardSet, "stats"> {
  cards: ChecklistCard[];
  /** Promocionales asociadas al set (curadas por el admin). */
  promos?: ChecklistCard[];
  game?: string;
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
