#!/usr/bin/env python3
"""
LibreOffice Headless Conversion Service
Handles DOCX ↔ HTML conversions with style preservation
"""

import os
import sys
import tempfile
import shutil
import subprocess
import json
import hashlib
from pathlib import Path
from flask import Flask, request, jsonify, send_file
import uno
from com.sun.star.beans import PropertyValue
from com.sun.star.connection import NoConnectException
import time
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

class LibreOfficeConverter:
    def __init__(self):
        self.soffice_port = 2002
        self.start_libreoffice_service()
    
    def start_libreoffice_service(self):
        """Start LibreOffice in headless mode"""
        try:
            # Kill any existing LibreOffice processes on Windows
            subprocess.run(['taskkill', '/F', '/IM', 'soffice.exe'], capture_output=True, shell=True)
            time.sleep(2)
            
            # Start LibreOffice headless service
            libreoffice_path = os.path.join('C:\\Program Files\\LibreOffice\\program', 'soffice.exe')
            cmd = [
                libreoffice_path,
                '--headless',
                '--invisible',
                '--nocrashreport',
                '--nodefault',
                '--nofirststartwizard',
                '--nologo',
                '--norestore',
                f'--accept=socket,host=127.0.0.1,port={self.soffice_port};urp;StarOffice.ServiceManager'
            ]
            
            subprocess.Popen(cmd)
            time.sleep(5)  # Wait for service to start
            logger.info("LibreOffice service started")
            
        except Exception as e:
            logger.error(f"Failed to start LibreOffice service: {e}")
    
    def get_uno_context(self):
        """Get UNO context for LibreOffice operations"""
        try:
            local_context = uno.getComponentContext()
            resolver = local_context.ServiceManager.createInstanceWithContext(
                "com.sun.star.bridge.UnoUrlResolver", local_context
            )
            context = resolver.resolve(
                f"uno:socket,host=localhost,port={self.soffice_port};urp;StarOffice.ComponentContext"
            )
            return context
        except NoConnectException:
            logger.error("Failed to connect to LibreOffice service")
            self.start_libreoffice_service()
            time.sleep(5)
            return self.get_uno_context()
    
    def docx_to_html(self, docx_path, html_path):
        """Convert DOCX to HTML with style preservation"""
        try:
            context = self.get_uno_context()
            desktop = context.ServiceManager.createInstanceWithContext(
                "com.sun.star.frame.Desktop", context
            )
            
            # Load DOCX document
            doc_url = Path(docx_path).as_uri()
            load_props = (
                PropertyValue("Hidden", 0, True, 0),
                PropertyValue("ReadOnly", 0, True, 0),
            )
            
            document = desktop.loadComponentFromURL(doc_url, "_blank", 0, load_props)
            
            # Export to HTML with enhanced options and style preservation
            html_url = Path(html_path).as_uri()
            
            # Apply custom style settings
            doc_props = document.DocumentProperties
            doc_props.UseFullHeight = True
            doc_props.UseFullWidth = True
            
            export_props = (
                PropertyValue("FilterName", 0, "HTML (StarWriter)", 0),
                PropertyValue("Overwrite", 0, True, 0),
                PropertyValue("ExportImagesAsOLE", 0, False, 0),
                PropertyValue("FilterOptions", 0, "CharacterSet=UTF-8,SaveImages=1,SaveOriginalImages=1,LoadStyles=1,SaveStyles=1", 0),
                PropertyValue("EmbedImages", 0, True, 0),
                PropertyValue("SaveImagesInDocument", 0, True, 0),
                PropertyValue("ExportFormFields", 0, True, 0),
                PropertyValue("ExportNotesPages", 0, False, 0),
                PropertyValue("ExportOnlyNotesPages", 0, False, 0),
                PropertyValue("ExportNotesInMargin", 0, False, 0),
            )
            
            document.storeToURL(html_url, export_props)
            document.close(True)
            
            # Post-process HTML to improve quality
            self.enhance_html_output(html_path)
            return True
            
        except Exception as e:
            logger.error(f"Failed to convert {docx_path} to {html_path}: {e}")
            return False
            
    def enhance_html_output(self, html_path):
        """Enhance HTML output to preserve exact document formatting"""
        if not os.path.exists(html_path):
            logger.error(f"HTML file not found: {html_path}")
            return
            
        try:
            with open(html_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Add custom styles to preserve formatting
            content = content.replace('</head>', '''
                <style>
                    /* Preserve exact dimensions and spacing */
                    body { margin: 0; padding: 0; -webkit-text-size-adjust: 100%; }
                    p { margin-bottom: 0; white-space: pre-wrap; }
                    /* Preserve font metrics */
                    * { line-height: normal !important; font-family: inherit !important; }
                    /* Preserve table layouts */
                    table { border-collapse: collapse; width: auto !important; table-layout: fixed; }
                    td, th { padding: inherit; border-spacing: 0; }
                    /* Preserve list formatting */
                    ul, ol { margin: 0; padding-left: 40px; list-style-position: outside; }
                    /* Preserve image dimensions */
                    img { max-width: none; height: auto; display: inline-block; }
                    /* Preserve section breaks and page layout */
                    div { page-break-inside: avoid; }
                    br { display: block; }
                    /* Preserve whitespace */
                    pre { white-space: pre-wrap; margin: 0; }
                    /* Preserve text positioning */
                    span { position: relative; }
                </style>
                </head>''')
            
            # Ensure all styles are preserved inline
            if '<style>' in content and '</style>' in content:
                style_start = content.find('<style>') + 7
                style_end = content.find('</style>')
                styles = content[style_start:style_end]
                # Move all styles inline for better preservation
                content = content.replace(styles, styles + '''
                    /* Preserve exact formatting */
                    body * {
                        box-sizing: border-box !important;
                        -webkit-box-sizing: border-box !important;
                        -moz-box-sizing: border-box !important;
                    }
                ''')
            
            with open(html_path, 'w', encoding='utf-8') as f:
                f.write(content)
            logger.info(f"Enhanced HTML formatting in {html_path}")
        except Exception as e:
            logger.error(f"Failed to enhance HTML output: {e}")
            
            return True
            
        except Exception as e:
            logger.error(f"DOCX to HTML conversion failed: {e}")
            return False
    
    def html_to_docx(self, html_path, docx_path, template_path=None):
        """Convert HTML to DOCX with optional template"""
        try:
            context = self.get_uno_context()
            desktop = context.ServiceManager.createInstanceWithContext(
                "com.sun.star.frame.Desktop", context
            )
            
            # Load HTML document
            html_url = Path(html_path).as_uri()
            load_props = (
                PropertyValue("Hidden", 0, True, 0),
                PropertyValue("FilterName", 0, "HTML (StarWriter)", 0),
            )
            
            document = desktop.loadComponentFromURL(html_url, "_blank", 0, load_props)
            
            # Apply template if provided
            if template_path and os.path.exists(template_path):
                self.apply_template_styles(document, template_path)
            
            # Export to DOCX
            docx_url = Path(docx_path).as_uri()
            export_props = (
                PropertyValue("FilterName", 0, "MS Word 2007 XML", 0),
                PropertyValue("Overwrite", 0, True, 0),
            )
            
            document.storeToURL(docx_url, export_props)
            document.close(True)
            
            return True
            
        except Exception as e:
            logger.error(f"HTML to DOCX conversion failed: {e}")
            return False
    
    def enhance_html_output(self, html_path):
        """Post-process HTML to improve quality and compatibility"""
        try:
            with open(html_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Add responsive meta tags and improved CSS
            enhanced_content = content.replace(
                '<head>',
                '''<head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; margin: 0; padding: 20px; }
                    .resume-container { max-width: 800px; margin: 0 auto; background: white; }
                    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
                    td, th { padding: 8px; text-align: left; vertical-align: top; }
                    h1, h2, h3 { color: #333; margin-top: 20px; margin-bottom: 10px; }
                    p { margin: 8px 0; }
                    ul, ol { margin: 8px 0; padding-left: 20px; }
                    .page-break { page-break-before: always; }
                </style>'''
            )
            
            with open(html_path, 'w', encoding='utf-8') as f:
                f.write(enhanced_content)
                
        except Exception as e:
            logger.error(f"HTML enhancement failed: {e}")
    
    def apply_template_styles(self, document, template_path):
        """Apply template styles to document"""
        try:
            # This would implement template style application
            # For now, we'll use basic formatting
            pass
        except Exception as e:
            logger.error(f"Template application failed: {e}")

# Initialize converter
converter = LibreOfficeConverter()

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'libreoffice-converter',
        'timestamp': time.time()
    })

