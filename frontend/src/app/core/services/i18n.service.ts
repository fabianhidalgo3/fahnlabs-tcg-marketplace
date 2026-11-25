import { Injectable, computed, signal } from '@angular/core';

export type Lang = 'es' | 'en';

/** Diccionarios de traducción ES/EN de la interfaz. */
const DICT: Record<Lang, Record<string, string>> = {
  es: {
    'nav.catalog': 'Catálogo',
    'nav.sets': 'Sets',
    'nav.collection': 'Mi Colección',
    'nav.orders': 'Órdenes',
    'nav.admin': 'Admin',
    'nav.cart': 'Carrito',
    'nav.login': 'Entrar',
    'nav.logout': 'Salir',

    'catalog.title': 'Singles a la venta',
    'catalog.subtitle': 'cartas con stock disponible ahora — publicadas por la tienda y por coleccionistas (Vender repetidas)',
    'catalog.search': 'Buscar: nombre, número o artista (ej. zorua 66, Arita)',
    'catalog.allGames': 'Juego: todos',
    'catalog.allSets': 'Set: todos',
    'catalog.type': 'Tipo (ej. Fire, Red…)',
    'catalog.rarity': 'Rareza',
    'catalog.inStock': 'Solo con stock',
    'catalog.loading': 'Cargando…',
    'catalog.empty': 'Nada a la venta con esos filtros. Aquí solo aparecen cartas publicadas con stock: usa \u201cVender repetidas\u201d en Mi Colección para publicar las tuyas.',
    'catalog.noStock': 'Sin stock',
    'catalog.inStockLabel': 'en stock',
    'catalog.page': 'Página',
    'catalog.of': 'de',

    'sets.title': 'Sets y completitud',
    'sets.subtitle': 'Progreso de cada set según las cartas con stock',
    'sets.collected': 'conseguidas',
    'sets.missing': 'faltan',

    'collection.title': 'Mi Colección',
    'collection.subtitle': 'Tu progreso por set: cartas, valor y duplicadas',
    'collection.owned': 'poseídas',
    'collection.value': 'Valor',
    'collection.setValue': 'Valor del set',
    'collection.collectionValue': 'Valor de mi colección',
    'collection.duplicates': 'Duplicadas',
    'collection.missing': 'Faltantes',
    'collection.complete': 'completado',
    'collection.language': 'Idioma',
    'collection.allLanguages': 'Ambos idiomas',
    'collection.onlyMissing': 'Solo faltantes',
    'collection.variants': 'variantes',
    'collection.total': 'total',
    'collection.have': 'Tienes',
    'collection.viewSet': 'Ver el set completo y marcar lo que tienes',
    'collection.emptyLogin': 'Inicia sesión para ver tu colección.',

    'auth.login': 'Entrar',
    'auth.register': 'Crear cuenta',
    'auth.email': 'Email',
    'auth.password': 'Contraseña',
    'auth.name': 'Nombre',
    'auth.noAccount': '¿No tienes cuenta?',
    'auth.hasAccount': '¿Ya tienes cuenta?',

    'common.back': 'Volver',
    'common.released': 'lanzado',

    'card.back': 'Volver al catálogo',
    'card.attributes': 'Atributos',
    'card.availability': 'Disponibilidad',
    'card.noStock': 'No hay unidades en stock de esta carta.',
    'card.add': 'Añadir',
    'card.available': 'disp.',

    'setd.allSets': 'Todos los sets',
    'setd.inStock': 'con stock',
    'setd.missing': 'faltante',
    'setd.onlyMissing': 'Ver solo faltantes',
    'setd.inCatalog': 'en catálogo',
    'setd.officialTotal': 'total oficial',
    'setd.toGet': 'por conseguir',

    'cart.title': 'Carrito',
    'cart.empty': 'Tu carrito está vacío.',
    'cart.explore': 'Explorar catálogo',
    'cart.summary': 'Resumen',
    'cart.items': 'Artículos',
    'cart.total': 'Total',
    'cart.shipName': 'Nombre de envío',
    'cart.shipAddr': 'Dirección de envío',
    'cart.confirm': 'Confirmar compra',
    'cart.processing': 'Procesando…',
    'cart.loginToBuy': 'Inicia sesión para completar la compra.',

    'orders.title': 'Mis órdenes',
    'orders.allTitle': 'Todas las órdenes',
    'orders.viewAll': 'Ver todas (admin)',
    'orders.viewMine': 'Ver mis órdenes',
    'orders.none': 'No hay órdenes.',

    'storage.title': 'Almacenamiento',
    'storage.subtitle': 'Organiza dónde guardas tus cartas: álbumes, carpetas y cajas.',
    'storage.name': 'Nombre',
    'storage.create': 'Crear',
    'storage.empty': 'Aún no tienes álbumes ni cajas. Crea el primero arriba.',
    'storage.cards': 'cartas',

    'admin.title': 'Administración de inventario',
    'admin.subtitle': 'Busca una carta para gestionar su stock, precio y condiciones.',
    'admin.search': 'Buscar: nombre, número o artista (ej. zorua 66, Arita)',
    'admin.addUnit': 'Añadir unidad',
    'admin.noInv': 'Aún no hay inventario para esta carta.',
    'admin.language': 'Idioma',
    'admin.price': 'Precio',
    'admin.qty': 'Cantidad',
    'admin.add': 'Añadir',
  },
  en: {
    'nav.catalog': 'Catalog',
    'nav.sets': 'Sets',
    'nav.collection': 'My Collection',
    'nav.orders': 'Orders',
    'nav.admin': 'Admin',
    'nav.cart': 'Cart',
    'nav.login': 'Sign in',
    'nav.logout': 'Sign out',

    'catalog.title': 'Singles for sale',
    'catalog.subtitle': 'cards in stock right now — listed by the store and by collectors (Sell duplicates)',
    'catalog.search': 'Search: name, number or artist (e.g. zorua 66, Arita)',
    'catalog.allGames': 'Game: all',
    'catalog.allSets': 'Set: all',
    'catalog.type': 'Type (e.g. Fire, Red…)',
    'catalog.rarity': 'Rarity',
    'catalog.inStock': 'In stock only',
    'catalog.loading': 'Loading…',
    'catalog.empty': 'Nothing for sale with those filters. Only listed cards with stock appear here — use \u201cSell duplicates\u201d in My Collection to list yours.',
    'catalog.noStock': 'Out of stock',
    'catalog.inStockLabel': 'in stock',
    'catalog.page': 'Page',
    'catalog.of': 'of',

    'sets.title': 'Sets & completion',
    'sets.subtitle': 'Progress of each set based on cards in stock',
    'sets.collected': 'collected',
    'sets.missing': 'missing',

    'collection.title': 'My Collection',
    'collection.subtitle': 'Your progress per set: cards, value and duplicates',
    'collection.owned': 'owned',
    'collection.value': 'Value',
    'collection.setValue': 'Set value',
    'collection.collectionValue': 'My collection value',
    'collection.duplicates': 'Duplicates',
    'collection.missing': 'Missing',
    'collection.complete': 'complete',
    'collection.language': 'Language',
    'collection.allLanguages': 'Both languages',
    'collection.onlyMissing': 'Only missing',
    'collection.variants': 'variants',
    'collection.total': 'total',
    'collection.have': 'You have',
    'collection.viewSet': 'View the full set and mark what you own',
    'collection.emptyLogin': 'Sign in to see your collection.',

    'auth.login': 'Sign in',
    'auth.register': 'Create account',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.name': 'Name',
    'auth.noAccount': "Don't have an account?",
    'auth.hasAccount': 'Already have an account?',

    'common.back': 'Back',
    'common.released': 'released',

    'card.back': 'Back to catalog',
    'card.attributes': 'Attributes',
    'card.availability': 'Availability',
    'card.noStock': 'No units in stock for this card.',
    'card.add': 'Add',
    'card.available': 'avail.',

    'setd.allSets': 'All sets',
    'setd.inStock': 'in stock',
    'setd.missing': 'missing',
    'setd.onlyMissing': 'Only missing',
    'setd.inCatalog': 'in catalog',
    'setd.officialTotal': 'official total',
    'setd.toGet': 'to get',

    'cart.title': 'Cart',
    'cart.empty': 'Your cart is empty.',
    'cart.explore': 'Browse catalog',
    'cart.summary': 'Summary',
    'cart.items': 'Items',
    'cart.total': 'Total',
    'cart.shipName': 'Shipping name',
    'cart.shipAddr': 'Shipping address',
    'cart.confirm': 'Confirm purchase',
    'cart.processing': 'Processing…',
    'cart.loginToBuy': 'Sign in to complete the purchase.',

    'orders.title': 'My orders',
    'orders.allTitle': 'All orders',
    'orders.viewAll': 'View all (admin)',
    'orders.viewMine': 'View my orders',
    'orders.none': 'No orders yet.',

    'storage.title': 'Storage',
    'storage.subtitle': 'Organize where you keep your cards: albums, binders and boxes.',
    'storage.name': 'Name',
    'storage.create': 'Create',
    'storage.empty': 'No albums or boxes yet. Create the first one above.',
    'storage.cards': 'cards',

    'admin.title': 'Inventory administration',
    'admin.subtitle': 'Search a card to manage its stock, price and conditions.',
    'admin.search': 'Search: name, number or artist (e.g. zorua 66, Arita)',
    'admin.addUnit': 'Add unit',
    'admin.noInv': 'No inventory for this card yet.',
    'admin.language': 'Language',
    'admin.price': 'Price',
    'admin.qty': 'Quantity',
    'admin.add': 'Add',
  },
};

const LANG_KEY = 'tcg_lang';

@Injectable({ providedIn: 'root' })
export class I18nService {
  readonly lang = signal<Lang>(this.restore());
  readonly isES = computed(() => this.lang() === 'es');

  /** Traduce una clave al idioma actual (reactivo al cambiar el idioma). */
  t(key: string): string {
    return DICT[this.lang()][key] ?? DICT.en[key] ?? key;
  }

  toggle() {
    this.setLang(this.lang() === 'es' ? 'en' : 'es');
  }

  setLang(lang: Lang) {
    this.lang.set(lang);
    localStorage.setItem(LANG_KEY, lang);
  }

  private restore(): Lang {
    return (localStorage.getItem(LANG_KEY) as Lang) ?? 'es';
  }
}
