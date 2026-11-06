import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface FeeInvoiceItem {
  id: string;
  studentId: string;
  studentName: string;
  studentRollNo?: string;
  purpose: string; // e.g. "Monthly Fee", "Fine", "Fund - (Library Fund)"
  month: string; // e.g. "May 2026", "September 2026"
  className: string; // e.g. "Class 4", "-"
  discount: number;
  discountDisplay: string; // e.g. "400 PKR" or "-"
  fee: number;
  feeDisplay: string; // e.g. "3100 / 3100 PKR" or "3,000 PKR"
  paidAmount: number;
}

export interface FeeInvoiceStudentGroup {
  studentId: string;
  studentName: string;
  studentRollNo?: string;
  className: string;
  items: FeeInvoiceItem[];
  studentSubtotal: number;
  studentPaid: number;
}

export interface FeeInvoiceData {
  invoiceNumber: string; // e.g. "20260916160306"
  paymentDate: string; // e.g. "16 Sep 2026 04:03 PM"
  formattedDateOnly: string; // e.g. "16 Sep 2026"
  paymentMethod: string; // e.g. "Cash", "Bank Transfer"
  status: 'Paid';
  school: {
    name: string;
    address: string;
    phone: string;
    email: string;
  };
  invoiceTo: {
    guardianName: string;
    familyId: string;
    phone: string;
    address: string;
  };
  students: FeeInvoiceStudentGroup[];
  subtotal: number;
  paidAmount: number;
  note?: string;
}

// Draw modern green/black circular leaf logo
function drawSchoolLogo(doc: jsPDF, x: number, y: number, radius = 5.5) {
  doc.saveGraphicsState();
  // White circle background with subtle border
  doc.setFillColor(255, 255, 255);
  doc.circle(x, y, radius, 'F');
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.setLineWidth(0.3);
  doc.circle(x, y, radius, 'S');

  // Dark V shape
  doc.setFillColor(15, 23, 42); // slate-900
  doc.triangle(
    x - radius * 0.55, y - radius * 0.45,
    x + radius * 0.55, y - radius * 0.45,
    x, y + radius * 0.65,
    'F'
  );

  // Green vibrant leaf accent
  doc.setFillColor(34, 197, 94); // emerald-500
  doc.ellipse(x + radius * 0.25, y - radius * 0.1, radius * 0.35, radius * 0.45, 'F');
  doc.restoreGraphicsState();
}

/**
 * Render a single slip for a specific copy
 */
