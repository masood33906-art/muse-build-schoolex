import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Student, CardTemplateType, FamilyData } from '../types';
import { getSchoolSettings } from './settingsHelper';

export interface SchoolInfo {
  name: string;
  campus: string;
  session: string;
  phone: string;
  address: string;
}

export function getLiveSchoolInfo(): SchoolInfo {
  const s = getSchoolSettings();
  return {
    name: s.schoolName || 'Demo School Schoollee Pakistan',
    campus: s.campusName || 'Main Campus',
    session: s.session || '2025 - 2026',
    phone: s.schoolPhone || '+92 42 35890000',
    address: s.schoolAddress || 'Lahore, Pakistan',
  };
}

export const DEFAULT_SCHOOL: SchoolInfo = {
  get name() { return getLiveSchoolInfo().name; },
  get campus() { return getLiveSchoolInfo().campus; },
  get session() { return getLiveSchoolInfo().session; },
  get phone() { return getLiveSchoolInfo().phone; },
  get address() { return getLiveSchoolInfo().address; },
};

// Generates a single vertical ID Card PDF (54mm x 85.6mm standard ID card CR80 size)
export function generateSingleIdCard(
  student: Student,
  template?: CardTemplateType,
  school: SchoolInfo = getLiveSchoolInfo()
) {
  const activeTemplate = template || getSchoolSettings().studentIdCardTemplate || 'modern-tech';
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [54, 86] // standard vertical ID card
  });

  renderCardOnPage(doc, student, activeTemplate, school);
  doc.save(`${student.id}_${student.name.replace(/\s+/g, '_')}_IDCard.pdf`);
}

// Generates all student cards in a single combined PDF (1 page per card)
export function generateAllIdCards(
  students: Student[],
  template?: CardTemplateType,
  school: SchoolInfo = getLiveSchoolInfo()
) {
  if (students.length === 0) return;
  const activeTemplate = template || getSchoolSettings().studentIdCardTemplate || 'modern-tech';

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [54, 86]
  });

  students.forEach((student, index) => {
    if (index > 0) {
      doc.addPage([54, 86], 'portrait');
    }
    renderCardOnPage(doc, student, activeTemplate, school);
  });

  doc.save(`All_Students_ID_Cards_${activeTemplate}_(${students.length}).pdf`);
}

