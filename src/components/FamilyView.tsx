import React, { useMemo, useState } from 'react';
import { 
  Users, 
  Phone, 
  CreditCard, 
  GraduationCap, 
  ChevronRight, 
  ArrowUpDown, 
  Eye, 
  Search,
  MoreVertical,
  Pencil,
  X,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Student } from '../types';
import { getAvatarColor, getInitials } from '../data/initialStudents';
import { FamilyData } from './FamilyDetailsView';
import { groupStudentsIntoFamilies } from '../utils/familyHelper';

interface FamilyViewProps {
  students: Student[];
  onOpenIdCardModal?: (student: Student) => void;
  onSelectStudent?: (student: Student) => void;
  onSelectFamily?: (family: FamilyData) => void;
  onUpdateFamily?: (updated: FamilyData) => void;
}

type SortField = 'familyName' | 'familyId' | 'phone' | 'studentCount';
type SortOrder = 'asc' | 'desc';

export const FamilyView: React.FC<FamilyViewProps> = ({
  students,
  onSelectFamily,
  onUpdateFamily
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('familyName');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  
  // Action dropdown & edit modal state
  const [openActionMenuFamilyId, setOpenActionMenuFamilyId] = useState<string | null>(null);
  const [editingFamily, setEditingFamily] = useState<FamilyData | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Group students by Family — the shared derivation in
  // utils/familyHelper.ts. This view previously kept an inline copy of
  // the grouping whose fallbacks fabricated a guardian CNIC, email,
  // religion and street address for families missing them (owner rule,
  // 2026-11-08: blank in → blank stored/shown); the shared helper is
  // now the single source and carries no invented values.
  const familyGroups: FamilyData[] = useMemo(
    () => groupStudentsIntoFamilies(students),
    [students]
  );

  // Filter and sort
  const filteredFamilies = useMemo(() => {
    return familyGroups.filter(fam => {
      const query = searchQuery.toLowerCase().trim();
      if (!query) return true;
      const matchName = fam.familyName.toLowerCase().includes(query);
      const matchId = fam.familyId.toLowerCase().includes(query);
      const matchPhone = (fam.phone || '').toLowerCase().includes(query);
      const matchCnic = (fam.guardianCnic || '').toLowerCase().includes(query);
      const matchStudent = fam.students.some(s => s.name.toLowerCase().includes(query) || s.id.toLowerCase().includes(query));
      return matchName || matchId || matchPhone || matchCnic || matchStudent;
    }).sort((a, b) => {
      let comparison = 0;
      if (sortField === 'familyName') {
        comparison = a.familyName.localeCompare(b.familyName);
      } else if (sortField === 'familyId') {
        comparison = a.familyId.localeCompare(b.familyId);
      } else if (sortField === 'phone') {
        comparison = (a.phone || '').localeCompare(b.phone || '');
      } else if (sortField === 'studentCount') {
        comparison = a.students.length - b.students.length;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [familyGroups, searchQuery, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSaveEditFamily = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingFamily) return;

    const form = e.currentTarget;
    const formData = new FormData(form);

    // The form's values are stored as submitted (owner rule, 2026-11-08):
    // the old `|| editingFamily.…` fallbacks resurrected the previous
    // value whenever the user cleared a field, so a field could never
    // be emptied from this form.
    const updated: FamilyData = {
      ...editingFamily,
      familyName: (formData.get('familyName') as string) || '',
      phone: (formData.get('phone') as string) || '',
      guardianCnic: (formData.get('guardianCnic') as string) || '',
      guardianOccupation: (formData.get('guardianOccupation') as string) || '',
      whatsapp: (formData.get('whatsapp') as string) || '',
      email: (formData.get('email') as string) || '',
      address: (formData.get('address') as string) || '',
      motherName: (formData.get('motherName') as string) || '',
      motherCnic: (formData.get('motherCnic') as string) || '',
      motherOccupation: (formData.get('motherOccupation') as string) || '',
      caste: (formData.get('caste') as string) || '',
      religion: (formData.get('religion') as string) || ''
    };

    onUpdateFamily?.(updated);
    setEditingFamily(null);
    showToast(`Family ${updated.familyName} (${updated.familyId}) updated successfully`);
  };

  if (familyGroups.length === 0) {
    return (
      <div className="bg-surface-12 border border-[#20293d] rounded-xl p-12 text-center text-slate-400">
        <Users className="w-8 h-8 text-slate-500 mx-auto mb-2" />
        <p className="text-sm font-medium text-slate-300">No families found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Search and Summary Sub-bar: Family Accounts number alongside search box */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface-12 border border-[#20293d] rounded-xl p-3.5 shadow-md">
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center font-bold">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-white text-sm">
              {filteredFamilies.length}
            </span>
            <span className="text-slate-400 ml-1.5">
              {filteredFamilies.length === 1 ? 'Family Account' : 'Family Accounts'}
            </span>
          </div>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search family, phone, CNIC..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3.5 py-1.5 bg-surface-36 border border-edge-34 rounded-lg text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all"
            id="input-search-family"
          />
        </div>
      </div>

      {/* Redesigned Family Table */}
      <div className="bg-surface-12 border border-[#20293d] rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            
            {/* Table Header */}
            <thead>
              <tr className="border-b border-[#20293d] bg-[#0d121c] text-slate-300 font-semibold uppercase tracking-wider text-[11px]">
                
                {/* 1. Family (Name + ID) */}
                <th 
                  className="py-3.5 px-4 cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('familyName')}
                >
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-purple-400" />
                    <span>Family</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>

                {/* 2. Phone Number */}
                <th 
                  className="py-3.5 px-4 cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('phone')}
                >
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>Phone Number</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>

                {/* 3. CNIC */}
                <th className="py-3.5 px-4 text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                    <span>CNIC</span>
                  </div>
                </th>

                {/* 4. Students (Number of Students) */}
                <th 
                  className="py-3.5 px-4 cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('studentCount')}
                >
                  <div className="flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5 text-sky-400" />
                    <span>Students</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>

                {/* 5. Action (Three dots) */}
                <th className="py-3.5 pr-4 pl-2 text-right">
                  <span className="sr-only">Actions</span>
                </th>

              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-[#172235]">
              {filteredFamilies.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 italic">
                    No families found matching &ldquo;{searchQuery}&rdquo;
                  </td>
                </tr>
              ) : (
                filteredFamilies.map((family) => {
                  const initial = getInitials(family.familyName) || 'F';
                  const avatarBg = getAvatarColor(family.familyName);

                  return (
                    <tr
                      key={`${family.familyId}-${family.familyName}`}
                      onClick={() => onSelectFamily && onSelectFamily(family)}
                      className="group transition-colors duration-150 cursor-pointer hover:bg-[#161e2c]"
                      id={`row-family-${family.familyId}`}
                    >
                      
                      {/* 1. Family (Name, under which family number) */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-full ${avatarBg} text-white flex items-center justify-center font-bold text-xs shrink-0 shadow border border-white/10`}
                          >
                            {initial}
                          </div>
                          <div className="flex flex-col">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectFamily && onSelectFamily(family);
                              }}
                              className="font-bold text-slate-100 hover:text-purple-300 group-hover:text-white capitalize text-left cursor-pointer transition-colors text-xs"
                              title="View Family Profile"
                            >
                              {family.familyName}
                            </button>
                            <span className="text-xs text-purple-400 font-mono tracking-tight font-medium">
                              {family.familyId}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 2. Phone Number */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2 text-slate-300 font-mono">
                          <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span>{family.phone || '-'}</span>
                        </div>
                      </td>

                      {/* 3. CNIC */}
                      <td className="py-3.5 px-4">
                        <span className="text-slate-300 font-mono font-medium tracking-tight">
                          {family.guardianCnic || '—'}
                        </span>
                      </td>

                      {/* 4. Students (Number of Students ONLY) */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                          <Users className="w-3.5 h-3.5" />
                          <span>{family.students.length} {family.students.length === 1 ? 'Student' : 'Students'}</span>
                        </span>
                      </td>

                      {/* 5. Actions (Three Dots Dropdown) */}
                      <td 
                        className="py-3.5 pr-4 pl-2 text-right relative"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="relative inline-block text-left">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenActionMenuFamilyId(prev => prev === family.familyId ? null : family.familyId);
                            }}
                            className="p-1.5 rounded-lg bg-surface-35 hover:bg-[#1f2f4a] text-slate-300 hover:text-white border border-edge-32 text-xs transition-all cursor-pointer shadow-sm group-hover:border-purple-500/40"
                            id={`btn-menu-family-${family.familyId}`}
                            title="Family Options"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {/* Action Dropdown Menu */}
                          {openActionMenuFamilyId === family.familyId && (
                            <>
                              <div 
                                className="fixed inset-0 z-20"
                                onClick={() => setOpenActionMenuFamilyId(null)}
                              />
                              <div className="absolute right-0 mt-1 w-44 rounded-xl bg-surface-23 border border-[#263750] shadow-2xl z-30 py-1 text-xs animate-in fade-in zoom-in-95">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenActionMenuFamilyId(null);
                                    setEditingFamily(family);
                                  }}
                                  className="w-full text-left px-3.5 py-2 hover:bg-edge-23 text-slate-200 hover:text-purple-300 flex items-center gap-2 transition-colors cursor-pointer"
                                  id={`btn-action-edit-${family.familyId}`}
                                >
                                  <Pencil className="w-3.5 h-3.5 text-purple-400" />
                                  <span className="font-medium">Edit Family</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenActionMenuFamilyId(null);
                                    onSelectFamily && onSelectFamily(family);
                                  }}
                                  className="w-full text-left px-3.5 py-2 hover:bg-edge-23 text-slate-200 hover:text-sky-300 flex items-center gap-2 transition-colors cursor-pointer border-t border-[#1e2a3d]"
                                  id={`btn-action-view-${family.familyId}`}
                                >
                                  <Eye className="w-3.5 h-3.5 text-sky-400" />
                                  <span className="font-medium">View Profile</span>
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>

          </table>
        </div>
      </div>

      {/* Edit Family Modal */}
      {editingFamily && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-surface-13 border border-edge-30 rounded-2xl w-full max-w-2xl p-6 shadow-2xl animate-in zoom-in-95 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-edge-8 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Edit Family Account</h3>
                  <p className="text-xs text-slate-400 font-mono">ID: {editingFamily.familyId}</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setEditingFamily(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditFamily} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Family / Guardian Name</label>
                  <input
                    type="text"
                    name="familyName"
                    defaultValue={editingFamily.familyName}
                    required
                    className="w-full bg-surface-36 border border-edge-34 rounded-lg px-3 py-2 text-white focus:ring-1 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Guardian CNIC</label>
                  <input
                    type="text"
                    name="guardianCnic"
                    defaultValue={editingFamily.guardianCnic}
                    required
                    className="w-full bg-surface-36 border border-edge-34 rounded-lg px-3 py-2 text-white font-mono focus:ring-1 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Phone Number</label>
                  <input
                    type="text"
                    name="phone"
                    defaultValue={editingFamily.phone}
                    required
                    className="w-full bg-surface-36 border border-edge-34 rounded-lg px-3 py-2 text-white font-mono focus:ring-1 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">WhatsApp Number</label>
                  <input
                    type="text"
                    name="whatsapp"
                    defaultValue={editingFamily.whatsapp || ''}
                    className="w-full bg-surface-36 border border-edge-34 rounded-lg px-3 py-2 text-white font-mono focus:ring-1 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Guardian Occupation</label>
                  <input
                    type="text"
                    name="guardianOccupation"
                    defaultValue={editingFamily.guardianOccupation || ''}
                    className="w-full bg-surface-36 border border-edge-34 rounded-lg px-3 py-2 text-white focus:ring-1 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Email Address</label>
                  <input
                    type="email"
                    name="email"
                    defaultValue={editingFamily.email || ''}
                    className="w-full bg-surface-36 border border-edge-34 rounded-lg px-3 py-2 text-white focus:ring-1 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Residential Address</label>
                  <input
                    type="text"
                    name="address"
                    defaultValue={editingFamily.address || ''}
                    className="w-full bg-surface-36 border border-edge-34 rounded-lg px-3 py-2 text-white focus:ring-1 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-edge-8">
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                  Mother & Background Details
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Mother Name</label>
                    <input
                      type="text"
                      name="motherName"
                      defaultValue={editingFamily.motherName || ''}
                      className="w-full bg-surface-36 border border-edge-34 rounded-lg px-3 py-2 text-white focus:ring-1 focus:ring-purple-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Mother CNIC</label>
                    <input
                      type="text"
                      name="motherCnic"
                      defaultValue={editingFamily.motherCnic || ''}
                      className="w-full bg-surface-36 border border-edge-34 rounded-lg px-3 py-2 text-white font-mono focus:ring-1 focus:ring-purple-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Mother Occupation</label>
                    <input
                      type="text"
                      name="motherOccupation"
                      defaultValue={editingFamily.motherOccupation || ''}
                      className="w-full bg-surface-36 border border-edge-34 rounded-lg px-3 py-2 text-white focus:ring-1 focus:ring-purple-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Religion</label>
                  <input
                    type="text"
                    name="religion"
                    defaultValue={editingFamily.religion || ''}
                    className="w-full bg-surface-36 border border-edge-34 rounded-lg px-3 py-2 text-white focus:ring-1 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Caste</label>
                  <input
                    type="text"
                    name="caste"
                    defaultValue={editingFamily.caste || ''}
                    className="w-full bg-surface-36 border border-edge-34 rounded-lg px-3 py-2 text-white focus:ring-1 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-edge-8">
                <button
                  type="button"
                  onClick={() => setEditingFamily(null)}
                  className="px-4 py-2 rounded-lg bg-surface-24 hover:bg-surface-43 text-slate-300 font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold cursor-pointer transition-colors shadow-md shadow-purple-600/25"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
