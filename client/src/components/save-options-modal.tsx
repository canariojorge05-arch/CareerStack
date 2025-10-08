import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ChevronRight, FileText, Download } from "lucide-react";

interface SaveOptionsModalProps {
  open: boolean;
  resumeId: string;
  content: string;
  onClose: () => void;
}

export default function SaveOptionsModal({ open, resumeId, content, onClose }: SaveOptionsModalProps) {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSaveToGoogleDrive = async () => {
    setIsProcessing(true);
    try {
      // In a real implementation, this would integrate with Google Drive API
      // For now, we'll just show a success message
      toast({
        title: "Feature Coming Soon",
        description: "Google Drive integration will be available in the next update",
      });
    } catch (error) {
      toast({
        title: "Save Failed",
        description: "Failed to save to Google Drive",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      onClose();
    }
  };

  const handleDownloadText = async () => {
    setIsProcessing(true);
    try {
      // Convert HTML content to plain text
      const parser = new DOMParser();
      const doc = parser.parseFromString(content, 'text/html');
      const textContent = doc.body.textContent || doc.body.innerText || '';
      
      // Create and download text file
      const blob = new Blob([textContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `resume-${resumeId}.txt`;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: "✅ Text File Downloaded!",
        description: "Your resume has been exported as a plain text file",
      });
    } catch (error) {
      console.error('Text export error:', error);
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Failed to download resume as text",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      onClose();
    }
  };

  const handleDownloadPdf = async () => {
    setIsProcessing(true);
    try {
      // In a real implementation, this would convert the content to PDF
      // For now, we'll show a message
      toast({
        title: "Feature Coming Soon",
        description: "PDF export will be available in the next update",
      });
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "Failed to download resume as PDF",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Save Resume</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Google Drive Option */}
          <Card
            className="cursor-pointer hover:bg-secondary/50 transition-colors"
            onClick={handleSaveToGoogleDrive}
            data-testid="card-google-drive"
          >
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <i className="fab fa-google-drive text-blue-600"></i>
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-foreground">Save to Google Drive</h4>
                  <p className="text-sm text-muted-foreground">Sync and access from anywhere</p>
                </div>
                <ChevronRight className="text-muted-foreground" size={16} />
              </div>
            </CardContent>
          </Card>

          {/* Local Download Options */}
          <div className="space-y-2">
            <h4 className="font-medium text-foreground">Download Locally</h4>
            
            <Button
              variant="outline"
              className="w-full justify-start h-auto p-4"
              onClick={handleDownloadText}
              disabled={isProcessing}
              data-testid="button-download-text"
            >
              <div className="flex items-center space-x-3 w-full">
                <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FileText className="text-blue-600" size={20} />
                </div>
                <div className="flex-1 text-left">
                  <h5 className="font-medium text-foreground">Download as Text</h5>
                  <p className="text-sm text-muted-foreground">Plain text format</p>
                </div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start h-auto p-4"
              onClick={handleDownloadPdf}
              disabled={isProcessing}
              data-testid="button-download-pdf"
            >
              <div className="flex items-center space-x-3 w-full">
                <div className="h-10 w-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <Download className="text-red-600" size={20} />
                </div>
                <div className="flex-1 text-left">
                  <h5 className="font-medium text-foreground">Download as PDF</h5>
                  <p className="text-sm text-muted-foreground">Print-ready format</p>
                </div>
              </div>
            </Button>
          </div>
        </div>

        <div className="pt-4 border-t border-border">
          <Button
            className="w-full"
            onClick={onClose}
            disabled={isProcessing}
            data-testid="button-close"
          >
            {isProcessing ? "Processing..." : "Close"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
