import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { LoadingButton } from '@/components/ui/loading-button';
import { Button } from '@/components/ui/button';
import { PageLoader } from '@/components/ui/page-loader';
import { LoadingOverlay } from '@/components/ui/loading-overlay';
import { ResumeCardSkeleton } from '@/components/ui/card-skeleton';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Settings,
  ArrowLeft,
  FileText,
  CheckCircle,
  Users,
  ArrowRight,
  Target,
} from 'lucide-react';
import SuperDocMultiEditor from '@/components/SuperDocEditor/SuperDocMultiEditor';
// Bulk export functionality removed
import { toast } from 'sonner';
import type { Resume } from '@shared/schema';

interface OpenResume {
  id: string;
  resume: Resume;
  content: string;
  pointGroups: any[];
  hasChanges: boolean;
  isProcessing: boolean;
  lastSaved: Date | null;
}

type WorkflowStep = 'select-resumes' | 'configure-tech-stack' | 'editor';

export default function MultiResumeEditorPage() {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [openResumes, setOpenResumes] = useState<{ [key: string]: OpenResume }>({});
  const [workflowStep, setWorkflowStep] = useState<WorkflowStep>('select-resumes');
  const [selectedResumeIds, setSelectedResumeIds] = useState<Set<string>>(new Set());
  const [techStackInput, setTechStackInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessingTechStack, setIsProcessingTechStack] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingStatus, setProcessingStatus] = useState('');
  const [showExportDialog, setShowExportDialog] = useState(false);

  // Load resumes function
  const loadResumes = async () => {
    try {
      // Get CSRF token from cookie
      const csrfToken = document.cookie
        .split('; ')
        .find(row => row.startsWith('csrf_token='))
        ?.split('=')[1];
        
      const response = await fetch('/api/resumes', {
        headers: {
          'X-CSRF-Token': csrfToken || '',
        },
        credentials: 'include',
      });
      
      if (response.ok) {
        const resumesData = await response.json();
        setResumes(resumesData);
      } else {
        toast.error('Failed to load resumes');
      }
    } catch (error) {
      console.error('Failed to load resumes:', error);
      toast.error('Failed to load resumes');
    }
  };

  // Bulk export functionality removed
  useEffect(() => {
    const initializeData = async () => {
      await loadResumes();
      setIsLoading(false);
    };

    initializeData();
  }, []);

  // Handle resume updates
  const handleResumeUpdate = async (resumeId: string) => {
    try {
      // Get CSRF token from cookie
      const csrfToken = document.cookie
        .split('; ')
        .find(row => row.startsWith('csrf_token='))
        ?.split('=')[1];
        
      const response = await fetch(`/api/resumes/${resumeId}`, {
        headers: {
          'X-CSRF-Token': csrfToken || '',
        },
        credentials: 'include',
      });
      
      if (response.ok) {
        const updatedResume = await response.json();
        setResumes((prev) => prev.map((r) => (r.id === resumeId ? updatedResume : r)));

        // Update open resume if it exists
        if (openResumes[resumeId]) {
          setOpenResumes((prev) => ({
            ...prev,
            [resumeId]: {
              ...prev[resumeId],
              resume: updatedResume,
              hasChanges: false,
              lastSaved: new Date(),
            },
          }));
        }
      }
    } catch (error) {
      console.error('Failed to update resume:', error);
    }
  };

  // Handle bulk export - functionality removed
  const handleBulkExport = async (resumeIds: string[]) => {
    toast.info('Export functionality has been removed');
  };

  // Handle content changes in side-by-side mode
  const handleContentChange = (resumeId: string, content: string) => {
    setOpenResumes((prev) => ({
      ...prev,
      [resumeId]: {
        ...prev[resumeId],
        content,
        hasChanges: true,
      },
    }));
  };

  // Handle saving individual resume in side-by-side mode
  const handleSaveResume = async (resumeId: string) => {
    const openResume = openResumes[resumeId];
    if (!openResume) return;

    try {
      // Get CSRF token from cookie
      const csrfToken = document.cookie
        .split('; ')
        .find(row => row.startsWith('csrf_token='))
        ?.split('=')[1];
        
      const response = await fetch(`/api/resumes/${resumeId}/content`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken || '' 
        },
        credentials: 'include',
        body: JSON.stringify({ content: openResume.content }),
      });

      if (!response.ok) throw new Error('Failed to save resume');

      setOpenResumes((prev) => ({
        ...prev,
        [resumeId]: {
          ...prev[resumeId],
          hasChanges: false,
          lastSaved: new Date(),
        },
      }));

      toast.success(`Saved ${openResume.resume.fileName}`);
      await handleResumeUpdate(resumeId);
    } catch (error) {
      console.error('Failed to save resume:', error);
      toast.error('Failed to save resume');
    }
  };

  // Handle resume selection for side-by-side mode
  const handleResumeSelection = (resumeId: string, checked: boolean) => {
    const newSelected = new Set(selectedResumeIds);
    if (checked) {
      newSelected.add(resumeId);
    } else {
      newSelected.delete(resumeId);
    }
    setSelectedResumeIds(newSelected);
  };

  // Handle select all / deselect all for side-by-side mode
  const handleSelectAll = () => {
    if (selectedResumeIds.size === resumes.length) {
      // Deselect all
      setSelectedResumeIds(new Set());
    } else {
      // Select all
      const allResumeIds = new Set(resumes.map(r => r.id));
      setSelectedResumeIds(allResumeIds);
    }
  };

  // Handle tech stack processing for selected resumes
  const handleExportSelected = async () => {
    toast.info('Export functionality has been removed');
  };
  const handleTechStackProcessing = async () => {
    if (selectedResumeIds.size === 0) {
      toast.error('Please select at least one resume');
      return;
    }

    if (!techStackInput.trim()) {
      toast.error('Please enter a tech stack description');
      return;
    }

    setIsProcessingTechStack(true);
    setProcessingStatus('Initializing tech stack processing...');

    try {
      const resumeIdsArray = Array.from(selectedResumeIds);
      console.log('🚀 Starting tech stack processing for resumes:', resumeIdsArray);
      console.log('📝 Tech stack input:', techStackInput.substring(0, 100) + '...');

      setProcessingStatus('Sending request to server...');
      setProcessingProgress(10);

      // Process tech stack for selected resumes
      // Get CSRF token from cookie
      const csrfToken = document.cookie
        .split('; ')
        .find(row => row.startsWith('csrf_token='))
        ?.split('=')[1];
        
      const response = await fetch('/api/resumes/bulk/process-tech-stack', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken || '' 
        },
        credentials: 'include',
        body: JSON.stringify({
          resumeIds: resumeIdsArray,
          input: techStackInput,
        }),
      });

      console.log('📡 API Response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        console.error('❌ API Error:', errorData);
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      setProcessingStatus('Processing tech stack data...');
      setProcessingProgress(30);

      const result = await response.json();
      console.log('✅ Tech stack processing result:', result);

      if (result.success && result.successful > 0) {
        setProcessingStatus('Tech stack processed! Loading resume data...');
        setProcessingProgress(60);
        
        toast.success(`Successfully processed tech stack for ${result.successful} resumes`);

        // Open the processed resumes
        const newOpenResumes: { [key: string]: OpenResume } = {};

        setProcessingStatus('Fetching updated resume data...');
        
        // OPTIMIZATION: Fetch all resume data in parallel instead of sequentially
        const fetchPromises = resumeIdsArray.map(async (resumeId) => {
          const resume = resumes.find((r) => r.id === resumeId);
          
          if (resume) {
            console.log(`📄 Fetching updated data for resume: ${resume.fileName}`);
            // Fetch updated resume data with point groups in parallel
            const [resumeResponse, pointGroupsResponse] = await Promise.all([
              fetch(`/api/resumes/${resumeId}`, {
                headers: { 'X-CSRF-Token': csrfToken || '' },
                credentials: 'include',
              }),
              fetch(`/api/resumes/${resumeId}/point-groups`, {
                headers: { 'X-CSRF-Token': csrfToken || '' },
                credentials: 'include',
              }),
            ]);

            if (resumeResponse.ok && pointGroupsResponse.ok) {
              const resumeData = await resumeResponse.json();
              const pointGroups = await pointGroupsResponse.json();
              console.log(`📊 Point groups for ${resume.fileName}:`, pointGroups.length);

              return {
                resumeId,
                openResume: {
                  id: resumeId,
                  resume: resumeData,
                  content: resumeData.customizedContent || resumeData.originalContent || '',
                  pointGroups: pointGroups,
                  hasChanges: false,
                  isProcessing: false,
                  lastSaved: new Date(resumeData.updatedAt || Date.now()),
                }
              };
            }
          }
          return null;
        });

        const fetchResults = await Promise.all(fetchPromises);
        
        // Build the newOpenResumes object
        fetchResults.forEach((result) => {
          if (result) {
            newOpenResumes[result.resumeId] = result.openResume;
          }
        });

        setProcessingStatus('Opening multi-editor...');
        setProcessingProgress(90);

        console.log('🎯 Opening multi-editor with resumes:', Object.keys(newOpenResumes));
        setOpenResumes(newOpenResumes);
        setWorkflowStep('editor');

        // Update the resumes list
        await loadResumes();
      } else {
        throw new Error(`Processing failed: ${result.failed} resumes failed`);
      }
    } catch (error) {
      console.error('💥 Tech stack processing error:', error);
      toast.error(
        `Failed to process tech stack: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setIsProcessingTechStack(false);
      setProcessingProgress(0);
      setProcessingStatus('');
    }
  };

  // loadResumes function is defined above

  // Handle closing resume in side-by-side mode
  const handleCloseResume = (resumeId: string) => {
    const openResume = openResumes[resumeId];

    if (openResume?.hasChanges) {
      const confirm = window.confirm(
        `You have unsaved changes in ${openResume.resume.fileName}. Close anyway?`
      );
      if (!confirm) return;
    }

    setOpenResumes((prev) => {
      const newOpenResumes = { ...prev };
      delete newOpenResumes[resumeId];
      return newOpenResumes;
    });
  };

  // Handle save all in side-by-side mode
  const handleSaveAll = async () => {
    const resumesToSave = Object.values(openResumes).filter((r) => r.hasChanges);

    if (resumesToSave.length === 0) {
      toast.info('No changes to save');
      return;
    }

    try {
      await Promise.all(
        resumesToSave.map((openResume) =>
          fetch(`/api/resumes/${openResume.id}/content`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: openResume.content }),
          })
        )
      );

      setOpenResumes((prev) => {
        const updated = { ...prev };
        resumesToSave.forEach((openResume) => {
          updated[openResume.id] = {
            ...updated[openResume.id],
            hasChanges: false,
            lastSaved: new Date(),
          };
        });
        return updated;
      });

      toast.success(`Saved ${resumesToSave.length} resumes`);

      // Update all resumes
      for (const openResume of resumesToSave) {
        await handleResumeUpdate(openResume.id);
      }
    } catch (error) {
      console.error('Failed to save resumes:', error);
      toast.error('Failed to save some resumes');
    }
  };

  if (isLoading) {
    return <PageLoader variant="branded" text="Loading resume editor..." subText="Preparing your workspace" />;
  }

  return (
    <LoadingOverlay 
      isLoading={isProcessingTechStack}
      text="Processing tech stack..."
      subText={processingStatus || `Processing ${selectedResumeIds.size} resume(s)`}
      progress={processingProgress}
    >
      <div className="flex flex-col h-screen w-screen bg-gray-50 overflow-hidden">
        {/* Top Navigation */}
        <div className="bg-white border-b border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                onClick={() => window.history.back()}
                className="flex items-center space-x-2"
              >
                <ArrowLeft size={16} />
                <span>Back</span>
              </Button>

              <h1 className="text-xl font-semibold">Resume Editor</h1>

              <Badge variant="outline">{resumes.length} resumes available</Badge>

              {Object.keys(openResumes).length > 0 && (
                <Badge variant="secondary">{Object.keys(openResumes).length} open</Badge>
              )}
            </div>
          </div>
        </div>

      {/* Editor Content */}
      <div className="flex-1 overflow-hidden w-full">
        <div className="h-full">
          {workflowStep === 'select-resumes' && (
            <ResumeSelectionStep
              resumes={resumes}
              selectedResumeIds={selectedResumeIds}
              onResumeSelection={handleResumeSelection}
              onSelectAll={handleSelectAll}
              onNext={() => setWorkflowStep('configure-tech-stack')}
            />
          )}

          {workflowStep === 'configure-tech-stack' && (
            <TechStackConfigurationStep
              selectedResumeIds={selectedResumeIds}
              resumes={resumes}
              techStackInput={techStackInput}
              onTechStackInputChange={setTechStackInput}
              onBack={() => setWorkflowStep('select-resumes')}
              onProcess={handleTechStackProcessing}
              isProcessing={isProcessingTechStack}
            />
          )}

          {workflowStep === 'editor' && (
            <SuperDocMultiEditor
              openResumes={openResumes}
              onContentChange={handleContentChange}
              onSaveResume={handleSaveResume}
              onCloseResume={handleCloseResume}
              onSaveAll={handleSaveAll}
              onBulkExport={handleBulkExport}
              onBackToSelector={() => setWorkflowStep('select-resumes')}
            />
          )}
        </div>
      </div>

      {/* Export Progress Dialog - removed */}

      {/* Quick Stats Footer */}
      {resumes.length > 0 && (
        <div className="bg-white border-t border-gray-200 p-3">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="flex space-x-6">
              <span>Total Resumes: {resumes.length}</span>
              <span>Ready: {resumes.filter((r) => r.status === 'ready').length}</span>
              <span>Customized: {resumes.filter((r) => r.status === 'customized').length}</span>
            </div>

            <div className="flex space-x-4">
              {workflowStep === 'select-resumes' && (
                <span>Step 1: Resume Selection ({selectedResumeIds.size} selected)</span>
              )}
              {workflowStep === 'configure-tech-stack' && (
                <span>Step 2: Tech Stack Configuration ({selectedResumeIds.size} resumes)</span>
              )}
              {workflowStep === 'editor' && (
                <>
                  <span>Step 3: Multi-Editor ({Object.keys(openResumes).length} open)</span>
                  {Object.values(openResumes).some((r) => r.hasChanges) && (
                    <span className="text-orange-600 font-medium">Unsaved Changes</span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
      </div>
    </LoadingOverlay>
  );
}

// Resume Selection Step Component with Virtualization
interface ResumeSelectionStepProps {
  resumes: Resume[];
  selectedResumeIds: Set<string>;
  onResumeSelection: (resumeId: string, checked: boolean) => void;
  onSelectAll: () => void;
  onNext: () => void;
}

// Memoized Resume Card for performance
const ResumeCard = memo(({
  resume,
  isSelected,
  onResumeSelection
}: {
  resume: Resume;
  isSelected: boolean;
  onResumeSelection: (resumeId: string, checked: boolean) => void;
}) => {
  const handleClick = useCallback(
    () => onResumeSelection(resume.id, !isSelected),
    [resume.id, isSelected, onResumeSelection]
  );
  
  const handleCheckboxChange = useCallback(
    (checked: boolean) => onResumeSelection(resume.id, checked),
    [resume.id, onResumeSelection]
  );

  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md ${
        isSelected
          ? 'ring-2 ring-blue-500 bg-blue-50'
          : 'hover:border-blue-300'
      }`}
      onClick={handleClick}
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Checkbox
              checked={isSelected}
              onCheckedChange={handleCheckboxChange}
              onClick={(e) => e.stopPropagation()}
            />
            <FileText className="text-blue-600" size={20} />
          </div>
          <Badge variant="outline">{resume.status}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <h4 className="font-medium text-sm mb-2">{resume.fileName}</h4>
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{(resume.fileSize / 1024 / 1024).toFixed(1)} MB</span>
          <span>
            {resume.updatedAt ? new Date(resume.updatedAt).toLocaleDateString() : '-'}
          </span>
        </div>
      </CardContent>
    </Card>
  );
});

