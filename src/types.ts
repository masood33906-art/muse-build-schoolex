export type StudentStatus = 'Active' | 'Inactive';

export interface Student {
  id: string; // e.g. 'S-00101'
  name: string;
  family: string; // Guardian / Father name e.g. 'gulzar'
  familyId: string; // e.g. 'F-0080'
  rollNo?: string;
  fatherName?: string;
  class: string; // e.g. 'Class 6', 'Prep', 'Class 2'
  // Stable id of the ClassInfo record this student belongs to (Fix P0-3).
  // Optional only for legacy tolerance: records saved before the classId
  // migration may not carry it; those are matched by class NAME (see
  // studentBelongsToClass in utils/classExportHelper.ts) and are backfilled
  // with the id at the App level whenever their class name matches a class.
  // Matching prefers classId whenever it is present, so renaming a class can
  // no longer orphan its students.
  classId?: string;
  section: string; // e.g. 'A', 'B'
  status: StudentStatus;
  avatarColor?: string;
  photo?: string; // Optional custom DP (Base64 data URL)
  gender?: 'Male' | 'Female' | 'Other';
  bloodGroup?: string; // e.g. 'A+', 'B+', 'O+', 'AB+'
  phone?: string;
  emergencyContact?: string;
  admissionDate?: string;
  isNewAdmission?: boolean;
  cnic?: string;
  dob?: string;
  religion?: string;
  discount?: string;
  admissionFee?: string | number;
  classFee?: string | number;
  previousSchool?: string;
  previousClass?: string;
  previousResult?: string;
  reference?: string;
  note?: string;
  guardianCnic?: string;
  guardianOccupation?: string;
  motherName?: string;
  motherCnic?: string;
  motherOccupation?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  caste?: string;
  totalDue?: number;
  totalPaid?: number;
  finesList?: { id: string; title: string; amount: number; date: string; status: 'Paid' | 'Unpaid' }[];
  documentsList?: { id: string; title: string; type: string; date: string }[];
  observationsList?: { id: string; note: string; author: string; date: string }[];
  achievementsList?: { id: string; title: string; date: string; category: string }[];
}

export type CardTemplateType = 'modern-tech' | 'classic-academic' | 'vertical-badge';

export type FilterStatus = 'All' | 'Active' | 'Inactive' | 'New Admission';

export interface FilterState {
  class: string;
  search: string;
  status: FilterStatus;
}

export type ActiveTab = 'students' | 'families';

export interface FamilyData {
  familyId: string;
  familyName: string;
  phone?: string;
  guardianCnic?: string;
  guardianOccupation?: string;
  motherName?: string;
  motherCnic?: string;
  motherOccupation?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  caste?: string;
  religion?: string;
  emergencyContact?: string;
  notes?: string;
  students: Student[];
  totalDue?: number;
  totalPaid?: number;
}

// ================= Staff Module Types =================
export type StaffCategory = 'Teacher' | 'Admin' | 'Support' | 'Operations' | 'Finance';
export type StaffStatus = 'Active' | 'On Leave' | 'Inactive' | 'Terminated';
export type PayStatus = 'Paid' | 'Pending' | 'Overdue';

export interface StaffDocument {
  id: string;
  title: string;
  type: string;
  fileName: string;
  fileSize?: string;
  uploadedAt: string;
  fileId?: string;
  fileData?: string; // base64 or preview
}

export interface StaffActivity {
  id: string;
  note: string;
  date: string;
  author: string;
  type?: string;
}

export interface StaffTransaction {
  id: string;
  createdBy: string;
  amount: number;
  reason: string;
  payment: string; // 'Cash', 'Bank Transfer', 'Online'
  type: string; // 'Salary', 'Loan', 'Repayment', 'Bonus', 'Allowance'
  document?: string;
  createdAt: string;
}

export interface StaffMember {
  id: string; // e.g. 'STF-0012'
  name: string;
  cnic?: string; // CNIC e.g. 35202-1234567-1
  fatherName?: string;
  role: string; // e.g. 'otherStaff', 'Accountant', 'teacher', 'Teacher'
  category: StaffCategory;
  department: string; // 'Academics', 'Administration', 'Finance', 'IT & Labs', 'Operations & Support'
  qualification: string; // e.g. 'M.Sc. Mathematics', 'Ph.D.', 'M.Com'
  salary: number; // Base monthly salary
  payStatus: PayStatus;
  lastPaidDate?: string;
  paymentMethod?: PaymentMethod;
  status: StaffStatus;
  phone: string;
  whatsapp?: string;
  email: string;
  joiningDate: string;
  photo?: string; // Base64 data URL
  avatarColor?: string;
  gender?: 'Male' | 'Female' | 'Other';
  bloodGroup?: string;
  emergencyContact?: string;
  address?: string;
  bankAccount?: string;
  notes?: string;
  loanBalance?: number;
  paidMonths?: string[]; // List of accrued salary months already disbursed e.g. ['August 2026', 'September 2026']
  documents?: StaffDocument[];
  activities?: StaffActivity[];
  transactions?: StaffTransaction[];
}

export interface StaffFilterState {
  department: string;
  category: string;
  search: string;
  status: 'All' | StaffStatus | PayStatus;
}

export interface SalaryBreakdown {
  baseSalary: number;
  allowances: number;
  deductions: number;
  netSalary: number;
  bonus?: number;
  month: string;
  paymentMethod: PaymentMethod;
  paidDate: string;
  referenceNo: string;
  notes?: string;
}

export interface ClassTimelineEvent {
  id: string;
  type: 'class_created' | 'session_started' | 'fee_changed' | 'section_upgraded';
  title: string;
  description: string;
  date: string;
  badgeDate: string;
  time?: string;
  fee: number;
  author?: string;
}

export interface ClassInfo {
  id: string;
  name: string;
  sectionsCount: number;
  sections: string[];
  /** @deprecated Legacy stored counter (Fix P0-1): it was written once at class
   * creation and never updated, so exports that read it were permanently stale.
   * Never read this field — compute enrollment live from the students array with
   * `countStudentsInClass` (src/utils/classExportHelper.ts). Kept optional only
   * so previously saved/seed class records still parse. */
  studentsCount?: number;
  fee?: number;
  createdAt?: string;
  latestSession?: string;
  timeline?: ClassTimelineEvent[];
}

// ================= Attendance Types =================
export type AttendanceStatus = 'present' | 'late' | 'absent' | 'leave' | 'not_marked';

export interface AttendanceRecord {
  id: string; // student or staff id
  name: string;
  type: 'student' | 'staff';
  date: string; // 'YYYY-MM-DD'
  status: AttendanceStatus;
  checkInTime?: string; // e.g. '15:44'
  remarks?: string;
  class?: string;
  section?: string;
  department?: string;
  role?: string;
  isManual?: boolean;
}

export interface HolidayRecord {
  id: string;
  date: string; // 'YYYY-MM-DD'
  reason: string;
  applyTo: 'both' | 'student' | 'staff';
  class?: string; // 'all' or class name
  section?: string; // 'all' or section name
  createdAt?: string;
}

// ================= Payment Method Types =================
export type PaymentMethod = 'Cash' | 'Bank Transfer' | 'Online' | 'JazzCash' | 'EasyPaisa' | 'Cheque';
export const normalizeMethod = (label: string): PaymentMethod =>
  label === 'Online Transfer' ? 'Online' : label === 'Bank Deposit' ? 'Bank Transfer' : (label as PaymentMethod);


