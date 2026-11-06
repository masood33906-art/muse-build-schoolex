import React, { useEffect, useState } from 'react';
import { X, FileText, Download, CheckCircle } from 'lucide-react';
import { LedgerTransaction } from '../utils/ledgerStore';
import { getFile } from '../utils/blobStore';

interface LedgerDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: LedgerTransaction | null;
}

export const LedgerDocumentModal: React.FC<LedgerDocumentModalProps> = ({
  isOpen,
  onClose,
  transaction
}) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [blobMime, setBlobMime] = useState<string>('');
  const doc = transaction?.document;

  useEffect(() => {
    let url: string | null = null;
    let active = true;
    setBlobUrl(null);
    setBlobMime('');
    if (isOpen && doc?.fileId) {
      getFile(doc.fileId)
        .then(b => {
          if (active && b) {
            url = URL.createObjectURL(b);
            setBlobUrl(url);
            setBlobMime(b.type || '');
          }
        })
        .catch(() => {});
    }
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [isOpen, doc?.fileId]);

  if (!isOpen || !transaction) return null;

  const previewUrl = blobUrl || doc?.fileData || null;
  const isImage =
    (blobMime && blobMime.startsWith('image/')) ||
    (doc?.fileData && doc.fileData.startsWith('data:image')) ||
    /\.(png|jpe?g|webp|gif)$/i.test(doc?.name || '');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="w-full max-w-lg bg-[#0d1422] border border-[#202f47] rounded-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col animate-in zoom-in-95 duration-150"
        id="modal-ledger-document-preview"
      >
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#121b2b] border-b border-[#1b283d] flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-sm text-white">
            <FileText className="w-4 h-4 text-blue-400" />
            <span>Document Preview • {doc?.name || 'Invoice'}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-[#1a2538] transition-colors cursor-pointer"
            id="btn-close-doc-preview"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Transaction Metadata Card */}
          <div className="p-3 rounded-xl bg-[#080d16] border border-[#1b283d] space-y-2 text-xs">
            <div className="flex justify-between items-center text-slate-400">
              <span>Transaction ID</span>
              <span className="font-mono text-white">{transaction.id}</span>
            </div>
            <div className="flex justify-between items-center text-slate-400">
              <span>Date & Time</span>
              <span className="text-white">{transaction.date} • {transaction.time}</span>
            </div>
            <div className="flex justify-between items-center text-slate-400">
              <span>Reason / Description</span>
              <span className="text-white font-medium">{transaction.reason}</span>
            </div>
            <div className="flex justify-between items-center text-slate-400">
              <span>Amount</span>
              <span className="font-mono font-bold text-white">
                {transaction.amount.toLocaleString('en-PK')} PKR
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-400">
              <span>Payment Method</span>
              <span className="text-amber-400">{transaction.paymentType}</span>
            </div>
          </div>

          {/* Document Display */}
          <div className="rounded-xl border border-[#22334b] bg-[#090f1a] p-6 flex flex-col items-center justify-center text-center space-y-3 min-h-[220px]">
            {previewUrl && isImage ? (
              <img 
                src={previewUrl} 
                alt="Invoice Preview" 
                className="max-h-56 object-contain rounded-lg border border-[#23354e]" 
              />
            ) : (
              <div className="flex flex-col items-center space-y-2">
                <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <FileText className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">{doc?.name || 'Voucher_Invoice.pdf'}</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Official verified school transaction voucher
                  </p>
                </div>
                <div className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  <CheckCircle className="w-3 h-3" />
                  <span>Audited & Stamped</span>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-2 border-t border-[#172337]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#141d2c] hover:bg-[#1a263a] border border-[#23354e] text-slate-300 hover:text-white text-xs font-semibold cursor-pointer transition-all"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                if (previewUrl) {
                  const a = document.createElement('a');
                  a.href = previewUrl;
                  a.download = doc?.name || `Invoice_${transaction.id}`;
                  a.click();
                  return;
                }
                const dummyContent = `Transaction: ${transaction.id}\nDate: ${transaction.date}\nAmount: ${transaction.amount} PKR\nReason: ${transaction.reason}\nPayment: ${transaction.paymentType}`;
                const blob = new Blob([dummyContent], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = doc?.name || `Invoice_${transaction.id}.txt`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-blue-600/25 cursor-pointer transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download File</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

