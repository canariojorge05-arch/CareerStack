import { useState, useEffect } from 'react';
import { useTechStackProcessing } from '@/hooks/useTechStackProcessing';
import { useProcessTechStackMutation } from '@/hooks/useProcessTechStackMutation';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LoadingButton } from '@/components/ui/loading-button';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Info,
  Save,
  Settings,
  Eye,
  BarChart3,
  Layers,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

interface TechStackModalProps {
  open: boolean;
  resumeId: string;
  onClose: () => void;
  onSuccess: (data: any) => void;
}

// Live preview parser for tech stack input
interface ParsedTechStack {
  name: string;
  points: string[];
  color: string;
}

interface PreviewStats {
  totalTechs: number;
  totalPoints: number;
  avgPointsPerTech: number;
  longestTech: string;
  validation: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  };
}

const TECH_COLORS = [
  'bg-blue-100 text-blue-800',
  'bg-green-100 text-green-800',
  'bg-purple-100 text-purple-800',
  'bg-orange-100 text-orange-800',
  'bg-pink-100 text-pink-800',
  'bg-indigo-100 text-indigo-800',
  'bg-yellow-100 text-yellow-800',
  'bg-red-100 text-red-800',
];

export default function TechStackModal({
  open,
  resumeId,
  onClose,
  onSuccess,
}: TechStackModalProps) {
  const { toast } = useToast();
  const [input, setInput] = useState(`React
• Built responsive web applications using React hooks and context
• Implemented state management with Redux for complex UIs
• Created reusable component library with TypeScript

Python
• Developed REST APIs using FastAPI and SQLAlchemy
• Implemented data processing pipelines with Pandas
• Created automated testing suites with PyTest

PostgreSQL
• Designed normalized database schemas for scalability
• Optimized query performance for large datasets
• Implemented database migrations and versioning`);
  const [activeTab, setActiveTab] = useState('input');
  const { parsedTechStack, previewStats } = useTechStackProcessing(input);
  const processMutation = useProcessTechStackMutation(
    resumeId,
    input,
    { totalPoints: previewStats.totalPoints, totalTechs: previewStats.totalTechs },
    onSuccess
  );

  // Note: Auto-switching removed to prevent interrupting user workflow
  // Users can manually switch to preview/analysis tabs when they want to

  // ...existing code...

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!previewStats.validation.isValid) {
      toast({
        title: 'Validation Error',
        description: previewStats.validation.errors.join(', '),
        variant: 'destructive',
      });
      return;
    }

    if (previewStats.validation.warnings.length > 0) {
      toast({
        title: '⚠️ Processing with Warnings',
        description: `${previewStats.validation.warnings.length} warnings detected. Processing anyway...`,
        variant: 'default',
      });
    }

    processMutation.mutate();
  };

  const handleSaveDraft = () => {
    // In a real app, you might save this to local storage or a draft endpoint
    toast({
      title: 'Draft Saved',
      description: 'Your tech stack input has been saved as a draft',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold flex items-center">
            <Settings className="mr-2" size={20} />
            Configure Tech Stack & Points
            <Badge
              className={`ml-2 ${
                previewStats.validation.isValid
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}
            >
              {previewStats.validation.isValid ? (
                <>
                  <CheckCircle className="mr-1" size={12} />
                  Valid
                </>
              ) : (
                <>
                  <AlertCircle className="mr-1" size={12} />
                  Invalid
                </>
              )}
            </Badge>
          </DialogTitle>
          <p className="text-muted-foreground">
            Add your technical skills and corresponding bullet points. Real-time preview shows
            exactly how your data will be processed.
          </p>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[calc(95vh-140px)]">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Live Stats Bar */}
            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
              <div className="flex items-center space-x-6 text-sm">
                <div className="flex items-center">
                  <Layers className="text-blue-600 mr-1" size={16} />
                  <span className="font-medium">{previewStats.totalTechs}</span>
                  <span className="text-muted-foreground ml-1">techs</span>
                </div>
                <div className="flex items-center">
                  <BarChart3 className="text-green-600 mr-1" size={16} />
                  <span className="font-medium">{previewStats.totalPoints}</span>
                  <span className="text-muted-foreground ml-1">points</span>
                </div>
                <div className="flex items-center">
                  <Eye className="text-purple-600 mr-1" size={16} />
                  <span className="font-medium">{previewStats.avgPointsPerTech}</span>
                  <span className="text-muted-foreground ml-1">avg/tech</span>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {previewStats.validation.warnings.length > 0 && (
                  <Badge variant="outline" className="text-orange-600 border-orange-200">
                    {previewStats.validation.warnings.length} warning(s)
                  </Badge>
                )}
                {previewStats.validation.errors.length > 0 && (
                  <Badge variant="destructive">
                    {previewStats.validation.errors.length} error(s)
                  </Badge>
                )}
              </div>
            </div>

            {/* Tabbed Interface */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="input" className="flex items-center">
                  <Settings className="mr-2" size={16} />
                  Input
                </TabsTrigger>
                <TabsTrigger value="preview" className="flex items-center">
                  <Eye className="mr-2" size={16} />
                  Live Preview
                  <Badge className="ml-2 bg-blue-100 text-blue-800">{parsedTechStack.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="stats" className="flex items-center">
                  <BarChart3 className="mr-2" size={16} />
                  Analysis
                </TabsTrigger>
              </TabsList>

              <TabsContent value="input" className="space-y-4">
                {/* Input Format Helper */}
                <Card className="bg-muted/50 border-border">
                  <CardContent className="p-4">
                    <h4 className="font-medium text-foreground mb-2 flex items-center">
                      <Info className="text-primary mr-2" size={16} />
                      Input Format
                    </h4>
                    <div className="text-sm text-muted-foreground space-y-1 font-mono">
                      <p>TechName1</p>
                      <p className="ml-4">• BulletPoint1</p>
                      <p className="ml-4">• BulletPoint2</p>
                      <p className="ml-4">• ...</p>
                      <p>TechName2</p>
                      <p className="ml-4">• BulletPoint1</p>
                      <p className="ml-4">• BulletPoint2</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Tech Stack Input */}
                <div className="space-y-3">
                  <Label htmlFor="tech-input" className="text-sm font-medium">
                    Tech Stack & Bullet Points
                  </Label>
                  <Textarea
                    id="tech-input"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    className="min-h-96 font-mono text-sm"
                    placeholder="Enter your tech stacks and bullet points..."
                    data-testid="textarea-tech-input"
                  />
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Format: TechName followed by bullet points
                    </span>
                    <span className="text-muted-foreground" data-testid="text-character-count">
                      {input.length} characters
                    </span>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="preview" className="space-y-4">
                <div className="grid gap-4">
                  {parsedTechStack.length === 0 ? (
                    <Card className="p-8">
                      <div className="text-center text-muted-foreground">
                        <Eye className="mx-auto mb-2" size={24} />
                        <p>Enter tech stacks in the Input tab to see live preview</p>
                      </div>
                    </Card>
                  ) : (
                    <ScrollArea className="h-96">
                      <div className="space-y-4 p-1">
                        {parsedTechStack.map((tech, index) => (
                          <Card key={index} className="p-4 hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-between mb-3">
                              <Badge className={tech.color}>{tech.name}</Badge>
                              <span className="text-xs text-muted-foreground">
                                {tech.points.length} points
                              </span>
                            </div>
                            <div className="space-y-2">
                              {tech.points.length === 0 ? (
                                <p className="text-sm text-muted-foreground italic">
                                  No bullet points
                                </p>
                              ) : (
                                tech.points.map((point, pointIndex) => (
                                  <div key={pointIndex} className="flex items-start space-x-2">
                                    <span className="text-primary mt-1">•</span>
                                    <span className="text-sm text-foreground leading-relaxed">
                                      {point}
                                    </span>
                                  </div>
                                ))
                              )}
                            </div>
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="stats" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="p-4">
                    <h4 className="font-medium mb-3 flex items-center">
                      <BarChart3 className="mr-2 text-blue-600" size={16} />
                      Statistics
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Tech Stacks:</span>
                        <span className="font-medium">{previewStats.totalTechs}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Points:</span>
                        <span className="font-medium">{previewStats.totalPoints}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Average per Tech:</span>
                        <span className="font-medium">{previewStats.avgPointsPerTech}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Largest Tech:</span>
                        <span className="font-medium">{previewStats.longestTech}</span>
                      </div>
                    </div>
                  </Card>

                  <Card className="p-4">
                    <h4 className="font-medium mb-3 flex items-center">
                      {previewStats.validation.errors.length > 0 ? (
                        <AlertCircle className="mr-2 text-red-600" size={16} />
                      ) : (
                        <CheckCircle className="mr-2 text-green-600" size={16} />
                      )}
                      Validation
                    </h4>
                    <div className="space-y-2">
                      {previewStats.validation.errors.map((error, index) => (
                        <div key={index} className="flex items-start space-x-2 text-red-600">
                          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                          <span className="text-sm">{error}</span>
                        </div>
                      ))}
                      {previewStats.validation.warnings.map((warning, index) => (
                        <div key={index} className="flex items-start space-x-2 text-orange-600">
                          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                          <span className="text-sm">{warning}</span>
                        </div>
                      ))}
                      {previewStats.validation.isValid &&
                        previewStats.validation.warnings.length === 0 && (
                          <div className="flex items-center space-x-2 text-green-600">
                            <CheckCircle size={14} />
                            <span className="text-sm">All validations passed!</span>
                          </div>
                        )}
                    </div>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-border">
              <Button
                type="button"
                variant="ghost"
                onClick={handleSaveDraft}
                data-testid="button-save-draft"
              >
                <Save className="mr-2" size={16} />
                Save Draft
              </Button>
              <div className="space-x-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <LoadingButton
                  type="submit"
                  loading={processMutation.isPending}
                  loadingText="Processing..."
                  disabled={!previewStats.validation.isValid}
                  data-testid="button-process"
                  className={
                    previewStats.validation.isValid ? 'bg-green-600 hover:bg-green-700' : ''
                  }
                >
                  <Settings className="mr-2" size={16} />
                  {`Process ${previewStats.totalPoints} Points`}
                </LoadingButton>
              </div>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
