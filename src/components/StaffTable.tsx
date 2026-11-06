import React, { useState, useMemo } from 'react';
import { 
  MoreVertical, 
  ArrowUp, 
  ArrowDown, 
  IdCard, 
  Edit3, 
  Trash2, 
  UserX,
  FileText,
  Eye,
  Banknote
} from 'lucide-react';
import { StaffMember } from '../types';
import { getAvatarColor, getInitials } from '../data/initialStudents';

interface StaffTableProps {
  staffList: StaffMember[];
  onSelectStaff: (staff: StaffMember) => void;
  onOpenIdCardModal: (staff: StaffMember) => void;
  onOpenPayModal: (staff: StaffMember) => void;
  onOpenSalarySlipModal?: (staff: StaffMember) => void;
  onEditStaff: (staff: StaffMember) => void;
  onDeleteStaff: (staffId: string) => void;
  onTerminateStaff: (staffId: string) => void;
  onToggleStatus: (staffId: string) => void;
}

export const StaffTable: React.FC<StaffTableProps> = ({
  staffList,
  onSelectStaff,
  onOpenIdCardModal,
  onOpenPayModal,
  onOpenSalarySlipModal,
  onEditStaff,
  onDeleteStaff,
  onTerminateStaff,
  onToggleStatus
}) => {
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const sortedStaff = useMemo(() => {
    return [...staffList].sort((a, b) => {
      const aVal = a.name.toLowerCase();
      const bVal = b.name.toLowerCase();
      return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });
  }, [staffList, sortOrder]);

  const toggleSort = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  return (
    <div className="bg-[#101622] border border-[#1d273a] rounded-xl overflow-hidden shadow-xl flex flex-col">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[760px]">
          {/* Table Header */}
          <thead className="bg-[#131b28] border-b border-[#1f2a3d] text-xs font-semibold text-slate-400 select-none">
            <tr>
              {/* Name Column */}
              <th 
                className="py-3.5 px-5 cursor-pointer hover:text-white transition-colors group w-1/4"
                onClick={toggleSort}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-300 font-bold">Name</span>
                  {sortOrder === 'asc' ? (
                    <ArrowUp className="w-3.5 h-3.5 text-slate-300" />
                  ) : (
                    <ArrowDown className="w-3.5 h-3.5 text-slate-300" />
                  )}
                </div>
              </th>

              {/* CNIC Column */}
              <th className="py-3.5 px-4 font-semibold text-slate-400">
                CNIC
              </th>

              {/* Phone Number Column */}
              <th className="py-3.5 px-4 font-semibold text-slate-400">
                Phone Number
              </th>

              {/* Role Column */}
              <th className="py-3.5 px-4 font-semibold text-slate-400">
                Role
              </th>

              {/* Status Column */}
              <th className="py-3.5 px-4 font-semibold text-slate-400">
                Status
              </th>

              {/* Actions Column with Three Dots */}
              <th className="py-3.5 pr-5 pl-2 text-right w-12">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-[#172030] text-xs">
            {sortedStaff.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400">
                  <p className="text-sm font-medium text-slate-300">No staff members found.</p>
                  <p className="text-xs text-slate-500 mt-1">Try adjusting the search or category filters.</p>
                </td>
              </tr>
            ) : (
              sortedStaff.map((staff) => {
                const isMenuOpen = openMenuId === staff.id;
                const avatarBg = staff.avatarColor || getAvatarColor(staff.name);

                return (
                  <tr 
                    key={staff.id} 
                    onClick={() => onSelectStaff(staff)}
                    className="hover:bg-[#151e2c] transition-colors group cursor-pointer"
                  >
                    {/* Name & ID */}
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-3">
                        {/* Avatar */}
                        {staff.photo ? (
                          <img
                            src={staff.photo}
                            alt={staff.name}
                            className="w-8 h-8 rounded-full object-cover shrink-0 border border-[#2b3952]"
                          />
                        ) : (
                          <div
                            className={`w-8 h-8 rounded-full ${avatarBg} text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm`}
                          >
                            {getInitials(staff.name)}
                          </div>
                        )}

                        <div>
                          <div className="font-bold text-slate-100 group-hover:text-white transition-colors">
                            {staff.name}
                          </div>
                          <span className="text-[11px] text-[#38bdf8] hover:text-[#7dd3fc] font-mono block text-left">
                            {staff.id}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* CNIC */}
                    <td className="py-3 px-4 text-slate-300 font-mono text-[11px]">
                      {staff.cnic || '—'}
                    </td>

                    {/* Phone Number */}
                    <td className="py-3 px-4 text-slate-300 text-[11px]">
                      {staff.phone}
                    </td>

                    {/* Role */}
                    <td className="py-3 px-4 text-slate-300 text-[11px]">
                      {staff.role}
                    </td>

                    {/* Status Pill */}
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleStatus(staff.id);
                        }}
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                          staff.status === 'Active'
                            ? 'bg-[#0e2c20] text-[#4ade80] border border-[#164e3b] hover:bg-[#123829]'
                            : staff.status === 'Terminated'
                            ? 'bg-[#331117] text-[#f87171] border border-[#551d27] hover:bg-[#40161f]'
                            : staff.status === 'On Leave'
                            ? 'bg-[#2b2413] text-[#facc15] border border-[#4a3b1a] hover:bg-[#382f17]'
                            : 'bg-[#2d1418] text-[#f87171] border border-[#4d1f27] hover:bg-[#3d1820]'
                        }`}
                        title="Click to toggle status"
                      >
                        {staff.status}
                      </button>
                    </td>

                    {/* Actions Menu (Three Dots) */}
                    <td className="py-3 pr-5 pl-2 text-right relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(isMenuOpen ? null : staff.id);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1e293b] transition-colors cursor-pointer"
                        id={`btn-menu-${staff.id}`}
                        title="Actions"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {/* Dropdown Menu */}
                      {isMenuOpen && (
                        <>
                          <div 
                            className="fixed inset-0 z-20"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(null);
                            }}
                          />
                          <div 
                            className="absolute right-5 top-10 z-30 w-48 bg-[#141b27] border border-[#24334a] rounded-xl shadow-2xl py-1 text-xs text-left animate-in fade-in"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {/* View Info */}
                            <button
                              type="button"
                              onClick={() => {
                                onSelectStaff(staff);
                                setOpenMenuId(null);
                              }}
                              className="w-full px-3.5 py-2 text-slate-200 hover:bg-[#1c2738] flex items-center gap-2 cursor-pointer transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5 text-blue-400" />
                              <span>View Staff Details</span>
                            </button>

                            {/* Edit Staff Info */}
                            <button
                              type="button"
                              onClick={() => {
                                onEditStaff(staff);
                                setOpenMenuId(null);
                              }}
                              className="w-full px-3.5 py-2 text-slate-200 hover:bg-[#1c2738] flex items-center gap-2 cursor-pointer transition-colors"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-sky-400" />
                              <span>Edit Staff Info</span>
                            </button>

                            {/* ID Card */}
                            <button
                              type="button"
                              onClick={() => {
                                onOpenIdCardModal(staff);
                                setOpenMenuId(null);
                              }}
                              className="w-full px-3.5 py-2 text-slate-200 hover:bg-[#1c2738] flex items-center gap-2 cursor-pointer transition-colors"
                            >
                              <IdCard className="w-3.5 h-3.5 text-indigo-400" />
                              <span>View ID Card</span>
                            </button>

                            {/* Salary Slip */}
                            <button
                              type="button"
                              onClick={() => {
                                if (onOpenSalarySlipModal) {
                                  onOpenSalarySlipModal(staff);
                                } else {
                                  onOpenPayModal(staff);
                                }
                                setOpenMenuId(null);
                              }}
                              className="w-full px-3.5 py-2 text-slate-200 hover:bg-[#1c2738] flex items-center gap-2 cursor-pointer transition-colors"
                            >
                              <FileText className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Salary Slip</span>
                            </button>

                            <div className="border-t border-[#1e2a3c] my-1" />

                            {/* Terminate Staff */}
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`Terminate staff member ${staff.name} (${staff.id})?`)) {
                                  onTerminateStaff(staff.id);
                                }
                                setOpenMenuId(null);
                              }}
                              className="w-full px-3.5 py-2 text-amber-400 hover:bg-amber-500/10 flex items-center gap-2 cursor-pointer transition-colors"
                            >
                              <UserX className="w-3.5 h-3.5" />
                              <span>Terminate Staff</span>
                            </button>

                            {/* Delete Staff */}
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`Permanently delete ${staff.name} (${staff.id}) from system?`)) {
                                  onDeleteStaff(staff.id);
                                }
                                setOpenMenuId(null);
                              }}
                              className="w-full px-3.5 py-2 text-rose-400 hover:bg-rose-500/10 flex items-center gap-2 cursor-pointer transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete Staff</span>
                            </button>
                          </div>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

