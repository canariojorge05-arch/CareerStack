import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check, Download, RotateCcw, Edit } from "lucide-react";
import type { Point } from "@shared/schema";

interface ProcessingResultsModalProps {
  open: boolean;
  resumeId: string;
  data: any;
  onClose: () => void;
  onProceedToEditor: () => void;
}

export default function ProcessingResultsModal({
  open,
  resumeId,
  data,
  onClose,
  onProceedToEditor,
}: ProcessingResultsModalProps) {
  if (!data) return null;

  const { groups, processingTime, totalPoints } = data;

  const handleExportGroups = () => {
    const exportData = {
      resumeId,
      groups: groups.map((group: any) => ({
        name: group.name,
        points: group.points,
      })),
      processingTime,
      totalPoints,
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `point-groups-${resumeId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRegenerateGroups = () => {
    // This would typically trigger the processing modal again
    // or directly call the processing API with different settings
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Generated Point Groups</DialogTitle>
          <p className="text-muted-foreground">
            Review and customize your distributed bullet points
          </p>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[calc(90vh-200px)] px-1">
          {/* Processing Summary */}
          <Card className="bg-accent/10 border-accent/20 mb-6">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 bg-accent rounded-lg flex items-center justify-center">
                    <Check className="text-accent-foreground" size={20} />
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground">Processing Complete</h4>
                    <p className="text-sm text-muted-foreground">
                      Generated {groups.length} groups from {totalPoints} bullet points
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Processing Time</p>
                  <p className="font-medium text-foreground" data-testid="text-processing-time">
                    {processingTime}ms
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Generated Groups */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {groups.map((group: any, groupIndex: number) => (
              <Card key={group.id} className="border-border">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold text-foreground" data-testid={`group-name-${groupIndex}`}>
                      {group.name}
                    </h4>
                    <Button variant="ghost" size="sm" data-testid={`button-edit-group-${groupIndex}`}>
                      <Edit size={14} />
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {Array.isArray(group.points) &&
                      group.points.map((point: Point, pointIndex: number) => (
                        <div
                          key={pointIndex}
                          className="p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                          data-testid={`point-${groupIndex}-${pointIndex}`}
                        >
                          <p className="text-sm text-foreground leading-relaxed">
                            {point.text}
                          </p>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              onClick={handleExportGroups}
              data-testid="button-export-groups"
            >
              <Download className="mr-2" size={16} />
              Export Groups
            </Button>
            <Button
              variant="ghost"
              onClick={handleRegenerateGroups}
              data-testid="button-regenerate"
            >
              <RotateCcw className="mr-2" size={16} />
              Regenerate
            </Button>
          </div>
          <div className="space-x-3">
            <Button
              variant="outline"
              onClick={onClose}
              data-testid="button-close"
            >
              Close
            </Button>
            <Button
              onClick={onProceedToEditor}
              data-testid="button-proceed-to-editor"
            >
              <Edit className="mr-2" size={16} />
              Customize Resume
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
