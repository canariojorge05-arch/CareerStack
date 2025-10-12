import JSZip from 'jszip';
import * as Jimp from 'jimp';
const JimpLib = (Jimp as unknown) as any;

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

export async function extractDocxPreviewText(buffer: Buffer, maxChars: number = 800): Promise<string> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const docXml = await zip.file('word/document.xml')?.async('string');
    if (!docXml) return '';
    // Collect text nodes inside w:t and add paragraph breaks for w:p
    const textNodes: string[] = [];
    const tRegex = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
    let m: RegExpExecArray | null;
    while ((m = tRegex.exec(docXml)) !== null) {
      textNodes.push(decodeXmlEntities(m[1]));
      if (textNodes.join(' ').length > maxChars) break;
    }
    let text = textNodes.join(' ');
    if (text.length > maxChars) text = text.slice(0, maxChars) + '…';
    return text.trim();
  } catch {
    return '';
  }
}

export async function generateDocxFirstPageThumbnail(buffer: Buffer, options?: { width?: number; height?: number }): Promise<string | null> {
  try {
    const width = options?.width ?? 320; // small preview
    const height = options?.height ?? Math.round(width * 1.414); // A4-ish ratio

    const text = await extractDocxPreviewText(buffer);
  const img = await new JimpLib(width, height, 0xffffffff);

    // Header band
  img.scan(0, 0, width, 36, function(this: any, x: number, y: number, idx: number) {
      if (y < 36) {
        this.bitmap.data[idx + 0] = 242; // #f2f2f2
        this.bitmap.data[idx + 1] = 242;
        this.bitmap.data[idx + 2] = 242;
        this.bitmap.data[idx + 3] = 255;
      }
    });

  const fontTitle = await JimpLib.loadFont(JimpLib.FONT_SANS_16_BLACK);
  const fontBody = await JimpLib.loadFont(JimpLib.FONT_SANS_12_BLACK);

    // Title
  img.print(fontTitle, 10, 8, { text: 'Preview', alignmentX: JimpLib.HORIZONTAL_ALIGN_LEFT, alignmentY: JimpLib.VERTICAL_ALIGN_MIDDLE }, width - 20, 20);

    const bodyTop = 48;
    const maxBodyHeight = height - bodyTop - 10;
    const maxBodyWidth = width - 20;

    const preview = text || 'No extractable text';

    img.print(
      fontBody,
      10,
      bodyTop,
      {
        text: preview,
  alignmentX: JimpLib.HORIZONTAL_ALIGN_LEFT,
  alignmentY: JimpLib.VERTICAL_ALIGN_TOP,
      },
      maxBodyWidth,
      maxBodyHeight
    );

  const dataUrl = await img.getBase64Async(JimpLib.MIME_PNG);
    return dataUrl;
  } catch {
    return null;
  }
}
