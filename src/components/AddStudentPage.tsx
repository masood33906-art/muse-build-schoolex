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
  PlusCircle
} from 'lucide-react';
import { Student, ClassInfo } from '../types';
import { BreadcrumbTrail } from './BreadcrumbTrail';
import { 
  BOY_AVATAR_URL, 
  GIRL_AVATAR_URL, 
  getDefaultAvatarByGender 
} from '../utils/studentAvatarHelper';

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
    gender: 'Male',
    bloodGroup: 'B+',
    phone: '',
    emergencyContact: '',
    admissionDate: new Date().toISOString().slice(0, 10),
    photo: ''
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

  const [errors, setErrors] = useState<Record<string, string>>({});
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
        emergencyContact: editingStudent.emergencyContact || editingStudent.phone || ''
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
        gender: 'Male',
        bloodGroup: 'B+',
        phone: '',
        emergencyContact: '',
        admissionDate: new Date().toISOString().slice(0, 10),
        isNewAdmission: true,
        photo: ''
      });
      setFamilyMode('new');
      setSelectedExistingFamilyCode('');
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
  const activeAvatarUrl = useMemo(() => {
    if (formData.photo && formData.photo.trim().length > 0) {
      return formData.photo;
    }
    return getDefaultAvatarByGender(formData.gender);
  }, [formData.photo, formData.gender]);

  const validate = () => {
    const errs: Record<string, string> = {};

    // 1. Full name
    if (!formData.name?.trim()) {
      errs.name = 'Student full name is required';
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

    const emergencyNumber = (formData.emergencyContact || formData.phone || '').trim();
    // Default DP: if no custom photo uploaded, attach the gender-specific avatar PNG
    const finalPhoto = formData.photo?.trim() 
      ? formData.photo 
      : getDefaultAvatarByGender(formData.gender);

    onSave({
      id: formData.id!.trim(),
      name: formData.name!.trim(),
      family: formData.family!.trim(),
      familyId: formData.familyId!.trim(),
      class: formData.class!.trim(),
      section: formData.section!.trim().toUpperCase(),
      status: formData.status || 'Active',
      gender: formData.gender || 'Male',
      bloodGroup: formData.bloodGroup || 'B+',
      phone: emergencyNumber,
      emergencyContact: emergencyNumber,
      admissionDate: formData.admissionDate || new Date().toISOString().slice(0, 10),
      isNewAdmission: editingStudent ? editingStudent.isNewAdmission : true,
      photo: finalPhoto
    });
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
        {/* SECTION 1: PERSONAL INFORMATION (WITH GENDER SELECTION TRIGGERING DP)     */}
        {/* ========================================================================= */}
        <div className="bg-[#121824] border border-[#212b3e] rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-[#212d42]">
            <User className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-white">Personal Information</h2>
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
                className={`w-full bg-[#162032] text-slate-100 text-sm rounded-lg px-3.5 py-2.5 border ${
                  errors.name ? 'border-rose-500' : 'border-[#283852]'
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
                      : 'bg-[#162032] border-[#283852] text-slate-400 hover:text-white hover:border-slate-600'
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
                      : 'bg-[#162032] border-[#283852] text-slate-400 hover:text-white hover:border-slate-600'
                  }`}
                  id="btn-gender-female"
                >
                  <img src={GIRL_AVATAR_URL} alt="Girl" className="w-5 h-5 rounded-full object-cover" />
                  <span>Girl (Female)</span>
                </button>
              </div>
            </div>

            {/* Blood Group Dropdown */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Blood Group
              </label>
              <div className="relative">
                <select
                  value={formData.bloodGroup || 'B+'}
                  onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
                  className="w-full appearance-none bg-[#162032] border border-[#283852] text-slate-100 text-sm rounded-lg px-3.5 py-2.5 pr-10 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors cursor-pointer"
                  id="input-student-blood-group"
                >
                  {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map(bg => (
                    <option key={bg} value={bg}>{bg}</option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Status Dropdown */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Enrollment Status
              </label>
              <div className="relative">
                <select
                  value={formData.status || 'Active'}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full appearance-none bg-[#162032] border border-[#283852] text-slate-100 text-sm rounded-lg px-3.5 py-2.5 pr-10 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors cursor-pointer"
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
                className="w-full bg-[#162032] border border-[#283852] text-slate-100 text-sm rounded-lg px-3.5 py-2.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors"
                id="input-student-admission-date"
              />
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SECTION 2: ACADEMIC DETAILS & STRICT UNIQUE STUDENT ID ENFORCEMENT       */}
        {/* ========================================================================= */}
        <div className="bg-[#121824] border border-[#212b3e] rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#212d42]">
            <div className="flex items-center gap-2">
              <School className="w-4 h-4 text-purple-400" />
              <h2 className="text-sm font-bold text-white">Academic Details</h2>
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                className={`w-full bg-[#162032] text-slate-100 text-sm rounded-lg px-3.5 py-2.5 font-mono border ${
                  duplicateStudentConflict || errors.id 
                    ? 'border-rose-500 ring-1 ring-rose-500/50 bg-rose-950/20' 
                    : 'border-[#283852]'
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
                  className={`w-full appearance-none bg-[#162032] border ${
                    errors.class ? 'border-rose-500' : 'border-[#283852]'
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
                  className={`w-full appearance-none bg-[#162032] border ${
                    errors.section ? 'border-rose-500' : 'border-[#283852]'
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
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SECTION 3: GUARDIAN & FAMILY (DROPDOWN OR NEW + DUPLICATE CONFLICT NOTICE) */}
        {/* ========================================================================= */}
        <div className="bg-[#121824] border border-[#212b3e] rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#212d42]">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-sky-400" />
              <h2 className="text-sm font-bold text-white">Guardian & Family Details</h2>
            </div>

            {/* Mode Toggle: Existing Family vs New Family */}
            <div className="flex items-center bg-[#151e30] border border-[#22314a] rounded-lg p-0.5 text-xs">
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
                  className="w-full appearance-none bg-[#162032] border border-[#283852] text-slate-100 text-sm rounded-lg px-3.5 py-2.5 pr-10 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors cursor-pointer"
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
                className={`w-full bg-[#162032] text-slate-100 text-sm rounded-lg px-3.5 py-2.5 border ${
                  errors.family ? 'border-rose-500' : 'border-[#283852]'
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
                className={`w-full bg-[#162032] text-slate-100 text-sm rounded-lg px-3.5 py-2.5 font-mono border ${
                  duplicateFamilyCodeConflict || errors.familyId
                    ? 'border-rose-500 ring-1 ring-rose-500/50 bg-rose-950/20'
                    : 'border-[#283852]'
                } focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors`}
                id="input-student-family-id"
              />
              {errors.familyId && <p className="text-rose-400 text-[11px] mt-1">{errors.familyId}</p>}
            </div>

            {/* Mandatory Emergency Contact Phone */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Emergency Phone Number <span className="text-rose-400">*</span>
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
                  className={`w-full bg-[#162032] text-slate-100 text-sm rounded-lg pl-9 pr-3.5 py-2.5 border ${
                    errors.emergencyContact ? 'border-rose-500 ring-1 ring-rose-500/50' : 'border-[#283852]'
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
                    className="px-3 py-1.5 rounded-lg bg-[#141b2b] hover:bg-[#1a2538] border border-[#2a3a55] text-slate-200 text-xs font-semibold cursor-pointer transition-colors"
                  >
                    Generate New Unique Family Code
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Actions Bar */}
        <div className="bg-[#121824] border border-[#212b3e] rounded-2xl p-4 shadow-xl flex items-center justify-end">
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
