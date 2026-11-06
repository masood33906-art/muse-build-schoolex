/** Sequential, collision-free ids: REC-000001. Counter is persisted. */
export function nextSequential(prefix: string, pad = 6): string {
  const key = `schoollee_seq_${prefix}`;
  const n = (parseInt(localStorage.getItem(key) || '0', 10) || 0) + 1;
  localStorage.setItem(key, String(n));
  return `${prefix}-${String(n).padStart(pad, '0')}`;
}
