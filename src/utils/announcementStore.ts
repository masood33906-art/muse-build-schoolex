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
