import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Student, CardTemplateType, FamilyData } from '../types';
import { getSchoolSettings } from './settingsHelper';
import { getStudentAvatar } from './studentAvatarHelper';
import { code39Spans } from './barcode';

export interface SchoolInfo {
  name: string;
  campus: string;
  session: string;
  phone: string;
  address: string;
}

export function getLiveSchoolInfo(): SchoolInfo {
  // Raw settings values only — no baked-in fallback identity. Blank stays
  // blank, so a school that has not filled in Settings prints nothing fake.
  const s = getSchoolSettings();
  return {
    name: s.schoolName,
    campus: s.campusName,
    session: s.session,
    phone: s.schoolPhone,
    address: s.schoolAddress,
  };
}

/**
 * Join non-empty display parts with ' • '. Blank settings fields are
 * omitted entirely, so document headers never print dangling separators
 * or labels for values the school has not entered.
 */
export function joinInfoParts(parts: (string | undefined | null)[]): string {
  return parts.filter((p): p is string => !!p && p.trim() !== '').join(' • ');
}

export const DEFAULT_SCHOOL: SchoolInfo = {
  get name() { return getLiveSchoolInfo().name; },
  get campus() { return getLiveSchoolInfo().campus; },
  get session() { return getLiveSchoolInfo().session; },
  get phone() { return getLiveSchoolInfo().phone; },
  get address() { return getLiveSchoolInfo().address; },
};

// Generates a single vertical ID Card PDF (54mm x 85.6mm standard ID card CR80 size)
// `pdfLogo` is an optional pre-rasterized (PNG/JPEG/WebP data URI) school
// logo for the Vertical Badge template — settings store preset logos as
// SVG, which jsPDF cannot embed, so callers rasterize them first via
// rasterizeLogoForPdf(). Absent/empty = previous behavior (monogram).
export function generateSingleIdCard(
  student: Student,
  template?: CardTemplateType,
  school: SchoolInfo = getLiveSchoolInfo(),
  pdfLogo?: string
) {
  const activeTemplate = template || getSchoolSettings().studentIdCardTemplate || 'modern-tech';
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [54, 86] // standard vertical ID card
  });

  renderCardOnPage(doc, student, activeTemplate, school, pdfLogo);
  if (activeTemplate === 'vertical-badge') {
    // Vertical Badge cards are two-sided: front, then back on page 2.
    doc.addPage([54, 86], 'portrait');
    renderVerticalBadgeBack(doc, student, school, pdfLogo);
  }
  doc.save(`${student.id}_${student.name.replace(/\s+/g, '_')}_IDCard.pdf`);
}

// Generates all student cards in a single combined PDF (1 page per card)
export function generateAllIdCards(
  students: Student[],
  template?: CardTemplateType,
  school: SchoolInfo = getLiveSchoolInfo(),
  pdfLogo?: string
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
    renderCardOnPage(doc, student, activeTemplate, school, pdfLogo);
    if (activeTemplate === 'vertical-badge') {
      // Back of this student's card immediately follows its front (duplex).
      doc.addPage([54, 86], 'portrait');
      renderVerticalBadgeBack(doc, student, school, pdfLogo);
    }
  });

  doc.save(`All_Students_ID_Cards_${activeTemplate}_(${students.length}).pdf`);
}

