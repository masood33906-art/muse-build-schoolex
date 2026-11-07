import React, { useState, useEffect, useMemo } from 'react';
import { X, UserPlus, Save, AlertCircle, AlertTriangle, Link as LinkIcon, PlusCircle, CheckCircle2, ChevronDown } from 'lucide-react';
import { Student, ClassInfo } from '../types';
import { withClassIdFromName } from '../utils/classExportHelper';
import { BOY_AVATAR_URL, GIRL_AVATAR_URL, getStudentAvatar, isLegacyDefaultAvatar } from '../utils/studentAvatarHelper';

interface AddStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (student: Student) => void;
  editingStudent: Student | null;
  existingClasses: string[];
  classes?: ClassInfo[];
  totalStudentCount: number;
  allStudents?: Student[];
}

export const AddStudentModal: React.FC<AddStudentModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingStudent,
  existingClasses,
  classes = [],
  totalStudentCount,
  allStudents = []
}) => {
  const [familyMode, setFamilyMode] = useState<'existing' | 'new'>('new');
  const [selectedExistingFamilyCode, setSelectedExistingFamilyCode] = useState<string>('');

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

  const availableClassNames = useMemo(() => Array.from(availableClassMap.keys()), [availableClassMap]);

  const [formData, setFormData] = useState<Partial<Student>>({
    name: '',
    id: '',
    family: '',
    familyId: '',
    class: availableClassNames[0] || '',
    section: (availableClassNames[0] && availableClassMap.get(availableClassNames[0])?.[0]) || '',
    status: 'Active',
    gender: 'Male',
    bloodGroup: '',
    phone: '',
    emergencyContact: '',
    admissionDate: new Date().toISOString().slice(0, 10),
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

  const availableSectionsForClass = useMemo(() => {
    if (!formData.class) return [];
    const exactSecs = availableClassMap.get(formData.class);
    if (exactSecs) return exactSecs;
    for (const [k, v] of availableClassMap.entries()) {
      if (k.toLowerCase() === formData.class.trim().toLowerCase()) return v;
    }
    return [];
  }, [formData.class, availableClassMap]);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const toggleSection = (key: string) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

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
      }
    });

    return Array.from(map.values()).sort((a, b) => a.familyName.localeCompare(b.familyName));
  }, [allStudents]);

  useEffect(() => {
    const nonEmpty = (v: unknown) => v !== undefined && v !== null && String(v).trim() !== '';
    if (editingStudent) {
      setFormData({
        ...editingStudent,
        photo: isLegacyDefaultAvatar(editingStudent.photo) ? '' : (editingStudent.photo || ''),
        emergencyContact: editingStudent.emergencyContact || editingStudent.phone || ''
      });
      setOpenSections({
        contact: nonEmpty(editingStudent.whatsapp) || nonEmpty(editingStudent.email) || nonEmpty(editingStudent.address) || nonEmpty(editingStudent.emergencyContact || editingStudent.phone),
        parents: nonEmpty(editingStudent.fatherName) || nonEmpty(editingStudent.motherName) || nonEmpty(editingStudent.guardianCnic) || nonEmpty(editingStudent.guardianOccupation) || nonEmpty(editingStudent.motherCnic) || nonEmpty(editingStudent.motherOccupation),
        background: nonEmpty(editingStudent.cnic) || nonEmpty(editingStudent.religion) || nonEmpty(editingStudent.caste) || nonEmpty(editingStudent.previousSchool) || nonEmpty(editingStudent.previousClass) || nonEmpty(editingStudent.previousResult),
        fees: nonEmpty(editingStudent.admissionFee) || nonEmpty(editingStudent.classFee) || nonEmpty(editingStudent.discount) || nonEmpty(editingStudent.reference) || nonEmpty(editingStudent.note)
      });
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
      let candId = `S-${String(nextIdNum).padStart(5, '0')}`;
      let counter = nextIdNum;
      const existingIds = new Set(allStudents.map(s => s.id.trim().toLowerCase()));
      while (existingIds.has(candId.toLowerCase())) {
        counter += 1;
        candId = `S-${String(counter).padStart(5, '0')}`;
      }

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
        bloodGroup: '',
        phone: '',
        emergencyContact: '',
        admissionDate: new Date().toISOString().slice(0, 10),
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
    }
    setErrors({});
  }, [editingStudent, isOpen, totalStudentCount, availableClassNames, availableClassMap, allStudents, existingFamilies]);

  // Duplicate ID conflict
  const duplicateStudentConflict = useMemo(() => {
    const rawId = (formData.id || '').trim().toLowerCase();
    if (!rawId) return null;
    return allStudents.find(
      s => s.id.trim().toLowerCase() === rawId && s.id !== editingStudent?.id
    ) || null;
  }, [formData.id, allStudents, editingStudent]);

  // Duplicate Family code conflict
  const duplicateFamilyCodeConflict = useMemo(() => {
    const rawFamCode = (formData.familyId || '').trim().toLowerCase();
    if (!rawFamCode) return null;
    if (familyMode === 'existing' && selectedExistingFamilyCode.trim().toLowerCase() === rawFamCode) {
      return null;
    }
    const matched = existingFamilies.find(
      f => f.familyId.trim().toLowerCase() === rawFamCode
    );
    if (matched) {
      if (editingStudent && editingStudent.familyId?.trim().toLowerCase() === rawFamCode) {
        return null;
      }
      return matched;
    }
    return null;
  }, [formData.familyId, familyMode, selectedExistingFamilyCode, existingFamilies, editingStudent]);

  const handleSelectExistingFamily = (familyId: string) => {
    setSelectedExistingFamilyCode(familyId);
    if (!familyId) return;
    const found = existingFamilies.find(
      f => f.familyId.toLowerCase() === familyId.toLowerCase()
    );
    if (found) {
      setFamilyMode('existing');
      setFormData(prev => ({
        ...prev,
        familyId: found.familyId,
        family: found.familyName,
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

  const activeAvatarUrl = useMemo(() => getStudentAvatar({
    photo: formData.photo,
    gender: formData.gender,
    name: formData.name
  }), [formData.photo, formData.gender, formData.name]);

  if (!isOpen) return null;

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!formData.name?.trim()) errs.name = 'Student name is required';
    if (!editingStudent && !formData.dob?.trim()) errs.dob = 'Date of Birth is required';
    if (!formData.id?.trim()) errs.id = 'Student ID is required';
    else if (duplicateStudentConflict) {
      errs.id = `Student ID is already assigned to ${duplicateStudentConflict.name}. Must be unique.`;
    }

    if (!formData.family?.trim()) errs.family = 'Father / Guardian name is required';
    if (!formData.familyId?.trim()) errs.familyId = 'Family ID is required';
    else if (duplicateFamilyCodeConflict) {
      errs.familyId = `Family Code is already in use by ${duplicateFamilyCodeConflict.familyName}.`;
    }

    const emergencyNumber = (formData.emergencyContact || formData.phone || '').trim();
    if (!emergencyNumber) {
      errs.emergencyContact = 'Emergency phone number is mandatory';
    } else if (emergencyNumber.replace(/[^0-9]/g, '').length < 7) {
      errs.emergencyContact = 'Valid emergency phone number required (at least 7 digits)';
    }

    if (!formData.class?.trim()) errs.class = 'Class is required';
    if (!formData.section?.trim()) errs.section = 'Section is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const emergencyNumber = (formData.emergencyContact || formData.phone || '').trim();
    const rawPhoto = formData.photo?.trim() ? formData.photo : '';
    const finalPhoto = rawPhoto && !isLegacyDefaultAvatar(rawPhoto) ? rawPhoto : '';

    // Fix P0-3: stamp the stable classId of the selected class at save time.
    onSave(withClassIdFromName({
      id: formData.id!.trim(),
      name: formData.name!.trim(),
      family: formData.family!.trim(),
      familyId: formData.familyId!.trim(),
      class: formData.class!.trim(),
      section: formData.section!.trim().toUpperCase(),
      status: formData.status || 'Active',
      gender: formData.gender || 'Male',
      bloodGroup: formData.bloodGroup || '',
      phone: emergencyNumber,
      emergencyContact: emergencyNumber,
      admissionDate: formData.admissionDate || new Date().toISOString().slice(0, 10),
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
    }, classes));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-[#131926] border border-[#243048] rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl"
        id="modal-add-student"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-edge-22 flex items-center justify-between bg-[#171f2e]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {editingStudent ? 'Edit Student Profile' : 'New Admission'}
              </h3>
              <p className="text-xs text-slate-400">
                {editingStudent ? 'Update student details and credentials' : 'Register student with gender DP & unique family'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-xs">
          {/* Avatar Preview & Gender Toggle */}
          <div className="p-4 rounded-xl bg-surface-7 border border-[#212b3e] flex items-center gap-4">
            <div className="relative w-16 h-16 rounded-xl overflow-hidden border-2 border-blue-500/40 shrink-0 bg-abyss">
              <img src={activeAvatarUrl} alt="Preview" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1">
              <div className="font-bold text-white text-xs mb-1">
                Default DP: {formData.gender === 'Female' ? '👧 Girl Student PNG' : '👦 Boy Student PNG'}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, gender: 'Male' })}
                  className={`px-3 py-1 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    formData.gender === 'Male'
                      ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                      : 'bg-surface-36 border-edge-40 text-slate-400 hover:text-white'
                  }`}
                >
                  <img src={BOY_AVATAR_URL} alt="Boy" className="w-4 h-4 rounded-full" />
                  <span>Boy (Male)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, gender: 'Female' })}
                  className={`px-3 py-1 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    formData.gender === 'Female'
                      ? 'bg-pink-600 text-white border-pink-500 shadow-sm'
                      : 'bg-surface-36 border-edge-40 text-slate-400 hover:text-white'
                  }`}
                >
                  <img src={GIRL_AVATAR_URL} alt="Girl" className="w-4 h-4 rounded-full" />
                  <span>Girl (Female)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Basic Information */}
          <div className="p-3 rounded-xl bg-surface-7 border border-[#212b3e] space-y-3">
            <div className="font-bold text-white text-xs">Basic Information</div>
          {/* Student Name & ID */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Student Full Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Student Name"
                className={`w-full bg-surface-37 text-white rounded-lg px-3 py-2 border ${
                  errors.name ? 'border-rose-500' : 'border-edge-27'
                }`}
              />
              {errors.name && <p className="text-rose-400 text-[10px] mt-1">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Student ID <span className="text-rose-400">*</span> (Unique)
              </label>
              <input
                type="text"
                value={formData.id || ''}
                onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                placeholder="e.g. S-00101"
                className={`w-full bg-surface-37 text-white rounded-lg px-3 py-2 font-mono border ${
                  duplicateStudentConflict || errors.id ? 'border-rose-500 bg-rose-950/20' : 'border-edge-27'
                }`}
              />
              {duplicateStudentConflict ? (
                <p className="text-rose-400 text-[10px] mt-1 font-bold">
                  ⚠️ ID already assigned to {duplicateStudentConflict.name}
                </p>
              ) : errors.id ? (
                <p className="text-rose-400 text-[10px] mt-1">{errors.id}</p>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Date of Birth {editingStudent ? (
                  <span className="text-slate-400 font-normal text-[10px]">Recommended</span>
                ) : (
                  <span className="text-rose-400">*</span>
                )}
              </label>
              <input
                type="date"
                value={formData.dob || ''}
                onChange={(e) => {
                  setFormData({ ...formData, dob: e.target.value });
                  if (errors.dob) {
                    setErrors(prev => {
                      const next = { ...prev };
                      delete next.dob;
                      return next;
                    });
                  }
                }}
                className={`w-full bg-surface-37 text-white rounded-lg px-3 py-2 border ${
                  errors.dob ? 'border-rose-500' : 'border-edge-27'
                }`}
              />
              {errors.dob && <p className="text-rose-400 text-[10px] mt-1">{errors.dob}</p>}
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Blood Group</label>
              <select
                value={formData.bloodGroup || ''}
                onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
                className="w-full bg-surface-37 text-white rounded-lg px-3 py-2 border border-edge-27"
              >
                <option value="">— Select —</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
              </select>
            </div>
          </div>
          </div>

          {/* Family Selection & Guardian */}
          <div className="p-3 rounded-xl bg-surface-7 border border-[#212b3e] space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white text-xs">Guardian & Family</span>
              <div className="flex items-center gap-1 bg-[#141b2a] p-0.5 rounded-lg border border-[#24334c]">
                <button
                  type="button"
                  onClick={() => setFamilyMode('existing')}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                    familyMode === 'existing' ? 'bg-blue-600 text-white' : 'text-slate-400'
                  }`}
                >
                  Select Existing
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFamilyMode('new');
                    setSelectedExistingFamilyCode('');
                  }}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                    familyMode === 'new' ? 'bg-blue-600 text-white' : 'text-slate-400'
                  }`}
                >
                  New Family
                </button>
              </div>
            </div>

            {familyMode === 'existing' && (
              <select
                value={selectedExistingFamilyCode}
                onChange={(e) => handleSelectExistingFamily(e.target.value)}
                className="w-full bg-surface-37 border border-edge-27 text-white rounded-lg px-3 py-2 text-xs"
              >
                {existingFamilies.length === 0 ? (
                  <option value="">-- No registered families available yet --</option>
                ) : (
                  <>
                    <option value="">-- Choose existing registered family --</option>
                    {existingFamilies.map(fam => (
                      <option key={fam.familyId} value={fam.familyId}>
                        {fam.familyName} (Code: {fam.familyId}) • {fam.studentCount} enrolled
                      </option>
                    ))}
                  </>
                )}
              </select>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Father / Guardian Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.family || ''}
                  onChange={(e) => setFormData({ ...formData, family: e.target.value })}
                  placeholder="Guardian Name"
                  className={`w-full bg-surface-37 text-white rounded-lg px-3 py-2 border ${
                    errors.family ? 'border-rose-500' : 'border-edge-27'
                  }`}
                />
                {errors.family && <p className="text-rose-400 text-[10px] mt-1">{errors.family}</p>}
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Family Code / ID <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.familyId || ''}
                  onChange={(e) => setFormData({ ...formData, familyId: e.target.value })}
                  placeholder="e.g. F-0080"
                  className={`w-full bg-surface-37 text-white rounded-lg px-3 py-2 font-mono border ${
                    duplicateFamilyCodeConflict || errors.familyId ? 'border-rose-500 bg-rose-950/20' : 'border-edge-27'
                  }`}
                />
                {errors.familyId && <p className="text-rose-400 text-[10px] mt-1">{errors.familyId}</p>}
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1 flex items-center justify-between">
                <span>Phone <span className="text-rose-400">*</span></span>
              </label>
              <input
                type="text"
                value={formData.emergencyContact || formData.phone || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormData({ ...formData, emergencyContact: val, phone: val });
                }}
                placeholder="+92 300 1234567"
                className={`w-full bg-surface-37 text-white rounded-lg px-3 py-2 border ${
                  errors.emergencyContact ? 'border-rose-500 ring-1 ring-rose-500/50' : 'border-edge-27'
                }`}
                required
              />
              {errors.emergencyContact && (
                <p className="text-rose-400 text-[10px] mt-1 font-medium">{errors.emergencyContact}</p>
              )}
            </div>

            {duplicateFamilyCodeConflict && (
              <div className="p-3 rounded-lg bg-rose-950/70 border border-rose-500 text-rose-200 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold text-white">
                    Conflict: Family Code "{formData.familyId}" is already assigned!
                  </div>
                  <p>
                    Belongs to family of <strong>{duplicateFamilyCodeConflict.familyName}</strong> ({duplicateFamilyCodeConflict.studentCount} students). Please select it from the dropdown or use a unique new code.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleSelectExistingFamily(duplicateFamilyCodeConflict.familyId)}
                    className="px-2.5 py-1 rounded bg-rose-600 text-white font-bold text-[10px] hover:bg-rose-500 cursor-pointer"
                  >
                    Select this existing family
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Academic Information */}
          <div className="p-3 rounded-xl bg-surface-7 border border-[#212b3e] space-y-3">
            <div className="font-bold text-white text-xs">Academic Information</div>
            <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Class <span className="text-rose-400">*</span>
              </label>
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
                }}
                className="w-full bg-surface-37 border border-edge-27 text-white rounded-lg px-3 py-2"
              >
                {availableClassNames.length === 0 ? (
                  <option value="">-- No classes available --</option>
                ) : (
                  availableClassNames.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Section <span className="text-rose-400">*</span>
              </label>
              <select
                value={formData.section || ''}
                onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                className="w-full bg-surface-37 border border-edge-27 text-white rounded-lg px-3 py-2"
              >
                {availableSectionsForClass.length === 0 ? (
                  <option value="">-- No sections available --</option>
                ) : (
                  availableSectionsForClass.map(sec => (
                    <option key={sec} value={sec}>Section {sec}</option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Roll No</label>
              <input
                type="text"
                value={formData.rollNo || ''}
                onChange={(e) => setFormData({ ...formData, rollNo: e.target.value })}
                placeholder="Roll No"
                className="w-full bg-surface-37 text-white rounded-lg px-3 py-2 border border-edge-27"
              />
            </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Status</label>
                <select
                  value={formData.status || 'Active'}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as Student['status'] })}
                  className="w-full bg-surface-37 text-white rounded-lg px-3 py-2 border border-edge-27"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Admission Date</label>
                <input
                  type="date"
                  value={formData.admissionDate || ''}
                  onChange={(e) => setFormData({ ...formData, admissionDate: e.target.value })}
                  className="w-full bg-surface-37 text-white rounded-lg px-3 py-2 border border-edge-27"
                />
              </div>

              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-slate-300 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!formData.isNewAdmission}
                    onChange={(e) => setFormData({ ...formData, isNewAdmission: e.target.checked })}
                    className="w-4 h-4 accent-blue-600"
                  />
                  <span>New Admission</span>
                </label>
              </div>
            </div>
          </div>

          {/* Contact Details (collapsible) */}
          <div className="p-3 rounded-xl bg-surface-7 border border-[#212b3e] space-y-3">
            <button
              type="button"
              onClick={() => toggleSection('contact')}
              className="w-full flex items-center justify-between cursor-pointer"
            >
              <span className="font-bold text-white text-xs">Contact Details</span>
              <ChevronDown className={`w-4 h-4 text-slate-300 transition-transform ${openSections.contact ? 'rotate-180' : ''}`} />
            </button>
            {openSections.contact && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">WhatsApp</label>
                  <input
                    type="tel"
                    value={formData.whatsapp || ''}
                    onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                    placeholder="WhatsApp Number"
                    className="w-full bg-surface-37 text-white rounded-lg px-3 py-2 border border-edge-27"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="Email Address"
                    className="w-full bg-surface-37 text-white rounded-lg px-3 py-2 border border-edge-27"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Emergency Contact</label>
                  <input
                    type="tel"
                    value={formData.emergencyContact || ''}
                    onChange={(e) => setFormData({ ...formData, emergencyContact: e.target.value })}
                    placeholder="Emergency Contact Number"
                    className="w-full bg-surface-37 text-white rounded-lg px-3 py-2 border border-edge-27"
                  />
                  {errors.emergencyContact && (
                    <p className="text-rose-400 text-[10px] mt-1 font-medium">{errors.emergencyContact}</p>
                  )}
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Address</label>
                  <input
                    type="text"
                    value={formData.address || ''}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Home Address"
                    className="w-full bg-surface-37 text-white rounded-lg px-3 py-2 border border-edge-27"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Parents & Guardian Details (collapsible) */}
          <div className="p-3 rounded-xl bg-surface-7 border border-[#212b3e] space-y-3">
            <button
              type="button"
              onClick={() => toggleSection('parents')}
              className="w-full flex items-center justify-between cursor-pointer"
            >
              <span className="font-bold text-white text-xs">Parents & Guardian Details</span>
              <ChevronDown className={`w-4 h-4 text-slate-300 transition-transform ${openSections.parents ? 'rotate-180' : ''}`} />
            </button>
            {openSections.parents && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Father Name</label>
                  <input
                    type="text"
                    value={formData.fatherName || ''}
                    onChange={(e) => setFormData({ ...formData, fatherName: e.target.value })}
                    placeholder="Father Name"
                    className="w-full bg-surface-37 text-white rounded-lg px-3 py-2 border border-edge-27"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Mother Name</label>
                  <input
                    type="text"
                    value={formData.motherName || ''}
                    onChange={(e) => setFormData({ ...formData, motherName: e.target.value })}
                    placeholder="Mother Name"
                    className="w-full bg-surface-37 text-white rounded-lg px-3 py-2 border border-edge-27"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Guardian CNIC</label>
                  <input
                    type="text"
                    value={formData.guardianCnic || ''}
                    onChange={(e) => setFormData({ ...formData, guardianCnic: e.target.value })}
                    placeholder="Guardian CNIC"
                    className="w-full bg-surface-37 text-white rounded-lg px-3 py-2 border border-edge-27"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Guardian Occupation</label>
                  <input
                    type="text"
                    value={formData.guardianOccupation || ''}
                    onChange={(e) => setFormData({ ...formData, guardianOccupation: e.target.value })}
                    placeholder="Guardian Occupation"
                    className="w-full bg-surface-37 text-white rounded-lg px-3 py-2 border border-edge-27"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Mother CNIC</label>
                  <input
                    type="text"
                    value={formData.motherCnic || ''}
                    onChange={(e) => setFormData({ ...formData, motherCnic: e.target.value })}
                    placeholder="Mother CNIC"
                    className="w-full bg-surface-37 text-white rounded-lg px-3 py-2 border border-edge-27"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Mother Occupation</label>
                  <input
                    type="text"
                    value={formData.motherOccupation || ''}
                    onChange={(e) => setFormData({ ...formData, motherOccupation: e.target.value })}
                    placeholder="Mother Occupation"
                    className="w-full bg-surface-37 text-white rounded-lg px-3 py-2 border border-edge-27"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Personal & Background (collapsible) */}
          <div className="p-3 rounded-xl bg-surface-7 border border-[#212b3e] space-y-3">
            <button
              type="button"
              onClick={() => toggleSection('background')}
              className="w-full flex items-center justify-between cursor-pointer"
            >
              <span className="font-bold text-white text-xs">Personal & Background</span>
              <ChevronDown className={`w-4 h-4 text-slate-300 transition-transform ${openSections.background ? 'rotate-180' : ''}`} />
            </button>
            {openSections.background && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Student CNIC / B-Form</label>
                  <input
                    type="text"
                    value={formData.cnic || ''}
                    onChange={(e) => setFormData({ ...formData, cnic: e.target.value })}
                    placeholder="Student CNIC / B-Form"
                    className="w-full bg-surface-37 text-white rounded-lg px-3 py-2 border border-edge-27"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Religion</label>
                  <input
                    type="text"
                    value={formData.religion || ''}
                    onChange={(e) => setFormData({ ...formData, religion: e.target.value })}
                    placeholder="Religion"
                    className="w-full bg-surface-37 text-white rounded-lg px-3 py-2 border border-edge-27"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Caste</label>
                  <input
                    type="text"
                    value={formData.caste || ''}
                    onChange={(e) => setFormData({ ...formData, caste: e.target.value })}
                    placeholder="Caste"
                    className="w-full bg-surface-37 text-white rounded-lg px-3 py-2 border border-edge-27"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Previous School</label>
                  <input
                    type="text"
                    value={formData.previousSchool || ''}
                    onChange={(e) => setFormData({ ...formData, previousSchool: e.target.value })}
                    placeholder="Previous School"
                    className="w-full bg-surface-37 text-white rounded-lg px-3 py-2 border border-edge-27"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Previous Class</label>
                  <input
                    type="text"
                    value={formData.previousClass || ''}
                    onChange={(e) => setFormData({ ...formData, previousClass: e.target.value })}
                    placeholder="Previous Class"
                    className="w-full bg-surface-37 text-white rounded-lg px-3 py-2 border border-edge-27"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Previous Result</label>
                  <input
                    type="text"
                    value={formData.previousResult || ''}
                    onChange={(e) => setFormData({ ...formData, previousResult: e.target.value })}
                    placeholder="Previous Result"
                    className="w-full bg-surface-37 text-white rounded-lg px-3 py-2 border border-edge-27"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Fees & Other Information (collapsible) */}
          <div className="p-3 rounded-xl bg-surface-7 border border-[#212b3e] space-y-3">
            <button
              type="button"
              onClick={() => toggleSection('fees')}
              className="w-full flex items-center justify-between cursor-pointer"
            >
              <span className="font-bold text-white text-xs">Fees & Other Information</span>
              <ChevronDown className={`w-4 h-4 text-slate-300 transition-transform ${openSections.fees ? 'rotate-180' : ''}`} />
            </button>
            {openSections.fees && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Admission Fee</label>
                  <input
                    type="number"
                    min={0}
                    value={formData.admissionFee ?? ''}
                    onChange={(e) => setFormData({ ...formData, admissionFee: e.target.value })}
                    placeholder="Admission Fee"
                    className="w-full bg-surface-37 text-white rounded-lg px-3 py-2 border border-edge-27"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Class Fee</label>
                  <input
                    type="number"
                    min={0}
                    value={formData.classFee ?? ''}
                    onChange={(e) => setFormData({ ...formData, classFee: e.target.value })}
                    placeholder="Class Fee"
                    className="w-full bg-surface-37 text-white rounded-lg px-3 py-2 border border-edge-27"
                  />
                  <p className="text-slate-400 text-[10px] mt-1">Leave empty to use the class fee</p>
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Discount</label>
                  <input
                    type="text"
                    value={formData.discount || ''}
                    onChange={(e) => setFormData({ ...formData, discount: e.target.value })}
                    placeholder="Discount"
                    className="w-full bg-surface-37 text-white rounded-lg px-3 py-2 border border-edge-27"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Reference</label>
                  <input
                    type="text"
                    value={formData.reference || ''}
                    onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                    placeholder="Reference"
                    className="w-full bg-surface-37 text-white rounded-lg px-3 py-2 border border-edge-27"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-slate-300 font-semibold mb-1">Note</label>
                  <input
                    type="text"
                    value={formData.note || ''}
                    onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                    placeholder="Note"
                    className="w-full bg-surface-37 text-white rounded-lg px-3 py-2 border border-edge-27"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-edge-22 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-surface-19 hover:bg-surface-42 text-slate-300 font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!!duplicateStudentConflict || !!duplicateFamilyCodeConflict}
              className={`px-5 py-2 rounded-lg font-bold flex items-center gap-1.5 shadow-lg ${
                duplicateStudentConflict || duplicateFamilyCodeConflict
                  ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer shadow-blue-600/30'
              }`}
            >
              <Save className="w-4 h-4" />
              <span>{editingStudent ? 'Save Changes' : 'Confirm Admission'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
