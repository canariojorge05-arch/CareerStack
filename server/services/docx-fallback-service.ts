import JSZip from 'jszip';
import { DOMParser } from 'xmldom';

export interface DocxExtractionResult {
  success: boolean;
  html?: string;
  text?: string;
  error?: string;
}

export class DocxFallbackService {
  /**
   * Extract text content from DOCX file using JSZip
   * This is a fallback method when LibreOffice service is not available
   */
  async extractDocxContent(docxBuffer: Buffer): Promise<DocxExtractionResult> {
    try {
      // Load DOCX file as ZIP
      const zip = await JSZip.loadAsync(docxBuffer);
      
      // Get the main document content
      const documentXml = await zip.file('word/document.xml')?.async('text');
      if (!documentXml) {
        throw new Error('Could not find document.xml in DOCX file');
      }

      // Parse XML content
      const parser = new DOMParser();
      const doc = parser.parseFromString(documentXml, 'text/xml');
      
      // Extract text from paragraphs and runs
      const textContent = this.extractTextFromXml(doc);
      
      // Convert to basic HTML format
      const htmlContent = this.convertTextToHtml(textContent);
      
      return {
        success: true,
        html: htmlContent,
        text: textContent
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during DOCX extraction'
      };
    }
  }

  private extractTextFromXml(doc: Document): string {
    const textParts: string[] = [];
    
    // Find all text nodes in the document
    const textNodes = this.getElementsByTagName(doc, 'w:t');
    
    for (const textNode of textNodes) {
      const text = textNode.textContent;
      if (text && text.trim()) {
        textParts.push(text);
      }
    }
    
    return textParts.join(' ').trim();
  }

  private getElementsByTagName(doc: Document, tagName: string): Element[];
  private getElementsByTagName(element: Element, tagName: string): Element[];
  private getElementsByTagName(docOrElement: Document | Element, tagName: string): Element[] {
    const elements: Element[] = [];
    const nodeList = docOrElement.getElementsByTagName(tagName);
    
    for (let i = 0; i < nodeList.length; i++) {
      const node = nodeList.item(i);
      if (node && node.nodeType === 1) { // Element node
        elements.push(node as Element);
      }
    }
    
    return elements;
  }

  private convertTextToHtml(text: string): string {
    // Split text into paragraphs (basic heuristic)
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());
    
    if (paragraphs.length === 0) {
      paragraphs.push(text);
    }

    // Create basic HTML structure
    const htmlParagraphs = paragraphs.map(p => {
      const trimmed = p.trim().replace(/\s+/g, ' ');
      return `<p style="margin-bottom: 12px; line-height: 1.4;">${this.escapeHtml(trimmed)}</p>`;
    });

