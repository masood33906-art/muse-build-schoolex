import React, { useState, useEffect, useRef } from 'react';
import { 
  Building2, 
  Landmark, 
  FileText, 
  ArrowLeft, 
  Save, 
  RotateCcw, 
  Upload, 
  Trash2, 
  Image as ImageIcon,
  CheckCircle2,
  Database,
  Download,
  AlertTriangle,
  Sparkles,
  Wrench
} from 'lucide-react';
import { 
  SchoolSettings, 
  PAKISTANI_BANKS, 
  PRESET_SCHOOL_LOGOS,
  DEFAULT_SCHOOL_SETTINGS, 
  getSchoolSettings, 
  saveSchoolSettings,
  compressImageFileToDataUrl
} from '../utils/settingsHelper';
import { getBillingStartMonth, setBillingStartMonth } from '../utils/studentFeeLedgerHelper';
import { downloadBackup, restoreBackup } from '../utils/backup';
import { loadDummyData, resetSystem } from '../utils/systemActions';
import { Student, ClassInfo, StaffMember, AttendanceRecord } from '../types';
import { TemplatesSubmodule } from './TemplatesSubmodule';
import { BreadcrumbTrail } from './BreadcrumbTrail';

interface SettingsModuleProps {
  onShowToast: (message: string, type?: 'success' | 'info' | 'error') => void;
  onBreadcrumbOverview?: () => void;
  onUpdateSchoolSettings?: (settings: SchoolSettings) => void;
  schoolSettings?: SchoolSettings;
  students?: Student[];
  classes?: ClassInfo[];
  staff?: StaffMember[];
  allAttendance?: Record<string, AttendanceRecord[]>;
  initialTab?: 'school-profile' | 'bank-challan' | 'templates';
}

type SettingsSection = 'menu' | 'school-profile' | 'bank-challan' | 'templates';

