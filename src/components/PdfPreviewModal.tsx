import React, { useEffect, useState, useRef } from 'react';
import { 
  X, 
  Printer, 
  Download, 
  FileText, 
  ExternalLink, 
  CheckCircle,
  Loader2
} from 'lucide-react';
import { jsPDF } from 'jspdf';

interface PdfPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfDoc: jsPDF | null;
  title: string;
  subtitle?: string;
  fileName: string;
  recordCount?: number;
  sectionName?: string;
}

export const PdfPreviewModal: React.FC<PdfPreviewModalProps> = ({
  isOpen,
  onClose,
  pdfDoc,
  title,
  subtitle,
  fileName,
  recordCount,
  sectionName = 'Students'
}) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (isOpen && pdfDoc) {
      setIsGenerating(true);
      try {
        const blob = pdfDoc.output('blob');
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);
      } catch (err) {
        console.error('Error generating PDF preview blob:', err);
      } finally {
        setIsGenerating(false);
      }

      return () => {
        if (blobUrl) {
          URL.revokeObjectURL(blobUrl);
        }
      };
    } else {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
      setBlobUrl(null);
    }
  }, [isOpen, pdfDoc]);

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handlePrintOrSavePdf = () => {
    if (!blobUrl) return;

    try {
      // If the iframe is loaded, trigger its print dialog
      if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.focus();
        iframeRef.current.contentWindow.print();
        showToast('Print dialog opened. Select printer or "Save as PDF"');
        return;
      }
    } catch (e) {
      console.warn('Iframe print access limited, opening in new tab:', e);
    }

    // Fallback: open blob URL in new window for direct print / save
    const printWindow = window.open(blobUrl, '_blank');
    if (printWindow) {
      printWindow.focus();
    }
    showToast('Print window opened');
  };

  const handleDirectSavePdf = () => {
    if (!pdfDoc) return;
    pdfDoc.save(fileName);
    showToast(`Saved ${fileName} successfully`);
  };

  const handleOpenInNewTab = () => {
    if (blobUrl) {
      window.open(blobUrl, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-surface-12 border border-edge-32 rounded-2xl w-full max-w-5xl h-[92vh] flex flex-col shadow-2xl overflow-hidden"
        id="modal-pdf-preview"
      >
        {/* Toast Alert */}
        {toastMessage && (
          <div className="absolute top-4 right-4 z-50 bg-emerald-600 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 animate-in fade-in">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-edge-19 flex items-center justify-between bg-[#151e2e] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
                  {title}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  {sectionName}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {subtitle || 'Review the generated document before printing or saving to your device'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {blobUrl && (
              <button
                type="button"
                onClick={handleOpenInNewTab}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-edge-23 transition-colors cursor-pointer text-xs flex items-center gap-1"
                title="Open in new window"
              >
                <ExternalLink className="w-4 h-4" />
                <span className="hidden sm:inline">New Tab</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-edge-23 transition-colors cursor-pointer"
              title="Close Preview"
              id="btn-close-pdf-preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PDF Viewer Body */}
        <div className="flex-1 bg-[#0b1019] p-3 sm:p-4 overflow-hidden relative flex flex-col">
          {isGenerating ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3">
              <Loader2 className="w-8 h-8 text-red-400 animate-spin" />
              <p className="text-xs font-medium">Generating PDF preview...</p>
            </div>
          ) : blobUrl ? (
            <div className="w-full h-full rounded-xl overflow-hidden border border-[#223147] bg-[#1a202c] shadow-inner relative">
              <iframe
                ref={iframeRef}
                src={`${blobUrl}#toolbar=0&navpanes=0`}
                className="w-full h-full border-0 rounded-xl bg-white"
                title="PDF Document Preview"
                id="iframe-pdf-document"
              />
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-2">
              <FileText className="w-10 h-10 text-slate-600" />
              <p className="text-xs font-medium text-slate-300">Unable to generate document preview</p>
            </div>
          )}
        </div>

        {/* Modal Footer with Print/Save PDF and Cancel options */}
        <div className="px-5 py-3.5 bg-[#151e2e] border-t border-edge-19 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          {/* Metadata pill */}
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#1d283c] text-slate-300 font-mono text-[11px] border border-[#273752]">
              A4 Landscape
            </span>
            {recordCount !== undefined && (
              <span className="text-slate-400">
                <strong className="text-slate-200">{recordCount}</strong> records
              </span>
            )}
            <span className="text-slate-600">•</span>
            <span className="text-slate-400 font-mono text-[11px] truncate max-w-[200px]" title={fileName}>
              {fileName}
            </span>
          </div>

          {/* Action Buttons: Cancel, Save PDF, Print / Save PDF */}
          <div className="flex items-center justify-end gap-2.5">
            {/* Cancel Button */}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-[#1c2637] hover:bg-[#25334a] text-slate-300 hover:text-white text-xs font-medium cursor-pointer transition-colors border border-[#273852]"
              id="btn-cancel-pdf-preview"
            >
              Cancel
            </button>

            {/* Direct Save PDF Button */}
            <button
              type="button"
              onClick={handleDirectSavePdf}
              disabled={!pdfDoc}
              className="px-4 py-2 rounded-lg bg-[#1b2f4a] hover:bg-[#233d61] border border-[#264773] text-sky-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all shadow-sm disabled:opacity-50"
              id="btn-save-pdf-file"
              title="Directly save/download the PDF file"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Save PDF</span>
            </button>

            {/* Print / Save PDF Button */}
            <button
              type="button"
              onClick={handlePrintOrSavePdf}
              disabled={!blobUrl}
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-md shadow-red-600/25 disabled:opacity-50"
              id="btn-print-save-pdf"
              title="Open browser print dialog to print or save as PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
