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
  AlertTriangle
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
import { storageUsageBytes } from '../utils/storage';
import { downloadBackup, restoreBackup } from '../utils/backup';
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
  const [usageBytes, setUsageBytes] = useState<number>(() => storageUsageBytes());
  const [pendingRestoreFile, setPendingRestoreFile] = useState<File | null>(null);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const restoreInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const refreshUsage = () => setUsageBytes(storageUsageBytes());
    window.addEventListener('storage', refreshUsage);
    window.addEventListener('backupCompleted', refreshUsage);
    return () => {
      window.removeEventListener('storage', refreshUsage);
      window.removeEventListener('backupCompleted', refreshUsage);
    };
  }, [activeSection, settings]);

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

  const usedMB = usageBytes / (1024 * 1024);
  const isHighUsage = usedMB > 3.5;
  const usagePct = Math.min(100, (usedMB / 5) * 100);

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
              setUsageBytes(storageUsageBytes());
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

      {/* Storage Usage Meter */}
      <div className="pt-2 border-t border-edge-8 space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className={isHighUsage ? 'text-amber-300 font-semibold flex items-center gap-1.5' : 'text-slate-300 font-medium'}>
            {isHighUsage && <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
            Storage used: {usedMB.toFixed(2)} MB / ~5 MB
          </span>
          <span className="text-[11px] text-slate-400 font-mono">{usagePct.toFixed(0)}%</span>
        </div>
        <div className="w-full h-2 rounded-full bg-surface-2 border border-edge-21 overflow-hidden">
          <div
            className={`h-full transition-all ${isHighUsage ? 'bg-amber-400' : 'bg-blue-500'}`}
            style={{ width: `${Math.max(2, usagePct)}%` }}
          />
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
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-2 border border-edge-28 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Campus / Branch</label>
                <input
                  type="text"
                  value={settings.campusName}
                  onChange={(e) => handleFieldChange('campusName', e.target.value)}
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
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-2 border border-edge-28 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Email Address</label>
                <input
                  type="email"
                  value={settings.schoolEmail}
                  onChange={(e) => handleFieldChange('schoolEmail', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-2 border border-edge-28 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-slate-300 font-semibold mb-1">Physical Address</label>
                <input
                  type="text"
                  value={settings.schoolAddress}
                  onChange={(e) => handleFieldChange('schoolAddress', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-2 border border-edge-28 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Principal / Administrator</label>
                <input
                  type="text"
                  value={settings.principalName}
                  onChange={(e) => handleFieldChange('principalName', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-2 border border-edge-28 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Registration / Affiliation #</label>
                <input
                  type="text"
                  value={settings.registrationNumber}
                  onChange={(e) => handleFieldChange('registrationNumber', e.target.value)}
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
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-2 border border-edge-28 text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Account Title</label>
                <input
                  type="text"
                  value={settings.accountTitle}
                  onChange={(e) => handleFieldChange('accountTitle', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-2 border border-edge-28 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Branch Name</label>
                <input
                  type="text"
                  value={settings.branchName}
                  onChange={(e) => handleFieldChange('branchName', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-2 border border-edge-28 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Branch Code</label>
                <input
                  type="text"
                  value={settings.branchCode}
                  onChange={(e) => handleFieldChange('branchCode', e.target.value)}
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
                  placeholder="e.g. PK36MEZN0002140103492811"
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
