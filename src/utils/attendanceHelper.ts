import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Student, StaffMember, AttendanceRecord, AttendanceStatus } from '../types';
import { DEFAULT_SCHOOL, SchoolInfo, joinInfoParts } from './pdfGenerator';
import { getSchoolSettings } from './settingsHelper';
import { loadJSON } from './storage';

export const ATTENDANCE_STORAGE_KEY = 'schooliee_attendance_records_clean_v1';
export const LAST_ATTENDANCE_DATE_KEY = 'schooliee_last_attendance_date_clean_v1';

export interface WeekDayInfo {
  date: string; // 'YYYY-MM-DD'
  dayName: string; // 'Mon', 'Tue', etc.
  displayDate: string; // '07 Sep'
  shortDay: string; // 'Mon (07)'
}

export interface MemberWeeklySummary {
  id: string;
  name: string;
  secondaryInfo: string; // Father name for student, Role for staff
  groupInfo: string; // Class & Sec or Department
  type: 'student' | 'staff';
  dailyStatuses: Record<string, { status: AttendanceStatus; code: string; checkIn?: string }>;
  totalPresent: number;
  totalLate: number;
  totalAbsent: number;
  totalLeave: number;
  totalMarked: number;
  attendanceRate: number; // percentage 0-100
}

export interface WeeklyOverallTotals {
  dayTotals: Record<string, { present: number; late: number; absent: number; leave: number }>;
  grandPresent: number;
  grandLate: number;
  grandAbsent: number;
  grandLeave: number;
  grandMarked: number;
  averageRate: number;
}

// Get the 7 days (Mon to Sun) of the week containing dateStr
export function getWeekDays(dateStr: string): WeekDayInfo[] {
  let year = 2026;
  let month = 9;
  let day = 13;

  try {
    const parts = dateStr.split('-').map(Number);
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      year = parts[0];
      month = parts[1];
      day = parts[2];
    }
  } catch {
    // fallback
  }

  const targetDate = new Date(year, month - 1, day);
  const dayOfWeek = targetDate.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const monday = new Date(year, month - 1, day + diffToMonday);
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const days: WeekDayInfo[] = [];

  for (let i = 0; i < 7; i++) {
    const current = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, '0');
    const d = String(current.getDate()).padStart(2, '0');
    const dateKey = `${y}-${m}-${d}`;
    const dayName = dayNames[i];
    const displayDate = `${d} ${monthNames[current.getMonth()]}`;
    const shortDay = `${dayName} (${d})`;

    days.push({
      date: dateKey,
      dayName,
      displayDate,
      shortDay
    });
  }

  return days;
}

export function loadAttendance(): Record<string, AttendanceRecord[]> {
  return loadJSON<Record<string, AttendanceRecord[]>>(
    ATTENDANCE_STORAGE_KEY, {}, (v): v is Record<string, AttendanceRecord[]> => typeof v === 'object' && v !== null && !Array.isArray(v));
}

// Convert status to code character
export function getStatusCode(status: AttendanceStatus): string {
  switch (status) {
    case 'present': return 'P';
    case 'late': return 'L';
    case 'absent': return 'A';
    case 'leave': return 'Lv';
    default: return '-';
  }
}

