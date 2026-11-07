import React from 'react';
import { X, Printer, Download, School, Calendar, UserCheck } from 'lucide-react';
import { Exam } from '../utils/examStore';
import { SchoolSettings, getSchoolSettings } from '../utils/settingsHelper';

interface ExamListExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  exams: Exam[];
  schoolSettings?: SchoolSettings;
}

export const ExamListExportModal: React.FC<ExamListExportModalProps> = ({
  isOpen,
  onClose,
  exams,
  schoolSettings
}) => {
  if (!isOpen) return null;

  const school = schoolSettings || getSchoolSettings();
  const currentDate = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-4xl bg-surface-8 border border-[#223350] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Top Control Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-47 bg-[#131e33] print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <School className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Exam Directory PDF Preview</h2>
              <p className="text-xs text-slate-400">Preview formatted document with school metadata</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-lg shadow-blue-600/25 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Print / Save PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-[#1c2940] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PDF Page Container (A4 Printable Canvas) */}
        <div className="p-6 md:p-8 overflow-y-auto flex-1 bg-slate-100 text-slate-900 custom-scrollbar print:p-0 print:bg-white print:overflow-visible">
          <div className="max-w-3xl mx-auto bg-white p-8 md:p-10 rounded-xl shadow-md border border-slate-200 print:border-0 print:shadow-none print:p-4">
            
            {/* School Meta Header */}
            <div className="flex items-start justify-between border-b-2 border-slate-800 pb-5 mb-6">
              <div className="flex items-start gap-4">
                {school.schoolLogo ? (
                  <img
                    src={school.schoolLogo}
                    alt={school.schoolName}
                    className="w-16 h-16 object-contain rounded-lg border border-slate-200 p-1"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-blue-900 text-white flex items-center justify-center font-bold text-2xl">
                    {school.schoolName.charAt(0)}
                  </div>
                )}
                <div>
                  <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 uppercase">
                    {school.schoolName}
                  </h1>
                  <p className="text-xs text-slate-600 font-medium">
                    {school.campusName && `${school.campusName} • `}{school.schoolTagline || 'Excellence in Education'}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {school.schoolAddress}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Ph: {school.schoolPhone} | Email: {school.schoolEmail} {school.registrationNumber && `| Reg: ${school.registrationNumber}`}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="inline-block px-3 py-1 bg-blue-50 border border-blue-200 text-blue-900 text-[11px] font-bold uppercase rounded-md tracking-wider">
                  Official Report
                </span>
                <p className="text-xs font-semibold text-slate-700 mt-2">
                  Session: {school.session || '2025-2026'}
                </p>
                <p className="text-[11px] text-slate-500">
                  Date: {currentDate}
                </p>
              </div>
            </div>

            {/* Document Title */}
            <div className="text-center my-4">
              <h2 className="text-lg font-bold uppercase tracking-wider text-slate-900">
                Examination Directory &amp; Schedule
              </h2>
              <div className="h-0.5 w-16 bg-blue-600 mx-auto mt-1 mb-2"></div>
              <p className="text-xs text-slate-500">
                List of registered examinations, target classes, and scheduling overview
              </p>
            </div>

            {/* Table with attributes: EXAM NAME, CLASS, SECTION, CREATED BY */}
            <div className="overflow-x-auto my-6 border border-slate-300 rounded-lg">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300 uppercase tracking-wider text-[11px]">
                    <th className="p-3 border-r border-slate-300">#</th>
                    <th className="p-3 border-r border-slate-300">Exam Name</th>
                    <th className="p-3 border-r border-slate-300">Class</th>
                    <th className="p-3 border-r border-slate-300">Section</th>
                    <th className="p-3 border-r border-slate-300">Subjects</th>
                    <th className="p-3 border-r border-slate-300">Created By</th>
                    <th className="p-3">Created At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700">
                  {exams.map((exam, index) => (
                    <tr key={exam.id} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                      <td className="p-3 font-semibold text-slate-500 border-r border-slate-200">
                        {index + 1}
                      </td>
                      <td className="p-3 font-bold text-slate-900 border-r border-slate-200">
                        {exam.name}
                      </td>
                      <td className="p-3 font-medium border-r border-slate-200">
                        {exam.class}
                      </td>
                      <td className="p-3 font-medium border-r border-slate-200 text-center">
                        {exam.section}
                      </td>
                      <td className="p-3 border-r border-slate-200">
                        <div className="flex flex-wrap gap-1">
                          {exam.subjects.map(s => (
                            <span key={s.id} className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded text-[10px] font-semibold text-slate-700">
                              {s.name}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3 font-medium text-slate-800 border-r border-slate-200">
                        {exam.createdBy}
                      </td>
                      <td className="p-3 text-slate-600 whitespace-nowrap">
                        {exam.createdAt}
                      </td>
                    </tr>
                  ))}
                  {exams.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-slate-400">
                        No examinations found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Summary Statistics */}
            <div className="grid grid-cols-3 gap-3 p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs my-6">
              <div>
                <span className="text-slate-500 block">Total Exams</span>
                <span className="text-sm font-bold text-slate-800">{exams.length}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Total Subjects Scheduled</span>
                <span className="text-sm font-bold text-slate-800">
                  {exams.reduce((sum, e) => sum + e.subjects.length, 0)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Classes Covered</span>
                <span className="text-sm font-bold text-slate-800">
                  {new Set(exams.map(e => e.class)).size}
                </span>
              </div>
            </div>

            {/* Footer Signatures */}
            <div className="pt-12 mt-8 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
              <div className="text-center w-44 border-t border-slate-400 pt-1">
                <p className="font-semibold text-slate-800">Exam Coordinator</p>
                <p className="text-[10px] text-slate-500">Signature</p>
              </div>
              <div className="text-center w-44 border-t border-slate-400 pt-1">
                <p className="font-semibold text-slate-800">{school.principalName || 'Principal'}</p>
                <p className="text-[10px] text-slate-500">Authorized Signature &amp; Stamp</p>
              </div>
            </div>

            <div className="text-center mt-6 text-[10px] text-slate-400">
              Generated by {school.schoolName} Academic ERP • {new Date().toLocaleTimeString()}
            </div>
          </div>
        </div>

        {/* Bottom Control Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-surface-47 bg-[#121c30] print:hidden">
          <p className="text-xs text-slate-400">
            Use standard browser print to save directly as PDF or send to printer.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl border border-edge-38 text-slate-300 hover:text-white hover:bg-edge-12 text-xs font-semibold transition-colors"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Print / Save PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
