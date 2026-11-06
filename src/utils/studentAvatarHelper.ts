// Utility helper for Student Profile Display Pictures (DP)
// Default avatars for Boy and Girl students based on selected gender

export const BOY_AVATAR_URL = '/assets/aistudio/boy_c3a653af.png';
export const GIRL_AVATAR_URL = '/assets/aistudio/girl_31bb6e0b.png';

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
 * Returns the appropriate avatar image URL:
 * 1. Custom uploaded photo if available
 * 2. Girl student PNG if gender is Female (or inferred female)
 * 3. Boy student PNG otherwise
 */
export function getStudentAvatar(student: {
  photo?: string;
  gender?: 'Male' | 'Female' | 'Other' | string;
  name?: string;
}): string {
  if (student.photo && student.photo.trim().length > 0) {
    return student.photo;
  }

  const gender = student.gender || (student.name ? inferGenderFromName(student.name) : 'Male');
  if (gender === 'Female') {
    return GIRL_AVATAR_URL;
  }
  return BOY_AVATAR_URL;
}

/**
 * Returns default avatar URL based strictly on gender selection
 */
export function getDefaultAvatarByGender(gender?: string): string {
  if (gender === 'Female') {
    return GIRL_AVATAR_URL;
  }
  return BOY_AVATAR_URL;
}
