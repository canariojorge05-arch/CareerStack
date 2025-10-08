# AI Editor's Guide to DOCX Processing in Resume Customizer Pro

## Quick Navigation
- [System Overview](#system-overview)
- [Module Dependencies](#module-dependencies)
- [Key Files and Their Purposes](#key-files-and-their-purposes)
- [Core Operations](#core-operations)
- [Common Edit Scenarios](#common-edit-scenarios)
- [Error Handling Patterns](#error-handling-patterns)

## System Overview

### Architecture at a Glance
```
User Upload → Backend Processing → LibreOffice Conversion → Editor Display
                     ↓                      ↓                    ↓
              Input Validation     Format Preservation     Real-time Editing
```

### Key Components and Their Relationships
1. **Upload Handler** ➔ Receives DOCX files
2. **Conversion Service** ➔ Transforms DOCX to HTML
3. **Editor Interface** ➔ Manages document editing
4. **Fallback Service** ➔ Handles conversion failures

## Module Dependencies

### Required System Components
- LibreOffice (Primary Converter)
- Python 3.11+ (Conversion Service)
- Node.js (Backend Server)

### NPM Packages
```json
{
  "dependencies": {
    "jszip": "For DOCX parsing",
    "xmldom": "For XML processing",
    "multer": "For file uploads"
  }
}
```

## Key Files and Their Purposes

### 1. Upload Flow Files
```plaintext
server/
├── routes/
│   └── uploadRoutes.ts       # Route definitions for file uploads
├── controllers/
│   └── uploadController.ts   # Upload handling logic
└── services/
    ├── conversion-service.ts # Main conversion orchestrator
    └── docx-fallback-service.ts # Backup conversion method
```

### 2. LibreOffice Service Files
```plaintext
docker/libreoffice/
├── conversion-service.py     # Python-based LibreOffice converter
├── templates/               # HTML output templates
└── test_libreoffice.py     # Connection testing utility
```

### 3. Editor Components
```plaintext
client/src/
└── components/
    └── DocumentEditor/      # React-based editor components
```

## Core Operations

### 1. DOCX Upload Process
```typescript
// Flow Description for AI
interface UploadFlow {
    steps: [
        "1. Receive multipart form data",
        "2. Validate file type and size",
        "3. Save to temporary storage",
        "4. Initialize conversion process",
        "5. Return conversion status"
    ];
    
    errorHandling: {
        invalidType: "Return 415 Unsupported Media Type",
        sizeExceeded: "Return 413 Payload Too Large",
        conversionFailed: "Attempt fallback conversion"
    };
}
```

### 2. Conversion Process
```python
# AI Note: This is the primary conversion logic
class ConversionProcess:
    """
    Steps:
    1. Start LibreOffice in headless mode
    2. Load DOCX into LibreOffice
    3. Export as HTML with style preservation
    4. Post-process HTML for exact formatting
    5. Clean up temporary files
    """
```

### 3. Editor Integration
```typescript
// AI Note: Editor initialization and state management
interface EditorState {
    document: {
        id: string;           // Document identifier
        content: string;      // HTML content
        originalFormat: DOCX; // Original file reference
        lastModified: Date;   // Last edit timestamp
    };
    
    operations: {
        save: "Triggered on content change",
        revert: "Restore from original",
        export: "Generate new DOCX"
    };
}
```

## Common Edit Scenarios

### 1. Content Modifications
```typescript
// AI Note: Handle these edit operations carefully
interface EditOperations {
    textEdit: "Preserve original formatting",
    tableEdit: "Maintain table structure",
    imageEdit: "Keep image alignment and wrapping",
    styleEdit: "Update without breaking original styles"
}
```

### 2. Format Preservation
```css
/* AI Note: Critical CSS rules for format preservation */
.docx-content {
    /* Preserve exact dimensions */
    box-sizing: border-box;
    
    /* Maintain font metrics */
    -webkit-text-size-adjust: 100%;
    
    /* Keep original spacing */
    white-space: pre-wrap;
}
```

## Error Handling Patterns

### 1. Upload Errors
```typescript
// AI Note: Common upload error patterns
const handleUploadError = async (error: UploadError) => {
    if (error.type === 'CONVERSION_FAILED') {
        return await initiateBackupConversion();
    }
    if (error.type === 'LIBREOFFICE_UNAVAILABLE') {
        return await useFallbackService();
    }
};
```

### 2. Conversion Errors
```python
# AI Note: Conversion error recovery strategy
def handle_conversion_error(self, error):
    """
    Error Recovery Steps:
    1. Log error details
    2. Attempt reconnection to LibreOffice
    3. If reconnection fails, use fallback service
    4. If all fails, return error with recovery suggestions
    """
```

## AI Editor Tips

### 1. Format Preservation Priorities
- Maintain exact spacing and margins
- Preserve font properties
- Keep table layouts intact
- Retain image positions and wrapping

### 2. Common Pitfalls
- Don't modify style attributes directly
- Preserve white-space in text nodes
- Handle nested tables carefully
- Maintain image aspect ratios

### 3. Performance Considerations
- Cache converted documents
- Clean up temporary files
- Monitor LibreOffice process memory
- Handle large files in chunks

## Testing and Validation

### 1. Connection Testing
```python
# AI Note: Use this to verify LibreOffice connectivity
def test_libreoffice_connection():
    """
    Check:
    1. LibreOffice process status
    2. Port availability (2002)
    3. UNO bridge connection
    4. Conversion capabilities
    """
```

### 2. Format Validation
```typescript
// AI Note: Verify these aspects after conversion
interface FormatValidation {
    structure: "Check document structure integrity",
    styles: "Verify style preservation",
    images: "Confirm image rendering",
    tables: "Validate table layouts"
}
```

## Maintenance Notes

### 1. Regular Checks
- Monitor LibreOffice process health
- Clean temporary storage
- Update conversion cache
- Verify backup service status

### 2. Error Monitoring
- Track conversion failure rates
- Monitor memory usage
- Log format preservation issues
- Document fallback service usage

This documentation is designed to help AI editors understand:
- The complete flow of DOCX processing
- Critical points in the conversion process
- Format preservation techniques
- Common error patterns and solutions
- Performance optimization opportunities