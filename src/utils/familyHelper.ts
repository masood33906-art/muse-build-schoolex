import { Student, FamilyData } from '../types';

/**
 * Groups an array of students by family/guardian into structured FamilyData records
 */
export function groupStudentsIntoFamilies(students: Student[]): FamilyData[] {
  const map = new Map<string, FamilyData>();

  students.forEach((student) => {
    const key = (student.familyId || student.family || 'unknown').trim().toLowerCase();
    if (!map.has(key)) {
      // Blank in → blank shown/stored (owner rule, 2026-11-08): every
      // descriptive field below takes the student's OWN value or stays
      // empty. The old fallbacks fabricated a CNIC ('7647646475'), an
      // occupation ('Business' / 'Homemaker'), an email
      // ('guardian@school.edu.pk'), a religion ('Islam') and a full
      // street address ('House #14, Sector G-10, Islamabad') — and
      // because the Family Details edit form initializes from this
      // record, pressing Save there wrote those inventions onto every
      // student in the family. phone/whatsapp/emergencyContact still
      // fall back to the family's OWN other number (derived contact
      // view of real data, never a foreign value).
      map.set(key, {
        familyId: student.familyId || '',
        familyName: student.family || '',
        phone: student.phone || student.emergencyContact || '',
        guardianCnic: student.guardianCnic || '',
        guardianOccupation: student.guardianOccupation || '',
        motherName: student.motherName || '',
        motherCnic: student.motherCnic || '',
        motherOccupation: student.motherOccupation || '',
        whatsapp: student.whatsapp || student.phone || '',
        email: student.email || '',
        address: student.address || '',
        caste: student.caste || '',
        religion: student.religion || '',
        emergencyContact: student.emergencyContact || student.phone,
        notes: student.note || '',
        students: [],
        totalDue: 0,
        totalPaid: 0
      });
    }
    const group = map.get(key)!;
    group.students.push(student);
    
    // Update with student's guardian info if missing
    if (!group.phone && student.phone) group.phone = student.phone;
    if (!group.guardianCnic && student.guardianCnic) group.guardianCnic = student.guardianCnic;
    if (!group.address && student.address) group.address = student.address;
    if (!group.whatsapp && student.whatsapp) group.whatsapp = student.whatsapp;
    if (!group.email && student.email) group.email = student.email;
    if (!group.guardianOccupation && student.guardianOccupation) group.guardianOccupation = student.guardianOccupation;
  });

  return Array.from(map.values()).map(fam => {
    const totalDue = fam.students.reduce((sum, s) => sum + (s.totalDue ?? 0), 0);
    // Fix #7b: an unrecorded totalPaid contributes 0 — the old
    // `?? 40000` invented 40,000 PKR of payments per student (the
    // same fabrication Fix #4b removed from FamilyDetailsView).
    const totalPaid = fam.students.reduce((sum, s) => sum + (s.totalPaid ?? 0), 0);
    return {
      ...fam,
      totalDue,
      totalPaid
    };
  });
}
