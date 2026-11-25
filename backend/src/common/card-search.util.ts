/**
 * Parsea el texto de búsqueda de cartas soportando nombre + número:
 *   "zorua 66"  → name: zorua, número 66 (matchea "066/98", "66/102"…)
 *   "066/98"    → solo número
 *   "66"        → solo número
 *   "porygon2"  → solo nombre (el número debe venir separado por espacio)
 */
export function parseCardQuery(raw: string): {
  name?: RegExp;
  number?: RegExp;
} {
  const q = raw.trim();
  if (!q) return {};

  const numberOnly = q.match(/^#?(\d{1,4})(?:\/(\d+))?$/);
  const nameAndNumber = q.match(/^(.*\S)\s+#?(\d{1,4})(?:\/(\d+))?$/);

  // "66" → cualquier 066/*; "66/98" → exactamente el set de 98.
  const numRegex = (n: string, den?: string) =>
    den ? new RegExp(`^0*${n}/${den}$`, 'i') : new RegExp(`^0*${n}(/|$)`, 'i');

  if (numberOnly) return { number: numRegex(numberOnly[1], numberOnly[2]) };
  if (nameAndNumber) {
    return {
      name: new RegExp(escapeRegex(nameAndNumber[1].trim()), 'i'),
      number: numRegex(nameAndNumber[2], nameAndNumber[3]),
    };
  }
  return { name: new RegExp(escapeRegex(q), 'i') };
}

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