// Render student card content into the current page of doc
function renderCardOnPage(doc: jsPDF, student: Student, template: CardTemplateType, school: SchoolInfo, pdfLogo?: string) {
  const width = 54;
  const height = 86;

  // Resolve the photo through the avatar helper: students without an uploaded
  // photo print the default boy/girl DP on every card template, and records
  // still holding a legacy default-URL value are healed the same way. The
  // initials fallback in each template still applies if addImage ever fails.
  const cardPhoto = getStudentAvatar(student);

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
    if (cardPhoto) {
      try {
        doc.addImage(cardPhoto, photoX, photoY, photoSize, photoSize);
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

  } else if (template === 'classic-academic') {
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
    if (cardPhoto) {
      try {
        doc.addImage(cardPhoto, px + 0.5, py + 0.5, pSize - 1, pSize - 1);
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
      { label: 'Blood Group:', val: student.bloodGroup || 'N/A' },
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
  } else if (template === 'vertical-badge') {
    // Template 3: Vertical Badge — REDESIGNED 2026-11-07 after the owner
    // downloaded a card and reported: (1) the card looked distorted,
    // (2) the barcode was scattered, (3) the back side was missing,
    // (4) text was too small with lots of empty space.
    // This front now: cover-fits the photo via clipping (never stretches
    // it), prints a REAL Code 39 barcode of the student id
    // (src/utils/barcode.ts), and uses larger type with the detail rows
    // spread evenly to fill the card. The matching back page is
    // renderVerticalBadgeBack() below; the generate functions add it as
    // page 2 for this template only.
    // Deep navy card, steel-blue "STUDENT ID" strip down the left edge,
    // steel-blue band across the bottom. NO punch hole / lanyard slot.
    // Only fields that exist in the system are printed; there is
    // deliberately no "Teacher" line — the system has no class-teacher
    // field. Content is centered on the zone right of the strip (x 8..54).
    const NAVY: [number, number, number] = [13, 39, 66]; // #0D2742
    const STEEL: [number, number, number] = [141, 180, 200]; // #8DB4C8
    const STEEL_LIGHT: [number, number, number] = [190, 215, 228];
    const PALE: [number, number, number] = [226, 240, 248];
    const INNER: [number, number, number] = [27, 54, 84]; // lighter navy (photo fallback)
    const CX = 31; // center of the content zone (x 8..54)
    const ZONE_W = 42; // usable text width inside the zone (x 10..52)
    const BAND_Y = 74;

    // Card background
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, width, height, 'F');

    // Left strip (stops at the bottom band) + bottom band (full width)
    doc.setFillColor(...STEEL);
    doc.rect(0, 0, 8, BAND_Y, 'F');
    doc.rect(0, BAND_Y, width, height - BAND_Y, 'F');

    // "STUDENT ID" written vertically, bottom-to-top, inside the strip
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...NAVY);
    const stripText = 'STUDENT ID';
    doc.text(stripText, 5, BAND_Y / 2 + doc.getTextWidth(stripText) / 2, { angle: 90 });

    // School logo: raster logo cover-clipped into a rounded square, else a
    // steel monogram disc with the school initials (SVG preset logos
    // cannot be embedded by jsPDF, so they take the monogram path unless
    // the caller passed a pre-rasterized copy as pdfLogo).
    const logo = pdfLogo || getSchoolSettings().schoolLogo || '';
    let renderedLogo = false;
    if (/^data:image\/(png|jpe?g|webp)/i.test(logo)) {
      renderedLogo = drawImageCover(doc, logo, CX - 5, 4, 10, 10, 2);
    }
    if (!renderedLogo) {
      doc.setFillColor(...STEEL);
      doc.circle(CX, 9, 5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      doc.setTextColor(...NAVY);
      doc.text(schoolInitials(school.name), CX, 10.1, { align: 'center' });
    }

    // School name (shrink-to-fit) + campus • session line
    doc.setTextColor(255, 255, 255);
    const schoolNameFit = fitText(doc, school.name, ZONE_W, 'helvetica', 'bold', 9.5, 7);
    doc.text(schoolNameFit, CX, 17.5, { align: 'center' });

    doc.setTextColor(...STEEL_LIGHT);
    const campusLine = fitText(doc, joinInfoParts([school.campus, school.session]), ZONE_W, 'helvetica', 'normal', 6.5, 5.5);
    doc.text(campusLine, CX, 21, { align: 'center' });

    // Photo: steel frame; the image is COVER-fitted (fills the square,
    // center-cropped via a clip path) so it is never stretched. Initials
    // remain as the safety net if there is no usable image at all.
    const frameX = CX - 11.5;
    const frameY = 24;
    const frameS = 23;
    doc.setFillColor(...STEEL);
    doc.roundedRect(frameX, frameY, frameS, frameS, 2, 2, 'F');
    const imgX = frameX + 0.75;
    const imgY = frameY + 0.75;
    const imgS = frameS - 1.5; // 21.5
    doc.setFillColor(...INNER);
    doc.roundedRect(imgX, imgY, imgS, imgS, 1.5, 1.5, 'F');
    const drewPhoto = cardPhoto ? drawImageCover(doc, cardPhoto, imgX, imgY, imgS, imgS, 1.5) : false;
    if (!drewPhoto) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(...PALE);
      doc.text(student.name.substring(0, 2).toUpperCase(), CX, imgY + imgS / 2 + 2.3, { align: 'center' });
    }

    // Student name (large, shrink-to-fit)
    doc.setTextColor(...PALE);
    const studentNameFit = fitText(doc, student.name, ZONE_W, 'helvetica', 'bold', 12, 8.5);
    doc.text(studentNameFit, CX, 52, { align: 'center' });

    // Detail rows: at most 4, picked by priority from fields that exist
    // (Session already appears in the header line, so it is not repeated).
    // Rows spread evenly across y55..73, so 2 rows spread out and 4 rows
    // pack in — the block always fills its space.
    const detailRows: { label: string; val: string }[] = [
      { label: 'CLASS', val: `${student.class} - ${student.section}` }
    ];
    if (student.family && student.family.trim()) detailRows.push({ label: 'GUARDIAN', val: student.family });
    if (student.dob) detailRows.push({ label: 'DOB', val: student.dob });
    if (student.rollNo) detailRows.push({ label: 'ROLL NO', val: String(student.rollNo) });
    if (student.phone) detailRows.push({ label: 'PHONE', val: student.phone });
    if (student.bloodGroup) detailRows.push({ label: 'BLOOD GROUP', val: student.bloodGroup });
    const shownRows = detailRows.slice(0, 4);
    const blockTop = 55;
    const rowH = (73 - blockTop) / shownRows.length;
    shownRows.forEach((row, idx) => {
      const y = blockTop + rowH * idx + rowH * 0.7;
      doc.setTextColor(...STEEL_LIGHT);
      const labelFit = fitText(doc, row.label, 14.3, 'helvetica', 'bold', 6.8, 5.2);
      doc.text(labelFit, 11, y);
      doc.setTextColor(255, 255, 255);
      const valFit = fitText(doc, row.val, 25.7, 'helvetica', 'normal', 7.5, 6.3);
      doc.text(valFit, 26.3, y);
    });

    // Bottom band: white strip with a REAL Code 39 barcode of the student
    // id (crisp uniform modules, quiet zones both sides) + ID line below.
    doc.setFillColor(255, 255, 255);
    doc.rect(6, 76.5, 42, 5.5, 'F');
    const idValue = (student.id || '').trim();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...NAVY);
    if (idValue) {
      const { bars, totalUnits } = code39Spans(idValue);
      if (bars.length > 0 && totalUnits > 0) {
        const moduleW = 42 / (totalUnits + 10); // 10 units of quiet zone, split 5/5
        const originX = 6 + 5 * moduleW;
        doc.setFillColor(0, 0, 0);
        bars.forEach(b => {
          doc.rect(originX + b.start * moduleW, 77, b.width * moduleW, 4.5, 'F');
        });
      }
      doc.text(`ID: ${idValue}`, width / 2, 84.8, { align: 'center' });
    } else {
      doc.text('ID: ', width / 2, 81.5, { align: 'center' });
    }
  }
}

