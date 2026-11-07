import React, { useEffect, useState } from 'react';
import { X, FileText, Download, Printer, ExternalLink } from 'lucide-react';
import { LedgerTransaction } from '../utils/ledgerStore';
import { formatPKR } from '../utils/ledgerStore';
import { getFile } from '../utils/blobStore';

interface DocumentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: LedgerTransaction | null;
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  isOpen,
  onClose,
  transaction
}) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const doc = transaction?.document;

  useEffect(() => {
    let url: string | null = null;
    let active = true;
    setBlobUrl(null);
    if (isOpen && doc?.fileId) {
      getFile(doc.fileId)
        .then(b => {
          if (active && b) {
            url = URL.createObjectURL(b);
            setBlobUrl(url);
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
  const isPdf = doc?.name.toLowerCase().endsWith('.pdf');
  const isImage = previewUrl && (doc?.name.toLowerCase().endsWith('.png') || doc?.name.toLowerCase().endsWith('.jpg') || doc?.name.toLowerCase().endsWith('.jpeg') || doc?.name.toLowerCase().endsWith('.webp'));

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    if (previewUrl) {
      const a = document.createElement('a');
      a.href = previewUrl;
      a.download = doc?.name || `Receipt_${transaction.id}`;
      a.click();
    } else {
      // Create minimal synthetic invoice text
      const content = `INVOICE / RECEIPT VOUCHER
-------------------------------------------
Voucher No: ${transaction.id}
Date: ${transaction.date} (${transaction.time})
Amount: ${formatPKR(transaction.amount)}
Type: ${transaction.type} (${transaction.paymentType})
Category: ${transaction.category || 'N/A'}
Description: ${transaction.reason}
Created By: ${transaction.createdBy}
Notes: ${transaction.note || 'None'}
-------------------------------------------
School Administration System
`;
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc?.name || `Receipt_${transaction.id}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="w-full max-w-2xl bg-[#0d1422] border border-[#202f47] rounded-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
        id="modal-document-preview"
      >
        {/* Header */}
        <div className="px-5 py-3.5 bg-surface-20 border-b border-edge-11 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-sm text-white">
            <FileText className="w-4 h-4 text-emerald-400" />
            <span>Document Preview • {doc?.name || 'Voucher Invoice'}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-surface-43 transition-colors cursor-pointer"
              title="Print Document"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-surface-43 transition-colors cursor-pointer"
              title="Download Document"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-surface-43 transition-colors cursor-pointer ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* If image */}
          {isImage && previewUrl ? (
            <div className="flex justify-center bg-black/40 p-4 rounded-xl border border-[#1b293e]">
              <img 
                src={previewUrl} 
                alt={doc?.name} 
                className="max-h-[380px] object-contain rounded-lg shadow-lg"
              />
            </div>
          ) : (
            /* Elegant Official Voucher Sheet */
            <div className="bg-white text-slate-900 rounded-xl p-6 shadow-xl border border-slate-200">
              <div className="border-2 border-slate-800 p-5 rounded-lg space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-300 pb-3">
                  <div>
                    <h2 className="text-lg font-black tracking-tight text-slate-900 uppercase">
                      OFFICIAL PAYMENT VOUCHER
                    </h2>
                    <p className="text-xs text-slate-600 font-medium">Cambridge Public School &amp; College System</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-500 block uppercase">Voucher ID</span>
                    <span className="font-mono font-bold text-xs text-slate-900">{transaction.id}</span>
                  </div>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 font-medium block">Date &amp; Time</span>
                    <span className="font-semibold text-slate-900">{transaction.date} • {transaction.time}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium block">Transaction Type</span>
                    <span className={`font-bold inline-block px-2 py-0.5 rounded text-[11px] ${
                      transaction.type === 'Incoming' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {transaction.type} ({transaction.paymentType})
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium block">Category</span>
                    <span className="font-semibold text-slate-900">{transaction.category || 'General'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium block">Created By</span>
                    <span className="font-semibold text-slate-900">{transaction.createdBy}</span>
                  </div>
                </div>

                {/* Description Banner */}
                <div className="bg-slate-50 border border-slate-200 p-3 rounded-md">
                  <span className="text-[11px] text-slate-500 font-medium block uppercase mb-1">
                    Particulars / Description
                  </span>
                  <p className="text-xs font-semibold text-slate-800">
                    {transaction.reason}
                  </p>
                  {transaction.note && (
                    <p className="text-[11px] text-slate-600 italic mt-1">
                      Note: {transaction.note}
                    </p>
                  )}
                </div>

                {/* Amount */}
                <div className="flex items-center justify-between border-t border-slate-300 pt-3">
                  <span className="text-xs font-bold text-slate-700 uppercase">
                    Total Amount
                  </span>
                  <span className="text-base font-black font-mono text-slate-900">
                    {formatPKR(transaction.amount)}
                  </span>
                </div>

                {/* Stamp / Signature placeholder */}
                <div className="pt-6 flex justify-between items-end text-[11px] text-slate-500">
                  <div className="text-center">
                    <div className="w-28 border-b border-dotted border-slate-400 mb-1" />
                    <span>Prepared By</span>
                  </div>
                  <div className="text-center">
                    <div className="w-28 border-b border-dotted border-slate-400 mb-1" />
                    <span>Accounts Officer</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
