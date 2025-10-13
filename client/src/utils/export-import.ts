import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

// Export formats
export type ExportFormat = 'csv' | 'xlsx' | 'json' | 'pdf';

// Export configuration
interface ExportConfig {
  filename?: string;
  format: ExportFormat;
  columns?: string[];
  includeHeaders?: boolean;
  dateFormat?: string;
}

// Data transformation utilities
export class DataExporter {
  static async exportData<T extends Record<string, any>>(
    data: T[],
    config: ExportConfig
  ): Promise<void> {
    const {
      filename = `export_${new Date().toISOString().split('T')[0]}`,
      format,
      columns,
      includeHeaders = true,
      dateFormat = 'YYYY-MM-DD'
    } = config;

    try {
      // Filter columns if specified
      const processedData = columns 
        ? data.map(row => this.filterColumns(row, columns))
        : data;

      // Transform data for export
      const transformedData = processedData.map(row => this.transformRow(row, dateFormat));

      switch (format) {
        case 'csv':
          await this.exportCSV(transformedData, filename, includeHeaders);
          break;
        case 'xlsx':
          await this.exportXLSX(transformedData, filename, includeHeaders);
          break;
        case 'json':
          await this.exportJSON(transformedData, filename);
          break;
        case 'pdf':
          await this.exportPDF(transformedData, filename, includeHeaders);
          break;
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }

      toast.success(`Data exported successfully as ${format.toUpperCase()}`);
    } catch (error) {
      console.error('Export failed:', error);
      toast.error(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  private static filterColumns<T extends Record<string, any>>(
    row: T,
    columns: string[]
  ): Partial<T> {
    const filtered: Partial<T> = {};
    columns.forEach(col => {
      if (col in row) {
        filtered[col as keyof T] = row[col];
      }
    });
    return filtered;
  }

  private static transformRow(row: Record<string, any>, dateFormat: string): Record<string, any> {
    const transformed: Record<string, any> = {};
    
    Object.entries(row).forEach(([key, value]) => {
      if (value instanceof Date) {
        transformed[key] = this.formatDate(value, dateFormat);
      } else if (typeof value === 'object' && value !== null) {
        // Handle nested objects
        if (Array.isArray(value)) {
          transformed[key] = value.map(item => 
            typeof item === 'object' ? JSON.stringify(item) : item
          ).join(', ');
        } else {
          transformed[key] = JSON.stringify(value);
        }
      } else {
        transformed[key] = value;
      }
    });

    return transformed;
  }

  private static formatDate(date: Date, format: string): string {
    // Simple date formatting - could be enhanced with a library like date-fns
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return format
      .replace('YYYY', String(year))
      .replace('MM', month)
      .replace('DD', day);
  }

  private static async exportCSV(
    data: Record<string, any>[],
    filename: string,
    includeHeaders: boolean
  ): Promise<void> {
    if (data.length === 0) {
      throw new Error('No data to export');
    }

    const headers = Object.keys(data[0]);
    let csvContent = '';

    if (includeHeaders) {
      csvContent += headers.map(header => `"${header}"`).join(',') + '\n';
    }

    data.forEach(row => {
      const values = headers.map(header => {
        const value = row[header] ?? '';
        return `"${String(value).replace(/"/g, '""')}"`;
      });
      csvContent += values.join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `${filename}.csv`);
  }

  private static async exportXLSX(
    data: Record<string, any>[],
    filename: string,
    includeHeaders: boolean
  ): Promise<void> {
    const worksheet = XLSX.utils.json_to_sheet(data, { 
      skipHeader: !includeHeaders 
    });
    
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
    
    // Auto-size columns
    const colWidths = Object.keys(data[0] || {}).map(key => ({
      wch: Math.max(key.length, 15)
    }));
    worksheet['!cols'] = colWidths;

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    saveAs(blob, `${filename}.xlsx`);
  }

  private static async exportJSON(
    data: Record<string, any>[],
    filename: string
  ): Promise<void> {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    saveAs(blob, `${filename}.json`);
  }

  private static async exportPDF(
    data: Record<string, any>[],
    filename: string,
    includeHeaders: boolean
  ): Promise<void> {
    // This would require a PDF library like jsPDF or Puppeteer
    // For now, we'll create a simple HTML table and let the browser handle PDF generation
    const headers = Object.keys(data[0] || {});
    
    let htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Data Export</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; font-weight: bold; }
          tr:nth-child(even) { background-color: #f9f9f9; }
        </style>
      </head>
      <body>
        <h1>Data Export - ${new Date().toLocaleDateString()}</h1>
        <table>
    `;

    if (includeHeaders) {
      htmlContent += '<thead><tr>';
      headers.forEach(header => {
        htmlContent += `<th>${header}</th>`;
      });
      htmlContent += '</tr></thead>';
    }

    htmlContent += '<tbody>';
    data.forEach(row => {
      htmlContent += '<tr>';
      headers.forEach(header => {
        htmlContent += `<td>${row[header] ?? ''}</td>`;
      });
      htmlContent += '</tr>';
    });

    htmlContent += `
        </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const printWindow = window.open(url);
    
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
        setTimeout(() => {
          printWindow.close();
          URL.revokeObjectURL(url);
        }, 1000);
      };
    }
  }
}

// Import utilities
export class DataImporter {
  static async importFromFile<T = any>(
    file: File,
    options: {
      expectedColumns?: string[];
      validateRow?: (row: any) => boolean;
      transformRow?: (row: any) => T;
    } = {}
  ): Promise<T[]> {
    const { expectedColumns, validateRow, transformRow } = options;

    try {
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      let data: any[] = [];

      switch (fileExtension) {
        case 'csv':
          data = await this.parseCSV(file);
          break;
        case 'xlsx':
        case 'xls':
          data = await this.parseXLSX(file);
          break;
        case 'json':
          data = await this.parseJSON(file);
          break;
        default:
          throw new Error(`Unsupported file format: ${fileExtension}`);
      }

      // Validate columns if expected columns are provided
      if (expectedColumns && data.length > 0) {
        const actualColumns = Object.keys(data[0]);
        const missingColumns = expectedColumns.filter(col => !actualColumns.includes(col));
        
        if (missingColumns.length > 0) {
          throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
        }
      }

      // Validate and transform rows
      const processedData = data
        .filter(row => !validateRow || validateRow(row))
        .map(row => transformRow ? transformRow(row) : row);

      toast.success(`Successfully imported ${processedData.length} records`);
      return processedData;
    } catch (error) {
      console.error('Import failed:', error);
      toast.error(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  private static async parseCSV(file: File): Promise<any[]> {
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      throw new Error('File is empty');
    }

    const headers = this.parseCSVLine(lines[0]);
    const data: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      if (values.length === headers.length) {
        const row: any = {};
        headers.forEach((header, index) => {
          row[header] = values[index];
        });
        data.push(row);
      }
    }

    return data;
  }

  private static parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  }

  private static async parseXLSX(file: File): Promise<any[]> {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    return XLSX.utils.sheet_to_json(worksheet);
  }

  private static async parseJSON(file: File): Promise<any[]> {
    const text = await file.text();
    const data = JSON.parse(text);
    
    if (!Array.isArray(data)) {
      throw new Error('JSON file must contain an array of objects');
    }
    
    return data;
  }
}

// Bulk operations utility
export class BulkOperations {
  static async processBatch<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    options: {
      batchSize?: number;
      delayBetweenBatches?: number;
      onProgress?: (completed: number, total: number) => void;
      onError?: (error: Error, item: T) => void;
    } = {}
  ): Promise<R[]> {
    const {
      batchSize = 10,
      delayBetweenBatches = 100,
      onProgress,
      onError
    } = options;

    const results: R[] = [];
    const errors: Array<{ item: T; error: Error }> = [];

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (item) => {
        try {
          return await processor(item);
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          errors.push({ item, error: err });
          onError?.(err, item);
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter((result): result is R => result !== null));

      onProgress?.(Math.min(i + batchSize, items.length), items.length);

      // Delay between batches to avoid overwhelming the server
      if (i + batchSize < items.length && delayBetweenBatches > 0) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
      }
    }

    if (errors.length > 0) {
      console.warn(`Batch processing completed with ${errors.length} errors:`, errors);
    }

    return results;
  }
}

// Template generators for common export scenarios
export const ExportTemplates = {
  requirements: {
    columns: [
      'displayId',
      'jobTitle',
      'status',
      'clientCompany',
      'primaryTechStack',
      'rate',
      'appliedFor',
      'createdAt',
      'nextStep'
    ],
    filename: 'requirements_export'
  },

  consultants: {
    columns: [
      'displayId',
      'name',
      'email',
      'phone',
      'status',
      'visaStatus',
      'countryOfOrigin',
      'degreeName',
      'university',
      'createdAt'
    ],
    filename: 'consultants_export'
  },

  interviews: {
    columns: [
      'displayId',
      'jobTitle',
      'consultantName',
      'clientCompany',
      'status',
      'interviewDate',
      'interviewType',
      'createdAt'
    ],
    filename: 'interviews_export'
  }
};