// ---------------------------------------------------------------------------
// Shared helpers for the Vertical Badge card (front + back)
// ---------------------------------------------------------------------------

/** First letters of the first two words of the school name, e.g. "DS". */
function schoolInitials(name: string): string {
  const initials = (name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w.charAt(0).toUpperCase())
    .join('');
  return initials || 'S';
}

/**
 * Sets the doc font and shrinks the size (base → min in 0.5 steps) until
 * `text` fits `maxWidth` mm; truncates with '…' if it still does not fit
 * at the minimum size. Returns the text to draw; the doc is left at the
 * final font/size, ready for doc.text.
 */
function fitText(doc: jsPDF, text: string, maxWidth: number, font: string, style: string, base: number, min: number): string {
  doc.setFont(font, style);
  let size = base;
  doc.setFontSize(size);
  while (size > min && doc.getTextWidth(text) > maxWidth) {
    size = Math.max(min, size - 0.5);
    doc.setFontSize(size);
  }
  let t = text;
  if (doc.getTextWidth(t) > maxWidth) {
    while (t.length > 1 && doc.getTextWidth(t + '…') > maxWidth) t = t.slice(0, -1);
    t = t.trimEnd() + '…';
  }
  return t;
}

/** Decodes just the head of a base64 data URI (enough for image headers). */
function dataUriHeadBytes(dataUri: string, maxBytes = 65536): Uint8Array | null {
  const comma = dataUri.indexOf(',');
  if (comma < 0) return null;
  const b64 = dataUri.slice(comma + 1, comma + 1 + Math.ceil(maxBytes / 3) * 4);
  const usable = b64.slice(0, b64.length - (b64.length % 4));
  try {
    const bin = atob(usable.replace(/\s/g, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

/**
 * Natural pixel size of a PNG / JPEG / WebP data URI, read from the file
 * header (no DOM Image needed, so it also works in the node harness).
 * PNG: big-endian uint32 at bytes 16..23. JPEG: scan for SOF0/SOF1/SOF2.
 * WebP: VP8X / VP8L / lossy VP8 chunk headers. Null when unrecognised.
 */
function imageNaturalSize(dataUri: string): { w: number; h: number } | null {
  if (!dataUri || !dataUri.startsWith('data:image/')) return null;
  const b = dataUriHeadBytes(dataUri);
  if (!b || b.length < 30) return null;
  const u16be = (o: number) => (b[o] << 8) | b[o + 1];
  const u32be = (o: number) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
  const u16le = (o: number) => b[o] | (b[o + 1] << 8);
  const u24le = (o: number) => b[o] | (b[o + 1] << 8) | (b[o + 2] << 16);

  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    const w = u32be(16);
    const h = u32be(20);
    return w > 0 && h > 0 ? { w, h } : null;
  }
  if (b[0] === 0xff && b[1] === 0xd8) {
    let o = 2;
    while (o + 9 < b.length) {
      if (b[o] !== 0xff) { o++; continue; }
      const marker = b[o + 1];
      if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
        const w = u16be(o + 7);
        const h = u16be(o + 5);
        return w > 0 && h > 0 ? { w, h } : null;
      }
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) { o += 2; continue; }
      const len = u16be(o + 2);
      if (len < 2) return null;
      o += 2 + len;
    }
    return null;
  }
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) {
    const chunk = String.fromCharCode(b[12], b[13], b[14], b[15]);
    if (chunk === 'VP8X') return { w: u24le(24) + 1, h: u24le(27) + 1 };
    if (chunk === 'VP8L') {
      return {
        w: (b[21] | ((b[22] & 0x3f) << 8)) + 1,
        h: ((b[22] >> 6) | (b[23] << 2) | ((b[24] & 0x0f) << 10)) + 1
      };
    }
    if (chunk === 'VP8 ') return { w: u16le(26) & 0x3fff, h: u16le(28) & 0x3fff };
  }
  return null;
}

