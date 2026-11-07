import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2, Calendar, ChevronDown, Check } from 'lucide-react';
import { Exam, ExamSubject, DEFAULT_GRADING_SCHEMA } from '../utils/examStore';
import { ClassInfo } from '../types';
import { DateTimePickerPopover } from './DateTimePickerPopover';

interface CreateExamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExamsCreated?: (exams: Exam[]) => void;
  onCreateExam?: (exams: Exam[]) => void;
  classes?: ClassInfo[];
  existingClasses?: ClassInfo[];
  createdBy?: string;
}

export const CreateExamModal: React.FC<CreateExamModalProps> = ({
  isOpen,
  onClose,
  onExamsCreated,
  onCreateExam,
  classes = [],
  existingClasses,
  createdBy = 'Demo school'
}) => {
  const effectiveClasses = classes && classes.length > 0 ? classes : (existingClasses || []);
  const [examName, setExamName] = useState('');
  
  // Multi-Class selection state: string array of class names
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [isClassDropdownOpen, setIsClassDropdownOpen] = useState(false);
  const [classSearch, setClassSearch] = useState('');

  // Per-class section selection mapping: className -> string[] of sections
  const [selectedClassSections, setSelectedClassSections] = useState<Record<string, string[]>>({});

  // Subject state
  const [subjectInput, setSubjectInput] = useState('');
  const [subjects, setSubjects] = useState<ExamSubject[]>([]);
  const subjectInputRef = useRef<HTMLInputElement>(null);

  // Active Date-Time Picker state (only for startDate)
  const [activePicker, setActivePicker] = useState<{
    subjectId: string;
    currentVal: string;
  } | null>(null);

  const [error, setError] = useState<string | null>(null);
  const classDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (classDropdownRef.current && !classDropdownRef.current.contains(e.target as Node)) {
        setIsClassDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter classes based on search
  const filteredClasses = (effectiveClasses || []).filter(c => 
    c.name.toLowerCase().includes(classSearch.toLowerCase())
  );

  // Toggle selection of a class
  const handleToggleClass = (clsName: string) => {
    const isSelected = selectedClasses.includes(clsName);
    if (isSelected) {
      // Unselect class
      setSelectedClasses(prev => prev.filter(c => c !== clsName));
      setSelectedClassSections(prev => {
        const next = { ...prev };
        delete next[clsName];
        return next;
      });
    } else {
      // Select class & default to all its available sections
      setSelectedClasses(prev => [...prev, clsName]);
      const clsObj = (effectiveClasses || []).find(c => c.name === clsName);
      const availableSecs = clsObj && clsObj.sections && clsObj.sections.length > 0 ? clsObj.sections : [];
      setSelectedClassSections(prev => ({
        ...prev,
        [clsName]: [...availableSecs]
      }));
    }
  };

  // Toggle selection of a specific section within a selected class
  const handleToggleSection = (clsName: string, sectionName: string) => {
    setSelectedClassSections(prev => {
      const currentSections = prev[clsName] || [];
      let updated: string[];
      if (currentSections.includes(sectionName)) {
        // Must keep at least one section selected or remove if multiple
        if (currentSections.length <= 1) {
          return prev; // do not allow 0 sections selected
        }
        updated = currentSections.filter(s => s !== sectionName);
      } else {
        updated = [...currentSections, sectionName];
      }
      return {
        ...prev,
        [clsName]: updated
      };
    });
  };

  // Select all / deselect all sections for a specific class
  const handleSelectAllSectionsForClass = (clsName: string) => {
    const clsObj = (effectiveClasses || []).find(c => c.name === clsName);
    const availableSecs = clsObj && clsObj.sections && clsObj.sections.length > 0 ? clsObj.sections : [];
    setSelectedClassSections(prev => ({
      ...prev,
      [clsName]: [...availableSecs]
    }));
  };

  const handleAddSubject = () => {
    const trimmed = subjectInput.trim();
    if (!trimmed) {
      subjectInputRef.current?.focus();
      return;
    }

    if (subjects.some(s => s.name.toLowerCase() === trimmed.toLowerCase())) {
      setError(`Subject "${trimmed}" is already added.`);
      subjectInputRef.current?.focus();
      return;
    }

    const defaultDateTime = '09/18/2026 09:00 AM';

    const newSub: ExamSubject = {
      id: `SUB-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: trimmed,
      startDate: defaultDateTime,
      totalMarks: 100,
      passingMarks: 33
    };

    setSubjects(prev => [...prev, newSub]);
    setSubjectInput('');
    setError(null);

    setTimeout(() => {
      subjectInputRef.current?.focus();
    }, 10);
  };

  const handleRemoveSubject = (id: string) => {
    setSubjects(prev => prev.filter(s => s.id !== id));
  };

  const handleOpenDatePicker = (subjectId: string) => {
    const sub = subjects.find(s => s.id === subjectId);
    const currentVal = (sub && sub.startDate) ? sub.startDate : '';
    setActivePicker({ subjectId, currentVal });
  };

  const handleDateTimeConfirm = (formattedDate: string) => {
    if (!activePicker) return;
    const { subjectId } = activePicker;
    setSubjects(prev => prev.map(s => s.id === subjectId ? { ...s, startDate: formattedDate } : s));
    setActivePicker(null);
  };

  // Submit and create a separate exam entry for EACH section in EACH selected class
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!examName.trim()) {
      setError('Please enter the exam name.');
      return;
    }
    if (selectedClasses.length === 0) {
      setError('Please select at least one class.');
      return;
    }
    if (subjects.length === 0) {
      setError('Please add at least one subject.');
      return;
    }

    // Verify each selected class has at least 1 section
    for (const cls of selectedClasses) {
      const secs = selectedClassSections[cls];
      if (!secs || secs.length === 0) {
        setError(`Please select at least one section for class ${cls}.`);
        return;
      }
    }

    const date = new Date();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const createdAtStr = `${String(date.getDate()).padStart(2, '0')} ${months[date.getMonth()]} ${date.getFullYear()}`;

    const createdExams: Exam[] = [];

    // Create a separate exam record for each class and section combination
    selectedClasses.forEach((clsName, clsIndex) => {
      const sections = selectedClassSections[clsName] || ['A'];
      sections.forEach((secName, secIndex) => {
        const uniqueId = `EXAM-${Date.now().toString(36).toUpperCase()}-${clsIndex}-${secIndex}`;
        
        // Deep copy subjects with individual IDs
        const examSubjects: ExamSubject[] = subjects.map((sub, sIdx) => ({
          ...sub,
          id: `SUB-${Date.now().toString(36)}-${clsIndex}${secIndex}${sIdx}`
        }));

        const newExam: Exam = {
          id: uniqueId,
          name: examName.trim(),
          class: clsName,
          section: secName,
          subjects: examSubjects,
          tags: [],
          createdAt: createdAtStr,
          createdTimestamp: Date.now() + (clsIndex * 10) + secIndex,
          createdBy,
          resultsCount: 0,
          studentMarks: {},
          gradingSchema: DEFAULT_GRADING_SCHEMA
        };

        createdExams.push(newExam);
      });
    });

    if (onExamsCreated) {
      onExamsCreated(createdExams);
    } else if (onCreateExam) {
      onCreateExam(createdExams);
    }
    handleReset();
    onClose();
  };

  const handleReset = () => {
    setExamName('');
    setSelectedClasses([]);
    setSelectedClassSections({});
    setClassSearch('');
    setSubjectInput('');
    setSubjects([]);
    setError(null);
  };

  if (!isOpen) return null;

  // Calculate total created entries count
  const totalEntriesCount = selectedClasses.reduce((acc, cls) => {
    const secs = selectedClassSections[cls] || [];
    return acc + (secs.length > 0 ? secs.length : 1);
  }, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="relative w-full max-w-xl bg-surface-8 border border-edge-21 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-white"
        onClick={e => e.stopPropagation()}
      >
        {/* Header: Clean title without any bulk tags */}
        <div className="flex items-center justify-between px-6 pt-5 pb-2">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Create New Exam
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Select classes & sections. A separate entry is created for each section.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-edge-12 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Minimal Form Content */}
        <form onSubmit={handleSubmit} className="p-6 pt-3 overflow-y-auto space-y-4 flex-1 custom-scrollbar">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400">
              {error}
            </div>
          )}

          {/* 1. Exam Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Exam Name
            </label>
            <input
              type="text"
              placeholder="e.g. Mid Term Exam 2026, Final Assessment"
              value={examName}
              onChange={e => setExamName(e.target.value)}
              className="w-full px-4 py-2.5 bg-surface-22 border border-edge-36 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* 2. Multiple Classes Selection (Searchable Dropdown + Selected Chips) */}
          <div className="relative" ref={classDropdownRef}>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Select Classes ({selectedClasses.length} selected)
              </label>
              {selectedClasses.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedClasses([]);
                    setSelectedClassSections({});
                  }}
                  className="text-[11px] text-slate-400 hover:text-rose-400 transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>

            <div className="relative">
              <input
                type="text"
                placeholder={selectedClasses.length > 0 ? "Search more classes to add/remove..." : "Search and select classes..."}
                value={classSearch}
                onFocus={() => setIsClassDropdownOpen(true)}
                onChange={e => {
                  setClassSearch(e.target.value);
                  setIsClassDropdownOpen(true);
                }}
                className="w-full pl-4 pr-10 py-2.5 bg-surface-22 border border-edge-36 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors cursor-text"
              />
              <button
                type="button"
                onClick={() => setIsClassDropdownOpen(!isClassDropdownOpen)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white cursor-pointer"
              >
                <ChevronDown className={`w-4 h-4 transition-transform ${isClassDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {/* Dropdown Menu */}
            {isClassDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-surface-22 border border-edge-36 rounded-xl shadow-2xl max-h-52 overflow-y-auto p-1 divide-y divide-[#1b2a40]">
                {filteredClasses.length > 0 ? (
                  filteredClasses.map(cls => {
                    const isSelected = selectedClasses.includes(cls.name);
                    return (
                      <button
                        key={cls.id || cls.name}
                        type="button"
                        onClick={() => handleToggleClass(cls.name)}
                        className={`w-full text-left px-3.5 py-2.5 text-xs rounded-lg flex items-center justify-between transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600/25 text-blue-300 font-semibold border border-blue-500/30'
                            : 'text-slate-300 hover:bg-[#18263c] hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded flex items-center justify-center border ${
                            isSelected ? 'bg-blue-600 border-blue-500 text-white' : 'border-[#334b70] bg-[#0c1422]'
                          }`}>
                            {isSelected && <Check className="w-3 h-3" />}
                          </div>
                          <span>{cls.name}</span>
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {cls.sections && cls.sections.length > 0 ? `${cls.sections.length} sec` : '1 sec'}
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <div className="px-3 py-2.5 text-xs text-slate-500 text-center">
                    No classes found matching "{classSearch}"
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 3. Sections Inside Each Selected Class */}
          {selectedClasses.length === 0 ? (
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Sections
              </label>
              <input
                type="text"
                disabled
                placeholder="Select classes first to choose sections"
                className="w-full px-4 py-2.5 bg-[#101826]/70 border border-[#1c2a40] rounded-xl text-slate-500 text-xs placeholder-slate-600 cursor-not-allowed"
              />
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Configure Sections for Each Class
                </label>
                <span className="text-[11px] text-blue-400 font-medium">
                  {totalEntriesCount} separate exam {totalEntriesCount === 1 ? 'entry' : 'entries'} will be created
                </span>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                {selectedClasses.map(clsName => {
                  const clsObj = (effectiveClasses || []).find(c => c.name === clsName);
                  const availableSecs = (clsObj && clsObj.sections && clsObj.sections.length > 0)
                    ? clsObj.sections
                    : [];
                  const chosenSecs = selectedClassSections[clsName] || [];

                  return (
                    <div
                      key={clsName}
                      className="p-3 bg-[#111b2c] border border-[#20324c] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-white bg-blue-600/20 px-2.5 py-1 rounded-lg border border-blue-500/30">
                          {clsName}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          ({chosenSecs.length} {chosenSecs.length === 1 ? 'section' : 'sections'})
                        </span>
                      </div>

                      {/* Section Chips */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {availableSecs.map(sec => {
                          const isSecSelected = chosenSecs.includes(sec);
                          return (
                            <button
                              key={sec}
                              type="button"
                              onClick={() => handleToggleSection(clsName, sec)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                                isSecSelected
                                  ? 'bg-blue-600 text-white shadow-xs'
                                  : 'bg-[#18263c] text-slate-400 hover:text-slate-200 border border-[#223552]'
                              }`}
                            >
                              {isSecSelected && <Check className="w-3 h-3" />}
                              <span>Sec {sec}</span>
                            </button>
                          );
                        })}

                        {/* Quick toggle all sections for this class */}
                        {availableSecs.length > 1 && chosenSecs.length < availableSecs.length && (
                          <button
                            type="button"
                            onClick={() => handleSelectAllSectionsForClass(clsName)}
                            className="text-[10px] text-blue-400 hover:text-blue-300 ml-1 underline cursor-pointer"
                          >
                            All
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4. Subjects & Exam Date & Time (Start Date Only - No End Date) */}
          <div className="space-y-2.5 pt-1">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Subjects &amp; Schedule
            </label>
            
            {/* Subject Input with Add button */}
            <div className="flex gap-2">
              <input
                ref={subjectInputRef}
                type="text"
                placeholder="Enter subject name (e.g. English, Math, Science)..."
                value={subjectInput}
                onChange={e => setSubjectInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSubject();
                  }
                }}
                className="flex-1 px-4 py-2.5 bg-surface-22 border border-edge-36 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
              <button
                type="button"
                onClick={handleAddSubject}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>

            {/* Added Subject Cards */}
            {subjects.length > 0 && (
              <div className="space-y-2.5 pt-1">
                {subjects.map(sub => (
                  <div
                    key={sub.id}
                    className="p-3 bg-surface-22 border border-edge-21 rounded-xl flex items-center justify-between gap-3 transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white uppercase">{sub.name}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        Max: {sub.totalMarks}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Date & Time field (Only Exam Date/Time - No End Date) */}
                      <div 
                        onClick={() => handleOpenDatePicker(sub.id)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-[#0d1522] border border-edge-32 hover:border-blue-500/60 rounded-xl cursor-pointer transition-colors"
                        title="Change exam date and time"
                      >
                        <Calendar className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        <span className="text-xs text-slate-200 font-medium">
                          {sub.startDate || 'MM/DD/YYYY hh:mm aa'}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveSubject(sub.id)}
                        className="text-slate-400 hover:text-rose-400 transition-colors p-1.5 rounded-lg hover:bg-rose-500/10 cursor-pointer"
                        title="Remove Subject"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Summary info alert before creation */}
          {selectedClasses.length > 0 && (
            <div className="p-3 bg-[#111b2b] border border-[#1d2e47] rounded-xl text-xs text-slate-300 flex items-center justify-between">
              <span>
                Ready to create <strong className="text-white">{totalEntriesCount} separate {totalEntriesCount === 1 ? 'exam' : 'exams'}</strong> across {selectedClasses.length} {selectedClasses.length === 1 ? 'class' : 'classes'}.
              </span>
              <span className="text-[11px] text-emerald-400 font-medium">
                Editable anytime before marks submission
              </span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-edge-12">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-white hover:bg-slate-100 text-slate-900 text-xs sm:text-sm font-bold rounded-xl transition-all shadow-md active:scale-95 cursor-pointer"
            >
              {totalEntriesCount > 1 ? `Create ${totalEntriesCount} Exams` : 'Create Exam'}
            </button>
          </div>
        </form>
      </div>

      {/* DateTimePicker Popover */}
      {activePicker && (
        <DateTimePickerPopover
          isOpen={true}
          initialValue={activePicker.currentVal}
          onSelect={handleDateTimeConfirm}
          onClose={() => setActivePicker(null)}
        />
      )}
    </div>
  );
};
