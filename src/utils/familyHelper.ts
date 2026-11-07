import { Student, FamilyData } from '../types';

/**
 * Groups an array of students by family/guardian into structured FamilyData records
 */
export function groupStudentsIntoFamilies(students: Student[]): FamilyData[] {
  const map = new Map<string, FamilyData>();

  students.forEach((student) => {
    const key = (student.familyId || student.family || 'unknown').trim().toLowerCase();
    if (!map.has(key)) {
      map.set(key, {
        familyId: student.familyId || 'F0000',
        familyName: student.family || 'Unknown Family',
        phone: student.phone || student.emergencyContact || '',
        guardianCnic: student.guardianCnic || '7647646475',
        guardianOccupation: student.guardianOccupation || 'Business',
        motherName: student.motherName || '-',
        motherCnic: student.motherCnic || '-',
        motherOccupation: student.motherOccupation || 'Homemaker',
        whatsapp: student.whatsapp || student.phone || '',
        email: student.email || 'guardian@school.edu.pk',
        address: student.address || 'House #14, Sector G-10, Islamabad',
        caste: student.caste || '-',
        religion: student.religion || 'Islam',
        emergencyContact: student.emergencyContact || student.phone,
        notes: student.note || 'Registered Family Account',
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
