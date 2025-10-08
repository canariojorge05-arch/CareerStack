const { parentPort, workerData } = require('worker_threads');
const fetch = require('node-fetch');
const FormData = require('form-data');

class ConversionWorker {
  constructor(libreOfficeUrl) {
    this.libreOfficeUrl = libreOfficeUrl;
  }

  async processJob(jobId, type, input, options = {}) {
    const startTime = Date.now();
    
    try {
      let result;
      
      switch (type) {
        case 'docx-to-html':
          result = await this.convertDocxToHtml(input, options);
          break;
        case 'html-to-docx':
          result = await this.convertHtmlToDocx(input, options);
          break;
        case 'batch-convert':
          result = await this.batchConvert(input, options);
          break;
        default:
          throw new Error(`Unknown conversion type: ${type}`);
      }
      
      const processingTime = Date.now() - startTime;
      
      parentPort.postMessage({
        jobId,
        success: true,
        data: result.data,
        hash: result.hash,
        metadata: {
          originalSize: Buffer.isBuffer(input) ? input.length : input.length,
          convertedSize: Buffer.isBuffer(result.data) ? result.data.length : result.data.length,
          processingTime
        }
      });
      
    } catch (error) {
      parentPort.postMessage({
        jobId,
        success: false,
        error: error.message,
        metadata: {
          processingTime: Date.now() - startTime
        }
      });
    }
  }

  async convertDocxToHtml(docxBuffer, options) {
    const formData = new FormData();
    formData.append('file', docxBuffer, {
      filename: options.filename || 'document.docx',
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });

    const response = await fetch(`${this.libreOfficeUrl}/convert/docx-to-html`, {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders()
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LibreOffice conversion failed: ${error}`);
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Conversion failed');
    }

    return {
      data: result.html,
      hash: result.hash
    };
  }

  async convertHtmlToDocx(htmlContent, options) {
    const response = await fetch(`${this.libreOfficeUrl}/convert/html-to-docx`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        html: htmlContent,
        template: options.template || 'default'
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LibreOffice conversion failed: ${error}`);
    }

    // Response is a DOCX file buffer
    const docxBuffer = await response.buffer();
    
    return {
      data: docxBuffer,
      hash: require('crypto').createHash('sha256').update(docxBuffer).digest('hex')
    };
  }

  async batchConvert(files, options) {
    const formData = new FormData();
    
    files.forEach((file, index) => {
      formData.append('files', file.buffer, {
        filename: file.filename || `document_${index}.docx`,
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });
    });

    const response = await fetch(`${this.libreOfficeUrl}/convert/batch`, {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders()
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LibreOffice batch conversion failed: ${error}`);
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Batch conversion failed');
    }

    return {
      data: result.results
    };
  }
}

// Initialize worker
const worker = new ConversionWorker(workerData.libreOfficeUrl);

// Listen for messages from main thread
parentPort.on('message', async ({ jobId, type, input, options }) => {
  await worker.processJob(jobId, type, input, options);
});
