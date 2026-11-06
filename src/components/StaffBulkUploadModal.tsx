import React, { useState, useRef, useMemo } from 'react';
import { 
  X, 
  UploadCloud, 
  Download, 
  FileSpreadsheet, 
  AlertCircle, 
  CheckCircle2, 
  Trash2, 
  ShieldAlert,
  Briefcase
} from 'lucide-react';
import { StaffMember } from '../types';
import { 
  downloadStaffSampleCSVTemplate, 
  parseCSVToStaff, 
  StaffCSVParseResult, 
  ALLOWED_STAFF_CATEGORIES 
} from '../utils/staffCsvHelper';

interface StaffBulkUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportStaff: (staffList: StaffMember[], mode: 'append' | 'replace') => void;
  currentStaffCount: number;
  existingStaff?: StaffMember[];
}

export const StaffBulkUploadModal: React.FC<StaffBulkUploadModalProps> = ({
  isOpen,
  onClose,
  onImportStaff,
  currentStaffCount,
  existingStaff = []
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<StaffCSVParseResult | null>(null);
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeIdConflicts = useMemo(() => {
    if (!parsedData) return [];
    return importMode === 'append' ? parsedData.existingStaffIdConflicts : [];
  }, [parsedData, importMode]);

  const allPrerequisitesMet = useMemo(() => {
    if (!parsedData || parsedData.staff.length === 0) return false;
    if (!parsedData.prerequisitePassed) return false;
    if (activeIdConflicts.length > 0) return false;
    return true;
  }, [parsedData, activeIdConflicts]);

  if (!isOpen) return null;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file: File) => {
    setFileError(null);
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setFileError('Invalid file format. Please upload a valid .csv spreadsheet file.');
      return;
    }

    setSelectedFile(file);
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const result = parseCSVToStaff(text, currentStaffCount, existingStaff);
      setParsedData(result);
      setIsProcessing(false);
    };
    reader.readAsText(file);
  };

  const handleClear = () => {
    setSelectedFile(null);
    setParsedData(null);
    setFileError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleConfirmImport = () => {
    if (!parsedData || !allPrerequisitesMet) return;
    onImportStaff(parsedData.staff, importMode);
    handleClear();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-[#121824] border border-[#232f45] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
        id="modal-staff-bulk-upload"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#202c40] flex items-center justify-between bg-[#162030]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <UploadCloud className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Bulk Staff CSV Import
              </h2>
              <p className="text-xs text-slate-400">
                Validates staff categories, required fields, and unique Employee IDs before import
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
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Prerequisites Info Banner */}
          <div className="bg-[#151e30] border border-[#263650] rounded-xl p-3.5 space-y-2 text-xs">
            <div className="flex items-center gap-2 font-bold text-white">
              <Briefcase className="w-4 h-4 text-purple-400" />
              <span>Staff CSV Prerequisites</span>
            </div>
            <p className="text-[11px] text-slate-300">
              Every row must include <strong>Full Name</strong>, <strong>Role</strong>, a positive <strong>Monthly Salary</strong>, a unique <strong>Employee ID</strong>, and a valid system <strong>Category</strong>:
            </p>
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {ALLOWED_STAFF_CATEGORIES.map(cat => (
                <span
                  key={cat}
                  className="px-2 py-0.5 rounded-md bg-[#0f1624] border border-[#24344f] text-[11px] font-semibold text-purple-300"
                >
                  {cat}
                </span>
              ))}
            </div>
          </div>

          {/* Sample Download Banner */}
          <div className="bg-[#172030] border border-[#24334d] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-white">Need the Staff CSV format?</h4>
                <p className="text-slate-400 text-[11px]">Download our formatted template with sample employee records.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={downloadStaffSampleCSVTemplate}
              className="px-3 py-2 rounded-lg bg-[#1e2a40] hover:bg-[#253652] text-slate-200 hover:text-white border border-[#2d3f5e] font-semibold text-xs flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
              id="btn-download-staff-csv-sample"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Download Template</span>
            </button>
          </div>

          {fileError && (
            <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/50 text-xs text-rose-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{fileError}</span>
            </div>
          )}

          {/* Upload Area */}
          {!parsedData ? (
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                dragActive
                  ? 'border-purple-500 bg-purple-500/10'
                  : 'border-[#233149] hover:border-purple-500/50 bg-[#141b28] hover:bg-[#161f2e]'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileInputChange}
              />
              <div className="w-12 h-12 rounded-full bg-purple-500/10 text-purple-400 flex items-center justify-center mx-auto mb-3">
                <UploadCloud className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1">
                {isProcessing ? 'Analyzing CSV rows...' : 'Click or Drag & Drop Staff CSV File'}
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Upload your staff roster with Employee ID, Full Name, Role, Category, Department, Qualification, and Salary.
              </p>
            </div>
          ) : (
            /* Parsed Summary & Preview */
            <div className="space-y-4">
              <div className="bg-[#151e2d] border border-[#25344e] rounded-xl p-4 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-purple-500/20 text-purple-300 flex items-center justify-center">
                    <CheckCircle2 className={`w-5 h-5 ${allPrerequisitesMet ? 'text-emerald-400' : 'text-rose-400'}`} />
                  </div>
                  <div>
                    <h4 className="font-bold text-white">{selectedFile?.name}</h4>
                    <p className="text-slate-400 text-[11px]">
                      {parsedData.staff.length} staff rows parsed
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClear}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-[#1c2738] transition-colors cursor-pointer"
                  title="Remove file"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Prerequisite Mismatch Alert */}
              {(!parsedData.prerequisitePassed || activeIdConflicts.length > 0) && (
                <div className="bg-rose-950/60 border-2 border-rose-500/80 rounded-xl p-4 space-y-3 text-xs text-rose-100">
                  <div className="flex items-start gap-2.5">
                    <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-white text-sm">
                        Staff CSV Upload Blocked — Prerequisites Not Matched
                      </h4>
                      <p className="text-[11px] text-rose-200/90 mt-0.5">
                        Please resolve the following prerequisite issues in your CSV file before importing:
                      </p>
                    </div>
                  </div>

                  {parsedData.invalidCategories.length > 0 && (
                    <div className="p-2.5 rounded-lg bg-[#140d16]/80 border border-rose-500/40 text-[11px]">
                      <strong className="text-rose-300">Invalid Categories Found:</strong> {parsedData.invalidCategories.join(', ')}. Allowed categories are: <strong>{ALLOWED_STAFF_CATEGORIES.join(', ')}</strong>.
                    </div>
                  )}

                  <ul className="list-disc list-inside space-y-1 text-[11px] text-rose-200 bg-[#140d16]/70 border border-rose-500/30 rounded-lg p-2.5 max-h-32 overflow-y-auto">
                    {parsedData.prerequisiteIssues.map((issue, i) => (
                      <li key={`s-issue-${i}`}>{issue.message}</li>
                    ))}
                    {activeIdConflicts.map((conf, i) => (
                      <li key={`s-conf-${i}`}>
                        Row {conf.rowNumber}: Employee ID "{conf.staffId}" ({conf.staffName}) already belongs to existing staff member "{conf.existingStaffName}".
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Sample Parsed Staff Preview List */}
              <div className="border border-[#202d44] rounded-xl overflow-hidden bg-[#101622]">
                <div className="px-4 py-2 bg-[#172030] text-xs font-semibold text-slate-300 border-b border-[#202d44] flex justify-between">
                  <span>Import Preview (Showing first 5 rows)</span>
                  <span className="text-slate-400">{parsedData.staff.length} Total</span>
                </div>
                <div className="divide-y divide-[#1b2538] text-xs max-h-48 overflow-y-auto">
                  {parsedData.staff.slice(0, 5).map((s, idx) => (
                    <div key={idx} className="px-4 py-2.5 flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-white">{s.name}</span>
                        <span className="text-slate-400 ml-2">({s.role} • {s.category})</span>
                      </div>
                      <div className="flex items-center gap-3 font-mono text-slate-300">
                        <span>{s.department}</span>
                        <span className="text-emerald-400 font-bold">Rs. {s.salary.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Import Options */}
              <div className="bg-[#141b28] border border-[#222f46] rounded-xl p-3 flex items-center gap-4 text-xs">
                <span className="font-semibold text-slate-300">Import Mode:</span>
                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="radio"
                    name="staffImportMode"
                    value="append"
                    checked={importMode === 'append'}
                    onChange={() => setImportMode('append')}
                    className="text-purple-500"
                  />
                  <span>Append to current staff ({currentStaffCount} existing)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="radio"
                    name="staffImportMode"
                    value="replace"
                    checked={importMode === 'replace'}
                    onChange={() => setImportMode('replace')}
                    className="text-purple-500"
                  />
                  <span>Replace all staff records</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#202c40] bg-[#162030] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-[#1f2b3e] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!allPrerequisitesMet}
            onClick={handleConfirmImport}
            className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:pointer-events-none text-white font-bold text-xs flex items-center gap-2 cursor-pointer transition-all shadow-md shadow-purple-600/25"
            id="btn-confirm-staff-import"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>
              {allPrerequisitesMet
                ? `Import ${parsedData?.staff.length || 0} Staff`
                : 'Prerequisites Not Met'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
