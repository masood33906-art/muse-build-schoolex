import { StaffMember, StaffCategory, StaffStatus } from '../types';

export interface StaffCSVPrerequisiteIssue {
  rowNumber: number;
  staffName: string;
  staffId: string;
  type: 'invalid_category' | 'missing_required_field' | 'duplicate_id' | 'invalid_salary';
  message: string;
}

export interface StaffCSVParseResult {
  staff: StaffMember[];
  errors: string[];
  totalRows: number;
  prerequisitePassed: boolean;
  prerequisiteIssues: StaffCSVPrerequisiteIssue[];
  invalidCategories: string[];
  duplicateIdsInFile: string[];
  existingStaffIdConflicts: { rowNumber: number; staffName: string; staffId: string; existingStaffName: string }[];
}

export const ALLOWED_STAFF_CATEGORIES: StaffCategory[] = [
  'Teacher',
  'Admin',
  'Finance',
  'Support',
  'Operations'
];

export function exportStaffToCSV(staffList: StaffMember[], filename = 'staff_records_export.csv') {
  const headers = [
    'Employee ID',
    'Full Name',
    'Role / Designation',
    'Category',
    'Department',
    'Qualification',
    'Monthly Salary',
    'Pay Status',
    'Last Paid Date',
    'Employment Status',
    'Phone',
    'Email',
    'Joining Date',
    'Blood Group',
    'Emergency Contact'
  ];

  const escapeCell = (val: string | number | undefined | null) => {
    if (val === undefined || val === null) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = staffList.map(s => [
    escapeCell(s.id),
    escapeCell(s.name),
    escapeCell(s.role),
    escapeCell(s.category),
    escapeCell(s.department),
    escapeCell(s.qualification),
    escapeCell(s.salary),
    escapeCell(s.payStatus),
    escapeCell(s.lastPaidDate || ''),
    escapeCell(s.status),
    escapeCell(s.phone),
    escapeCell(s.email),
    escapeCell(s.joiningDate),
    escapeCell(s.bloodGroup || ''),
    escapeCell(s.emergencyContact || '')
  ].join(','));

  const csvContent = [headers.map(h => `"${h}"`).join(','), ...rows].join('\r\n');
  downloadBlob(csvContent, filename);
}

export function exportPayrollSummaryToCSV(staffList: StaffMember[], month = 'Current Month') {
  const headers = [
    'Employee ID',
    'Employee Name',
    'Role',
    'Department',
    'Base Salary (Rs.)',
    'Estimated Allowance (10%)',
    'Estimated Deduction (2%)',
    'Net Payable (Rs.)',
    'Payment Status',
    'Disbursement Date'
  ];

  const escapeCell = (val: string | number | undefined | null) => {
    if (val === undefined || val === null) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = staffList.map(s => {
    const allowance = Math.round(s.salary * 0.1);
    const deduction = Math.round(s.salary * 0.02);
    const net = s.salary + allowance - deduction;
    return [
      escapeCell(s.id),
      escapeCell(s.name),
      escapeCell(s.role),
      escapeCell(s.department),
      escapeCell(s.salary),
      escapeCell(allowance),
      escapeCell(deduction),
      escapeCell(net),
      escapeCell(s.payStatus),
      escapeCell(s.lastPaidDate || 'Pending')
    ].join(',');
  });

  const totalBase = staffList.reduce((acc, s) => acc + (s.salary || 0), 0);
  const totalNet = staffList.reduce((acc, s) => acc + (s.salary + Math.round(s.salary * 0.1) - Math.round(s.salary * 0.02)), 0);
  
  rows.push([
    '""',
    '"TOTAL PAYROLL"',
    '""',
    '""',
    escapeCell(totalBase),
    '""',
    '""',
    escapeCell(totalNet),
    '""',
    '""'
  ].join(','));

  const csvContent = [headers.map(h => `"${h}"`).join(','), ...rows].join('\r\n');
  downloadBlob(csvContent, `Payroll_Summary_${month.replace(/\s+/g, '_')}.csv`);
}

export function downloadStaffSampleCSVTemplate() {
  const sampleHeaders = 'Employee ID,Full Name,Role,Category,Department,Qualification,Monthly Salary,Phone,Email,Employment Status,Joining Date';
  const sampleRows = [
    'EMP-0201,Dr. Shahzad Rafiq,Senior Chemistry Teacher,Teacher,Academics,Ph.D. Chemistry,95000,+92 300 1122334,shahzad.chem@schoollee.edu.pk,Active,2024-02-01',
    'EMP-0202,Ms. Kainat Zahra,Primary English Teacher,Teacher,Academics,M.A. English,75000,+92 301 2233445,kainat.eng@schoollee.edu.pk,Active,2024-03-15',
    'EMP-0203,Mr. Waqas Ahmad,Accounts Officer,Finance,Finance,B.Com Honors,65000,+92 302 3344556,waqas.fin@schoollee.edu.pk,Active,2024-01-10',
    ',Mr. Arshad Mehmood,Security Guard,Operations,Operations & Support,Matric,45000,+92 303 4455667,security.arshad@schoollee.edu.pk,Active,2024-05-01'
  ];

  const csvContent = [sampleHeaders, ...sampleRows].join('\r\n');
  downloadBlob(csvContent, 'staff_bulk_import_sample.csv');
}

export function parseCSVToStaff(
  csvText: string,
  currentStaffCount: number,
  existingStaff: StaffMember[] = []
): StaffCSVParseResult {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) {
    return {
      staff: [],
      errors: ['The CSV file is empty or missing data rows.'],
      totalRows: 0,
      prerequisitePassed: false,
      prerequisiteIssues: [],
      invalidCategories: [],
      duplicateIdsInFile: [],
      existingStaffIdConflicts: []
    };
  }

  const parseLine = (text: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        if (inQuotes && text[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headerRow = parseLine(lines[0]).map(h => h.toLowerCase().replace(/[\s/_-]+/g, ''));

  const colIndex = {
    id: headerRow.findIndex(h => h.includes('empid') || h.includes('employeeid') || h === 'id'),
    name: headerRow.findIndex(h => h.includes('fullname') || h.includes('name') || h.includes('staffname')),
    role: headerRow.findIndex(h => h.includes('role') || h.includes('designation') || h.includes('position')),
    category: headerRow.findIndex(h => h.includes('category') || h.includes('type')),
    department: headerRow.findIndex(h => h.includes('dept') || h.includes('department')),
    qualification: headerRow.findIndex(h => h.includes('qualif') || h.includes('degree')),
    salary: headerRow.findIndex(h => h.includes('salary') || h.includes('pay') || h.includes('wage')),
    phone: headerRow.findIndex(h => h.includes('phone') || h.includes('contact') || h.includes('mobile')),
    email: headerRow.findIndex(h => h.includes('email') || h.includes('mail')),
    status: headerRow.findIndex(h => h.includes('employmentstatus') || h.includes('status')),
    joiningDate: headerRow.findIndex(h => h.includes('joining') || h.includes('date'))
  };

  const existingIdMap = new Map<string, string>();
  existingStaff.forEach(s => {
    existingIdMap.set(s.id.trim().toLowerCase(), s.name);
  });

  const parsedStaff: StaffMember[] = [];
  const errors: string[] = [];
  const prerequisiteIssues: StaffCSVPrerequisiteIssue[] = [];
  const invalidCategoriesSet = new Set<string>();
  const seenIdsInFile = new Map<string, number>();
  const duplicateIdsSet = new Set<string>();
  const existingStaffIdConflicts: { rowNumber: number; staffName: string; staffId: string; existingStaffName: string }[] = [];

  let autoIdCounter = currentStaffCount + 101;

  for (let i = 1; i < lines.length; i++) {
    const rowNumber = i + 1;
    const cells = parseLine(lines[i]);
    if (cells.length === 0 || (cells.length === 1 && !cells[0])) continue;

    const rawName = (colIndex.name !== -1 ? cells[colIndex.name] : cells[1] || cells[0]) || '';
    const name = rawName.trim();
    if (!name) {
      errors.push(`Row ${rowNumber}: Full Name is missing.`);
      prerequisiteIssues.push({
        rowNumber,
        staffName: '(Empty Name)',
        staffId: (colIndex.id !== -1 ? cells[colIndex.id] : cells[0])?.trim() || 'N/A',
        type: 'missing_required_field',
        message: `Row ${rowNumber}: Required field "Full Name" is missing.`
      });
      continue;
    }

    let id = colIndex.id !== -1 ? cells[colIndex.id] : cells[0];
    if (!id || !id.trim() || id.trim().toLowerCase() === 'auto') {
      let candId = `EMP-${String(autoIdCounter++).padStart(4, '0')}`;
      while (existingIdMap.has(candId.toLowerCase()) || seenIdsInFile.has(candId.toLowerCase())) {
        candId = `EMP-${String(autoIdCounter++).padStart(4, '0')}`;
      }
      id = candId;
    } else {
      id = id.trim();
    }

    const idLower = id.toLowerCase();
    if (seenIdsInFile.has(idLower)) {
      const prevRow = seenIdsInFile.get(idLower)!;
      duplicateIdsSet.add(id);
      prerequisiteIssues.push({
        rowNumber,
        staffName: name,
        staffId: id,
        type: 'duplicate_id',
        message: `Row ${rowNumber}: Staff "${name}" has duplicate Employee ID "${id}" (already used in Row ${prevRow} of this CSV).`
      });
    } else {
      seenIdsInFile.set(idLower, rowNumber);
    }

    if (existingIdMap.has(idLower)) {
      existingStaffIdConflicts.push({
        rowNumber,
        staffName: name,
        staffId: id,
        existingStaffName: existingIdMap.get(idLower)!
      });
    }

    const rawRole = (colIndex.role !== -1 ? cells[colIndex.role] : cells[2]) || '';
    const role = rawRole.trim();
    if (!role) {
      prerequisiteIssues.push({
        rowNumber,
        staffName: name,
        staffId: id,
        type: 'missing_required_field',
        message: `Row ${rowNumber}: Staff "${name}" is missing a Role / Designation.`
      });
    }

    // Validate Category prerequisite against ALLOWED_STAFF_CATEGORIES
    const rawCatInput = (colIndex.category !== -1 ? cells[colIndex.category] : cells[3])?.trim() || '';
    let category: StaffCategory = 'Teacher';
    if (rawCatInput) {
      const matchedCat = ALLOWED_STAFF_CATEGORIES.find(
        c => c.toLowerCase() === rawCatInput.toLowerCase()
      );
      if (matchedCat) {
        category = matchedCat;
      } else {
        invalidCategoriesSet.add(rawCatInput);
        prerequisiteIssues.push({
          rowNumber,
          staffName: name,
          staffId: id,
          type: 'invalid_category',
          message: `Row ${rowNumber}: Staff "${name}" has Category "${rawCatInput}", which does not match valid system categories (${ALLOWED_STAFF_CATEGORIES.join(', ')}).`
        });
      }
    }

    const department = (colIndex.department !== -1 ? cells[colIndex.department] : cells[4]) || (category === 'Teacher' ? 'Academics' : 'Administration');
    const qualification = (colIndex.qualification !== -1 ? cells[colIndex.qualification] : cells[5]) || 'Graduate';

    const rawSalary = colIndex.salary !== -1 ? cells[colIndex.salary] : cells[6];
    const parsedSalary = Number(String(rawSalary || '0').replace(/[^0-9.]/g, ''));
    if (!parsedSalary || parsedSalary <= 0) {
      prerequisiteIssues.push({
        rowNumber,
        staffName: name,
        staffId: id,
        type: 'invalid_salary',
        message: `Row ${rowNumber}: Staff "${name}" is missing a valid positive Monthly Salary.`
      });
    }

    const phone = (colIndex.phone !== -1 ? cells[colIndex.phone] : cells[7]) || '';
    const email = (colIndex.email !== -1 ? cells[colIndex.email] : cells[8]) || '';

    const rawStatus = colIndex.status !== -1 ? cells[colIndex.status]?.toLowerCase() || 'active' : 'active';
    let status: StaffStatus = 'Active';
    if (rawStatus.includes('leave')) status = 'On Leave';
    else if (rawStatus.includes('inact')) status = 'Inactive';

    const joiningDate = (colIndex.joiningDate !== -1 ? cells[colIndex.joiningDate] : cells[10]) || new Date().toISOString().slice(0, 10);

    parsedStaff.push({
      id,
      name,
      role: role || 'Teaching Faculty',
      category,
      department: department.trim(),
      qualification: qualification.trim(),
      // Fix #7b: a row whose salary cell is missing/invalid is
      // already flagged with an `invalid_salary` issue above — it
      // must import with salary 0 (not recorded), never an invented
      // 60,000 written into the staff record.
      salary: parsedSalary > 0 ? parsedSalary : 0,
      payStatus: 'Pending',
      status,
      phone: phone.trim(),
      email: email.trim(),
      joiningDate: joiningDate.trim(),
      gender: 'Male',
      bloodGroup: 'B+'
    });
  }

  return {
    staff: parsedStaff,
    errors,
    totalRows: lines.length - 1,
    prerequisitePassed: prerequisiteIssues.length === 0 && parsedStaff.length > 0,
    prerequisiteIssues,
    invalidCategories: Array.from(invalidCategoriesSet),
    duplicateIdsInFile: Array.from(duplicateIdsSet),
    existingStaffIdConflicts
  };
}

function downloadBlob(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
