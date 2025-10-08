import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Cloud, 
  HardDrive, 
  Shield, 
  Zap, 
  CheckCircle, 
  Info,
  ArrowRight,
  FileText
} from 'lucide-react';

interface GoogleDriveInfoModalProps {
  children: React.ReactNode;
}

export default function GoogleDriveInfoModal({ children }: GoogleDriveInfoModalProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Cloud className="w-5 h-5 text-blue-600" />
            <span>Google Drive Integration</span>
            <Badge variant="secondary" className="bg-blue-100 text-blue-800">New!</Badge>
          </DialogTitle>
          <DialogDescription>
            Learn how to import your resume files directly from Google Drive
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Comparison Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Local Files */}
            <div className="p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center space-x-2 mb-3">
                <HardDrive className="w-5 h-5 text-gray-600" />
                <h3 className="font-semibold text-gray-900">Local Files</h3>
              </div>
              <ul className="text-sm text-gray-600 space-y-2">
                <li className="flex items-start space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Upload files from your computer</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Drag & drop support</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Multiple file selection</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Works offline</span>
                </li>
              </ul>
            </div>
            
            {/* Google Drive */}
            <div className="p-4 border border-blue-200 bg-blue-50 rounded-lg">
              <div className="flex items-center space-x-2 mb-3">
                <Cloud className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-blue-900">Google Drive</h3>
                <Badge variant="secondary" className="bg-blue-200 text-blue-800 text-xs">New!</Badge>
              </div>
              <ul className="text-sm text-blue-800 space-y-2">
                <li className="flex items-start space-x-2">
                  <CheckCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <span>Import directly from cloud storage</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <span>No need to download files first</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <span>Access files from anywhere</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <span>Save time and bandwidth</span>
                </li>
              </ul>
            </div>
          </div>
          
          {/* How it Works */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
              <Zap className="w-5 h-5 text-yellow-600" />
              <span>How Google Drive Import Works</span>
            </h3>
            
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">1</div>
                <div>
                  <p className="font-medium text-gray-900">Connect Your Account</p>
                  <p className="text-sm text-gray-600">Click "Import from Google Drive" and authorize secure access to your DOCX files</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">2</div>
                <div>
                  <p className="font-medium text-gray-900">Browse Your Files</p>
                  <p className="text-sm text-gray-600">See all your DOCX files from Google Drive in an easy-to-use file picker</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">3</div>
                <div>
                  <p className="font-medium text-gray-900">Select & Import</p>
                  <p className="text-sm text-gray-600">Click on any DOCX file to import it directly into Resume Customizer Pro</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm font-semibold">✓</div>
                <div>
                  <p className="font-medium text-gray-900">Start Customizing</p>
                  <p className="text-sm text-gray-600">Your file is processed and ready for tech stack configuration and editing</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Security & Privacy */}
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start space-x-3">
              <Shield className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-semibold text-green-900 mb-2">Security & Privacy</h4>
                <ul className="text-sm text-green-800 space-y-1">
                  <li>• <strong>Read-only access:</strong> We only view your DOCX files, never modify them</li>
                  <li>• <strong>No credential storage:</strong> Your Google login details are never saved</li>
                  <li>• <strong>Secure authentication:</strong> Uses Google's official OAuth 2.0 system</li>
                  <li>• <strong>Revoke anytime:</strong> Disconnect access whenever you want</li>
                </ul>
              </div>
            </div>
          </div>
          
          {/* Quick Tips */}
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start space-x-3">
              <Info className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-semibold text-amber-900 mb-2">Quick Tips</h4>
                <ul className="text-sm text-amber-800 space-y-1">
                  <li>• Only DOCX files are shown in the Google Drive picker</li>
                  <li>• Files are imported with the same processing as local uploads</li>
                  <li>• You can use both local files and Google Drive in the same session</li>
                  <li>• Large files may take a moment to import from Google Drive</li>
                </ul>
              </div>
            </div>
          </div>
          
          {/* Call to Action */}
          <div className="text-center p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
            <FileText className="w-12 h-12 text-blue-600 mx-auto mb-3" />
            <h4 className="text-lg font-semibold text-blue-900 mb-2">Ready to Try Google Drive Import?</h4>
            <p className="text-sm text-blue-800 mb-4">
              Start importing your resume files directly from Google Drive and experience the convenience!
            </p>
            <div className="flex items-center justify-center space-x-2 text-sm text-blue-700">
              <span>Go to Upload Section</span>
              <ArrowRight className="w-4 h-4" />
              <span>Click "Google Drive" Tab</span>
              <ArrowRight className="w-4 h-4" />
              <span>Connect & Import</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
