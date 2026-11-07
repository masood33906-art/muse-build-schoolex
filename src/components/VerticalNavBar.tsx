import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard,
  Building2, 
  GraduationCap, 
  Banknote,
  BookOpen,
  Users,
  CalendarCheck,
  Award,
  Settings
} from 'lucide-react';
import { SchoolSettings, getSchoolSettings } from '../utils/settingsHelper';

export type AppModule = 'overview' | 'classes' | 'students' | 'fees' | 'ledger' | 'exam' | 'staff' | 'attendance' | 'settings';

interface VerticalNavBarProps {
  currentModule: AppModule;
  onSelectModule: (module: AppModule) => void;
  totalStudents: number;
  staffCount: number;
  classesCount: number;
  schoolSettings?: SchoolSettings;
}

export const VerticalNavBar: React.FC<VerticalNavBarProps> = ({
  currentModule,
  onSelectModule,
  totalStudents,
  staffCount,
  classesCount,
  schoolSettings
}) => {
  const [currentSchool, setCurrentSchool] = useState<SchoolSettings>(() => schoolSettings || getSchoolSettings());

  useEffect(() => {
    if (schoolSettings) {
      setCurrentSchool(schoolSettings);
    }
  }, [schoolSettings]);

  useEffect(() => {
    const handleUpdate = (e: any) => {
      if (e.detail) {
        setCurrentSchool(e.detail);
      } else {
        setCurrentSchool(getSchoolSettings());
      }
    };
    window.addEventListener('schoolSettingsUpdated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('schoolSettingsUpdated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  return (
    <aside 
      className="w-16 shrink-0 bg-surface-6 border-r border-edge-3 flex flex-col items-center py-4 z-40 select-none"
      id="main-vertical-navbar"
    >
      {/* Top Brand Logo Section */}
      <div className="mb-5 relative group">
        <button 
          type="button"
          onClick={() => onSelectModule('overview')}
          className="w-11 h-11 rounded-xl bg-[#111723] hover:bg-edge-3 border border-[#22334d] flex items-center justify-center text-white shadow-lg shadow-blue-900/20 cursor-pointer transform hover:scale-105 transition-all overflow-hidden p-1"
          title={`${currentSchool.schoolName || 'School Management Portal'} • Click to view Overview`}
          id="nav-logo-btn"
        >
          {currentSchool.schoolLogo ? (
            <img 
              src={currentSchool.schoolLogo} 
              alt={currentSchool.schoolName || "School Logo"} 
              className="w-full h-full object-contain rounded-lg transition-transform group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full rounded-lg bg-gradient-to-tr from-blue-600 via-sky-500 to-cyan-400 flex items-center justify-center text-white">
              <span className="font-black text-lg tracking-tighter">
                {currentSchool.schoolName ? currentSchool.schoolName.charAt(0).toUpperCase() : 'S'}
              </span>
            </div>
          )}
        </button>

        {/* Hover Tooltip showing School Name */}
        <span className="absolute left-full ml-2.5 top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-surface-35 border border-edge-34 text-white text-[11px] font-semibold rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-xl max-w-xs truncate">
          {currentSchool.schoolName || 'School Portal'}
        </span>
      </div>

      {/* Working Navigation Modules Only */}
      <nav className="flex flex-col items-center gap-3 w-full px-2">
        {/* 0. Overview Module */}
        <button
          type="button"
          onClick={() => onSelectModule('overview')}
          className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all cursor-pointer relative group ${
            currentModule === 'overview'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/35 ring-1 ring-blue-400/50'
              : 'text-slate-400 hover:text-slate-100 hover:bg-surface-31'
          }`}
          title="Overview & Portfolio"
          id="nav-item-overview"
        >
          <LayoutDashboard className="w-5 h-5 stroke-[2]" />
          
          {/* Hover Tooltip */}
          <span className="absolute left-full ml-2.5 px-2.5 py-1 bg-surface-35 border border-edge-34 text-white text-[11px] font-semibold rounded-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-xl">
            Overview
          </span>
        </button>

        {/* 1. Classes Module */}
        <button
          type="button"
          onClick={() => onSelectModule('classes')}
          className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all cursor-pointer relative group ${
            currentModule === 'classes'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/35 ring-1 ring-blue-400/50'
              : 'text-slate-400 hover:text-slate-100 hover:bg-surface-31'
          }`}
          title={`Classes & Sections (${classesCount})`}
          id="nav-item-classes"
        >
          <Building2 className="w-5 h-5 stroke-[2]" />
          
          {/* Hover Tooltip */}
          <span className="absolute left-full ml-2.5 px-2.5 py-1 bg-surface-35 border border-edge-34 text-white text-[11px] font-semibold rounded-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-xl">
            Classes ({classesCount})
          </span>
        </button>

        {/* 2. Students Module */}
        <button
          type="button"
          onClick={() => onSelectModule('students')}
          className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all cursor-pointer relative group ${
            currentModule === 'students'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/35 ring-1 ring-blue-400/50'
              : 'text-slate-400 hover:text-slate-100 hover:bg-surface-31'
          }`}
          title={`Students Directory (${totalStudents})`}
          id="nav-item-students"
        >
          <GraduationCap className="w-5 h-5 stroke-[2]" />

          {/* Hover Tooltip */}
          <span className="absolute left-full ml-2.5 px-2.5 py-1 bg-surface-35 border border-edge-34 text-white text-[11px] font-semibold rounded-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-xl">
            Students ({totalStudents})
          </span>
        </button>

        {/* Fees Module */}
        <button
          type="button"
          onClick={() => onSelectModule('fees')}
          className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all cursor-pointer relative group ${
            currentModule === 'fees'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/35 ring-1 ring-blue-400/50'
              : 'text-slate-400 hover:text-slate-100 hover:bg-surface-31'
          }`}
          title="Fees Management & Collection"
          id="nav-item-fees"
        >
          <Banknote className="w-5 h-5 stroke-[2]" />

          {/* Hover Tooltip */}
          <span className="absolute left-full ml-2.5 px-2.5 py-1 bg-surface-35 border border-edge-34 text-white text-[11px] font-semibold rounded-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-xl">
            Fees & Financials
          </span>
        </button>

        {/* Ledger Module */}
        <button
          type="button"
          onClick={() => onSelectModule('ledger')}
          className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all cursor-pointer relative group ${
            currentModule === 'ledger'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/35 ring-1 ring-blue-400/50'
              : 'text-slate-400 hover:text-slate-100 hover:bg-surface-31'
          }`}
          title="School Ledger & Income/Expense"
          id="nav-item-ledger"
        >
          <BookOpen className="w-5 h-5 stroke-[2]" />

          {/* Hover Tooltip */}
          <span className="absolute left-full ml-2.5 px-2.5 py-1 bg-surface-35 border border-edge-34 text-white text-[11px] font-semibold rounded-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-xl">
            Ledger &amp; Financials
          </span>
        </button>

        {/* Exams Module */}
        <button
          type="button"
          onClick={() => onSelectModule('exam')}
          className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all cursor-pointer relative group ${
            currentModule === 'exam'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/35 ring-1 ring-blue-400/50'
              : 'text-slate-400 hover:text-slate-100 hover:bg-surface-31'
          }`}
          title="Examinations & Marks"
          id="nav-item-exam"
        >
          <Award className="w-5 h-5 stroke-[2]" />

          {/* Hover Tooltip */}
          <span className="absolute left-full ml-2.5 px-2.5 py-1 bg-surface-35 border border-edge-34 text-white text-[11px] font-semibold rounded-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-xl">
            Exams &amp; Results
          </span>
        </button>

        {/* 3. Staff Module */}
        <button
          type="button"
          onClick={() => onSelectModule('staff')}
          className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all cursor-pointer relative group ${
            currentModule === 'staff'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/35 ring-1 ring-blue-400/50'
              : 'text-slate-400 hover:text-slate-100 hover:bg-surface-31'
          }`}
          title={`Staff Directory (${staffCount})`}
          id="nav-item-staff"
        >
          <Users className="w-5 h-5 stroke-[2]" />

          {/* Hover Tooltip */}
          <span className="absolute left-full ml-2.5 px-2.5 py-1 bg-surface-35 border border-edge-34 text-white text-[11px] font-semibold rounded-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-xl">
            Staff ({staffCount})
          </span>
        </button>

        {/* 4. Attendance Module (Matching reference image) */}
        <button
          type="button"
          onClick={() => onSelectModule('attendance')}
          className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all cursor-pointer relative group ${
            currentModule === 'attendance'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/35 ring-1 ring-blue-400/50'
              : 'text-slate-400 hover:text-slate-100 hover:bg-surface-31'
          }`}
          title="Attendance Portal"
          id="nav-item-attendance"
        >
          <CalendarCheck className="w-5 h-5 stroke-[2]" />

          {/* Hover Tooltip */}
          <span className="absolute left-full ml-2.5 px-2.5 py-1 bg-surface-35 border border-edge-34 text-white text-[11px] font-semibold rounded-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-xl">
            Attendance
          </span>
        </button>

        {/* 5. Settings Module (Bank Details & Challan Config) */}
        <button
          type="button"
          onClick={() => onSelectModule('settings')}
          className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all cursor-pointer relative group ${
            currentModule === 'settings'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/35 ring-1 ring-blue-400/50'
              : 'text-slate-400 hover:text-slate-100 hover:bg-surface-31'
          }`}
          title="Bank & Institutional Settings"
          id="nav-item-settings"
        >
          <Settings className="w-5 h-5 stroke-[2]" />

          {/* Hover Tooltip */}
          <span className="absolute left-full ml-2.5 px-2.5 py-1 bg-surface-35 border border-edge-34 text-white text-[11px] font-semibold rounded-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-xl">
            Settings
          </span>
        </button>
      </nav>
    </aside>
  );
};
