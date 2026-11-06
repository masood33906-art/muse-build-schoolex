import React from 'react';
import { Search, X, Filter, ChevronDown } from 'lucide-react';
import { FilterState, ActiveTab, FilterStatus } from '../types';

interface FilterBarProps {
  filters: FilterState;
  onFilterChange: (newFilters: Partial<FilterState>) => void;
  classes: string[];
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  studentsCount: number;
  familiesCount: number;
  filteredCount: number;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  onFilterChange,
  classes,
  activeTab,
  onTabChange,
  studentsCount,
  familiesCount,
  filteredCount
}) => {
  const isFiltered = filters.class !== '' || filters.search.trim() !== '' || filters.status !== 'All';

  const resetFilters = () => {
    onFilterChange({ class: '', search: '', status: 'All' });
  };

  return (
    <div className="space-y-3 mb-4">
      {/* Top Tabs: Students vs Families */}
      <div className="flex items-center gap-2 border-b border-[#232d42] pb-2.5">
        <button
          type="button"
          onClick={() => onTabChange('students')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'students'
              ? 'bg-[#1e2638] text-white border border-[#2e3c59]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#151c2a]'
          }`}
          id="tab-students"
        >
          <span>Students</span>
          <span className={`text-[11px] px-1.5 py-0.2 rounded-full ${
            activeTab === 'students' ? 'bg-blue-500/20 text-blue-300' : 'bg-slate-800 text-slate-400'
          }`}>
            {studentsCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange('families')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'families'
              ? 'bg-[#1e2638] text-white border border-[#2e3c59]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#151c2a]'
          }`}
          id="tab-families"
        >
          <span>Families</span>
          <span className={`text-[11px] px-1.5 py-0.2 rounded-full ${
            activeTab === 'families' ? 'bg-purple-500/20 text-purple-300' : 'bg-slate-800 text-slate-400'
          }`}>
            {familiesCount}
          </span>
        </button>

        {isFiltered && activeTab === 'students' && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-slate-400">
              {filteredCount} of {studentsCount}
            </span>
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer font-medium"
            >
              <X className="w-3.5 h-3.5" />
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Filter and Search Controls - only visible for Students tab */}
      {activeTab === 'students' && (
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
          {/* Class Filter */}
          <div className="sm:col-span-3">
            <div className="relative">
              <select
                value={filters.class}
                onChange={(e) => onFilterChange({ class: e.target.value })}
                className="w-full bg-[#141a26] text-slate-200 text-xs font-medium rounded-lg border border-[#26354d] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none pl-3 pr-8 py-2.5 appearance-none cursor-pointer hover:bg-[#182030] hover:border-slate-500 transition-colors"
                id="filter-class"
              >
                <option value="">All Classes</option>
                {classes.map((cls) => (
                  <option key={cls} value={cls}>
                    {cls}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Search Input */}
          <div className="sm:col-span-6">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => onFilterChange({ search: e.target.value })}
                placeholder="Search by name, ID, family, class, phone..."
                className="w-full bg-[#141a26] text-slate-100 text-xs rounded-lg pl-9 pr-8 py-2.5 border border-[#26354d] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none placeholder-slate-500 hover:border-slate-500 transition-colors"
                id="search-input"
              />
              {filters.search && (
                <button
                  type="button"
                  onClick={() => onFilterChange({ search: '' })}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Status Filter */}
          <div className="sm:col-span-3">
            <div className="relative">
              <select
                value={filters.status}
                onChange={(e) => onFilterChange({ status: e.target.value as FilterStatus })}
                className="w-full bg-[#141a26] text-slate-200 text-xs font-medium rounded-lg border border-[#26354d] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none pl-3 pr-8 py-2.5 appearance-none cursor-pointer hover:bg-[#182030] hover:border-slate-500 transition-colors"
                id="filter-status"
              >
                <option value="All">All Status</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="New Admission">New Admissions</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
