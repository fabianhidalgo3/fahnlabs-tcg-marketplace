// Actualiza SOLO el campo `variantValues` (precios por variante, USD) de cada
// carta Pokémon en los archivos de seed, re-obteniendo los precios desde la API
// pokemontcg.io (fuente: tcgplayer). No modifica nada más: ni cards, ni variants,
// ni attributes, ni imágenes, ni el set.
//
// Uso:  node src/seed/scripts/update-prices.mjs
//       npm run update-prices
//
// Notas del entorno: fetch/undici está BLOQUEADO en el sandbox -> se descarga con
// `curl`. Se respeta rate limit (sleep 2 entre descargas) y se reintenta 3 veces
// (sleep 5) ante error/respuesta vacía. Cada archivo se reescribe apenas se procesa
// (progreso incremental). Si un set falla, se registra y se continúa.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdtempSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const POKEMON_DIR = join(__dirname, '..', 'data', 'sets', 'pokemon');
const TMP_DIR = mkdtempSync(join(tmpdir(), 'tcg-prices-'));

const PAGE_SIZE = 250;
const SLEEP_BETWEEN = 2; // seg. entre descargas (rate limit)
const RETRIES = 3;
const SLEEP_RETRY = 5; // seg. entre reintentos

// --- helpers ---------------------------------------------------------------

// sleep síncrono sin lanzar procesos (evita `sleep` de shell bloqueado).
function sleep(sec) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Math.round(sec * 1000));
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

// Normaliza el "number" para comparar archivo vs API.
// Archivo: "006/165" -> "6" ; "SWSH045/165" -> "SWSH45" ; "TG01/30" -> "TG1" ; "37a/165" -> "37A"
// API:     "6" -> "6" ; "SWSH045" -> "SWSH45" ; "TG01" -> "TG1" ; "37a" -> "37A"
function normNum(s) {
  return String(s)
    .split('/')[0]
    .trim()
    .toUpperCase()
    .replace(/\d+/g, (d) => String(parseInt(d, 10)));
}

// Descarga una URL con curl a un archivo temporal y devuelve el JSON parseado.
// Lanza si curl falla, el archivo está vacío o el JSON es inválido.
function curlJson(url) {
  const out = join(TMP_DIR, 'resp.json');
  execFileSync(
    'curl',
    ['-sL', '--max-time', '90', '-A', 'Mozilla/5.0', url, '-o', out],
    { stdio: 'ignore' },
  );
  const raw = readFileSync(out, 'utf8');
  if (!raw || !raw.trim()) throw new Error('respuesta vacía');
  return JSON.parse(raw);
}

// Descarga TODAS las cartas de un set (con paginación) y reintentos por página.
function fetchSetCards(code) {
  const all = [];
  let page = 1;
  while (true) {
    const url =
      `https://api.pokemontcg.io/v2/cards?q=set.id:${encodeURIComponent(code)}` +
      `&pageSize=${PAGE_SIZE}&page=${page}&orderBy=number`;

    let data = null;
    let lastErr = null;
    for (let attempt = 1; attempt <= RETRIES; attempt++) {
      try {
        const json = curlJson(url);
        if (!json || !Array.isArray(json.data)) throw new Error('sin campo data[]');
        if (json.data.length === 0 && all.length === 0) throw new Error('data[] vacío');
        data = json;
        break;
      } catch (e) {
        lastErr = e;
        if (attempt < RETRIES) sleep(SLEEP_RETRY);
      }
    }
    if (!data) throw lastErr || new Error('descarga fallida');

    all.push(...data.data);
    const total = Number.isFinite(data.totalCount) ? data.totalCount : all.length;
    if (all.length >= total || data.data.length === 0) break;
    page++;
    sleep(SLEEP_BETWEEN);
  }
  return all;
}

// Deriva precios normal/reverse/holo con la MISMA lógica del import original.
function derivePrices(prices, prev) {
  const normal =
    prices?.normal?.market ??
    prices?.normal?.mid ??
    prices?.holofoil?.market ??
    (prev.normal ?? 0.25);
  const reverse =
    prices?.reverseHolofoil?.market ??
    prices?.reverseHolofoil?.mid ??
    round2(normal * 1.6);
  const holo = prices?.holofoil?.market ?? prices?.holofoil?.mid ?? normal;
  return { normal: round2(normal), reverse: round2(reverse), holo: round2(holo) };
}

// Reescribe SOLO los números de cada bloque "variantValues" que realmente cambian.
// Preserva byte-a-byte todo lo demás (incluido formato como 1.0 en valores sin cambio).
function rewriteRaw(raw, newValuesPerCard) {
  const blockRe = /"variantValues"\s*:\s*\{[^}]*\}/g;
  let result = '';
  let last = 0;
  let i = 0;
  let m;
  while ((m = blockRe.exec(raw))) {
    result += raw.slice(last, m.index);
    let block = m[0];
    const nv = newValuesPerCard[i];
    if (nv) {
      block = block.replace(
        /("([^"]+)"\s*:\s*)(-?\d+(?:\.\d+)?)/g,
        (full, pre, key, num) => {
          if (Object.prototype.hasOwnProperty.call(nv, key)) {
            const newVal = nv[key];
            if (parseFloat(num) === newVal) return full; // sin cambio -> preserva token original
            return pre + String(newVal);
          }
          return full;
        },
      );
    }
    result += block;
    last = m.index + m[0].length;
    i++;
  }
  result += raw.slice(last);
  return { result, blockCount: i };
}

