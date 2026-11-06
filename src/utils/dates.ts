export const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

/** Local YYYY-MM-DD. Never use toISOString() for dates (it is UTC and is wrong 00:00–05:00 in Pakistan). */
export const localISODate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const monthKeyOf = (d = new Date()) => localISODate(d).slice(0, 7);          // '2026-10'
export const monthLabelFromKey = (k: string) => `${MONTHS[+k.slice(5, 7) - 1]} ${k.slice(0, 4)}`; // 'October 2026'

/** Inclusive list of 'YYYY-MM' keys. */
export function monthKeysBetween(startKey: string, endKey: string): string[] {
  const out: string[] = [];
  let y = +startKey.slice(0, 4), m = +startKey.slice(5, 7);
  const ey = +endKey.slice(0, 4), em = +endKey.slice(5, 7);
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    if (++m > 12) { m = 1; y++; }
  }
  return out;
}
