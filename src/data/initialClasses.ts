import { ClassInfo, ClassTimelineEvent } from '../types';

const CLASS_2_TIMELINE: ClassTimelineEvent[] = [
  {
    id: 'TL-1',
    type: 'session_started',
    title: 'Session started',
    description: 'Session created by Admin',
    date: '08 Oct 2025',
    badgeDate: '08 Oct',
    time: '09:30 AM',
    fee: 3000,
    author: 'Admin'
  },
  {
    id: 'TL-2',
    type: 'class_created',
    title: 'Class "Class 2" created',
    description: 'Created by Admin',
    date: '08 Apr 2026',
    badgeDate: '08 Apr',
    time: '11:15 AM',
    fee: 3000,
    author: 'Admin'
  },
  {
    id: 'TL-3',
    type: 'session_started',
    title: 'Session started',
    description: 'Session created by Demo school',
    date: '24 Jul 2026',
    badgeDate: '24 Jul',
    time: '02:45 PM',
    fee: 3000,
    author: 'Demo school'
  },
  {
    id: 'TL-4',
    type: 'fee_changed',
    title: 'Fee changed to 4800',
    description: 'Effective from 01 Aug 2026',
    date: '01 Aug 2026',
    badgeDate: '01 Aug',
    time: '04:20 PM',
    fee: 4800
  },
  {
    id: 'TL-5',
    type: 'fee_changed',
    title: 'Fee changed to 4800',
    description: 'Effective from 12 Aug 2026',
    date: '12 Aug 2026',
    badgeDate: '12 Aug',
    time: '04:52 PM',
    fee: 4800
  }
];

export const INITIAL_CLASSES: ClassInfo[] = [];

export const ARCHIVED_INITIAL_CLASSES: ClassInfo[] = [
  {
    id: 'CLS-001',
    name: 'Class 2',
    sectionsCount: 1,
    sections: ['A'],
    studentsCount: 7,
    fee: 4800,
    createdAt: '08 Apr 2026',
    latestSession: 'Jul 2026',
    timeline: CLASS_2_TIMELINE
  },
  {
    id: 'CLS-002',
    name: 'Prep',
    sectionsCount: 1,
    sections: ['A'],
    studentsCount: 16,
    fee: 4200,
    createdAt: '08 Apr 2026',
    latestSession: 'Jul 2026',
    timeline: [
      {
        id: 'TL-P1',
        type: 'class_created',
        title: 'Class "Prep" created',
        description: 'Created by Admin',
        date: '08 Apr 2026',
        badgeDate: '08 Apr',
        fee: 4200,
        author: 'Admin'
      },
      {
        id: 'TL-P2',
        type: 'session_started',
        title: 'Session started',
        description: 'Session created by Demo school',
        date: '24 Jul 2026',
        badgeDate: '24 Jul',
        fee: 4200,
        author: 'Demo school'
      }
    ]
  },
  {
    id: 'CLS-003',
    name: 'Class 1',
    sectionsCount: 1,
    sections: ['A'],
    studentsCount: 2,
    fee: 4500,
    createdAt: '08 Apr 2026',
    latestSession: 'Jul 2026'
  },
  {
    id: 'CLS-004',
    name: 'Nursery',
    sectionsCount: 1,
    sections: ['A'],
    studentsCount: 8,
    fee: 4000,
    createdAt: '08 Apr 2026',
    latestSession: 'Jul 2026'
  },
  {
    id: 'CLS-005',
    name: 'Class 3',
    sectionsCount: 2,
    sections: ['A', 'B'],
    studentsCount: 17,
    fee: 5000,
    createdAt: '08 Apr 2026',
    latestSession: 'Jul 2026'
  },
  {
    id: 'CLS-006',
    name: 'Class 4',
    sectionsCount: 2,
    sections: ['A', 'B'],
    studentsCount: 5,
    fee: 5200,
    createdAt: '08 Apr 2026',
    latestSession: 'Jul 2026'
  },
  {
    id: 'CLS-007',
    name: 'Class 5',
    sectionsCount: 2,
    sections: ['A', 'B'],
    studentsCount: 7,
    fee: 5500,
    createdAt: '08 Apr 2026',
    latestSession: 'Jul 2026'
  },
  {
    id: 'CLS-008',
    name: 'Class 6',
    sectionsCount: 1,
    sections: ['A'],
    studentsCount: 9,
    fee: 5800,
    createdAt: '08 Apr 2026',
    latestSession: 'Jul 2026'
  },
  {
    id: 'CLS-009',
    name: 'Class 7',
    sectionsCount: 1,
    sections: ['A'],
    studentsCount: 11,
    fee: 6000,
    createdAt: '08 Apr 2026',
    latestSession: 'Jul 2026'
  },
  {
    id: 'CLS-010',
    name: 'Class 8',
    sectionsCount: 1,
    sections: ['A'],
    studentsCount: 14,
    fee: 6500,
    createdAt: '08 Apr 2026',
    latestSession: 'Jul 2026'
  },
  {
    id: 'CLS-011',
    name: 'Class 9',
    sectionsCount: 2,
    sections: ['A', 'B'],
    studentsCount: 12,
    fee: 7000,
    createdAt: '08 Apr 2026',
    latestSession: 'Jul 2026'
  },
  {
    id: 'CLS-012',
    name: 'Class 10',
    sectionsCount: 2,
    sections: ['A', 'B'],
    studentsCount: 10,
    fee: 7500,
    createdAt: '08 Apr 2026',
    latestSession: 'Jul 2026'
  },
  {
    id: 'CLS-013',
    name: 'Playgroup',
    sectionsCount: 1,
    sections: ['A'],
    studentsCount: 6,
    fee: 3800,
    createdAt: '08 Apr 2026',
    latestSession: 'Jul 2026'
  },
  {
    id: 'CLS-014',
    name: 'KG 1',
    sectionsCount: 1,
    sections: ['A'],
    studentsCount: 8,
    fee: 4000,
    createdAt: '08 Apr 2026',
    latestSession: 'Jul 2026'
  },
  {
    id: 'CLS-015',
    name: 'KG 2',
    sectionsCount: 1,
    sections: ['A'],
    studentsCount: 7,
    fee: 4200,
    createdAt: '08 Apr 2026',
    latestSession: 'Jul 2026'
  },
  {
    id: 'CLS-016',
    name: 'Class 11 Science',
    sectionsCount: 1,
    sections: ['A'],
    studentsCount: 8,
    fee: 8500,
    createdAt: '08 Apr 2026',
    latestSession: 'Jul 2026'
  },
  {
    id: 'CLS-017',
    name: 'Class 11 Commerce',
    sectionsCount: 1,
    sections: ['A'],
    studentsCount: 6,
    fee: 8000,
    createdAt: '08 Apr 2026',
    latestSession: 'Jul 2026'
  },
  {
    id: 'CLS-018',
    name: 'Class 12 Science',
    sectionsCount: 1,
    sections: ['A'],
    studentsCount: 7,
    fee: 9000,
    createdAt: '08 Apr 2026',
    latestSession: 'Jul 2026'
  },
  {
    id: 'CLS-019',
    name: 'Class 12 Commerce',
    sectionsCount: 1,
    sections: ['A'],
    studentsCount: 5,
    fee: 8500,
    createdAt: '08 Apr 2026',
    latestSession: 'Jul 2026'
  }
];
