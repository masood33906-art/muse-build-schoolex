import React from 'react';
import { GraduationCap, Users, BookOpen } from 'lucide-react';
import { StaffMember } from '../types';

interface StaffStatCardsProps {
  staffList: StaffMember[];
  onFilterCategory?: (category: string) => void;
  onFilterStatus?: (status: string) => void;
  onSelectTab?: (tab: 'all' | 'teachers' | 'support') => void;
}

export const StaffStatCards: React.FC<StaffStatCardsProps> = ({
  staffList,
  onFilterCategory,
  onFilterStatus,
  onSelectTab
}) => {
  const total = staffList.length;
  const active = staffList.filter(s => s.status === 'Active').length;
  const teachers = staffList.filter(s => s.category === 'Teacher' || s.role.toLowerCase() === 'teacher').length;
  const otherStaff = total - teachers;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Card 1: Total Staff (Pastel Baby Blue) */}
      <div 
        onClick={() => {
          if (onSelectTab) onSelectTab('all');
          if (onFilterCategory) onFilterCategory('All');
          if (onFilterStatus) onFilterStatus('All');
        }}
        className="bg-[#dff1fa] hover:bg-[#d5edfa] rounded-[20px] p-5 flex flex-col justify-between h-[130px] shadow-sm transition-all cursor-pointer relative overflow-hidden border border-[#cbe5f3]"
      >
        {/* Subtle decorative dot pattern */}
        <div className="absolute right-0 top-0 bottom-0 w-28 bg-[radial-gradient(#93c5fd_1px,transparent_1px)] [background-size:10px_10px] opacity-30 pointer-events-none" />
        
        <div>
          <div className="flex items-center gap-1.5 text-[#0369a1] mb-2">
            <GraduationCap className="w-6 h-6 stroke-[2.2]" />
            <GraduationCap className="w-5 h-5 -ml-2 stroke-[2.2] opacity-80" />
          </div>
          <p className="text-xs font-semibold text-slate-700 tracking-tight">Total Staff</p>
        </div>
        <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">{total}</h3>
      </div>

      {/* Card 2: Active Staff (Pastel Mint Green) */}
      <div 
        onClick={() => {
          if (onFilterStatus) onFilterStatus('Active');
        }}
        className="bg-[#daf7e1] hover:bg-[#cff5d8] rounded-[20px] p-5 flex flex-col justify-between h-[130px] shadow-sm transition-all cursor-pointer relative overflow-hidden border border-[#c3edd0]"
      >
        <div className="absolute right-0 top-0 bottom-0 w-28 bg-[radial-gradient(#86efac_1px,transparent_1px)] [background-size:10px_10px] opacity-30 pointer-events-none" />
        
        <div>
          <div className="flex items-center gap-1.5 text-[#15803d] mb-2">
            <GraduationCap className="w-6 h-6 stroke-[2.2]" />
          </div>
          <p className="text-xs font-semibold text-slate-700 tracking-tight">Active Staff</p>
        </div>
        <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">{active}</h3>
      </div>

      {/* Card 3: Teachers (Pastel Light Cyan / Turquoise) */}
      <div 
        onClick={() => {
          if (onSelectTab) onSelectTab('teachers');
          if (onFilterCategory) onFilterCategory('Teacher');
        }}
        className="bg-[#d2f7f4] hover:bg-[#c5f5f1] rounded-[20px] p-5 flex flex-col justify-between h-[130px] shadow-sm transition-all cursor-pointer relative overflow-hidden border border-[#bbf0ec]"
      >
        <div className="absolute right-0 top-0 bottom-0 w-28 bg-[radial-gradient(#5eead4_1px,transparent_1px)] [background-size:10px_10px] opacity-30 pointer-events-none" />
        
        <div>
          <div className="flex items-center gap-1.5 text-[#0f766e] mb-2">
            <Users className="w-6 h-6 stroke-[2.2]" />
          </div>
          <p className="text-xs font-semibold text-slate-700 tracking-tight">Teachers</p>
        </div>
        <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">{teachers}</h3>
      </div>

      {/* Card 4: Other Staff (Pastel Lavender / Purple) */}
      <div 
        onClick={() => {
          if (onSelectTab) onSelectTab('support');
          if (onFilterCategory) onFilterCategory('All');
        }}
        className="bg-[#f1e5fc] hover:bg-[#e9daf8] rounded-[20px] p-5 flex flex-col justify-between h-[130px] shadow-sm transition-all cursor-pointer relative overflow-hidden border border-[#e2cff6]"
      >
        <div className="absolute right-0 top-0 bottom-0 w-28 bg-[radial-gradient(#d8b4fe_1px,transparent_1px)] [background-size:10px_10px] opacity-30 pointer-events-none" />
        
        <div>
          <div className="flex items-center gap-1.5 text-[#7e22ce] mb-2">
            <BookOpen className="w-6 h-6 stroke-[2.2]" />
          </div>
          <p className="text-xs font-semibold text-slate-700 tracking-tight">Other Staff</p>
        </div>
        <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">{otherStaff}</h3>
      </div>
    </div>
  );
};
