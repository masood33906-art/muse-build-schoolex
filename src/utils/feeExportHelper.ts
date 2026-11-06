import { FamilyFeeSummary } from './feeHelper';

export interface FeeReportRowItem {
  id: string;
  name: string;
  phone: string;
  classesOrClass: string;
  due: number;
  paid: number;
  status: 'Paid' | 'Partially Paid' | 'Unpaid';
}

// Backward compatibility alias
export type FeeExportMemberItem = FeeReportRowItem;

/**
 * Exports fees data to a clean CSV file matching the exact format in the reference image:
 * FAMILY NAME | FAMILY ID | PHONE | CLASSES | DUE | PAID | STATUS
 * (or STUDENT NAME | STUDENT ID | PHONE | CLASS | DUE | PAID | STATUS)
 */
export function exportFeesDataToCSV(
  section: 'family' | 'student',
  items: FeeReportRowItem[],
  customFilename?: string
) {
  const isFamily = section === 'family';

  // Standard export column headers
  const headers = isFamily
    ? ['FAMILY NAME', 'FAMILY ID', 'PHONE', 'CLASSES', 'DUE', 'PAID', 'STATUS']
    : ['STUDENT NAME', 'STUDENT ID', 'PHONE', 'CLASS', 'DUE', 'PAID', 'STATUS'];

  const escapeCell = (val: string | number | undefined | null) => {
    if (val === undefined || val === null) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = items.map(item => [
    escapeCell(item.name),
    escapeCell(item.id),
    escapeCell(item.phone || '—'),
    escapeCell(item.classesOrClass || '—'),
    escapeCell(`${Math.round(item.due).toLocaleString('en-US')} PKR`),
    escapeCell(`${Math.round(item.paid).toLocaleString('en-US')} PKR`),
    escapeCell(item.status)
  ].join(','));

  const csvContent = [headers.map(h => `"${h}"`).join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);

  const defaultFilename = isFamily 
    ? `family_fees_report_${new Date().toISOString().slice(0, 10)}.csv`
    : `student_fees_report_${new Date().toISOString().slice(0, 10)}.csv`;

  link.setAttribute('download', customFilename || defaultFilename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Backward-compatible wrapper for any existing legacy call
export function exportFeesToCSV(families: FamilyFeeSummary[], filename?: string) {
  const items: FeeReportRowItem[] = families.map(f => ({
    id: f.familyId,
    name: f.familyName,
    phone: f.phone || '',
    classesOrClass: f.students?.map(s => s.class).filter(Boolean).join(', ') || '—',
    due: f.totalDue,
    paid: f.totalPaid,
    status: f.status
  }));
  exportFeesDataToCSV('family', items, filename);
}
