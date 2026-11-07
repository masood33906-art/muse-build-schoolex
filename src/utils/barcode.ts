// Real Code 39 barcode encoder (replaces bar "simulations").
//
// Each Code 39 character is 9 elements — 5 bars and 4 spaces, alternating,
// starting and ending with a bar. Exactly 3 of the 9 elements are wide.
// Here a narrow element is 1 abstract unit and a wide element is 3 units;
// characters are separated by a 1-unit inter-character gap (a space).
// Patterns below were cross-verified element-for-element against the
// python-barcode library's scanner-tested Code 39 charset (44/44 match).

/** Element patterns per character: 9 chars, 'n' = narrow (1 unit), 'w' = wide (3 units). */
const CODE39_PATTERNS: Record<string, string> = {
  '0': 'nnnwwnwnn',
  '1': 'wnnwnnnnw',
  '2': 'nnwwnnnnw',
  '3': 'wnwwnnnnn',
  '4': 'nnnwwnnnw',
  '5': 'wnnwwnnnn',
  '6': 'nnwwwnnnn',
  '7': 'nnnwnnwnw',
  '8': 'wnnwnnwnn',
  '9': 'nnwwnnwnn',
  'A': 'wnnnnwnnw',
  'B': 'nnwnnwnnw',
  'C': 'wnwnnwnnn',
  'D': 'nnnnwwnnw',
  'E': 'wnnnwwnnn',
  'F': 'nnwnwwnnn',
  'G': 'nnnnnwwnw',
  'H': 'wnnnnwwnn',
  'I': 'nnwnnwwnn',
  'J': 'nnnnwwwnn',
  'K': 'wnnnnnnww',
  'L': 'nnwnnnnww',
  'M': 'wnwnnnnwn',
  'N': 'nnnnwnnww',
  'O': 'wnnnwnnwn',
  'P': 'nnwnwnnwn',
  'Q': 'nnnnnnwww',
  'R': 'wnnnnnwwn',
  'S': 'nnwnnnwwn',
  'T': 'nnnnwnwwn',
  'U': 'wwnnnnnnw',
  'V': 'nwwnnnnnw',
  'W': 'wwwnnnnnn',
  'X': 'nwnnwnnnw',
  'Y': 'wwnnwnnnn',
  'Z': 'nwwnwnnnn',
  '-': 'nwnnnnwnw',
  '.': 'wwnnnnwnn',
  ' ': 'nwwnnnwnn',
  '$': 'nwnwnwnnn',
  '/': 'nwnwnnnwn',
  '+': 'nwnnnwnwn',
  '%': 'nnnwnwnwn',
  '*': 'nwnnwnwnn',
};

export interface Code39Bar {
  /** Offset of the bar's left edge, in abstract units from the barcode start. */
  start: number;
  /** Bar width in abstract units (1 = narrow, 3 = wide). */
  width: number;
}

export interface Code39Spans {
  bars: Code39Bar[];
  /** Total width of the framed barcode in abstract units (excluding quiet zones). */
  totalUnits: number;
}

/**
 * Encodes `value` as a framed Code 39 barcode ('*' start/stop added).
 * The value is uppercased; characters outside the Code 39 set
 * (0-9, A-Z, '-', '.', ' ', '$', '/', '+', '%') are skipped.
 * Returns the black bar spans in abstract module units.
 */
export function code39Spans(value: string): Code39Spans {
  const clean = (value || '')
    .toUpperCase()
    .split('')
    .filter(ch => ch !== '*' && CODE39_PATTERNS[ch] !== undefined);
  const framed = ['*', ...clean, '*'];

  const bars: Code39Bar[] = [];
  let cursor = 0;
  framed.forEach((ch, index) => {
    if (index > 0) cursor += 1; // inter-character gap
    const pattern = CODE39_PATTERNS[ch];
    for (let i = 0; i < pattern.length; i++) {
      const w = pattern[i] === 'w' ? 3 : 1;
      if (i % 2 === 0) bars.push({ start: cursor, width: w }); // even element indices are bars
      cursor += w;
    }
  });

  return { bars, totalUnits: cursor };
}
