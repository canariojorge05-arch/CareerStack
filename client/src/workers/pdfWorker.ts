/* eslint-disable no-restricted-globals */
import jsPDF from 'jspdf';

type PdfRequest = {
  type: 'pdf';
  pages: string[]; // data URLs
  watermark?: string;
};

type PdfResponse = {
  type: 'pdf_done';
  ok: true;
  buffer: ArrayBuffer;
} | {
  type: 'pdf_done';
  ok: false;
  error: string;
};

self.onmessage = async (e: MessageEvent<PdfRequest>) => {
  try {
    const { type, pages, watermark } = e.data;
    if (type !== 'pdf') return;
    const pdf = new jsPDF('p', 'pt', 'a4');
    for (let i = 0; i < pages.length; i++) {
      const img = pages[i];
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      pdf.addImage(img, 'JPEG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
      if (watermark) {
        pdf.setFontSize(48);
        pdf.setTextColor(150, 150, 150);
        pdf.text(watermark, pageWidth / 2, pageHeight / 2, { align: 'center', angle: 45 });
      }
      if (i < pages.length - 1) pdf.addPage();
    }
    const buffer = pdf.output('arraybuffer');
    const res: PdfResponse = { type: 'pdf_done', ok: true, buffer };
    (self as any).postMessage(res, [buffer as any]);
  } catch (err: any) {
    const res: PdfResponse = { type: 'pdf_done', ok: false, error: String(err?.message || err) };
    (self as any).postMessage(res);
  }
};
