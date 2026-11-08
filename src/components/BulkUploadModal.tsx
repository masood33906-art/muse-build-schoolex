import React, { useState, useRef, useMemo } from 'react';
import {
  X,
  UploadCloud,
  Download,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  FileText,
  Check,
  School,
  ArrowRight,
  ArrowLeft,
  Info,
  ListChecks,
  PlusCircle
} from 'lucide-react';
import { Student, ClassInfo } from '../types';
import {
  downloadSampleCSVTemplate,
  parseCSVToStudents,
  CSVParseResult,
  buildStudentImportPlan,
  createClassRecordForImport,
  withSectionsAddedToClass,
  ImportSkippedRow,
  StudentImportPlan
} from '../utils/csvHelper';
import { backfillStudentClassIds } from '../utils/classExportHelper';
import { assignMissingRollNumbers } from '../utils/rollNumber';

interface BulkUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportStudents: (students: Student[], mode: 'append' | 'replace') => void;
  currentStudentCount: number;
  classes?: ClassInfo[];
  existingStudents?: Student[];
  onNavigateToClasses?: () => void;
  /**
   * Applies prerequisites the import auto-created on the "Add anyway" path:
   * brand-new classes plus existing classes that gained sections. Wired in
   * App to the classes state so the new classes exist before students land.
   */
  onApplyPrerequisites?: (createdClasses: ClassInfo[], updatedClasses: ClassInfo[]) => void;
}

type UploadStep = 'choose' | 'review' | 'done';

interface ImportSummary {
  totalRows: number;
  imported: number;
  skipped: ImportSkippedRow[];
  createdClassNames: string[];
  addedSections: { className: string; sections: string[] }[];
}