/**
 * Draws an image COVER-fitted into the (x, y, w, h) box: scaled so it
 * fills the box completely, overflow center-cropped with a rounded-rect
 * clip. The image is NEVER stretched, so circles stay circles. Returns
 * false if the image could not be drawn at all (caller falls back to
 * initials). An unknown natural size is treated as square.
 */
export function drawImageCover(doc: jsPDF, img: string, x: number, y: number, w: number, h: number, radius: number): boolean {
  if (!img) return false;
  const size = imageNaturalSize(img);
  const iw = size && size.w > 0 ? size.w : 1;
  const ih = size && size.h > 0 ? size.h : 1;
  const scale = Math.max(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) / 2;
  let pushed = false;
  try {
    doc.saveGraphicsState();
    pushed = true;
    // The path style MUST be null: a painted fill/stroke would consume the
    // path and turn clip() into a no-op (verified against jsPDF 4.x).
    doc.roundedRect(x, y, w, h, radius, radius, null);
    doc.clip();
    doc.discardPath();
    doc.addImage(img, dx, dy, dw, dh);
    doc.restoreGraphicsState();
    pushed = false;
    return true;
  } catch (e) {
    if (pushed) {
      try { doc.restoreGraphicsState(); } catch { /* already balanced */ }
    }
    console.warn('Could not draw cover image in PDF:', e);
    return false;
  }
}