ResumeCard.displayName = 'ResumeCard';

function ResumeSelectionStep({
  resumes,
  selectedResumeIds,
  onResumeSelection,
  onSelectAll,
  onNext,
}: ResumeSelectionStepProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  
  // Virtualization setup for large resume lists
  const virtualizer = useVirtualizer({
    count: resumes.length,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback(() => 280, []), // Estimated height of each card
    overscan: 5, // Render 5 extra items for smooth scrolling
  });

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="bg-white border-b border-gray-200 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-6">
            <Users className="mx-auto mb-4 text-blue-600" size={48} />
            <h2 className="text-2xl font-semibold mb-2">Select Resumes for Multi-Editor</h2>
            <p className="text-gray-600">
              Choose the resumes you want to edit simultaneously in side-by-side mode
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Badge variant="outline">
                {selectedResumeIds.size} of {resumes.length} selected
              </Badge>

              <Button variant="ghost" size="sm" onClick={onSelectAll}>
                {selectedResumeIds.size === resumes.length ? 'Deselect All' : 'Select All'}
              </Button>
              
              {resumes.length > 100 && (
                <Badge variant="secondary" className="text-xs">
                  Virtualized • High Performance
                </Badge>
              )}
            </div>

            <Button
              onClick={onNext}
              disabled={selectedResumeIds.size === 0}
              className="flex items-center space-x-2"
            >
              <span>Next: Configure Tech Stack</span>
              <ArrowRight size={16} />
            </Button>
          </div>
        </div>
      </div>

      {/* Virtualized Resume List for High Performance */}
      <div className="flex-1 p-6">
        <div className="max-w-4xl mx-auto h-full">
          {resumes.length <= 50 ? (
            // Regular grid for smaller lists
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 h-full overflow-y-auto">
              {resumes.map((resume) => (
                <ResumeCard
                  key={resume.id}
                  resume={resume}
                  isSelected={selectedResumeIds.has(resume.id)}
                  onResumeSelection={onResumeSelection}
                />
              ))}
            </div>
          ) : (
            // Virtualized list for large datasets
            <div ref={parentRef} className="h-full overflow-auto">
              <div
                style={{
                  height: `${virtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative',
                }}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {virtualizer.getVirtualItems().map((virtualItem) => {
                    const resume = resumes[virtualItem.index];
                    return (
                      <div
                        key={virtualItem.key}
                        data-index={virtualItem.index}
                        ref={virtualizer.measureElement}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          transform: `translateY(${virtualItem.start}px)`,
                        }}
                      >
                        <ResumeCard
                          resume={resume}
                          isSelected={selectedResumeIds.has(resume.id)}
                          onResumeSelection={onResumeSelection}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Tech Stack Configuration Step Component
interface TechStackConfigurationStepProps {
  selectedResumeIds: Set<string>;
  resumes: Resume[];
  techStackInput: string;
  onTechStackInputChange: (value: string) => void;
  onBack: () => void;
  onProcess: () => void;
  isProcessing?: boolean;
}

function TechStackConfigurationStep({
  selectedResumeIds,
  resumes,
  techStackInput,
  onTechStackInputChange,
  onBack,
  onProcess,
  isProcessing = false,
}: TechStackConfigurationStepProps) {
  const selectedResumes = resumes.filter((r) => selectedResumeIds.has(r.id));

  const defaultTechStackInput = `React
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
• Implemented database migrations and versioning`;

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="bg-white border-b border-gray-200 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-6">
            <Settings className="mx-auto mb-4 text-blue-600" size={48} />
            <h2 className="text-2xl font-semibold mb-2">Configure Tech Stack</h2>
            <p className="text-gray-600">
              Add technical skills and bullet points that will be processed for all selected resumes
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Badge variant="secondary">{selectedResumeIds.size} resumes selected</Badge>

              <div className="flex -space-x-2">
                {selectedResumes.slice(0, 3).map((resume, index) => (
                  <div
                    key={resume.id}
                    className="w-8 h-8 bg-blue-100 rounded-full border-2 border-white flex items-center justify-center text-xs font-medium text-blue-600"
                    title={resume.fileName}
                  >
                    {resume.fileName.substring(0, 1).toUpperCase()}
                  </div>
                ))}
                {selectedResumes.length > 3 && (
                  <div className="w-8 h-8 bg-gray-100 rounded-full border-2 border-white flex items-center justify-center text-xs font-medium text-gray-600">
                    +{selectedResumes.length - 3}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <Button variant="outline" onClick={onBack}>
                Back to Selection
              </Button>

              <LoadingButton
                onClick={onProcess}
                loading={isProcessing}
                loadingText="Processing..."
                disabled={!techStackInput.trim()}
                className="flex items-center space-x-2"
              >
                <CheckCircle size={16} />
                <span>Process & Open Editor</span>
              </LoadingButton>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Input Section */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <Settings className="mr-2" size={18} />
                    Tech Stack Input
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="tech-input" className="text-sm font-medium mb-2 block">
                      Enter your technical skills and corresponding bullet points
                    </Label>
                    <Textarea
                      id="tech-input"
                      value={techStackInput}
                      onChange={(e) => onTechStackInputChange(e.target.value)}
                      placeholder={defaultTechStackInput}
                      className="min-h-64 font-mono text-sm"
                    />
                  </div>

                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-2">Format Guidelines:</h4>
                    <div className="text-sm text-blue-800 space-y-1">
                      <p>• Enter tech stack name on its own line</p>
                      <p>• Follow with bullet points using • symbol</p>
                      <p>• Leave blank line between different tech stacks</p>
                    </div>
                  </div>

                  {!techStackInput.trim() && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onTechStackInputChange(defaultTechStackInput)}
                      className="w-full"
                    >
                      Use Example Tech Stack
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Selected Resumes Section */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <FileText className="mr-2" size={18} />
                    Selected Resumes ({selectedResumeIds.size})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {selectedResumes.map((resume) => (
                      <div
                        key={resume.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center space-x-3">
                          <FileText className="text-blue-600" size={16} />
                          <div>
                            <p className="font-medium text-sm">{resume.fileName}</p>
                            <p className="text-xs text-gray-500">
                              {(resume.fileSize / 1024 / 1024).toFixed(1)} MB • {resume.status}
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {resume.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-green-50 border-green-200">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <CheckCircle className="mx-auto mb-2 text-green-600" size={24} />
                    <p className="text-sm font-medium text-green-800">Ready to Process</p>
                    <p className="text-xs text-green-700 mt-1">
                      Tech stack will be processed for all {selectedResumeIds.size} resumes
                      simultaneously
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}