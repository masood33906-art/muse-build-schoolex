import React, { useState, useEffect } from 'react';
import { 
  X, 
  Download, 
  FileStack, 
  Briefcase, 
  ChevronLeft, 
  ChevronRight,
  ShieldCheck,
  Check,
  Printer
} from 'lucide-react';
import { StaffMember, CardTemplateType } from '../types';
import { generateSingleStaffIdCard, generateAllStaffIdCards } from '../utils/staffPdfGenerator';
import { SchoolInfo } from '../utils/pdfGenerator';
import { getSchoolSettings, saveSchoolSettings, SchoolSettings } from '../utils/settingsHelper';
import { getAvatarColor, getInitials } from '../data/initialStudents';

interface StaffIdCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  staff: StaffMember | null;
  allStaff: StaffMember[];
  onSelectStaff: (staff: StaffMember) => void;
}

export const StaffIdCardModal: React.FC<StaffIdCardModalProps> = ({
  isOpen,
  onClose,
  staff,
  allStaff,
  onSelectStaff
}) => {
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings>(() => getSchoolSettings());
  const [template, setTemplate] = useState<CardTemplateType>(
    () => getSchoolSettings().staffIdCardTemplate || 'modern-tech'
  );
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const latest = getSchoolSettings();
      setSchoolSettings(latest);
      setTemplate(latest.staffIdCardTemplate || 'modern-tech');
    }
  }, [isOpen]);

  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<SchoolSettings>;
      const latest = custom.detail || getSchoolSettings();
      setSchoolSettings(latest);
      if (latest.staffIdCardTemplate) {
        setTemplate(latest.staffIdCardTemplate);
      }
    };
    window.addEventListener('schoolSettingsUpdated', handler);
    return () => window.removeEventListener('schoolSettingsUpdated', handler);
  }, []);

  const handleSelectTemplate = (nextTemplate: CardTemplateType) => {
    setTemplate(nextTemplate);
    const updated = { ...getSchoolSettings(), staffIdCardTemplate: nextTemplate };
    setSchoolSettings(updated);
    saveSchoolSettings(updated);
  };

  if (!isOpen || !staff) return null;

  const activeSchool: SchoolInfo = {
    name: schoolSettings.schoolName || 'Demo School Schoollee Pakistan',
    campus: schoolSettings.campusName || 'Main Campus',
    session: schoolSettings.session || '2025 - 2026',
    phone: schoolSettings.schoolPhone || '+92 42 35890000',
    address: schoolSettings.schoolAddress || 'Lahore, Pakistan'
  };

  const currentIndex = allStaff.findIndex(s => s.id === staff.id);
  const handlePrev = () => {
    if (currentIndex > 0) {
      onSelectStaff(allStaff[currentIndex - 1]);
    }
  };

  const handleNext = () => {
    if (currentIndex < allStaff.length - 1) {
      onSelectStaff(allStaff[currentIndex + 1]);
    }
  };

  const handleDownloadSingle = () => {
    generateSingleStaffIdCard(staff, template, activeSchool);
  };

  const handleDownloadAll = () => {
    setIsGeneratingAll(true);
    setTimeout(() => {
      generateAllStaffIdCards(allStaff, template, activeSchool);
      setIsGeneratingAll(false);
    }, 150);
  };

  const avatarBg = staff.avatarColor || getAvatarColor(staff.name);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-[#131926] border border-[#243048] rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
        id="modal-staff-id-card"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#232d42] flex items-center justify-between bg-[#171f2e]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Briefcase className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Staff Identity Card Generator
              </h2>
              <p className="text-xs text-slate-400">
                Print or download vertical CR80 staff cards for an employee or all staff
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Controls & Selection */}
          <div className="lg:col-span-6 flex flex-col gap-5">
            {/* Employee Selector Dropdown */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Select Employee:
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrev}
                  disabled={currentIndex <= 0}
                  className="p-2 rounded-lg bg-[#1a2334] border border-[#24334d] hover:bg-[#202d44] disabled:opacity-40 disabled:pointer-events-none text-slate-300 cursor-pointer"
                  title="Previous Employee"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                
                <select
                  value={staff.id}
                  onChange={(e) => {
                    const found = allStaff.find(s => s.id === e.target.value);
                    if (found) onSelectStaff(found);
                  }}
                  className="flex-1 bg-[#1a2334] border border-[#24334d] rounded-lg px-3 py-2 text-xs font-medium text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  {allStaff.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} — {s.role} ({s.id})
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={handleNext}
                  disabled={currentIndex >= allStaff.length - 1}
                  className="p-2 rounded-lg bg-[#1a2334] border border-[#24334d] hover:bg-[#202d44] disabled:opacity-40 disabled:pointer-events-none text-slate-300 cursor-pointer"
                  title="Next Employee"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Viewing {currentIndex + 1} of {allStaff.length} staff members
              </p>
            </div>

            {/* Template Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Card Design Theme:
              </label>
              <div className="grid grid-cols-2 gap-3">
                {/* Modern Tech (Dark) */}
                <button
                  type="button"
                  onClick={() => handleSelectTemplate('modern-tech')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    template === 'modern-tech'
                      ? 'border-emerald-500 bg-emerald-500/10 text-white'
                      : 'border-[#222f46] bg-[#172030] text-slate-300 hover:border-[#2f4060]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold">Modern Emerald</span>
                    {template === 'modern-tech' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                  </div>
                  <p className="text-[11px] text-slate-400">Dark high-contrast layout with QR barcode</p>
                </button>

                {/* Classic Academic (Light) */}
                <button
                  type="button"
                  onClick={() => handleSelectTemplate('classic-academic')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    template === 'classic-academic'
                      ? 'border-emerald-500 bg-emerald-500/10 text-white'
                      : 'border-[#222f46] bg-[#172030] text-slate-300 hover:border-[#2f4060]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold">Classic Academic</span>
                    {template === 'classic-academic' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                  </div>
                  <p className="text-[11px] text-slate-400">Formal framed border with institution signature</p>
                </button>
              </div>
            </div>

            {/* Employee Card Summary Info */}
            <div className="bg-[#172030] border border-[#233048] rounded-xl p-4 text-xs space-y-2">
              <div className="flex justify-between text-slate-400">
                <span>Employee Name:</span>
                <span className="font-semibold text-white">{staff.name}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Employee ID:</span>
                <span className="font-mono text-emerald-400">{staff.id}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Role / Designation:</span>
                <span className="text-slate-200">{staff.role}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Department & Category:</span>
                <span className="text-slate-200">{staff.department} ({staff.category})</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Qualification:</span>
                <span className="text-slate-200">{staff.qualification || 'Certified'}</span>
              </div>
            </div>

            {/* Download Buttons */}
            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                onClick={handleDownloadSingle}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md shadow-emerald-600/20"
                id="btn-download-single-staff-card"
              >
                <Download className="w-4 h-4" />
                <span>Download {staff.name.split(' ')[0]}'s ID Card (PDF)</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadAll}
                disabled={isGeneratingAll}
                className="w-full py-2.5 px-4 rounded-xl bg-[#1d273a] hover:bg-[#25324a] border border-[#2b3b57] text-slate-200 font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
                id="btn-download-all-staff-cards"
              >
                <FileStack className="w-4 h-4 text-emerald-400" />
                <span>
                  {isGeneratingAll ? 'Generating Combined PDF...' : `Generate All Staff ID Cards (${allStaff.length} Cards Combined)`}
                </span>
              </button>
            </div>
          </div>

          {/* Right Column: Live Card Preview */}
          <div className="lg:col-span-6 flex flex-col items-center justify-center bg-[#0c1018] border border-[#1d2638] rounded-2xl p-6">
            <div className="text-[11px] font-semibold text-slate-400 mb-3 uppercase tracking-wider">
              Live Card Preview (CR80 Standard Size)
            </div>

            {/* Physical Card Mockup */}
            {template === 'modern-tech' ? (
              <div className="w-[240px] h-[380px] bg-slate-900 border-2 border-emerald-500/50 rounded-2xl overflow-hidden shadow-2xl flex flex-col relative text-white select-none">
                {/* Header Banner */}
                <div className="bg-slate-800 px-3 pt-3 pb-2 text-center border-b-2 border-emerald-500">
                  <p className="text-[9px] font-extrabold uppercase tracking-wider text-white">
                    {activeSchool.name}
                  </p>
                  <p className="text-[7px] text-slate-400 uppercase tracking-tight">
                    STAFF IDENTITY CARD • {activeSchool.session}
                  </p>
                </div>

                {/* Photo & Name */}
                <div className="pt-3 pb-2 px-3 flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-xl border-2 border-emerald-500 overflow-hidden shadow-md mb-2 bg-slate-800 flex items-center justify-center">
                    {staff.photo ? (
                      <img src={staff.photo} alt={staff.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className={`w-full h-full ${avatarBg} flex items-center justify-center text-white text-base font-bold`}>
                        {getInitials(staff.name)}
                      </div>
                    )}
                  </div>
                  <h4 className="font-bold text-xs text-white leading-tight">
                    {staff.name}
                  </h4>
                  <p className="text-[9px] text-emerald-400 font-semibold mt-0.5 leading-tight">
                    {staff.role}
                  </p>
                  <span className="mt-1 px-2 py-0.5 rounded text-[8px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                    {staff.category} • {staff.department}
                  </span>
                </div>

                {/* Info Fields */}
                <div className="px-3.5 py-1.5 space-y-1 text-[8.5px] border-t border-slate-800 flex-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-semibold">EMP ID:</span>
                    <span className="font-mono text-slate-100">{staff.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-semibold">Degree:</span>
                    <span className="text-slate-100 truncate max-w-[120px]">{staff.qualification || 'Certified'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-semibold">Joined:</span>
                    <span className="text-slate-100">{staff.joiningDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-semibold">Phone:</span>
                    <span className="text-slate-100">{staff.phone}</span>
                  </div>
                </div>

                {/* Barcode Footer */}
                <div className="bg-slate-950 p-2 text-center border-t border-slate-800">
                  <div className="h-5 bg-white rounded flex items-center justify-center px-2 py-0.5 gap-0.5 mb-1">
                    <div className="w-1 h-3.5 bg-black" />
                    <div className="w-0.5 h-3.5 bg-black" />
                    <div className="w-1.5 h-3.5 bg-black" />
                    <div className="w-0.5 h-3.5 bg-black" />
                    <div className="w-1 h-3.5 bg-black" />
                    <div className="w-2 h-3.5 bg-black" />
                    <div className="w-0.5 h-3.5 bg-black" />
                  </div>
                  <p className="text-[7px] text-slate-400 font-mono">{staff.id}</p>
                </div>
              </div>
            ) : (
              /* Classic Academic Preview */
              <div className="w-[240px] h-[380px] bg-slate-50 border-2 border-emerald-600 rounded-lg overflow-hidden shadow-2xl flex flex-col relative text-slate-900 select-none">
                <div className="bg-slate-900 text-white px-3 py-2 text-center">
                  <p className="text-[9px] font-serif font-bold uppercase tracking-wider text-white">
                    {activeSchool.name}
                  </p>
                  <p className="text-[7.5px] text-emerald-400 font-semibold">STAFF IDENTIFICATION CARD</p>
                </div>

                <div className="p-3 flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded border border-slate-900 overflow-hidden shadow-sm mb-1.5 bg-slate-100 flex items-center justify-center">
                    {staff.photo ? (
                      <img src={staff.photo} alt={staff.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-emerald-600 flex items-center justify-center text-white text-base font-bold">
                        {getInitials(staff.name)}
                      </div>
                    )}
                  </div>
                  <h4 className="font-serif font-bold text-xs text-slate-900">
                    {staff.name}
                  </h4>
                  <p className="text-[9px] text-emerald-700 font-bold">
                    {staff.role}
                  </p>
                </div>

                <div className="mx-3 p-2 bg-slate-100 rounded border border-slate-200 text-[8px] space-y-1 flex-1">
                  <div className="flex justify-between">
                    <span className="font-bold text-slate-600">Employee ID:</span>
                    <span className="font-mono text-slate-900">{staff.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-bold text-slate-600">Department:</span>
                    <span className="text-slate-900">{staff.department}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-bold text-slate-600">Qualification:</span>
                    <span className="text-slate-900 truncate max-w-[110px]">{staff.qualification || 'Certified'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-bold text-slate-600">Phone:</span>
                    <span className="text-slate-900">{staff.phone}</span>
                  </div>
                </div>

                <div className="p-2 border-t border-slate-200 flex justify-between items-center text-[7px] text-slate-500">
                  <div className="text-center">
                    <div className="w-12 h-0.5 bg-slate-400 mb-0.5 mx-auto" />
                    <span>Principal</span>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-0.5 bg-slate-400 mb-0.5 mx-auto" />
                    <span>Employee</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
