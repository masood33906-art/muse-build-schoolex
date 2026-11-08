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
