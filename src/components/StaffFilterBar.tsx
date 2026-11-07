import React from 'react';
import { Search, ChevronDown } from 'lucide-react';
import { StaffFilterState } from '../types';

interface StaffFilterBarProps {
  filters: StaffFilterState;
  onFilterChange: (newFilters: Partial<StaffFilterState>) => void;
  activeTab: 'all' | 'teachers' | 'support';
  onTabChange: (tab: 'all' | 'teachers' | 'support') => void;
  totalCount: number;
  teachersCount: number;
  otherStaffCount: number;
}

export const StaffFilterBar: React.FC<StaffFilterBarProps> = ({
  filters,
  onFilterChange,
  activeTab,
  onTabChange,
  totalCount,
  teachersCount,
  otherStaffCount
}) => {
  return (
    <div className="space-y-3 mb-5">
      {/* Category Tabs (All 28, Teachers 19, Other Staff 9) */}
      <div className="flex items-center gap-2">
        {/* All Tab */}
        <button
          type="button"
          onClick={() => onTabChange('all')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
            activeTab === 'all'
              ? 'bg-surface-37 text-white border-[#2b3952]'
              : 'bg-transparent text-slate-400 border-transparent hover:text-slate-200 hover:bg-surface-16'
          }`}
          id="tab-staff-all"
        >
          <span>All</span>
          <span className={`text-[11px] font-bold px-1.5 py-0.2 rounded-md ${
            activeTab === 'all' ? 'bg-white text-slate-900' : 'bg-[#1c2436] text-slate-400'
          }`}>
            {totalCount}
          </span>
        </button>

        {/* Teachers Tab */}
        <button
          type="button"
          onClick={() => onTabChange('teachers')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
            activeTab === 'teachers'
              ? 'bg-surface-37 text-white border-[#2b3952]'
              : 'bg-transparent text-slate-400 border-transparent hover:text-slate-200 hover:bg-surface-16'
          }`}
          id="tab-staff-teachers"
        >
          <span>Teachers</span>
          <span className={`text-[11px] font-bold px-1.5 py-0.2 rounded-md ${
            activeTab === 'teachers' ? 'bg-white text-slate-900' : 'bg-[#1c2436] text-slate-400'
          }`}>
            {teachersCount}
          </span>
        </button>

        {/* Other Staff Tab */}
        <button
          type="button"
          onClick={() => onTabChange('support')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
            activeTab === 'support'
              ? 'bg-surface-37 text-white border-[#2b3952]'
              : 'bg-transparent text-slate-400 border-transparent hover:text-slate-200 hover:bg-surface-16'
          }`}
          id="tab-staff-other"
        >
          <span>Other Staff</span>
          <span className={`text-[11px] font-bold px-1.5 py-0.2 rounded-md ${
            activeTab === 'support' ? 'bg-white text-slate-900' : 'bg-[#1c2436] text-slate-400'
          }`}>
            {otherStaffCount}
          </span>
        </button>
      </div>

      {/* Search and Status Dropdown Row */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3 pointer-events-none" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => onFilterChange({ search: e.target.value })}
            placeholder="Search by name, ID, father name or phone..."
            className="w-full bg-surface-12 border border-[#1f293d] rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
            id="input-staff-search"
          />
        </div>

        {/* Status Dropdown */}
        <div className="w-full sm:w-44">
          <label className="block text-[10px] text-slate-400 mb-1 font-medium">Status</label>
          <div className="relative">
            <select
              value={filters.status}
              onChange={(e) => onFilterChange({ status: e.target.value as any })}
              className="w-full appearance-none bg-surface-12 border border-[#1f293d] rounded-xl px-3 py-2 text-xs text-slate-200 font-medium focus:outline-none focus:border-blue-500 cursor-pointer"
              id="select-staff-status"
            >
              <option value="Active">Active</option>
              <option value="All">All Statuses</option>
              <option value="Inactive">Inactive</option>
              <option value="On Leave">On Leave</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
          </div>
        </div>
      </div>
    </div>
  );
};