/**
 * Back page of the Vertical Badge card (page 2 of the card PDF, so a
 * duplex print lines up front/back). Navy, no strip: school identity,
 * student identity, family contact rows, school contact block, principal
 * signature, and the return-to-school band. Only fields that exist are
 * printed; the blocks flow so fuller records simply use more of the card,
 * and nothing is allowed to run into the signature or the bottom band.
 */
function renderVerticalBadgeBack(doc: jsPDF, student: Student, school: SchoolInfo, pdfLogo?: string) {
  const NAVY: [number, number, number] = [13, 39, 66];
  const STEEL: [number, number, number] = [141, 180, 200];
  const STEEL_LIGHT: [number, number, number] = [190, 215, 228];
  const PALE: [number, number, number] = [203, 225, 238];
  const CX = 27;
  const settings = getSchoolSettings();

  doc.setFillColor(...NAVY);
  doc.rect(0, 0, 54, 86, 'F');

  // Logo / monogram, Ø12mm (pdfLogo = caller-rasterized copy of the
  // settings logo, since jsPDF cannot embed the SVG presets directly)
  const logo = pdfLogo || settings.schoolLogo || '';
  let renderedLogo = false;
  if (/^data:image\/(png|jpe?g|webp)/i.test(logo)) {
    renderedLogo = drawImageCover(doc, logo, CX - 6, 5, 12, 12, 2);
  }
  if (!renderedLogo) {
    doc.setFillColor(...STEEL);
    doc.circle(CX, 11, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...NAVY);
    doc.text(schoolInitials(school.name), CX, 12.3, { align: 'center' });
  }

  // School name + campus
  doc.setTextColor(255, 255, 255);
  const schoolNameFit = fitText(doc, school.name, 46, 'helvetica', 'bold', 9.5, 7);
  doc.text(schoolNameFit, CX, 21.5, { align: 'center' });
  doc.setTextColor(...STEEL_LIGHT);
  const campusFit = fitText(doc, school.campus, 46, 'helvetica', 'normal', 6.5, 5.5);
  doc.text(campusFit, CX, 25, { align: 'center' });

  // Divider
  doc.setDrawColor(...STEEL);
  doc.setLineWidth(0.4);
  doc.line(8, 27, 46, 27);

  // Student identity
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...STEEL);
  doc.text('STUDENT', CX, 33, { align: 'center' });

  doc.setTextColor(255, 255, 255);
  const studentNameFit = fitText(doc, student.name, 46, 'helvetica', 'bold', 10.5, 8);
  doc.text(studentNameFit, CX, 37.5, { align: 'center' });

  doc.setTextColor(...PALE);
  const idLine = fitText(doc, `${student.id} • ${student.class} – ${student.section}`, 46, 'helvetica', 'normal', 7, 6);
  doc.text(idLine, CX, 42, { align: 'center' });

  // School contact lines are computed first: their count decides how many
  // lines the student address may wrap to, so the two blocks never meet.
  // Address and phone come from SchoolInfo; email exists only in the
  // school settings, so it is read from there directly. (The school
  // website is deliberately NOT printed on the card back.)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  const schoolLines: string[] = [];
  if (school.address && school.address.trim()) {
    const wrapped = doc.splitTextToSize(school.address, 44) as string[];
    const kept = wrapped.slice(0, 2);
    if (wrapped.length > 2 && kept.length === 2) {
      let last = kept[1];
      while (last.length > 1 && doc.getTextWidth(last + '…') > 44) last = last.slice(0, -1);
      kept[1] = last.trimEnd() + '…';
    }
    schoolLines.push(...kept);
  }
  if (school.phone && school.phone.trim()) schoolLines.push(school.phone);
  if (settings.schoolEmail && settings.schoolEmail.trim()) schoolLines.push(settings.schoolEmail);

  // Contact rows (left-aligned): Guardian, Phone, Emergency, Address
  interface ContactRow { label: string; lines: string[]; size: number }
  const rows: ContactRow[] = [];
  if (student.family && student.family.trim()) rows.push({ label: 'GUARDIAN', lines: [student.family], size: 7.5 });
  if (student.phone && student.phone.trim()) rows.push({ label: 'PHONE', lines: [student.phone], size: 7.5 });
  if (student.emergencyContact && student.emergencyContact.trim() && student.emergencyContact !== student.phone) {
    rows.push({ label: 'EMERGENCY', lines: [student.emergencyContact], size: 7.5 });
  }
  if (student.address && student.address.trim()) {
    const addrMax = schoolLines.length >= 5 ? 2 : 3;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    let lines = doc.splitTextToSize(student.address, 26) as string[];
    if (lines.length > addrMax) {
      lines = lines.slice(0, addrMax);
      let last = lines[addrMax - 1];
      while (last.length > 1 && doc.getTextWidth(last + '…') > 26) last = last.slice(0, -1);
      lines[addrMax - 1] = last.trimEnd() + '…';
    }
    rows.push({ label: 'ADDRESS', lines, size: 7 });
  }

  let cy = 48;
  let lastBaseline = 44.5;
  rows.forEach(row => {
    doc.setTextColor(...STEEL_LIGHT);
    const labelFit = fitText(doc, row.label, 16, 'helvetica', 'bold', 6.5, 5.5);
    doc.text(labelFit, 7, cy);
    doc.setTextColor(255, 255, 255);
    row.lines.forEach((ln, li) => {
      const t = fitText(doc, ln, 26, 'helvetica', 'normal', row.size, 6.5);
      const ly = cy + li * 3.3;
      doc.text(t, 24, ly);
      lastBaseline = ly;
    });
    cy += 4.7 + (row.lines.length - 1) * 3.3;
  });

  // School contact block (centered, pale), flowing under the contact rows
  // with an adaptive line step so it always ends above the signature.
  // The guard reserves room for a SCHOOL caption above the block (same
  // style as the STUDENT caption), so the school's address can never be
  // mistaken for the student's own address row above it.
  if (schoolLines.length > 0) {
    const sy = Math.max(64.0, lastBaseline + 4.5);
    const n = schoolLines.length;
    const step = n > 1 ? Math.min(3.35, Math.max(2.55, (75.2 - sy) / (n - 1))) : 3.35;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...STEEL);
    doc.text('SCHOOL', CX, sy - 2.15, { align: 'center' });
    doc.setTextColor(...PALE);
    schoolLines.forEach((ln, i) => {
      const t = fitText(doc, ln, 46, 'helvetica', 'normal', 7, 6.2);
      doc.text(t, CX, sy + i * step, { align: 'center' });
    });
  }

  // Verified seal (left, subtle — same idea as the classic template)
  doc.setDrawColor(...STEEL);
  doc.setLineWidth(0.3);
  doc.circle(10.5, 76.6, 2.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(2.6);
  doc.setTextColor(...STEEL);
  doc.text('VERIFIED', 10.5, 77.05, { align: 'center' });

  // Principal signature (right)
  doc.setDrawColor(...STEEL_LIGHT);
  doc.setLineWidth(0.3);
  doc.line(33, 77.4, 50, 77.4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5);
  doc.setTextColor(...STEEL_LIGHT);
  doc.text('Principal Signature', 41.5, 79.6, { align: 'center' });

  // Bottom band
  doc.setFillColor(...STEEL);
  doc.rect(0, 80, 54, 6, 'F');
  doc.setTextColor(...NAVY);
  const bandText = fitText(doc, 'If found, please return to the school office.', 50, 'helvetica', 'bold', 6.5, 5.5);
  doc.text(bandText, CX, 84.3, { align: 'center' });
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
