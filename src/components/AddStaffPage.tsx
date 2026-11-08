import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, 
  Upload, 
  Trash2, 
  Save, 
  User, 
  Briefcase, 
  Phone, 
  Calendar, 
  ChevronDown,
  Camera,
  CheckCircle2,
  AlertCircle,
  DollarSign,
  GraduationCap
} from 'lucide-react';
import { StaffMember, StaffCategory, StaffStatus, PayStatus } from '../types';
import { getInitials, getAvatarColor } from '../data/initialStudents';
import { STAFF_DEPARTMENTS, STAFF_CATEGORIES } from '../data/initialStaff';
import { BreadcrumbTrail } from './BreadcrumbTrail';
import { getStaffSalaryAccrualInfo } from '../utils/salaryAccrualHelper';
import { buildStaffRecordFromForm } from '../utils/formRecords';
import { localISODate } from '../utils/dates';

interface AddStaffPageProps {
  onBack: () => void;
  onNavigateOverview?: () => void;
  onSave: (staff: StaffMember) => void;
  editingStaff: StaffMember | null;
  totalStaffCount: number;
}

export const AddStaffPage: React.FC<AddStaffPageProps> = ({
  onBack,
  onNavigateOverview,
  onSave,
  editingStaff,
  totalStaffCount
}) => {
  const [formData, setFormData] = useState<Partial<StaffMember>>({
    name: '',
    id: '',
    role: '',
    category: 'Teacher',
    department: 'Academics',
    qualification: '',
    // No pre-filled salary, gender or blood group (owner rule, 2026-11-08):
    // salary is a required field the admin must type (validate() enforces
    // it); gender/blood group are optional facts that stay unset unless
    // actually provided. The old defaults (75000 / 'Male' / 'B+') were
    // stored on every record the user did not explicitly fill.
    payStatus: 'Pending',
    status: 'Active',
    phone: '',
    email: '',
    joiningDate: localISODate(),
    bloodGroup: '',
    emergencyContact: '',
    address: '',
    photo: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editingStaff) {
      setFormData(editingStaff);
    } else {
      const nextIdNum = totalStaffCount + 101;
      setFormData({
        name: '',
        id: `EMP-${String(nextIdNum).padStart(4, '0')}`,
        role: '',
        category: 'Teacher',
        department: 'Academics',
        qualification: '',
        // salary / gender / blood group intentionally unset — see the
        // initial-state note above (blank in → blank stored).
        payStatus: 'Pending',
        status: 'Active',
        phone: '',
        email: '',
        joiningDate: localISODate(),
        bloodGroup: '',
        emergencyContact: '',
        address: '',
        photo: ''
      });
    }
    setErrors({});
  }, [editingStaff, totalStaffCount]);

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
      const result = await resizeImageToDataURL(file, 256, 0.7, 'image/jpeg');
      setFormData(prev => ({ ...prev, photo: result }));
    } catch {
      setErrors(prev => ({ ...prev, photo: 'Could not process the selected image.' }));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleRemovePhoto = () => {
    setFormData(prev => ({ ...prev, photo: '' }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.name?.trim()) {
      newErrors.name = 'Full Name is required';
    }
    if (!formData.id?.trim()) {
      newErrors.id = 'Employee ID is required';
    }
    if (!formData.role?.trim()) {
      newErrors.role = 'Role / Designation is required';
    }
    if (!formData.salary || Number(formData.salary) <= 0) {
      newErrors.salary = 'Please enter a valid monthly salary';
    }
    if (!formData.phone?.trim()) {
      newErrors.phone = 'Phone number is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const accrualPreview = getStaffSalaryAccrualInfo({
    id: formData.id || 'TEMP',
    name: formData.name || 'Staff',
    role: formData.role || 'Teacher',
    category: (formData.category as StaffCategory) || 'Teacher',
    department: formData.department || 'Academics',
    qualification: formData.qualification || '',
    salary: Number(formData.salary) || 0,
    payStatus: (formData.payStatus as PayStatus) || 'Pending',
    status: (formData.status as StaffStatus) || 'Active',
    phone: formData.phone || '',
    email: formData.email || '',
    joiningDate: formData.joiningDate || localISODate(),
    paidMonths: editingStaff?.paidMonths || []
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    // The stored record is built by the shared save-path builder
    // (utils/formRecords.ts), proof-tested in
    // proof-no-invented-defaults.mts.
    onSave(buildStaffRecordFromForm(formData, editingStaff));
  };

  const avatarColor = formData.name ? getAvatarColor(formData.name) : 'bg-emerald-600';
  const initials = formData.name ? getInitials(formData.name) : 'EM';

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Top Action / Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1e2a3e] pb-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-xl bg-[#141d2c] hover:bg-surface-43 border border-[#22314a] text-slate-300 hover:text-white transition-all cursor-pointer shadow-sm"
            title="Return to Staff Directory"
            id="btn-back-to-staff-directory"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-white tracking-tight">
                {editingStaff ? 'Edit Staff Member' : 'Add New Staff Member'}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                Staff Onboarding
              </span>
            </div>
            <BreadcrumbTrail
              items={[
                { label: 'Overview', onClick: onNavigateOverview },
                { label: 'Staff', onClick: onBack },
                { label: editingStaff ? 'Edit Staff' : 'Add Staff' }
              ]}
            />
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 rounded-xl bg-surface-32 hover:bg-[#1d2a40] border border-edge-39 text-slate-300 hover:text-white text-xs font-semibold cursor-pointer transition-all"
            id="btn-cancel-add-staff"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer transition-all shadow-md shadow-emerald-600/25"
            id="btn-save-staff"
          >
            <Save className="w-4 h-4" />
            <span>{editingStaff ? 'Update Staff Member' : 'Save Staff Member'}</span>
          </button>
        </div>
      </div>

      {/* Main Two-Column Form Container */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Photo Upload Card */}
        <div className="lg:col-span-4 space-y-5">
          <div className="bg-surface-17 border border-edge-19 rounded-2xl p-5 shadow-lg flex flex-col items-center text-center">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-1.5 self-start">
              <Camera className="w-4 h-4 text-emerald-400" />
              <span>Employee Photo</span>
            </h3>

            {/* Photo Avatar Preview */}
            <div className="relative mb-4 group">
              {formData.photo ? (
                <div className="relative w-36 h-36 rounded-2xl overflow-hidden border-2 border-emerald-500 shadow-xl bg-[#0f141f]">
                  <img
                    src={formData.photo}
                    alt={formData.name || 'Staff'}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-rose-400 transition-opacity cursor-pointer"
                    title="Remove Photo"
                  >
                    <Trash2 className="w-6 h-6 mb-1" />
                    <span className="text-[11px] font-semibold text-white">Remove Photo</span>
                  </button>
                </div>
              ) : (
                <div
                  className={`w-36 h-36 rounded-2xl ${avatarColor} flex flex-col items-center justify-center text-white shadow-xl border-2 border-[#2c3d5a] select-none`}
                >
                  <span className="text-3xl font-extrabold tracking-wider">{initials}</span>
                  <span className="text-[10px] text-white/70 uppercase font-semibold mt-1">Default Monogram</span>
                </div>
              )}
            </div>

            {/* Drag & Drop Upload Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`w-full p-4 rounded-xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 ${
                isDragOver
                  ? 'border-emerald-500 bg-emerald-500/10'
                  : 'border-edge-38 hover:border-emerald-500/50 bg-surface-39 hover:bg-[#1a273b]'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileChange(e.target.files[0]);
                  }
                }}
              />
              <Upload className="w-5 h-5 text-emerald-400 mb-0.5" />
              <p className="text-xs font-semibold text-white">
                {formData.photo ? 'Change Photo' : 'Upload Employee Photo'}
              </p>
              <p className="text-[10px] text-slate-400">
                Drag and drop image, or browse files (Max 4MB)
              </p>
            </div>

            <p className="text-[11px] text-slate-500 mt-3 text-left w-full">
              Used for generated Staff ID cards, Payslips, and employee roster directory.
            </p>
          </div>

          {/* Quick Category Summary */}
          <div className="bg-surface-17 border border-edge-19 rounded-2xl p-5 text-xs space-y-3">
            <h4 className="font-semibold text-slate-300">Staff Category Guidelines:</h4>
            <ul className="space-y-1.5 text-[11px] text-slate-400 list-disc list-inside">
              <li><strong className="text-emerald-400">Teacher:</strong> Subject lecturers, class incharge</li>
              <li><strong className="text-blue-400">Admin:</strong> Principal, vice principal, coordinators</li>
              <li><strong className="text-amber-400">Finance:</strong> Accountants, fee incharge</li>
              <li><strong className="text-purple-400">Support:</strong> IT, librarian, lab technicians, nurse</li>
              <li><strong className="text-slate-300">Operations:</strong> Transport, security, maintenance</li>
            </ul>
          </div>
        </div>

        {/* Right Column: Information Cards */}
        <div className="lg:col-span-8 space-y-5">
          {/* Section 1: Employment & Designation */}
          <div className="bg-surface-17 border border-edge-19 rounded-2xl p-5 shadow-lg space-y-4">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Briefcase className="w-4 h-4 text-emerald-400" />
              <span>Employment & Designation Details</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Full Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Full name"
                  className={`w-full bg-surface-39 border rounded-lg px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors ${
                    errors.name ? 'border-rose-500' : 'border-edge-38'
                  }`}
                  id="input-staff-name"
                />
                {errors.name && <p className="text-[10px] text-rose-400 mt-1">{errors.name}</p>}
              </div>

              {/* Father Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Father's Name
                </label>
                <input
                  type="text"
                  value={formData.fatherName || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, fatherName: e.target.value }))}
                  placeholder="e.g. Father's full name"
                  className="w-full bg-surface-39 border border-edge-38 rounded-lg px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  id="input-staff-father"
                />
              </div>

              {/* Employee ID */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Employee ID <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.id || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, id: e.target.value }))}
                  placeholder="e.g. STF-0012"
                  className={`w-full bg-surface-39 border font-mono rounded-lg px-3 py-2.5 text-xs text-emerald-400 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors ${
                    errors.id ? 'border-rose-500' : 'border-edge-38'
                  }`}
                  id="input-staff-id"
                />
                {errors.id && <p className="text-[10px] text-rose-400 mt-1">{errors.id}</p>}
              </div>

              {/* CNIC */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  CNIC Number
                </label>
                <input
                  type="text"
                  value={formData.cnic || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, cnic: e.target.value }))}
                  placeholder="e.g. 35202-1234567-1"
                  className="w-full bg-surface-39 border border-edge-38 font-mono rounded-lg px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  id="input-staff-cnic"
                />
              </div>

              {/* Role / Designation */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Role / Designation <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.role || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                  placeholder="e.g. otherStaff, Accountant, teacher"
                  className={`w-full bg-surface-39 border rounded-lg px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors ${
                    errors.role ? 'border-rose-500' : 'border-edge-38'
                  }`}
                  id="input-staff-role"
                />
                {errors.role && <p className="text-[10px] text-rose-400 mt-1">{errors.role}</p>}
              </div>

              {/* Staff Category */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Category
                </label>
                <div className="relative">
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value as StaffCategory }))}
                    className="w-full appearance-none bg-surface-39 border border-edge-38 rounded-lg px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    {STAFF_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                </div>
              </div>

              {/* Department */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Department
                </label>
                <div className="relative">
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                    className="w-full appearance-none bg-surface-39 border border-edge-38 rounded-lg px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    {STAFF_DEPARTMENTS.map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                </div>
              </div>

              {/* Employment Status */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Employment Status
                </label>
                <div className="relative">
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as StaffStatus }))}
                    className="w-full appearance-none bg-surface-39 border border-edge-38 rounded-lg px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="Active">Active</option>
                    <option value="On Leave">On Leave</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Salary & Compensation */}
          <div className="bg-surface-17 border border-edge-19 rounded-2xl p-5 shadow-lg space-y-4">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-amber-400" />
              <span>Compensation & Salary Structure</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Monthly Base Salary */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Monthly Base Salary (Rs.) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.salary || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, salary: Number(e.target.value) }))}
                  placeholder="e.g. 85000"
                  className={`w-full bg-surface-39 border font-mono rounded-lg px-3 py-2.5 text-xs text-amber-300 focus:outline-none focus:border-amber-500 transition-colors ${
                    errors.salary ? 'border-rose-500' : 'border-edge-38'
                  }`}
                  id="input-staff-salary"
                />
                {errors.salary && <p className="text-[10px] text-rose-400 mt-1">{errors.salary}</p>}
              </div>

              {/* Salary Pay Status */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Current Pay Status
                </label>
                <div className="relative">
                  <select
                    value={formData.payStatus}
                    onChange={(e) => setFormData(prev => ({ ...prev, payStatus: e.target.value as PayStatus }))}
                    className="w-full appearance-none bg-surface-39 border border-edge-38 rounded-lg px-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="Paid">Paid</option>
                    <option value="Pending">Pending</option>
                    <option value="Overdue">Overdue</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                </div>
              </div>

              {/* Joining Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Joining Date
                </label>
                <input
                  type="date"
                  value={formData.joiningDate || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, joiningDate: e.target.value }))}
                  className="w-full bg-surface-39 border border-edge-38 rounded-lg px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Academic Qualifications & Degrees */}
          <div className="bg-surface-17 border border-edge-19 rounded-2xl p-5 shadow-lg space-y-4">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <GraduationCap className="w-4 h-4 text-blue-400" />
              <span>Academic Qualifications</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Highest Degree / Qualification
                </label>
                <input
                  type="text"
                  value={formData.qualification || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, qualification: e.target.value }))}
                  placeholder="e.g. M.Phil English Literature, B.Ed"
                  className="w-full bg-surface-39 border border-edge-38 rounded-lg px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Blood Group
                </label>
                <div className="relative">
                  <select
                    value={formData.bloodGroup}
                    onChange={(e) => setFormData(prev => ({ ...prev, bloodGroup: e.target.value }))}
                    className="w-full appearance-none bg-surface-39 border border-edge-38 rounded-lg px-3 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="">— Select —</option>
                    {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map(bg => (
                      <option key={bg} value={bg}>{bg}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Contact & Personal Details */}
          <div className="bg-surface-17 border border-edge-19 rounded-2xl p-5 shadow-lg space-y-4">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Phone className="w-4 h-4 text-purple-400" />
              <span>Contact & Emergency Details</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Phone */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Phone Number <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.phone || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="e.g. +92 300 1234567"
                  className={`w-full bg-surface-39 border rounded-lg px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors ${
                    errors.phone ? 'border-rose-500' : 'border-edge-38'
                  }`}
                  id="input-staff-phone"
                />
                {errors.phone && <p className="text-[10px] text-rose-400 mt-1">{errors.phone}</p>}
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="e.g. name@school.edu.pk"
                  className="w-full bg-surface-39 border border-edge-38 rounded-lg px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* WhatsApp */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  WhatsApp Number
                </label>
                <input
                  type="text"
                  value={formData.whatsapp || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, whatsapp: e.target.value }))}
                  placeholder="e.g. 3001234567"
                  className="w-full bg-surface-39 border border-edge-38 rounded-lg px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Emergency Contact */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Emergency Contact Phone
                </label>
                <input
                  type="text"
                  value={formData.emergencyContact || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, emergencyContact: e.target.value }))}
                  placeholder="e.g. +92 321 9988771"
                  className="w-full bg-surface-39 border border-edge-38 rounded-lg px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Residential Address */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Residential Address
                </label>
                <input
                  type="text"
                  value={formData.address || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="e.g. Street / area, City"
                  className="w-full bg-surface-39 border border-edge-38 rounded-lg px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Note */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Note / Remarks
                </label>
                <input
                  type="text"
                  value={formData.notes || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="e.g. -"
                  className="w-full bg-surface-39 border border-edge-38 rounded-lg px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
