import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';

interface DateTimePickerPopoverProps {
  isOpen: boolean;
  initialValue?: string;
  onSelect: (val: string) => void;
  onClose: () => void;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const HOURS = ['12', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11'];
const MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];
const PERIODS = ['AM', 'PM'] as const;

export const DateTimePickerPopover: React.FC<DateTimePickerPopoverProps> = ({
  isOpen,
  initialValue,
  onSelect,
  onClose
}) => {
  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonth, setCurrentMonth] = useState(8); // September (0-indexed)
  const [selectedDay, setSelectedDay] = useState(18);
  const [selectedHour, setSelectedHour] = useState('09');
  const [selectedMinute, setSelectedMinute] = useState('00');
  const [selectedPeriod, setSelectedPeriod] = useState<'AM' | 'PM'>('AM');
  const [showMonthYearPicker, setShowMonthYearPicker] = useState(false);

  // Parse initial value if provided (e.g. MM/DD/YYYY hh:mm aa or YYYY-MM-DD)
  useEffect(() => {
    if (initialValue && initialValue.trim()) {
      // Check for MM/DD/YYYY hh:mm aa format
      const match = initialValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})\s*(AM|PM)?)?$/i);
      if (match) {
        const m = parseInt(match[1], 10) - 1;
        const d = parseInt(match[2], 10);
        const y = parseInt(match[3], 10);
        if (!isNaN(m) && m >= 0 && m <= 11) setCurrentMonth(m);
        if (!isNaN(y)) setCurrentYear(y);
        if (!isNaN(d) && d >= 1 && d <= 31) setSelectedDay(d);
        if (match[4]) setSelectedHour(match[4].padStart(2, '0'));
        if (match[5]) setSelectedMinute(match[5].padStart(2, '0'));
        if (match[6]) setSelectedPeriod(match[6].toUpperCase() as 'AM' | 'PM');
        return;
      }

      // Check for YYYY-MM-DD format
      const dateMatch = initialValue.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (dateMatch) {
        setCurrentYear(parseInt(dateMatch[1], 10));
        setCurrentMonth(parseInt(dateMatch[2], 10) - 1);
        setSelectedDay(parseInt(dateMatch[3], 10));
      }
    }
  }, [initialValue, isOpen]);

  if (!isOpen) return null;

  // Days calculations
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay(); // 0 = Sunday
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const handleConfirm = () => {
    const mm = String(currentMonth + 1).padStart(2, '0');
    const dd = String(selectedDay).padStart(2, '0');
    const yyyy = currentYear;
    const formatted = `${mm}/${dd}/${yyyy} ${selectedHour}:${selectedMinute} ${selectedPeriod}`;
    onSelect(formatted);
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-[460px] bg-[#111927] border border-[#1e2d45] rounded-2xl shadow-2xl overflow-hidden p-5 flex flex-col gap-4 text-white"
        onClick={e => e.stopPropagation()}
      >
        {/* Main Content: Left Calendar + Right Time Columns */}
        <div className="flex gap-4">
          {/* LEFT: Calendar */}
          <div className="flex-1 min-w-[240px]">
            {/* Calendar Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowMonthYearPicker(!showMonthYearPicker)}
                  className="flex items-center gap-1.5 text-sm font-semibold text-white hover:text-blue-400 transition-colors cursor-pointer"
                >
                  <span>{MONTH_NAMES[currentMonth]} {currentYear}</span>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </button>

                {showMonthYearPicker && (
                  <div className="absolute top-full left-0 mt-1 z-20 bg-[#162236] border border-[#233550] rounded-xl p-2 shadow-xl grid grid-cols-3 gap-1 w-52 max-h-48 overflow-y-auto">
                    {MONTH_NAMES.map((name, idx) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => {
                          setCurrentMonth(idx);
                          setShowMonthYearPicker(false);
                        }}
                        className={`text-[11px] py-1 px-1.5 rounded-lg text-center cursor-pointer ${
                          currentMonth === idx 
                            ? 'bg-blue-600 text-white font-bold' 
                            : 'text-slate-300 hover:bg-[#1f304c]'
                        }`}
                      >
                        {name.slice(0, 3)}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-[#1a2840] transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-[#1a2840] transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Days of Week Header */}
            <div className="grid grid-cols-7 text-center text-xs font-semibold text-slate-400 mb-2">
              <span>S</span>
              <span>M</span>
              <span>T</span>
              <span>W</span>
              <span>T</span>
              <span>F</span>
              <span>S</span>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-y-1.5 text-center text-xs">
              {/* Padding for offset */}
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div key={`empty-${i}`} className="h-8" />
              ))}

              {/* Day cells */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const isSelected = selectedDay === day;

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setSelectedDay(day)}
                    className={`h-8 w-8 mx-auto flex items-center justify-center rounded-full text-xs font-medium transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white font-bold ring-2 ring-blue-400 shadow-md shadow-blue-600/30'
                        : 'text-slate-200 hover:bg-[#1b2b44] hover:text-white'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Vertical Divider */}
          <div className="w-[1px] bg-[#1d2a3e] self-stretch" />

          {/* RIGHT: Time Picker (3 Columns: Hours, Minutes, AM/PM) */}
          <div className="flex gap-2 text-xs">
            {/* Hours Column */}
            <div className="w-9 flex flex-col items-center">
              <div className="h-56 overflow-y-auto w-full space-y-1 pr-1 custom-scrollbar text-center">
                {HOURS.map(h => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setSelectedHour(h)}
                    className={`w-full py-1.5 rounded text-center text-xs transition-colors cursor-pointer ${
                      selectedHour === h
                        ? 'bg-blue-600 text-white font-bold'
                        : 'text-slate-400 hover:text-white hover:bg-[#18263c]'
                    }`}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>

            {/* Minutes Column */}
            <div className="w-9 flex flex-col items-center">
              <div className="h-56 overflow-y-auto w-full space-y-1 pr-1 custom-scrollbar text-center">
                {MINUTES.map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setSelectedMinute(m)}
                    className={`w-full py-1.5 rounded text-center text-xs transition-colors cursor-pointer ${
                      selectedMinute === m
                        ? 'bg-blue-600 text-white font-bold'
                        : 'text-slate-400 hover:text-white hover:bg-[#18263c]'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* AM / PM Column */}
            <div className="w-10 flex flex-col gap-1.5 pt-1">
              {PERIODS.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setSelectedPeriod(p)}
                  className={`w-full py-1.5 rounded text-center text-xs font-semibold transition-colors cursor-pointer ${
                    selectedPeriod === p
                      ? 'bg-blue-600 text-white font-bold'
                      : 'text-slate-400 hover:text-white hover:bg-[#18263c]'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions: Cancel & OK matching image */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1d2a3e]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow transition-all cursor-pointer"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};
