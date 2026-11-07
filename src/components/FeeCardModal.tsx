import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  X, 
  Printer, 
  Download, 
  Search, 
  ArrowLeft,
  Check
} from 'lucide-react';
import { Student, ClassInfo } from '../types';
import { SchoolSettings, getSchoolSettings } from '../utils/settingsHelper';
import { 
  buildStudentFeeCardData, 
  generateFeeCardPdf,
  formatOrBlank,
  StudentFeeCardData
} from '../utils/feeCardHelper';

interface FeeCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  classes: ClassInfo[];
  initialSelectedStudentId?: string;
  schoolSettings?: SchoolSettings;
  onShowToast: (message: string, type?: 'success' | 'info' | 'error') => void;
}

export const FeeCardModal: React.FC<FeeCardModalProps> = ({
  isOpen,
  onClose,
  students,
  classes,
  initialSelectedStudentId,
  schoolSettings,
  onShowToast
}) => {
  const [liveSchool, setLiveSchool] = useState<SchoolSettings>(() => schoolSettings || getSchoolSettings());
  useEffect(() => {
    if (schoolSettings) setLiveSchool(schoolSettings);
  }, [schoolSettings]);
  useEffect(() => {
    const handleSettingsChange = () => setLiveSchool(getSchoolSettings());
    window.addEventListener('schoolSettingsUpdated', handleSettingsChange);
    return () => window.removeEventListener('schoolSettingsUpdated', handleSettingsChange);
  }, []);
  const currentSchool = liveSchool;
  const isMinimalTemplate = currentSchool.studentFeeCardTemplate === 'minimal-modern';

  // Selected student IDs in container
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    if (initialSelectedStudentId) {
      return new Set([initialSelectedStudentId]);
    }
    return new Set<string>();
  });

  // View Mode: 'select' (search and container) or 'preview' (preview card with print option)
  const [viewMode, setViewMode] = useState<'select' | 'preview'>(() => {
    return initialSelectedStudentId ? 'preview' : 'select';
  });

  // Search input & dropdown open state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Handle outside click to close dropdown
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Sync if initialSelectedStudentId changes
  useEffect(() => {
    if (initialSelectedStudentId) {
      setSelectedIds(new Set([initialSelectedStudentId]));
      setViewMode('preview');
    } else {
      setViewMode('select');
      setSelectedIds(new Set());
    }
  }, [initialSelectedStudentId, isOpen]);

  // Filter students for the searchable dropdown
  const searchResults = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) {
      // If empty search query, show first 10 students as suggestions
      return students.slice(0, 10);
    }
    return students.filter(student => {
      return (
        (student.name || '').toLowerCase().includes(q) ||
        (student.id || '').toLowerCase().includes(q) ||
        (student.rollNo || '').toLowerCase().includes(q) ||
        (student.fatherName || '').toLowerCase().includes(q) ||
        (student.family || '').toLowerCase().includes(q) ||
        (student.class || '').toLowerCase().includes(q)
      );
    }).slice(0, 15);
  }, [students, searchQuery]);

  // Add student to container
  const handleAddStudent = (student: Student) => {
    if (selectedIds.has(student.id)) {
      onShowToast(`${student.name} is already in the list`, 'info');
      setIsDropdownOpen(false);
      return;
    }
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.add(student.id);
      return next;
    });
    setSearchQuery('');
    setIsDropdownOpen(false);
  };

  // Remove student from container
  const handleRemoveStudent = (studentId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(studentId);
      return next;
    });
  };

  // Clear all selected
  const handleCancelEverything = () => {
    setSelectedIds(new Set());
    setSearchQuery('');
    setIsDropdownOpen(false);
    onClose();
  };

  // Select all students
  const handleSelectAll = () => {
    setSelectedIds(new Set(students.map(s => s.id)));
  };

  // List of selected students objects
  const selectedStudentsList = useMemo(() => {
    return students.filter(s => selectedIds.has(s.id));
  }, [students, selectedIds]);

  // All cards data for scrollable preview
  const allCardsData = useMemo<StudentFeeCardData[]>(() => {
    return selectedStudentsList.map(st => buildStudentFeeCardData(st, classes, currentSchool));
  }, [selectedStudentsList, classes, currentSchool]);

  // Print cards for real printer
  const handlePrintToPrinter = () => {
    if (selectedStudentsList.length === 0) {
      onShowToast('Please select at least one student', 'error');
      return;
    }
    window.print();
  };

  // Download 1-page PDF
  const handleDownloadPdf = () => {
    if (selectedStudentsList.length === 0) {
      onShowToast('Please select at least one student', 'error');
      return;
    }
    try {
      generateFeeCardPdf(selectedStudentsList, classes, currentSchool);
      onShowToast(`Downloaded Fee Cards for ${selectedStudentsList.length} members`, 'success');
    } catch (err) {
      console.error('Error generating fee card PDF:', err);
      onShowToast('Failed to generate PDF document', 'error');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="w-full max-w-4xl bg-surface-6 border border-[#1e2d42] rounded-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[94vh]"
        id="modal-fee-cards"
      >
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#121a28] border-b border-edge-11 flex items-center justify-between no-print">
          <div className="flex items-center gap-3">
            {viewMode === 'preview' && (
              <button
                type="button"
                onClick={() => setViewMode('select')}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-surface-43 transition-colors cursor-pointer mr-1"
                title="Back to Student Selection"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <h2 className="text-base font-bold text-white tracking-tight">
              Fee Cards
            </h2>
            {selectedStudentsList.length > 0 && (
              <span className="text-xs text-slate-400 font-medium">
                ({selectedStudentsList.length} Selected)
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-surface-43 transition-colors cursor-pointer"
            id="btn-close-fee-card-modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 no-print bg-surface-1">
          {viewMode === 'select' ? (
            /* SELECTION VIEW */
            <div className="space-y-5 max-w-2xl mx-auto py-2">
              {/* Search Container with Integrated Selected Tags */}
              <div className="space-y-1.5" ref={searchContainerRef}>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300 block">
                    Search & Select Students {selectedStudentsList.length > 0 && `(${selectedStudentsList.length} Selected)`}
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors font-medium cursor-pointer"
                    >
                      Select All ({students.length})
                    </button>
                    {selectedStudentsList.length > 0 && (
                      <>
                        <span className="text-slate-600">•</span>
                        <button
                          type="button"
                          onClick={() => setSelectedIds(new Set())}
                          className="text-[11px] text-rose-400 hover:text-rose-300 transition-colors font-medium cursor-pointer"
                        >
                          Clear
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="relative">
                  {/* Container containing selected chips and inline search input */}
                  <div 
                    onClick={() => {
                      searchInputRef.current?.focus();
                      setIsDropdownOpen(true);
                    }}
                    className="min-h-[50px] p-2 rounded-xl bg-surface-9 border border-edge-29 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 flex flex-wrap items-center gap-1.5 transition-all cursor-text"
                    id="container-fee-card-search"
                  >
                    <Search className="w-4 h-4 text-slate-400 ml-1 mr-1 shrink-0" />

                    {/* Selected Student Names directly inside this container */}
                    {selectedStudentsList.map((student) => (
                      <span
                        key={student.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#18263a] border border-[#263c5d] text-white text-xs font-medium shadow-sm animate-in fade-in zoom-in-95"
                      >
                        {/* ONLY NAME is displayed */}
                        <span>{student.name}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveStudent(student.id);
                          }}
                          className="text-slate-400 hover:text-rose-300 hover:bg-rose-500/20 rounded p-0.5 transition-colors cursor-pointer"
                          title={`Remove ${student.name}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}

                    {/* Live search input inside the same container */}
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setIsDropdownOpen(true);
                      }}
                      onFocus={() => setIsDropdownOpen(true)}
                      placeholder={selectedStudentsList.length === 0 ? "Type student name to search..." : "Type to add more students..."}
                      className="flex-1 min-w-[150px] bg-transparent text-xs text-white placeholder-slate-500 outline-none py-1 px-1"
                      id="input-fee-card-student-search"
                    />

                    {searchQuery && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSearchQuery('');
                        }}
                        className="text-slate-400 hover:text-white p-1 ml-auto"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Dropdown Menu */}
                  {isDropdownOpen && (
                    <div 
                      className="absolute left-0 right-0 mt-1.5 bg-surface-9 border border-[#263a56] rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto py-1 text-xs divide-y divide-[#172338]"
                      id="dropdown-student-search-results"
                    >
                      {searchResults.length === 0 ? (
                        <div className="px-4 py-3 text-center text-slate-500 text-xs">
                          No students matching &quot;{searchQuery}&quot;
                        </div>
                      ) : (
                        searchResults.map((student) => {
                          const isAlreadySelected = selectedIds.has(student.id);
                          return (
                            <button
                              key={student.id}
                              type="button"
                              onClick={() => handleAddStudent(student)}
                              className={`w-full px-4 py-2.5 text-left flex items-center justify-between hover:bg-[#19273d] transition-colors cursor-pointer ${
                                isAlreadySelected ? 'opacity-60 bg-[#121c2c]' : ''
                              }`}
                            >
                              <div className="flex flex-col">
                                <span className="font-semibold text-white">
                                  {student.name}
                                </span>
                                <span className="text-[11px] text-slate-400">
                                  Class: {student.class || 'N/A'} • Roll: {student.rollNo || 'N/A'} • ID: {student.id}
                                </span>
                              </div>
                              {isAlreadySelected ? (
                                <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                                  <Check className="w-3 h-3" /> Added
                                </span>
                              ) : (
                                <span className="text-[10px] text-blue-400 font-semibold px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20">
                                  Select
                                </span>
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons: Cancel Everything or Print the Fee Cards */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-[#172337]">
                <button
                  type="button"
                  onClick={handleCancelEverything}
                  className="px-4 py-2 rounded-xl bg-[#141d2c] hover:bg-surface-44 border border-edge-35 text-slate-300 hover:text-white text-xs font-semibold cursor-pointer transition-all"
                  id="btn-cancel-fee-cards"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (selectedStudentsList.length === 0) {
                      onShowToast('Please select at least one student', 'info');
                      return;
                    }
                    setViewMode('preview');
                  }}
                  disabled={selectedStudentsList.length === 0}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:pointer-events-none text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-600/25 cursor-pointer transition-all"
                  id="btn-print-the-fee-cards"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Fee Cards</span>
                </button>
              </div>
            </div>
          ) : (
            /* PREVIEW VIEW (Scrollable Fee Cards, Rules page removed) */
            <div className="space-y-6">
              {/* Preview Controls Bar */}
              <div className="flex items-center justify-between gap-3 text-xs bg-[#0e1624] p-2.5 rounded-xl border border-[#1b293d] sticky top-0 z-20 shadow-md">
                <button
                  type="button"
                  onClick={() => setViewMode('select')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-35 hover:bg-[#1c2c45] border border-[#223552] text-slate-300 hover:text-white font-medium cursor-pointer transition-all"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Edit Selection</span>
                </button>

                <div className="text-xs text-slate-300 font-semibold px-2">
                  Showing {allCardsData.length} {allCardsData.length === 1 ? 'Fee Card' : 'Fee Cards'} (Scroll down to view all)
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadPdf}
                    className="px-3 py-1.5 rounded-lg bg-surface-35 hover:bg-[#1c2c45] border border-[#223552] text-slate-200 hover:text-white font-medium flex items-center gap-1.5 cursor-pointer transition-all"
                    id="btn-preview-download-pdf"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download PDF</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePrintToPrinter}
                    className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-1.5 shadow-md shadow-blue-600/30 cursor-pointer transition-all"
                    id="btn-preview-print-cards"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print</span>
                  </button>
                </div>
              </div>

              {/* Scrollable Fee Cards List (Each student card matches reference format, no rules page) */}
              <div className="space-y-8 max-w-4xl mx-auto" id="scrollable-fee-cards-list">
                {allCardsData.map((cardData, idx) => (
                  <div 
                    key={cardData.student.id} 
                    className="bg-white text-slate-900 rounded-xl p-5 shadow-2xl overflow-x-auto border border-slate-300 relative"
                    id={`preview-fee-card-${cardData.student.id}`}
                  >
                    <div className={isMinimalTemplate ? "border border-slate-900 p-4 relative" : "border-2 border-doc-deep p-3.5 relative"}>
                      <div className={isMinimalTemplate ? "p-1" : "border border-doc-deep p-3.5"}>
                        {/* Top Header Row */}
                        <div className={`flex items-center justify-between text-[11px] font-bold mb-1 ${isMinimalTemplate ? 'text-slate-900' : 'text-doc-deep'}`}>
                          <span>School NO- {cardData.schoolNo}</span>
                          <div className={`${isMinimalTemplate ? 'bg-slate-900' : 'bg-[#dc2626]'} text-white px-5 py-0.5 rounded-full text-xs font-black tracking-wider uppercase`}>
                            FEE CARD
                          </div>
                          <span>Affiliation No- {cardData.affiliationNo}</span>
                        </div>

                        {/* UDISE */}
                        <div className={`text-center text-[10px] font-bold mb-1 ${isMinimalTemplate ? 'text-slate-600' : 'text-doc-deep'}`}>
                          UDISE- {cardData.udiseNo}
                        </div>

                        {/* School Name */}
                        <div className="text-center mb-1 leading-tight">
                          <h1 className={`text-2xl sm:text-3xl font-black tracking-tight uppercase ${isMinimalTemplate ? 'text-slate-950 font-sans' : 'text-[#be1818] font-serif'}`}>
                            {cardData.schoolName}
                          </h1>
                          <p className={`text-[11px] italic ${isMinimalTemplate ? 'text-slate-600 font-sans' : 'text-[#991b1b] font-serif'}`}>
                            {cardData.trustName}
                          </p>
                        </div>

                        {/* Certification and Address */}
                        <div className="text-center text-[9px] text-slate-500 font-medium">
                          An ISO 9001:2015 Certified School
                        </div>
                        <div className="text-center text-[10px] font-bold text-slate-800">
                          {cardData.schoolAddress}
                        </div>

                        {/* Session Pill */}
                        <div className="flex justify-center my-2">
                          <div className={`px-6 py-0.5 border rounded-full text-[10px] font-bold ${isMinimalTemplate ? 'border-slate-900 text-slate-900' : 'border-doc-deep text-doc-deep'}`}>
                            Session : {cardData.academicSession}
                          </div>
                        </div>

                        {/* Member Info Grid */}
                        <div className="space-y-1.5 text-xs text-slate-800 my-3 font-medium">
                          <div className="flex items-baseline">
                            <span className="font-bold shrink-0 mr-2 text-slate-900">Name</span>
                            <div className="flex-1 border-b border-slate-400 font-bold text-slate-900 px-2 pb-0.5">
                              {cardData.student.name}
                            </div>
                          </div>

                          <div className="flex items-baseline">
                            <span className="font-bold shrink-0 mr-2 text-slate-900">Father&apos;s Name</span>
                            <div className="flex-1 border-b border-slate-400 text-slate-900 px-2 pb-0.5">
                              {cardData.fatherName}
                            </div>
                          </div>

                          <div className="flex items-baseline gap-4">
                            <div className="flex items-baseline flex-1">
                              <span className="font-bold shrink-0 mr-2 text-slate-900">Class</span>
                              <div className="flex-1 border-b border-slate-400 text-slate-900 px-2 pb-0.5">
                                {cardData.className}
                              </div>
                            </div>
                            <div className="flex items-baseline w-1/3">
                              <span className="font-bold shrink-0 mr-2 text-slate-900">Sec</span>
                              <div className="flex-1 border-b border-slate-400 text-slate-900 px-2 pb-0.5">
                                {cardData.section}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-baseline gap-4">
                            <div className="flex items-baseline flex-1">
                              <span className="font-bold shrink-0 mr-2 text-slate-900">Roll No.</span>
                              <div className="flex-1 border-b border-slate-400 text-slate-900 font-mono px-2 pb-0.5">
                                {cardData.rollNo}
                              </div>
                            </div>
                            <div className="flex items-baseline w-1/3">
                              <span className="font-bold shrink-0 mr-2 text-slate-900">A/c. No.</span>
                              <div className="flex-1 border-b border-slate-400 text-slate-900 font-mono px-2 pb-0.5">
                                {cardData.accountNo}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-baseline">
                            <span className="font-bold shrink-0 mr-2 text-slate-900">Address</span>
                            <div className="flex-1 border-b border-slate-400 text-slate-900 px-2 pb-0.5">
                              {cardData.address}
                            </div>
                          </div>

                          <div className="flex items-baseline">
                            <span className="font-bold shrink-0 mr-2 text-slate-900">Contact No.</span>
                            <div className="flex-1 border-b border-slate-400 text-slate-900 font-mono px-2 pb-0.5">
                              {cardData.phone}
                            </div>
                          </div>
                        </div>

                        {/* 12-Month Table */}
                        <div className="mt-3 overflow-x-auto">
                          <table className="w-full text-left text-[10px] border-collapse border border-[#2b5b84]">
                            <thead className="bg-[#d6e6f5] text-doc-deep font-bold uppercase text-[9px]">
                              <tr>
                                <th className="p-1.5 border border-doc">MONTH</th>
                                <th className="p-1.5 border border-doc text-center leading-tight">ADMISSION<br/>FEE</th>
                                <th className="p-1.5 border border-doc text-center leading-tight">ANNUAL<br/>FEE</th>
                                <th className="p-1.5 border border-doc text-center leading-tight">TUITION<br/>FEE</th>
                                <th className="p-1.5 border border-doc text-center leading-tight">CONVEY<br/>FEE</th>
                                <th className="p-1.5 border border-doc text-center">L.fine</th>
                                <th className="p-1.5 border border-doc text-center">ARREAR</th>
                                <th className="p-1.5 border border-doc text-center leading-tight">TOTAL AMT.<br/>PAYABLE</th>
                                <th className="p-1.5 border border-doc text-center leading-tight">AMOUNT<br/>PAID</th>
                                <th className="p-1.5 border border-doc text-center">DUES</th>
                                <th className="p-1.5 border border-doc text-center">REC. NO.</th>
                                <th className="p-1.5 border border-doc text-center leading-tight">SIGN &amp;<br/>DATE</th>
                              </tr>
                            </thead>
                            <tbody>
                              {cardData.months.map((row) => (
                                <tr key={row.month} className="hover:bg-slate-50 transition-colors">
                                  <td className="p-1 font-bold text-doc-deep border border-doc-soft whitespace-nowrap">
                                    {row.month}
                                  </td>
                                  {/* ZERO RULE: NOTHING IN BOX IF ZERO */}
                                  <td className="p-1 text-right font-mono border border-doc-soft">
                                    {formatOrBlank(row.admissionFee)}
                                  </td>
                                  <td className="p-1 text-right font-mono border border-doc-soft">
                                    {formatOrBlank(row.annualFee)}
                                  </td>
                                  <td className="p-1 text-right font-mono border border-doc-soft">
                                    {formatOrBlank(row.tuitionFee)}
                                  </td>
                                  <td className="p-1 text-right font-mono border border-doc-soft">
                                    {formatOrBlank(row.conveyFee)}
                                  </td>
                                  <td className="p-1 text-right font-mono border border-doc-soft">
                                    {formatOrBlank(row.lateFine)}
                                  </td>
                                  <td className="p-1 text-right font-mono border border-doc-soft">
                                    {formatOrBlank(row.arrear)}
                                  </td>
                                  <td className="p-1 text-right font-mono font-bold text-slate-900 border border-doc-soft">
                                    {formatOrBlank(row.totalPayable)}
                                  </td>
                                  <td className="p-1 text-right font-mono font-bold text-slate-900 border border-doc-soft">
                                    {formatOrBlank(row.amountPaid)}
                                  </td>
                                  <td className="p-1 text-right font-mono font-bold text-slate-900 border border-doc-soft">
                                    {formatOrBlank(row.dues)}
                                  </td>
                                  <td className="p-1 text-center font-mono text-slate-700 border border-doc-soft whitespace-nowrap">
                                    {row.receiptNo}
                                  </td>
                                  <td className="p-1 text-center font-mono text-slate-700 border border-doc-soft whitespace-nowrap">
                                    {row.signDate}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Authorised Signatory at Bottom Right */}
                        <div className="pt-8 pb-2 pr-4 flex justify-end">
                          <div className="text-center">
                            <div className="w-44 border-b border-dotted border-slate-700 mb-1.5" />
                            <span className="font-serif italic text-xs font-semibold text-slate-800">
                              Authorised Signatory
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-[#121a28] border-t border-edge-11 flex items-center justify-between text-xs no-print">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-edge-3 hover:bg-[#202e44] border border-edge-39 text-slate-300 hover:text-white font-medium cursor-pointer transition-all"
          >
            Close
          </button>

          {viewMode === 'preview' && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrintToPrinter}
                disabled={selectedStudentsList.length === 0}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                id="btn-footer-print"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print to Printer</span>
              </button>
            </div>
          )}
        </div>

        {/* ======================================================== */}
        {/* HIDDEN PRINT CONTAINER (Rendered ONLY during window.print()) */}
        {/* Strictly 1 page per student; NO rules page */}
        {/* ======================================================== */}
        <div className="hidden print:block font-sans text-slate-900 bg-white" id="fee-cards-print-container">
          {selectedStudentsList.map((st) => {
            const cData = buildStudentFeeCardData(st, classes, currentSchool);
            return (
              <div 
                key={`print-card-${st.id}`}
                className="p-6 bg-white text-slate-900 min-h-screen flex flex-col justify-between"
                style={{ pageBreakAfter: 'always', breakAfter: 'page' }}
              >
                <div className={isMinimalTemplate ? "border border-slate-900 p-3" : "border-2 border-doc-deep p-3"}>
                  <div className={isMinimalTemplate ? "p-1" : "border border-doc-deep p-3"}>
                    {/* Top Bar */}
                    <div className={`flex items-center justify-between text-[11px] font-bold mb-1 ${isMinimalTemplate ? 'text-slate-900' : 'text-doc-deep'}`}>
                      <span>School NO- {cData.schoolNo}</span>
                      <div className={`${isMinimalTemplate ? 'bg-slate-900' : 'bg-[#dc2626]'} text-white px-4 py-0.5 rounded-full text-xs font-black tracking-wider uppercase`}>
                        FEE CARD
                      </div>
                      <span>Affiliation No- {cData.affiliationNo}</span>
                    </div>

                    {/* UDISE */}
                    <div className={`text-center text-[10px] font-bold mb-1 ${isMinimalTemplate ? 'text-slate-600' : 'text-doc-deep'}`}>
                      UDISE- {cData.udiseNo}
                    </div>

                    {/* School Name */}
                    <div className="text-center mb-1 leading-tight">
                      <h1 className={`text-2xl font-black tracking-tight uppercase ${isMinimalTemplate ? 'text-slate-950 font-sans' : 'text-[#be1818] font-serif'}`}>
                        {cData.schoolName}
                      </h1>
                      <p className={`text-[10px] italic ${isMinimalTemplate ? 'text-slate-600 font-sans' : 'text-[#991b1b] font-serif'}`}>
                        {cData.trustName}
                      </p>
                    </div>

                    <div className="text-center text-[9px] text-slate-500 font-medium">
                      An ISO 9001:2015 Certified School
                    </div>
                    <div className="text-center text-[10px] font-bold text-slate-800">
                      {cData.schoolAddress}
                    </div>

                    {/* Session */}
                    <div className="flex justify-center my-1.5">
                      <div className={`px-5 py-0.5 border rounded-full text-[10px] font-bold ${isMinimalTemplate ? 'border-slate-900 text-slate-900' : 'border-doc-deep text-doc-deep'}`}>
                        Session : {cData.academicSession}
                      </div>
                    </div>

                    {/* Member Info */}
                    <div className="space-y-1 text-xs text-slate-800 my-2 font-medium">
                      <div className="flex items-baseline">
                        <span className="font-bold shrink-0 mr-2 text-slate-900">Name</span>
                        <div className="flex-1 border-b border-slate-400 font-bold text-slate-900 px-2">
                          {cData.student.name}
                        </div>
                      </div>

                      <div className="flex items-baseline">
                        <span className="font-bold shrink-0 mr-2 text-slate-900">Father&apos;s Name</span>
                        <div className="flex-1 border-b border-slate-400 text-slate-900 px-2">
                          {cData.fatherName}
                        </div>
                      </div>

                      <div className="flex items-baseline gap-4">
                        <div className="flex items-baseline flex-1">
                          <span className="font-bold shrink-0 mr-2 text-slate-900">Class</span>
                          <div className="flex-1 border-b border-slate-400 text-slate-900 px-2">
                            {cData.className}
                          </div>
                        </div>
                        <div className="flex items-baseline w-1/3">
                          <span className="font-bold shrink-0 mr-2 text-slate-900">Sec</span>
                          <div className="flex-1 border-b border-slate-400 text-slate-900 px-2">
                            {cData.section}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-baseline gap-4">
                        <div className="flex items-baseline flex-1">
                          <span className="font-bold shrink-0 mr-2 text-slate-900">Roll No.</span>
                          <div className="flex-1 border-b border-slate-400 text-slate-900 font-mono px-2">
                            {cData.rollNo}
                          </div>
                        </div>
                        <div className="flex items-baseline w-1/3">
                          <span className="font-bold shrink-0 mr-2 text-slate-900">A/c. No.</span>
                          <div className="flex-1 border-b border-slate-400 text-slate-900 font-mono px-2">
                            {cData.accountNo}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-baseline">
                        <span className="font-bold shrink-0 mr-2 text-slate-900">Address</span>
                        <div className="flex-1 border-b border-slate-400 text-slate-900 px-2">
                          {cData.address}
                        </div>
                      </div>

                      <div className="flex items-baseline">
                        <span className="font-bold shrink-0 mr-2 text-slate-900">Contact No.</span>
                        <div className="flex-1 border-b border-slate-400 text-slate-900 font-mono px-2">
                          {cData.phone}
                        </div>
                      </div>
                    </div>

                    {/* 12-Month Table */}
                    <table className="w-full text-left text-[9px] border-collapse border border-[#2b5b84] mt-2">
                      <thead className="bg-[#d6e6f5] text-doc-deep font-bold uppercase text-[8px]">
                        <tr>
                          <th className="p-1 border border-doc">MONTH</th>
                          <th className="p-1 border border-doc text-center leading-tight">ADMISSION<br/>FEE</th>
                          <th className="p-1 border border-doc text-center leading-tight">ANNUAL<br/>FEE</th>
                          <th className="p-1 border border-doc text-center leading-tight">TUITION<br/>FEE</th>
                          <th className="p-1 border border-doc text-center leading-tight">CONVEY<br/>FEE</th>
                          <th className="p-1 border border-doc text-center">L.fine</th>
                          <th className="p-1 border border-doc text-center">ARREAR</th>
                          <th className="p-1 border border-doc text-center leading-tight">TOTAL AMT.<br/>PAYABLE</th>
                          <th className="p-1 border border-doc text-center leading-tight">AMOUNT<br/>PAID</th>
                          <th className="p-1 border border-doc text-center">DUES</th>
                          <th className="p-1 border border-doc text-center">REC. NO.</th>
                          <th className="p-1 border border-doc text-center leading-tight">SIGN &amp;<br/>DATE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cData.months.map((row) => (
                          <tr key={row.month}>
                            <td className="p-1 font-bold text-doc-deep border border-doc-soft whitespace-nowrap">
                              {row.month}
                            </td>
                            <td className="p-1 text-right font-mono border border-doc-soft">
                              {formatOrBlank(row.admissionFee)}
                            </td>
                            <td className="p-1 text-right font-mono border border-doc-soft">
                              {formatOrBlank(row.annualFee)}
                            </td>
                            <td className="p-1 text-right font-mono border border-doc-soft">
                              {formatOrBlank(row.tuitionFee)}
                            </td>
                            <td className="p-1 text-right font-mono border border-doc-soft">
                              {formatOrBlank(row.conveyFee)}
                            </td>
                            <td className="p-1 text-right font-mono border border-doc-soft">
                              {formatOrBlank(row.lateFine)}
                            </td>
                            <td className="p-1 text-right font-mono border border-doc-soft">
                              {formatOrBlank(row.arrear)}
                            </td>
                            <td className="p-1 text-right font-mono font-bold text-slate-900 border border-doc-soft">
                              {formatOrBlank(row.totalPayable)}
                            </td>
                            <td className="p-1 text-right font-mono font-bold text-slate-900 border border-doc-soft">
                              {formatOrBlank(row.amountPaid)}
                            </td>
                            <td className="p-1 text-right font-mono font-bold text-slate-900 border border-doc-soft">
                              {formatOrBlank(row.dues)}
                            </td>
                            <td className="p-1 text-center font-mono text-slate-700 border border-doc-soft whitespace-nowrap">
                              {row.receiptNo}
                            </td>
                            <td className="p-1 text-center font-mono text-slate-700 border border-doc-soft whitespace-nowrap">
                              {row.signDate}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Authorised Signatory */}
                    <div className="pt-6 pb-2 pr-4 flex justify-end">
                      <div className="text-center">
                        <div className="w-40 border-b border-dotted border-slate-700 mb-1" />
                        <span className="font-serif italic text-xs font-semibold text-slate-800">
                          Authorised Signatory
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
