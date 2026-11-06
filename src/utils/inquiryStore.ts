import { DEMO, loadJSON, saveJSON } from './storage';

export interface StudentInquiry {
  id: string;
  applicantName: string;
  gender: 'Male' | 'Female';
  guardianName: string;
  guardianPhone: string;
  email?: string;
  appliedClass: string;
  date: string;
  rawDate: string;
  status: 'Pending Review' | 'Interview Scheduled' | 'Approved' | 'Waitlisted' | 'Rejected';
  priority: 'High' | 'Normal';
  testScore?: number;
  notes?: string;
}

export const INQUIRIES_STORAGE_KEY = 'schooliee_student_inquiries_clean_v1';

export const INITIAL_INQUIRIES: StudentInquiry[] = [];

export const ARCHIVED_INITIAL_INQUIRIES: StudentInquiry[] = [
  {
    id: 'INQ-2026-001',
    applicantName: 'Zainab Fatima',
    gender: 'Female',
    guardianName: 'Tariq Mehmood',
    guardianPhone: '+92 300 9876541',
    email: 'tariq.m@example.com',
    appliedClass: 'Class 6',
    date: '14 Sep 2026',
    rawDate: '2026-09-14',
    status: 'Pending Review',
    priority: 'High',
    notes: 'Transfer from Beaconhouse. Awaiting entrance evaluation.'
  },
  {
    id: 'INQ-2026-002',
    applicantName: 'Muhammad Rehan',
    gender: 'Male',
    guardianName: 'Dr. Rehan Ashraf',
    guardianPhone: '+92 321 4567890',
    email: 'dr.rehan@example.com',
    appliedClass: 'Class 9',
    date: '13 Sep 2026',
    rawDate: '2026-09-13',
    status: 'Interview Scheduled',
    priority: 'Normal',
    testScore: 84,
    notes: 'Passed entrance test with 84%. Principal interview on Monday.'
  },
  {
    id: 'INQ-2026-003',
    applicantName: 'Ayla Khurram',
    gender: 'Female',
    guardianName: 'Khurram Shahzad',
    guardianPhone: '+92 333 5551234',
    email: 'khurram.s@example.com',
    appliedClass: 'Prep',
    date: '12 Sep 2026',
    rawDate: '2026-09-12',
    status: 'Approved',
    priority: 'High',
    testScore: 92,
    notes: 'Document verification completed. Fee challan issued.'
  },
  {
    id: 'INQ-2026-004',
    applicantName: 'Shahmeer Khan',
    gender: 'Male',
    guardianName: 'Nasir Khan',
    guardianPhone: '+92 301 8889900',
    email: 'nasir.khan@example.com',
    appliedClass: 'Class 1',
    date: '10 Sep 2026',
    rawDate: '2026-09-10',
    status: 'Pending Review',
    priority: 'Normal',
    notes: 'Sibling discount requested. Sibling already in Class 4.'
  },
  {
    id: 'INQ-2026-005',
    applicantName: 'Hafsa Naveed',
    gender: 'Female',
    guardianName: 'Naveed Akhtar',
    guardianPhone: '+92 315 2223344',
    email: 'naveed.a@example.com',
    appliedClass: 'Class 8',
    date: '08 Sep 2026',
    rawDate: '2026-09-08',
    status: 'Waitlisted',
    priority: 'Normal',
    testScore: 68,
    notes: 'Class 8 is currently at maximum capacity. Added to waiting queue.'
  }
];

export function getStoredInquiries(): StudentInquiry[] {
  return loadJSON<StudentInquiry[]>(
    INQUIRIES_STORAGE_KEY,
    DEMO ? INITIAL_INQUIRIES : [],
    Array.isArray as (v: unknown) => v is StudentInquiry[]
  );
}

export function saveStoredInquiries(inquiries: StudentInquiry[]): void {
  saveJSON(INQUIRIES_STORAGE_KEY, inquiries);
}

export function addInquiry(inquiry: Omit<StudentInquiry, 'id' | 'date' | 'rawDate'>): StudentInquiry {
  const current = getStoredInquiries();
  const today = new Date();
  const rawDate = today.toISOString().slice(0, 10);
  const date = today.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const id = `INQ-${today.getFullYear()}-${String(current.length + 1).padStart(3, '0')}`;
  
  const newInquiry: StudentInquiry = {
    ...inquiry,
    id,
    date,
    rawDate
  };

  const updated = [newInquiry, ...current];
  saveStoredInquiries(updated);
  return newInquiry;
}

export function updateInquiryStatus(id: string, status: StudentInquiry['status']): StudentInquiry[] {
  const current = getStoredInquiries();
  const updated = current.map(item => item.id === id ? { ...item, status } : item);
  saveStoredInquiries(updated);
  return updated;
}
