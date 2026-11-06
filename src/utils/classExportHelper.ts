import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ClassInfo } from '../types';
import { DEFAULT_SCHOOL } from './pdfGenerator';

export function exportClassesToCSV(classes: ClassInfo[], filename = 'classes_directory.csv') {
  const headers = ['Class ID', 'Class Name', 'Sections Count', 'Sections', 'Enrolled Students'];
  const rows = classes.map(c => [
    c.id,
    `"${c.name.replace(/"/g, '""')}"`,
    c.sectionsCount,
    `"${c.sections.join(', ')}"`,
    c.studentsCount
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
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

export function exportClassesToPDF(classes: ClassInfo[], school = DEFAULT_SCHOOL) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const margin = 14;

  // Header Banner
  doc.setFillColor(16, 22, 34); // #101622
  doc.roundedRect(margin, margin, pageWidth - (margin * 2), 26, 3, 3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text(school.name || 'Demo School Schooliee Pakistan', margin + 8, margin + 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text(`Academic Directory: Classes & Sections Summary`, margin + 8, margin + 17);
  doc.text(`Generated on: ${new Date().toLocaleDateString('en-GB')}`, margin + 8, margin + 22);

  // Summary Metrics
  const totalClasses = classes.length;
  const totalSections = classes.reduce((sum, c) => sum + c.sectionsCount, 0);
  const totalStudents = classes.reduce((sum, c) => sum + c.studentsCount, 0);

  const startY = margin + 32;

  // Table
  const tableData = classes.map((c, index) => [
    index + 1,
    c.name,
    c.sectionsCount,
    c.sections.join(', '),
    c.studentsCount
  ]);

  autoTable(doc, {
    startY,
    head: [['#', 'Class', 'Sections', 'Section Names', 'Students']],
    body: tableData,
    theme: 'plain',
    headStyles: {
      fillColor: [21, 28, 42],
      textColor: [241, 245, 249],
      fontSize: 8.5,
      fontStyle: 'bold',
      cellPadding: 3
    },
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.1
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 55, fontStyle: 'bold' },
      2: { cellWidth: 25, halign: 'center' },
      3: { cellWidth: 45 },
      4: { cellWidth: 35, halign: 'center', fontStyle: 'bold' }
    },
    margin: { left: margin, right: margin },
    foot: [[
      'Total',
      `${totalClasses} Classes`,
      `${totalSections} Sections`,
      '—',
      `${totalStudents} Students`
    ]],
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 8.5
    }
  });

  doc.save(`Classes_Directory_${new Date().toISOString().slice(0, 10)}.pdf`);
}