// Calculate weekly summary for an entity list
export function calculateWeeklyAttendance(
  entities: (Student | StaffMember)[],
  entityType: 'student' | 'staff',
  weekDays: WeekDayInfo[],
  allAttendance: Record<string, AttendanceRecord[]>
): { memberSummaries: MemberWeeklySummary[]; totals: WeeklyOverallTotals } {
  const dayTotals: Record<string, { present: number; late: number; absent: number; leave: number }> = {};
  weekDays.forEach(d => {
    dayTotals[d.date] = { present: 0, late: 0, absent: 0, leave: 0 };
  });

  let grandPresent = 0;
  let grandLate = 0;
  let grandAbsent = 0;
  let grandLeave = 0;

  const memberSummaries: MemberWeeklySummary[] = entities.map(entity => {
    const isStudent = entityType === 'student';
    const s = entity as Student;
    const st = entity as StaffMember;

    const id = entity.id;
    const name = entity.name;
    const secondaryInfo = isStudent ? (s.family || '-') : st.role;
    const groupInfo = isStudent ? `${s.class || ''} (${s.section || ''})` : st.department;

    const dailyStatuses: Record<string, { status: AttendanceStatus; code: string; checkIn?: string }> = {};
    let totalPresent = 0;
    let totalLate = 0;
    let totalAbsent = 0;
    let totalLeave = 0;

    weekDays.forEach(d => {
      const records = allAttendance[d.date] || [];
      const rec = records.find(r => r.id === id);
      const status: AttendanceStatus = rec?.status || 'not_marked';
      const code = getStatusCode(status);

      dailyStatuses[d.date] = {
        status,
        code,
        checkIn: rec?.checkInTime
      };

      if (status === 'present') {
        totalPresent++;
        dayTotals[d.date].present++;
        grandPresent++;
      } else if (status === 'late') {
        totalLate++;
        dayTotals[d.date].late++;
        grandLate++;
      } else if (status === 'absent') {
        totalAbsent++;
        dayTotals[d.date].absent++;
        grandAbsent++;
      } else if (status === 'leave') {
        totalLeave++;
        dayTotals[d.date].leave++;
        grandLeave++;
      }
    });

    const totalMarked = totalPresent + totalLate + totalAbsent + totalLeave;
    const rate = totalMarked > 0 ? Math.round(((totalPresent + totalLate) / totalMarked) * 100) : 0;

    return {
      id,
      name,
      secondaryInfo,
      groupInfo,
      type: entityType,
      dailyStatuses,
      totalPresent,
      totalLate,
      totalAbsent,
      totalLeave,
      totalMarked,
      attendanceRate: rate
    };
  });

  const grandMarked = grandPresent + grandLate + grandAbsent + grandLeave;
  const averageRate = grandMarked > 0 ? Math.round(((grandPresent + grandLate) / grandMarked) * 100) : 0;

  return {
    memberSummaries,
    totals: {
      dayTotals,
      grandPresent,
      grandLate,
      grandAbsent,
      grandLeave,
      grandMarked,
      averageRate
    }
  };
}

