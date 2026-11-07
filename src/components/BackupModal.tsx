import React, { useState } from 'react';
import { 
  X, 
  Download, 
  FileText, 
  FileSpreadsheet, 
  Database,
  CheckCircle,
  Eye,
  Users
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { Student, FamilyData } from '../types';
import { DEFAULT_SCHOOL, createStudentRegistryPdfDoc, createFamilyRegistryPdfDoc } from '../utils/pdfGenerator';
import { exportStudentsToCSV, exportFamiliesToCSV } from '../utils/csvHelper';
import { groupStudentsIntoFamilies } from '../utils/familyHelper';
import { downloadBackup } from '../utils/backup';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  currentSection?: 'students' | 'families';
  onOpenPdfPreview: (doc: jsPDF, title: string, fileName: string, count: number, sectionName: string) => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({
  isOpen,
  onClose,
  students,
  currentSection = 'students',
  onOpenPdfPreview
}) => {
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const total = students.length;
  const active = students.filter(s => s.status === 'Active').length;
  const inactive = total - active;
  const families: FamilyData[] = groupStudentsIntoFamilies(students);
  const totalFamilies = families.length;
  const todayStr = new Date().toISOString().slice(0, 10);

  const isStudentsTab = currentSection === 'students';
  const sectionLabel = isStudentsTab ? 'Students' : 'Families';

  const handlePreviewPdf = () => {
    if (isStudentsTab) {
      const doc = createStudentRegistryPdfDoc(students, DEFAULT_SCHOOL);
      onClose();
      onOpenPdfPreview(
        doc, 
        'Student Registry Document', 
        `Student_Registry_Report_${todayStr}.pdf`, 
        students.length, 
        'Students'
      );
    } else {
      const doc = createFamilyRegistryPdfDoc(families, DEFAULT_SCHOOL);
      onClose();
      onOpenPdfPreview(
        doc, 
        'Family Directory Document', 
        `Family_Directory_Report_${todayStr}.pdf`, 
        families.length, 
        'Families'
      );
    }
  };

  const handleDownloadCsv = () => {
    setIsExportingCsv(true);
    setDownloadSuccess(null);
    setTimeout(() => {
      if (isStudentsTab) {
        exportStudentsToCSV(students, `students_backup_${todayStr}.csv`);
        setDownloadSuccess('Students CSV downloaded successfully!');
      } else {
        exportFamiliesToCSV(families, `families_backup_${todayStr}.csv`);
        setDownloadSuccess('Families CSV downloaded successfully!');
      }
      setIsExportingCsv(false);
      setTimeout(() => setDownloadSuccess(null), 4000);
    }, 150);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-[#131926] border border-[#243048] rounded-2xl w-full max-w-2xl overflow-hidden flex flex-col shadow-2xl"
        id="modal-backup-data"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-edge-22 flex items-center justify-between bg-[#171f2e]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Export Data</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {sectionLabel} Section
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Select an export format for current {sectionLabel.toLowerCase()} records
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            id="btn-close-export-modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Data Summary Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-surface-40 border border-edge-37 rounded-xl p-3.5">
            <div>
              <span className="text-[11px] text-slate-400">Total Students</span>
              <p className="text-xl font-bold text-white mt-0.5">{total}</p>
            </div>
            <div>
              <span className="text-[11px] text-emerald-400/80">Active</span>
              <p className="text-xl font-bold text-emerald-400 mt-0.5">{active}</p>
            </div>
            <div>
              <span className="text-[11px] text-rose-400/80">Inactive</span>
              <p className="text-xl font-bold text-rose-400 mt-0.5">{inactive}</p>
            </div>
            <div>
              <span className="text-[11px] text-purple-400/80">Families Count</span>
              <p className="text-xl font-bold text-purple-300 mt-0.5">{totalFamilies}</p>
            </div>
          </div>

          {/* Success Banner */}
          {downloadSuccess && (
            <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 animate-in fade-in">
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{downloadSuccess}</span>
            </div>
          )}

          {/* Top Primary Full Backup Button */}
          <div className="bg-blue-600/10 border border-blue-500/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-bold text-white">Full System Backup (.json)</h4>
              <p className="text-xs text-slate-300 mt-0.5">
                Includes all students, staff, fees, ledger, attendance, exams, challans, documents, and settings.
              </p>
            </div>
            <button
              type="button"
              onClick={async () => {
                await downloadBackup();
                setDownloadSuccess('Full SchoolEx backup downloaded successfully!');
                setTimeout(() => setDownloadSuccess(null), 4000);
              }}
              className="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-2 shrink-0 cursor-pointer transition-colors shadow-md"
              id="btn-backup-full-json"
            >
              <Download className="w-4 h-4" />
              <span>Download full backup</span>
            </button>
          </div>

          {/* 2 Export Options: CSV & PDF */}
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Option 1: CSV Spreadsheet */}
              <div className="bg-surface-40 hover:bg-surface-45 border border-edge-37 hover:border-emerald-500/40 rounded-xl p-4 flex flex-col justify-between transition-all group">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-2.5">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-semibold text-white">CSV Spreadsheet</h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Directly download spreadsheet file with all {sectionLabel.toLowerCase()} fields.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadCsv}
                  disabled={isExportingCsv}
                  className="mt-4 w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  id="btn-backup-csv"
                >
                  <Download className="w-4 h-4" />
                  {isExportingCsv ? 'Downloading...' : `Download ${sectionLabel} CSV`}
                </button>
              </div>

              {/* Option 2: PDF Document (Preview & Print / Save) */}
              <div className="bg-surface-40 hover:bg-surface-45 border border-edge-37 hover:border-red-500/40 rounded-xl p-4 flex flex-col justify-between transition-all group">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-2.5">
                    <FileText className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-semibold text-white">PDF Document</h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Preview the formatted {sectionLabel.toLowerCase()} report before printing or saving.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handlePreviewPdf}
                  className="mt-4 w-full py-2 px-3 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  id="btn-backup-pdf-preview"
                >
                  <Eye className="w-4 h-4" />
                  <span>Preview {sectionLabel} PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-[#171f2e] border-t border-edge-22 flex items-center justify-between">
          <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-slate-500" />
            Currently active section: <strong className="text-slate-200">{sectionLabel}</strong>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
