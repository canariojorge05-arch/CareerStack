import { useState, useEffect, useRef, useCallback } from 'react';
import { LoadingButton } from '@/components/ui/loading-button';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo,
  Redo,
  Download,
  CheckCircle,
  AlertCircle,
  Info,
  Lightbulb,
  BarChart3,
  Target,
  Sparkles,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useContentValidation } from '@/hooks/useValidation';
import { useProgressPersistence } from '@/lib/progressPersistence';
import ProgressIndicator from '@/components/ui/progress-indicator';
import React, { lazy, Suspense } from 'react';
const TemplateLibraryModal = lazy(() => import('@/components/template-library-modal'));
// Enhanced export modal removed
import { type ResumeTemplate } from '@/lib/templates';
// Export utilities removed
import type { Resume, PointGroup } from '@shared/schema';

interface ResumeEditorProps {
  resume: Resume;
  pointGroups: PointGroup[];
  content: string;
  onContentChange: (content: string) => void;
  onShowSaveOptions: () => void;
}

export default function ResumeEditor({
  resume,
  pointGroups,
  content,
  onContentChange,
  onShowSaveOptions,
}: ResumeEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [documentStats, setDocumentStats] = useState({
    pages: 1,
    words: 0,
    characters: 0,
    paragraphs: 0,
    readabilityScore: 0,
    professionalScore: 0,
  });

  const [activeTab, setActiveTab] = useState('stats');
  const [templateLibraryOpen, setTemplateLibraryOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false);

  // Real-time content validation
  const validation = useContentValidation(content);

  // Progress persistence with auto-save
  const saveResumeContent = useCallback(async (data: string) => {
    // This would normally save to your backend API
    // For now, we'll simulate the save operation
    await new Promise((resolve) => setTimeout(resolve, 1000));
    console.log('Resume content saved:', data.slice(0, 100) + '...');
  }, []);

  const progressPersistence = useProgressPersistence(
    `resume-${resume.id}`,
    content,
    saveResumeContent,
    {
      autoSaveInterval: 30000, // 30 seconds
      maxLocalBackups: 15,
      enableVersioning: true,
    }
  );

  // Recovery and persistence handlers
  const handleRecoverFromBackup = useCallback(
    (backupId: string) => {
      try {
        const recoveredContent = progressPersistence.recoverFromBackup(backupId);
        onContentChange(recoveredContent);
        console.log('Content recovered from backup:', backupId);
      } catch (error) {
        console.error('Failed to recover content:', error);
        alert('Failed to recover content from backup');
      }
    },
    [progressPersistence, onContentChange]
  );

  const handleManualSave = useCallback(async () => {
    try {
      await progressPersistence.manualSave();
      console.log('Manual save completed');
    } catch (error) {
      alert('Failed to save content');
    }
  }, [progressPersistence]);

  // Handle export completion
  const handleExportComplete = useCallback((results: any[]) => {
    console.log('Export completed:', results);
    // You could show a toast notification here
    const successCount = results.length;
    alert(`Successfully exported ${successCount} file${successCount !== 1 ? 's' : ''}!`);
  }, []);

  // Handle template selection
  const handleTemplateSelect = (template: ResumeTemplate) => {
    const newContent = template.generateContent();
    onContentChange(newContent);
    // Show success message
    setTimeout(() => {
      // This would normally be done via a toast system
      console.log(`Applied template: ${template.name}`);
    }, 100);
  };

  // Initialize content from resume if not already set
  useEffect(() => {
    if (!content && resume.customizedContent) {
      onContentChange(resume.customizedContent);
    } else if (!content) {
      // Set default resume content
      const defaultContent = generateDefaultResumeContent();
      onContentChange(defaultContent);
    }
  }, [resume, content, onContentChange]);

  // Enhanced document stats when content changes
  useEffect(() => {
    if (content) {
      // Text-only content for analysis
      const textOnly = content
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const words = textOnly.split(' ').filter((word) => word.length > 0);
      const paragraphs = content.split(/\n\s*\n/).filter((p) => p.trim().length > 0).length;

      // Estimate pages (250 words per page)
      const estimatedPages = Math.max(1, Math.ceil(words.length / 250));

      // Basic readability score (Flesch Reading Ease approximation)
      const sentences = textOnly.split(/[.!?]+/).filter((s) => s.trim().length > 0);
      const avgSentenceLength = words.length / Math.max(sentences.length, 1);
      const avgSyllables =
        words.reduce((sum, word) => {
          return sum + Math.max(1, word.match(/[aeiouy]+/gi)?.length || 1);
        }, 0) / Math.max(words.length, 1);

      const readabilityScore = Math.max(
        0,
        Math.min(100, 206.835 - 1.015 * avgSentenceLength - 84.6 * avgSyllables)
      );

      // Professional keywords score
      const professionalKeywords = [
        'achieved',
        'improved',
        'increased',
        'developed',
        'implemented',
        'managed',
        'led',
        'created',
        'designed',
        'optimized',
        'collaborated',
        'coordinated',
        'delivered',
        'executed',
        'maintained',
        'streamlined',
        'enhanced',
        'established',
        'pioneered',
        'transformed',
      ];

      const foundKeywords = professionalKeywords.filter((keyword) =>
        textOnly.toLowerCase().includes(keyword)
      );
      const professionalScore = Math.min(
        100,
        (foundKeywords.length / professionalKeywords.length) * 100
      );

      setDocumentStats({
        pages: estimatedPages,
        words: words.length,
        characters: textOnly.length,
        paragraphs,
        readabilityScore: Math.round(readabilityScore),
        professionalScore: Math.round(professionalScore),
      });
    }
  }, [content]);

  const generateDefaultResumeContent = () => {
    return `
<div class="bg-white p-8 min-h-[11in] max-w-4xl mx-auto">
  <!-- Resume Header -->
  <div class="text-center mb-6 border-b pb-4 border-gray-200">
    <h1 class="text-3xl font-bold text-gray-900 mb-2">John Doe</h1>
    <p class="text-lg text-gray-600">Senior Software Engineer</p>
    <div class="mt-2 text-sm text-gray-500">
      Email: john.doe@email.com | Phone: (555) 123-4567 | LinkedIn: linkedin.com/in/johndoe
    </div>
  </div>

  <!-- Professional Summary -->
  <div class="mb-6">
    <h2 class="text-xl font-semibold text-gray-900 mb-3 border-b border-gray-300 pb-1">Professional Summary</h2>
    <p class="text-gray-700 leading-relaxed">
      Experienced software engineer with 5+ years of expertise in full-stack development, 
      specializing in React, Python, and cloud technologies. Proven track record of delivering 
      scalable web applications and leading cross-functional teams.
    </p>
  </div>

  <!-- Technical Skills -->
  <div class="mb-6">
    <h2 class="text-xl font-semibold text-gray-900 mb-3 border-b border-gray-300 pb-1">Technical Skills</h2>
    <ul class="space-y-2 text-gray-700">
      <li class="flex items-start space-x-2 p-2 rounded hover:bg-gray-50 transition-colors">
        <strong class="text-blue-600 min-w-20">React:</strong>
        <span>Implemented state management with Redux for complex UIs</span>
      </li>
      <li class="flex items-start space-x-2 p-2 rounded hover:bg-gray-50 transition-colors">
        <strong class="text-blue-600 min-w-20">Python:</strong>
        <span>Developed REST APIs using FastAPI and SQLAlchemy ORM</span>
      </li>
      <li class="flex items-start space-x-2 p-2 rounded hover:bg-gray-50 transition-colors">
        <strong class="text-blue-600 min-w-20">PostgreSQL:</strong>
        <span>Designed normalized database schemas for scalability</span>
      </li>
    </ul>
  </div>

  <!-- Professional Experience -->
  <div class="mb-6">
    <h2 class="text-xl font-semibold text-gray-900 mb-3 border-b border-gray-300 pb-1">Professional Experience</h2>
    
    <div class="mb-4">
      <div class="flex justify-between items-start mb-2">
        <div>
          <h3 class="text-lg font-medium text-gray-900">Senior Software Engineer</h3>
          <p class="text-gray-600">TechCorp Inc.</p>
        </div>
        <span class="text-gray-500 text-sm">2021 - Present</span>
      </div>
      <ul class="ml-4 space-y-1 text-gray-700">
        <li class="list-disc">Led development of microservices architecture serving 1M+ daily users</li>
        <li class="list-disc">Improved application performance by 40% through code optimization</li>
        <li class="list-disc">Mentored junior developers and established coding standards</li>
      </ul>
    </div>

    <div class="mb-4">
      <div class="flex justify-between items-start mb-2">
        <div>
          <h3 class="text-lg font-medium text-gray-900">Software Engineer</h3>
          <p class="text-gray-600">StartupXYZ</p>
        </div>
        <span class="text-gray-500 text-sm">2019 - 2021</span>
      </div>
      <ul class="ml-4 space-y-1 text-gray-700">
        <li class="list-disc">Built responsive web applications using React and Node.js</li>
        <li class="list-disc">Implemented CI/CD pipelines reducing deployment time by 60%</li>
        <li class="list-disc">Collaborated with design team to improve user experience</li>
      </ul>
    </div>
  </div>

  <!-- Education -->
  <div class="mb-6">
    <h2 class="text-xl font-semibold text-gray-900 mb-3 border-b border-gray-300 pb-1">Education</h2>
    <div class="flex justify-between items-start">
      <div>
        <h3 class="text-lg font-medium text-gray-900">Bachelor of Science in Computer Science</h3>
        <p class="text-gray-600">University of Technology</p>
      </div>
      <span class="text-gray-500 text-sm">2015 - 2019</span>
    </div>
  </div>
</div>
    `.trim();
  };

  const handleEditorInput = () => {
    if (editorRef.current) {
      const htmlContent = editorRef.current.innerHTML;
      onContentChange(htmlContent);
    }
  };

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  const handleHeadingChange = (value: string) => {
    if (value === 'paragraph') {
      execCommand('formatBlock', 'div');
    } else {
      execCommand('formatBlock', value);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="bg-secondary p-3 flex items-center space-x-2 border-b border-border">
        {/* Formatting Controls */}
        <div className="flex items-center space-x-1 pr-3 border-r border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => execCommand('bold')}
            data-testid="button-bold"
          >
            <Bold size={16} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => execCommand('italic')}
            data-testid="button-italic"
          >
            <Italic size={16} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => execCommand('underline')}
            data-testid="button-underline"
          >
            <Underline size={16} />
          </Button>
        </div>

        {/* Heading Controls */}
        <div className="flex items-center space-x-1 pr-3 border-r border-border">
          <Select onValueChange={handleHeadingChange}>
            <SelectTrigger className="w-32" data-testid="select-heading">
              <SelectValue placeholder="Normal" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="div">Normal</SelectItem>
              <SelectItem value="h1">Heading 1</SelectItem>
              <SelectItem value="h2">Heading 2</SelectItem>
              <SelectItem value="h3">Heading 3</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* List Controls */}
        <div className="flex items-center space-x-1 pr-3 border-r border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => execCommand('insertUnorderedList')}
            data-testid="button-bullet-list"
          >
            <List size={16} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => execCommand('insertOrderedList')}
            data-testid="button-ordered-list"
          >
            <ListOrdered size={16} />
          </Button>
        </div>

        {/* Alignment */}
        <div className="flex items-center space-x-1 pr-3 border-r border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => execCommand('justifyLeft')}
            data-testid="button-align-left"
          >
            <AlignLeft size={16} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => execCommand('justifyCenter')}
            data-testid="button-align-center"
          >
            <AlignCenter size={16} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => execCommand('justifyRight')}
            data-testid="button-align-right"
          >
            <AlignRight size={16} />
          </Button>
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-1 ml-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => execCommand('undo')}
            data-testid="button-undo"
          >
            <Undo size={16} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => execCommand('redo')}
            data-testid="button-redo"
          >
            <Redo size={16} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setTemplateLibraryOpen(true)}
            data-testid="button-templates"
            className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200 text-purple-700 hover:from-purple-100 hover:to-blue-100"
          >
            <Sparkles className="mr-2" size={16} />
            Templates
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExportModalOpen(true)}
            data-testid="button-export"
            className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200 text-green-700 hover:from-green-100 hover:to-blue-100"
          >
            <Download className="mr-2" size={16} />
            Export
          </Button>
        </div>
      </div>

      {/* Editor Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Document Area */}
        <div className="flex-1 overflow-y-auto p-8 bg-muted/20">
          <div
            ref={editorRef}
            contentEditable
            className="max-w-4xl mx-auto bg-white shadow-lg rounded-lg p-8 min-h-[11in] border border-border focus:outline-none focus:ring-2 focus:ring-ring"
            style={{ width: '8.5in' }}
            onInput={handleEditorInput}
            dangerouslySetInnerHTML={{ __html: content }}
            data-testid="editor-content"
          />
        </div>

        {/* Enhanced Analysis Panel */}
        <div className="w-96 bg-card border-l border-border hidden xl:block">
          {/* Validation Status Bar */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-foreground">Content Analysis</h4>
              {validation.hasValidated && (
                <Badge
                  className={
                    validation.isValid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }
                >
                  {validation.isValid ? (
                    <>
                      <CheckCircle size={12} className="mr-1" />
                      Valid
                    </>
                  ) : (
                    <>
                      <AlertCircle size={12} className="mr-1" />
                      {validation.errors.length} issue(s)
                    </>
                  )}
                </Badge>
              )}
            </div>

            {/* Quick Quality Indicators */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="text-center p-2 bg-muted/30 rounded">
                <div className="font-medium text-foreground">{documentStats.words}</div>
                <div className="text-muted-foreground">Words</div>
              </div>
              <div className="text-center p-2 bg-muted/30 rounded">
                <div className="font-medium text-foreground">
                  {documentStats.readabilityScore}/100
                </div>
                <div className="text-muted-foreground">Readability</div>
              </div>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
            <TabsList className="grid w-full grid-cols-3 m-4 mb-0">
              <TabsTrigger value="stats" className="flex items-center text-xs">
                <BarChart3 className="mr-1" size={12} />
                Stats
              </TabsTrigger>
              <TabsTrigger value="validation" className="flex items-center text-xs">
                <Target className="mr-1" size={12} />
                Quality
              </TabsTrigger>
              <TabsTrigger value="suggestions" className="flex items-center text-xs">
                <Sparkles className="mr-1" size={12} />
                Tips
              </TabsTrigger>
            </TabsList>

            <div className="p-4 h-80 overflow-y-auto">
              <TabsContent value="stats" className="space-y-4 mt-0">
                <div className="bg-muted/30 rounded-lg p-3">
                  <h5 className="text-sm font-medium mb-3">Document Metrics</h5>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Pages:</span>
                      <span className="font-medium" data-testid="text-pages">
                        {documentStats.pages}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Words:</span>
                      <span className="font-medium" data-testid="text-words">
                        {documentStats.words}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Characters:</span>
                      <span className="font-medium" data-testid="text-characters">
                        {documentStats.characters}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Paragraphs:</span>
                      <span className="font-medium">{documentStats.paragraphs}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-muted/30 rounded-lg p-3">
                  <h5 className="text-sm font-medium mb-3">Quality Scores</h5>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Readability</span>
                        <span className="font-medium">{documentStats.readabilityScore}/100</span>
                      </div>
                      <Progress value={documentStats.readabilityScore} className="h-1" />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Professional Keywords</span>
                        <span className="font-medium">{documentStats.professionalScore}/100</span>
                      </div>
                      <Progress value={documentStats.professionalScore} className="h-1" />
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="validation" className="space-y-3 mt-0">
                {validation.hasValidated ? (
                  <>
                    {validation.errors.length > 0 && (
                      <Alert variant="destructive" className="p-3">
                        <AlertCircle className="h-3 w-3" />
                        <AlertDescription className="text-xs">
                          <div className="space-y-1">
                            {validation.errors.slice(0, 2).map((error, index) => (
                              <div key={index}>{error}</div>
                            ))}
                            {validation.errors.length > 2 && (
                              <div className="text-muted-foreground">
                                +{validation.errors.length - 2} more issues
                              </div>
                            )}
                          </div>
                        </AlertDescription>
                      </Alert>
                    )}

                    {validation.warnings.length > 0 && (
                      <Alert className="p-3">
                        <Info className="h-3 w-3" />
                        <AlertDescription className="text-xs">
                          <div className="space-y-1">
                            {validation.warnings.slice(0, 2).map((warning, index) => (
                              <div key={index}>{warning}</div>
                            ))}
                            {validation.warnings.length > 2 && (
                              <div className="text-muted-foreground">
                                +{validation.warnings.length - 2} more warnings
                              </div>
                            )}
                          </div>
                        </AlertDescription>
                      </Alert>
                    )}

                    {validation.isValid && validation.warnings.length === 0 && (
                      <Alert className="p-3 border-green-200 bg-green-50">
                        <CheckCircle className="h-3 w-3 text-green-600" />
                        <AlertDescription className="text-xs text-green-800">
                          Your content looks great! No issues detected.
                        </AlertDescription>
                      </Alert>
                    )}
                  </>
                ) : (
                  <div className="text-center p-4 text-muted-foreground">
                    <Target className="mx-auto mb-2" size={20} />
                    <p className="text-xs">Type content to see quality analysis</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="suggestions" className="space-y-3 mt-0">
                {validation.hasValidated && validation.suggestions.length > 0 ? (
                  validation.suggestions.map((suggestion, index) => (
                    <Alert key={index} className="p-3 border-amber-200 bg-amber-50">
                      <Lightbulb className="h-3 w-3 text-amber-600" />
                      <AlertDescription className="text-xs text-amber-800">
                        {suggestion}
                      </AlertDescription>
                    </Alert>
                  ))
                ) : (
                  <div className="text-center p-4 text-muted-foreground">
                    <Sparkles className="mx-auto mb-2" size={20} />
                    <p className="text-xs">Smart suggestions will appear here as you write</p>
                  </div>
                )}
              </TabsContent>
            </div>
          </Tabs>

          {/* Collaboration Panel */}
          <div className="mt-6">
            <h4 className="font-medium text-foreground mb-3">Collaborators</h4>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <div className="h-6 w-6 bg-primary rounded-full flex items-center justify-center">
                  <span className="text-xs text-primary-foreground">J</span>
                </div>
                <span className="text-sm text-foreground">You</span>
                <span className="text-xs text-accent">● Online</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Indicator */}
      <ProgressIndicator
        progressState={progressPersistence.progressState}
        recoveryData={progressPersistence.recoveryData}
        onSave={handleManualSave}
        onRecover={handleRecoverFromBackup}
        onToggleAutoSave={progressPersistence.toggleAutoSave}
        onClearBackups={progressPersistence.clearBackups}
        onResolveConflict={progressPersistence.resolveConflict}
        getTimeSinceLastSave={progressPersistence.getTimeSinceLastSave}
      />  
    </div>
  );
}
