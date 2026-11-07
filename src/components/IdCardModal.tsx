import React, { useState, useEffect } from 'react';
import { 
  X, 
  Download, 
  FileStack, 
  Sparkles, 
  GraduationCap, 
  ChevronLeft, 
  ChevronRight,
  ShieldCheck,
  QrCode,
  Check
} from 'lucide-react';
import { Student, CardTemplateType } from '../types';
import { generateSingleIdCard, generateAllIdCards, SchoolInfo } from '../utils/pdfGenerator';
import { getSchoolSettings, saveSchoolSettings, SchoolSettings } from '../utils/settingsHelper';
import { getAvatarColor, getInitials } from '../data/initialStudents';
import { getStudentAvatar } from '../utils/studentAvatarHelper';

interface IdCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  allStudents: Student[];
  onSelectStudent: (student: Student) => void;
}

export const IdCardModal: React.FC<IdCardModalProps> = ({
  isOpen,
  onClose,
  student,
  allStudents,
  onSelectStudent
}) => {
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings>(() => getSchoolSettings());
  const [template, setTemplate] = useState<CardTemplateType>(
    () => getSchoolSettings().studentIdCardTemplate || 'modern-tech'
  );
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const latest = getSchoolSettings();
      setSchoolSettings(latest);
      setTemplate(latest.studentIdCardTemplate || 'modern-tech');
    }
  }, [isOpen]);

  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<SchoolSettings>;
      const latest = custom.detail || getSchoolSettings();
      setSchoolSettings(latest);
      if (latest.studentIdCardTemplate) {
        setTemplate(latest.studentIdCardTemplate);
      }
    };
    window.addEventListener('schoolSettingsUpdated', handler);
    return () => window.removeEventListener('schoolSettingsUpdated', handler);
  }, []);

  const handleSelectTemplate = (nextTemplate: CardTemplateType) => {
    setTemplate(nextTemplate);
    const updated = { ...getSchoolSettings(), studentIdCardTemplate: nextTemplate };
    setSchoolSettings(updated);
    saveSchoolSettings(updated);
  };

  if (!isOpen || !student) return null;

  const activeSchool: SchoolInfo = {
    name: schoolSettings.schoolName || 'Demo School Schoollee Pakistan',
    campus: schoolSettings.campusName || 'Main Campus',
    session: schoolSettings.session || '2025 - 2026',
    phone: schoolSettings.schoolPhone || '+92 42 35890000',
    address: schoolSettings.schoolAddress || 'Lahore, Pakistan'
  };

  const currentIndex = allStudents.findIndex(s => s.id === student.id);
  const handlePrev = () => {
    if (currentIndex > 0) {
      onSelectStudent(allStudents[currentIndex - 1]);
    }
  };

  const handleNext = () => {
    if (currentIndex < allStudents.length - 1) {
      onSelectStudent(allStudents[currentIndex + 1]);
    }
  };

  const handleDownloadSingle = () => {
    generateSingleIdCard(student, template, activeSchool);
  };

  const handleDownloadAll = () => {
    setIsGeneratingAll(true);
    setTimeout(() => {
      generateAllIdCards(allStudents, template, activeSchool);
      setIsGeneratingAll(false);
    }, 150);
  };

  const avatarBg = student.avatarColor || getAvatarColor(student.name);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-[#131926] border border-[#243048] rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
        id="modal-id-card"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-edge-22 flex items-center justify-between bg-[#171f2e]">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-blue-400" />
              Student ID Card
            </h2>
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
          {/* Left Column: Template Selection & Controls */}
          <div className="lg:col-span-5 space-y-5">
            {/* Student Navigation Bar */}
            <div className="bg-surface-40 border border-edge-37 rounded-xl p-3 flex items-center justify-between">
              <button
                type="button"
                onClick={handlePrev}
                disabled={currentIndex <= 0}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                title="Previous student"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="text-center px-2">
                <span className="text-[11px] text-slate-400">{currentIndex + 1} of {allStudents.length}</span>
                <p className="text-sm font-semibold text-white capitalize truncate max-w-[180px]">{student.name}</p>
                <span className="text-xs font-mono text-sky-400">{student.id}</span>
              </div>

              <button
                type="button"
                onClick={handleNext}
                disabled={currentIndex >= allStudents.length - 1}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                title="Next student"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Template Chooser */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Card Template
              </label>
              <div className="grid grid-cols-1 gap-2">
                {/* Template 1: Modern Tech */}
                <button
                  type="button"
                  onClick={() => handleSelectTemplate('modern-tech')}
                  className={`text-left p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                    template === 'modern-tech'
                      ? 'bg-blue-950/40 border-blue-500 ring-1 ring-blue-500/50'
                      : 'bg-surface-40 border-edge-37 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-white">Modern Tech</h4>
                      <p className="text-[11px] text-slate-400">Digital layout with QR code and barcode</p>
                    </div>
                  </div>
                  {template === 'modern-tech' && (
                    <div className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}
                </button>

                {/* Template 2: Classic Academic */}
                <button
                  type="button"
                  onClick={() => handleSelectTemplate('classic-academic')}
                  className={`text-left p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                    template === 'classic-academic'
                      ? 'bg-amber-950/30 border-amber-500 ring-1 ring-amber-500/50'
                      : 'bg-surface-40 border-edge-37 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-white">Classic Academic</h4>
                      <p className="text-[11px] text-slate-400">Formal style with crest seal and gold accents</p>
                    </div>
                  </div>
                  {template === 'classic-academic' && (
                    <div className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}
                </button>
              </div>
            </div>

            {/* Quick Metadata */}
            <div className="bg-[#141b29] border border-[#20293d] rounded-xl p-3.5 text-xs space-y-2">
              <div className="flex justify-between text-slate-400">
                <span>Print Dimensions:</span>
                <span className="font-mono text-slate-200">54mm × 86mm (CR80)</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Resolution / Output:</span>
                <span className="text-slate-200">Vector High-DPI PDF</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Active School:</span>
                <span className="text-slate-200">{activeSchool.name}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={handleDownloadSingle}
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 transition-all cursor-pointer"
                id="btn-download-single-card"
              >
                <Download className="w-4 h-4" />
                Download This Student Card (PDF)
              </button>

              <button
                type="button"
                onClick={handleDownloadAll}
                disabled={isGeneratingAll}
                className="w-full py-2.5 px-4 rounded-xl bg-[#202b3d] hover:bg-[#28364d] text-slate-200 hover:text-white border border-[#2c3d5a] text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                id="btn-download-all-cards"
              >
                <FileStack className="w-4 h-4 text-purple-400" />
                {isGeneratingAll ? 'Compiling All Cards...' : `Download All ${allStudents.length} Students ID Cards (PDF)`}
              </button>
            </div>
          </div>

          {/* Right Column: Live Card Interactive Preview */}
          <div className="lg:col-span-7 flex flex-col items-center justify-center bg-[#0d121c] border border-[#202a3f] rounded-2xl p-6 relative">
            <span className="absolute top-3 left-4 text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Live Interactive Card Preview
            </span>

            {/* Vertical Card Preview Canvas (Standard CR80 54:86 ratio, ~270px x 430px) */}
            <div className="mt-4 mb-2 drop-shadow-2xl">
              {template === 'modern-tech' ? (
                /* Template 1: Modern Tech UI */
                <div className="w-[270px] h-[430px] rounded-2xl bg-slate-900 border border-cyan-500/40 text-white flex flex-col overflow-hidden shadow-2xl relative select-none">
                  {/* Top Header */}
                  <div className="bg-gradient-to-b from-slate-800 to-slate-900 pt-4 pb-2 px-3 text-center border-b border-cyan-500/50">
                    <p className="text-[10px] font-extrabold tracking-wider uppercase text-cyan-400">
                      {activeSchool.name}
                    </p>
                    <p className="text-[8px] text-slate-400 tracking-widest uppercase mt-0.5">
                      Student Identity Card • {activeSchool.session}
                    </p>
                  </div>

                  {/* Body Content */}
                  <div className="p-4 flex-1 flex flex-col items-center text-center">
                    <div className="w-16 h-16 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 p-0.5 shadow-md mb-2 shrink-0">
                      <img
                        src={getStudentAvatar(student)}
                        alt={student.name}
                        className="w-full h-full rounded-[10px] object-cover bg-slate-900"
                      />
                    </div>

                    {/* Student Name */}
                    <h3 className="text-sm font-bold text-white capitalize leading-tight">
                      {student.name}
                    </h3>
                    <span className="text-[10px] font-mono font-semibold text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/30 mt-1">
                      {student.id}
                    </span>

                    {/* Details Grid */}
                    <div className="w-full mt-3 space-y-1.5 text-left text-[10px] bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/60">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Class / Section:</span>
                        <span className="font-semibold text-white">{student.class} - {student.section}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Guardian / Father:</span>
                        <span className="font-semibold text-slate-200 capitalize truncate max-w-[120px]">{student.family}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Family ID:</span>
                        <span className="font-mono text-cyan-300">{student.familyId}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Blood Group:</span>
                        <span className="font-semibold text-rose-400">{student.bloodGroup || 'B+'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Emergency:</span>
                        <span className="font-mono text-slate-300">{student.phone || activeSchool.phone}</span>
                      </div>
                    </div>

                    {/* Barcode & QR Code simulation */}
                    <div className="mt-auto w-full pt-2">
                      <div className="bg-white rounded p-1.5 flex items-center justify-between">
                        <div className="flex items-center space-x-0.5 h-6">
                          {[1, 2, 1, 3, 1, 2, 3, 1, 2, 1, 3, 1, 2, 2, 1, 3, 1].map((w, i) => (
                            <div
                              key={i}
                              className="bg-black h-full"
                              style={{ width: `${w * 1.5}px` }}
                            />
                          ))}
                        </div>
                        <QrCode className="w-6 h-6 text-slate-900" />
                      </div>
                      <p className="text-[7px] text-slate-500 text-center mt-1">
                        OFFICIAL STUDENT PASS • AUTHORIZED DIGITAL
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                /* Template 2: Classic Academic Heritage UI */
                <div className="w-[270px] h-[430px] rounded-2xl bg-[#fbf9f4] border-2 border-[#b89547] text-slate-900 flex flex-col overflow-hidden shadow-2xl relative select-none p-2">
                  <div className="w-full h-full border border-[#d4be7d] rounded-xl flex flex-col p-3 text-center bg-[#fffdfa]">
                    {/* Traditional Crest Banner */}
                    <div className="bg-[#172744] text-[#f5d77f] rounded-lg py-2 px-2 -mx-1 -mt-1 shadow-sm">
                      <p className="text-[9.5px] font-serif font-bold uppercase tracking-wider">
                        {activeSchool.name}
                      </p>
                      <p className="text-[7.5px] text-slate-200 font-serif italic mt-0.5">
                        Scholar Identification Card • {activeSchool.session}
                      </p>
                    </div>

                    {/* Portrait Photo Badge */}
                    <div className="w-16 h-16 rounded-full border-2 border-[#b89547] bg-[#172744] mx-auto mt-3 flex items-center justify-center overflow-hidden shadow-inner shrink-0">
                      <img
                        src={getStudentAvatar(student)}
                        alt={student.name}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Student Name */}
                    <h3 className="text-sm font-serif font-bold text-[#172744] capitalize mt-1.5 leading-snug">
                      {student.name}
                    </h3>
                    <p className="text-[9px] font-bold text-[#b89547] tracking-wider uppercase">
                      ROLL NO: {student.id}
                    </p>

                    <div className="w-full border-t border-[#d8cbaf] my-2" />

                    {/* Academic Details */}
                    <div className="space-y-1 text-left text-[9.5px] font-serif px-1">
                      <div className="flex justify-between">
                        <span className="font-bold text-slate-700">Class / Section:</span>
                        <span className="text-slate-900 font-sans font-medium">{student.class} - {student.section}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-bold text-slate-700">Father Name:</span>
                        <span className="text-slate-900 capitalize truncate max-w-[120px]">{student.family}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-bold text-slate-700">Family Code:</span>
                        <span className="font-mono text-slate-800">{student.familyId}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-bold text-slate-700">Blood Group:</span>
                        <span className="font-bold text-rose-700">{student.bloodGroup || 'B+'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-bold text-slate-700">Emergency Contact:</span>
                        <span className="font-mono text-slate-800">{student.phone || activeSchool.phone}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-bold text-slate-700">Status:</span>
                        <span className="text-emerald-700 font-semibold">{student.status}</span>
                      </div>
                    </div>

                    {/* Footer Signature & Seal */}
                    <div className="mt-auto pt-2 flex items-end justify-between px-1">
                      <div className="w-8 h-8 rounded-full border border-[#b89547] flex items-center justify-center text-[6px] font-bold text-[#b89547] uppercase text-center leading-tight rotate-12">
                        Official Seal
                      </div>
                      <div className="text-center">
                        <div className="w-20 border-b border-slate-500 mb-0.5" />
                        <span className="text-[7.5px] font-serif italic text-slate-600">
                          Principal Signature
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <p className="text-xs text-slate-500 text-center">
              Standard CR80 Vertical Ratio • Automatically generated using vector graphics in jsPDF
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
