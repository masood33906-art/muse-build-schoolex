import { Student } from '../../types';

/**
 * Legacy pre-§2 paid amount helper used strictly during the one-time
 * migrateFeesV2 migration to recover any override.totalPaid delta.
 */
export function legacyHashPaid(student: Student): number {
  return Math.max(0, Number(student.totalPaid) || 0);
}
