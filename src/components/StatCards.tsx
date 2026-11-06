import React from 'react';
import { Users, UserCheck, UserX, UserPlus } from 'lucide-react';
import { Student } from '../types';

interface StatCardsProps {
  students: Student[];
}

export const StatCards: React.FC<StatCardsProps> = ({
  students
}) => {
  const total = students.length;
  const active = students.filter(s => s.status === 'Active').length;
  const inactive = students.filter(s => s.status === 'Inactive').length;
  const newAdmissions = students.filter(s => s.isNewAdmission).length;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-5">
      {/* Total Students */}
      <div
        className="text-left rounded-xl p-4 flex items-center justify-between shadow-sm bg-[#141a26] border border-[#20293d]"
        id="stat-total-students"
      >
        <div>
          <p className="text-xs font-medium text-slate-400">Total Students</p>
          <h3 className="text-2xl font-bold text-white mt-1 tracking-tight">{total}</h3>
        </div>
        <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
          <Users className="w-5 h-5" />
        </div>
      </div>

      {/* Active Students */}
      <div
        className="text-left rounded-xl p-4 flex items-center justify-between shadow-sm bg-[#121f1c] border border-[#1b342e]"
        id="stat-active-students"
      >
        <div>
          <p className="text-xs font-medium text-emerald-400/90">Active</p>
          <h3 className="text-2xl font-bold text-emerald-400 mt-1 tracking-tight">{active}</h3>
        </div>
        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
          <UserCheck className="w-5 h-5" />
        </div>
      </div>

      {/* Inactive Students */}
      <div
        className="text-left rounded-xl p-4 flex items-center justify-between shadow-sm bg-[#201519] border border-[#352026]"
        id="stat-inactive-students"
      >
        <div>
          <p className="text-xs font-medium text-rose-400/90">Inactive</p>
          <h3 className="text-2xl font-bold text-rose-400 mt-1 tracking-tight">{inactive}</h3>
        </div>
        <div className="w-10 h-10 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
          <UserX className="w-5 h-5" />
        </div>
      </div>

      {/* New Admissions */}
      <div
        className="text-left rounded-xl p-4 flex items-center justify-between shadow-sm bg-[#1d162a] border border-[#302345]"
        id="stat-new-admissions"
      >
        <div>
          <p className="text-xs font-medium text-purple-300/90">New Admissions</p>
          <h3 className="text-2xl font-bold text-purple-300 mt-1 tracking-tight">{newAdmissions}</h3>
        </div>
        <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
          <UserPlus className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
};

