import { loadJSON, saveJSON } from './storage';

export interface GeneratedChallan {
  id: string;
  challanNumber: string;
  targetType: 'family' | 'student';
  targetId: string;
  targetName: string;
  familyId: string;
  studentIds: string[];
  studentNames: string[];
  className?: string;
  section?: string;
  phone?: string;
  amount: number;
  feeRange: string;
  feeBreakdown?: {
    tuitionFee: number;
    examFee: number;
    labFee: number;
    arrears: number;
    advanceMonths?: number;
    advanceAmount?: number;
    totalAmount: number;
  };
  issueDate: string;
  dueDate: string;
  validityDate: string;
  generatedAt: string;
  status: 'Generated' | 'Paid';
}

const GENERATED_CHALLANS_STORAGE_KEY = 'schooliee_generated_challans_clean_v1';

const SEED_DEFAULT_CHALLANS: GeneratedChallan[] = [];

export const ARCHIVED_SEED_DEFAULT_CHALLANS: GeneratedChallan[] = [];

export function getGeneratedChallans(): GeneratedChallan[] {
  return loadJSON<GeneratedChallan[]>(
    GENERATED_CHALLANS_STORAGE_KEY,
    SEED_DEFAULT_CHALLANS,
    Array.isArray as (v: unknown) => v is GeneratedChallan[]
  );
}

export function markChallansAsPaid(challanIds: string[]): void {
  const existing = getGeneratedChallans();
  const idSet = new Set(challanIds);
  const updated = existing.map(c => {
    if (idSet.has(c.id) || idSet.has(c.challanNumber)) {
      return {
        ...c,
        status: 'Paid' as const
      };
    }
    return c;
  });
  saveJSON(GENERATED_CHALLANS_STORAGE_KEY, updated);
}

export function saveGeneratedChallans(newChallans: GeneratedChallan[]): void {
  const existing = getGeneratedChallans();
  const map = new Map<string, GeneratedChallan>();
  existing.forEach(c => map.set(c.id, c));
  newChallans.forEach(c => map.set(c.id, c));
  const combined = Array.from(map.values());
  saveJSON(GENERATED_CHALLANS_STORAGE_KEY, combined);
}

export function saveSingleGeneratedChallan(challan: GeneratedChallan): void {
  saveGeneratedChallans([challan]);
}

/**
 * Checks if a challan is already generated for this student/family with this exact current due amount.
 */
export function isChallanAlreadyGenerated(targetId: string, currentAmount: number): GeneratedChallan | undefined {
  const challans = getGeneratedChallans();
  return challans.find(c => {
    const matchesTarget = c.targetId === targetId || (c.studentIds && c.studentIds.includes(targetId));
    // If target matches and amount is positive and matches current amount (or within small margin)
    return matchesTarget && Math.abs(c.amount - currentAmount) < 1;
  });
}

/**
 * Retrieves the most recent generated challan for a target (student or family)
 */
export function getChallanByTargetId(targetId: string): GeneratedChallan | undefined {
  const challans = getGeneratedChallans();
  return challans
    .filter(c => c.targetId === targetId || (c.studentIds && c.studentIds.includes(targetId)))
    .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime())[0];
}

export function removeGeneratedChallan(id: string): void {
  const existing = getGeneratedChallans();
  const filtered = existing.filter(c => c.id !== id);
  saveJSON(GENERATED_CHALLANS_STORAGE_KEY, filtered);
}
