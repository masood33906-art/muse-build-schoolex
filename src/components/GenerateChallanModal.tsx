import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Building2, 
  Users, 
  User, 
  Calendar, 
  CreditCard, 
  CheckCircle2, 
  Printer, 
  Download, 
  Search, 
  Filter, 
  AlertCircle, 
  X, 
  ChevronRight, 
  ChevronLeft, 
  FileText,
  Check,
  RotateCcw
} from 'lucide-react';
import { Student } from '../types';
import { FamilyFeeSummary, StudentFeeData, formatPKR } from '../utils/feeHelper';
import { 
  GeneratedChallan, 
  getGeneratedChallans, 
  saveGeneratedChallans, 
  isChallanAlreadyGenerated 
} from '../utils/challanStore';
import { getBankSettings } from '../utils/settingsHelper';

interface GenerateChallanModalProps {
  isOpen: boolean;
  onClose: () => void;
  families: FamilyFeeSummary[];
  students: Student[];
  onShowToast: (message: string, type?: 'success' | 'info' | 'error') => void;
  onOpenChallanView?: (challans: GeneratedChallan[]) => void;
}

type ScopeType = 'full' | 'family' | 'student';

interface FeeRangeOption {
  id: string;
  label: string;
  advanceMonths: number;
  description: string;
}

const FEE_RANGE_OPTIONS: FeeRangeOption[] = [
  { id: 'current', label: 'Current Due Only', advanceMonths: 0, description: 'Only currently unpaid & remaining dues' },
  { id: '1m', label: 'Next 1 Month', advanceMonths: 1, description: 'Current due + 1 month advance tuition' },
  { id: '2m', label: 'Next 2 Months', advanceMonths: 2, description: 'Current due + 2 months advance tuition' },
  { id: '3m', label: 'Next 3 Months (Quarterly)', advanceMonths: 3, description: 'Current due + 3 months quarterly fee' },
  { id: '4m', label: 'Next 4 Months', advanceMonths: 4, description: 'Current due + 4 months advance tuition' },
  { id: '5m', label: 'Next 5 Months', advanceMonths: 5, description: 'Current due + 5 months advance tuition' },
  { id: '6m', label: 'Next 6 Months (Half-Yearly)', advanceMonths: 6, description: 'Current due + 6 months half-yearly fee' },
  { id: '1y', label: '1 Year (Annual Advance)', advanceMonths: 12, description: 'Current due + 12 months full annual fee' },
];

