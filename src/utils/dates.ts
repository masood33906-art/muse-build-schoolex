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

/**
 * Academic session helpers. The session convention across the app is
 * Apr–Mar: a session runs from April of its first year to March of its
 * second (e.g. '2026 - 2027' = Apr 2026 … Mar 2027). Display labels use
 * the compact en-dash form ('2026–2027').
 */

/** The [firstYear, secondYear] of the session containing a date. */
export function sessionYearsContainingDate(d = new Date()): [number, number] {
  const y = d.getFullYear();
  return d.getMonth() + 1 >= 4 ? [y, y + 1] : [y - 1, y];
}

/** Parse the years out of a stored session string ('2026 - 2027', '2026–2027', …). */
export function parseSessionYears(session?: string | null): [number, number] | null {
  const years = (session || '').match(/\d{4}/g)?.map(Number) ?? [];
  if (years.length >= 2) return [years[0], years[1]];
  if (years.length === 1) return [years[0], years[0] + 1];
  return null;
}

/**
 * The session that applies right now: the one in Settings when it holds
 * a parseable value, otherwise the session containing `today`.
 */
export function resolveSessionYears(session?: string | null, today = new Date()): [number, number] {
  return parseSessionYears(session) ?? sessionYearsContainingDate(today);
}

/** Display label for the applicable session, e.g. '2026–2027'. */
export function resolveSessionLabel(session?: string | null, today = new Date()): string {
  const [first, second] = resolveSessionYears(session, today);
  return `${first}–${second}`;
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
