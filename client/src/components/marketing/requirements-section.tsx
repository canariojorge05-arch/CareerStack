import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { apiRequest, refreshCSRFToken } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { useDebounce } from '@/hooks/useDebounce';
import {
  FileText,
  Plus,
  Search,
  Filter,
  CreditCard as Edit,
  Eye,
  Trash2,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import AdvancedRequirementsForm from './advanced-requirements-form';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function RequirementsSection() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showRequirementForm, setShowRequirementForm] = useState(false);
  const [selectedRequirement, setSelectedRequirement] = useState<any>(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [viewRequirement, setViewRequirement] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  
  // Debounce search query to reduce API calls
  const debouncedSearch = useDebounce(searchQuery, 300);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Fetch consultants for assignment
  const { data: consultants = [] } = useQuery({
    queryKey: ['/api/marketing/consultants', 'all'],
    staleTime: 0, // Always fetch fresh data
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', '/api/marketing/consultants');
        if (!response.ok) return [];
        
        const result = await response.json();
        // API returns { data: consultants[], pagination: {...} }
        const data = result.data || result;
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error('Error fetching consultants:', error);
        return [] as any[];
      }
    },
    retry: false,
  });

  // Fetch requirements with pagination and filtering
  const {
    data: requirementsResponse,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: [
      '/api/marketing/requirements',
      currentPage,
      pageSize,
      statusFilter,
      debouncedSearch,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(pageSize),
      });
      
      if (statusFilter && statusFilter !== 'All') {
        params.append('status', statusFilter);
      }
      
      if (debouncedSearch) {
        params.append('search', debouncedSearch);
      }
      
      const response = await apiRequest('GET', `/api/marketing/requirements?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch requirements');
      }
      return response.json();
    },
    retry: 1,
    placeholderData: keepPreviousData, // Keep showing old data while fetching new
  });
  
  // Handle both paginated and non-paginated responses
  const requirements = Array.isArray(requirementsResponse) 
    ? requirementsResponse 
    : requirementsResponse?.data || [];
  const totalItems = requirementsResponse?.pagination?.total || requirements.length;
  
  // Calculate pagination values
  const totalPages = requirementsResponse?.pagination?.totalPages || Math.ceil(totalItems / pageSize);
  
  // Reset to page 1 when search or filter changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, statusFilter]);

  // Create requirement mutation
  const createMutation = useMutation({
    mutationFn: async (requirementData: any) => {
      console.log('API call starting with data:', requirementData);
      const response = await apiRequest('POST', '/api/marketing/requirements', {
        ...requirementData,
        single: true,
      });
      console.log('API response status:', response.status, response.ok);
      if (!response.ok) {
        const error = await response.json();
        console.error('API error response:', error);
        throw new Error(error.message || 'Failed to create requirement');
      }
      const result = await response.json();
      console.log('API success response:', result);
      return result;
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/requirements'] });
      toast.success('Requirement created successfully!');
      handleFormClose();
      // Refresh CSRF token for future operations
      await refreshCSRFToken();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create requirement');
    },
  });

  // Update requirement mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await apiRequest('PATCH', `/api/marketing/requirements/${id}`, data);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update requirement');
      }
      return response.json();
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/requirements'] });
      toast.success('Requirement updated successfully!');
      handleFormClose();
      // Refresh CSRF token for future operations
      await refreshCSRFToken();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update requirement');
    },
  });

  // Delete requirement mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/marketing/requirements/${id}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete requirement');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/requirements'] });
      toast.success('Requirement deleted successfully!');
      setDeleteConfirm(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete requirement');
    },
  });

  // Since we now filter on the backend, we can just use the requirements directly
  const filteredRequirements = requirements;

  const statusOptions = ['All', 'New', 'In Progress', 'Submitted', 'Closed'];

  // Stabilize form props to prevent unnecessary re-renders
  const formInitialData = useMemo(() => {
    return showEditForm ? selectedRequirement : null;
  }, [showEditForm, selectedRequirement?.id]); // Only depend on ID to avoid object reference changes

  const handleFormSubmit = useCallback(
    async (requirementData: any[]) => {
      console.log('Parent handleFormSubmit called with:', requirementData);
      console.log('showEditForm:', showEditForm, 'selectedRequirement:', selectedRequirement);
      
      if (showEditForm && selectedRequirement) {
        // Update existing requirement
        console.log('Updating requirement with ID:', selectedRequirement.id);
        await updateMutation.mutateAsync({
          id: selectedRequirement.id,
          data: requirementData[0],
        });
      } else {
        // Create new requirement
        console.log('Creating new requirement');
        await createMutation.mutateAsync(requirementData[0]);
      }
    },
    [showEditForm, selectedRequirement?.id, updateMutation, createMutation]
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'New':
        return 'bg-blue-100 text-blue-800';
      case 'In Progress':
        return 'bg-yellow-100 text-yellow-800';
      case 'Submitted':
        return 'bg-purple-100 text-purple-800';
      case 'Closed':
        return 'bg-green-100 text-green-800';
      case 'Applied':
        return 'bg-purple-100 text-purple-800';
      case 'Submitted':
        return 'bg-orange-100 text-orange-800';
      case 'Interviewed':
        return 'bg-green-100 text-green-800';
      case 'Cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleAddRequirement = () => {
    setSelectedRequirement(null);
    setShowRequirementForm(true);
  };

  const handleEditRequirement = (requirement: any) => {
    setSelectedRequirement(requirement);
    setShowEditForm(true);
  };

  const handleFormClose = () => {
    setShowRequirementForm(false);
    setShowEditForm(false);
    setSelectedRequirement(null);
  };

  const handleViewRequirement = (requirement: any) => {
    setViewRequirement(requirement);
  };

  const handleDeleteRequirement = (id: string) => {
    setDeleteConfirm(id);
  };

  const confirmDelete = () => {
    if (deleteConfirm) {
      deleteMutation.mutate(deleteConfirm);
    }
  };

  const getConsultantName = (consultantId: string) => {
    const consultant = consultants.find((c: any) => c.id === consultantId);
    return consultant?.name || 'Unassigned';
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-3 text-slate-600">Loading requirements...</span>
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
        <h3 className="text-xl font-semibold text-slate-800 mb-2">Failed to load requirements</h3>
        <p className="text-slate-500 mb-6">
          {error?.message || 'An error occurred while fetching requirements'}
        </p>
        <Button
          onClick={() =>
            queryClient.invalidateQueries({ queryKey: ['/api/marketing/requirements'] })
          }
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
          <h2 className="text-2xl font-bold text-slate-900">Requirements</h2>
          <p className="text-sm text-slate-600 mt-1">Manage job requirements and assignments</p>
        </div>
        <Button onClick={handleAddRequirement} className="bg-blue-600 hover:bg-blue-700">
          <Plus size={16} className="mr-2" />
          New Requirement
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by title, company, or tech stack..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-slate-300 rounded-md px-3 py-2 text-sm bg-white hover:bg-slate-50 focus:ring-2 focus:ring-blue-500"
        >
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      {/* Requirements List */}
      <div className="space-y-3">
        {filteredRequirements.map((requirement: any) => (
          <Card
            key={requirement.id}
            className="border-slate-200 hover:shadow-md hover:border-slate-300 transition-all group"
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="font-semibold text-base text-slate-900 truncate">
                      {requirement.displayId ? `${requirement.displayId} - ` : ''}{requirement.jobTitle}
                    </h3>
                    <Badge className={`${getStatusColor(requirement.status)} shrink-0`}>
                      {requirement.status}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <span className="text-slate-500">Client</span>
                      <p className="text-slate-900 font-medium truncate">
                        {requirement.clientCompany}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500">Applied For</span>
                      <p className="text-slate-900 font-medium truncate">
                        {requirement.appliedFor || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500">Tech Stack</span>
                      <p className="text-slate-900 font-medium truncate">
                        {requirement.primaryTechStack}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500">Created</span>
                      <p className="text-slate-900 font-medium">
                        {new Date(requirement.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleViewRequirement(requirement)}
                    className="h-8 w-8 p-0"
                    title="View details"
                  >
                    <Eye size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditRequirement(requirement)}
                    className="h-8 w-8 p-0"
                    title="Edit"
                  >
                    <Edit size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteRequirement(requirement.id)}
                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                    disabled={deleteMutation.isPending}
                    title="Delete"
                  >
                    {deleteMutation.isPending && deleteConfirm === requirement.id ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Trash2 size={16} />
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pagination Controls */}
      {totalItems > 0 && (
        <Pagination
          page={currentPage}
          pageSize={pageSize}
          totalItems={totalItems}
          totalPages={totalPages}
          hasNextPage={currentPage < totalPages}
          hasPreviousPage={currentPage > 1}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
          showPageSize={true}
          showPageInfo={true}
        />
      )}

      {/* Empty States */}
      {filteredRequirements.length === 0 && totalItems > 0 && (
        <Card className="border-slate-200">
          <CardContent className="p-12 text-center">
            <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
              <Search className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No matching requirements</h3>
            <p className="text-slate-600 mb-4">Try adjusting your search or filters</p>
            <Button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('All');
                setCurrentPage(1);
              }}
              variant="outline"
              size="sm"
            >
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      )}

      {totalItems === 0 && (
        <Card className="border-slate-200">
          <CardContent className="p-12 text-center">
            <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-blue-100 flex items-center justify-center">
              <FileText className="h-8 w-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No requirements yet</h3>
            <p className="text-slate-600 mb-4">Create your first requirement to get started</p>
            <Button onClick={handleAddRequirement} className="bg-blue-600 hover:bg-blue-700">
              <Plus size={16} className="mr-2" />
              Create Requirement
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Requirements Form */}
      <AdvancedRequirementsForm
        open={showRequirementForm || showEditForm}
        onClose={handleFormClose}
        onSubmit={handleFormSubmit}
        consultants={consultants}
        initialData={formInitialData}
        editMode={showEditForm}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
      />

      {/* View Requirement Dialog */}
      {viewRequirement && (
        <Dialog open={!!viewRequirement} onOpenChange={() => setViewRequirement(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <FileText size={20} />
                <span>{viewRequirement.jobTitle}</span>
              </DialogTitle>
              <DialogDescription>View requirement details</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-slate-700">Status</label>
                  <div className="text-slate-600">
                    <Badge className={getStatusColor(viewRequirement.status)}>
                      {viewRequirement.status}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">Client Company</label>
                  <p className="text-slate-600">{viewRequirement.clientCompany}</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">Applied For</label>
                  <p className="text-slate-600">{viewRequirement.appliedFor || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">Primary Tech Stack</label>
                  <p className="text-slate-600">{viewRequirement.primaryTechStack}</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">Rate</label>
                  <p className="text-slate-600">{viewRequirement.rate || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">Duration</label>
                  <p className="text-slate-600">{viewRequirement.duration || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">Remote</label>
                  <p className="text-slate-600">{viewRequirement.remote || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">Created</label>
                  <p className="text-slate-600">
                    {new Date(viewRequirement.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {viewRequirement.impName && (
                <div>
                  <label className="text-sm font-semibold text-slate-700">IMP Name</label>
                  <p className="text-slate-600">{viewRequirement.impName}</p>
                </div>
              )}

              {viewRequirement.vendorCompany && (
                <div>
                  <label className="text-sm font-semibold text-slate-700">Vendor Company</label>
                  <p className="text-slate-600">{viewRequirement.vendorCompany}</p>
                </div>
              )}

              <div>
                <label className="text-sm font-semibold text-slate-700">Job Description</label>
                <div className="mt-2 p-4 bg-slate-50 rounded-lg border border-slate-200 whitespace-pre-wrap text-sm text-slate-600">
                  {viewRequirement.completeJobDescription}
                </div>
              </div>

              {viewRequirement.nextStep && (
                <div>
                  <label className="text-sm font-semibold text-slate-700">Next Step</label>
                  <p className="text-slate-600 mt-2">{viewRequirement.nextStep}</p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setViewRequirement(null)}>
                Close
              </Button>
              <Button
                onClick={() => {
                  setViewRequirement(null);
                  handleEditRequirement(viewRequirement);
                }}
              >
                <Edit size={16} className="mr-2" />
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
              <DialogTitle>Delete Requirement</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this requirement? This action cannot be undone.
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
