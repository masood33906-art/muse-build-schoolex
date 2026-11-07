import React from 'react';
import { RegisterCardData, formatOrBlank } from '../utils/feeCardHelper';

/**
 * The ONE Student Fee Card "Register Card" design — the same
 * convergence pattern as FeeChallanSheet: the Fee Card modal preview,
 * the modal's print container and the Templates screen preview all
 * render THIS component from buildRegisterCardData, and the PDF
 * download (buildRegisterCardPdfDoc in feeCardHelper) renders the same
 * data in the same layout, so what the owner sees is what prints.
 *
 * Black & white register card after the owner's reference: double-ruled
 * border, arched school name with grey corner swooshes, principal /
 * address / Mob. lines from Settings (omitted when blank), student
 * particulars on dotted lines, a pinstriped FEE REGISTER heading, and
 * the 12-month table split ADMISSION FEE | TUITION FEE | FINE / EXTRA
 * with the two signature columns blank for handwriting.
 */
export const FeeRegisterCardSheet: React.FC<{
  data: RegisterCardData;
  /** true = Templates preview frame (max width + shadow). */
  framed?: boolean;
}> = ({ data, framed }) => {
  const archId = React.useId().replace(/[^a-zA-Z0-9]/g, '');
  const classValue = data.className + (data.section ? ` (${data.section})` : '');
  const nameLen = data.schoolName.length;
  const archFontSize = nameLen <= 18 ? 40 : nameLen <= 26 ? 32 : 25;
  const serif = { fontFamily: "Georgia, 'Times New Roman', serif" } as React.CSSProperties;

  return (
    <div className={`bg-white text-black font-sans ${framed ? 'w-full max-w-3xl shadow-2xl' : 'w-full'}`}>
      <div className="border-[3px] border-black p-[3px]">
        <div className="border border-black px-4 pt-2 pb-5 relative overflow-hidden">
          {/* Grey swoosh bands, top-right corner */}
          <svg
            className="absolute top-0 right-0 pointer-events-none"
            width="180"
            height="120"
            viewBox="0 0 180 120"
            aria-hidden="true"
          >
            <circle cx="180" cy="0" r="106" fill="none" stroke="#a8a8a8" strokeWidth="9" />
            <circle cx="180" cy="0" r="89" fill="none" stroke="#c6c6c6" strokeWidth="9" />
            <circle cx="180" cy="0" r="72" fill="none" stroke="#e2e2e2" strokeWidth="9" />
          </svg>

          <div className="relative">
            {/* Arched school name (from Settings; omitted when blank) */}
            {data.schoolName && (
              <svg viewBox="0 0 600 96" className="w-full h-[74px]" role="img" aria-label={data.schoolName}>
                <defs>
                  <path id={`arch-${archId}`} d="M 15,92 Q 300,-38 585,92" fill="none" />
                </defs>
                <text
                  fontSize={archFontSize}
                  fontWeight={900}
                  letterSpacing="1.5"
                  fill="#000"
                  style={{ fontFamily: 'Arial, Helvetica, sans-serif', textTransform: 'uppercase' }}
                >
                  <textPath href={`#arch-${archId}`} startOffset="50%" textAnchor="middle">
                    {data.schoolName.toUpperCase()}
                  </textPath>
                </text>
              </svg>
            )}

            {/* Principal line (the reference's head-of-school line) */}
            {data.principalName && (
              <div className="text-center font-bold text-[15px] leading-snug">
                <span className="underline underline-offset-4">Principal- {data.principalName}</span>
              </div>
            )}

            {/* Address line */}
            {data.schoolAddress && (
              <div className="text-center font-bold text-[13px] leading-snug">{data.schoolAddress}</div>
            )}

            <hr className="border-t-[1.5px] border-black my-1.5" />

            {/* Mob. line between rules (only when a phone is set) */}
            {data.schoolPhone && (
              <>
                <div className="text-center font-bold text-[15px] leading-snug">Mob.- {data.schoolPhone}</div>
                <hr className="border-t-[1.5px] border-black my-1.5" />
              </>
            )}

            {/* Student particulars on dotted lines */}
            <div className="mt-2 text-[13px]">
              <div className="flex items-end gap-1">
                <span style={serif} className="shrink-0">Name of the Student :</span>
                <span className="flex-1 border-b-2 border-dotted border-black font-bold px-2 min-h-[18px]">
                  {data.studentName}
                </span>
              </div>
              <div className="flex items-end gap-1 mt-2.5">
                <span style={serif} className="shrink-0">Class</span>
                <span className="border-b-2 border-dotted border-black font-bold px-2 min-h-[18px]" style={{ width: '27%' }}>
                  {classValue}
                </span>
                <span style={serif}>,</span>
                <span style={serif} className="shrink-0">Roll</span>
                <span className="border-b-2 border-dotted border-black font-bold px-2 min-h-[18px]" style={{ width: '17%' }}>
                  {data.rollNo}
                </span>
                <span style={serif}>,</span>
                <span style={serif} className="shrink-0">Session</span>
                <span className="flex-1 border-b-2 border-dotted border-black font-bold px-2 min-h-[18px]">
                  {data.academicSession}
                </span>
              </div>
            </div>

            <hr className="border-t-[1.5px] border-black mt-2.5" />

            {/* Display heading on pinstripes */}
            <div className="relative mt-2.5 mb-3 flex items-center justify-center">
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 space-y-[3px]" aria-hidden="true">
                {[150, 178, 205, 178, 150].map((g, i) => (
                  <div key={i} className="h-[2px]" style={{ background: `rgb(${g},${g},${g})` }} />
                ))}
              </div>
              <span
                className="relative bg-white px-4 font-black text-[26px] tracking-wide leading-none py-1"
                style={{ textShadow: '2px 2px 0 #a3a3a3' }}
              >
                FEE REGISTER
              </span>
            </div>

            {/* 12-month register table — charges split three ways */}
            <div className="rounded-[6px] border-2 border-black overflow-hidden">
              <table className="w-full border-collapse text-[11px]">
                <thead>
                  <tr className="bg-black text-white uppercase">
                    <th className="py-2 pl-3 pr-1 text-left font-bold border-r border-white">Month</th>
                    <th className="py-2 px-1 text-center font-bold leading-tight border-r border-white">Admission Fee</th>
                    <th className="py-2 px-1 text-center font-bold leading-tight border-r border-white">Tuition Fee</th>
                    <th className="py-2 px-1 text-center font-bold leading-tight border-r border-white">Fine / Extra</th>
                    <th className="py-2 px-1 text-center font-bold leading-tight border-r border-white">Teacher&apos;s Signature</th>
                    <th className="py-2 px-1 text-center font-bold leading-tight">Father&apos;s Signature</th>
                  </tr>
                </thead>
                <tbody>
                  {data.months.map(row => (
                    <tr key={row.month} className="border-t-[1.5px] border-black">
                      <td className="py-[9px] pl-3 pr-1 font-bold border-r-[1.5px] border-black whitespace-nowrap">
                        {row.month}
                      </td>
                      <td className="py-[9px] px-2 text-right font-mono border-r-[1.5px] border-black">
                        {formatOrBlank(row.admissionFee)}
                      </td>
                      <td className="py-[9px] px-2 text-right font-mono border-r-[1.5px] border-black">
                        {formatOrBlank(row.tuitionFee)}
                      </td>
                      <td className="py-[9px] px-2 text-right font-mono border-r-[1.5px] border-black">
                        {formatOrBlank(row.fineExtra)}
                      </td>
                      {/* Signature columns stay blank — handwritten at collection time. */}
                      <td className="border-r-[1.5px] border-black"></td>
                      <td></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
