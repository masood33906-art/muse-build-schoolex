import React, { useState } from 'react';
import { 
  X, 
  FileSpreadsheet, 
  Download, 
  Database, 
  CheckCircle,
  FileCheck2,
  Calendar,
  Briefcase,
  DollarSign
} from 'lucide-react';
import { StaffMember } from '../types';
import { exportStaffToCSV, exportPayrollSummaryToCSV } from '../utils/staffCsvHelper';

interface StaffBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffList: StaffMember[];
}

export const StaffBackupModal: React.FC<StaffBackupModalProps> = ({
  isOpen,
  onClose,
  staffList
}) => {
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const total = staffList.length;
  const teachers = staffList.filter(s => s.category === 'Teacher').length;
  const nonTeachers = total - teachers;
  const totalPayroll = staffList.reduce((sum, s) => sum + (s.salary || 0), 0);
  const todayStr = new Date().toISOString().slice(0, 10);

  const handleDownloadCsv = () => {
    exportStaffToCSV(staffList, `staff_records_${todayStr}.csv`);
    setDownloadSuccess('Staff CSV export downloaded successfully!');
    setTimeout(() => setDownloadSuccess(null), 3500);
  };

  const handleDownloadPayrollCsv = () => {
    exportPayrollSummaryToCSV(staffList, 'September 2026');
    setDownloadSuccess('Payroll Summary CSV downloaded successfully!');
    setTimeout(() => setDownloadSuccess(null), 3500);
  };

  const handleDownloadJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(staffList, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `staff_records_backup_${todayStr}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    setDownloadSuccess('JSON Data Backup exported successfully!');
    setTimeout(() => setDownloadSuccess(null), 3500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-surface-16 border border-[#232f45] rounded-2xl w-full max-w-lg overflow-hidden flex flex-col shadow-2xl"
        id="modal-staff-backup"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-edge-18 flex items-center justify-between bg-surface-32">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Export & Staff Data Backup
              </h2>
              <p className="text-xs text-slate-400">
                Download spreadsheet records, payroll sheets, or raw JSON backup
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
        <div className="p-6 space-y-5">
          {/* Quick Snapshot */}
          <div className="bg-surface-32 border border-[#24334d] rounded-xl p-4 grid grid-cols-3 gap-2 text-center text-xs">
            <div>
              <span className="text-slate-400 block text-[11px]">Total Staff</span>
              <span className="text-base font-bold text-white mt-0.5 block">{total}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Teaching Staff</span>
              <span className="text-base font-bold text-emerald-400 mt-0.5 block">{teachers}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Monthly Payroll</span>
              <span className="text-xs font-bold text-amber-300 font-mono mt-0.5 block">
                Rs. {totalPayroll.toLocaleString()}
              </span>
            </div>
          </div>

          {downloadSuccess && (
            <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-2 animate-in fade-in">
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{downloadSuccess}</span>
            </div>
          )}

          {/* Export Options */}
          <div className="space-y-3">
            {/* CSV Staff Roster */}
            <div className="bg-surface-19 hover:bg-surface-41 border border-[#223047] hover:border-emerald-500/40 rounded-xl p-3.5 flex items-center justify-between transition-all group">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Staff Roster (CSV)</h4>
                  <p className="text-[11px] text-slate-400">All employee details, qualifications, salaries, and contacts</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDownloadCsv}
                className="px-3 py-1.5 rounded-lg bg-[#1e2a40] hover:bg-emerald-600 text-slate-200 hover:text-white border border-[#2d3f5e] hover:border-emerald-500 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
                id="btn-export-staff-csv"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download</span>
              </button>
            </div>

            {/* Payroll Summary CSV */}
            <div className="bg-surface-19 hover:bg-surface-41 border border-[#223047] hover:border-amber-500/40 rounded-xl p-3.5 flex items-center justify-between transition-all group">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Monthly Payroll Summary (CSV)</h4>
                  <p className="text-[11px] text-slate-400">Detailed breakdown of base salaries, allowances, and payment status</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDownloadPayrollCsv}
                className="px-3 py-1.5 rounded-lg bg-[#1e2a40] hover:bg-amber-600 hover:text-slate-950 text-slate-200 border border-[#2d3f5e] hover:border-amber-500 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
                id="btn-export-payroll-csv"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download</span>
              </button>
            </div>

            {/* JSON Raw Data Backup */}
            <div className="bg-surface-19 hover:bg-surface-41 border border-[#223047] hover:border-blue-500/40 rounded-xl p-3.5 flex items-center justify-between transition-all group">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">JSON Raw Database Backup</h4>
                  <p className="text-[11px] text-slate-400">Complete portable structured JSON backup for system restore</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDownloadJson}
                className="px-3 py-1.5 rounded-lg bg-[#1e2a40] hover:bg-blue-600 text-slate-200 hover:text-white border border-[#2d3f5e] hover:border-blue-500 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
                id="btn-export-staff-json"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export JSON</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-edge-18 bg-surface-32 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-edge-17 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
