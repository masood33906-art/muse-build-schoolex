import { ClassInfo, PayStatus, StaffCategory, StaffMember, StaffStatus, Student } from '../types';
import { withClassIdFromName } from './classExportHelper';
import { isLegacyDefaultAvatar } from './studentAvatarHelper';
import { localISODate } from './dates';

/**
 * Save-path record builders for the entity forms.
 *
 * These functions are the SINGLE implementation of "form state → stored
 * record" for students and staff: AddStudentPage and AddStudentModal both
 * save through buildStudentRecordFromForm, AddStaffPage saves through
 * buildStaffRecordFromForm. They live outside the components so the exact
 * production transform can be exercised by proofs
 * (proof-no-invented-defaults.mts).
 *
 * Owner rule (2026-11-08) — blank in → blank stored: an optional field
 * the user left empty is stored EMPTY. No invented, pre-filled or
 * placeholder value may be written for it. The only non-input values in
 * a built record are system-generated identifiers, the owner-approved
 * "today" date defaults, the derived roll number (already resolved into
 * form state by the forms), and structural enum states the data model
 * cannot hold blank (student/staff status, staff category/department).
 */

export function buildStudentRecordFromForm(
  formData: Partial<Student>,
  editingStudent: Student | null,
  classes: ClassInfo[]
): Student {
  // Photo: save only a real uploaded photo (base64) — never the gender
  // default, and legacy default-URL values count as no photo.
  const rawPhoto = formData.photo?.trim() ? formData.photo : '';
  const finalPhoto = rawPhoto && !isLegacyDefaultAvatar(rawPhoto) ? rawPhoto : '';

  // Fix P0-3: stamp the stable classId of the selected class at save time.
  // Gender is stored only when the user actually selected one, and
  // phone / emergencyContact each store their OWN form value (an earlier
  // transform overwrote both with whichever contact was filled).
  return withClassIdFromName({
    id: formData.id!.trim(),
    name: formData.name!.trim(),
    family: formData.family!.trim(),
    familyId: formData.familyId!.trim(),
    class: formData.class!.trim(),
    section: formData.section!.trim().toUpperCase(),
    status: formData.status || 'Active',
    gender: formData.gender || undefined,
    bloodGroup: formData.bloodGroup || '',
    phone: (formData.phone || '').trim(),
    emergencyContact: (formData.emergencyContact || '').trim(),
    admissionDate: formData.admissionDate || localISODate(),
    isNewAdmission: formData.isNewAdmission !== undefined ? formData.isNewAdmission : (editingStudent ? editingStudent.isNewAdmission : true),
    photo: finalPhoto,
    rollNo: (formData.rollNo || '').trim(),
    dob: (formData.dob || '').trim(),
    fatherName: (formData.fatherName || '').trim(),
    cnic: (formData.cnic || '').trim(),
    religion: (formData.religion || '').trim(),
    caste: (formData.caste || '').trim(),
    whatsapp: (formData.whatsapp || '').trim(),
    email: (formData.email || '').trim(),
    address: (formData.address || '').trim(),
    guardianCnic: (formData.guardianCnic || '').trim(),
    guardianOccupation: (formData.guardianOccupation || '').trim(),
    motherName: (formData.motherName || '').trim(),
    motherCnic: (formData.motherCnic || '').trim(),
    motherOccupation: (formData.motherOccupation || '').trim(),
    previousSchool: (formData.previousSchool || '').trim(),
    previousClass: (formData.previousClass || '').trim(),
    previousResult: (formData.previousResult || '').trim(),
    reference: (formData.reference || '').trim(),
    note: (formData.note || '').trim(),
    discount: (formData.discount || '').trim(),
    admissionFee: typeof formData.admissionFee === 'string' ? formData.admissionFee.trim() : (formData.admissionFee ?? ''),
    classFee: typeof formData.classFee === 'string' ? formData.classFee.trim() : (formData.classFee ?? '')
  }, classes);
}

export function buildStaffRecordFromForm(
  formData: Partial<StaffMember>,
  editingStaff: StaffMember | null
): StaffMember {
  // No invented email: a staff member without an email on the form is
  // saved with a blank email, never a fabricated address.
  const emailVal = formData.email?.trim() || '';

  return {
    ...(editingStaff || {}),
    id: formData.id!.trim(),
    name: formData.name!.trim(),
    role: formData.role!.trim(),
    category: (formData.category as StaffCategory) || 'Teacher',
    department: formData.department || 'Academics',
    // Blank in → blank stored (owner rule, 2026-11-08): a blank
    // qualification stays blank — the old `|| 'Certified'` fabricated
    // a qualification on every record the user left empty.
    qualification: formData.qualification?.trim() || '',
    // Fix #7b: the form's validate() requires a positive salary before
    // this builder runs, so this is the user's entered amount verbatim.
    salary: Number(formData.salary),
    payStatus: editingStaff ? ((formData.payStatus as PayStatus) || 'Pending') : 'Pending',
    paidMonths: editingStaff?.paidMonths ?? [],
    status: (formData.status as StaffStatus) || 'Active',
    phone: formData.phone!.trim(),
    // WhatsApp stores only its own input (an old fallback copied the
    // phone number into a blank WhatsApp field), and cnic/fatherName
    // store the form value as-is: the old `|| editingStaff?…` fallbacks
    // resurrected the previous value when the user cleared the field
    // while editing.
    whatsapp: formData.whatsapp?.trim() || '',
    cnic: formData.cnic?.trim() || '',
    fatherName: formData.fatherName?.trim() || '',
    email: emailVal,
    joiningDate: formData.joiningDate || localISODate(),
    gender: formData.gender || undefined,
    bloodGroup: formData.bloodGroup || '',
    emergencyContact: formData.emergencyContact?.trim() || '',
    address: formData.address?.trim() || '',
    notes: formData.notes?.trim() || '',
    photo: formData.photo || ''
  };
}
