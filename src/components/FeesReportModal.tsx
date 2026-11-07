import React, { useMemo } from 'react';
import { X, Printer } from 'lucide-react';
import { FamilyFeeSummary, formatPKR } from '../utils/feeHelper';
import { getSchoolSettings, getBankSettings } from '../utils/settingsHelper';
import { FeeReportRowItem } from '../utils/feeExportHelper';

interface FeesReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  section: 'family' | 'student';
  items?: FeeReportRowItem[];
  families?: FamilyFeeSummary[];
}

export const FeesReportModal: React.FC<FeesReportModalProps> = ({
  isOpen,
  onClose,
  section = 'family',
  items: propItems,
  families
}) => {
  if (!isOpen) return null;

  const schoolSettings = getSchoolSettings();
  const bankSettings = getBankSettings();
  const schoolName = schoolSettings.schoolName || bankSettings.schoolName || 'Demo School Schooliee Pakistan';
  const schoolPhone = schoolSettings.schoolPhone || bankSettings.schoolPhone || '';
  // Fix P0-4: the report is dated the day it is generated — never a fixed date.
  const currentDateFormatted = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const isFamily = section === 'family';

  // Normalize items to standard FeeReportRowItem structure
  const items: FeeReportRowItem[] = useMemo(() => {
    if (propItems && propItems.length > 0) {
      return propItems;
    }
    if (families && families.length > 0) {
      return families.map(f => ({
        id: f.familyId,
        name: f.familyName,
        phone: f.phone || '',
        classesOrClass: f.students?.map(s => s.class).filter(Boolean).join(', ') || '—',
        due: f.totalDue,
        paid: f.totalPaid,
        status: f.status
      }));
    }
    return [];
  }, [propItems, families]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      id="modal-fees-report"
    >
      {/* Print Specific Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-fees-pdf-sheet, #printable-fees-pdf-sheet * {
            visibility: visible !important;
          }
          #printable-fees-pdf-sheet {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 16px !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="w-full max-w-5xl bg-surface-9 border border-[#20314b] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-slate-100 animate-in zoom-in-95 duration-200">
        {/* Modal Top Header */}
        <div className="px-6 py-3.5 bg-surface-29 border-b border-edge-23 flex items-center justify-between no-print">
          <h2 className="text-sm font-bold text-white tracking-tight">
            Fees Report
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-edge-17 transition-colors cursor-pointer"
            id="btn-close-fees-report-x"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Document Container */}
        <div className="p-4 sm:p-6 md:p-8 overflow-y-auto flex-1 bg-slate-900/50 print:bg-white print:p-0">
          {/* Printable White Sheet */}
          <div 
            id="printable-fees-pdf-sheet"
            className="max-w-4xl mx-auto bg-white text-slate-800 rounded-xl shadow-lg border border-slate-200 p-6 sm:p-8 print:border-none print:shadow-none print:p-2"
          >
            {/* Header Block: Logo + School Name + Phone on Left; FEES REPORT + Date on Right */}
            <div className="flex items-start justify-between pb-4 mb-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-sm shrink-0">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-sm sm:text-base font-black text-slate-900 tracking-tight leading-tight">
                    {schoolName}
                  </h1>
                  {schoolPhone && (
                    <p className="text-xs text-slate-500 font-medium">
                      Phone: {schoolPhone}
                    </p>
                  )}
                </div>
              </div>

              <div className="text-right">
                <h2 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wider">
                  FEES REPORT
                </h2>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                  Generated: {currentDateFormatted}
                </p>
              </div>
            </div>

            {/* Table Columns */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-y border-slate-200 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-2 px-3">{isFamily ? 'FAMILY NAME' : 'STUDENT NAME'}</th>
                    <th className="py-2 px-3">{isFamily ? 'FAMILY ID' : 'STUDENT ID'}</th>
                    <th className="py-2 px-3">PHONE</th>
                    <th className="py-2 px-3">{isFamily ? 'CLASSES' : 'CLASS'}</th>
                    <th className="py-2 px-3 text-right">DUE</th>
                    <th className="py-2 px-3 text-right">PAID</th>
                    <th className="py-2 px-3">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 text-[11px]">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No records found.
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2 px-3 font-medium text-slate-900">
                          {item.name}
                        </td>
                        <td className="py-2 px-3 font-mono text-[11px] text-slate-600">
                          {item.id}
                        </td>
                        <td className="py-2 px-3 text-slate-600 font-mono text-[11px]">
                          {item.phone || '—'}
                        </td>
                        <td className="py-2 px-3 text-slate-600">
                          {item.classesOrClass || '—'}
                        </td>
                        <td className="py-2 px-3 text-right font-medium text-slate-900 font-mono">
                          {formatPKR(item.due)}
                        </td>
                        <td className="py-2 px-3 text-right font-medium text-slate-900 font-mono">
                          {formatPKR(item.paid)}
                        </td>
                        <td className="py-2 px-3 text-slate-700">
                          {item.status}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal Bottom Footer: Simple bar with Close and Print / Save PDF on the right */}
        <div className="px-6 py-3.5 bg-surface-29 border-t border-edge-23 flex items-center justify-end gap-3 no-print">
          {/* Close Option */}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-edge-13 hover:bg-[#28374d] text-slate-200 border border-slate-700 text-xs font-semibold transition-colors cursor-pointer"
            id="btn-close-fees-report"
          >
            Close
          </button>

          {/* Print / Save PDF Option */}
          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2 rounded-lg bg-white hover:bg-slate-100 text-slate-900 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
            id="btn-print-save-pdf-fees-report"
          >
            <Printer className="w-3.5 h-3.5 text-slate-800" />
            <span>Print / Save PDF</span>
          </button>
        </div>
      </div>
    </div>
  );
};
