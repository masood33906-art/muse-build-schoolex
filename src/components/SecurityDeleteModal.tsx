import React from 'react';
import { ShieldAlert, AlertTriangle, Trash2, X } from 'lucide-react';

export interface SecurityDeleteModalProps {
  isOpen: boolean;
  entityType: 'Student' | 'Class' | 'Section' | 'Record' | string;
  entityName: string;
  details?: string;
  warningNote?: string;
  confirmButtonText?: string;
  onConfirm: () => void;
  onClose: () => void;
}

export const SecurityDeleteModal: React.FC<SecurityDeleteModalProps> = ({
  isOpen,
  entityType,
  entityName,
  details,
  warningNote,
  confirmButtonText = 'Yes, Permanently Delete',
  onConfirm,
  onClose
}) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="security-delete-title"
    >
      <div 
        className="bg-[#0e1422] border-2 border-rose-500/40 rounded-2xl w-full max-w-lg shadow-2xl shadow-rose-950/50 overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Warning Top Banner */}
        <div className="bg-gradient-to-r from-rose-950/80 via-rose-900/40 to-slate-900/80 border-b border-rose-500/30 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center shrink-0 shadow-inner">
              <ShieldAlert className="w-5 h-5 text-rose-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30">
                  Critical Security Check
                </span>
              </div>
              <h3 id="security-delete-title" className="text-base font-extrabold text-white tracking-tight mt-0.5">
                Warning: Permanent Deletion
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 text-xs">
          {/* Target Entity Card */}
          <div className="bg-[#131b2e] border border-[#22314d] rounded-xl p-3.5 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#1a253d] border border-[#283b5e] text-slate-300 flex items-center justify-center shrink-0 mt-0.5 font-bold font-mono text-xs">
              {entityType.slice(0, 3).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Target {entityType}
              </div>
              <div className="text-sm font-bold text-white truncate mt-0.5">
                {entityName}
              </div>
              {details && (
                <div className="text-[11px] text-slate-300 font-mono mt-1">
                  {details}
                </div>
              )}
            </div>
          </div>

          {/* Prominent Irreversible Warning Callout */}
          <div className="bg-rose-950/30 border border-rose-500/40 rounded-xl p-4 flex items-start gap-3 text-rose-200">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1.5 text-xs leading-relaxed">
              <div className="font-extrabold text-rose-300 flex items-center gap-1.5 text-sm">
                <span>Irreversible System Action</span>
              </div>
              <p className="text-rose-200/90">
                This action is <strong className="text-white underline decoration-rose-400 decoration-2">permanent and cannot be undone</strong>. All related records, attendance logs, academic tracking, and historical data associated with this {entityType.toLowerCase()} will be purged completely.
              </p>
              {warningNote && (
                <p className="text-amber-300 font-medium pt-1 border-t border-rose-500/20 text-[11px]">
                  <strong>Notice:</strong> {warningNote}
                </p>
              )}
            </div>
          </div>

          <p className="text-slate-400 text-[11px] text-center pt-1">
            Please confirm your authorization to proceed with this destructive operation.
          </p>

          {/* Action Footer */}
          <div className="pt-3 border-t border-[#1e293b] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-[#141c2c] hover:bg-[#1a253a] border border-[#24334d] text-slate-300 hover:text-white font-semibold transition-colors cursor-pointer text-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-bold transition-all cursor-pointer text-xs shadow-lg shadow-rose-600/30 flex items-center gap-2"
              id="btn-confirm-permanent-delete"
            >
              <Trash2 className="w-4 h-4 text-white" />
              <span>{confirmButtonText}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