@app.route('/convert/docx-to-html', methods=['POST'])
def convert_docx_to_html():
    """Convert DOCX to HTML"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Create temporary files
        with tempfile.NamedTemporaryFile(suffix='.docx', delete=False) as temp_docx:
            file.save(temp_docx.name)
            docx_path = temp_docx.name
        
        with tempfile.NamedTemporaryFile(suffix='.html', delete=False) as temp_html:
            html_path = temp_html.name
        
        # Convert
        success = converter.docx_to_html(docx_path, html_path)
        
        if success and os.path.exists(html_path):
            # Read HTML content
            with open(html_path, 'r', encoding='utf-8') as f:
                html_content = f.read()
            
            # Calculate hash for caching
            content_hash = hashlib.sha256(html_content.encode()).hexdigest()
            
            # Cleanup
            os.unlink(docx_path)
            os.unlink(html_path)
            
            return jsonify({
                'success': True,
                'html': html_content,
                'hash': content_hash,
                'timestamp': time.time()
            })
        else:
            return jsonify({'error': 'Conversion failed'}), 500
            
    except Exception as e:
        logger.error(f"DOCX to HTML conversion error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/convert/html-to-docx', methods=['POST'])
def convert_html_to_docx():
    """Convert HTML to DOCX"""
    try:
        data = request.get_json()
        if not data or 'html' not in data:
            return jsonify({'error': 'No HTML content provided'}), 400
        
        html_content = data['html']
        template_name = data.get('template', 'default')
        
        # Create temporary files
        with tempfile.NamedTemporaryFile(mode='w', suffix='.html', delete=False, encoding='utf-8') as temp_html:
            temp_html.write(html_content)
            html_path = temp_html.name
        
        with tempfile.NamedTemporaryFile(suffix='.docx', delete=False) as temp_docx:
            docx_path = temp_docx.name
        
        # Get template path
        template_path = f"/app/templates/{template_name}.dotx" if template_name != 'default' else None
        
        # Convert
        success = converter.html_to_docx(html_path, docx_path, template_path)
        
        if success and os.path.exists(docx_path):
            # Return file
            return send_file(
                docx_path,
                as_attachment=True,
                download_name='resume.docx',
                mimetype='application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            )
        else:
            return jsonify({'error': 'Conversion failed'}), 500
            
    except Exception as e:
        logger.error(f"HTML to DOCX conversion error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/convert/batch', methods=['POST'])
def batch_convert():
    """Batch convert multiple files"""
    try:
        files = request.files.getlist('files')
        if not files:
            return jsonify({'error': 'No files provided'}), 400
        
        results = []
        for file in files:
            # Process each file
            with tempfile.NamedTemporaryFile(suffix='.docx', delete=False) as temp_docx:
                file.save(temp_docx.name)
                docx_path = temp_docx.name
            
            with tempfile.NamedTemporaryFile(suffix='.html', delete=False) as temp_html:
                html_path = temp_html.name
            
            success = converter.docx_to_html(docx_path, html_path)
            
            if success:
                with open(html_path, 'r', encoding='utf-8') as f:
                    html_content = f.read()
                
                results.append({
                    'filename': file.filename,
                    'success': True,
                    'html': html_content,
                    'hash': hashlib.sha256(html_content.encode()).hexdigest()
                })
            else:
                results.append({
                    'filename': file.filename,
                    'success': False,
                    'error': 'Conversion failed'
                })
            
            # Cleanup
            os.unlink(docx_path)
            os.unlink(html_path)
        
        return jsonify({
            'success': True,
            'results': results,
            'processed': len(results)
        })
        
    except Exception as e:
        logger.error(f"Batch conversion error: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, debug=False)