// Render student card content into the current page of doc
function renderCardOnPage(doc: jsPDF, student: Student, template: CardTemplateType, school: SchoolInfo) {
  const width = 54;
  const height = 86;

  if (template === 'modern-tech') {
    // Background
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, width, height, 'F');

    // Header gradient banner simulation
    doc.setFillColor(30, 41, 59); // slate-800
    doc.rect(0, 0, width, 24, 'F');

    // Accent line
    doc.setFillColor(14, 165, 233); // cyan-500
    doc.rect(0, 23, width, 1.2, 'F');

    // School Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text(school.name.toUpperCase(), width / 2, 6, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(`STUDENT IDENTITY CARD • ${school.session}`, width / 2, 9.5, { align: 'center' });

    // Photo Box / Avatar Frame
    const photoSize = 18;
    const photoX = (width - photoSize) / 2;
    const photoY = 12;

    // Card Photo Border
    doc.setFillColor(14, 165, 233);
    doc.roundedRect(photoX - 0.5, photoY - 0.5, photoSize + 1, photoSize + 1, 2, 2, 'F');
    doc.setFillColor(2, 132, 199); // cyan-600
    doc.roundedRect(photoX, photoY, photoSize, photoSize, 1.5, 1.5, 'F');

    // Render Student Photo or Initials
    let renderedPhoto = false;
    if (student.photo) {
      try {
        doc.addImage(student.photo, photoX, photoY, photoSize, photoSize);
        renderedPhoto = true;
      } catch (e) {
        console.warn('Could not render photo in PDF, falling back to initials:', e);
      }
    }
    if (!renderedPhoto) {
      const initials = student.name.substring(0, 2).toUpperCase();
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(255, 255, 255);
      doc.text(initials, photoX + photoSize / 2, photoY + photoSize / 2 + 3.5, { align: 'center' });
    }

    // Student Name
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    const displayName = student.name.length > 20 ? student.name.substring(0, 18) + '...' : student.name;
    doc.text(displayName, width / 2, 35, { align: 'center' });

    // Student ID Tag
    doc.setFillColor(24, 39, 64);
    doc.roundedRect((width - 24) / 2, 37, 24, 4.5, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(56, 189, 248); // sky-400
    doc.text(student.id, width / 2, 40.2, { align: 'center' });

    // Details Grid
    const startY = 44.5;
    const rowH = 4.2;

    const fields = [
      { label: 'Class / Sec:', val: `${student.class} - ${student.section}` },
      { label: 'Guardian:', val: student.family },
      { label: 'Family ID:', val: student.familyId },
      { label: 'Blood Group:', val: student.bloodGroup || 'N/A' },
      { label: 'Emergency:', val: student.phone || school.phone },
      { label: 'Status:', val: student.status }
    ];

    fields.forEach((f, idx) => {
      const y = startY + idx * rowH;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.5);
      doc.setTextColor(148, 163, 184); // label color
      doc.text(f.label, 5, y);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.8);
      doc.setTextColor(241, 245, 249); // val color
      const valText = f.val.length > 18 ? f.val.substring(0, 17) + '..' : f.val;
      doc.text(valText, 22, y);
    });

    // Barcode Simulation
    const barY = 71;
    doc.setFillColor(255, 255, 255);
    doc.rect(5, barY, 44, 7, 'F');

    // Simulate vertical barcode lines
    doc.setFillColor(0, 0, 0);
    for (let x = 7; x < 47; x += 1.2) {
      if (Math.sin(x * 17) > -0.2) {
        doc.rect(x, barY + 1, 0.6, 5, 'F');
      }
    }

    // Bottom Footer
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(4.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Official Student Pass • Verified System ID`, width / 2, 82, { align: 'center' });

  } else {
    // Template 2: Classic Academic Heritage
    // Card Background
    doc.setFillColor(254, 252, 246); // warm antique parchment
    doc.rect(0, 0, width, height, 'F');

    // Double Border
    doc.setDrawColor(180, 140, 60); // Gold stroke
    doc.setLineWidth(0.8);
    doc.rect(2.5, 2.5, width - 5, height - 5);
    doc.setLineWidth(0.3);
    doc.rect(3.5, 3.5, width - 7, height - 7);

    // Top Crest Header
    doc.setFillColor(26, 43, 76); // Royal Oxford Navy
    doc.rect(4, 4, width - 8, 16, 'F');

    doc.setFont('times', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(245, 215, 120); // Gold text
    doc.text(school.name.toUpperCase(), width / 2, 9, { align: 'center' });

    doc.setFont('times', 'italic');
    doc.setFontSize(5.5);
    doc.setTextColor(220, 230, 245);
    doc.text(`Scholar Identification Card • ${school.session}`, width / 2, 12.5, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(4.5);
    doc.setTextColor(180, 195, 220);
    doc.text(school.address, width / 2, 16, { align: 'center' });

    // Portrait Frame
    const pSize = 17;
    const px = (width - pSize) / 2;
    const py = 22;

    doc.setDrawColor(180, 140, 60);
    doc.setLineWidth(0.6);
    doc.setFillColor(26, 43, 76);
    doc.roundedRect(px, py, pSize, pSize, 2, 2, 'FD');

    // Monogram / Photo
    let renderedPhoto2 = false;
    if (student.photo) {
      try {
        doc.addImage(student.photo, px + 0.5, py + 0.5, pSize - 1, pSize - 1);
        renderedPhoto2 = true;
      } catch (e) {
        console.warn('Could not render photo in PDF template 2, falling back to initials:', e);
      }
    }
    if (!renderedPhoto2) {
      const initials = student.name.substring(0, 2).toUpperCase();
      doc.setFont('times', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(245, 215, 120);
      doc.text(initials, px + pSize / 2, py + pSize / 2 + 3.5, { align: 'center' });
    }

    // Student Name
    doc.setFont('times', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(26, 43, 76);
    const dName = student.name.length > 20 ? student.name.substring(0, 18) + '...' : student.name;
    doc.text(dName, width / 2, 43, { align: 'center' });

    // Roll No / ID
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(160, 110, 40);
    doc.text(`ROLL NO: ${student.id}`, width / 2, 46.5, { align: 'center' });

    // Horizontal Divider
    doc.setDrawColor(200, 190, 170);
    doc.setLineWidth(0.3);
    doc.line(7, 48.5, width - 7, 48.5);

    // Details block
    const fields = [
      { label: 'Class / Section:', val: `${student.class} - ${student.section}` },
      { label: 'Father Name:', val: student.family },
      { label: 'Family Code:', val: student.familyId },
      { label: 'Blood Group:', val: student.bloodGroup || 'O+' },
      { label: 'Emergency Contact:', val: student.phone || school.phone },
      { label: 'Enrollment Status:', val: student.status }
    ];

    const startY = 52.5;
    const rowH = 3.8;

    fields.forEach((f, idx) => {
      const y = startY + idx * rowH;
      doc.setFont('times', 'bold');
      doc.setFontSize(5.5);
      doc.setTextColor(70, 75, 85);
      doc.text(f.label, 6, y);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.5);
      doc.setTextColor(20, 25, 35);
      const textVal = f.val.length > 18 ? f.val.substring(0, 17) + '..' : f.val;
      doc.text(textVal, 24, y);
    });

    // Signature Area
    const sigY = 77;
    doc.setDrawColor(120, 120, 120);
    doc.setLineWidth(0.2);
    doc.line(32, sigY + 2, 49, sigY + 2);

    doc.setFont('times', 'italic');
    doc.setFontSize(4.5);
    doc.setTextColor(80, 80, 80);
    doc.text('Principal Signature', 40.5, sigY + 4.5, { align: 'center' });

    // Official Stamp seal simulation on left
    doc.setDrawColor(180, 140, 60);
    doc.circle(13, sigY + 1, 4.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(3.5);
    doc.setTextColor(180, 140, 60);
    doc.text('VERIFIED', 13, sigY + 1.2, { align: 'center' });
  }
}

// Creates Student Registry jsPDF document (can be used for preview, printing, or direct save)
export function createStudentRegistryPdfDoc(students: Student[], school: SchoolInfo = DEFAULT_SCHOOL): jsPDF {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  // Header Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(school.name, 14, 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`Official Student Records Registry Database • Generated on ${dateStr}`, 14, 21);

  // Summary Metrics Banner
  const total = students.length;
  const active = students.filter(s => s.status === 'Active').length;
  const inactive = total - active;
  const uniqueFamilies = new Set(students.map(s => s.familyId)).size;

  doc.setFillColor(241, 245, 249);
  doc.roundedRect(14, 25, 269, 12, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text(`Total Records: ${total}`, 20, 32.5);
  doc.text(`Active: ${active}`, 75, 32.5);
  doc.text(`Inactive: ${inactive}`, 130, 32.5);
  doc.text(`Distinct Families: ${uniqueFamilies}`, 185, 32.5);
  doc.text(`Session: ${school.session}`, 240, 32.5);

  // Table Data
  const tableData = students.map((s, index) => [
    index + 1,
    s.id,
    s.name,
    s.family,
    s.familyId,
    s.class,
    s.section,
    s.status,
    s.bloodGroup || '-',
    s.phone || '-'
  ]);

  autoTable(doc, {
    startY: 42,
    head: [['#', 'Student ID', 'Student Name', 'Family / Guardian', 'Family ID', 'Class', 'Sec', 'Status', 'Blood', 'Contact']],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59]
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 22, fontStyle: 'bold' },
      2: { cellWidth: 42 },
      3: { cellWidth: 42 },
      4: { cellWidth: 24 },
      5: { cellWidth: 30 },
      6: { cellWidth: 14, halign: 'center' },
      7: { cellWidth: 22, halign: 'center' },
      8: { cellWidth: 18, halign: 'center' },
      9: { cellWidth: 35 }
    },
    didDrawPage: () => {
      const str = `Page ${doc.getNumberOfPages()} • Confidential Student Registry`;
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(str, 14, 202);
    }
  });

  return doc;
}

// Generates complete PDF Registry Backup with AutoTable
export function generateBackupPdf(students: Student[], school: SchoolInfo = DEFAULT_SCHOOL) {
  const doc = createStudentRegistryPdfDoc(students, school);
  const timestamp = new Date().toISOString().slice(0, 10);
  doc.save(`Student_Registry_Backup_${timestamp}.pdf`);
}

// Creates Family Directory jsPDF document (for preview, print, or save)
export function createFamilyRegistryPdfDoc(families: FamilyData[], school: SchoolInfo = DEFAULT_SCHOOL): jsPDF {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  // Header Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(school.name, 14, 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`Official Family Accounts Directory • Generated on ${dateStr}`, 14, 21);

  // Summary Metrics Banner
  const totalFamilies = families.length;
  const totalStudents = families.reduce((sum, f) => sum + f.students.length, 0);

  doc.setFillColor(241, 245, 249);
  doc.roundedRect(14, 25, 269, 12, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text(`Total Family Accounts: ${totalFamilies}`, 20, 32.5);
  doc.text(`Total Enrolled Students: ${totalStudents}`, 95, 32.5);
  doc.text(`Campus: ${school.campus}`, 170, 32.5);
  doc.text(`Session: ${school.session}`, 235, 32.5);

  // Table Data
  const tableData = families.map((fam, index) => [
    index + 1,
    fam.familyId,
    fam.familyName,
    fam.phone || '-',
    fam.guardianCnic || '-',
    fam.guardianOccupation || '-',
    `${fam.students.length} ${fam.students.length === 1 ? 'Student' : 'Students'}`,
    fam.students.map(s => `${s.name} (${s.id})`).join(', ') || '-',
    fam.address || '-'
  ]);

  autoTable(doc, {
    startY: 42,
    head: [['#', 'Family ID', 'Family / Guardian', 'Phone', 'CNIC', 'Occupation', 'Count', 'Enrolled Students', 'Address']],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59]
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 22, fontStyle: 'bold' },
      2: { cellWidth: 40 },
      3: { cellWidth: 28 },
      4: { cellWidth: 28 },
      5: { cellWidth: 26 },
      6: { cellWidth: 20, halign: 'center' },
      7: { cellWidth: 46 },
      8: { cellWidth: 49 }
    },
    didDrawPage: () => {
      const str = `Page ${doc.getNumberOfPages()} • Confidential Family Directory`;
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(str, 14, 202);
    }
  });

  return doc;
}

export function generateFamilyBackupPdf(families: FamilyData[], school: SchoolInfo = DEFAULT_SCHOOL) {
  const doc = createFamilyRegistryPdfDoc(families, school);
  const timestamp = new Date().toISOString().slice(0, 10);
  doc.save(`Family_Directory_Backup_${timestamp}.pdf`);
}