    return `
<div style="font-family: Calibri, sans-serif; font-size: 11pt; line-height: 1.15; margin: 0; padding: 40px; max-width: 8.5in; background: white;">
  ${htmlParagraphs.join('\n  ')}
</div>`.trim();
  }

  private escapeHtml(text: string): string {
    const div = { innerHTML: '' } as any;
    div.textContent = text;
    return div.innerHTML || text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Enhanced extraction that attempts to preserve some structure
   */
  async extractDocxContentEnhanced(docxBuffer: Buffer): Promise<DocxExtractionResult> {
    try {
      const zip = await JSZip.loadAsync(docxBuffer);
      const documentXml = await zip.file('word/document.xml')?.async('text');
      
      if (!documentXml) {
        throw new Error('Could not find document.xml in DOCX file');
      }

      const parser = new DOMParser();
      const doc = parser.parseFromString(documentXml, 'text/xml');
      
      // Extract structured content
      const htmlContent = this.extractStructuredHtml(doc);
      const textContent = this.extractPlainText(htmlContent);
      
      return {
        success: true,
        html: htmlContent,
        text: textContent
      };
      
    } catch (error) {
      // Fallback to simple extraction
      return this.extractDocxContent(docxBuffer);
    }
  }

  private extractStructuredHtml(doc: Document): string {
    const htmlParts: string[] = [];
    
    // Find all paragraphs
    const paragraphs = this.getElementsByTagName(doc, 'w:p');
    
    for (const paragraph of paragraphs) {
      const paragraphText = this.extractParagraphText(paragraph);
      if (paragraphText.trim()) {
        // Enhanced structure detection
        const isHeading = this.isHeadingParagraph(paragraph);
        const isContactInfo = this.isContactInfo(paragraphText);
        const isName = this.isNameHeading(paragraphText);
        const isBulletPoint = paragraphText.trim().startsWith('•') || paragraphText.trim().startsWith('-');
        
        if (isName) {
          htmlParts.push(`<div class="contact-info"><h1>${this.escapeHtml(paragraphText)}</h1></div>`);
        } else if (isContactInfo) {
          htmlParts.push(`<div class="contact-info"><p>${this.escapeHtml(paragraphText)}</p></div>`);
        } else if (isHeading) {
          htmlParts.push(`<div class="section"><h2>${this.escapeHtml(paragraphText)}</h2></div>`);
        } else if (isBulletPoint) {
          htmlParts.push(`<ul><li>${this.escapeHtml(paragraphText.replace(/^[•\-]\s*/, ''))}</li></ul>`);
        } else {
          htmlParts.push(`<p>${this.escapeHtml(paragraphText)}</p>`);
        }
      }
    }

    return `
<div style="font-family: Calibri, sans-serif; font-size: 11pt; line-height: 1.15; margin: 0; padding: 40px; max-width: 8.5in; background: white; box-shadow: 0 0 20px rgba(0,0,0,0.1); margin: 20px auto;">
  <style>
    /* Professional resume styling */
    .resume-page {
      min-height: 11in;
      width: 8.5in;
      padding: 1in;
      margin: 0 auto 20px auto;
      background: white;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      page-break-after: always;
    }
    
    /* Header styling */
    h1, h2, h3 {
      color: #2c3e50;
      margin-top: 20px;
      margin-bottom: 10px;
      font-weight: bold;
    }
    
    h1 { font-size: 24pt; margin-top: 0; }
    h2 { font-size: 16pt; border-bottom: 2px solid #3498db; padding-bottom: 5px; }
    h3 { font-size: 14pt; color: #34495e; }
    
    /* Contact info styling */
    .contact-info {
      text-align: center;
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 1px solid #bdc3c7;
    }
    
    /* Section styling */
    .section {
      margin-bottom: 25px;
    }
    
    /* List styling */
    ul, ol {
      margin: 10px 0;
      padding-left: 25px;
    }
    
    li {
      margin-bottom: 5px;
      line-height: 1.4;
    }
    
    /* Professional spacing */
    p {
      margin: 8px 0;
      line-height: 1.4;
    }
    
    /* Skills and technologies */
    .tech-stack {
      display: inline-block;
      background: #ecf0f1;
      padding: 3px 8px;
      margin: 2px;
      border-radius: 3px;
      font-size: 10pt;
    }
  </style>
  
  <div class="resume-page">
    ${htmlParts.join('\n    ')}
  </div>
</div>`.trim();
  }

  private extractParagraphText(paragraph: Element): string {
    const textParts: string[] = [];
    const runs = this.getElementsByTagName(paragraph, 'w:r');
    
    for (const run of runs) {
      const textNodes = this.getElementsByTagName(run, 'w:t');
      for (const textNode of textNodes) {
        const text = textNode.textContent;
        if (text) {
          textParts.push(text);
        }
      }
    }
    
    return textParts.join('').trim();
  }

  private isHeadingParagraph(paragraph: Element): boolean {
    // Simple heuristic: check for style or formatting that might indicate a heading
    const paragraphProps = paragraph.getElementsByTagName('w:pPr')[0];
    if (paragraphProps) {
      const style = paragraphProps.getElementsByTagName('w:pStyle')[0];
      if (style) {
        const val = style.getAttribute('w:val');
        return val ? val.toLowerCase().includes('heading') : false;
      }
    }
    
    // Fallback: check if text is short and might be a title
    const text = this.extractParagraphText(paragraph);
    return text.length < 100 && text.length > 0 && !text.includes('.');
  }

  private extractPlainText(html: string): string {
    return html
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private isContactInfo(text: string): boolean {
    // Check if text contains contact information patterns
    const contactPatterns = [
      /@/,  // Email
      /\(\d{3}\)/,  // Phone with area code
      /\d{3}-\d{3}-\d{4}/,  // Phone format
      /\d{3}\.\d{3}\.\d{4}/,  // Phone format
      /linkedin\.com/i,
      /github\.com/i,
      /\b\d{5}\b/,  // ZIP code
      /\b(street|st|avenue|ave|road|rd|drive|dr|lane|ln|boulevard|blvd)\b/i
    ];
    
    return contactPatterns.some(pattern => pattern.test(text));
  }

  private isNameHeading(text: string): boolean {
    // Check if text looks like a person's name (first line, short, title case)
    const trimmed = text.trim();
    const words = trimmed.split(/\s+/);
    
    // Name characteristics: 2-4 words, each capitalized, no special chars except periods
    return words.length >= 2 && 
           words.length <= 4 && 
           words.every(word => /^[A-Z][a-z]*\.?$/.test(word)) &&
           trimmed.length < 50;
  }
}

export const docxFallbackService = new DocxFallbackService();