export const SettingsModule: React.FC<SettingsModuleProps> = ({
  onShowToast,
  onBreadcrumbOverview,
  onUpdateSchoolSettings,
  schoolSettings: initialSchoolSettings,
  students = [],
  classes = [],
  staff = [],
  allAttendance,
  initialTab
}) => {
  // If initialTab is explicitly provided, navigate to it; otherwise default to the 3 boxes 'menu'
  const [activeSection, setActiveSection] = useState<SettingsSection>(initialTab || 'menu');
  const [settings, setSettings] = useState<SchoolSettings>(() => initialSchoolSettings || getSchoolSettings());
  const [billingStartMonthState, setBillingStartMonthState] = useState<string>(() => getBillingStartMonth());
  const [isCustomBank, setIsCustomBank] = useState<boolean>(() => {
    return !PAKISTANI_BANKS.filter(b => b !== 'Custom / Other Bank').includes(settings.bankName);
  });
  const [customBankName, setCustomBankName] = useState<string>(() => {
    return !PAKISTANI_BANKS.filter(b => b !== 'Custom / Other Bank').includes(settings.bankName)
      ? settings.bankName
      : '';
  });

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [pendingRestoreFile, setPendingRestoreFile] = useState<File | null>(null);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const [showDummyConfirm, setShowDummyConfirm] = useState<boolean>(false);
  const [isLoadingDummy, setIsLoadingDummy] = useState<boolean>(false);
  const [resetStep, setResetStep] = useState<0 | 1 | 2>(0);
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const restoreInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (initialSchoolSettings) {
      setSettings(initialSchoolSettings);
    }
  }, [initialSchoolSettings]);

  const handleBankSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setHasUnsavedChanges(true);
    if (val === 'Custom / Other Bank') {
      setIsCustomBank(true);
      setSettings(prev => ({ ...prev, bankName: customBankName || 'Custom Bank' }));
    } else {
      setIsCustomBank(false);
      setSettings(prev => ({ ...prev, bankName: val }));
    }
  };

  const handleCustomBankNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomBankName(val);
    setHasUnsavedChanges(true);
    setSettings(prev => ({ ...prev, bankName: val }));
  };

  const handleFieldChange = <K extends keyof SchoolSettings>(field: K, value: SchoolSettings[K]) => {
    setHasUnsavedChanges(true);
    setSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      onShowToast('Please select a valid image file (PNG, JPG, SVG, WebP)', 'error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      onShowToast('Image size must be under 10 MB', 'error');
      return;
    }
    try {
      const compressedDataUrl = await compressImageFileToDataUrl(file, 512);
      setSettings(prev => ({ ...prev, schoolLogo: compressedDataUrl }));
      setHasUnsavedChanges(true);
      onShowToast('Logo uploaded. Click Save to apply.', 'success');
    } catch {
      onShowToast('Could not process the uploaded image file', 'error');
    }
  };

  const handleSelectPresetLogo = (svgDataUrl: string) => {
    setSettings(prev => ({ ...prev, schoolLogo: svgDataUrl }));
    setHasUnsavedChanges(true);
    onShowToast('Preset logo selected', 'info');
  };

  const handleRemoveLogo = () => {
    setSettings(prev => ({ ...prev, schoolLogo: '' }));
    setHasUnsavedChanges(true);
    onShowToast('Logo removed', 'info');
  };

  const handleSave = () => {
    if (!settings.schoolName.trim()) {
      onShowToast('School name cannot be empty', 'error');
      return;
    }
    saveSchoolSettings(settings);
    if (onUpdateSchoolSettings) {
      onUpdateSchoolSettings(settings);
    }
    setHasUnsavedChanges(false);
    onShowToast('Settings saved successfully', 'success');
  };

  const handleResetDefaults = () => {
    setSettings(DEFAULT_SCHOOL_SETTINGS);
    setIsCustomBank(false);
    setCustomBankName('');
    saveSchoolSettings(DEFAULT_SCHOOL_SETTINGS);
    if (onUpdateSchoolSettings) {
      onUpdateSchoolSettings(DEFAULT_SCHOOL_SETTINGS);
    }
    setHasUnsavedChanges(false);
    onShowToast('Settings reset to defaults', 'info');
  };

  const handleLoadDummyData = async () => {
    setIsLoadingDummy(true);
    try {
      const result = await loadDummyData();
      setShowDummyConfirm(false);
      onShowToast(
        `Dummy data loaded: ${result.loaded.students} students, ${result.loaded.staff} staff, ${result.loaded.classes} classes. Reloading…`,
        'success'
      );
      setTimeout(() => window.location.reload(), 1500);
    } catch (err: any) {
      setShowDummyConfirm(false);
      onShowToast(err?.message || 'Could not load dummy data', 'error');
    } finally {
      setIsLoadingDummy(false);
    }
  };

  const handleResetSystem = async () => {
    setIsResetting(true);
    try {
      await resetSystem();
      window.location.reload();
    } catch (err: any) {
      onShowToast(err?.message || 'System reset failed', 'error');
      setIsResetting(false);
      setResetStep(0);
    }
  };

  const renderDataBackupCard = () => (
    <div className="p-5 rounded-2xl bg-surface-10 border border-edge-21 space-y-4 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-600/15 border border-blue-500/30 text-blue-400 flex items-center justify-center">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Data &amp; Backup</h2>
            <p className="text-xs text-slate-400">Export or restore all students, fees, ledger, attendance, exams, challans, and settings</p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          <button
            type="button"
            onClick={async () => {
              await downloadBackup();
              onShowToast('Full backup downloaded', 'success');
            }}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer transition-all shadow-sm"
            id="btn-settings-download-full-backup"
          >
            <Download className="w-4 h-4" />
            <span>Download full backup</span>
          </button>

          <input
            ref={restoreInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setPendingRestoreFile(f);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => restoreInputRef.current?.click()}
            className="px-4 py-2 rounded-xl bg-surface-33 hover:bg-[#1a2c47] border border-edge-36 text-slate-200 hover:text-white text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all"
            id="btn-settings-restore-backup"
          >
            <Upload className="w-4 h-4 text-amber-400" />
            <span>Restore from backup</span>
          </button>
        </div>
      </div>

      {/* Restore Confirmation Dialog */}
      {pendingRestoreFile && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-surface-17 border border-[#24344e] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2.5 text-amber-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-base font-bold text-white">Restore from backup</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              This replaces all current data with the contents of <span className="font-mono text-white">{pendingRestoreFile.name}</span>. A safety backup of your current data will be downloaded automatically before restoring.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1c283d]">
              <button
                type="button"
                disabled={isRestoring}
                onClick={() => setPendingRestoreFile(null)}
                className="px-3.5 py-2 rounded-lg bg-surface-41 text-slate-300 text-xs font-semibold hover:bg-surface-48 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isRestoring}
                onClick={async () => {
                  if (!pendingRestoreFile) return;
                  setIsRestoring(true);
                  try {
                    await restoreBackup(pendingRestoreFile);
                  } catch (err: any) {
                    onShowToast(err?.message || 'Failed to restore backup file', 'error');
                    setIsRestoring(false);
                    setPendingRestoreFile(null);
                  }
                }}
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold cursor-pointer"
              >
                {isRestoring ? 'Restoring...' : 'Confirm & Restore'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderSystemCard = () => (
    <div className="p-5 rounded-2xl bg-surface-10 border border-edge-21 space-y-4 max-w-5xl">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-violet-600/15 border border-violet-500/30 text-violet-400 flex items-center justify-center">
          <Wrench className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">System</h2>
          <p className="text-xs text-slate-400">Practice data for training, or a full factory reset of this installation</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Load Dummy Data */}
        <div className="p-4 rounded-xl bg-surface-2 border border-edge-21 space-y-2.5">
          <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-violet-400" />
            Load Dummy Data
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Fill the empty system with the sample school (117 students, 28 staff, 19 classes and related sample data) so you can practise safely. Only works while the system is empty.
          </p>
          <button
            type="button"
            onClick={() => setShowDummyConfirm(true)}
            className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer transition-all shadow-sm"
            id="btn-settings-load-dummy-data"
          >
            <Sparkles className="w-4 h-4" />
            <span>Load dummy data</span>
          </button>
        </div>

        {/* Reset System */}
        <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/25 space-y-2.5">
          <h3 className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            Reset System
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Permanently delete <span className="text-slate-200 font-semibold">everything</span> — students, staff, classes, fees, ledger, payroll and settings — and return to the empty first-run state.
          </p>
          <button
            type="button"
            onClick={() => setResetStep(1)}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer transition-all shadow-sm"
            id="btn-settings-reset-system"
          >
            <Trash2 className="w-4 h-4" />
            <span>Reset system</span>
          </button>
        </div>
      </div>

      {/* Load Dummy Data Confirmation Dialog */}
      {showDummyConfirm && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-surface-17 border border-[#24344e] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2.5 text-violet-400">
              <Sparkles className="w-5 h-5 shrink-0" />
              <h3 className="text-base font-bold text-white">Load dummy data</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              This loads the sample school — <span className="text-white font-semibold">117 students, 28 staff and 19 classes</span>, with related sample fees and records — so you can practise with realistic data.
            </p>
            <p className="text-xs text-slate-300 leading-relaxed">
              Dummy data can only be loaded into an <span className="text-white font-semibold">empty system</span>. If this system already holds data, nothing will be loaded and you will be told why.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1c283d]">
              <button
                type="button"
                disabled={isLoadingDummy}
                onClick={() => setShowDummyConfirm(false)}
                className="px-3.5 py-2 rounded-lg bg-surface-41 text-slate-300 text-xs font-semibold hover:bg-surface-48 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isLoadingDummy}
                onClick={handleLoadDummyData}
                className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold cursor-pointer"
              >
                {isLoadingDummy ? 'Loading...' : 'Load dummy data'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset System Confirmation — Step 1 */}
      {resetStep === 1 && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-surface-17 border border-rose-500/40 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2.5 text-rose-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-base font-bold text-white">Reset the whole system?</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              This <span className="text-rose-300 font-semibold">permanently deletes all data</span> in this installation: every student, staff member, class, fee record, ledger entry, payroll record and all settings. The app returns to the empty state it had when first installed.
            </p>
            <p className="text-xs text-slate-300 leading-relaxed">
              This cannot be undone. If you might need this data again, download a full backup first.
            </p>
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#1c283d]">
              <button
                type="button"
                onClick={async () => { await downloadBackup(); onShowToast('Full backup downloaded', 'success'); }}
                className="px-3.5 py-2 rounded-lg bg-surface-41 text-slate-200 text-xs font-semibold hover:bg-surface-48 flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-blue-400" />
                <span>Download backup first</span>
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setResetStep(0)}
                  className="px-3.5 py-2 rounded-lg bg-surface-41 text-slate-300 text-xs font-semibold hover:bg-surface-48 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setResetStep(2)}
                  className="px-4 py-2 rounded-lg bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-bold cursor-pointer"
                >
                  I understand, continue
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reset System Confirmation — Step 2 (final) */}
      {resetStep === 2 && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-surface-17 border border-rose-500/60 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2.5 text-rose-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-base font-bold text-white">Final confirmation</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Are you absolutely sure? All school data will be erased <span className="text-rose-300 font-semibold">right now</span> and cannot be recovered unless you saved a backup.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1c283d]">
              <button
                type="button"
                disabled={isResetting}
                onClick={() => setResetStep(1)}
                className="px-3.5 py-2 rounded-lg bg-surface-41 text-slate-300 text-xs font-semibold hover:bg-surface-48 cursor-pointer"
              >
                Go back
              </button>
              <button
                type="button"
                disabled={isResetting}
                onClick={handleResetSystem}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer"
                id="btn-settings-reset-system-confirm"
              >
                {isResetting ? 'Resetting...' : 'Yes, permanently reset everything'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // =========================================================================
  // VIEW 1: THREE CLEAR BUTTON BOXES (Settings Home)
  // =========================================================================
  if (activeSection === 'menu') {
    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        <div className="pb-4 border-b border-surface-45">
          <h1 className="text-2xl font-bold text-white tracking-tight">Settings</h1>
          <BreadcrumbTrail
            items={[
              { label: 'Overview', onClick: onBreadcrumbOverview },
              { label: 'Settings' }
            ]}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 max-w-5xl">
          {/* Box 1: School Profile */}
          <button
            type="button"
            onClick={() => setActiveSection('school-profile')}
            className="p-8 rounded-2xl bg-surface-10 border border-edge-21 hover:border-blue-500/70 hover:bg-[#131d31] transition-all flex flex-col items-center justify-center gap-5 group cursor-pointer shadow-lg hover:shadow-blue-900/20 active:scale-[0.99] min-h-[220px]"
          >
            <div className="w-16 h-16 rounded-2xl bg-blue-600/15 border border-blue-500/30 text-blue-400 flex items-center justify-center group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-md">
              <Building2 className="w-8 h-8" />
            </div>
            <span className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors">
              School Profile
            </span>
          </button>

          {/* Box 2: Bank and Challan */}
          <button
            type="button"
            onClick={() => setActiveSection('bank-challan')}
            className="p-8 rounded-2xl bg-surface-10 border border-edge-21 hover:border-emerald-500/70 hover:bg-[#131d31] transition-all flex flex-col items-center justify-center gap-5 group cursor-pointer shadow-lg hover:shadow-emerald-900/20 active:scale-[0.99] min-h-[220px]"
          >
            <div className="w-16 h-16 rounded-2xl bg-emerald-600/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center group-hover:scale-110 group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-md">
              <Landmark className="w-8 h-8" />
            </div>
            <span className="text-xl font-bold text-white group-hover:text-emerald-400 transition-colors">
              Bank and Challan
            </span>
          </button>

          {/* Box 3: Templates */}
          <button
            type="button"
            onClick={() => setActiveSection('templates')}
            className="p-8 rounded-2xl bg-surface-10 border border-edge-21 hover:border-amber-500/70 hover:bg-[#131d31] transition-all flex flex-col items-center justify-center gap-5 group cursor-pointer shadow-lg hover:shadow-amber-900/20 active:scale-[0.99] min-h-[220px]"
          >
            <div className="w-16 h-16 rounded-2xl bg-amber-600/15 border border-amber-500/30 text-amber-400 flex items-center justify-center group-hover:scale-110 group-hover:bg-amber-600 group-hover:text-white transition-all shadow-md">
              <FileText className="w-8 h-8" />
            </div>
            <span className="text-xl font-bold text-white group-hover:text-amber-400 transition-colors">
              Templates
            </span>
          </button>
        </div>

        {renderDataBackupCard()}
        {renderSystemCard()}
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: SUB-SECTION WITH BACK BUTTON
  // =========================================================================
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Clean Top Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-surface-45">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            {activeSection === 'school-profile' && 'School Profile'}
            {activeSection === 'bank-challan' && 'Bank and Challan'}
            {activeSection === 'templates' && 'Templates'}
          </h1>
          <BreadcrumbTrail
            items={[
              { label: 'Overview', onClick: onBreadcrumbOverview },
              { label: 'Settings', onClick: () => setActiveSection('menu') },
              { 
                label: activeSection === 'school-profile' 
                  ? 'School Profile' 
                  : activeSection === 'bank-challan' 
                    ? 'Bank and Challan' 
                    : 'Templates' 
              }
            ]}
          />
        </div>

        {/* Action Buttons for Forms */}
        {activeSection !== 'templates' && (
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="px-3.5 py-2 rounded-xl bg-[#141b29] hover:bg-[#1a2436] border border-edge-24 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>Reset</span>
            </button>
          </div>
        )}
      </div>

      {/* Unsaved indicator banner */}
      {hasUnsavedChanges && activeSection !== 'templates' && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs text-amber-300">
          <span>You have unsaved changes.</span>
          <button
            type="button"
            onClick={handleSave}
            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Now</span>
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 1. SCHOOL PROFILE FORM                                                */}
      {/* ===================================================================== */}
      {activeSection === 'school-profile' && (
        <div className="space-y-6 max-w-4xl">
          {/* Logo Section */}
          <div className="p-5 rounded-2xl bg-surface-10 border border-edge-21 space-y-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">School Logo</h2>
            <div className="flex flex-col sm:flex-row items-center gap-5">
              <div className="w-24 h-24 rounded-2xl bg-[#080d17] border border-edge-36 p-1 flex items-center justify-center shrink-0">
                {settings.schoolLogo ? (
                  <img src={settings.schoolLogo} alt="Logo" className="w-full h-full object-contain rounded-xl" />
                ) : (
                  <div className="w-full h-full rounded-xl bg-blue-600 flex items-center justify-center text-white text-2xl font-black">
                    {settings.schoolName ? settings.schoolName.charAt(0).toUpperCase() : 'S'}
                  </div>
                )}
              </div>

              <div className="space-y-3 flex-1">
                <div className="flex items-center gap-2.5">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-surface-33 hover:bg-[#1a2c47] border border-edge-36 text-slate-200 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer"
                  >
                    <Upload className="w-4 h-4 text-blue-400" />
                    <span>Upload Logo Image</span>
                  </button>

                  {settings.schoolLogo && (
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  )}
                </div>

                {/* Preset Options */}
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs text-slate-400">Presets:</span>
                  {PRESET_SCHOOL_LOGOS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPresetLogo(preset.svg)}
                      className="w-7 h-7 rounded-lg bg-surface-33 border border-edge-36 hover:border-blue-500 p-0.5 cursor-pointer"
                      title={preset.name}
                    >
                      <img src={preset.svg} alt={preset.name} className="w-full h-full object-contain" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* School Details */}
          <div className="p-5 rounded-2xl bg-surface-10 border border-edge-21 space-y-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Institution Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="sm:col-span-2">
                <label className="block text-slate-300 font-semibold mb-1">School Name *</label>
                <input
                  type="text"
                  value={settings.schoolName}
                  onChange={(e) => handleFieldChange('schoolName', e.target.value)}
                  placeholder="Enter school name"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-2 border border-edge-28 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Campus / Branch</label>
                <input
                  type="text"
                  value={settings.campusName}
                  onChange={(e) => handleFieldChange('campusName', e.target.value)}
                  placeholder="e.g. Main Campus"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-2 border border-edge-28 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Academic Session</label>
                <input
                  type="text"
                  value={settings.session}
                  onChange={(e) => handleFieldChange('session', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-2 border border-edge-28 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Phone Number</label>
                <input
                  type="text"
                  value={settings.schoolPhone}
                  onChange={(e) => handleFieldChange('schoolPhone', e.target.value)}
                  placeholder="e.g. +92 300 1234567"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-2 border border-edge-28 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Email Address</label>
                <input
                  type="email"
                  value={settings.schoolEmail}
                  onChange={(e) => handleFieldChange('schoolEmail', e.target.value)}
                  placeholder="e.g. info@yourschool.edu.pk"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-2 border border-edge-28 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-slate-300 font-semibold mb-1">Physical Address</label>
                <input
                  type="text"
                  value={settings.schoolAddress}
                  onChange={(e) => handleFieldChange('schoolAddress', e.target.value)}
                  placeholder="Enter school address"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-2 border border-edge-28 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Principal / Administrator</label>
                <input
                  type="text"
                  value={settings.principalName}
                  onChange={(e) => handleFieldChange('principalName', e.target.value)}
                  placeholder="Enter principal / administrator name"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-2 border border-edge-28 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Registration / Affiliation #</label>
                <input
                  type="text"
                  value={settings.registrationNumber}
                  onChange={(e) => handleFieldChange('registrationNumber', e.target.value)}
                  placeholder="Enter registration / affiliation number"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-2 border border-edge-28 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Fee billing starts from</label>
                <input
                  type="month"
                  value={billingStartMonthState}
                  onChange={(e) => {
                    const val = e.target.value;
                    setBillingStartMonthState(val);
                    if (val) setBillingStartMonth(val);
                    setHasUnsavedChanges(true);
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-2 border border-edge-28 text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {renderDataBackupCard()}
          {renderSystemCard()}
        </div>
      )}

      {/* ===================================================================== */}
      {/* 2. BANK AND CHALLAN FORM                                              */}
      {/* ===================================================================== */}
      {activeSection === 'bank-challan' && (
        <div className="space-y-6 max-w-4xl">
          <div className="p-5 rounded-2xl bg-surface-10 border border-edge-21 space-y-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Bank Account Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="sm:col-span-2">
                <label className="block text-slate-300 font-semibold mb-1">Bank Name *</label>
                <select
                  value={isCustomBank ? 'Custom / Other Bank' : settings.bankName}
                  onChange={handleBankSelectChange}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-2 border border-edge-28 text-white focus:outline-none focus:border-blue-500"
                >
                  {PAKISTANI_BANKS.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              {isCustomBank && (
                <div className="sm:col-span-2">
                  <label className="block text-slate-300 font-semibold mb-1">Custom Bank Name *</label>
                  <input
                    type="text"
                    value={customBankName}
                    onChange={handleCustomBankNameChange}
                    placeholder="Enter bank name"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface-2 border border-edge-28 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Account Number / IBAN *</label>
                <input
                  type="text"
                  value={settings.accountNumber}
                  onChange={(e) => handleFieldChange('accountNumber', e.target.value)}
                  placeholder="Enter account number"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-2 border border-edge-28 text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Account Title</label>
                <input
                  type="text"
                  value={settings.accountTitle}
                  onChange={(e) => handleFieldChange('accountTitle', e.target.value)}
                  placeholder="Enter account title"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-2 border border-edge-28 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Branch Name</label>
                <input
                  type="text"
                  value={settings.branchName}
                  onChange={(e) => handleFieldChange('branchName', e.target.value)}
                  placeholder="Enter branch name"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-2 border border-edge-28 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Branch Code</label>
                <input
                  type="text"
                  value={settings.branchCode}
                  onChange={(e) => handleFieldChange('branchCode', e.target.value)}
                  placeholder="Enter branch code"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-2 border border-edge-28 text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-surface-10 border border-edge-21 space-y-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Challan Rules</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Fee billing starts from</label>
                <input
                  type="month"
                  value={billingStartMonthState}
                  onChange={(e) => {
                    const val = e.target.value;
                    setBillingStartMonthState(val);
                    if (val) setBillingStartMonth(val);
                    setHasUnsavedChanges(true);
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-2 border border-edge-28 text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Monthly Due Day (Day of Month)</label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={settings.challanDueDay}
                  onChange={(e) => handleFieldChange('challanDueDay', parseInt(e.target.value, 10) || 10)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-2 border border-edge-28 text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Late Fine Surcharge (PKR)</label>
                <input
                  type="number"
                  min="0"
                  value={settings.lateFineAmount}
                  onChange={(e) => handleFieldChange('lateFineAmount', parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-2 border border-edge-28 text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-slate-300 font-semibold mb-1">IBAN (International Bank Account Number)</label>
                <input
                  type="text"
                  value={settings.iban}
                  onChange={(e) => handleFieldChange('iban', e.target.value)}
                  placeholder="e.g. PK36 XXXX 0000 0000 0000 0000"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-2 border border-edge-28 text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 3. TEMPLATES SUBMODULE                                                */}
      {/* ===================================================================== */}
      {activeSection === 'templates' && (
        <TemplatesSubmodule
          schoolSettings={settings}
          onUpdateSchoolSettings={(updated) => {
            setSettings(updated);
            if (onUpdateSchoolSettings) {
              onUpdateSchoolSettings(updated);
            }
          }}
          students={students}
          classes={classes}
          staff={staff}
          allAttendance={allAttendance}
          onShowToast={onShowToast}
        />
      )}
    </div>
  );
};
