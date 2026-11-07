import React, { useState, useRef, useMemo } from 'react';
import { 
  X, 
  UploadCloud, 
  Download, 
  FileSpreadsheet, 
  AlertCircle, 
  AlertTriangle,
  CheckCircle2, 
  Trash2, 
  FileText,
  Check,
  School,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import { Student, ClassInfo } from '../types';
import { downloadSampleCSVTemplate, parseCSVToStudents, CSVParseResult } from '../utils/csvHelper';
import { backfillStudentClassIds } from '../utils/classExportHelper';

interface BulkUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportStudents: (students: Student[], mode: 'append' | 'replace') => void;
  currentStudentCount: number;
  classes?: ClassInfo[];
  existingStudents?: Student[];
  onNavigateToClasses?: () => void;
}

export const BulkUploadModal: React.FC<BulkUploadModalProps> = ({
  isOpen,
  onClose,
  onImportStudents,
  currentStudentCount,
  classes = [],
  existingStudents = [],
  onNavigateToClasses
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<CSVParseResult | null>(null);
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Determine whether all prerequisites are satisfied for the current import mode
  const activeIdConflicts = useMemo(() => {
    if (!parsedData) return [];
    return importMode === 'append' ? parsedData.existingStudentIdConflicts : [];
  }, [parsedData, importMode]);

  const allPrerequisitesMet = useMemo(() => {
    if (!parsedData || parsedData.students.length === 0) return false;
    if (!parsedData.prerequisitePassed) return false;
    if (activeIdConflicts.length > 0) return false;
    return true;
  }, [parsedData, activeIdConflicts]);

  // Existing classes without the missing classes for missing-section display
  const existingClassesWithMissingSections = useMemo(() => {
    if (!parsedData) return [];
    const missingClsLower = new Set(parsedData.missingClasses.map(c => c.toLowerCase()));
    return Object.entries(parsedData.missingSectionsByClass).filter(
      ([clsName]) => !missingClsLower.has(clsName.toLowerCase())
    );
  }, [parsedData]);

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
      const result = parseCSVToStudents(text, currentStudentCount, classes, existingStudents);
      setParsedData(result);
      setIsProcessing(false);
    };
    reader.readAsText(file);
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setParsedData(null);
    setFileError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleConfirmImport = () => {
    if (!parsedData || !allPrerequisitesMet) return;
    // Fix P0-3: CSV rows reference classes by NAME — stamp each row with the
    // stable classId of the matching class record before handing them over.
    onImportStudents(backfillStudentClassIds(parsedData.students, classes), importMode);
    handleClearFile();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-[#131926] border border-[#243048] rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl"
        id="modal-bulk-upload"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-edge-22 flex items-center justify-between bg-[#171f2e]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <UploadCloud className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Import Students (CSV)</h2>
              <p className="text-[11px] text-slate-400">
                Validates classes, sections, and student IDs against system prerequisites before upload
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* System Prerequisites Status Banner */}
          <div className="bg-surface-30 border border-[#263650] rounded-xl p-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <School className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="text-xs font-bold text-white">
                  CSV Upload Prerequisites (Must Match System Data)
                </span>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                classes.length > 0
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                  : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
              }`}>
                {classes.length} {classes.length === 1 ? 'Class' : 'Classes'} Available in System
              </span>
            </div>

            <p className="text-[11px] text-slate-300 leading-relaxed">
              Every student row in the CSV file must reference a <strong>Class</strong> and <strong>Section</strong> that already exists in the system. If any student belongs to a class or section that is not yet created, the upload will be blocked until the prerequisite class is added.
            </p>

            {classes.length > 0 ? (
              <div className="pt-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
                  Available Classes & Sections in System:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {classes.map(cls => (
                    <span
                      key={cls.id}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#0f1624] border border-[#24344f] text-[11px] text-slate-200 font-medium"
                    >
                      <strong className="text-blue-300">{cls.name}</strong>
                      <span className="text-slate-400">
                        (Sec: {cls.sections && cls.sections.length > 0 ? cls.sections.join(', ') : 'None'})
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-start gap-2 text-amber-200 text-xs">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>No classes exist in the system yet!</strong> You must create your classes (e.g. Class 1, Class 5, Prep) in the Classes module before uploading a Student CSV.
                  </span>
                </div>
                {onNavigateToClasses && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onNavigateToClasses();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
                  >
                    <span>Go to Classes</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Sample CSV Download Box */}
          <div className="bg-surface-40 border border-edge-37 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-white">Need standard CSV format?</h4>
                <p className="text-[11px] text-slate-400">
                  Downloads sample CSV pre-filled with your available system classes
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => downloadSampleCSVTemplate(classes)}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer"
              id="btn-download-sample-csv"
            >
              <Download className="w-3.5 h-3.5" />
              Template CSV
            </button>
          </div>

          {fileError && (
            <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/50 text-xs text-rose-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{fileError}</span>
            </div>
          )}

          {/* Upload Zone */}
          {!selectedFile ? (
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                dragActive
                  ? 'border-blue-500 bg-blue-950/20'
                  : 'border-[#29364f] hover:border-slate-500 bg-[#161d2b]'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileInputChange}
                className="hidden"
                id="bulk-csv-file-input"
              />
              <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 mb-2">
                <UploadCloud className="w-5 h-5 text-blue-400" />
              </div>
              <p className="text-xs font-semibold text-white">
                Click to browse or drop Student CSV file here
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Required columns: Student Name, Class, Section, Family Name, Family ID
              </p>
            </div>
          ) : (
            <div className="bg-surface-40 border border-edge-37 rounded-xl p-4 space-y-4">
              {/* File Info Banner */}
              <div className="flex items-center justify-between pb-3 border-b border-edge-22">
                <div className="flex items-center gap-3">
                  <FileText className={`w-6 h-6 ${allPrerequisitesMet ? 'text-emerald-400' : 'text-rose-400'}`} />
                  <div>
                    <p className="text-sm font-semibold text-white">{selectedFile.name}</p>
                    <p className="text-xs text-slate-400">
                      {(selectedFile.size / 1024).toFixed(1)} KB • {parsedData ? `${parsedData.students.length} rows parsed` : 'Processing...'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClearFile}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                  title="Remove file"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* ========================================================================= */}
              {/* PREREQUISITE BUG / MISMATCH ALERT BOX (BLOCKS UPLOAD IF UNMET)            */}
              {/* ========================================================================= */}
              {parsedData && (!parsedData.prerequisitePassed || activeIdConflicts.length > 0) && (
                <div 
                  className="bg-rose-950/60 border-2 border-rose-500/80 rounded-xl p-4 space-y-3.5 text-xs text-rose-100 shadow-xl"
                  id="csv-prerequisite-error-alert"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0 mt-0.5">
                        <ShieldAlert className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">
                          CSV Upload Blocked — Prerequisites Not Matched
                        </h4>
                        <p className="text-[11px] text-rose-200/90 mt-0.5">
                          This CSV file cannot be imported because one or more student records reference classes, sections, or IDs that do not match the system prerequisites.
                        </p>
                      </div>
                    </div>

                    {onNavigateToClasses && (parsedData.missingClasses.length > 0 || existingClassesWithMissingSections.length > 0) && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onNavigateToClasses();
                        }}
                        className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer shadow-md transition-colors"
                      >
                        <School className="w-3.5 h-3.5" />
                        <span>Create Missing Classes</span>
                      </button>
                    )}
                  </div>

                  {/* Prerequisite Checklist Summary */}
                  <div className="bg-[#120b13]/80 border border-rose-500/40 rounded-lg p-3 space-y-2.5">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-rose-300">
                      Prerequisites That Need To Be Matched Before Uploading:
                    </div>

                    {/* 1. Missing Classes */}
                    {parsedData.missingClasses.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0" />
                          <span>
                            1. Create the following missing {parsedData.missingClasses.length === 1 ? 'Class' : 'Classes'} in the System:
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 pl-3.5 pt-0.5">
                          {parsedData.missingClasses.map(clsName => {
                            const reqSecs = parsedData.missingSectionsByClass[clsName] || ['A'];
                            return (
                              <span
                                key={clsName}
                                className="px-2.5 py-1 rounded-md bg-rose-500/20 border border-rose-400/40 text-rose-200 font-semibold text-[11px]"
                              >
                                {clsName} <span className="text-rose-300/80 font-normal">(Required Sec: {reqSecs.join(', ')})</span>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* 2. Existing Classes Missing Required Sections */}
                    {existingClassesWithMissingSections.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                          <span>
                            Add the following missing Section(s) to existing System Classes:
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 pl-3.5 pt-0.5">
                          {existingClassesWithMissingSections.map(([clsName, secs]) => (
                            <span
                              key={clsName}
                              className="px-2.5 py-1 rounded-md bg-amber-500/20 border border-amber-400/40 text-amber-200 font-semibold text-[11px]"
                            >
                              {clsName} → Add Section: {secs.join(', ')}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 3. Duplicate IDs inside CSV */}
                    {parsedData.duplicateIdsInFile.length > 0 && (
                      <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0" />
                        <span>
                          Resolve duplicate Student IDs inside the CSV file: <span className="font-mono text-rose-300">{parsedData.duplicateIdsInFile.join(', ')}</span>
                        </span>
                      </div>
                    )}

                    {/* 4. Conflicts with already enrolled student IDs in Append Mode */}
                    {activeIdConflicts.length > 0 && (
                      <div className="text-xs font-semibold text-white flex items-start gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0 mt-1.5" />
                        <span>
                          {activeIdConflicts.length} Student ID(s) in CSV already belong to existing students in the system (Switch to "Replace all records" or assign unique Student IDs in the CSV).
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Detailed Row-by-Row Bug Breakdown */}
                  <div className="space-y-1">
                    <div className="text-[11px] font-semibold text-rose-200">
                      Affected Rows in CSV ({parsedData.prerequisiteIssues.length + activeIdConflicts.length} issue{parsedData.prerequisiteIssues.length + activeIdConflicts.length === 1 ? '' : 's'} detected):
                    </div>
                    <ul className="list-disc list-inside space-y-1 text-[11px] text-rose-200/95 bg-[#140d16]/70 border border-rose-500/30 rounded-lg p-2.5 max-h-36 overflow-y-auto font-medium">
                      {parsedData.prerequisiteIssues.map((issue, idx) => (
                        <li key={`issue-${idx}`}>{issue.message}</li>
                      ))}
                      {activeIdConflicts.map((conf, idx) => (
                        <li key={`conf-${idx}`}>
                          Row {conf.rowNumber}: Student "{conf.studentName}" has ID "{conf.studentId}", which is already assigned to enrolled student "{conf.existingStudentName}".
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Preview Table of Uploaded Records */}
              {parsedData && parsedData.students.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-300">
                      Preview Parsed Students ({parsedData.students.length} items)
                    </span>
                    {allPrerequisitesMet ? (
                      <span className="text-xs text-emerald-400 flex items-center gap-1 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        All Prerequisites Matched — Ready to Import
                      </span>
                    ) : (
                      <span className="text-xs text-rose-400 flex items-center gap-1 font-semibold">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Fix Prerequisite Mismatches Above to Enable Import
                      </span>
                    )}
                  </div>

                  <div className="max-h-48 overflow-y-auto overflow-x-auto border border-edge-22 rounded-lg">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-[#141a27] text-slate-400 sticky top-0 border-b border-edge-22">
                        <tr>
                          <th className="py-2 px-3">ID</th>
                          <th className="py-2 px-3">Name</th>
                          <th className="py-2 px-3">Family</th>
                          <th className="py-2 px-3">Class</th>
                          <th className="py-2 px-3">Sec</th>
                          <th className="py-2 px-3">Prerequisite Check</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1e2638]">
                        {parsedData.students.slice(0, 15).map((s, idx) => {
                          const clsObj = classes.find(c => c.name.trim().toLowerCase() === s.class.trim().toLowerCase());
                          const hasClass = !!clsObj;
                          const hasSec = hasClass && (clsObj.sections || []).some(sec => sec.trim().toLowerCase() === s.section.trim().toLowerCase());
                          const hasDupId = parsedData.duplicateIdsInFile.some(d => d.toLowerCase() === s.id.toLowerCase()) ||
                            activeIdConflicts.some(c => c.studentId.toLowerCase() === s.id.toLowerCase());
                          const rowValid = hasClass && hasSec && !hasDupId;

                          return (
                            <tr
                              key={idx}
                              className={rowValid ? 'hover:bg-[#1f283a]' : 'bg-rose-950/30 hover:bg-rose-950/40'}
                            >
                              <td className="py-1.5 px-3 font-mono text-sky-400">{s.id}</td>
                              <td className="py-1.5 px-3 font-medium text-white">{s.name}</td>
                              <td className="py-1.5 px-3 text-slate-300">{s.family}</td>
                              <td className={`py-1.5 px-3 font-semibold ${hasClass ? 'text-slate-200' : 'text-rose-400'}`}>
                                {s.class || '(Missing)'}
                              </td>
                              <td className={`py-1.5 px-3 font-semibold ${hasSec ? 'text-slate-200' : 'text-rose-400'}`}>
                                {s.section || '(Missing)'}
                              </td>
                              <td className="py-1.5 px-3">
                                {rowValid ? (
                                  <span className="text-emerald-400 font-semibold text-[11px] flex items-center gap-1">
                                    <Check className="w-3 h-3" /> Matched
                                  </span>
                                ) : !hasClass ? (
                                  <span className="text-rose-400 font-semibold text-[11px]">
                                    Missing Class "{s.class}"
                                  </span>
                                ) : !hasSec ? (
                                  <span className="text-amber-400 font-semibold text-[11px]">
                                    Missing Sec "{s.section}"
                                  </span>
                                ) : (
                                  <span className="text-rose-400 font-semibold text-[11px]">
                                    Duplicate ID
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {parsedData.students.length > 15 && (
                    <p className="text-[11px] text-slate-500 mt-1">
                      Showing first 15 rows of {parsedData.students.length} records.
                    </p>
                  )}

                  {/* Mode Selector */}
                  <div className="mt-4 pt-4 border-t border-edge-22 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-slate-300">
                      Import Destination Mode:
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setImportMode('append')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all ${
                          importMode === 'append'
                            ? 'bg-blue-600 text-white font-semibold'
                            : 'bg-[#141b29] text-slate-400 hover:text-white border border-edge-22'
                        }`}
                      >
                        Append to existing ({currentStudentCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => setImportMode('replace')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all ${
                          importMode === 'replace'
                            ? 'bg-rose-600 text-white font-semibold'
                            : 'bg-[#141b29] text-slate-400 hover:text-white border border-edge-22'
                        }`}
                      >
                        Replace all records
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-[#171f2e] border-t border-edge-22 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={!allPrerequisitesMet}
            onClick={handleConfirmImport}
            className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:pointer-events-none text-white text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-900/30 transition-all"
            id="btn-confirm-bulk-import"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            {allPrerequisitesMet
              ? `Import ${parsedData?.students.length || 0} Validated Students`
              : 'Prerequisites Not Met — Cannot Import'}
          </button>
        </div>
      </div>
    </div>
  );
};