// --- main ------------------------------------------------------------------

function main() {
  if (!existsSync(POKEMON_DIR)) {
    console.error('No existe el directorio:', POKEMON_DIR);
    process.exit(1);
  }
  // Filtro opcional por CLI: `node update-prices.mjs base4 bw1` procesa solo esos
  // sets (por set.code o nombre de archivo). Útil para reintentar los que fallaron.
  const only = process.argv.slice(2).map((a) => a.replace(/\.json$/i, '').toLowerCase());
  let files = readdirSync(POKEMON_DIR).filter((f) => f.endsWith('.json')).sort();
  if (only.length) {
    files = files.filter((f) => only.includes(f.replace(/\.json$/i, '').toLowerCase()));
    console.log(`Filtro activo -> ${files.length} set(s): ${files.join(', ')}`);
  }

  let setsOk = 0;
  let cardsUpdated = 0; // cartas con al menos un precio cambiado
  let valuesChanged = 0; // total de valores individuales cambiados
  const failed = [];
  const examples = [];

  for (const file of files) {
    const full = join(POKEMON_DIR, file);
    const raw = readFileSync(full, 'utf8');
    const obj = JSON.parse(raw);
    const code = obj?.set?.code;
    if (!code) {
      failed.push(`${file} (sin set.code)`);
      continue;
    }

    let apiCards;
    try {
      apiCards = fetchSetCards(code);
    } catch (e) {
      failed.push(`${code} (${file}): ${e.message}`);
      console.log(`✗ ${code}: FALLÓ (${e.message})`);
      sleep(SLEEP_BETWEEN);
      continue;
    }

    // Mapa normalizado number -> carta API
    const byNum = new Map();
    for (const ac of apiCards) {
      const k = normNum(ac.number);
      if (!byNum.has(k)) byNum.set(k, ac);
    }

    const newValuesPerCard = [];
    let setCardsUpdated = 0;

    for (const card of obj.cards) {
      const prevVV = card.variantValues || {};
      const apiCard = byNum.get(normNum(card.number));
      const prices = apiCard?.tcgplayer?.prices;

      if (!apiCard || !prices) {
        newValuesPerCard.push(null); // sin match o sin precio -> deja valores previos
        continue;
      }

      const prev = {
        normal: prevVV['Normal'],
        reverse: prevVV['Reverse Holo'],
        holo: prevVV['Holo'],
      };
      const d = derivePrices(prices, prev);
      const map = { Normal: d.normal, 'Reverse Holo': d.reverse, Holo: d.holo };

      const nv = {};
      let changedThisCard = false;
      for (const key of Object.keys(prevVV)) {
        if (Object.prototype.hasOwnProperty.call(map, key)) {
          nv[key] = map[key];
          if (prevVV[key] !== map[key]) {
            changedThisCard = true;
            valuesChanged++;
            if (examples.length < 12) {
              examples.push(
                `${code} #${card.number} ${card.name} [${key}] ${prevVV[key]} -> ${map[key]}`,
              );
            }
          }
        }
      }
      newValuesPerCard.push(nv);
      if (changedThisCard) {
        cardsUpdated++;
        setCardsUpdated++;
      }
    }

    const { result, blockCount } = rewriteRaw(raw, newValuesPerCard);
    if (blockCount !== obj.cards.length) {
      failed.push(`${code} (${file}): bloques ${blockCount} != cartas ${obj.cards.length} (NO escrito)`);
      console.log(`✗ ${code}: desajuste de bloques, no se escribe`);
      sleep(SLEEP_BETWEEN);
      continue;
    }

    writeFileSync(full, result); // progreso incremental
    setsOk++;
    console.log(
      `✓ ${code}: ${apiCards.length} cartas API · ${setCardsUpdated}/${obj.cards.length} cartas con precio actualizado`,
    );
    sleep(SLEEP_BETWEEN);
  }

  console.log('\n================ RESUMEN ================');
  console.log(`Sets procesados OK : ${setsOk}/${files.length}`);
  console.log(`Cartas actualizadas: ${cardsUpdated}`);
  console.log(`Valores cambiados  : ${valuesChanged}`);
  console.log(`Sets fallidos      : ${failed.length}`);
  if (failed.length) failed.forEach((f) => console.log('   - ' + f));
  if (examples.length) {
    console.log('\nEjemplos (antes -> después):');
    examples.forEach((e) => console.log('   ' + e));
  }
}

main();