export const BulkUploadModal: React.FC<BulkUploadModalProps> = ({
  isOpen,
  onClose,
  onImportStudents,
  currentStudentCount,
  classes = [],
  existingStudents = [],
  onNavigateToClasses,
  onApplyPrerequisites
}) => {
  const [step, setStep] = useState<UploadStep>('choose');
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<CSVParseResult | null>(null);
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // The review plan: importable rows, skipped rows (with plain reasons) and
  // the prerequisites the importable rows need. Recomputed when the import
  // mode changes because existing-ID conflicts only block in append mode.
  const plan: StudentImportPlan | null = useMemo(() => {
    if (!parsedData) return null;
    return buildStudentImportPlan(parsedData, classes, importMode);
  }, [parsedData, classes, importMode]);

  const hasMissingPrerequisites = !!plan && (plan.missingClassNames.length > 0 || plan.sectionsToAdd.length > 0);

  if (!isOpen) return null;

  const resetState = () => {
    setStep('choose');
    setSelectedFile(null);
    setParsedData(null);
    setFileError(null);
    setSummary(null);
    setImportMode('append');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

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
      setFileError('That file is not a .csv file. Please choose the spreadsheet you saved as .csv.');
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
      if (result.totalRows === 0) {
        setFileError('We could not find any student rows in that file. Please check the file and try again.');
        setSelectedFile(null);
        return;
      }
      // Step 3: review — nothing is saved until the admin confirms there.
      setStep('review');
    };
    reader.readAsText(file);
  };

  const handleChooseDifferentFile = () => {
    setSelectedFile(null);
    setParsedData(null);
    setFileError(null);
    setStep('choose');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  /**
   * Runs the import. When createPrerequisites is true (the "Add anyway"
   * path), missing classes/sections are created FIRST — new classes are
   * created with no fee set — and only then are the importable students
   * saved, stamped with the stable classId of their (possibly brand-new)
   * class. Skipped rows are never forced in.
   */
  const runImport = (createPrerequisites: boolean) => {
    if (!plan) return;

    let createdClasses: ClassInfo[] = [];
    let updatedClasses: ClassInfo[] = [];
    let effectiveClasses = classes;

    if (createPrerequisites) {
      createdClasses = plan.missingClassNames.map((name, idx) =>
        createClassRecordForImport(name, plan.sectionsForNewClasses[name] ?? [], idx)
      );
      updatedClasses = plan.sectionsToAdd
        .map(({ className, sections }) => {
          const existing = classes.find(c => c.name.trim().toLowerCase() === className.toLowerCase());
          return existing ? withSectionsAddedToClass(existing, sections) : null;
        })
        .filter((c): c is ClassInfo => c !== null);

      if (onApplyPrerequisites && (createdClasses.length > 0 || updatedClasses.length > 0)) {
        onApplyPrerequisites(createdClasses, updatedClasses);
      }
      effectiveClasses = [
        ...classes.map(c => updatedClasses.find(u => u.id === c.id) ?? c),
        ...createdClasses
      ];
    }

    // Fix P0-3: CSV rows reference classes by NAME — stamp each row with the
    // stable classId of the matching class record before handing them over.
    const stampedStudents = backfillStudentClassIds(plan.importableStudents, effectiveClasses);
    // Roll numbers (derived per-class sequence, utils/rollNumber.ts): rows
    // whose file carried a roll keep it; roll-less rows continue their
    // class's sequence in file order. In replace mode the old registry is
    // being discarded, so sequences start from the file itself; brand-new
    // classes (just created above) start at 1.
    const studentsToImport = assignMissingRollNumbers(
      stampedStudents,
      importMode === 'append' ? existingStudents : [],
      effectiveClasses
    );
    onImportStudents(studentsToImport, importMode);

    setSummary({
      totalRows: plan.totalRows,
      imported: studentsToImport.length,
      skipped: plan.skippedRows,
      createdClassNames: createdClasses.map(c => c.name),
      addedSections: plan.sectionsToAdd
    });
    setStep('done');
  };

  const stepIndex = step === 'choose' ? 1 : step === 'review' ? 2 : 3;
  const stepLabels = ['Template & file', 'Review', 'Import', 'Done'];

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
              <h2 className="text-base font-bold text-white">Add Students from a File (CSV)</h2>
              <p className="text-[11px] text-slate-400">
                Four short steps — you review everything before anything is saved.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="px-6 pt-4 flex items-center gap-2">
          {stepLabels.map((label, idx) => {
            const active = idx === stepIndex - 1 || (step === 'choose' && idx <= 1);
            const done = idx < stepIndex - 1 || (step !== 'choose' && idx <= 1);
            return (
              <React.Fragment key={label}>
                <div className="flex items-center gap-1.5">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border ${
                    done
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                      : active
                        ? 'bg-blue-500/20 border-blue-500/60 text-blue-200'
                        : 'bg-slate-800 border-slate-700 text-slate-500'
                  }`}>
                    {done ? <Check className="w-3 h-3" /> : idx + 1}
                  </span>
                  <span className={`text-[11px] font-semibold ${active || done ? 'text-slate-200' : 'text-slate-500'}`}>
                    {label}
                  </span>
                </div>
                {idx < stepLabels.length - 1 && <div className="flex-1 h-px bg-slate-700/70 min-w-3" />}
              </React.Fragment>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* ============================ STEP: CHOOSE ============================ */}
          {step === 'choose' && (
            <>
              <div className="bg-surface-30 border border-[#263650] rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <ListChecks className="w-4 h-4 text-blue-400 shrink-0" />
                  <span className="text-xs font-bold text-white">How this works</span>
                </div>
                <ol className="text-[11px] text-slate-300 leading-relaxed list-decimal list-inside space-y-1">
                  <li><strong>Download the template</strong> below and fill in one row per student (or use your own spreadsheet saved as .csv).</li>
                  <li><strong>Choose the file.</strong> We read it and show you exactly what will happen — nothing is saved yet.</li>
                  <li><strong>Review.</strong> If your file names a class that does not exist yet, we will tell you and offer to create it for you.</li>
                  <li><strong>Import.</strong> Only the students you approved are added, and you get a summary at the end.</li>
                </ol>
              </div>

              {/* Step 1: template */}
              <div className="bg-surface-40 border border-edge-37 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-white">Step 1 — Get the template</h4>
                    <p className="text-[11px] text-slate-400">
                      A ready-made spreadsheet with the right columns, pre-filled with your classes.
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
                  Download Template
                </button>
              </div>

              {classes.length > 0 ? (
                <div className="bg-surface-30 border border-[#263650] rounded-xl p-3.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
                    Classes already in SchoolEx ({classes.length}) — spell them the same way in your file:
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
                  <p className="text-[11px] text-slate-400 mt-2">
                    A different spelling is fine too — on the next step we will spot new classes and offer to create them.
                  </p>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-blue-950/40 border border-blue-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-start gap-2 text-blue-100 text-xs">
                    <Info className="w-4 h-4 text-blue-300 shrink-0 mt-0.5" />
                    <span>
                      <strong>No classes exist yet — that's okay.</strong> If your file names classes, we will offer to create them automatically during the review step.
                    </span>
                  </div>
                  {onNavigateToClasses && (
                    <button
                      type="button"
                      onClick={() => {
                        handleClose();
                        onNavigateToClasses();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
                    >
                      <span>Open Classes instead</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}

              {fileError && (
                <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/50 text-xs text-rose-200 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{fileError}</span>
                </div>
              )}

              {/* Step 2: choose file */}
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
                  Step 2 — Click to choose your file, or drop it here
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Columns: Student Name, Class, Section, Family Name, Family ID — Date of Birth is needed when your file has that column.
                </p>
                {isProcessing && <p className="text-[11px] text-blue-300 mt-2">Reading your file…</p>}
              </div>
            </>
          )}

          {/* ============================ STEP: REVIEW ============================ */}
          {step === 'review' && plan && (
            <>
              <div className="bg-surface-40 border border-edge-37 rounded-xl p-4 space-y-4">
                {/* File info */}
                <div className="flex items-center justify-between pb-3 border-b border-edge-22">
                  <div className="flex items-center gap-3">
                    <FileText className="w-6 h-6 text-blue-400" />
                    <div>
                      <p className="text-sm font-semibold text-white">{selectedFile?.name}</p>
                      <p className="text-xs text-slate-400">
                        We read <strong className="text-slate-200">{plan.totalRows}</strong> student{plan.totalRows === 1 ? '' : 's'} from your file.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleChooseDifferentFile}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                    title="Remove file and start over"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Counts */}
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="rounded-lg bg-[#0f1624] border border-[#24344f] p-3 text-center">
                    <div className="text-lg font-bold text-white">{plan.totalRows}</div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Read from file</div>
                  </div>
                  <div className="rounded-lg bg-emerald-950/40 border border-emerald-500/30 p-3 text-center">
                    <div className="text-lg font-bold text-emerald-300">{plan.importableStudents.length}</div>
                    <div className="text-[10px] uppercase tracking-wider text-emerald-200/70 font-semibold">Ready to import</div>
                  </div>
                  <div className={`rounded-lg p-3 text-center border ${plan.skippedRows.length > 0 ? 'bg-rose-950/40 border-rose-500/30' : 'bg-[#0f1624] border-[#24344f]'}`}>
                    <div className={`text-lg font-bold ${plan.skippedRows.length > 0 ? 'text-rose-300' : 'text-slate-300'}`}>{plan.skippedRows.length}</div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Will be skipped</div>
                  </div>
                </div>

                {!plan.hasDobColumn && (
                  <div className="p-3 rounded-lg bg-blue-950/40 border border-blue-500/30 flex items-start gap-2 text-xs text-blue-100">
                    <Info className="w-4 h-4 text-blue-300 shrink-0 mt-0.5" />
                    <span>
                      This file has <strong>no Date of Birth column</strong>, so students will be added without a date of birth. You can fill it in later on each student's page. (The template above includes the column.)
                    </span>
                  </div>
                )}

                {/* Import mode */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-slate-300">Where should these students go?</span>
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
                      Add to existing ({currentStudentCount})
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
                {importMode === 'replace' && (
                  <p className="text-[11px] text-rose-300">
                    Replace means every current student record is removed and only this file's students remain. Choose "Add to existing" if you are not sure.
                  </p>
                )}
              </div>

              {/* WARNING: missing prerequisites — the two paths */}
              {hasMissingPrerequisites && (
                <div
                  className="bg-amber-950/50 border-2 border-amber-500/70 rounded-xl p-4 space-y-3.5 text-xs text-amber-100 shadow-xl"
                  id="csv-prerequisite-warning"
                >
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 shrink-0 mt-0.5">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">Some classes in your file don't exist yet</h4>
                      <p className="text-[11px] text-amber-200/90 mt-0.5">
                        Nothing is wrong with your file — SchoolEx just doesn't have these classes yet. You can go back and fix the file, or let SchoolEx create what's missing and import everyone who is ready.
                      </p>
                    </div>
                  </div>

                  <ul className="space-y-1.5 pl-1">
                    {plan.missingClassNames.map(name => (
                      <li key={name} className="flex items-center gap-2 text-xs font-semibold text-white">
                        <PlusCircle className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                        <span>
                          Class "{name}" doesn't exist yet
                          {(plan.sectionsForNewClasses[name] ?? []).length > 0 && (
                            <span className="text-amber-200/80 font-normal">
                              {' '}— it will be created with section{(plan.sectionsForNewClasses[name] ?? []).length === 1 ? '' : 's'} {(plan.sectionsForNewClasses[name] ?? []).join(', ')}
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                    {plan.sectionsToAdd.map(({ className, sections }) => (
                      <li key={className} className="flex items-center gap-2 text-xs font-semibold text-white">
                        <PlusCircle className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                        <span>
                          Section{sections.length === 1 ? '' : 's'} {sections.join(', ')} will be added to Class "{className}"
                        </span>
                      </li>
                    ))}
                  </ul>

                  <p className="text-[11px] text-amber-200/80">
                    New classes are created with <strong>no fee set</strong> — you can set each class fee later in the Classes section. Rows that have other problems (see below) are still skipped; "Add anyway" never forces them in.
                  </p>

                  <div className="flex flex-col sm:flex-row gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleChooseDifferentFile}
                      className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      Go back
                    </button>
                    <button
                      type="button"
                      onClick={() => runImport(true)}
                      disabled={plan.importableStudents.length === 0}
                      className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:pointer-events-none text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-colors flex-1"
                      id="btn-add-anyway-import"
                    >
                      <School className="w-4 h-4" />
                      Add anyway — create {plan.missingClassNames.length + plan.sectionsToAdd.length} item{plan.missingClassNames.length + plan.sectionsToAdd.length === 1 ? '' : 's'} & import {plan.importableStudents.length} student{plan.importableStudents.length === 1 ? '' : 's'}
                    </button>
                  </div>
                </div>
              )}

              {/* Per-row problems, in plain words */}
              {plan.skippedRows.length > 0 && (
                <div className="bg-surface-40 border border-edge-37 rounded-xl p-4 space-y-2">
                  <div className="text-xs font-bold text-white">
                    {plan.skippedRows.length} row{plan.skippedRows.length === 1 ? '' : 's'} will be skipped — and why:
                  </div>
                  <ul className="space-y-1.5 max-h-40 overflow-y-auto">
                    {plan.skippedRows.map(row => (
                      <li key={row.rowNumber} className="text-[11px] text-rose-200 bg-rose-950/30 border border-rose-500/25 rounded-lg px-2.5 py-1.5">
                        <strong>Row {row.rowNumber}</strong>
                        {row.studentName && row.studentName !== '(Empty Name)' ? <> — {row.studentName}</> : null}
                        {row.studentId && row.studentId !== 'N/A' ? <> ({row.studentId})</> : null}
                        : {row.reason}
                      </li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-slate-400">
                    You can fix these rows in your file and upload it again later — the rest of the students are not affected.
                  </p>
                </div>
              )}

              {/* Preview of who will be imported */}
              {plan.importableStudents.length > 0 && (
                <div className="bg-surface-40 border border-edge-37 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-300">
                      These students will be imported ({plan.importableStudents.length})
                    </span>
                    <span className="text-xs text-emerald-400 flex items-center gap-1 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Checked & ready
                    </span>
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
                          <th className="py-2 px-3">Note</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1e2638]">
                        {plan.importableStudents.slice(0, 15).map((s, idx) => {
                          const clsObj = classes.find(c => c.name.trim().toLowerCase() === s.class.trim().toLowerCase());
                          const note = !clsObj
                            ? `New class "${s.class}" will be created`
                            : !(clsObj.sections || []).some(sec => sec.trim().toLowerCase() === s.section.trim().toLowerCase())
                              ? `Section ${s.section} will be added`
                              : 'Ready';
                          return (
                            <tr key={`${s.id}-${idx}`} className="hover:bg-[#1f283a]">
                              <td className="py-1.5 px-3 font-mono text-sky-400">{s.id}</td>
                              <td className="py-1.5 px-3 font-medium text-white">{s.name}</td>
                              <td className="py-1.5 px-3 text-slate-300">{s.family}</td>
                              <td className="py-1.5 px-3 font-semibold text-slate-200">{s.class}</td>
                              <td className="py-1.5 px-3 font-semibold text-slate-200">{s.section}</td>
                              <td className="py-1.5 px-3">
                                <span className={note === 'Ready' ? 'text-emerald-400 font-semibold text-[11px] flex items-center gap-1' : 'text-amber-300 font-semibold text-[11px]'}>
                                  {note === 'Ready' && <Check className="w-3 h-3" />}
                                  {note}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {plan.importableStudents.length > 15 && (
                    <p className="text-[11px] text-slate-500 mt-1">
                      Showing the first 15 of {plan.importableStudents.length} students — all of them will be imported.
                    </p>
                  )}
                </div>
              )}

              {plan.importableStudents.length === 0 && (
                <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/50 text-xs text-rose-200">
                  No students from this file can be imported — every row has a problem listed above. Go back, fix the file, and try again.
                </div>
              )}
            </>
          )}

          {/* ============================ STEP: DONE ============================ */}
          {step === 'done' && summary && (
            <div className="space-y-4">
              <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-5 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                <h3 className="text-base font-bold text-white">Import finished</h3>
                <p className="text-xs text-emerald-100">
                  <strong className="text-emerald-300">{summary.imported}</strong> of {summary.totalRows} student{summary.totalRows === 1 ? '' : 's'} were imported.
                  {summary.skipped.length > 0 && (
                    <> <strong className="text-rose-300">{summary.skipped.length}</strong> row{summary.skipped.length === 1 ? ' was' : 's were'} skipped — nothing was added silently, and nothing failed silently.</>
                  )}
                </p>
              </div>

              {(summary.createdClassNames.length > 0 || summary.addedSections.length > 0) && (
                <div className="bg-surface-40 border border-edge-37 rounded-xl p-4 space-y-1.5">
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <School className="w-4 h-4 text-amber-300" />
                    Created for you during this import:
                  </div>
                  <ul className="text-[11px] text-slate-300 space-y-1 pl-1">
                    {summary.createdClassNames.map(name => (
                      <li key={name}>• Class "{name}" was created (no fee set — set it any time in the Classes section).</li>
                    ))}
                    {summary.addedSections.map(({ className, sections }) => (
                      <li key={className}>• Section{sections.length === 1 ? '' : 's'} {sections.join(', ')} added to Class "{className}".</li>
                    ))}
                  </ul>
                </div>
              )}

              {summary.skipped.length > 0 && (
                <div className="bg-surface-40 border border-edge-37 rounded-xl p-4 space-y-2">
                  <div className="text-xs font-bold text-white">Skipped rows:</div>
                  <ul className="space-y-1.5 max-h-40 overflow-y-auto">
                    {summary.skipped.map(row => (
                      <li key={row.rowNumber} className="text-[11px] text-rose-200 bg-rose-950/30 border border-rose-500/25 rounded-lg px-2.5 py-1.5">
                        <strong>Row {row.rowNumber}</strong>
                        {row.studentName && row.studentName !== '(Empty Name)' ? <> — {row.studentName}</> : null}
                        {row.studentId && row.studentId !== 'N/A' ? <> ({row.studentId})</> : null}
                        : {row.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-[#171f2e] border-t border-edge-22 flex items-center justify-between">
          {step === 'done' ? (
            <>
              <span className="text-[11px] text-slate-400">You can close this window now.</span>
              <button
                type="button"
                onClick={handleClose}
                className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-900/30 transition-all"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                Done
              </button>
            </>
          ) : step === 'review' ? (
            <>
              <button
                type="button"
                onClick={handleChooseDifferentFile}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
              </button>
              {hasMissingPrerequisites ? (
                <span className="text-[11px] text-amber-300 font-medium">
                  Choose "Add anyway" or "Go back" in the yellow box above.
                </span>
              ) : (
                <button
                  type="button"
                  disabled={!plan || plan.importableStudents.length === 0}
                  onClick={() => runImport(false)}
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:pointer-events-none text-white text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-900/30 transition-all"
                  id="btn-confirm-bulk-import"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  Import {plan?.importableStudents.length ?? 0} student{plan?.importableStudents.length === 1 ? '' : 's'}
                  {plan && plan.skippedRows.length > 0 ? ` (${plan.skippedRows.length} will be skipped)` : ''}
                </button>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
              <span className="text-[11px] text-slate-500">Nothing is saved until you confirm on the review step.</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
