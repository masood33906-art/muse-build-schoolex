export const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

/** Local YYYY-MM-DD. Never use toISOString() for dates (it is UTC and is wrong 00:00–05:00 in Pakistan). */
export const localISODate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const monthKeyOf = (d = new Date()) => localISODate(d).slice(0, 7);          // '2026-10'
export const monthLabelFromKey = (k: string) => `${MONTHS[+k.slice(5, 7) - 1]} ${k.slice(0, 4)}`; // 'October 2026'

/**
 * Parse a stored exam-subject start date. Accepted shapes are the
 * CreateExamModal datetime 'MM/DD/YYYY hh:mm aa' and a plain 'YYYY-MM-DD'.
 * Returns the local calendar date plus its time parts (default 09:00 AM),
 * or null when the value cannot be parsed.
 */
export function parseSubjectStartDate(value: string): { date: Date; hour: string; minute: string; period: 'AM' | 'PM' } | null {
  if (!value) return null;
  const dt = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})\s*(AM|PM)?)?$/i);
  if (dt) {
    const month = +dt[1], day = +dt[2], year = +dt[3];
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return {
      date: new Date(year, month - 1, day),
      hour: dt[4] ? dt[4].padStart(2, '0') : '09',
      minute: dt[5] || '00',
      period: dt[6]?.toUpperCase() === 'PM' ? 'PM' : 'AM'
    };
  }
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    return { date: new Date(+iso[1], +iso[2] - 1, +iso[3]), hour: '09', minute: '00', period: 'AM' };
  }
  return null;
}

/** Format a local Date back into the exam-subject 'MM/DD/YYYY hh:mm aa' shape. */
export function formatSubjectStartDate(date: Date, hour = '09', minute = '00', period: 'AM' | 'PM' = 'AM'): string {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${mm}/${dd}/${date.getFullYear()} ${hour}:${minute} ${period}`;
}

/**
 * Default start date for the NEXT subject added to an exam: the previous
 * subject's date + 1 day (keeping its time). With no previous subject — or
 * an unparseable one — the default is tomorrow at 09:00 AM.
 */
export function nextSubjectStartDate(prevValue?: string): string {
  const prev = prevValue ? parseSubjectStartDate(prevValue) : null;
  if (prev) {
    const next = new Date(prev.date);
    next.setDate(next.getDate() + 1);
    return formatSubjectStartDate(next, prev.hour, prev.minute, prev.period);
  }
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return formatSubjectStartDate(tomorrow);
}

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
