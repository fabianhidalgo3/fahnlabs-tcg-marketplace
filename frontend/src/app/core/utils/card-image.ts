import { environment } from '../../../environments/environment';

const POKE_CDN = 'https://images.pokemontcg.io/';

/**
 * Miniatura para grillas y listados: pokemontcg.io sirve `X.png` (~30 KB)
 * además de `X_hires.png` (~300 KB). En grillas de 150-220px la chica basta.
 */
export function thumbUrl(url?: string | null): string {
  if (!url) return '';
  // scrydex: /large (~1 MB) → /small (~55 KB) para grillas.
  if (url.includes('images.scrydex.com')) return url.replace(/\/large$/, '/small');
  return proxied(url.replace('_hires.png', '.png'));
}

/** Imagen grande (hires) para la vista de detalle. */
export function fullUrl(url?: string | null): string {
  return url ? proxied(url) : '';
}

/**
 * Logo grande del set (ej. el "151" estilizado), derivado del symbolUrl:
 * pokemontcg.io sirve `<set>/symbol.png` y `<set>/logo.png` en la misma base.
 * Para sets de otros juegos sin ese patrón devuelve '' (ocultar con @if).
 */
export function setLogoUrl(symbolUrl?: string | null): string {
  if (!symbolUrl) return '';
  if (symbolUrl.includes('/symbol.png')) return proxied(symbolUrl.replace('/symbol.png', '/logo.png'));
  // scrydex: .../pokemon/<code>-symbol/symbol → .../pokemon/<code>-logo/logo
  if (symbolUrl.includes('-symbol/symbol')) return symbolUrl.replace('-symbol/symbol', '-logo/logo');
  return '';
}

/**
 * En producción (Docker) las imágenes pasan por nginx con proxy_cache:
 * tras la primera descarga quedan cacheadas en el servidor y salen al
 * instante, sin depender de la latencia de pokemontcg.io.
 */
function proxied(url: string): string {
  if (environment.production && url.startsWith(POKE_CDN)) {
    return '/img/' + url.slice(POKE_CDN.length);
  }
  return url;
}
