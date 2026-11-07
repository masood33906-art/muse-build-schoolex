import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Student } from '../types';
import { loadAllLedgerItems, StudentFeeItem } from './studentFeeLedgerHelper';
import { listPayments, FeePayment } from './paymentStore';

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

export type FeeInvoiceStatus = 'Paid' | 'Partially Paid' | 'Unpaid';

export interface FeeInvoiceData {
  invoiceNumber: string; // the payment's receipt number, e.g. "REC-2026-0001"
  paymentId?: string; // the FeePayment.id this invoice was issued for
  paymentDate: string; // e.g. "16 Sep 2026 04:03 PM"
  formattedDateOnly: string; // e.g. "16 Sep 2026"
  paymentMethod: string; // e.g. "Cash", "Bank Transfer"
  status: FeeInvoiceStatus;
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
  subtotal: number; // sum of the CURRENT charges of the invoiced items
  paidAmount: number; // total paid toward those items TO DATE (all payments)
  balanceDue: number; // subtotal - paidAmount, never negative
  note?: string;
}

export interface FeeInvoiceContext {
  school: FeeInvoiceData['school'];
  invoiceTo: FeeInvoiceData['invoiceTo'];
  note?: string;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad2 = (n: number) => n.toString().padStart(2, '0');

function purposeNameOf(item: StudentFeeItem): string {
  if (item.type === 'Fund') return item.reason.startsWith('Fund') ? item.reason : `Fund - (${item.reason})`;
  if (item.type === 'Admission') return 'Admission Fee';
  if (item.type === 'Security') return 'Security Fee';
  if (item.type === 'Monthly Fee') return 'Monthly Fee';
  if (item.type === 'Fine') return 'Fine';
  return item.reason || item.type;
}

/**
 * Build an invoice for a recorded payment from the LIVE fee ledger.
 *
 * The invoice's scope is the set of ledger items that payment was
 * allocated to, but every figure is read from the CURRENT ledger:
 * each item's charge is its current `total`, its paid figure is its
 * current `paidAmount` (i.e. paid to date across ALL payments, not
 * just this receipt), and the summary is derived from those:
 * subtotal = Σ charges, total paid = Σ paid-to-date, balance =
 * subtotal − paid. The three can therefore never disagree, and
 * rebuilding the same receipt's invoice after further payments
 * shows the new reality instead of the frozen moment of issue.
 */
export function buildFeeInvoiceData(
  payment: FeePayment,
  students: Student[],
  context: FeeInvoiceContext
): FeeInvoiceData {
  const ledgers = loadAllLedgerItems();
  const allocatedKeys = new Set(payment.allocations.map(a => `${a.studentId}|${a.itemId}`));

  const groups: FeeInvoiceStudentGroup[] = [];
  let subtotal = 0;
  let paidTotal = 0;

  students.forEach(st => {
    const scoped = (ledgers[st.id] ?? [])
      .filter(item => allocatedKeys.has(`${st.id}|${item.id}`))
      .sort((a, b) =>
        a.monthKey.localeCompare(b.monthKey) ||
        (a.type === 'Admission' ? -1 : b.type === 'Admission' ? 1 : 0)
      );
    if (scoped.length === 0) return;

    let stSubtotal = 0;
    let stPaid = 0;
    const items: FeeInvoiceItem[] = scoped.map(item => {
      const discount = (item.discount || 0) + (item.additionalDiscount || 0);
      stSubtotal += item.total;
      stPaid += item.paidAmount;
      return {
        id: item.id,
        studentId: st.id,
        studentName: st.name,
        studentRollNo: st.rollNo || st.id,
        purpose: purposeNameOf(item),
        month: item.month,
        className: (item.type === 'Admission' || item.type === 'Security') ? '-' : (st.class || '-'),
        discount,
        discountDisplay: discount > 0 ? `${discount.toLocaleString()} PKR` : '-',
        fee: item.total,
        // The format this interface always documented: "paid / total"
        // while anything is still owed, plain total once settled.
        feeDisplay: item.paidAmount >= item.total
          ? `${item.total.toLocaleString()} PKR`
          : `${item.paidAmount.toLocaleString()} / ${item.total.toLocaleString()} PKR`,
        paidAmount: item.paidAmount
      };
    });

    groups.push({
      studentId: st.id,
      studentName: st.name,
      studentRollNo: st.rollNo || st.id,
      className: st.class || '-',
      items,
      studentSubtotal: stSubtotal,
      studentPaid: stPaid
    });
    subtotal += stSubtotal;
    paidTotal += stPaid;
  });

  const balanceDue = Math.max(0, subtotal - paidTotal);
  const status: FeeInvoiceStatus =
    subtotal > 0 && balanceDue === 0 ? 'Paid' : paidTotal > 0 ? 'Partially Paid' : 'Unpaid';

  const created = new Date(payment.createdAt || payment.date);
  const validDate = !Number.isNaN(created.getTime());
  const formattedDateOnly = validDate
    ? `${pad2(created.getDate())} ${MONTH_NAMES[created.getMonth()]} ${created.getFullYear()}`
    : payment.date;
  let paymentDate = formattedDateOnly;
  if (validDate) {
    let hours = created.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    paymentDate = `${formattedDateOnly} ${pad2(hours)}:${pad2(created.getMinutes())} ${ampm}`;
  }

  return {
    invoiceNumber: payment.receiptNo,
    paymentId: payment.id,
    paymentDate,
    formattedDateOnly,
    paymentMethod: payment.method,
    status,
    school: context.school,
    invoiceTo: context.invoiceTo,
    students: groups,
    subtotal,
    paidAmount: paidTotal,
    balanceDue,
    note: context.note ?? payment.note
  };
}

/**
 * Rebuild a previously issued invoice from live data. Finds the
 * payment the snapshot was issued for (by payment id, else by
 * receipt number) and rebuilds it with buildFeeInvoiceData, keeping
 * the snapshot's school / invoice-to identity. Returns null when the
 * payment no longer exists or was voided — the caller then keeps
 * showing the snapshot it already has.
 */
export function rebuildFeeInvoiceData(
  snapshot: FeeInvoiceData,
  students: Student[]
): FeeInvoiceData | null {
  const payments = listPayments();
  const payment = (snapshot.paymentId
    ? payments.find(p => p.id === snapshot.paymentId)
    : undefined) ?? payments.find(p => p.receiptNo === snapshot.invoiceNumber);
  if (!payment || payment.voidedAt) return null;
  const rebuilt = buildFeeInvoiceData(payment, students, {
    school: snapshot.school,
    invoiceTo: snapshot.invoiceTo,
    note: snapshot.note
  });
  return rebuilt.students.length > 0 ? rebuilt : null;
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

  // Left: COPY BADGE + Attribution. The badge carries the invoice's
  // REAL status — a partially paid invoice is no longer stamped PAID.
  const statusLabel = invoice.status === 'Paid'
    ? 'PAID'
    : invoice.status === 'Partially Paid'
      ? 'PARTIALLY PAID'
      : 'UNPAID';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(`${copyLabel.toUpperCase()} (${statusLabel})`, marginX + 3, footerY + 2.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(148, 163, 184);
  doc.text('A product of devxcel.com | Get School Software at schooliee.com', marginX + 3, footerY + 6.5);

  // Right: the three summary figures, always mutually consistent
  // (Subtotal − Total Paid = Balance Due) because all three are
  // derived from the same live ledger items.
  const totalsX = pageWidth - marginX - 3;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Subtotal:    ${invoice.subtotal.toLocaleString()} PKR`, totalsX, footerY + 1, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`Total Paid:    ${invoice.paidAmount.toLocaleString()} PKR`, totalsX, footerY + 5, { align: 'right' });

  doc.setFontSize(8.5);
  if (invoice.balanceDue > 0) doc.setTextColor(185, 28, 28);
  doc.text(`Balance Due:    ${invoice.balanceDue.toLocaleString()} PKR`, totalsX, footerY + 9, { align: 'right' });
  doc.setTextColor(15, 23, 42);

  return footerY + 12;
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
