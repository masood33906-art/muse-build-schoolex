// Utility helper for Student Profile Display Pictures (DP)
// Default avatars for Boy and Girl students based on selected gender
//
// The defaults are embedded base64 data URIs (see defaultAvatars.ts) so they
// always load — the PNG files they came from are not in the GitHub repo and
// URL references to them 404 in fresh checkouts / the Codespace.
import { BOY_AVATAR_DATA_URI, GIRL_AVATAR_DATA_URI } from './defaultAvatars';

export { BOY_AVATAR_DATA_URI, GIRL_AVATAR_DATA_URI };

export const BOY_AVATAR_URL = BOY_AVATAR_DATA_URI;
export const GIRL_AVATAR_URL = GIRL_AVATAR_DATA_URI;

// Avatar paths that older builds saved directly into student.photo. The files
// behind these paths are not in the GitHub repo, so any record still holding
// one of them has NO real photo — treat it as "no photo" and resolve the
// gender default instead (heals legacy records without a data migration).
export const LEGACY_DEFAULT_AVATAR_PATHS: readonly string[] = [
  '/assets/aistudio/boy_c3a653af.png',
  '/assets/aistudio/girl_31bb6e0b.png',
  '/assets/boy_student.png',
  '/assets/girl_student.png'
];

export function isLegacyDefaultAvatar(photo?: string | null): boolean {
  if (!photo) return false;
  return LEGACY_DEFAULT_AVATAR_PATHS.includes(photo.trim());
}

// Known common female names for fallback gender inference if gender is omitted
const FEMALE_FIRST_NAMES = new Set([
  'amna', 'fiza', 'esha', 'shumail', 'samina', 'zainab', 'ayesha',
  'fatima', 'maryam', 'noor', 'sana', 'hira', 'iqra', 'khadija', 'sidra',
  'bisma', 'kinza', 'sadia', 'rabia', 'zoya', 'anum', 'mahnoor', 'laiba',
  'nimra', 'rimsha', 'bushra', 'mehwish', 'anaya', 'dua', 'minahil', 'eman',
  'hareem', 'hoorain', 'ayzal', 'arfa', 'manahil', 'meerab', 'inaya'
]);

/**
 * Infers gender from name if not explicitly set
 */
export function inferGenderFromName(name: string): 'Male' | 'Female' {
  if (!name) return 'Male';
  const firstName = name.trim().split(/\s+/)[0]?.toLowerCase() || '';
  if (FEMALE_FIRST_NAMES.has(firstName)) {
    return 'Female';
  }
  return 'Male';
}

/**
 * Returns the appropriate avatar image:
 * 1. Custom uploaded photo if available (legacy default-URL values count as
 *    NO photo — they point at files that do not exist in the deployment)
 * 2. Girl student image if gender is Female (or inferred female)
 * 3. Boy student image otherwise
 */
export function getStudentAvatar(student: {
  photo?: string;
  gender?: 'Male' | 'Female' | 'Other' | string;
  name?: string;
}): string {
  if (student.photo && student.photo.trim().length > 0 && !isLegacyDefaultAvatar(student.photo)) {
    return student.photo;
  }

  const gender = student.gender || (student.name ? inferGenderFromName(student.name) : 'Male');
  if (gender === 'Female') {
    return GIRL_AVATAR_URL;
  }
  return BOY_AVATAR_URL;
}

/**
 * Returns default avatar based strictly on gender selection
 */
export function getDefaultAvatarByGender(gender?: string): string {
  if (gender === 'Female') {
    return GIRL_AVATAR_URL;
  }
  return BOY_AVATAR_URL;
}
