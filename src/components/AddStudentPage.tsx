import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Trash2,
  Save,
  User,
  School,
  Users,
  Phone,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Link as LinkIcon,
  PlusCircle,
  Wallet
} from 'lucide-react';
import { Student, ClassInfo, StudentStatus } from '../types';
import { buildStudentRecordFromForm } from '../utils/formRecords';
import { classRefForName, nextRollNumber, ROLL_NUMBER_CAP } from '../utils/rollNumber';
import { BreadcrumbTrail } from './BreadcrumbTrail';
import {
  BOY_AVATAR_URL,
  GIRL_AVATAR_URL,
  getStudentAvatar,
  isLegacyDefaultAvatar
} from '../utils/studentAvatarHelper';
import { localISODate } from '../utils/dates';

interface AddStudentPageProps {
  onBack: () => void;
  onNavigateOverview?: () => void;
  onNavigateClasses?: () => void;
  onSave: (student: Student) => void;
  editingStudent: Student | null;
  existingClasses: string[];
  classes?: ClassInfo[];
  totalStudentCount: number;
  allStudents?: Student[];
}

export const AddStudentPage: React.FC<AddStudentPageProps> = ({
  onBack,
  onNavigateOverview,
  onNavigateClasses,
  onSave,
  editingStudent,
  existingClasses,
  classes = [],
  totalStudentCount,
  allStudents = []
}) => {
  // Family selection mode: 'existing' (pick from dropdown) or 'new' (register fresh family)
  const [familyMode, setFamilyMode] = useState<'existing' | 'new'>('new');
  const [selectedExistingFamilyCode, setSelectedExistingFamilyCode] = useState<string>('');

  // Compute strictly available classes and their sections from system data
  const availableClassMap = useMemo(() => {
    const map = new Map<string, string[]>();
    classes.forEach(c => {
      const name = c.name.trim();
      if (name) {
        map.set(name, c.sections && c.sections.length > 0 ? [...c.sections] : []);
      }
    });
    existingClasses.forEach(cName => {
      const trimmed = cName.trim();
      if (trimmed && !map.has(trimmed)) {
        const secsFromStudents = Array.from(
          new Set(
            allStudents
              .filter(s => s.class.trim().toLowerCase() === trimmed.toLowerCase() && s.section?.trim())
              .map(s => s.section.trim())
          )
        );
        map.set(trimmed, secsFromStudents);
      }
    });
    return map;
  }, [classes, existingClasses, allStudents]);

  const availableClassNames = useMemo(() => {
    return Array.from(availableClassMap.keys());
  }, [availableClassMap]);

  const [formData, setFormData] = useState<Partial<Student>>({
    name: '',
    id: '',
    family: '',
    familyId: '',
    class: availableClassNames[0] || '',
    section: (availableClassNames[0] && availableClassMap.get(availableClassNames[0])?.[0]) || '',
    status: 'Active',
    // No pre-picked gender (owner rule, 2026-11-08): gender is an optional
    // fact about the student — if the user never selects one, the saved
    // record carries none. The toggle buttons start unselected.
    bloodGroup: '',
    phone: '',
    emergencyContact: '',
    admissionDate: localISODate(),
    isNewAdmission: true,
    photo: '',
    rollNo: '',
    dob: '',
    fatherName: '',
    cnic: '',
    religion: '',
    caste: '',
    whatsapp: '',
    email: '',
    address: '',
    guardianCnic: '',
    guardianOccupation: '',
    motherName: '',
    motherCnic: '',
    motherOccupation: '',
    previousSchool: '',
    previousClass: '',
    previousResult: '',
    reference: '',
    note: '',
    discount: '',
    admissionFee: '',
    classFee: ''
  });

  // Available sections strictly for the currently selected class
  const availableSectionsForClass = useMemo(() => {
    if (!formData.class) return [];
    const exactSecs = availableClassMap.get(formData.class);
    if (exactSecs) return exactSecs;
    for (const [k, v] of availableClassMap.entries()) {
      if (k.toLowerCase() === formData.class.trim().toLowerCase()) {
        return v;
      }
    }
    return [];
  }, [formData.class, availableClassMap]);

  // Roll number — a derived per-class sequence (utils/rollNumber.ts).
  // In ADD mode the field shows the selected class's next roll as soon
  // as a class is chosen, and recomputes when the class selection (or
  // the registry) changes — until the user types over it; from then on
  // their value is respected for the rest of this form session. Edit
  // mode never derives: an existing student's roll stays exactly as it is.
  const [rollTouched, setRollTouched] = useState(false);
  const selectedClassRef = useMemo(
    () => classRefForName(classes, formData.class),
    [classes, formData.class]
  );
  const autoRoll = useMemo(() => {
    if (editingStudent || !formData.class?.trim()) return undefined;
    return nextRollNumber(allStudents, selectedClassRef);
  }, [editingStudent, formData.class, allStudents, selectedClassRef]);
  const rollCapReached = autoRoll === null;

  useEffect(() => {
    if (editingStudent || rollTouched) return;
    const next = autoRoll === undefined || autoRoll === null ? '' : String(autoRoll);
    setFormData(prev => (prev.rollNo === next ? prev : { ...prev, rollNo: next }));
  }, [autoRoll, editingStudent, rollTouched]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const toggleSection = (key: string) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Group existing families from all students registry
  const existingFamilies = useMemo(() => {
    const map = new Map<string, {
      familyId: string;
      familyName: string;
      phone: string;
      emergencyContact?: string;
      studentNames: string[];
      studentCount: number;
    }>();

    allStudents.forEach(s => {
      const fid = (s.familyId || '').trim();
      if (!fid) return;
      const key = fid.toLowerCase();
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          familyId: fid,
          familyName: s.family || s.fatherName || 'Guardian',
          phone: s.phone || '',
          emergencyContact: s.emergencyContact || s.phone || '',
          studentNames: [s.name],
          studentCount: 1
        });
      } else {
        if (!existing.studentNames.includes(s.name)) {
          existing.studentNames.push(s.name);
          existing.studentCount += 1;
        }
        if (!existing.phone && s.phone) existing.phone = s.phone;
        if (!existing.emergencyContact && (s.emergencyContact || s.phone)) {
          existing.emergencyContact = s.emergencyContact || s.phone;
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => a.familyName.localeCompare(b.familyName));
  }, [allStudents]);

  // Initialize or reset form state
  useEffect(() => {
    if (editingStudent) {
      setFormData({
        ...editingStudent,
        photo: isLegacyDefaultAvatar(editingStudent.photo) ? '' : (editingStudent.photo || ''),
        emergencyContact: editingStudent.emergencyContact || editingStudent.phone || ''
      });
      const nonEmpty = (v: unknown) => v !== undefined && v !== null && String(v).trim() !== '';
      setOpenSections({
        contact: nonEmpty(editingStudent.whatsapp) || nonEmpty(editingStudent.email) || nonEmpty(editingStudent.address) || nonEmpty(editingStudent.emergencyContact || editingStudent.phone),
        parents: nonEmpty(editingStudent.fatherName) || nonEmpty(editingStudent.motherName) || nonEmpty(editingStudent.guardianCnic) || nonEmpty(editingStudent.guardianOccupation) || nonEmpty(editingStudent.motherCnic) || nonEmpty(editingStudent.motherOccupation),
        background: nonEmpty(editingStudent.cnic) || nonEmpty(editingStudent.religion) || nonEmpty(editingStudent.caste) || nonEmpty(editingStudent.previousSchool) || nonEmpty(editingStudent.previousClass) || nonEmpty(editingStudent.previousResult),
        fees: nonEmpty(editingStudent.admissionFee) || nonEmpty(editingStudent.classFee) || nonEmpty(editingStudent.discount) || nonEmpty(editingStudent.reference) || nonEmpty(editingStudent.note)
      });
      // Check if this editing student's family matches an existing family
      const matching = existingFamilies.find(
        f => f.familyId.toLowerCase() === (editingStudent.familyId || '').toLowerCase()
      );
      if (matching) {
        setFamilyMode('existing');
        setSelectedExistingFamilyCode(matching.familyId);
      } else {
        setFamilyMode('new');
        setSelectedExistingFamilyCode('');
      }
    } else {
      const nextIdNum = totalStudentCount + 101;
      // Generate clean initial ID that isn't duplicate
      let candId = `S-${String(nextIdNum).padStart(5, '0')}`;
      let counter = nextIdNum;
      const existingIds = new Set(allStudents.map(s => s.id.trim().toLowerCase()));
      while (existingIds.has(candId.toLowerCase())) {
        counter += 1;
        candId = `S-${String(counter).padStart(5, '0')}`;
      }

      // Generate next new family ID
      let candFamId = `F-${String(counter).padStart(4, '0')}`;
      const existingFamIds = new Set(allStudents.map(s => (s.familyId || '').trim().toLowerCase()));
      while (existingFamIds.has(candFamId.toLowerCase())) {
        counter += 1;
        candFamId = `F-${String(counter).padStart(4, '0')}`;
      }

      const defaultClass = availableClassNames[0] || '';
      const defaultSecs = defaultClass ? (availableClassMap.get(defaultClass) || []) : [];

      setFormData({
        name: '',
        id: candId,
        family: '',
        familyId: candFamId,
        class: defaultClass,
        section: defaultSecs[0] || '',
        status: 'Active',
        bloodGroup: '',
        phone: '',
        emergencyContact: '',
        admissionDate: localISODate(),
        isNewAdmission: true,
        photo: '',
        rollNo: '',
        dob: '',
        fatherName: '',
        cnic: '',
        religion: '',
        caste: '',
        whatsapp: '',
        email: '',
        address: '',
        guardianCnic: '',
        guardianOccupation: '',
        motherName: '',
        motherCnic: '',
        motherOccupation: '',
        previousSchool: '',
        previousClass: '',
        previousResult: '',
        reference: '',
        note: '',
        discount: '',
        admissionFee: '',
        classFee: ''
      });
      setOpenSections({});
      setFamilyMode('new');
      setSelectedExistingFamilyCode('');
      setRollTouched(false);
    }
    setErrors({});
  }, [editingStudent, totalStudentCount, availableClassNames, availableClassMap, allStudents, existingFamilies]);

  // Conflict Detection 1: Duplicate Student ID
  const duplicateStudentConflict = useMemo(() => {
    const rawId = (formData.id || '').trim().toLowerCase();
    if (!rawId) return null;
    return allStudents.find(
      s => s.id.trim().toLowerCase() === rawId && s.id !== editingStudent?.id
    ) || null;
  }, [formData.id, allStudents, editingStudent]);

  // Conflict Detection 2: Family Code already given, but user didn't select it from dropdown
  const duplicateFamilyCodeConflict = useMemo(() => {
    const rawFamCode = (formData.familyId || '').trim().toLowerCase();
    if (!rawFamCode) return null;

    // If user explicitly chose "existing" mode AND selected this exact family code, that is allowed & intended!
    if (familyMode === 'existing' && selectedExistingFamilyCode.trim().toLowerCase() === rawFamCode) {
      return null;
    }

    // Otherwise, check if this family code already belongs to another registered family
    const matched = existingFamilies.find(
      f => f.familyId.trim().toLowerCase() === rawFamCode
    );

    if (matched) {
      // If editing student and the family is their original family, allow it
      if (editingStudent && editingStudent.familyId?.trim().toLowerCase() === rawFamCode) {
        return null;
      }
      return matched;
    }
    return null;
  }, [formData.familyId, familyMode, selectedExistingFamilyCode, existingFamilies, editingStudent]);

  // Handle selecting an existing family from dropdown
  const handleSelectExistingFamily = (familyId: string) => {
    setSelectedExistingFamilyCode(familyId);
    if (!familyId) {
      return;
    }
    const found = existingFamilies.find(
      f => f.familyId.toLowerCase() === familyId.toLowerCase()
    );
    if (found) {
      setFamilyMode('existing');
      setFormData(prev => ({
        ...prev,
        familyId: found.familyId,
        family: found.familyName,
        // Auto-fill emergency contact from family if student's contact is currently empty
        emergencyContact: prev.emergencyContact || found.emergencyContact || found.phone || '',
        phone: prev.phone || found.phone || ''
      }));
      setErrors(prev => {
        const next = { ...prev };
        delete next.family;
        delete next.familyId;
        return next;
      });
    }
  };

  // Switch to registering a new family
  const handleSwitchToNewFamily = () => {
    setFamilyMode('new');
    setSelectedExistingFamilyCode('');
    // Suggest fresh unused family code
    const existingFamIds = new Set(allStudents.map(s => (s.familyId || '').trim().toLowerCase()));
    let candNum = totalStudentCount + 101;
    let candFamId = `F-${String(candNum).padStart(4, '0')}`;
    while (existingFamIds.has(candFamId.toLowerCase())) {
      candNum += 1;
      candFamId = `F-${String(candNum).padStart(4, '0')}`;
    }
    setFormData(prev => ({
      ...prev,
      familyId: candFamId,
      family: ''
    }));
  };

  // Handle image upload and resize to 256px JPEG
  const handleFileChange = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrors(prev => ({ ...prev, photo: 'Please upload a valid image file (JPG, PNG, or WebP).' }));
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, photo: 'Image size should be under 10MB.' }));
      return;
    }

    setErrors(prev => {
      const next = { ...prev };
      delete next.photo;
      return next;
    });

    try {
      const { resizeImageToDataURL } = await import('../utils/image');
      const base64 = await resizeImageToDataURL(file, 256, 0.7, 'image/jpeg');
      setFormData(prev => ({ ...prev, photo: base64 }));
    } catch {
      setErrors(prev => ({ ...prev, photo: 'Could not process the selected image.' }));
    }
  };

  const handleRemovePhoto = () => {
    setFormData(prev => ({ ...prev, photo: '' }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Active DP URL: custom uploaded photo or gender default (boy/girl PNG)
  const activeAvatarUrl = useMemo(() => getStudentAvatar({ photo: formData.photo, gender: formData.gender, name: formData.name }), [formData.photo, formData.gender, formData.name]);

  const validate = () => {
    const errs: Record<string, string> = {};

    // 1. Full name
    if (!formData.name?.trim()) {
      errs.name = 'Student full name is required';
    }

    // 1b. Date of Birth — required for new admissions only
    if (!editingStudent && !formData.dob?.trim()) {
      errs.dob = 'Date of Birth is required';
    }

    // 2. Student ID - must be non-empty AND completely unique
    if (!formData.id?.trim()) {
      errs.id = 'Student ID is required';
    } else if (duplicateStudentConflict) {
      errs.id = `Student ID "${formData.id}" is already assigned to ${duplicateStudentConflict.name} (${duplicateStudentConflict.class}). Please enter a unique ID.`;
    }

    // 3. Father / Guardian name
    if (!formData.family?.trim()) {
      errs.family = 'Father / Guardian name is required';
    }

    // 4. Family ID / Code
    if (!formData.familyId?.trim()) {
      errs.familyId = 'Family Code is required';
    } else if (duplicateFamilyCodeConflict) {
      errs.familyId = `Family Code "${formData.familyId}" already exists for ${duplicateFamilyCodeConflict.familyName}. Please select this family from the dropdown above or enter a new unique code.`;
    }

    // 5. Emergency Phone Number is strictly MANDATORY
    const emergencyNumber = (formData.emergencyContact || formData.phone || '').trim();
    if (!emergencyNumber) {
      errs.emergencyContact = 'Emergency phone number is mandatory';
    } else if (emergencyNumber.replace(/[^0-9]/g, '').length < 7) {
      errs.emergencyContact = 'Please enter a valid emergency phone number (at least 7 digits)';
    }

    // 6. Academic class & section
    if (!formData.class?.trim()) errs.class = 'Class is required';
    if (!formData.section?.trim()) errs.section = 'Section is required';

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      // Scroll to top or first error
      window.scrollTo({ top: 120, behavior: 'smooth' });
      return;
    }

    // The stored record is built by the shared save-path builder
    // (utils/formRecords.ts) — the exact same transform the Add Student
    // modal uses, so both paths store identical shapes and the transform
    // itself is proof-tested (proof-no-invented-defaults.mts).
    onSave(buildStudentRecordFromForm(formData, editingStudent, classes));
  };

  return (
    <div className="w-full max-w-5xl mx-auto py-4 animate-in fade-in duration-200" id="add-student-page-root">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {editingStudent ? 'Edit Student Profile' : 'New Student Admission'}
          </h1>
          <BreadcrumbTrail
            items={[
              { label: 'Overview', onClick: onNavigateOverview },
              { label: editingStudent ? 'Edit Profile' : 'New Admission' }
            ]}
          />
        </div>

        {/* Quick Top Save Button */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!!duplicateStudentConflict || !!duplicateFamilyCodeConflict}
            className={`px-5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shadow-lg ${
              duplicateStudentConflict || duplicateFamilyCodeConflict
                ? 'bg-slate-800 text-slate-500 border border-slate-700/60 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer shadow-blue-600/30 hover:shadow-blue-600/50'
            }`}
            id="btn-top-save-student"
          >
            <Save className="w-4 h-4" />
            <span>{editingStudent ? 'Update Student' : 'Save Student'}</span>
          </button>
        </div>
      </div>

      {/* Main Registration Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ========================================================================= */}
        {/* SECTION 0: STUDENT DISPLAY PICTURE (DP)                                   */}
        {/* ========================================================================= */}
        <div className="flex justify-center py-2">
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileChange(e.target.files[0]);
              }
            }}
            className="hidden"
            id="student-photo-upload"
          />

          <div
            className="relative cursor-pointer group"
            onClick={() => fileInputRef.current?.click()}
            title="Click to select photo"
          >
            <div className="w-28 h-28 rounded-full overflow-hidden border-2 border-slate-600 shadow-xl bg-white flex items-center justify-center">
              <img 
                src={activeAvatarUrl} 
                alt="Student Avatar" 
                className="w-full h-full object-cover"
              />
            </div>
            {formData.photo && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemovePhoto();
                }}
                className="absolute bottom-0 right-0 p-1.5 rounded-full bg-rose-600 text-white hover:bg-rose-500 shadow-md cursor-pointer transition-colors"
                title="Remove photo"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SECTION 1: BASIC INFORMATION (WITH GENDER SELECTION TRIGGERING DP)        */}
        {/* ========================================================================= */}
        <div className="bg-surface-16 border border-[#212b3e] rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-[#212d42]">
            <User className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-white">Basic Information</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Student Full Name */}
            <div className="lg:col-span-1">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Student Full Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  if (errors.name) {
                    setErrors(prev => { const n = { ...prev }; delete n.name; return n; });
                  }
                }}
                placeholder="e.g. Ayesha Khan"
                className={`w-full bg-surface-36 text-slate-100 text-sm rounded-lg px-3.5 py-2.5 border ${
                  errors.name ? 'border-rose-500' : 'border-edge-40'
                } focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors`}
                id="input-student-name"
              />
              {errors.name && <p className="text-rose-400 text-[11px] mt-1">{errors.name}</p>}
            </div>

            {/* Gender Selection - Controls Default DP (Boy PNG vs Girl PNG) */}
            <div className="lg:col-span-1">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Gender <span className="text-rose-400">*</span>
              </label>

              {/* Quick Visual Gender Cards */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, gender: 'Male' })}
                  className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    formData.gender === 'Male'
                      ? 'bg-blue-600/25 border-blue-500 text-blue-300 shadow-md ring-1 ring-blue-500/50'
                      : 'bg-surface-36 border-edge-40 text-slate-400 hover:text-white hover:border-slate-600'
                  }`}
                  id="btn-gender-male"
                >
                  <img src={BOY_AVATAR_URL} alt="Boy" className="w-5 h-5 rounded-full object-cover" />
                  <span>Boy (Male)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, gender: 'Female' })}
                  className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    formData.gender === 'Female'
                      ? 'bg-pink-600/25 border-pink-500 text-pink-300 shadow-md ring-1 ring-pink-500/50'
                      : 'bg-surface-36 border-edge-40 text-slate-400 hover:text-white hover:border-slate-600'
                  }`}
                  id="btn-gender-female"
                >
                  <img src={GIRL_AVATAR_URL} alt="Girl" className="w-5 h-5 rounded-full object-cover" />
                  <span>Girl (Female)</span>
                </button>
              </div>
            </div>

            {/* Date of Birth */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Date of Birth {!editingStudent ? <span className="text-rose-400">*</span> : <span className="text-slate-500 text-[10px] font-normal">Recommended</span>}
              </label>
              <input
                type="date"
                value={formData.dob || ''}
                onChange={(e) => {
                  setFormData({ ...formData, dob: e.target.value });
                  if (errors.dob) {
                    setErrors(prev => { const n = { ...prev }; delete n.dob; return n; });
                  }
                }}
                className={`w-full bg-surface-36 text-slate-100 text-sm rounded-lg px-3.5 py-2.5 border ${
                  errors.dob ? 'border-rose-500' : 'border-edge-40'
                } focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors`}
                id="input-student-dob"
              />
              {errors.dob && <p className="text-rose-400 text-[11px] mt-1">{errors.dob}</p>}
            </div>

            {/* Blood Group Dropdown */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Blood Group
              </label>
              <div className="relative">
                <select
                  value={formData.bloodGroup || ''}
                  onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
                  className="w-full appearance-none bg-surface-36 border border-edge-40 text-slate-100 text-sm rounded-lg px-3.5 py-2.5 pr-10 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors cursor-pointer"
                  id="input-student-blood-group"
                >
                  <option value="">— Select —</option>
                  {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map(bg => (
                    <option key={bg} value={bg}>{bg}</option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Student ID / Roll Number (STRICTLY UNIQUE) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Student ID <span className="text-rose-400">*</span>
                </label>
                {duplicateStudentConflict && (
                  <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/30">
                    ID Already Taken
                  </span>
                )}
              </div>
              <input
                type="text"
                value={formData.id || ''}
                onChange={(e) => {
                  setFormData({ ...formData, id: e.target.value });
                  if (errors.id) {
                    setErrors(prev => { const n = { ...prev }; delete n.id; return n; });
                  }
                }}
                placeholder="e.g. S-00101"
                className={`w-full bg-surface-36 text-slate-100 text-sm rounded-lg px-3.5 py-2.5 font-mono border ${
                  duplicateStudentConflict || errors.id
                    ? 'border-rose-500 ring-1 ring-rose-500/50 bg-rose-950/20'
                    : 'border-edge-40'
                } focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors`}
                id="input-student-id"
              />

              {/* Prominent Duplicate ID Warning Message */}
              {duplicateStudentConflict ? (
                <div className="mt-1.5 p-2 rounded-lg bg-rose-950/40 border border-rose-500/40 flex items-start gap-1.5 text-rose-300 text-[11px]">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Conflict:</strong> Student ID is already assigned to <strong>{duplicateStudentConflict.name}</strong> ({duplicateStudentConflict.class} - Sec {duplicateStudentConflict.section}). Please choose a unique ID.
                  </span>
                </div>
              ) : errors.id ? (
                <p className="text-rose-400 text-[11px] mt-1">{errors.id}</p>
              ) : null}
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SECTION 2: ACADEMIC INFORMATION                                           */}
        {/* ========================================================================= */}
        <div className="bg-surface-16 border border-[#212b3e] rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#212d42]">
            <div className="flex items-center gap-2">
              <School className="w-4 h-4 text-purple-400" />
              <h2 className="text-sm font-bold text-white">Academic Information</h2>
            </div>
            {availableClassNames.length === 0 && onNavigateClasses && (
              <button
                type="button"
                onClick={onNavigateClasses}
                className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold cursor-pointer transition-colors"
              >
                + Create Classes First
              </button>
            )}
          </div>

          {availableClassNames.length === 0 && (
            <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-amber-200">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  <strong>No classes available in the system yet.</strong> Please create at least one class and section in the Classes module before enrolling a student.
                </span>
              </div>
              {onNavigateClasses && (
                <button
                  type="button"
                  onClick={onNavigateClasses}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shrink-0 cursor-pointer transition-colors"
                >
                  Open Classes Module
                </button>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Class Selection Dropdown — Strictly Available Classes Only */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Class <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <select
                  value={formData.class || ''}
                  onChange={(e) => {
                    const nextClass = e.target.value;
                    const nextSecs = nextClass ? (availableClassMap.get(nextClass) || []) : [];
                    setFormData({
                      ...formData,
                      class: nextClass,
                      section: nextSecs[0] || ''
                    });
                    if (errors.class || errors.section) {
                      setErrors(prev => {
                        const n = { ...prev };
                        delete n.class;
                        delete n.section;
                        return n;
                      });
                    }
                  }}
                  className={`w-full appearance-none bg-surface-36 border ${
                    errors.class ? 'border-rose-500' : 'border-edge-40'
                  } text-slate-100 text-sm rounded-lg px-3.5 py-2.5 pr-10 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors cursor-pointer`}
                  id="input-student-class"
                >
                  {availableClassNames.length === 0 ? (
                    <option value="">-- No classes available in system --</option>
                  ) : (
                    availableClassNames.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))
                  )}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              {errors.class && <p className="text-rose-400 text-[11px] mt-1">{errors.class}</p>}
            </div>

            {/* Section Selection Dropdown — Strictly Available Sections for Selected Class */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Section <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <select
                  value={formData.section || ''}
                  onChange={(e) => {
                    setFormData({ ...formData, section: e.target.value });
                    if (errors.section) {
                      setErrors(prev => { const n = { ...prev }; delete n.section; return n; });
                    }
                  }}
                  className={`w-full appearance-none bg-surface-36 border ${
                    errors.section ? 'border-rose-500' : 'border-edge-40'
                  } text-slate-100 text-sm rounded-lg px-3.5 py-2.5 pr-10 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors cursor-pointer`}
                  id="input-student-section"
                >
                  {availableSectionsForClass.length === 0 ? (
                    <option value="">-- No sections available --</option>
                  ) : (
                    availableSectionsForClass.map(sec => (
                      <option key={sec} value={sec}>Section {sec}</option>
                    ))
                  )}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              {errors.section && <p className="text-rose-400 text-[11px] mt-1">{errors.section}</p>}
            </div>

            {/* Roll No */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Roll No
              </label>
              <input
                type="text"
                value={formData.rollNo || ''}
                onChange={(e) => {
                  setRollTouched(true);
                  setFormData({ ...formData, rollNo: e.target.value });
                }}
                placeholder="e.g. 12"
                className="w-full bg-surface-36 text-slate-100 text-sm rounded-lg px-3.5 py-2.5 border border-edge-40 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors"
                id="input-student-rollNo"
              />
              {!editingStudent && rollCapReached && (
                <p className="text-amber-400 text-[11px] mt-1">
                  This class already has {ROLL_NUMBER_CAP} roll numbers, so automatic numbering has stopped. Type a roll number by hand if you want one.
                </p>
              )}
              {!editingStudent && !rollCapReached && autoRoll !== undefined && !rollTouched && (
                <p className="text-slate-400 text-[11px] mt-1">
                  Assigned automatically — the next roll number in {formData.class}. You can type over it.
                </p>
              )}
            </div>

            {/* Status Dropdown */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Enrollment Status
              </label>
              <div className="relative">
                <select
                  value={formData.status || 'Active'}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as StudentStatus })}
                  className="w-full appearance-none bg-surface-36 border border-edge-40 text-slate-100 text-sm rounded-lg px-3.5 py-2.5 pr-10 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors cursor-pointer"
                  id="input-student-status"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Admission Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Admission Date
              </label>
              <input
                type="date"
                value={formData.admissionDate || ''}
                onChange={(e) => setFormData({ ...formData, admissionDate: e.target.value })}
                className="w-full bg-surface-36 border border-edge-40 text-slate-100 text-sm rounded-lg px-3.5 py-2.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors"
                id="input-student-admission-date"
              />
            </div>

            {/* New Admission Toggle */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                New Admission
              </label>
              <label className="flex items-center gap-2.5 w-full bg-surface-36 border border-edge-40 text-slate-100 text-sm rounded-lg px-3.5 py-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!formData.isNewAdmission}
                  onChange={(e) => setFormData({ ...formData, isNewAdmission: e.target.checked })}
                  className="w-4 h-4 accent-blue-600 cursor-pointer"
                  id="input-student-isNewAdmission"
                />
                <span>New Admission</span>
              </label>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SECTION 3: GUARDIAN & FAMILY (DROPDOWN OR NEW + DUPLICATE CONFLICT NOTICE) */}
        {/* ========================================================================= */}
        <div className="bg-surface-16 border border-[#212b3e] rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#212d42]">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-sky-400" />
              <h2 className="text-sm font-bold text-white">Guardian & Family</h2>
            </div>

            {/* Mode Toggle: Existing Family vs New Family */}
            <div className="flex items-center bg-surface-30 border border-[#22314a] rounded-lg p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setFamilyMode('existing')}
                className={`px-3 py-1 rounded-md font-semibold text-xs transition-colors cursor-pointer flex items-center gap-1.5 ${
                  familyMode === 'existing'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                id="tab-existing-family"
              >
                <LinkIcon className="w-3.5 h-3.5" />
                <span>Select Existing Family ({existingFamilies.length})</span>
              </button>
              <button
                type="button"
                onClick={handleSwitchToNewFamily}
                className={`px-3 py-1 rounded-md font-semibold text-xs transition-colors cursor-pointer flex items-center gap-1.5 ${
                  familyMode === 'new'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                id="tab-new-family"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Register New Family</span>
              </button>
            </div>
          </div>

          {/* Option A: Select Existing Family Dropdown */}
          {familyMode === 'existing' && (
            <div className="p-4 rounded-xl bg-[#0f1523] border border-[#1e2a3e] space-y-3">
              <label className="block text-xs font-semibold text-slate-300">
                Choose Registered Family from Dropdown <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <select
                  value={selectedExistingFamilyCode}
                  onChange={(e) => handleSelectExistingFamily(e.target.value)}
                  className="w-full appearance-none bg-surface-36 border border-edge-40 text-slate-100 text-sm rounded-lg px-3.5 py-2.5 pr-10 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors cursor-pointer"
                  id="select-existing-family"
                >
                  {existingFamilies.length === 0 ? (
                    <option value="">-- No registered families available in system yet --</option>
                  ) : (
                    <>
                      <option value="">-- Select an existing registered family --</option>
                      {existingFamilies.map(fam => (
                        <option key={fam.familyId} value={fam.familyId}>
                          {fam.familyName} (Code: {fam.familyId}) • {fam.studentCount} enrolled ({fam.studentNames.slice(0, 2).join(', ')}{fam.studentCount > 2 ? '...' : ''})
                        </option>
                      ))}
                    </>
                  )}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {selectedExistingFamilyCode && (
                <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-500/40 text-emerald-300 text-xs flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Linked to Existing Family:</span> {formData.family} (Code: {formData.familyId}). Siblings enrolled: {existingFamilies.find(f => f.familyId.toLowerCase() === selectedExistingFamilyCode.toLowerCase())?.studentNames.join(', ')}.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Form Fields: Guardian Name, Family Code, Emergency Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Father / Guardian Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Father / Guardian Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={formData.family || ''}
                onChange={(e) => {
                  setFormData({ ...formData, family: e.target.value });
                  if (errors.family) {
                    setErrors(prev => { const n = { ...prev }; delete n.family; return n; });
                  }
                }}
                placeholder="e.g. Tariq Mehmood"
                className={`w-full bg-surface-36 text-slate-100 text-sm rounded-lg px-3.5 py-2.5 border ${
                  errors.family ? 'border-rose-500' : 'border-edge-40'
                } focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors`}
                id="input-student-family"
              />
              {errors.family && <p className="text-rose-400 text-[11px] mt-1">{errors.family}</p>}
            </div>

            {/* Family Code / ID */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Family Code / ID <span className="text-rose-400">*</span>
                </label>
                {duplicateFamilyCodeConflict && (
                  <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/30">
                    Duplicate Family Code
                  </span>
                )}
              </div>
              <input
                type="text"
                value={formData.familyId || ''}
                onChange={(e) => {
                  setFormData({ ...formData, familyId: e.target.value });
                  if (errors.familyId) {
                    setErrors(prev => { const n = { ...prev }; delete n.familyId; return n; });
                  }
                }}
                placeholder="e.g. F-0080"
                className={`w-full bg-surface-36 text-slate-100 text-sm rounded-lg px-3.5 py-2.5 font-mono border ${
                  duplicateFamilyCodeConflict || errors.familyId
                    ? 'border-rose-500 ring-1 ring-rose-500/50 bg-rose-950/20'
                    : 'border-edge-40'
                } focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors`}
                id="input-student-family-id"
              />
              {errors.familyId && <p className="text-rose-400 text-[11px] mt-1">{errors.familyId}</p>}
            </div>

            {/* Mandatory Emergency Contact Phone */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Phone <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={formData.emergencyContact || formData.phone || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData({ ...formData, emergencyContact: val, phone: val });
                    if (errors.emergencyContact) {
                      setErrors(prev => { const n = { ...prev }; delete n.emergencyContact; return n; });
                    }
                  }}
                  placeholder="+92 300 1234567"
                  className={`w-full bg-surface-36 text-slate-100 text-sm rounded-lg pl-9 pr-3.5 py-2.5 border ${
                    errors.emergencyContact ? 'border-rose-500 ring-1 ring-rose-500/50' : 'border-edge-40'
                  } focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors`}
                  id="input-student-emergency-phone"
                  required
                />
              </div>
              {errors.emergencyContact && (
                <p className="text-rose-400 text-[11px] mt-1 font-medium">{errors.emergencyContact}</p>
              )}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* CRITICAL RED NOTICE: DUPLICATE FAMILY CODE CONFLICT WITHOUT DROPDOWN PICK */}
          {/* ========================================================================= */}
          {duplicateFamilyCodeConflict && (
            <div 
              className="bg-rose-950/60 border-2 border-rose-500/80 rounded-xl p-4 flex items-start gap-3.5 text-rose-200 animate-in fade-in duration-200 shadow-xl shadow-rose-950/40"
              id="alert-duplicate-family-code"
            >
              <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center shrink-0 shadow-inner mt-0.5">
                <AlertTriangle className="w-5 h-5 text-rose-400 animate-pulse" />
              </div>
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="font-extrabold text-white text-sm flex items-center gap-2">
                  <span>Conflict: Family Code "{formData.familyId}" Already Exists</span>
                </div>
                <p className="text-xs text-rose-200 leading-relaxed">
                  Family code <strong>{formData.familyId}</strong> is already assigned to registered family <strong>"{duplicateFamilyCodeConflict.familyName}"</strong> ({duplicateFamilyCodeConflict.studentNames.join(', ')}).
                </p>

                <div className="pt-2 flex items-center gap-2.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleSelectExistingFamily(duplicateFamilyCodeConflict.familyId)}
                    className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs cursor-pointer shadow-md transition-colors flex items-center gap-1.5"
                  >
                    <LinkIcon className="w-3.5 h-3.5" />
                    <span>Select "{duplicateFamilyCodeConflict.familyName}" from Dropdown</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSwitchToNewFamily}
                    className="px-3 py-1.5 rounded-lg bg-[#141b2b] hover:bg-surface-43 border border-[#2a3a55] text-slate-200 text-xs font-semibold cursor-pointer transition-colors"
                  >
                    Generate New Unique Family Code
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* SECTION 4: CONTACT DETAILS (COLLAPSIBLE)                                  */}
        {/* ========================================================================= */}
        <div className="bg-surface-16 border border-[#212b3e] rounded-2xl p-6 shadow-xl space-y-4">
          <button
            type="button"
            onClick={() => toggleSection('contact')}
            className="w-full flex items-center justify-between pb-3 border-b border-[#212d42] cursor-pointer"
            id="toggle-section-contact"
          >
            <span className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-bold text-white">Contact Details</span>
            </span>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${openSections.contact ? 'rotate-180' : ''}`} />
          </button>

          {openSections.contact && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* WhatsApp */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  WhatsApp
                </label>
                <input
                  type="tel"
                  value={formData.whatsapp || ''}
                  onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                  placeholder="+92 300 1234567"
                  className="w-full bg-surface-36 text-slate-100 text-sm rounded-lg px-3.5 py-2.5 border border-edge-40 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors"
                  id="input-student-whatsapp"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="e.g. guardian@example.com"
                  className="w-full bg-surface-36 text-slate-100 text-sm rounded-lg px-3.5 py-2.5 border border-edge-40 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors"
                  id="input-student-email"
                />
              </div>

              {/* Emergency Contact (binds emergencyContact only) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Emergency Contact
                </label>
                <input
                  type="tel"
                  value={formData.emergencyContact || ''}
                  onChange={(e) => {
                    setFormData({ ...formData, emergencyContact: e.target.value });
                    if (errors.emergencyContact) {
                      setErrors(prev => { const n = { ...prev }; delete n.emergencyContact; return n; });
                    }
                  }}
                  placeholder="+92 300 1234567"
                  className={`w-full bg-surface-36 text-slate-100 text-sm rounded-lg px-3.5 py-2.5 border ${
                    errors.emergencyContact ? 'border-rose-500' : 'border-edge-40'
                  } focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors`}
                  id="input-student-emergencyContact"
                />
                {errors.emergencyContact && (
                  <p className="text-rose-400 text-[11px] mt-1 font-medium">{errors.emergencyContact}</p>
                )}
              </div>

              {/* Address */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Address
                </label>
                <input
                  type="text"
                  value={formData.address || ''}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="e.g. House 12, Street 3, Lahore"
                  className="w-full bg-surface-36 text-slate-100 text-sm rounded-lg px-3.5 py-2.5 border border-edge-40 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors"
                  id="input-student-address"
                />
              </div>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* SECTION 5: PARENTS & GUARDIAN DETAILS (COLLAPSIBLE)                       */}
        {/* ========================================================================= */}
        <div className="bg-surface-16 border border-[#212b3e] rounded-2xl p-6 shadow-xl space-y-4">
          <button
            type="button"
            onClick={() => toggleSection('parents')}
            className="w-full flex items-center justify-between pb-3 border-b border-[#212d42] cursor-pointer"
            id="toggle-section-parents"
          >
            <span className="flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-bold text-white">Parents & Guardian Details</span>
            </span>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${openSections.parents ? 'rotate-180' : ''}`} />
          </button>

          {openSections.parents && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Father Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Father Name
                </label>
                <input
                  type="text"
                  value={formData.fatherName || ''}
                  onChange={(e) => setFormData({ ...formData, fatherName: e.target.value })}
                  placeholder="e.g. Tariq Mehmood"
                  className="w-full bg-surface-36 text-slate-100 text-sm rounded-lg px-3.5 py-2.5 border border-edge-40 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors"
                  id="input-student-fatherName"
                />
              </div>

              {/* Mother Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Mother Name
                </label>
                <input
                  type="text"
                  value={formData.motherName || ''}
                  onChange={(e) => setFormData({ ...formData, motherName: e.target.value })}
                  placeholder="e.g. Fatima Tariq"
                  className="w-full bg-surface-36 text-slate-100 text-sm rounded-lg px-3.5 py-2.5 border border-edge-40 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors"
                  id="input-student-motherName"
                />
              </div>

              {/* Guardian CNIC */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Guardian CNIC
                </label>
                <input
                  type="text"
                  value={formData.guardianCnic || ''}
                  onChange={(e) => setFormData({ ...formData, guardianCnic: e.target.value })}
                  placeholder="e.g. 35202-1234567-1"
                  className="w-full bg-surface-36 text-slate-100 text-sm rounded-lg px-3.5 py-2.5 border border-edge-40 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors"
                  id="input-student-guardianCnic"
                />
              </div>

              {/* Guardian Occupation */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Guardian Occupation
                </label>
                <input
                  type="text"
                  value={formData.guardianOccupation || ''}
                  onChange={(e) => setFormData({ ...formData, guardianOccupation: e.target.value })}
                  placeholder="e.g. Teacher"
                  className="w-full bg-surface-36 text-slate-100 text-sm rounded-lg px-3.5 py-2.5 border border-edge-40 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors"
                  id="input-student-guardianOccupation"
                />
              </div>

              {/* Mother CNIC */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Mother CNIC
                </label>
                <input
                  type="text"
                  value={formData.motherCnic || ''}
                  onChange={(e) => setFormData({ ...formData, motherCnic: e.target.value })}
                  placeholder="e.g. 35202-1234567-2"
                  className="w-full bg-surface-36 text-slate-100 text-sm rounded-lg px-3.5 py-2.5 border border-edge-40 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors"
                  id="input-student-motherCnic"
                />
              </div>

              {/* Mother Occupation */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Mother Occupation
                </label>
                <input
                  type="text"
                  value={formData.motherOccupation || ''}
                  onChange={(e) => setFormData({ ...formData, motherOccupation: e.target.value })}
                  placeholder="e.g. Housewife"
                  className="w-full bg-surface-36 text-slate-100 text-sm rounded-lg px-3.5 py-2.5 border border-edge-40 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors"
                  id="input-student-motherOccupation"
                />
              </div>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* SECTION 6: PERSONAL & BACKGROUND (COLLAPSIBLE)                            */}
        {/* ========================================================================= */}
        <div className="bg-surface-16 border border-[#212b3e] rounded-2xl p-6 shadow-xl space-y-4">
          <button
            type="button"
            onClick={() => toggleSection('background')}
            className="w-full flex items-center justify-between pb-3 border-b border-[#212d42] cursor-pointer"
            id="toggle-section-background"
          >
            <span className="flex items-center gap-2">
              <User className="w-4 h-4 text-teal-400" />
              <span className="text-sm font-bold text-white">Personal & Background</span>
            </span>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${openSections.background ? 'rotate-180' : ''}`} />
          </button>

          {openSections.background && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Student CNIC / B-Form */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Student CNIC / B-Form
                </label>
                <input
                  type="text"
                  value={formData.cnic || ''}
                  onChange={(e) => setFormData({ ...formData, cnic: e.target.value })}
                  placeholder="e.g. 35202-1234567-3"
                  className="w-full bg-surface-36 text-slate-100 text-sm rounded-lg px-3.5 py-2.5 border border-edge-40 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors"
                  id="input-student-cnic"
                />
              </div>

              {/* Religion */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Religion
                </label>
                <input
                  type="text"
                  value={formData.religion || ''}
                  onChange={(e) => setFormData({ ...formData, religion: e.target.value })}
                  placeholder="e.g. Islam"
                  className="w-full bg-surface-36 text-slate-100 text-sm rounded-lg px-3.5 py-2.5 border border-edge-40 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors"
                  id="input-student-religion"
                />
              </div>

              {/* Caste */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Caste
                </label>
                <input
                  type="text"
                  value={formData.caste || ''}
                  onChange={(e) => setFormData({ ...formData, caste: e.target.value })}
                  placeholder="e.g. Rajput"
                  className="w-full bg-surface-36 text-slate-100 text-sm rounded-lg px-3.5 py-2.5 border border-edge-40 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors"
                  id="input-student-caste"
                />
              </div>

              {/* Previous School */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Previous School
                </label>
                <input
                  type="text"
                  value={formData.previousSchool || ''}
                  onChange={(e) => setFormData({ ...formData, previousSchool: e.target.value })}
                  placeholder="e.g. City School"
                  className="w-full bg-surface-36 text-slate-100 text-sm rounded-lg px-3.5 py-2.5 border border-edge-40 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors"
                  id="input-student-previousSchool"
                />
              </div>

              {/* Previous Class */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Previous Class
                </label>
                <input
                  type="text"
                  value={formData.previousClass || ''}
                  onChange={(e) => setFormData({ ...formData, previousClass: e.target.value })}
                  placeholder="e.g. Class 5"
                  className="w-full bg-surface-36 text-slate-100 text-sm rounded-lg px-3.5 py-2.5 border border-edge-40 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors"
                  id="input-student-previousClass"
                />
              </div>

              {/* Previous Result */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Previous Result
                </label>
                <input
                  type="text"
                  value={formData.previousResult || ''}
                  onChange={(e) => setFormData({ ...formData, previousResult: e.target.value })}
                  placeholder="e.g. Passed / 85%"
                  className="w-full bg-surface-36 text-slate-100 text-sm rounded-lg px-3.5 py-2.5 border border-edge-40 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors"
                  id="input-student-previousResult"
                />
              </div>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* SECTION 7: FEES & OTHER INFORMATION (COLLAPSIBLE)                         */}
        {/* ========================================================================= */}
        <div className="bg-surface-16 border border-[#212b3e] rounded-2xl p-6 shadow-xl space-y-4">
          <button
            type="button"
            onClick={() => toggleSection('fees')}
            className="w-full flex items-center justify-between pb-3 border-b border-[#212d42] cursor-pointer"
            id="toggle-section-fees"
          >
            <span className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-bold text-white">Fees & Other Information</span>
            </span>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${openSections.fees ? 'rotate-180' : ''}`} />
          </button>

          {openSections.fees && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Admission Fee */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Admission Fee
                </label>
                <input
                  type="number"
                  min={0}
                  value={formData.admissionFee ?? ''}
                  onChange={(e) => setFormData({ ...formData, admissionFee: e.target.value })}
                  placeholder="e.g. 5000"
                  className="w-full bg-surface-36 text-slate-100 text-sm rounded-lg px-3.5 py-2.5 border border-edge-40 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors"
                  id="input-student-admissionFee"
                />
              </div>

              {/* Class Fee */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Class Fee
                </label>
                <input
                  type="number"
                  min={0}
                  value={formData.classFee ?? ''}
                  onChange={(e) => setFormData({ ...formData, classFee: e.target.value })}
                  placeholder="e.g. 3000"
                  className="w-full bg-surface-36 text-slate-100 text-sm rounded-lg px-3.5 py-2.5 border border-edge-40 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors"
                  id="input-student-classFee"
                />
                <p className="text-slate-500 text-[11px] mt-1">Leave empty to use the class fee</p>
              </div>

              {/* Discount */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Discount
                </label>
                <input
                  type="text"
                  value={formData.discount || ''}
                  onChange={(e) => setFormData({ ...formData, discount: e.target.value })}
                  placeholder="e.g. 10% or 500"
                  className="w-full bg-surface-36 text-slate-100 text-sm rounded-lg px-3.5 py-2.5 border border-edge-40 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors"
                  id="input-student-discount"
                />
              </div>

              {/* Reference */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Reference
                </label>
                <input
                  type="text"
                  value={formData.reference || ''}
                  onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                  placeholder="e.g. Referred by staff / parent"
                  className="w-full bg-surface-36 text-slate-100 text-sm rounded-lg px-3.5 py-2.5 border border-edge-40 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors"
                  id="input-student-reference"
                />
              </div>

              {/* Note */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Note
                </label>
                <input
                  type="text"
                  value={formData.note || ''}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  placeholder="Any additional note"
                  className="w-full bg-surface-36 text-slate-100 text-sm rounded-lg px-3.5 py-2.5 border border-edge-40 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors"
                  id="input-student-note"
                />
              </div>
            </div>
          )}
        </div>

        {/* Bottom Actions Bar */}
        <div className="bg-surface-16 border border-[#212b3e] rounded-2xl p-4 shadow-xl flex items-center justify-end">
          <button
            type="submit"
            disabled={!!duplicateStudentConflict || !!duplicateFamilyCodeConflict}
            className={`px-7 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all shadow-lg ${
              duplicateStudentConflict || duplicateFamilyCodeConflict
                ? 'bg-slate-800 text-slate-500 border border-slate-700/60 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer shadow-blue-600/30 hover:shadow-blue-600/50'
            }`}
            id="btn-save-student"
          >
            <Save className="w-4 h-4" />
            <span>{editingStudent ? 'Update Student Record' : 'Save Student'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
