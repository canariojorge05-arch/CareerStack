import { useEffect, useState, useRef, memo, useCallback, useMemo } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { isUnauthorizedError } from '@/lib/authUtils';
import { LoadingButton } from '@/components/ui/loading-button';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ResumeCardSkeleton, StatsCardSkeleton } from '@/components/ui/card-skeleton';
import { PageLoader } from '@/components/ui/page-loader';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Trash2, CreditCard as Edit, Download, FileText } from 'lucide-react';
import type { LucideProps } from 'lucide-react';
import FileUpload from '@/components/file-upload';
import TechStackModal from '@/components/tech-stack-modal';
import ProcessingResultsModal from '@/components/processing-results-modal';
import GoogleDriveInfoModal from '@/components/google-drive-info-modal';
import { AppHeader } from '@/components/shared/app-header';
import type { Resume } from '@shared/schema';
import type { User as ClientUser } from '@/hooks/useAuth';

// Performance-optimized memoized components
const StatsCard = memo(({ title, value, icon: Icon, loading }: {
  title: string;
  value: number;
  icon: React.ElementType;
  loading: boolean;
}) => {
  return (
    <Card className="p-6 card-interactive shadow-md">
      <CardContent className="flex items-center p-0">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl">
            <Icon size={26} className="text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            {loading ? (
              <div className="h-8 w-16 bg-gray-200 rounded animate-pulse" />
            ) : (
              <p className="text-3xl font-bold tracking-tight">{value}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
StatsCard.displayName = 'StatsCard';

const ResumeCard = memo(({ 
  resume, 
  index, 
  onDelete, 
  onEdit, 
  getFileIcon, 
  getStatusColor,
  isDeleting 
}: {
  resume: Resume;
  index: number;
  onDelete: (id: string, name: string) => void;
  onEdit: (id: string) => void;
  getFileIcon: (filename: string) => string;
  getStatusColor: (status: string) => string;
  isDeleting: boolean;
}) => {
  const handleDelete = useCallback(() => {
    onDelete(resume.id, resume.fileName);
  }, [resume.id, resume.fileName, onDelete]);

  const handleEdit = useCallback(() => {
    onEdit(resume.id);
  }, [resume.id, onEdit]);

  return (
    <article
      className="flex items-center justify-between p-5 border border-border rounded-xl smooth-hover shadow-sm hover:shadow-md hover:border-primary/50 focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2"
      data-testid={`card-resume-${index}`}
      aria-labelledby={`resume-title-${resume.id}`}
    >
      <div className="flex items-center space-x-4">
        <div className="h-12 w-12 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl flex items-center justify-center">
          <FileText className="text-primary" size={22} />
        </div>
        <div>
          <h4
            id={`resume-title-${resume.id}`}
            className="font-semibold text-foreground"
            data-testid={`text-filename-${index}`}
          >
            {resume.fileName}
          </h4>
          <p
            className="text-sm text-muted-foreground"
            data-testid={`text-upload-info-${index}`}
          >
            Uploaded{' '}
            {resume.uploadedAt
              ? new Date(resume.uploadedAt).toLocaleDateString()
              : 'Unknown'}{' '}
            • {(resume.fileSize / 1024 / 1024).toFixed(1)} MB
          </p>
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <Badge
          className={`${
            (resume as any).isOptimistic
              ? 'bg-purple-100 text-purple-800'
              : getStatusColor(resume.status)
          } transition-all duration-200`}
          data-testid={`badge-status-${index}`}
        >
          {(resume as any).isOptimistic ? (
            <>
              <div className="animate-pulse inline-block w-2 h-2 bg-current rounded-full mr-1" />
              Uploading
            </>
          ) : resume.status === 'ready' ? (
            'Ready'
          ) : resume.status === 'customized' ? (
            'Customized'
          ) : resume.status === 'processing' ? (
            <>
              <div className="animate-spin inline-block w-3 h-3 border border-current border-r-transparent rounded-full mr-1" />
              Processing
            </>
          ) : (
            'Uploaded'
          )}
        </Badge>

        {resume.status === 'customized' ? (
          <Button
            variant="secondary"
            onClick={handleEdit}
            data-testid={`button-edit-${index}`}
            className="transition-all duration-200"
          >
            Edit Resume
          </Button>
        ) : resume.status === 'processing' ? (
          <Button
            disabled
            data-testid={`button-processing-${index}`}
            className="transition-all duration-200"
          >
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-r-transparent mr-2" />
            Processing...
          </Button>
        ) : (
          <Button
            variant="outline"
            disabled
            className="transition-all duration-200 text-muted-foreground"
          >
            Use Multi-Editor
          </Button>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          disabled={isDeleting}
          data-testid={`button-delete-${index}`}
          className="text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          <Trash2 size={16} />
        </Button>
      </div>
    </article>
  );
});
ResumeCard.displayName = 'ResumeCard';

export default function Dashboard() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  // Define types for modals and results
  interface ProcessingResult {
    success: boolean;
    message: string;
    data?: any;
  }

  // Support multiple concurrent Tech Stack modals and result modals per resume
  const [openTechModals, setOpenTechModals] = useState<Record<string, boolean>>({});
  const [resultsByResume, setResultsByResume] = useState<Record<string, ProcessingResult>>({});
  const [openResultsModals, setOpenResultsModals] = useState<Record<string, boolean>>({});
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    open: boolean;
    resumeId: string;
    resumeName: string;
  }>({
    open: false,
    resumeId: '',
    resumeName: '',
  });
  // Simple helper dialog state removed

  // Track optimistic updates
  const optimisticUpdatesRef = useRef<Set<string>>(new Set());

  // Defensive check: redirect if not authenticated (belt and suspenders with PrivateRoute)
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      console.warn('[Dashboard] Accessed without authentication, redirecting...');
      navigate('/login');
    }
  }, [isLoading, isAuthenticated, navigate]);

  // Fetch resumes
  const {
    data: resumes = [] as Resume[],
    isLoading: resumesLoading,
    error: resumesError,
  } = useQuery<Resume[]>({
    queryKey: ['/api/resumes'] as const,
    queryFn: async (): Promise<Resume[]> => {
      const response = await apiRequest('GET', '/api/resumes');
      if (!response.ok) {
        throw new Error('Failed to fetch resumes');
      }
      const data = await response.json();
      return data;
    },
    enabled: isAuthenticated,
    retry: 1,
    staleTime: 1000 * 60 * 5, // 5 minutes,
    gcTime: 1000 * 60 * 30, // 30 minutes
  });

  // Fetch user stats
  interface UserStats {
    totalResumes: number;
    customizations: number;
    downloads: number;
  }

  const {
    data: stats = { totalResumes: 0, customizations: 0, downloads: 0 },
    isLoading: statsLoading,
  } = useQuery<UserStats>({
    queryKey: ['/api/user/stats'] as const,
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/user/stats');
      if (!response.ok) {
        throw new Error('Failed to fetch user stats');
      }
      const data = await response.json();
      return data as UserStats;
    },
    enabled: isAuthenticated,
    retry: 1,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // ULTRA-FAST Upload with optimistic updates
  const uploadMutation = useMutation<Resume[], Error, FileList>({
    mutationFn: async (files: FileList) => {
      const formData = new FormData();
      Array.from(files).forEach((file) => formData.append('files', file));
      
      // Get CSRF token from cookie
      const csrfToken = document.cookie
        .split('; ')
        .find(row => row.startsWith('csrf_token='))
        ?.split('=')[1];

      // Create upload request with timeout (2 minutes to match server)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minutes
      
      try {
        const response = await fetch('/api/resumes/upload', {
          method: 'POST',
          headers: {
            'X-CSRF-Token': csrfToken || '',
          },
          body: formData,
          credentials: 'include',
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({ message: 'Failed to upload resumes' }));
          
          // Provide specific error messages based on status code
          let errorMessage = errorData.message || 'Failed to upload resumes';
          
          if (response.status === 413) {
            errorMessage = 'File is too large. Please choose a smaller file (max 50MB per file).';
          } else if (response.status === 429) {
            errorMessage = 'Too many upload attempts. Please wait a moment before trying again.';
          } else if (response.status === 415) {
            errorMessage = 'File type not supported. Please upload PDF or DOCX files only.';
          } else if (response.status === 408 || response.status === 504) {
            errorMessage = 'Upload timed out. Please check your internet connection and try again.';
          } else if (response.status >= 500) {
            errorMessage = 'Server error occurred. Please try again in a moment.';
          }
          
          throw new Error(errorMessage);
        }
        
        const data = await response.json();
        return data as Resume[];
      } catch (error: any) {
        clearTimeout(timeoutId);
        
        if (error.name === 'AbortError') {
          throw new Error('Upload timed out. Please check your internet connection and try again.');
        }
        
        throw error;
      }

    },
    // OPTIMISTIC UPDATES for instant UI feedback
    onMutate: async (files: FileList) => {
      // Cancel outgoing refetches to prevent race conditions
      await queryClient.cancelQueries({ queryKey: ['/api/resumes'] });
      await queryClient.cancelQueries({ queryKey: ['/api/user/stats'] });

      // Snapshot previous values
      const previousResumes = queryClient.getQueryData(['/api/resumes']);
      const previousStats = queryClient.getQueryData(['/api/user/stats']);

      // Create optimistic resumes with unique temporary IDs
      const timestamp = Date.now();
      const now = new Date();
      const optimisticResumes = Array.from(files).map((file, index) => ({
        id: `optimistic-${timestamp}-${index}`, // Unique temp ID
        fileName: file.name,
        fileSize: file.size,
        status: 'uploading', // Show uploading status initially
        uploadedAt: now,
        userId: (user as ClientUser)?.id || '',
        originalContent: null,
        customizedContent: null,
        downloads: 0,
        updatedAt: now,
        isOptimistic: true as const, // Flag to identify optimistic updates
        uploadProgress: 0, // Could be used for progress tracking
      })) satisfies Partial<Resume>[];

      queryClient.setQueryData(['/api/resumes'], (old: Resume[] = []) => {
        console.log('🔄 Adding optimistic resumes...', optimisticResumes.length);
        console.log('Current resumes before optimistic:', old.length);

        // Add optimistic resumes at the beginning (newest first)
        const updated: Resume[] = [
          ...(optimisticResumes as unknown as Resume[]),
          ...old,
        ];

        console.log('Total resumes after optimistic:', updated.length);
        return updated;
      });

      queryClient.setQueryData(['/api/user/stats'], (old: any) => ({
        ...old,
        totalResumes: (old?.totalResumes || 0) + files.length,
      }));

      return { previousResumes, previousStats };
    },
    onSuccess: async (uploadedResumes) => {
      // ROBUST OPTIMISTIC UPDATE: Properly merge new resumes with existing ones
      queryClient.setQueryData(['/api/resumes'], (old: any) => {
        console.log('🚀 Upload success - merging resumes (in-place replacement) ...');
        console.log('New uploaded resumes:', uploadedResumes.length);

        // Start from current cache (may contain optimistic placeholders and existing real resumes)
        let merged: any[] = Array.isArray(old) ? [...old] : [];

        // For each uploaded resume, replace matching optimistic placeholder by filename+size; if none, add to top
        for (const uploaded of uploadedResumes as any[]) {
          const matchIdx = merged.findIndex(
            (r: any) =>
              r?.isOptimistic === true &&
              r?.fileName === uploaded?.fileName &&
              Number(r?.fileSize) === Number(uploaded?.fileSize)
          );

          if (matchIdx !== -1) {
            merged.splice(matchIdx, 1, uploaded);
          } else {
            merged.unshift(uploaded);
          }
        }

        console.log('Final merged list:', merged.length, 'resumes');
        return merged;
      });

      // Background reconcile with server response to ensure nothing is dropped
      try {
        const response = await apiRequest('GET', '/api/resumes');
        if (response.ok) {
          const serverResumes = await response.json();
          queryClient.setQueryData(['/api/resumes'], (current: any) => {
            const byId = new Map<string, any>();
            (serverResumes as any[]).forEach((r) => byId.set(r.id, r));
            if (Array.isArray(current)) {
              current.forEach((r) => {
                if (!byId.has(r.id)) byId.set(r.id, r);
              });
            }
            return Array.from(byId.values());
          });
        }
      } catch (e) {
        console.warn('Background reconcile failed:', e);
      }

      // Refresh stats (non-blocking)
      queryClient.invalidateQueries({ queryKey: ['/api/user/stats'] });

      toast({
        title: '⚡ Lightning Fast Upload!',
        description: `${uploadedResumes.length} resume(s) uploaded successfully!`,
      });
    },
    onError: (error: Error, variables: FileList, context: unknown) => {
      const ctx = context as { previousResumes?: Resume[]; previousStats?: UserStats };
      console.log('❌ Upload failed, rolling back optimistic updates...');

      // Rollback optimistic update on error - restore previous state
      if (ctx?.previousResumes) {
        console.log('Rolling back resumes to previous state');
        queryClient.setQueryData<Resume[]>(['/api/resumes'], ctx.previousResumes);
      }
      if (ctx?.previousStats) {
        console.log('Rolling back stats to previous state');
        queryClient.setQueryData<UserStats>(['/api/user/stats'], ctx.previousStats);
      }

      if (isUnauthorizedError(error)) {
        toast({
          title: 'Unauthorized',
          description: 'You are logged out. Logging in again...',
          variant: 'destructive',
        });
        setTimeout(() => {
          window.location.href = '/api/login';
        }, 500);
        return;
      }
      toast({
        title: 'Upload Failed',
        description: error.message || 'Failed to upload resume',
        variant: 'destructive',
      });
    },
  });

  // ULTRA-FAST Delete with optimistic updates
  const deleteMutation = useMutation<void, Error, string>({
    mutationFn: async (resumeId: string) => {
      const response = await apiRequest('DELETE', `/api/resumes/${resumeId}`);
      if (!response.ok) {
        throw new Error('Failed to delete resume');
      }
    },
    // INSTANT UI feedback
    onMutate: async (resumeId: string) => {
      await queryClient.cancelQueries({ queryKey: ['/api/resumes'] });
      await queryClient.cancelQueries({ queryKey: ['/api/user/stats'] });

      const previousResumes = queryClient.getQueryData<Resume[]>(['/api/resumes']);
      const previousStats = queryClient.getQueryData<UserStats>(['/api/user/stats']);

      // Optimistically remove from UI
      queryClient.setQueryData<Resume[]>(['/api/resumes'], (old = []) =>
        old.filter((r) => r.id !== resumeId)
      );

      queryClient.setQueryData<UserStats>(
        ['/api/user/stats'],
        (old = { totalResumes: 0, customizations: 0, downloads: 0 }) => ({
          ...old,
          totalResumes: Math.max(0, old.totalResumes - 1),
        })
      );

      return { previousResumes, previousStats };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/resumes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/stats'] });
      toast({
        title: '🗡️ Lightning Delete!',
        description: 'Resume deleted instantly!',
      });
    },
    onError: (error: Error, resumeId: string, context: unknown) => {
      const ctx = context as { previousResumes?: Resume[]; previousStats?: UserStats };
      // Rollback on error
      if (ctx?.previousResumes) {
        queryClient.setQueryData<Resume[]>(['/api/resumes'], ctx.previousResumes);
      }
      if (ctx?.previousStats) {
        queryClient.setQueryData<UserStats>(['/api/user/stats'], ctx.previousStats);
      }

      if (isUnauthorizedError(error)) {
        toast({
          title: 'Unauthorized',
          description: 'You are logged out. Logging in again...',
          variant: 'destructive',
        });
        setTimeout(() => {
          window.location.href = '/api/login';
        }, 500);
        return;
      }
      toast({
        title: 'Delete Failed',
        description: error.message || 'Failed to delete resume',
        variant: 'destructive',
      });
    },
  });

  // Memoized utility functions
  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'ready':
      case 'customized':
        return 'bg-green-100 text-green-800';
      case 'processing':
        return 'bg-orange-100 text-orange-800';
      case 'uploaded':
        return 'bg-blue-100 text-blue-800';
      case 'uploading':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }, []);

  const getFileIcon = useCallback((_fileName: string) => {
    return 'text-blue-600';
  }, []);

  // Handle Google Drive uploads
  const handleGoogleDriveUpload = useCallback((resume: Resume) => {
    // Add the Google Drive resume to the cache optimistically
    queryClient.setQueryData<Resume[]>(['/api/resumes'], (old = []) => {
      console.log('🌤️ Adding Google Drive resume to cache:', resume.fileName);
      return [resume, ...old];
    });

    // Update stats
    queryClient.setQueryData(['/api/user/stats'], (old: any) => ({
      ...old,
      totalResumes: (old?.totalResumes || 0) + 1,
    }));

    // Refresh queries to ensure consistency
    queryClient.invalidateQueries({ queryKey: ['/api/resumes'] });
    queryClient.invalidateQueries({ queryKey: ['/api/user/stats'] });

    toast({
      title: '☁️ Google Drive Import Successful!',
      description: `Successfully imported ${resume.fileName} from Google Drive! 🎉 You can now process it just like any local file.`,
    });

    console.log(`✅ Imported from Google Drive:`, resume.fileName);
  }, [queryClient, toast]);

  const handleTechStackProcess = useCallback((resumeId: string) => {
    setOpenTechModals((prev) => ({ ...prev, [resumeId]: true }));
  }, []);

  const handleTechStackSuccess = useCallback((resumeId: string, data: any) => {
    // Close the tech modal for this resume and open the results modal, storing the data
    setOpenTechModals((prev) => ({ ...prev, [resumeId]: false }));
    setResultsByResume((prev) => ({ ...prev, [resumeId]: data }));
    setOpenResultsModals((prev) => ({ ...prev, [resumeId]: true }));
    queryClient.invalidateQueries({ queryKey: ['/api/resumes'] });
  }, [queryClient]);

  const handleOpenEditor = useCallback((resumeId: string) => {
    navigate('/editor');
  }, [navigate]);

  const handleDeleteConfirmation = useCallback((resumeId: string, resumeName: string) => {
    setDeleteConfirmation({ open: true, resumeId, resumeName });
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (deleteConfirmation.resumeId) {
      deleteMutation.mutate(deleteConfirmation.resumeId);
      setDeleteConfirmation({ open: false, resumeId: '', resumeName: '' });
    }
  }, [deleteConfirmation.resumeId, deleteMutation]);

  // Memoized computed values
  const resumeStats = useMemo(() => ({
    totalResumes: stats?.totalResumes ?? 0,
    customizations: stats?.customizations ?? 0,
    downloads: stats?.downloads ?? 0
  }), [stats]);

  const hasResumes = useMemo(() => resumes && resumes.length > 0, [resumes]);

  if (isLoading) {
    return <PageLoader variant="branded" text="Loading your dashboard..." />;
  }

  return (
    <div className="min-h-screen bg-background animate-fade-in">
      {/* Shared Header with Auto-hide */}
      <AppHeader currentPage="dashboard" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" role="main">
        {/* Welcome Section */}
        <section className="mb-10 animate-slide-in" aria-labelledby="welcome-heading">
          <h2 id="welcome-heading" className="text-3xl font-bold text-foreground mb-3 tracking-tight">
            Welcome back, {(user as ClientUser)?.firstName || 'there'}!
          </h2>
          <p className="text-lg text-muted-foreground">
            Upload and customize your resumes with AI-powered precision.
          </p>
        </section>

        {/* Quick Stats */}
        <section className="mb-8" aria-labelledby="stats-heading">
          <h2 id="stats-heading" className="sr-only">Account Statistics</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {statsLoading ? (
            <>
              <StatsCardSkeleton />
              <StatsCardSkeleton />
              <StatsCardSkeleton />
            </>
          ) : (
            <>
              <StatsCard 
                title="Total Resumes" 
                value={resumeStats.totalResumes} 
                icon={FileText} 
                loading={false}
              />
              <StatsCard 
                title="Customizations" 
                value={resumeStats.customizations} 
                icon={Edit} 
                loading={false}
              />
              <StatsCard 
                title="Downloads" 
                value={resumeStats.downloads} 
                icon={Download} 
                loading={false}
              />
            </>
          )}
          </div>
        </section>

        {/* File Upload Section */}
        <section className="mb-10" aria-labelledby="upload-heading">
          <Card className="shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 id="upload-heading" className="text-xl font-bold text-foreground tracking-tight">Upload New Resume</h3>
              <div />
            </div>

            {/* Announcement removed: clean, minimal interface */}
            <FileUpload
              onUpload={(files) => uploadMutation.mutate(files)}
              onGoogleDriveUpload={handleGoogleDriveUpload}
              isUploading={uploadMutation.isPending}
              />
            </CardContent>
          </Card>
        </section>

        {/* Uploaded Resumes Section */}
        <section aria-labelledby="resumes-heading">
          <Card className="shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 id="resumes-heading" className="text-lg font-semibold text-foreground">Your Resumes</h3>
                <div className="flex items-center space-x-2" role="group" aria-label="View options">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    aria-label="Switch to grid view"
                    className="focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <i className="fas fa-th-large" aria-hidden="true"></i>
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="bg-primary/10 text-primary focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    aria-label="List view (current)"
                    aria-current="true"
                  >
                    <i className="fas fa-list" aria-hidden="true"></i>
                  </Button>
                </div>
            </div>

            {resumesLoading ? (
              <div className="space-y-4" aria-label="Loading resumes" role="status">
                <ResumeCardSkeleton />
                <ResumeCardSkeleton />
                <ResumeCardSkeleton />
                <span className="sr-only">Loading your resumes...</span>
              </div>
            ) : resumes?.length === 0 ? (
              <div className="text-center py-8" role="status" aria-label="No resumes found">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" aria-hidden="true" />
                <p className="text-muted-foreground">No resumes uploaded yet</p>
                <p className="text-sm text-muted-foreground">
                  Upload your first DOCX resume to get started
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {resumes?.map((resume: Resume, index: number) => (
                  <ResumeCard
                    key={resume.id}
                    resume={resume}
                    index={index}
                    onDelete={handleDeleteConfirmation}
                    onEdit={handleOpenEditor}
                    getFileIcon={getFileIcon}
                    getStatusColor={getStatusColor}
                    isDeleting={deleteMutation.isPending}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        </section>
      </main>

      {/* Multi-instance Tech Stack Modals */}
      {Object.entries(openTechModals)
        .filter(([, isOpen]) => isOpen)
        .map(([resumeId]) => (
          <TechStackModal
            key={`tech-${resumeId}`}
            open={true}
            resumeId={resumeId}
            onClose={() => setOpenTechModals((prev) => ({ ...prev, [resumeId]: false }))}
            onSuccess={(data) => handleTechStackSuccess(resumeId, data)}
          />
        ))}

      {/* Multi-instance Processing Results Modals */}
      {Object.entries(openResultsModals)
        .filter(([, isOpen]) => isOpen)
        .map(([resumeId]) => (
          <ProcessingResultsModal
            key={`results-${resumeId}`}
            open={true}
            resumeId={resumeId}
            data={resultsByResume[resumeId]}
            onClose={() => setOpenResultsModals((prev) => ({ ...prev, [resumeId]: false }))}
            onProceedToEditor={() => {
              setOpenResultsModals((prev) => ({ ...prev, [resumeId]: false }));
              handleOpenEditor(resumeId);
            }}
          />
        ))}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmation.open}
        onOpenChange={(open) =>
          !open && setDeleteConfirmation({ open: false, resumeId: '', resumeName: '' })
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Resume</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteConfirmation.resumeName}"? This action cannot
              be undone and will permanently remove the resume along with all its customizations and
              processing history.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmation({ open: false, resumeId: '', resumeName: '' })}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Resume'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
