import { loadJSON, saveJSON } from './storage';

export type RollNumberSlipTemplateType = 'minimal-stream' | 'classic-bordered' | 'minimal-professional';
export type IdCardTemplateSettingType = 'modern-tech' | 'classic-academic' | 'vertical-badge';
export type FeeChallanTemplateType = 'standard-3copy' | 'compact-2copy' | 'minimal-professional';
export type StudentFeeCardTemplateType = 'classic-ledger' | 'minimal-modern' | 'minimal-professional' | 'register-card';
export type StaffSalarySlipTemplateType = 'executive-emerald' | 'minimal-classic' | 'minimal-professional';
export type ExamDmcTemplateType = 'official-crest' | 'minimal-classic' | 'minimal-professional';
export type AttendanceRegisterTemplateType = 'official-weekly' | 'compact-monochrome' | 'minimal-professional';

export interface SchoolSettings {
  // 1. School Profile & Branding
  schoolName: string;
  schoolTagline: string;
  schoolLogo: string; // Base64 data URL, image URL, or preset SVG
  campusName: string;
  schoolPhone: string;
  schoolEmail: string;
  schoolWebsite: string;
  schoolAddress: string;
  session: string;
  principalName: string;
  registrationNumber: string;

  // 2. Bank & Account Details
  bankName: string;
  accountNumber: string;
  accountTitle: string;
  branchName: string;
  branchCode: string;
  iban: string;

  // 3. Challan & Fee Rules
  challanDueDay: number; // e.g. 10th of each month
  lateFineAmount: number; // e.g. 500 PKR

  // 4. Document Templates (Reflected system-wide)
  rollNumberSlipTemplate?: RollNumberSlipTemplateType;
  studentIdCardTemplate?: IdCardTemplateSettingType;
  staffIdCardTemplate?: IdCardTemplateSettingType;
  feeChallanTemplate?: FeeChallanTemplateType;
  studentFeeCardTemplate?: StudentFeeCardTemplateType;
  staffSalarySlipTemplate?: StaffSalarySlipTemplateType;
  examDmcTemplate?: ExamDmcTemplateType;
  attendanceRegisterTemplate?: AttendanceRegisterTemplateType;
}

export type SchoolBankSettings = SchoolSettings;

export const PAKISTANI_BANKS = [
  'Meezan Bank',
  'Habib Bank Limited (HBL)',
  'United Bank Limited (UBL)',
  'MCB Bank Limited',
  'Allied Bank Limited (ABL)',
  'Bank Alfalah',
  'Askari Bank',
  'Faysal Bank',
  'National Bank of Pakistan (NBP)',
  'Standard Chartered Bank Pakistan',
  'The Bank of Punjab (BOP)',
  'BankIslami Pakistan',
  'Dubai Islamic Bank',
  'Soneri Bank',
  'JS Bank',
  'Al Baraka Bank Pakistan',
  'Silkbank Limited',
  'Summit Bank',
  'Custom / Other Bank'
];

export const SETTINGS_STORAGE_KEY = 'schoollee_school_settings_v2';
export const LEGACY_STORAGE_KEY = 'schoollee_school_settings_v1';