export const GenerateChallanModal: React.FC<GenerateChallanModalProps> = ({
  isOpen,
  onClose,
  families,
  students,
  onShowToast,
  onOpenChallanView
}) => {
  // 1. Current Step: 1 (Scope) -> 2 (Fee Range) -> 3 (Selection) -> 4 (Confirm) -> 5 (Download)
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [scope, setScope] = useState<ScopeType>('student');
  const [selectedFeeRange, setSelectedFeeRange] = useState<string>('current');

  // Selection states
  const [selectedFamilyIds, setSelectedFamilyIds] = useState<Set<string>>(new Set());
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all');

  // Confirmation Dates (Defaulting to current date 15 Sep 2026 / today)
  const [issueDate, setIssueDate] = useState<string>('2026-09-15');
  const [dueDate, setDueDate] = useState<string>('2026-09-25');
  const [validityDate, setValidityDate] = useState<string>('2026-09-30');
  const [notes, setNotes] = useState<string>('Please deposit fee in Meezan Bank before due date.');

  // Generated results
  const [newlyGeneratedChallans, setNewlyGeneratedChallans] = useState<GeneratedChallan[]>([]);

  // Bank settings
  const bankSettings = useMemo(() => getBankSettings(), [isOpen]);

  // Reset or initialize on open
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
      setScope('student');
      setSelectedFeeRange('current');
      setSelectedFamilyIds(new Set());
      setSelectedStudentIds(new Set());
      setSearchQuery('');
      setNewlyGeneratedChallans([]);
    }
  }, [isOpen]);

  // Unique Classes list
  const classesList = useMemo(() => {
    const set = new Set<string>();
    students.forEach(s => {
      if (s.class) set.add(s.class);
    });
    return Array.from(set).sort();
  }, [students]);

  // Map student fee data
  const studentFeeMap = useMemo(() => {
    const map = new Map<string, { totalDue: number; phone: string; family: string; familyId: string }>();
    students.forEach(s => {
      // Find default fee or family due
      const fam = families.find(f => f.familyId === s.familyId);
      const studentCount = fam ? Math.max(1, fam.students.length) : 1;
      const computedDue = fam ? Math.round(fam.totalDue / studentCount) : 5000;
      map.set(s.id, {
        totalDue: computedDue > 0 ? computedDue : 3500,
        phone: s.phone || fam?.phone || '',
        family: s.family || fam?.familyName || 'Family',
        familyId: s.familyId || 'F0000'
      });
    });
    return map;
  }, [students, families]);

  // Filtered Families for Step 3
  const filteredFamilies = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return families.filter(f => {
      if (!q) return true;
      return (
        f.familyName.toLowerCase().includes(q) ||
        f.familyId.toLowerCase().includes(q) ||
        f.phone.toLowerCase().includes(q)
      );
    });
  }, [families, searchQuery]);

  // Filtered Students for Step 3
  const filteredStudents = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return students.filter(s => {
      const matchesClass = selectedClassFilter === 'all' || s.class === selectedClassFilter;
      if (!matchesClass) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        (s.family && s.family.toLowerCase().includes(q)) ||
        (s.phone && s.phone.toLowerCase().includes(q))
      );
    });
  }, [students, searchQuery, selectedClassFilter]);

  // Calculate amount multiplier from Fee Range
  const activeFeeOption = useMemo(() => {
    return FEE_RANGE_OPTIONS.find(o => o.id === selectedFeeRange) || FEE_RANGE_OPTIONS[0];
  }, [selectedFeeRange]);

  const calculateTargetAmount = useCallback((baseAmount: number) => {
    if (activeFeeOption.advanceMonths === 0) return baseAmount;
    // Advance estimate: Base + monthly tuition (approx base / 1.5 * advanceMonths)
    const monthlyTuition = Math.max(2000, Math.round(baseAmount > 0 ? baseAmount : 4000));
    return baseAmount + (monthlyTuition * activeFeeOption.advanceMonths);
  }, [activeFeeOption]);

  // Handle Ctrl+A / Cmd+A selection inside Step 3
  useEffect(() => {
    if (!isOpen || currentStep !== 3) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        const target = e.target as HTMLElement;
        // If typing inside an input/textarea, do not intercept
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

        e.preventDefault();

        if (scope === 'family') {
          // Select all non-already generated families in filtered list
          const next = new Set<string>();
          filteredFamilies.forEach(fam => {
            const calculatedAmount = calculateTargetAmount(fam.totalDue);
            const alreadyGen = isChallanAlreadyGenerated(fam.familyId, calculatedAmount);
            if (!alreadyGen) {
              next.add(fam.familyId);
            }
          });
          setSelectedFamilyIds(next);
          onShowToast(`Selected all ${next.size} eligible families (Ctrl+A)`, 'info');
        } else if (scope === 'student') {
          // Select all non-already generated students in filtered list
          const next = new Set<string>();
          filteredStudents.forEach(st => {
            const feeInfo = studentFeeMap.get(st.id);
            const calculatedAmount = calculateTargetAmount(feeInfo?.totalDue || 4000);
            const alreadyGen = isChallanAlreadyGenerated(st.id, calculatedAmount);
            if (!alreadyGen) {
              next.add(st.id);
            }
          });
          setSelectedStudentIds(next);
          onShowToast(`Selected all ${next.size} eligible students (Ctrl+A)`, 'info');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentStep, scope, filteredFamilies, filteredStudents, calculateTargetAmount, studentFeeMap, onShowToast]);

  // Toggle selection functions
  const toggleFamilySelection = (familyId: string, amount: number) => {
    const alreadyGen = isChallanAlreadyGenerated(familyId, amount);
    if (alreadyGen) {
      onShowToast(`Challan #${alreadyGen.challanNumber} already generated for this amount! It can be downloaded from Print section.`, 'error');
      return;
    }
    setSelectedFamilyIds(prev => {
      const next = new Set(prev);
      if (next.has(familyId)) next.delete(familyId);
      else next.add(familyId);
      return next;
    });
  };

  const toggleStudentSelection = (studentId: string, amount: number) => {
    const alreadyGen = isChallanAlreadyGenerated(studentId, amount);
    if (alreadyGen) {
      onShowToast(`Challan #${alreadyGen.challanNumber} already generated for this student! It can be downloaded from Print section.`, 'error');
      return;
    }
    setSelectedStudentIds(prev => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  };

  // Select all toggles
  const handleToggleSelectAll = () => {
    if (scope === 'family') {
      if (selectedFamilyIds.size > 0) {
        setSelectedFamilyIds(new Set());
      } else {
        const next = new Set<string>();
        filteredFamilies.forEach(f => {
          const amt = calculateTargetAmount(f.totalDue);
          if (!isChallanAlreadyGenerated(f.familyId, amt)) {
            next.add(f.familyId);
          }
        });
        setSelectedFamilyIds(next);
      }
    } else if (scope === 'student') {
      if (selectedStudentIds.size > 0) {
        setSelectedStudentIds(new Set());
      } else {
        const next = new Set<string>();
        filteredStudents.forEach(s => {
          const feeInfo = studentFeeMap.get(s.id);
          const amt = calculateTargetAmount(feeInfo?.totalDue || 4000);
          if (!isChallanAlreadyGenerated(s.id, amt)) {
            next.add(s.id);
          }
        });
        setSelectedStudentIds(next);
      }
    }
  };

  // Compile list of targets for Step 4 (Confirm)
  const confirmList = useMemo(() => {
    if (scope === 'full') {
      return families
        .filter(f => f.totalDue > 0)
        .map(f => {
          const amt = calculateTargetAmount(f.totalDue);
          const already = isChallanAlreadyGenerated(f.familyId, amt);
          return {
            targetId: f.familyId,
            targetName: f.familyName,
            type: 'family' as const,
            phone: f.phone,
            className: f.students.map(s => s.class).join(', '),
            students: f.students,
            amount: amt,
            alreadyGenerated: already
          };
        });
    }

    if (scope === 'family') {
      return families
        .filter(f => selectedFamilyIds.has(f.familyId))
        .map(f => {
          const amt = calculateTargetAmount(f.totalDue);
          const already = isChallanAlreadyGenerated(f.familyId, amt);
          return {
            targetId: f.familyId,
            targetName: f.familyName,
            type: 'family' as const,
            phone: f.phone,
            className: f.students.map(s => s.class).join(', '),
            students: f.students,
            amount: amt,
            alreadyGenerated: already
          };
        });
    }

    if (scope === 'student') {
      return students
        .filter(s => selectedStudentIds.has(s.id))
        .map(s => {
          const feeInfo = studentFeeMap.get(s.id);
          const amt = calculateTargetAmount(feeInfo?.totalDue || 4000);
          const already = isChallanAlreadyGenerated(s.id, amt);
          return {
            targetId: s.id,
            targetName: s.name,
            type: 'student' as const,
            phone: feeInfo?.phone || s.phone || '',
            className: `${s.class} - ${s.section}`,
            students: [s],
            amount: amt,
            alreadyGenerated: already
          };
        });
    }

    return [];
  }, [scope, families, students, selectedFamilyIds, selectedStudentIds, calculateTargetAmount, studentFeeMap]);

  // Execute Generation
  const handleExecuteGenerate = () => {
    const eligibleToGenerate = confirmList.filter(item => !item.alreadyGenerated);

    if (eligibleToGenerate.length === 0) {
      onShowToast('All selected items already have active challans generated for this amount!', 'info');
      return;
    }

    const formatDateStr = (dStr: string) => {
      try {
        const d = new Date(dStr);
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      } catch {
        return dStr;
      }
    };

    const formattedIssue = formatDateStr(issueDate);
    const formattedDue = formatDateStr(dueDate);
    const formattedValid = formatDateStr(validityDate);

    const generated: GeneratedChallan[] = eligibleToGenerate.map(item => {
      const cleanNum = item.targetId.replace(/[^a-zA-Z0-9]/g, '');
      const challanNumber = `CHL-2026-${cleanNum.padStart(5, '0')}`;

      return {
        id: `CHL-${item.targetId}-${Date.now()}`,
        challanNumber,
        targetType: item.type,
        targetId: item.targetId,
        targetName: item.targetName,
        familyId: item.type === 'family' ? item.targetId : (item.students[0]?.familyId || 'F0000'),
        studentIds: item.students.map(s => s.id),
        studentNames: item.students.map(s => s.name),
        className: item.className,
        phone: item.phone,
        amount: item.amount,
        feeRange: activeFeeOption.label,
        issueDate: formattedIssue,
        dueDate: formattedDue,
        validityDate: formattedValid,
        generatedAt: new Date().toISOString(),
        status: 'Generated'
      };
    });

    saveGeneratedChallans(generated);
    setNewlyGeneratedChallans(generated);
    setCurrentStep(5);
    onShowToast(`Successfully generated ${generated.length} official fee challan(s)!`, 'success');
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      id="modal-generate-challans-wizard"
    >
      <div 
        className="w-full max-w-4xl bg-[#0f1725] border border-[#20314b] rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-100 max-h-[92vh] animate-in zoom-in-95 duration-200"
      >
        {/* Top Header matching Image 1: Title on left, Next / Action on right */}
        <div className="px-6 py-4 bg-[#141e30] border-b border-[#1f2e46] flex items-center justify-between">
          <h2 className="text-base font-bold text-white tracking-tight">
            Generate Challans
          </h2>

          <div className="flex items-center gap-2.5">
            {currentStep > 1 && currentStep < 5 && (
              <button
                type="button"
                onClick={() => setCurrentStep(prev => prev - 1)}
                className="px-3.5 py-1.5 rounded-lg bg-[#19263a] hover:bg-[#23354f] text-slate-300 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            )}

            {currentStep < 4 && (
              <button
                type="button"
                onClick={() => {
                  if (currentStep === 3) {
                    if (scope === 'family' && selectedFamilyIds.size === 0) {
                      onShowToast('Please select at least one family to continue', 'error');
                      return;
                    }
                    if (scope === 'student' && selectedStudentIds.size === 0) {
                      onShowToast('Please select at least one student to continue', 'error');
                      return;
                    }
                  }
                  setCurrentStep(prev => prev + 1);
                }}
                className="px-5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-900 text-xs font-bold transition-all shadow cursor-pointer flex items-center gap-1"
                id="btn-wizard-next"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}

            {currentStep === 4 && (
              <button
                type="button"
                onClick={handleExecuteGenerate}
                className="px-5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md shadow-blue-600/30 cursor-pointer flex items-center gap-1.5"
                id="btn-wizard-confirm-generate"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Confirm &amp; Generate</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1f2b3e] transition-colors cursor-pointer"
              id="btn-wizard-close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Stepper matching Image 1: 1 (Scope) -> 2 (Fee Range) -> 3 (Selection) -> 4 (Confirm) -> 5 (Download) */}
        <div className="px-6 py-3.5 bg-[#101927] border-b border-[#1c2a3e]">
          <div className="max-w-2xl mx-auto flex items-center justify-between relative">
            {/* Connecting line */}
            <div className="absolute left-6 right-6 top-3.5 h-[2px] bg-[#1d2a3f] -z-0" />

            {[
              { num: 1, label: 'Scope' },
              { num: 2, label: 'Fee Range' },
              { num: 3, label: 'Selection' },
              { num: 4, label: 'Confirm' },
              { num: 5, label: 'Download' }
            ].map(step => {
              const isActive = currentStep === step.num;
              const isPast = currentStep > step.num;

              return (
                <div key={step.num} className="flex flex-col items-center relative z-10">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/40 ring-4 ring-blue-600/20'
                        : isPast
                        ? 'bg-emerald-600 text-white'
                        : 'bg-[#182335] text-slate-400 border border-[#2b3c54]'
                    }`}
                  >
                    {isPast ? <Check className="w-3.5 h-3.5" /> : step.num}
                  </div>
                  <span
                    className={`text-[11px] font-medium mt-1.5 ${
                      isActive ? 'text-blue-400 font-bold' : isPast ? 'text-slate-300' : 'text-slate-500'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Body Content */}
        <div className="p-6 overflow-y-auto flex-1 bg-[#0c1421]">
          {/* STEP 1: SCOPE SELECTION (Matching Image 1: 3 cards Full School, By Family, By Student) */}
          {currentStep === 1 && (
            <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-150">
              <div className="text-center mb-6">
                <h3 className="text-base font-bold text-white">Select Generation Scope</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Choose whether to generate challans for the entire school, specific families, or individual students.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. Full School Card */}
                <button
                  type="button"
                  onClick={() => setScope('full')}
                  className={`p-6 rounded-2xl flex flex-col items-center text-center transition-all cursor-pointer ${
                    scope === 'full'
                      ? 'border-2 border-blue-500 bg-blue-950/20 shadow-lg shadow-blue-600/10'
                      : 'border border-[#20314b] bg-[#141e30] hover:bg-[#182438] hover:border-slate-600'
                  }`}
                  id="card-scope-full"
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${
                    scope === 'full' ? 'bg-blue-500/20 text-blue-400' : 'bg-[#1f2e46] text-slate-400'
                  }`}>
                    <Building2 className="w-6 h-6" />
                  </div>
                  <h4 className={`text-sm font-bold mb-1 ${scope === 'full' ? 'text-white' : 'text-slate-200'}`}>
                    Full School
                  </h4>
                  <p className="text-xs text-slate-400">
                    All families with dues
                  </p>
                </button>

                {/* 2. By Family Card */}
                <button
                  type="button"
                  onClick={() => setScope('family')}
                  className={`p-6 rounded-2xl flex flex-col items-center text-center transition-all cursor-pointer ${
                    scope === 'family'
                      ? 'border-2 border-blue-500 bg-blue-950/20 shadow-lg shadow-blue-600/10'
                      : 'border border-[#20314b] bg-[#141e30] hover:bg-[#182438] hover:border-slate-600'
                  }`}
                  id="card-scope-family"
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${
                    scope === 'family' ? 'bg-blue-500/20 text-blue-400' : 'bg-[#1f2e46] text-slate-400'
                  }`}>
                    <Users className="w-6 h-6" />
                  </div>
                  <h4 className={`text-sm font-bold mb-1 ${scope === 'family' ? 'text-white' : 'text-slate-200'}`}>
                    By Family
                  </h4>
                  <p className="text-xs text-slate-400">
                    Select specific families
                  </p>
                </button>

                {/* 3. By Student Card */}
                <button
                  type="button"
                  onClick={() => setScope('student')}
                  className={`p-6 rounded-2xl flex flex-col items-center text-center transition-all cursor-pointer ${
                    scope === 'student'
                      ? 'border-2 border-blue-500 bg-blue-950/20 shadow-lg shadow-blue-600/10'
                      : 'border border-[#20314b] bg-[#141e30] hover:bg-[#182438] hover:border-slate-600'
                  }`}
                  id="card-scope-student"
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${
                    scope === 'student' ? 'bg-blue-500/20 text-blue-400' : 'bg-[#1f2e46] text-slate-400'
                  }`}>
                    <User className="w-6 h-6" />
                  </div>
                  <h4 className={`text-sm font-bold mb-1 ${scope === 'student' ? 'text-blue-400' : 'text-slate-200'}`}>
                    By Student
                  </h4>
                  <p className="text-xs text-slate-400">
                    Select individual students
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: FEE RANGE (Current Due Only, or Next 1, 2, 3, 4, 5, 6 months, or 1 year) */}
          {currentStep === 2 && (
            <div className="max-w-3xl mx-auto space-y-5 animate-in fade-in duration-150">
              <div className="text-center mb-4">
                <h3 className="text-base font-bold text-white">Select Billing &amp; Fee Range</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Specify whether to bill current dues only or include advance monthly/quarterly/annual fee periods.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {FEE_RANGE_OPTIONS.map(opt => {
                  const isSelected = selectedFeeRange === opt.id;
                  return (
                    <div
                      key={opt.id}
                      onClick={() => setSelectedFeeRange(opt.id)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                        isSelected
                          ? 'border-blue-500 bg-blue-950/30 ring-1 ring-blue-500/40'
                          : 'border-[#20314b] bg-[#141e30] hover:bg-[#182438]'
                      }`}
                    >
                      <div className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                        isSelected ? 'border-blue-500 bg-blue-500' : 'border-slate-500'
                      }`}>
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                            {opt.label}
                          </span>
                          {opt.id === 'current' && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              Default
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                          {opt.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 3: SELECTION (Family or Student with search, Ctrl+A to select all, and duplicate checks) */}
          {currentStep === 3 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {scope === 'full' ? (
                <div className="max-w-xl mx-auto p-6 bg-[#131d2d] border border-[#22334e] rounded-2xl text-center space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center mx-auto">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-white">Full School Scope Selected</h4>
                  <p className="text-xs text-slate-400">
                    All families with active outstanding dues will be automatically gathered.
                  </p>
                  <div className="p-3 bg-[#182335] rounded-xl border border-[#26374f] text-xs flex justify-around">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Total Families with Dues</span>
                      <strong className="text-white text-sm">{families.filter(f => f.totalDue > 0).length}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Fee Range</span>
                      <strong className="text-blue-400 text-sm">{activeFeeOption.label}</strong>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Search and Filter Controls */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#121c2c] p-3 rounded-xl border border-[#20314a]">
                    <div className="flex items-center gap-2 flex-1">
                      <div className="relative flex-1">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder={
                            scope === 'family'
                              ? 'Search family by name, ID (e.g. F-0009), or phone...'
                              : 'Search student by name, ID (e.g. S0087), or roll number...'
                          }
                          className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-[#0e1624] border border-[#24354e] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      {scope === 'student' && (
                        <select
                          value={selectedClassFilter}
                          onChange={(e) => setSelectedClassFilter(e.target.value)}
                          className="px-2.5 py-1.5 rounded-lg bg-[#0e1624] border border-[#24354e] text-xs text-slate-300 focus:outline-none focus:border-blue-500"
                        >
                          <option value="all">All Classes</option>
                          {classesList.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Keyboard shortcut hint badge */}
                      <span className="text-[11px] text-slate-400 flex items-center gap-1 bg-[#19263a] px-2 py-1 rounded-md border border-[#253750]">
                        <kbd className="px-1 py-0.5 text-[9px] font-mono bg-slate-800 text-slate-200 rounded border border-slate-700">
                          Ctrl+A
                        </kbd>
                        <span>to select all</span>
                      </span>

                      {/* Select all toggle button */}
                      <button
                        type="button"
                        onClick={handleToggleSelectAll}
                        className="px-3 py-1.5 rounded-lg bg-[#1a273b] hover:bg-[#23354f] text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        {(scope === 'family' ? selectedFamilyIds.size : selectedStudentIds.size) > 0
                          ? 'Deselect All'
                          : 'Select All'}
                      </button>
                    </div>
                  </div>

                  {/* List / Table of Families or Students */}
                  <div className="rounded-xl border border-[#20314a] overflow-hidden bg-[#101827]">
                    <div className="max-h-[42vh] overflow-y-auto">
                      {scope === 'family' ? (
                        <table className="w-full text-left text-xs">
                          <thead className="bg-[#141f31] text-[10px] text-slate-400 uppercase font-semibold tracking-wider sticky top-0 z-10 border-b border-[#1e2e45]">
                            <tr>
                              <th className="py-2.5 px-3 w-10">
                                <input
                                  type="checkbox"
                                  checked={selectedFamilyIds.size > 0 && selectedFamilyIds.size === filteredFamilies.length}
                                  onChange={handleToggleSelectAll}
                                  className="rounded border-slate-700 text-blue-600 focus:ring-0"
                                />
                              </th>
                              <th className="py-2.5 px-3">Family / Guardian</th>
                              <th className="py-2.5 px-3">Family ID</th>
                              <th className="py-2.5 px-3">Phone</th>
                              <th className="py-2.5 px-3">Students</th>
                              <th className="py-2.5 px-3 text-right">Calculated Due</th>
                              <th className="py-2.5 px-3 text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#1b273b]">
                            {filteredFamilies.map(fam => {
                              const calculatedAmount = calculateTargetAmount(fam.totalDue);
                              const alreadyGen = isChallanAlreadyGenerated(fam.familyId, calculatedAmount);
                              const isChecked = selectedFamilyIds.has(fam.familyId);

                              return (
                                <tr 
                                  key={fam.familyId}
                                  onClick={() => toggleFamilySelection(fam.familyId, calculatedAmount)}
                                  className={`transition-colors cursor-pointer ${
                                    alreadyGen
                                      ? 'bg-slate-900/40 opacity-70 hover:opacity-90'
                                      : isChecked
                                      ? 'bg-blue-950/30'
                                      : 'hover:bg-[#152033]'
                                  }`}
                                >
                                  <td className="py-2.5 px-3" onClick={(e) => e.stopPropagation()}>
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      disabled={Boolean(alreadyGen)}
                                      onChange={() => toggleFamilySelection(fam.familyId, calculatedAmount)}
                                      className="rounded border-slate-700 text-blue-600 focus:ring-0 disabled:opacity-30"
                                    />
                                  </td>
                                  <td className="py-2.5 px-3 font-semibold text-white">
                                    {fam.familyName}
                                  </td>
                                  <td className="py-2.5 px-3 font-mono text-slate-400">
                                    {fam.familyId}
                                  </td>
                                  <td className="py-2.5 px-3 font-mono text-slate-400">
                                    {fam.phone}
                                  </td>
                                  <td className="py-2.5 px-3 text-slate-300">
                                    {fam.students.length} child{fam.students.length > 1 ? 'ren' : ''}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-bold text-red-400">
                                    {formatPKR(calculatedAmount)}
                                  </td>
                                  <td className="py-2.5 px-3 text-center">
                                    {alreadyGen ? (
                                      <span 
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                                        title={`Already generated on ${alreadyGen.issueDate}. Use Print to view.`}
                                      >
                                        <CheckCircle2 className="w-3 h-3" />
                                        {alreadyGen.challanNumber}
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-slate-500">
                                        Ready
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      ) : (
                        <table className="w-full text-left text-xs">
                          <thead className="bg-[#141f31] text-[10px] text-slate-400 uppercase font-semibold tracking-wider sticky top-0 z-10 border-b border-[#1e2e45]">
                            <tr>
                              <th className="py-2.5 px-3 w-10">
                                <input
                                  type="checkbox"
                                  checked={selectedStudentIds.size > 0 && selectedStudentIds.size === filteredStudents.length}
                                  onChange={handleToggleSelectAll}
                                  className="rounded border-slate-700 text-blue-600 focus:ring-0"
                                />
                              </th>
                              <th className="py-2.5 px-3">Student Name</th>
                              <th className="py-2.5 px-3">ID</th>
                              <th className="py-2.5 px-3">Class &amp; Sec</th>
                              <th className="py-2.5 px-3">Family / Guardian</th>
                              <th className="py-2.5 px-3 text-right">Calculated Fee</th>
                              <th className="py-2.5 px-3 text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#1b273b]">
                            {filteredStudents.map(st => {
                              const feeInfo = studentFeeMap.get(st.id);
                              const calculatedAmount = calculateTargetAmount(feeInfo?.totalDue || 4000);
                              const alreadyGen = isChallanAlreadyGenerated(st.id, calculatedAmount);
                              const isChecked = selectedStudentIds.has(st.id);

                              return (
                                <tr 
                                  key={st.id}
                                  onClick={() => toggleStudentSelection(st.id, calculatedAmount)}
                                  className={`transition-colors cursor-pointer ${
                                    alreadyGen
                                      ? 'bg-slate-900/40 opacity-70 hover:opacity-90'
                                      : isChecked
                                      ? 'bg-blue-950/30'
                                      : 'hover:bg-[#152033]'
                                  }`}
                                >
                                  <td className="py-2.5 px-3" onClick={(e) => e.stopPropagation()}>
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      disabled={Boolean(alreadyGen)}
                                      onChange={() => toggleStudentSelection(st.id, calculatedAmount)}
                                      className="rounded border-slate-700 text-blue-600 focus:ring-0 disabled:opacity-30"
                                    />
                                  </td>
                                  <td className="py-2.5 px-3 font-semibold text-white">
                                    {st.name}
                                  </td>
                                  <td className="py-2.5 px-3 font-mono text-slate-400">
                                    {st.id}
                                  </td>
                                  <td className="py-2.5 px-3 text-slate-300">
                                    {st.class} - {st.section}
                                  </td>
                                  <td className="py-2.5 px-3 text-slate-400">
                                    {st.family || 'Family'}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-bold text-red-400">
                                    {formatPKR(calculatedAmount)}
                                  </td>
                                  <td className="py-2.5 px-3 text-center">
                                    {alreadyGen ? (
                                      <span 
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                                        title={`Already generated. Use Print section to download.`}
                                      >
                                        <CheckCircle2 className="w-3 h-3" />
                                        {alreadyGen.challanNumber}
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-slate-500">
                                        Ready
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs text-slate-400 px-1">
                    <span>
                      Selected:{' '}
                      <strong className="text-white font-bold">
                        {scope === 'family' ? selectedFamilyIds.size : selectedStudentIds.size}
                      </strong>
                    </span>
                    <span className="text-[11px] text-slate-500">
                      * Items with active challans are locked to prevent duplicate generation.
                    </span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* STEP 4: CONFIRM (Summary, Date inputs: Issue, Due, Validity default to current date) */}
          {currentStep === 4 && (
            <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-150">
              <div className="text-center mb-2">
                <h3 className="text-base font-bold text-white">Confirm Challan Details</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Verify the selected recipients and configure issue, due, and validity dates before generating.
                </p>
              </div>

              {/* Date Pickers Grid */}
              <div className="p-4 bg-[#141f32] border border-[#23354e] rounded-xl grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-blue-400" />
                    Issue Date
                  </label>
                  <input
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0e1624] border border-[#263852] text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">Default: Today</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-red-400" />
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0e1624] border border-[#263852] text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">Grace period cutoff</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-amber-400" />
                    Validity Date
                  </label>
                  <input
                    type="date"
                    value={validityDate}
                    onChange={(e) => setValidityDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0e1624] border border-[#263852] text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">Bank deposit expiry</span>
                </div>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-[#121c2c] border border-[#1f2e46] rounded-xl text-center">
                  <span className="text-[10px] text-slate-400 block uppercase">Scope</span>
                  <strong className="text-white text-xs capitalize">{scope}</strong>
                </div>
                <div className="p-3 bg-[#121c2c] border border-[#1f2e46] rounded-xl text-center">
                  <span className="text-[10px] text-slate-400 block uppercase">Fee Range</span>
                  <strong className="text-blue-400 text-xs">{activeFeeOption.label}</strong>
                </div>
                <div className="p-3 bg-[#121c2c] border border-[#1f2e46] rounded-xl text-center">
                  <span className="text-[10px] text-slate-400 block uppercase">Eligible Recipients</span>
                  <strong className="text-emerald-400 text-xs">
                    {confirmList.filter(c => !c.alreadyGenerated).length} of {confirmList.length}
                  </strong>
                </div>
                <div className="p-3 bg-[#121c2c] border border-[#1f2e46] rounded-xl text-center">
                  <span className="text-[10px] text-slate-400 block uppercase">Total Batch Dues</span>
                  <strong className="text-red-400 text-xs font-mono">
                    {formatPKR(confirmList.filter(c => !c.alreadyGenerated).reduce((a, b) => a + b.amount, 0))}
                  </strong>
                </div>
              </div>

              {/* List of Challans to be generated */}
              <div className="rounded-xl border border-[#20314a] overflow-hidden bg-[#101827]">
                <div className="p-3 bg-[#141f31] border-b border-[#1e2e45] text-xs font-bold text-white flex justify-between">
                  <span>Challan Batch Preview</span>
                  <span className="text-slate-400 font-normal">
                    {confirmList.filter(c => !c.alreadyGenerated).length} will be created
                  </span>
                </div>
                <div className="max-h-[30vh] overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#0e1624] text-[10px] text-slate-400 uppercase">
                      <tr>
                        <th className="py-2 px-3">Recipient</th>
                        <th className="py-2 px-3">Target ID</th>
                        <th className="py-2 px-3">Class / Info</th>
                        <th className="py-2 px-3 text-right">Amount</th>
                        <th className="py-2 px-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1a2638]">
                      {confirmList.map(item => (
                        <tr key={item.targetId}>
                          <td className="py-2 px-3 font-semibold text-white">{item.targetName}</td>
                          <td className="py-2 px-3 font-mono text-slate-400">{item.targetId}</td>
                          <td className="py-2 px-3 text-slate-300">{item.className}</td>
                          <td className="py-2 px-3 text-right font-bold text-red-400">{formatPKR(item.amount)}</td>
                          <td className="py-2 px-3 text-center">
                            {item.alreadyGenerated ? (
                              <span className="text-[10px] text-amber-400 font-medium">
                                Skipped (Already Generated)
                              </span>
                            ) : (
                              <span className="text-[10px] text-emerald-400 font-semibold">
                                Will Generate
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: DOWNLOAD / PRINT CONFIRMATION */}
          {currentStep === 5 && (
            <div className="max-w-xl mx-auto py-6 text-center space-y-5 animate-in fade-in duration-200">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
                <CheckCircle2 className="w-9 h-9" />
              </div>

              <div>
                <h3 className="text-lg font-bold text-white">Challans Generated Successfully!</h3>
                <p className="text-xs text-slate-400 mt-1">
                  {newlyGeneratedChallans.length} fee challans have been created and assigned unique slip numbers.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="p-5 bg-[#141f31] border border-[#21324c] rounded-2xl space-y-3">
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      if (onOpenChallanView) {
                        onOpenChallanView(newlyGeneratedChallans);
                      }
                      onClose();
                    }}
                    className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
                    id="btn-print-newly-generated"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print All Generated Challans</span>
                  </button>

                  <button
                    type="button"
                    onClick={onClose}
                    className="px-6 py-2.5 rounded-xl bg-[#1b273b] hover:bg-[#25354e] text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
                    id="btn-done-challan-wizard"
                  >
                    Done
                  </button>
                </div>

                <p className="text-[11px] text-slate-400">
                  These challans can also be downloaded and printed anytime via the <strong>Print</strong> menu or from each student/family row.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
