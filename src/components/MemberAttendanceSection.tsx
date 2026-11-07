import React, { useState, useMemo } from 'react';
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  X, 
  Clock, 
  CalendarDays, 
  AlertCircle,
  Sparkles,
  Info,
  CheckCircle2,
  CalendarCheck2,
  Save
} from 'lucide-react';
import { AttendanceRecord, AttendanceStatus, HolidayRecord } from '../types';
import { loadAttendance } from '../utils/attendanceHelper';
import { localISODate } from '../utils/dates';

interface MemberAttendanceSectionProps {
  memberId: string;
  memberName: string;
  memberType: 'student' | 'staff';
  allAttendance: Record<string, AttendanceRecord[]>;
  onUpdateStatus?: (
    date: string,
    status: AttendanceStatus,
    checkInTime?: string,
    remarks?: string
  ) => void;
  holidays?: HolidayRecord[];
  memberClass?: string;
  memberSection?: string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const MemberAttendanceSection: React.FC<MemberAttendanceSectionProps> = ({
  memberId,
  memberName,
  memberType,
  allAttendance,
  onUpdateStatus,
  holidays = [],
  memberClass,
  memberSection
}) => {
  // The section opens on TODAY — the day attendance is being marked — not
  // on a previously stored date and not on a fixed calendar constant.
  const initialDateStr = localISODate();

  // Navigation month & year (Defaults to the current month & year)
  const [selectedYear, setSelectedYear] = useState<number>(() => {
    const y = parseInt(initialDateStr.split('-')[0], 10);
    return !isNaN(y) ? y : new Date().getFullYear();
  });
  const [selectedMonth, setSelectedMonth] = useState<number>(() => {
    const m = parseInt(initialDateStr.split('-')[1], 10);
    return !isNaN(m) ? m - 1 : new Date().getMonth(); // 0-indexed
  });

  // Selected date for functional inspection & editing
  const [selectedDate, setSelectedDate] = useState<string>(initialDateStr);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Merge prop allAttendance with localStorage to guarantee latest saved records are reflected
  const effectiveAttendance = useMemo<Record<string, AttendanceRecord[]>>(() => {
    const stored = loadAttendance();
    return { ...stored, ...allAttendance };
  }, [allAttendance]);

  const triggerToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 2500);
  };

  // Month navigation helpers
  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(prev => prev - 1);
    } else {
      setSelectedMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(prev => prev + 1);
    } else {
      setSelectedMonth(prev => prev + 1);
    }
  };

  const handleJumpToCurrent = () => {
    const today = new Date();
    setSelectedYear(today.getFullYear());
    setSelectedMonth(today.getMonth());
    setSelectedDate(localISODate(today));
  };

  // Generate calendar days for selected year & month
  const calendarData = useMemo(() => {
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    // In JavaScript Date.getDay(): 0 = Sun, 1 = Mon, ..., 6 = Sat
    // We want Mon = 0, Sun = 6
    const firstDayOfWeekRaw = new Date(selectedYear, selectedMonth, 1).getDay();
    const leadingBlanks = (firstDayOfWeekRaw + 6) % 7;

    const days: {
      dateKey: string;
      dayNumber: number;
      dayName: string;
      isWeekend: boolean;
      status: AttendanceStatus;
      isHoliday: boolean;
      holidayReason?: string;
      checkInTime?: string;
      remarks?: string;
      isFuture: boolean;
    }[] = [];

    const monthStr = String(selectedMonth + 1).padStart(2, '0');
    const normalizedMemberId = memberId.trim().toLowerCase();

    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = String(day).padStart(2, '0');
      const dateKey = `${selectedYear}-${monthStr}-${dayStr}`;
      const dayDate = new Date(selectedYear, selectedMonth, day);
      const dow = (dayDate.getDay() + 6) % 7; // Mon=0, Sun=6
      const isWeekend = dow === 6 || dow === 5; // Sun or Sat
      const isFuture = selectedYear === 2026 && selectedMonth === 8 && day > 13;

      // Check holidays
      const holiday = holidays.find(h => {
        if (h.date !== dateKey) return false;
        if (h.applyTo === 'both') return true;
        if (h.applyTo === memberType) {
          if (memberType === 'student' && h.class && h.class !== 'All Classes') {
            if (memberClass && h.class.toLowerCase() !== memberClass.toLowerCase()) return false;
            if (h.section && h.section !== 'All Sections' && memberSection) {
              if (h.section.toUpperCase() !== memberSection.toUpperCase()) return false;
            }
          }
          return true;
        }
        return false;
      });

      // Check stored attendance records
      const dayRecords = effectiveAttendance[dateKey] || [];
      const userRecord = dayRecords.find(
        r => r.id === memberId || r.id.trim().toLowerCase() === normalizedMemberId
      );

      let status: AttendanceStatus = 'not_marked';
      let checkInTime = userRecord?.checkInTime;
      let remarks = userRecord?.remarks;

      if (userRecord && userRecord.status) {
        status = userRecord.status;
      } else if (holiday) {
        status = 'not_marked';
      }

      days.push({
        dateKey,
        dayNumber: day,
        dayName: WEEKDAY_NAMES[dow],
        isWeekend,
        status,
        isHoliday: Boolean(holiday),
        holidayReason: holiday?.reason,
        checkInTime,
        remarks,
        isFuture
      });
    }

    return { days, leadingBlanks, daysInMonth };
  }, [selectedYear, selectedMonth, effectiveAttendance, memberId, holidays, memberType, memberClass, memberSection]);

  // Calculate monthly stats dynamically
  const monthlyStats = useMemo(() => {
    let present = 0;
    let late = 0;
    let absent = 0;
    let leave = 0;
    let workingDays = 0;

    calendarData.days.forEach(d => {
      if (!d.isWeekend && !d.isHoliday) {
        workingDays++;
      }
      if (d.status === 'present') present++;
      else if (d.status === 'late') late++;
      else if (d.status === 'absent') absent++;
      else if (d.status === 'leave') leave++;
    });

    const totalMarked = present + late + absent + leave;
    const rate = totalMarked > 0 ? Math.round(((present + late) / totalMarked) * 100) : 0;

    return {
      workingDays,
      present,
      late,
      absent,
      leave,
      totalMarked,
      rate
    };
  }, [calendarData]);

  // Selected date info
  const selectedDateRecord = useMemo(() => {
    const dayData = calendarData.days.find(d => d.dateKey === selectedDate);
    if (dayData) return dayData;

    // Fallback if selectedDate is outside current month
    const normalizedMemberId = memberId.trim().toLowerCase();
    const records = effectiveAttendance[selectedDate] || [];
    const userRecord = records.find(
      r => r.id === memberId || r.id.trim().toLowerCase() === normalizedMemberId
    );
    return {
      dateKey: selectedDate,
      dayNumber: parseInt(selectedDate.split('-')[2] || '1', 10),
      dayName: '',
      isWeekend: false,
      status: userRecord?.status || 'not_marked',
      isHoliday: false,
      holidayReason: undefined,
      checkInTime: userRecord?.checkInTime,
      remarks: userRecord?.remarks,
      isFuture: false
    };
  }, [calendarData, selectedDate, effectiveAttendance, memberId]);

  // Handle setting status for the selected date
  const handleSetStatus = (newStatus: AttendanceStatus) => {
    if (!onUpdateStatus) return;

    let defaultTime: string | undefined = undefined;
    if (newStatus === 'present') defaultTime = '08:00 AM';
    if (newStatus === 'late') defaultTime = '08:45 AM';

    const defaultRemarks = newStatus === 'leave' ? 'Approved Leave' : newStatus === 'absent' ? 'Unexcused' : '-';

    onUpdateStatus(selectedDate, newStatus, defaultTime, defaultRemarks);
    triggerToast(`Marked ${newStatus.toUpperCase()} for ${selectedDate}`);
  };

  // Format date display (e.g., "Sunday, 13 Sep 2026")
  const formattedSelectedDateDisplay = useMemo(() => {
    try {
      const parts = selectedDate.split('-').map(Number);
      if (parts.length === 3) {
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getDay()];
        const monthName = MONTH_NAMES[parts[1] - 1];
        return `${dayName}, ${monthName} ${parts[2]}, ${parts[0]}`;
      }
    } catch {
      // fallback
    }
    return selectedDate;
  }, [selectedDate]);

  return (
    <div className="space-y-6" id="member-attendance-container">
      {/* Toast feedback */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{successToast}</span>
        </div>
      )}

      {/* ======================================================== */}
      {/* 1. TOP MONTH SELECTOR & NAVIGATION CONTROLS              */}
      {/* ======================================================== */}
      <div className="bg-surface-17 border border-edge-14 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-950/60 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <CalendarCheck2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-white tracking-tight">
              {MONTH_NAMES[selectedMonth]} {selectedYear}
            </h3>
            <p className="text-xs text-slate-400">
              Live attendance history for <span className="text-blue-400 font-semibold">{memberName}</span> ({memberId})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Quick jump to current */}
          <button
            type="button"
            onClick={handleJumpToCurrent}
            className="h-7 px-2.5 rounded-lg bg-edge-3 hover:bg-[#202e45] border border-edge-34 text-slate-300 hover:text-white text-[11px] font-semibold cursor-pointer transition-colors box-border"
            id="btn-attendance-current-month"
          >
            {`${MONTH_NAMES[new Date().getMonth()].slice(0, 3)} ${new Date().getFullYear()}`}
          </button>

          {/* Prev Month */}
          <button
            type="button"
            onClick={handlePrevMonth}
            className="h-7 w-7 rounded-lg bg-edge-3 hover:bg-[#202e45] border border-edge-34 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer transition-colors box-border"
            id="btn-attendance-prev-month"
            title="Previous Month"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          {/* Next Month */}
          <button
            type="button"
            onClick={handleNextMonth}
            className="h-7 w-7 rounded-lg bg-edge-3 hover:bg-[#202e45] border border-edge-34 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer transition-colors box-border"
            id="btn-attendance-next-month"
            title="Next Month"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. DYNAMIC MONTHLY STAT CARDS                            */}
      {/* ======================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Working Days */}
        <div className="bg-surface-17 border border-edge-14 rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-[11px] text-slate-400 font-medium">Working Days</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-bold text-white">{monthlyStats.workingDays}</span>
            <span className="text-[10px] text-slate-500 font-mono">Days</span>
          </div>
        </div>

        {/* Present */}
        <div className="bg-[#0b241c] border border-[#144837] rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
            Present
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-black text-emerald-300">{monthlyStats.present}</span>
            <span className="text-[10px] text-emerald-500 font-semibold">
              {monthlyStats.totalMarked > 0 ? Math.round((monthlyStats.present / monthlyStats.totalMarked) * 100) : 0}%
            </span>
          </div>
        </div>

        {/* Late */}
        <div className="bg-[#0b2529] border border-[#134950] rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-[11px] text-teal-400 font-semibold flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-teal-400 inline-block" />
            Late
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-black text-teal-300">{monthlyStats.late}</span>
            <span className="text-[10px] text-teal-500 font-semibold">
              {monthlyStats.totalMarked > 0 ? Math.round((monthlyStats.late / monthlyStats.totalMarked) * 100) : 0}%
            </span>
          </div>
        </div>

        {/* Absent */}
        <div className="bg-[#291014] border border-[#521c25] rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-[11px] text-rose-400 font-semibold flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-400 inline-block" />
            Absent
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-black text-rose-300">{monthlyStats.absent}</span>
            <span className="text-[10px] text-rose-500 font-semibold">
              {monthlyStats.totalMarked > 0 ? Math.round((monthlyStats.absent / monthlyStats.totalMarked) * 100) : 0}%
            </span>
          </div>
        </div>

        {/* Leave */}
        <div className="bg-[#291e0a] border border-[#543b12] rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-[11px] text-amber-400 font-semibold flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
            Leave
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-black text-amber-300">{monthlyStats.leave}</span>
            <span className="text-[10px] text-amber-500 font-semibold">
              {monthlyStats.totalMarked > 0 ? Math.round((monthlyStats.leave / monthlyStats.totalMarked) * 100) : 0}%
            </span>
          </div>
        </div>

        {/* Rate */}
        <div className="bg-[#101b33] border border-[#1c325c] rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-[11px] text-blue-300 font-semibold">Attendance Rate</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-black text-blue-200">{monthlyStats.rate}%</span>
            <span className="text-[10px] text-blue-400 font-semibold">Monthly</span>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. INTERACTIVE FUNCTIONAL DATE SELECTOR & EDITOR         */}
      {/* (Fulfills: "make the attendance data functionaly to      */}
      {/*  select data from there")                                */}
      {/* ======================================================== */}
      <div 
        className="bg-surface-13 border border-[#202e44] rounded-2xl p-4 sm:p-5 shadow-lg"
        id="panel-interactive-date-editor"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#1b2639]">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Selected Entry</span>
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              <span className="text-xs text-blue-400 font-mono">{selectedDate}</span>
            </div>
            <h4 className="text-base font-extrabold text-white mt-0.5">
              {formattedSelectedDateDisplay}
            </h4>
          </div>

          {/* Quick Date picker input to jump directly to any date */}
          <div className="flex items-center gap-2">
            <label htmlFor="quick-date-picker" className="text-xs text-slate-400 font-medium whitespace-nowrap">
              Select Date:
            </label>
            <div className="relative border border-[#263750] rounded-xl bg-surface-26 px-3 py-1.5 flex items-center gap-2">
              <input
                id="quick-date-picker"
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  // also sync calendar month/year if selected date is in another month
                  try {
                    const parts = e.target.value.split('-').map(Number);
                    if (parts.length === 3) {
                      setSelectedYear(parts[0]);
                      setSelectedMonth(parts[1] - 1);
                    }
                  } catch {
                    // ignore
                  }
                }}
                className="bg-transparent text-xs text-white font-semibold focus:outline-none cursor-pointer"
              />
              <Calendar className="w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Current status info & Quick Attendance Marking Buttons */}
        <div className="mt-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 font-medium">Current Status:</span>
            {selectedDateRecord.isHoliday ? (
              <span className="px-2.5 py-1 rounded-lg bg-sky-950/60 border border-sky-700/60 text-sky-300 text-xs font-bold flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" />
                <span>Holiday: {selectedDateRecord.holidayReason || 'Holiday'}</span>
              </span>
            ) : selectedDateRecord.status === 'present' ? (
              <span className="px-2.5 py-1 rounded-lg bg-emerald-950/80 border border-emerald-700/80 text-emerald-300 text-xs font-bold flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                <span>Present</span>
                {selectedDateRecord.checkInTime && (
                  <span className="text-[11px] text-emerald-400/80 font-mono font-normal">
                    ({selectedDateRecord.checkInTime})
                  </span>
                )}
              </span>
            ) : selectedDateRecord.status === 'late' ? (
              <span className="px-2.5 py-1 rounded-lg bg-teal-950/80 border border-teal-700/80 text-teal-300 text-xs font-bold flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>Late</span>
                {selectedDateRecord.checkInTime && (
                  <span className="text-[11px] text-teal-400/80 font-mono font-normal">
                    ({selectedDateRecord.checkInTime})
                  </span>
                )}
              </span>
            ) : selectedDateRecord.status === 'absent' ? (
              <span className="px-2.5 py-1 rounded-lg bg-rose-950/80 border border-rose-700/80 text-rose-300 text-xs font-bold flex items-center gap-1.5">
                <X className="w-3.5 h-3.5" />
                <span>Absent</span>
              </span>
            ) : selectedDateRecord.status === 'leave' ? (
              <span className="px-2.5 py-1 rounded-lg bg-amber-950/80 border border-amber-700/80 text-amber-300 text-xs font-bold flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5" />
                <span>Approved Leave</span>
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-lg bg-surface-42 border border-[#2a374e] text-slate-400 text-xs font-semibold">
                Not Marked
              </span>
            )}
          </div>

          {/* Quick Status Changers */}
          {onUpdateStatus && (
            <div className="flex items-center flex-wrap gap-2">
              <span className="text-xs text-slate-400 font-medium mr-1">Mark for this date:</span>

              {/* Present */}
              <button
                type="button"
                onClick={() => handleSetStatus('present')}
                className={`h-8 px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                  selectedDateRecord.status === 'present'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                    : 'bg-[#0f2e22] hover:bg-[#143e2e] border border-[#1b5e43] text-emerald-300'
                }`}
                id="btn-mark-profile-present"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Present</span>
              </button>

              {/* Late */}
              <button
                type="button"
                onClick={() => handleSetStatus('late')}
                className={`h-8 px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                  selectedDateRecord.status === 'late'
                    ? 'bg-teal-600 text-white shadow-md shadow-teal-600/30'
                    : 'bg-[#0e2c31] hover:bg-[#133b42] border border-[#1a5b65] text-teal-300'
                }`}
                id="btn-mark-profile-late"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Late</span>
              </button>

              {/* Absent */}
              <button
                type="button"
                onClick={() => handleSetStatus('absent')}
                className={`h-8 px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                  selectedDateRecord.status === 'absent'
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                    : 'bg-[#311116] hover:bg-[#42171e] border border-[#64232e] text-rose-300'
                }`}
                id="btn-mark-profile-absent"
              >
                <X className="w-3.5 h-3.5" />
                <span>Absent</span>
              </button>

              {/* Leave */}
              <button
                type="button"
                onClick={() => handleSetStatus('leave')}
                className={`h-8 px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                  selectedDateRecord.status === 'leave'
                    ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                    : 'bg-[#31230c] hover:bg-[#422f10] border border-[#644917] text-amber-300'
                }`}
                id="btn-mark-profile-leave"
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span>Leave</span>
              </button>

              {/* Clear */}
              <button
                type="button"
                onClick={() => handleSetStatus('not_marked')}
                className="h-8 px-2.5 rounded-xl bg-surface-34 hover:bg-edge-19 border border-[#263750] text-slate-400 hover:text-slate-200 text-xs font-medium cursor-pointer transition-colors"
                id="btn-mark-profile-clear"
                title="Reset status for this date"
              >
                Reset
              </button>

              {/* Save */}
              <button
                type="button"
                onClick={() => {
                  if (onUpdateStatus) {
                    onUpdateStatus(
                      selectedDate,
                      selectedDateRecord.status,
                      selectedDateRecord.checkInTime,
                      selectedDateRecord.remarks
                    );
                  }
                  triggerToast(`Saved ${memberType} attendance for ${selectedDate}`);
                }}
                className="h-8 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-md shadow-blue-600/30 ring-1 ring-blue-400"
                id="btn-save-profile-attendance"
                title="Save attendance for this date"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* 4. INTERACTIVE MONTHLY CALENDAR GRID                     */}
      {/* ======================================================== */}
      <div className="bg-surface-17 border border-edge-14 rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <span>{MONTH_NAMES[selectedMonth]} {selectedYear} Attendance Grid</span>
              <span className="text-xs text-slate-400 font-normal">
                (Click any date to select and update attendance)
              </span>
            </h4>
          </div>

          {/* Legend */}
          <div className="flex items-center flex-wrap gap-2.5 text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-emerald-500/80 inline-block" />
              <span>Present</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-teal-500/80 inline-block" />
              <span>Late</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-rose-500/80 inline-block" />
              <span>Absent</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-amber-500/80 inline-block" />
              <span>Leave</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-sky-500/80 inline-block" />
              <span>Holiday</span>
            </span>
          </div>
        </div>

        {/* 7-column calendar grid */}
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2 text-center text-xs">
          {WEEKDAY_NAMES.map(day => (
            <div key={day} className="text-[11px] font-bold text-slate-400 py-1 uppercase tracking-wider">
              {day}
            </div>
          ))}

          {/* Leading blank slots */}
          {Array.from({ length: calendarData.leadingBlanks }).map((_, i) => (
            <div key={`blank-${i}`} className="h-14 rounded-xl bg-transparent pointer-events-none" />
          ))}

          {/* Days */}
          {calendarData.days.map(d => {
            const isSelected = d.dateKey === selectedDate;

            let bgColor = 'bg-[#151d2c] border-[#222e44] text-slate-400';
            let badgeText = '-';
            let badgeStyle = 'text-slate-500';

            if (d.isHoliday) {
              bgColor = 'bg-sky-950/40 border-sky-800/40 text-sky-300';
              badgeText = 'Holiday';
              badgeStyle = 'text-sky-400 font-bold';
            } else if (d.status === 'present') {
              bgColor = 'bg-emerald-950/50 border-emerald-800/50 text-emerald-200';
              badgeText = 'P';
              badgeStyle = 'text-emerald-400 font-extrabold';
            } else if (d.status === 'late') {
              bgColor = 'bg-teal-950/50 border-teal-800/50 text-teal-200';
              badgeText = 'Late';
              badgeStyle = 'text-teal-400 font-extrabold';
            } else if (d.status === 'absent') {
              bgColor = 'bg-rose-950/50 border-rose-800/50 text-rose-200';
              badgeText = 'A';
              badgeStyle = 'text-rose-400 font-extrabold';
            } else if (d.status === 'leave') {
              bgColor = 'bg-amber-950/50 border-amber-800/50 text-amber-200';
              badgeText = 'Leave';
              badgeStyle = 'text-amber-400 font-bold';
            } else if (d.isWeekend) {
              bgColor = 'bg-[#101622] border-transparent text-slate-600';
              badgeText = 'Off';
              badgeStyle = 'text-slate-600';
            } else if (d.isFuture) {
              bgColor = 'bg-surface-18 border-transparent text-slate-600';
              badgeText = '';
            }

            return (
              <button
                key={d.dateKey}
                type="button"
                onClick={() => setSelectedDate(d.dateKey)}
                className={`h-14 rounded-xl flex flex-col items-center justify-between p-1.5 font-mono text-xs border transition-all cursor-pointer relative group ${bgColor} ${
                  isSelected
                    ? 'ring-2 ring-blue-500 border-blue-400 bg-blue-950/40 shadow-lg shadow-blue-500/20'
                    : 'hover:border-slate-500 hover:scale-[1.02]'
                }`}
                title={`${d.dateKey}: ${badgeText || 'Not marked'}${d.holidayReason ? ` (${d.holidayReason})` : ''}`}
              >
                <div className="flex items-center justify-between w-full px-0.5">
                  <span className={`text-[11px] font-bold ${isSelected ? 'text-blue-300 font-black' : ''}`}>
                    {d.dayNumber}
                  </span>
                  {isSelected && (
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  )}
                </div>

                <span className={`text-[10px] font-sans leading-none ${badgeStyle}`}>
                  {badgeText}
                </span>

                {d.checkInTime && (
                  <span className="text-[8px] text-slate-500 font-mono tracking-tighter truncate w-full">
                    {d.checkInTime}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ======================================================== */}
      {/* 5. DETAILED LOG TABLE FOR THE MONTH                      */}
      {/* ======================================================== */}
      <div className="bg-surface-17 border border-edge-14 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-[#1b2639] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-bold text-white">
              Daily Attendance Records ({MONTH_NAMES[selectedMonth]} {selectedYear})
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              History log of entries recorded for {memberName}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="select-status-filter" className="text-xs text-slate-400">Filter:</label>
            <select
              id="select-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-edge-3 border border-edge-34 text-xs text-white focus:outline-none cursor-pointer"
            >
              <option value="all">All Days</option>
              <option value="present">Present</option>
              <option value="late">Late</option>
              <option value="absent">Absent</option>
              <option value="leave">Leave</option>
              <option value="holiday">Holidays</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[380px]">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-surface-31 text-slate-400 font-semibold border-b border-[#1e2c42] sticky top-0 z-10">
              <tr>
                <th className="py-2.5 px-4">Date</th>
                <th className="py-2.5 px-4">Day</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4">Check-in Time</th>
                <th className="py-2.5 px-4">Remarks</th>
                {onUpdateStatus && <th className="py-2.5 px-4 text-right">Quick Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-edge-3">
              {calendarData.days
                .filter(d => {
                  if (statusFilter === 'all') return true;
                  if (statusFilter === 'holiday') return d.isHoliday;
                  return d.status === statusFilter;
                })
                .map(d => {
                  const isCurrentSelected = d.dateKey === selectedDate;
                  return (
                    <tr
                      key={d.dateKey}
                      className={`hover:bg-[#151f31] transition-colors cursor-pointer ${
                        isCurrentSelected ? 'bg-blue-950/20 font-medium' : ''
                      }`}
                      onClick={() => setSelectedDate(d.dateKey)}
                    >
                      <td className="py-2.5 px-4 font-mono text-white">
                        {d.dateKey}
                      </td>
                      <td className="py-2.5 px-4 text-slate-400">
                        {d.dayName}
                      </td>
                      <td className="py-2.5 px-4">
                        {d.isHoliday ? (
                          <span className="px-2 py-0.5 rounded bg-sky-950/60 text-sky-300 border border-sky-700/50 font-semibold text-[11px]">
                            Holiday: {d.holidayReason || 'Holiday'}
                          </span>
                        ) : d.status === 'present' ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-700/50 font-semibold text-[11px]">
                            Present
                          </span>
                        ) : d.status === 'late' ? (
                          <span className="px-2 py-0.5 rounded bg-teal-950/60 text-teal-300 border border-teal-700/50 font-semibold text-[11px]">
                            Late
                          </span>
                        ) : d.status === 'absent' ? (
                          <span className="px-2 py-0.5 rounded bg-rose-950/60 text-rose-300 border border-rose-700/50 font-semibold text-[11px]">
                            Absent
                          </span>
                        ) : d.status === 'leave' ? (
                          <span className="px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-700/50 font-semibold text-[11px]">
                            Leave
                          </span>
                        ) : d.isWeekend ? (
                          <span className="text-slate-500 font-mono text-[11px]">
                            Weekend Off
                          </span>
                        ) : (
                          <span className="text-slate-500 font-mono text-[11px]">
                            -
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-400">
                        {d.checkInTime || '-'}
                      </td>
                      <td className="py-2.5 px-4 text-slate-400">
                        {d.remarks || '-'}
                      </td>
                      {onUpdateStatus && (
                        <td className="py-2.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedDate(d.dateKey);
                                onUpdateStatus(d.dateKey, 'present', '08:00 AM', '-');
                                triggerToast(`Marked Present for ${d.dateKey}`);
                              }}
                              className={`px-2 py-1 rounded text-[11px] font-bold cursor-pointer transition-colors ${
                                d.status === 'present'
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-[#15231c] hover:bg-emerald-900/60 text-emerald-300 border border-emerald-700/40'
                              }`}
                            >
                              P
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedDate(d.dateKey);
                                onUpdateStatus(d.dateKey, 'absent', undefined, 'Unexcused');
                                triggerToast(`Marked Absent for ${d.dateKey}`);
                              }}
                              className={`px-2 py-1 rounded text-[11px] font-bold cursor-pointer transition-colors ${
                                d.status === 'absent'
                                  ? 'bg-rose-600 text-white'
                                  : 'bg-[#291417] hover:bg-rose-900/60 text-rose-300 border border-rose-700/40'
                              }`}
                            >
                              A
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedDate(d.dateKey);
                                onUpdateStatus(d.dateKey, 'leave', undefined, 'Approved Leave');
                                triggerToast(`Marked Leave for ${d.dateKey}`);
                              }}
                              className={`px-2 py-1 rounded text-[11px] font-bold cursor-pointer transition-colors ${
                                d.status === 'leave'
                                  ? 'bg-amber-600 text-white'
                                  : 'bg-[#2b1f0e] hover:bg-amber-900/60 text-amber-300 border border-amber-700/40'
                              }`}
                            >
                              L
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