// Beautiful built-in SVG school badges/crests presets
export const PRESET_SCHOOL_LOGOS = [
  {
    id: 'preset-crest-blue',
    name: 'Academic Shield (Royal Blue)',
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%231e40af"/><stop offset="100%" stop-color="%230f172a"/></linearGradient><linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%23fbbf24"/><stop offset="100%" stop-color="%23d97706"/></linearGradient></defs><path d="M50 8 C25 8 16 16 16 38 C16 68 50 92 50 92 C50 92 84 68 84 38 C84 16 75 8 50 8 Z" fill="url(%23bg)" stroke="url(%23gold)" stroke-width="3"/><path d="M50 16 C30 16 23 23 23 40 C23 64 50 84 50 84 C50 84 77 64 77 40 C77 23 70 16 50 16 Z" fill="none" stroke="url(%23gold)" stroke-width="1" opacity="0.6"/><path d="M50 32 L40 40 L40 56 C40 60 50 66 50 66 C50 66 60 60 60 56 L60 40 Z" fill="none" stroke="url(%23gold)" stroke-width="2.5"/><circle cx="50" cy="46" r="3.5" fill="%23fbbf24"/><path d="M35 62 Q50 69 65 62" fill="none" stroke="url(%23gold)" stroke-width="2"/><polygon points="50,22 53,28 59,29 55,33 56,39 50,36 44,39 45,33 41,29 47,28" fill="%23fbbf24"/></svg>`
  },
  {
    id: 'preset-crest-gold',
    name: 'Excellence Laurel (Gold & Emerald)',
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><defs><linearGradient id="bg-green" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%23065f46"/><stop offset="100%" stop-color="%23022c22"/></linearGradient><linearGradient id="gold2" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%23fef08a"/><stop offset="100%" stop-color="%23eab308"/></linearGradient></defs><circle cx="50" cy="50" r="44" fill="url(%23bg-green)" stroke="url(%23gold2)" stroke-width="3"/><circle cx="50" cy="50" r="38" fill="none" stroke="url(%23gold2)" stroke-width="1.2" stroke-dasharray="2 2"/><path d="M36 58 L50 48 L64 58 L50 64 Z" fill="url(%23gold2)"/><polygon points="50,30 52,35 57,36 53,40 54,45 50,42 46,45 47,40 43,36 48,35" fill="url(%23gold2)"/><path d="M32 45 C30 35 38 28 50 28 C62 28 70 35 68 45" fill="none" stroke="url(%23gold2)" stroke-width="2" stroke-linecap="round"/><path d="M30 65 Q50 78 70 65" fill="none" stroke="url(%23gold2)" stroke-width="2.5" stroke-linecap="round"/></svg>`
  },
  {
    id: 'preset-crest-cyan',
    name: 'Modern Torch (Cyan & Navy)',
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><defs><linearGradient id="bg-cyan" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%230369a1"/><stop offset="100%" stop-color="%23082f49"/></linearGradient><linearGradient id="cyan-glow" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%2338bdf8"/><stop offset="100%" stop-color="%230284c7"/></linearGradient></defs><rect x="10" y="10" width="80" height="80" rx="20" fill="url(%23bg-cyan)" stroke="url(%23cyan-glow)" stroke-width="3"/><path d="M47 30 C47 25 53 20 50 16 C55 24 57 28 53 32 C55 30 57 32 55 35 C52 38 48 38 47 30 Z" fill="%23f97316"/><path d="M45 35 L55 35 L53 45 L47 45 Z" fill="%23e2e8f0"/><path d="M48 45 L52 45 L51 72 L49 72 Z" fill="%2394a3b8"/><path d="M30 60 C38 68 44 70 50 70 C56 70 62 68 70 60" fill="none" stroke="%2338bdf8" stroke-width="2.5" stroke-linecap="round"/><circle cx="50" cy="52" r="3" fill="%2338bdf8"/></svg>`
  },
  {
    id: 'preset-crest-crimson',
    name: 'Crown Academy (Ruby & Bronze)',
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><defs><linearGradient id="bg-ruby" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%23991b1b"/><stop offset="100%" stop-color="%23450a0a"/></linearGradient><linearGradient id="bronze" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%23fde047"/><stop offset="100%" stop-color="%23ca8a04"/></linearGradient></defs><path d="M50 10 L82 24 L82 52 C82 72 50 90 50 90 C50 90 18 72 18 52 L18 24 Z" fill="url(%23bg-ruby)" stroke="url(%23bronze)" stroke-width="3"/><polygon points="34,44 42,34 50,42 58,34 66,44 64,52 36,52" fill="url(%23bronze)"/><circle cx="34" cy="42" r="2" fill="%23ffffff"/><circle cx="42" cy="32" r="2" fill="%23ffffff"/><circle cx="50" cy="40" r="2.5" fill="%23ffffff"/><circle cx="58" cy="32" r="2" fill="%23ffffff"/><circle cx="66" cy="42" r="2" fill="%23ffffff"/><path d="M32 64 C42 70 58 70 68 64" fill="none" stroke="url(%23bronze)" stroke-width="2" stroke-linecap="round"/></svg>`
  }
];

export const DEFAULT_SCHOOL_SETTINGS: SchoolSettings = {
  // School Identity — intentionally BLANK. A fresh install must never print
  // a fake school's name, contact details or bank account on documents;
  // the school fills in its own identity in Settings → School Profile.
  schoolName: '',
  schoolTagline: 'Excellence in Education & Character Building',
  schoolLogo: PRESET_SCHOOL_LOGOS[0].svg,
  campusName: '',
  schoolPhone: '',
  schoolEmail: '',
  schoolWebsite: '',
  schoolAddress: '',
  session: '2026 - 2027',
  principalName: '',
  registrationNumber: '',

  // Bank & Account Details — blank until the school enters its own account;
  // documents omit the bank block entirely while these are empty.
  bankName: '',
  accountNumber: '',
  accountTitle: '',
  branchName: '',
  branchCode: '',
  iban: '',

  // Challan Rules
  challanDueDay: 10,
  lateFineAmount: 500,

  // Active Templates (Default)
  rollNumberSlipTemplate: 'minimal-stream',
  studentIdCardTemplate: 'modern-tech',
  staffIdCardTemplate: 'modern-tech',
  feeChallanTemplate: 'standard-3copy',
  studentFeeCardTemplate: 'register-card',
  staffSalarySlipTemplate: 'executive-emerald',
  examDmcTemplate: 'official-crest',
  attendanceRegisterTemplate: 'official-weekly'
};

export const DEFAULT_BANK_SETTINGS = DEFAULT_SCHOOL_SETTINGS;

const isSettingsObj = (v: unknown): v is Partial<SchoolSettings> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export function getSchoolSettings(): SchoolSettings {
  const saved = loadJSON<Partial<SchoolSettings> | null>(SETTINGS_STORAGE_KEY, null, isSettingsObj);
  if (saved) {
    return { ...DEFAULT_SCHOOL_SETTINGS, ...saved };
  }
  const legacy = loadJSON<Partial<SchoolSettings> | null>(LEGACY_STORAGE_KEY, null, isSettingsObj);
  if (legacy) {
    return { ...DEFAULT_SCHOOL_SETTINGS, ...legacy };
  }
  return DEFAULT_SCHOOL_SETTINGS;
}

export function saveSchoolSettings(settings: SchoolSettings): void {
  if (saveJSON(SETTINGS_STORAGE_KEY, settings)) {
    saveJSON(LEGACY_STORAGE_KEY, settings);
    window.dispatchEvent(new CustomEvent('schoolSettingsUpdated', { detail: settings }));
  }
}

// Backwards compatibility aliases
export const getBankSettings = getSchoolSettings;
export const saveBankSettings = saveSchoolSettings;

/**
 * Compresses and resizes an uploaded image file to an optimized Base64 data URL
 * to avoid exceeding localStorage quota while preserving high clarity.
 */
export async function compressImageFileToDataUrl(file: File, maxDimension = 512): Promise<string> {
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('Image size must be under 10 MB');
  }
  const { resizeImageToDataURL } = await import('./image');
  return resizeImageToDataURL(file, maxDimension, 0.9, 'image/png');
}


