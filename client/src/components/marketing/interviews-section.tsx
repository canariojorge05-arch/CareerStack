import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest, refreshCSRFToken } from '@/lib/queryClient';

interface Interview {
  id: string;
  displayId?: string;
  jobTitle?: string;
  status: string;
  round?: string;
  consultantName?: string;
  vendorCompany?: string;
  interviewDate?: string;
  interviewTime?: string;
  mode?: string;
  timezone?: string;
  interviewerName?: string;
  meetingLink?: string;
  notes?: string;
}

interface InterviewFormData {
  requirementId?: string;
  interviewDate?: string;
  interviewTime?: string;
  timezone: string;
  interviewType?: string;
  status: string;
  consultantId?: string;
  vendorCompany?: string;
  interviewWith?: string;
  result?: string;
  round?: string;
  mode?: string;
  meetingType?: string;
  duration?: string;
  subjectLine?: string;
  interviewer?: string;
  interviewLink?: string;
  interviewFocus?: string;
  specialNote?: string;
  jobDescription?: string;
  feedbackNotes?: string;
}

interface PaginatedResponse {
  data: Interview[];
  pagination: {
    total: number;
  };
}
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { useDebounce } from '@/hooks/useDebounce';
import { usePagination } from '@/hooks/usePagination';
import {
  Calendar,
  Plus,
  Clock,
  User,
  Building,
  Loader2,
  AlertCircle,
  Eye,
  Edit as EditIcon,
  Trash2,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';
import InterviewForm from './interview-form';
import { AdminDeleteButton } from './admin-delete-button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function InterviewsSection() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showInterviewForm, setShowInterviewForm] = useState(false);
  const [selectedInterview, setSelectedInterview] = useState<InterviewFormData | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [viewInterview, setViewInterview] = useState<Interview | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  
  // Debounce search query
  const debouncedSearch = useDebounce(searchQuery, 300);
  
  // Pagination state
  const pagination = usePagination(0, {
    initialPageSize: 25,
    pageSizeOptions: [10, 25, 50, 100],
  });

  const interviewTabs = ['All', 'Cancelled', 'Re-Scheduled', 'Confirmed', 'Completed'];

  // Fetch interviews with pagination and filtering
  const {
    data: interviewsResponse,
    isLoading,
    isError,
    error,
  } = useQuery<PaginatedResponse>({
    queryKey: [
      '/api/marketing/interviews',
      pagination.page,
      pagination.pageSize,
      activeTab,
      debouncedSearch,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(pagination.page),
        limit: String(pagination.pageSize),
      });
      
      if (activeTab && activeTab !== 'All') {
        params.append('status', activeTab);
      }
      
      const response = await apiRequest('GET', `/api/marketing/interviews?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch interviews');
      }
      return response.json();
    },
    retry: 1,
    placeholderData: (previousData) => previousData,
  });
  
  // Handle both paginated and non-paginated responses
  const interviews = Array.isArray(interviewsResponse)
    ? interviewsResponse
    : interviewsResponse?.data || [];
  const totalItems = interviewsResponse?.pagination?.total || interviews.length;

  // Create interview mutation
  const createMutation = useMutation({
    mutationFn: async (interviewData: any) => {
      const response = await apiRequest('POST', '/api/marketing/interviews', interviewData);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create interview');
      }
      return response.json();
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/interviews'] });
      toast.success('Interview scheduled successfully!');
      handleFormClose();
      // Refresh CSRF token for future operations
      await refreshCSRFToken();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to schedule interview');
    },
  });

  // Update interview mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await apiRequest('PATCH', `/api/marketing/interviews/${id}`, data);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update interview');
      }
      return response.json();
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/interviews'] });
      toast.success('Interview updated successfully!');
      handleFormClose();
      // Refresh CSRF token for future operations
      await refreshCSRFToken();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update interview');
    },
  });

  // Delete interview mutation
  const deleteMutation = useMutation<void, Error, string>({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/marketing/interviews/${id}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete interview');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/interviews'] });
      toast.success('Interview deleted successfully!');
      setDeleteConfirm(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete interview');
    },
  });

  // Filter interviews by tab
  const filteredInterviews = useMemo(() => {
    // Ensure interviews is an array
    const interviewsArray = Array.isArray(interviewsResponse?.data) ? interviewsResponse.data : [];

    if (activeTab === 'All') return interviewsArray;
    return interviewsArray.filter((interview: Interview) => interview.status === activeTab);
  }, [interviewsResponse?.data, activeTab]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Confirmed':
        return 'bg-blue-100 text-blue-800';
      case 'Completed':
        return 'bg-green-100 text-green-800';
      case 'Cancelled':
        return 'bg-red-100 text-red-800';
      case 'Re-Scheduled':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleScheduleInterview = () => {
    setSelectedInterview(null);
    setShowInterviewForm(true);
  };

  const handleEditInterview = (interview: Interview) => {
    // Convert Interview to InterviewFormData
    const formData: InterviewFormData = {
      ...interview,
      timezone: interview.timezone || 'UTC', // Provide default value
      status: interview.status || 'Scheduled', // Provide default value
    };
    setSelectedInterview(formData);
    setShowEditForm(true);
  };

  const handleViewInterview = (interview: Interview) => {
    setViewInterview(interview);
  };

  const handleDeleteInterview = (id: string) => {
    setDeleteConfirm(id);
  };

  const confirmDelete = () => {
    if (deleteConfirm) {
      deleteMutation.mutate(deleteConfirm);
    }
  };

  const handleFormClose = () => {
    setShowInterviewForm(false);
    setShowEditForm(false);
    setSelectedInterview(null);
  };

  const handleFormSubmit = async (interviewData: InterviewFormData) => {
    if (showEditForm && selectedInterview) {
      // Store the ID separately since it's not part of the form data
      const interviewId = (selectedInterview as Interview & { id: string }).id;
      await updateMutation.mutateAsync({ id: interviewId, data: interviewData });
    } else {
      await createMutation.mutateAsync(interviewData);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-3 text-slate-600">Loading interviews...</span>
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="text-center py-16">
        <div className="h-20 w-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-red-100 to-red-200 flex items-center justify-center shadow-md">
          <AlertCircle className="h-10 w-10 text-red-600" />
        </div>
        <h3 className="text-xl font-semibold text-slate-800 mb-2">Failed to load interviews</h3>
        <p className="text-slate-500 mb-6">
          {error?.message || 'An error occurred while fetching interviews'}
        </p>
        <Button
          onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/marketing/interviews'] })}
        >
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Interviews</h2>
          <p className="text-sm text-slate-600 mt-1">Schedule and manage consultant interviews</p>
        </div>
        <Button onClick={handleScheduleInterview} className="bg-blue-600 hover:bg-blue-700">
          <Plus size={16} className="mr-2" />
          Schedule Interview
        </Button>
      </div>
      
      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search by consultant, company, or interviewer..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <Tabs defaultValue="All" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          {interviewTabs.map((tab) => (
            <TabsTrigger key={tab} value={tab}>
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>

        {interviewTabs.map((tab) => (
          <TabsContent key={tab} value={tab} className="space-y-3 mt-4">
            {/* Interviews List */}
            {filteredInterviews
              .filter((interview: any) => tab === 'All' || interview.status === tab)
              .map((interview: any) => (
                <Card
                  key={interview.id}
                  className="border-slate-200 hover:shadow-md hover:border-slate-300 transition-all group"
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-3">
                          <h3 className="font-semibold text-base text-slate-900 truncate">
                            {interview.displayId ? `${interview.displayId} - ` : ''}{interview.jobTitle || 'Untitled Interview'}
                          </h3>
                          <Badge className={`${getStatusColor(interview.status)} shrink-0`}>
                            {interview.status}
                          </Badge>
                          <Badge variant="outline" className="shrink-0">
                            Round {interview.round || 'N/A'}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div>
                            <span className="text-slate-500">Consultant</span>
                            <p className="text-slate-900 font-medium truncate">
                              {interview.consultantName || 'N/A'}
                            </p>
                          </div>
                          <div>
                            <span className="text-slate-500">Company</span>
                            <p className="text-slate-900 font-medium truncate">
                              {interview.vendorCompany || 'N/A'}
                            </p>
                          </div>
                          <div>
                            <span className="text-slate-500">Date</span>
                            <p className="text-slate-900 font-medium">
                              {interview.interviewDate
                                ? new Date(interview.interviewDate).toLocaleDateString()
                                : 'N/A'}
                            </p>
                          </div>
                          <div>
                            <span className="text-slate-500">Time & Mode</span>
                            <p className="text-slate-900 font-medium truncate">
                              {interview.interviewTime || 'N/A'} • {interview.mode || 'N/A'}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewInterview(interview)}
                          className="h-8 w-8 p-0"
                          title="View details"
                        >
                          <Eye size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditInterview(interview)}
                          className="h-8 w-8 p-0"
                          title="Edit"
                        >
                          <EditIcon size={16} />
                        </Button>
                        <AdminDeleteButton
                          onDelete={async () => handleDeleteInterview(interview.id)}
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          {deleteMutation.isPending && deleteConfirm === interview.id ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Trash2 size={16} />
                          )}
                        </AdminDeleteButton>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            
            {/* Pagination */}
            {totalItems > pagination.pageSize && (
              <Pagination
                page={pagination.page}
                pageSize={pagination.pageSize}
                totalItems={totalItems}
                totalPages={pagination.totalPages}
                hasNextPage={pagination.hasNextPage}
                hasPreviousPage={pagination.hasPreviousPage}
                onPageChange={pagination.goToPage}
                onPageSizeChange={pagination.setPageSize}
                showPageSize={true}
                showPageInfo={true}
              />
            )}

            {/* Empty State */}
            {filteredInterviews.filter(
              (interview: any) => tab === 'All' || interview.status === tab
            ).length === 0 && (
              <Card className="border-slate-200">
                <CardContent className="p-12 text-center">
                  <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-indigo-100 flex items-center justify-center">
                    <Calendar className="h-8 w-8 text-indigo-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">
                    No {tab.toLowerCase()} interviews
                  </h3>
                  <p className="text-slate-600 mb-4">
                    {tab === 'All'
                      ? 'Schedule your first interview to get started'
                      : `No ${tab.toLowerCase()} interviews found`}
                  </p>
                  <Button
                    onClick={handleScheduleInterview}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus size={16} className="mr-2" />
                    Schedule Interview
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Interview Form */}
      <InterviewForm
        open={showInterviewForm || showEditForm}
        onClose={handleFormClose}
        onSubmit={handleFormSubmit}
        initialData={showEditForm && selectedInterview ? { ...selectedInterview } : undefined}
        editMode={showEditForm}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
      />

      {/* View Interview Dialog */}
      {viewInterview && (
        <Dialog open={!!viewInterview} onOpenChange={() => setViewInterview(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <Calendar size={20} />
                <span>{viewInterview.jobTitle || 'Interview Details'}</span>
              </DialogTitle>
              <DialogDescription>View interview details</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-slate-700">Status</label>
                  <p className="text-slate-600">
                    <Badge className={getStatusColor(viewInterview.status)}>
                      {viewInterview.status}
                    </Badge>
                  </p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">Round</label>
                  <p className="text-slate-600">{viewInterview.round || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">Consultant Name</label>
                  <p className="text-slate-600">{viewInterview.consultantName || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">Vendor Company</label>
                  <p className="text-slate-600">{viewInterview.vendorCompany || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">Interview Date</label>
                  <p className="text-slate-600">
                    {viewInterview.interviewDate
                      ? new Date(viewInterview.interviewDate).toLocaleDateString()
                      : 'N/A'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">Interview Time</label>
                  <p className="text-slate-600">{viewInterview.interviewTime || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">Mode</label>
                  <p className="text-slate-600">{viewInterview.mode || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">Timezone</label>
                  <p className="text-slate-600">{viewInterview.timezone || 'N/A'}</p>
                </div>
              </div>

              {viewInterview.interviewerName && (
                <div>
                  <label className="text-sm font-semibold text-slate-700">Interviewer</label>
                  <p className="text-slate-600">{viewInterview.interviewerName}</p>
                </div>
              )}

              {viewInterview.meetingLink && (
                <div>
                  <label className="text-sm font-semibold text-slate-700">Meeting Link</label>
                  <p className="text-slate-600">
                    <a
                      href={viewInterview.meetingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {viewInterview.meetingLink}
                    </a>
                  </p>
                </div>
              )}

              {viewInterview.notes && (
                <div>
                  <label className="text-sm font-semibold text-slate-700">Notes</label>
                  <div className="mt-2 p-4 bg-slate-50 rounded-lg border border-slate-200 whitespace-pre-wrap text-sm text-slate-600">
                    {viewInterview.notes}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setViewInterview(null)}>
                Close
              </Button>
              <Button
                onClick={() => {
                  setViewInterview(null);
                  handleEditInterview(viewInterview);
                }}
              >
                <EditIcon size={16} className="mr-2" />
                Edit
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Interview</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this interview? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeleteConfirm(null)}
                disabled={deleteMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDelete}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? (
                  <>
                    <Loader2 size={16} className="mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