function renderInvoiceSlip(
  doc: jsPDF,
  invoice: FeeInvoiceData,
  copyLabel: string, // e.g. "FAMILY COPY", "SCHOOL COPY"
  startY: number
): number {
  const marginX = 14;
  const pageWidth = 210;
  const contentWidth = pageWidth - marginX * 2; // 182mm

  // 1. School Header
  const logoX = marginX + 6;
  const logoY = startY + 6;
  drawSchoolLogo(doc, logoX, logoY, 5.5);

  // School name & address (left)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(invoice.school.name, marginX + 15, startY + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(invoice.school.address, marginX + 15, startY + 9.5);

  // Phone & Email (right)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text(`Phone: ${invoice.school.phone}`, pageWidth - marginX, startY + 5.5, { align: 'right' });
  doc.text(`Email: ${invoice.school.email}`, pageWidth - marginX, startY + 9.5, { align: 'right' });

  // 2. Invoice To & Date Bar (bordered strip)
  const barY = startY + 14;
  const barHeight = 8;
  doc.setFillColor(248, 250, 252); // slate-50
  doc.rect(marginX, barY, contentWidth, barHeight, 'F');
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.2);
  doc.rect(marginX, barY, contentWidth, barHeight, 'S');

  // Left: INVOICE TO
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('INVOICE TO : ', marginX + 3, barY + 5.2);
  
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  const guardianText = `${invoice.invoiceTo.guardianName} (${invoice.invoiceTo.familyId})`;
  doc.text(guardianText, marginX + 24, barY + 5.2);

  // Right: PAYMENT DATE & INVOICE NO
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  const dateLabel = 'PAYMENT DATE : ';
  const dateVal = `${invoice.formattedDateOnly}   `;
  const invLabel = 'Invoice No: ';
  const invVal = invoice.invoiceNumber;

  const rightText = `${dateLabel}${dateVal}  ${invLabel}${invVal}`;
  doc.setFont('helvetica', 'normal');
  doc.text(rightText, pageWidth - marginX - 3, barY + 5.2, { align: 'right' });

  // 3. Items Table
  // Build rows grouped by student
  const tableRows: any[] = [];
  
  invoice.students.forEach(stGroup => {
    // Header for student
    const studentHeader = `STUDENT: ${stGroup.studentName.toUpperCase()} (${stGroup.studentRollNo || stGroup.studentId})`;
    tableRows.push([
      {
        content: studentHeader,
        colSpan: 5,
        styles: {
          fontStyle: 'bold',
          textColor: [15, 23, 42],
          fillColor: [241, 245, 249],
          fontSize: 7.5,
          cellPadding: { top: 2, bottom: 2, left: 3, right: 3 }
        }
      }
    ]);

    // Items
    stGroup.items.forEach(item => {
      tableRows.push([
        item.month,
        item.purpose,
        item.className,
        item.discountDisplay,
        item.feeDisplay
      ]);
    });
  });

  autoTable(doc, {
    startY: barY + barHeight + 2,
    margin: { left: marginX, right: marginX },
    head: [['MONTH', 'PURPOSE', 'CLASS', 'DISCOUNT', 'FEE']],
    body: tableRows,
    theme: 'plain',
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [71, 85, 105],
      fontStyle: 'bold',
      fontSize: 7,
      cellPadding: { top: 2, bottom: 2, left: 3, right: 3 },
      lineColor: [203, 213, 225],
      lineWidth: { bottom: 0.3 }
    },
    styles: {
      fontSize: 7,
      textColor: [30, 41, 59],
      cellPadding: { top: 1.5, bottom: 1.5, left: 3, right: 3 },
      lineColor: [241, 245, 249],
      lineWidth: { bottom: 0.15 }
    },
    columnStyles: {
      0: { cellWidth: 32 }, // Month
      1: { cellWidth: 58 }, // Purpose
      2: { cellWidth: 28 }, // Class
      3: { cellWidth: 28, halign: 'center' }, // Discount
      4: { cellWidth: 36, halign: 'right', fontStyle: 'bold' } // Fee
    }
  });

  const finalTableY = (doc as any).lastAutoTable?.finalY || (barY + barHeight + 30);

  // 4. Slip Footer
  const footerY = finalTableY + 4;
  
  // Left: COPY BADGE + Attribution
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(`${copyLabel.toUpperCase()} (PAID)`, marginX + 3, footerY + 2.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(148, 163, 184);
  doc.text('A product of devxcel.com | Get School Software at schooliee.com', marginX + 3, footerY + 6.5);

  // Right: Total Paid
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  const totalPaidText = `Total Paid:    ${invoice.paidAmount.toLocaleString()} PKR`;
  doc.text(totalPaidText, pageWidth - marginX - 3, footerY + 3.5, { align: 'right' });

  return footerY + 11;
}

/**
 * Generates and downloads the Fee Invoice PDF with:
 * - 1 Family Copy
 * - 2 School Copies
 * (As requested: "two copies on school and one family copy.as sown in inoive pdf")
 */
export function generateFeeInvoicePdf(
  invoice: FeeInvoiceData,
  fileName?: string
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const marginX = 14;
  const pageWidth = 210;

  // Slip 1: FAMILY COPY (PAID)
  const slip1EndY = renderInvoiceSlip(doc, invoice, 'FAMILY COPY', 10);

  // Separator cut line
  const divider1Y = Math.max(slip1EndY + 2, 142);
  doc.saveGraphicsState();
  doc.setDrawColor(180, 190, 205);
  doc.setLineWidth(0.3);
  doc.setLineDashPattern([2.5, 2.5], 0);
  doc.line(marginX, divider1Y, pageWidth - marginX, divider1Y);
  
  // Scissor mark
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text('✂ - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -', pageWidth / 2, divider1Y - 0.5, { align: 'center' });
  doc.restoreGraphicsState();

  // Slip 2: SCHOOL COPY 1 (PAID)
  renderInvoiceSlip(doc, invoice, 'SCHOOL COPY', divider1Y + 7);

  // Page 2: SCHOOL COPY 2 (PAID) (The second school copy)
  doc.addPage('a4', 'portrait');
  renderInvoiceSlip(doc, invoice, 'SCHOOL COPY (OFFICE)', 10);

  const finalFileName = fileName || `Invoice_${invoice.invoiceNumber}_${invoice.invoiceTo.familyId}.pdf`;
  doc.save(finalFileName);
}