// Export today's attendance to CSV format
export function exportAttendanceToCSV(
  date: string,
  records: AttendanceRecord[],
  filename = `attendance_today_${date}.csv`
) {
  const headers = [
    'Record Type',
    'Member ID',
    'Full Name',
    'Class / Department',
    'Section / Role',
    'Date',
    'Attendance Status',
    'Check-in Time',
    'Remarks'
  ];

  const escapeCell = (val: string | number | undefined | null) => {
    if (val === undefined || val === null) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = records.map((r) => [
    escapeCell(r.type === 'student' ? 'Student' : 'Staff'),
    escapeCell(r.id),
    escapeCell(r.name),
    escapeCell(r.class || r.department || ''),
    escapeCell(r.section || r.role || ''),
    escapeCell(r.date),
    escapeCell(r.status.toUpperCase().replace('_', ' ')),
    escapeCell(r.checkInTime || '-'),
    escapeCell(r.remarks || '-')
  ].join(','));

  const csvContent = [headers.map(h => `"${h}"`).join(','), ...rows].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Generate Official Weekly Attendance Register PDF (Landscape A4) with Overall Numbers
export function generateWeeklyAttendancePdf(
  memberSummaries: MemberWeeklySummary[],
  totals: WeeklyOverallTotals,
  weekDays: WeekDayInfo[],
  scopeLabel: string,
  entityLabel: string,
  school: SchoolInfo = DEFAULT_SCHOOL
) {
  const liveSettings = getSchoolSettings();
  const isCompactMono = liveSettings.attendanceRegisterTemplate === 'compact-monochrome';
  // minimal-professional: same FULL register (all columns/rows/footers as
  // official-weekly) in strict black & white — black text, thin black grid
  // lines, white (paper) background, no fills, no colour-coded statuses.
  const isMinimalProfessional = liveSettings.attendanceRegisterTemplate === 'minimal-professional';

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const weekRangeStr = `${weekDays[0]?.displayDate} - ${weekDays[weekDays.length - 1]?.displayDate}`;

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(isMinimalProfessional ? 0 : 15, isMinimalProfessional ? 0 : 23, isMinimalProfessional ? 0 : 42);
  doc.text(school.name.toUpperCase(), 148, 14, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(isMinimalProfessional ? 0 : 100, isMinimalProfessional ? 0 : 116, isMinimalProfessional ? 0 : 139);
  doc.text(joinInfoParts([school.campus, school.address, school.phone ? `Contact: ${school.phone}` : '']), 148, 19, { align: 'center' });

  // Title Box (minimal-professional: thin black outline only, no fill at all)
  doc.setDrawColor(isMinimalProfessional || isCompactMono ? 0 : 203, isMinimalProfessional || isCompactMono ? 0 : 213, isMinimalProfessional || isCompactMono ? 0 : 225);
  if (!isMinimalProfessional) {
    doc.setFillColor(isCompactMono ? 255 : 241, isCompactMono ? 255 : 245, isCompactMono ? 255 : 249);
  }
  doc.roundedRect(14, 23, 269, 14, isMinimalProfessional || isCompactMono ? 0 : 2, isMinimalProfessional || isCompactMono ? 0 : 2, isMinimalProfessional ? 'S' : 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(isMinimalProfessional ? 0 : 15, isMinimalProfessional ? 0 : 23, isMinimalProfessional ? 0 : 42);
  doc.text(`OFFICIAL WEEKLY ATTENDANCE REGISTER (${entityLabel.toUpperCase()})`, 148, 29, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(isMinimalProfessional ? 0 : 71, isMinimalProfessional ? 0 : 85, isMinimalProfessional ? 0 : 105);
  doc.text(
    `Week: ${weekRangeStr}    |    Scope: ${scopeLabel}    |    Total Enrolled: ${memberSummaries.length}    |    Week Attendance Avg: ${totals.averageRate}%`,
    148,
    34,
    { align: 'center' }
  );

  // Table Headers
  const headCols = [
    '#',
    'ID',
    'Full Name',
    'Father / Role',
    'Class/Dept',
    ...weekDays.map(d => d.shortDay),
    'P',
    'A',
    'L',
    'Lv',
    'Att %'
  ];

  // Table Rows
  const bodyRows = memberSummaries.map((m, idx) => {
    const dayCodes = weekDays.map(d => m.dailyStatuses[d.date]?.code || '-');
    return [
      idx + 1,
      m.id,
      m.name,
      m.secondaryInfo,
      m.groupInfo,
      ...dayCodes,
      m.totalPresent,
      m.totalAbsent,
      m.totalLate,
      m.totalLeave,
      `${m.attendanceRate}%`
    ];
  });

  // Summary / Overall Row
  const footDayPresentCounts = weekDays.map(d => `P:${totals.dayTotals[d.date]?.present || 0}`);
  const footRow = [
    'TOTAL',
    '-',
    `Overall Numbers (${memberSummaries.length} entries)`,
    '-',
    '-',
    ...footDayPresentCounts,
    totals.grandPresent,
    totals.grandAbsent,
    totals.grandLate,
    totals.grandLeave,
    `${totals.averageRate}%`
  ];

  autoTable(doc, {
    startY: 40,
    head: [headCols],
    body: bodyRows,
    foot: [footRow],
    theme: 'grid',
    headStyles: {
      fillColor: isMinimalProfessional ? [255, 255, 255] : isCompactMono ? [230, 230, 230] : [15, 23, 42],
      textColor: isMinimalProfessional ? [0, 0, 0] : isCompactMono ? [0, 0, 0] : [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'center',
      ...(isMinimalProfessional ? { lineColor: [0, 0, 0], lineWidth: 0.1 } : {})
    },
    footStyles: {
      fillColor: isMinimalProfessional ? [255, 255, 255] : isCompactMono ? [245, 245, 245] : [241, 245, 249],
      textColor: isMinimalProfessional ? [0, 0, 0] : [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'center',
      ...(isMinimalProfessional ? { lineColor: [0, 0, 0], lineWidth: 0.1 } : {})
    },
    styles: {
      fontSize: 7.5,
      cellPadding: isMinimalProfessional ? 1.2 : isCompactMono ? 1.5 : 2,
      textColor: isMinimalProfessional ? [0, 0, 0] : [30, 41, 59],
      ...(isMinimalProfessional ? { fillColor: [255, 255, 255], lineColor: [0, 0, 0], lineWidth: 0.1 } : {})
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { halign: 'center', cellWidth: 16 },
      2: { fontStyle: 'bold', cellWidth: 32 },
      3: { cellWidth: 26 },
      4: { halign: 'center', cellWidth: 20 },
      // 7 Days
      5: { halign: 'center', cellWidth: 16 },
      6: { halign: 'center', cellWidth: 16 },
      7: { halign: 'center', cellWidth: 16 },
      8: { halign: 'center', cellWidth: 16 },
      9: { halign: 'center', cellWidth: 16 },
      10: { halign: 'center', cellWidth: 16 },
      11: { halign: 'center', cellWidth: 16 },
      // Overall Numbers
      12: { halign: 'center', cellWidth: 10, fontStyle: 'bold' },
      13: { halign: 'center', cellWidth: 10, fontStyle: 'bold' },
      14: { halign: 'center', cellWidth: 10, fontStyle: 'bold' },
      15: { halign: 'center', cellWidth: 10, fontStyle: 'bold' },
      16: { halign: 'center', cellWidth: 15, fontStyle: 'bold' }
    },
    didParseCell: (data) => {
      if (isMinimalProfessional) {
        // Strict B&W end-to-end: black text, paper-white cells, black grid.
        // Status letters (P/A/L/Lv) are distinguished by bold weight only —
        // never by colour or fill.
        data.cell.styles.textColor = [0, 0, 0];
        data.cell.styles.fillColor = [255, 255, 255];
        data.cell.styles.lineColor = [0, 0, 0];
        if (data.section === 'body' && data.column.index >= 5 && data.column.index <= 11) {
          const val = String(data.cell.raw);
          if (val === 'P' || val === 'A' || val === 'L' || val === 'Lv') {
            data.cell.styles.fontStyle = 'bold';
          }
        }
        return;
      }
      // Color coding for status values in body
      if (data.section === 'body' && data.column.index >= 5 && data.column.index <= 11) {
        const val = String(data.cell.raw);
        if (val === 'P') {
          data.cell.styles.textColor = [16, 185, 129]; // green
          data.cell.styles.fontStyle = 'bold';
        } else if (val === 'A') {
          data.cell.styles.textColor = [239, 68, 68]; // red
          data.cell.styles.fontStyle = 'bold';
        } else if (val === 'L') {
          data.cell.styles.textColor = [14, 165, 233]; // cyan
          data.cell.styles.fontStyle = 'bold';
        } else if (val === 'Lv') {
          data.cell.styles.textColor = [217, 119, 6]; // amber
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
    didDrawPage: (data) => {
      const pageHeight = doc.internal.pageSize.height;
      doc.setFontSize(7.5);
      doc.setTextColor(isMinimalProfessional ? 0 : 100, isMinimalProfessional ? 0 : 116, isMinimalProfessional ? 0 : 139);
      doc.text(`Generated on ${new Date().toLocaleDateString()} via SchoolEx • Confidential Official Record`, 14, pageHeight - 8);
      doc.text(`Page ${data.pageNumber}`, 283, pageHeight - 8, { align: 'right' });
    }
  });

  // Add signature area at bottom of final page
  const finalY = (doc as any).lastAutoTable.finalY + 12;
  const pageHeight = doc.internal.pageSize.height;
  if (finalY < pageHeight - 20) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(isMinimalProfessional ? 0 : 30, isMinimalProfessional ? 0 : 41, isMinimalProfessional ? 0 : 59);
    doc.text('Class Teacher / Incharge: ______________________', 25, finalY);
    doc.text('Principal / Administrator: ______________________', 190, finalY);
  }

  doc.save(`Weekly_Attendance_${weekDays[0]?.date}_${entityLabel}_${scopeLabel.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
}
