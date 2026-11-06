import { DEMO, loadJSON, saveJSON } from './storage';

export interface Announcement {
  id: string;
  title: string;
  audience: 'All' | 'Parents' | 'Staff' | 'Students';
  priority: 'Urgent' | 'High' | 'Normal';
  date: string;
  rawDate: string;
  content: string;
  author: string;
  channels: ('WhatsApp' | 'SMS' | 'Mobile App')[];
}

export const ANNOUNCEMENTS_STORAGE_KEY = 'schooliee_announcements_clean_v1';

export const INITIAL_ANNOUNCEMENTS: Announcement[] = [];

export const ARCHIVED_INITIAL_ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'ANN-2026-001',
    title: 'Mid-Term Examination Schedule Announced',
    audience: 'All',
    priority: 'High',
    date: '15 Sep 2026',
    rawDate: '2026-09-15',
    content: 'Mid-term examinations for classes Prep through 10 will commence from September 28. Timetables have been distributed to all section mentors.',
    author: 'Principal Office',
    channels: ['WhatsApp', 'Mobile App', 'SMS']
  },
  {
    id: 'ANN-2026-002',
    title: 'Parent-Teacher Conference - Saturday 9:00 AM',
    audience: 'Parents',
    priority: 'Normal',
    date: '12 Sep 2026',
    rawDate: '2026-09-12',
    content: 'All guardians are warmly invited to attend the bi-monthly progress evaluation meeting to review academic records and biometric attendance.',
    author: 'Academic Coordinator',
    channels: ['WhatsApp', 'Mobile App']
  },
  {
    id: 'ANN-2026-003',
    title: 'Faculty Training on Digital Attendance & Grading',
    audience: 'Staff',
    priority: 'Normal',
    date: '10 Sep 2026',
    rawDate: '2026-09-10',
    content: 'Mandatory workshop for all primary and secondary teaching staff in the computer laboratory regarding automated mark entry.',
    author: 'IT Department',
    channels: ['Mobile App']
  }
];

export function getStoredAnnouncements(): Announcement[] {
  return loadJSON<Announcement[]>(
    ANNOUNCEMENTS_STORAGE_KEY,
    DEMO ? INITIAL_ANNOUNCEMENTS : [],
    Array.isArray as (v: unknown) => v is Announcement[]
  );
}

export function saveStoredAnnouncements(announcements: Announcement[]): void {
  saveJSON(ANNOUNCEMENTS_STORAGE_KEY, announcements);
}

export function addAnnouncement(announcement: Omit<Announcement, 'id' | 'date' | 'rawDate'>): Announcement {
  const current = getStoredAnnouncements();
  const today = new Date();
  const rawDate = today.toISOString().slice(0, 10);
  const date = today.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const id = `ANN-${today.getFullYear()}-${String(current.length + 1).padStart(3, '0')}`;
  
  const newAnnouncement: Announcement = {
    ...announcement,
    id,
    date,
    rawDate
  };

  const updated = [newAnnouncement, ...current];
  saveStoredAnnouncements(updated);
  return newAnnouncement;
}
