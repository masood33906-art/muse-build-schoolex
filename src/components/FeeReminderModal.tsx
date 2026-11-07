import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Send, 
  Mail, 
  Copy, 
  Check, 
  Phone, 
  AtSign, 
  RotateCcw,
  ExternalLink
} from 'lucide-react';
import { Student } from '../types';
import { 
  formatPKR, 
  generatePersonalizedFeeMessage, 
  buildStudentBreakdownsForFamily,
  FamilyFeeSummary,
  StudentFeeBreakdownItem 
} from '../utils/feeHelper';
import { getSchoolSettings } from '../utils/settingsHelper';

// WhatsApp icon SVG component
const WhatsAppIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
  </svg>
);

export interface FeeReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  entryType?: 'family' | 'student';
  recipientName: string;
  studentName?: string;
  studentId?: string;
  studentClass?: string;
  phone: string;
  email?: string;
  familyId: string;
  studentNames: string[];
  amountDue: number;
  onSentConfirm?: (channel: 'whatsapp' | 'email') => void;
  family?: FamilyFeeSummary;
  students?: Student[];
  breakdowns?: StudentFeeBreakdownItem[];
  prefilledMessage?: string;
}

export const FeeReminderModal: React.FC<FeeReminderModalProps> = ({
  isOpen,
  onClose,
  entryType = 'family',
  recipientName,
  studentName,
  studentId,
  studentClass,
  phone,
  email,
  familyId,
  studentNames,
  amountDue,
  onSentConfirm,
  family,
  students = [],
  breakdowns,
  prefilledMessage
}) => {
  const [copied, setCopied] = useState(false);
  const [customPhone, setCustomPhone] = useState(phone || '');
  const [customEmail, setCustomEmail] = useState(email || '');

  const schoolSettings = useMemo(() => getSchoolSettings(), [isOpen]);

  // Compute breakdowns for itemized display if available
  const resolvedBreakdowns = useMemo(() => {
    if (breakdowns && breakdowns.length > 0) return breakdowns;
    if (entryType === 'student' && (studentName || recipientName)) {
      return [
        {
          id: studentId || 'S0000',
          name: studentName || recipientName,
          class: studentClass,
          studentRemainingDue: amountDue,
          lines: [
            {
              description: 'Monthly Fee',
              month: 'September 2026',
              pendingAmount: amountDue
            }
          ]
        }
      ];
    }
    if (family) {
      return buildStudentBreakdownsForFamily(family, students);
    }
    // Fallback from studentNames
    return studentNames.map(sStr => {
      const match = sStr.match(/^(.*?)(?:\s*\((.*?)\))?$/);
      const name = match ? match[1].trim() : sStr;
      const id = match && match[2] ? match[2].trim() : 'S0000';
      return {
        id,
        name,
        studentRemainingDue: amountDue,
        lines: [
          {
            description: 'Monthly Fee',
            month: 'September 2026',
            pendingAmount: amountDue
          }
        ]
      };
    });
  }, [breakdowns, entryType, studentName, recipientName, studentId, studentClass, amountDue, family, students, studentNames]);

  // Default personalized message
  const defaultMessage = useMemo(() => {
    if (prefilledMessage) return prefilledMessage;
    
    const famStudents: Student[] = family?.students && family.students.length > 0
      ? family.students
      : studentNames.map(sStr => {
          const match = sStr.match(/^(.*?)(?:\s*\((.*?)\))?$/);
          return {
            id: match && match[2] ? match[2].trim() : 'S0000',
            name: match ? match[1].trim() : sStr,
            family: recipientName,
            familyId,
            class: '',
            section: '',
            status: 'Active' as const,
            admissionDate: ''
          };
        });

    return generatePersonalizedFeeMessage({
      entryType: entryType === 'student' ? 'student' : 'family',
      studentName,
      studentId,
      studentClass,
      familyName: recipientName,
      familyId,
      students: famStudents,
      totalDue: amountDue,
      breakdowns: resolvedBreakdowns
    });
  }, [prefilledMessage, entryType, studentName, studentId, studentClass, family, recipientName, familyId, studentNames, amountDue, resolvedBreakdowns]);

  // Editable message state
  const [messageText, setMessageText] = useState(defaultMessage);

  // Sync state when modal opens or target changes
  useEffect(() => {
    if (isOpen) {
      setCustomPhone(phone || '');
      setCustomEmail(email || '');
      setMessageText(defaultMessage);
    }
  }, [isOpen, phone, email, defaultMessage, recipientName, familyId, studentId, amountDue]);

  if (!isOpen) return null;

  // Sanitize phone number for WhatsApp link
  let cleanPhone = customPhone.replace(/[^0-9+]/g, '');
  if (cleanPhone.startsWith('03')) {
    cleanPhone = '92' + cleanPhone.substring(1);
  } else if (cleanPhone.startsWith('+')) {
    cleanPhone = cleanPhone.substring(1);
  } else if (cleanPhone.startsWith('3')) {
    cleanPhone = '92' + cleanPhone;
  }

  // Copy message text
  const handleCopy = () => {
    navigator.clipboard.writeText(messageText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Option 1: Send WhatsApp Message
  const handleSendWhatsApp = () => {
    if (!cleanPhone) {
      alert('Please enter a valid phone number for WhatsApp.');
      return;
    }
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`;
    window.open(waUrl, '_blank');
    if (onSentConfirm) onSentConfirm('whatsapp');
    onClose();
  };

  // Option 2: Send Email
  const handleSendEmail = () => {
    const targetEmail = customEmail.trim();
    if (!targetEmail || !targetEmail.includes('@')) {
      alert('Please enter a valid email address.');
      return;
    }
    const subject = `Fee Reminder Notice - ${schoolSettings.name || 'The City Model School'}`;
    // Open Gmail web compose directly, or fallback
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(targetEmail)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(messageText)}`;
    window.open(gmailUrl, '_blank');
    if (onSentConfirm) onSentConfirm('email');
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      id="modal-fee-reminder"
    >
      <div 
        className="w-full max-w-xl bg-surface-9 border border-[#202f47] rounded-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col animate-in zoom-in-95 duration-200 max-h-[92vh]"
      >
        {/* Header - Minimal & Direct */}
        <div className="px-5 py-3.5 bg-surface-29 border-b border-edge-23 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">
                Send Fee Reminder
              </h2>
              <p className="text-[11px] text-slate-400">
                Choose WhatsApp or Email to dispatch reminder
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-edge-17 transition-colors cursor-pointer"
            id="btn-close-fee-reminder-modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Minimal Required Info Block (No extraneous metadata) */}
          <div className="p-3.5 bg-[#162134] border border-edge-32 rounded-xl flex items-center justify-between gap-4">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                {entryType === 'student' ? 'Student' : 'Family'}
              </span>
              <span className="font-bold text-white text-sm">
                {studentName || recipientName}
              </span>
              {studentId && (
                <span className="text-[11px] text-slate-400 font-mono ml-1.5">
                  ({studentId})
                </span>
              )}
              {entryType === 'student' && familyId && (
                <span className="text-[11px] text-slate-400 ml-1.5">
                  &bull; Family: {familyId}
                </span>
              )}
              {entryType === 'family' && familyId && (
                <span className="text-[11px] text-slate-400 font-mono ml-1.5">
                  ({familyId})
                </span>
              )}
              {studentClass && (
                <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 ml-2">
                  {studentClass}
                </span>
              )}
            </div>

            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Total Due
              </span>
              <span className="font-bold text-red-400 text-sm font-mono">
                {formatPKR(amountDue)}
              </span>
            </div>
          </div>

          {/* Minimal Contact Inputs: Phone & Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <Phone className="w-3 h-3 text-emerald-400" />
                <span>Phone / WhatsApp</span>
              </label>
              <input
                type="text"
                value={customPhone}
                onChange={(e) => setCustomPhone(e.target.value)}
                placeholder="e.g. 03025364738"
                className="w-full px-3 py-2 rounded-lg bg-surface-29 border border-[#243753] text-white text-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 font-mono"
                id="input-reminder-phone"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <AtSign className="w-3 h-3 text-blue-400" />
                <span>Email Address</span>
              </label>
              <input
                type="email"
                value={customEmail}
                onChange={(e) => setCustomEmail(e.target.value)}
                placeholder="e.g. parent@gmail.com"
                className="w-full px-3 py-2 rounded-lg bg-surface-29 border border-[#243753] text-white text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                id="input-reminder-email"
              />
            </div>
          </div>

          {/* TWO ACTION BUTTONS: Send WhatsApp Message OR Send Email */}
          <div className="pt-1">
            <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Dispatch Options
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Button 1: Send WhatsApp Message */}
              <button
                type="button"
                onClick={handleSendWhatsApp}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 transition-all cursor-pointer active:scale-98"
                id="btn-send-whatsapp-message"
              >
                <WhatsAppIcon className="w-4 h-4 shrink-0" />
                <span>Send WhatsApp Message</span>
                <ExternalLink className="w-3 h-3 opacity-80 shrink-0" />
              </button>

              {/* Button 2: Send Email */}
              <button
                type="button"
                onClick={handleSendEmail}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-950/40 transition-all cursor-pointer active:scale-98"
                id="btn-send-email-message"
              >
                <Mail className="w-4 h-4 shrink-0" />
                <span>Send Email</span>
                <ExternalLink className="w-3 h-3 opacity-80 shrink-0" />
              </button>
            </div>
          </div>

          {/* BELOW IT: EDITABLE MESSAGE TEXTAREA */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Editable Message
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMessageText(defaultMessage)}
                  className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors cursor-pointer"
                  title="Reset to default message"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="text-[11px] text-slate-300 hover:text-white flex items-center gap-1 px-2 py-0.5 rounded bg-[#1c283d] hover:bg-[#253652] border border-[#2b3c59] transition-colors cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400 font-semibold">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 text-slate-400" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <textarea
              rows={9}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Type or edit your fee reminder message..."
              className="w-full p-3.5 bg-surface-5 border border-edge-35 focus:border-blue-500/60 rounded-xl text-xs text-slate-200 font-mono whitespace-pre-wrap leading-relaxed focus:outline-none transition-colors"
              id="textarea-reminder-message"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Any edits made above will be included when you click either WhatsApp or Email button.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-surface-29 border-t border-edge-23 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-surface-45 hover:bg-[#25344a] text-slate-300 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
            id="btn-close-fee-reminder"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
