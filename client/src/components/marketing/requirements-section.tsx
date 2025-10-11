import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { FileText, Plus, Search, Filter, CreditCard as Edit, Eye, Trash2, Loader2, AlertCircle } from 'lucide-react';
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

  // Fetch consultants for assignment
  const { data: consultants = [] } = useQuery({
    queryKey: ['/api/marketing/consultants'],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', '/api/marketing/consultants?status=Active');
        if (!response.ok) return [];
        return response.json();
      } catch {
        return [] as any[];
      }
    },
    retry: false,
  });

  // Fetch requirements with proper error handling
  const { data: requirements = [], isLoading, isError, error } = useQuery({
    queryKey: ['/api/marketing/requirements'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/marketing/requirements');
      if (!response.ok) {
        throw new Error('Failed to fetch requirements');
      }
      return response.json();
    },
    retry: 1,
  });

  // Create requirement mutation
  const createMutation = useMutation({
    mutationFn: async (requirementData: any) => {
      const response = await apiRequest('POST', '/api/marketing/requirements', {
        ...requirementData,
        single: true,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create requirement');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/requirements'] });
      toast.success('Requirement created successfully!');
      handleFormClose();
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/requirements'] });
      toast.success('Requirement updated successfully!');
      handleFormClose();
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

  // Filter requirements based on search and status
  const filteredRequirements = useMemo(() => {
    let filtered = requirements;

    // Apply status filter
    if (statusFilter && statusFilter !== 'All') {
      filtered = filtered.filter((req: any) => req.status === statusFilter);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((req: any) => 
        req.jobTitle?.toLowerCase().includes(query) ||
        req.clientCompany?.toLowerCase().includes(query) ||
        req.primaryTechStack?.toLowerCase().includes(query) ||
        req.appliedFor?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [requirements, statusFilter, searchQuery]);

  const statusOptions = ['All', 'New', 'Working', 'Applied', 'Submitted', 'Interviewed', 'Cancelled'];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'New': return 'bg-blue-100 text-blue-800';
      case 'Working': return 'bg-yellow-100 text-yellow-800';
      case 'Applied': return 'bg-purple-100 text-purple-800';
      case 'Submitted': return 'bg-orange-100 text-orange-800';
      case 'Interviewed': return 'bg-green-100 text-green-800';
      case 'Cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
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

  const handleFormSubmit = async (requirementData: any[]) => {
    if (showEditForm && selectedRequirement) {
      // Update existing requirement
      await updateMutation.mutateAsync({ 
        id: selectedRequirement.id, 
        data: requirementData[0] 
      });
    } else {
      // Create new requirement
      await createMutation.mutateAsync(requirementData[0]);
    }
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
        <p className="text-slate-500 mb-6">{error?.message || 'An error occurred while fetching requirements'}</p>
        <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/marketing/requirements'] })}>
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center space-x-4 flex-wrap gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search requirements..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-72 border-slate-300 focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-slate-300 rounded-lg px-4 py-2 text-sm bg-white hover:bg-slate-50 focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
          >
            {statusOptions.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" className="shadow-sm hover:shadow-md transition-all border-slate-300">
            <Filter size={16} className="mr-2" />
            More Filters
          </Button>
          <Button onClick={handleAddRequirement} className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-md hover:shadow-lg transition-all">
            <Plus size={16} className="mr-2" />
            New Requirement
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {filteredRequirements.map((requirement: any, index: number) => (
          <Card key={requirement.id} className="hover:shadow-xl transition-all duration-300 border-slate-200 hover:border-blue-300 group animate-in slide-in-from-bottom-4" style={{ animationDelay: `${index * 50}ms` }}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-3">
                    <h3 className="font-semibold text-lg text-slate-800 group-hover:text-blue-700 transition-colors">{requirement.jobTitle}</h3>
                    <Badge className={`${getStatusColor(requirement.status)} font-medium shadow-sm`}>{requirement.status}</Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm text-slate-600">
                    <div className="flex items-start space-x-2">
                      <span className="font-semibold text-slate-700">Client:</span>
                      <span>{requirement.clientCompany}</span>
                    </div>
                    <div className="flex items-start space-x-2">
                      <span className="font-semibold text-slate-700">Applied For:</span>
                      <span>{requirement.appliedFor || 'N/A'}</span>
                    </div>
                    <div className="flex items-start space-x-2">
                      <span className="font-semibold text-slate-700">Tech Stack:</span>
                      <span>{requirement.primaryTechStack}</span>
                    </div>
                    <div className="flex items-start space-x-2">
                      <span className="font-semibold text-slate-700">Created:</span>
                      <span>{new Date(requirement.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleViewRequirement(requirement)} 
                    className="hover:bg-blue-50 hover:text-blue-600"
                    title="View details"
                  >
                    <Eye size={16} />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleEditRequirement(requirement)} 
                    className="hover:bg-blue-50 hover:text-blue-600"
                    title="Edit requirement"
                  >
                    <Edit size={16} />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleDeleteRequirement(requirement.id)} 
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    disabled={deleteMutation.isPending}
                    title="Delete requirement"
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

      {filteredRequirements.length === 0 && requirements.length > 0 && (
        <Card className="border-slate-200 shadow-lg">
          <CardContent className="p-16 text-center">
            <div className="h-20 w-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center shadow-md">
              <Search className="h-10 w-10 text-slate-400" />
            </div>
            <h3 className="text-xl font-semibold text-slate-800 mb-2">No matching requirements</h3>
            <p className="text-slate-500 mb-6 max-w-md mx-auto">Try adjusting your search or filters to find what you're looking for.</p>
            <Button onClick={() => { setSearchQuery(''); setStatusFilter('All'); }} variant="outline">
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      )}

      {requirements.length === 0 && (
        <Card className="border-slate-200 shadow-lg">
          <CardContent className="p-16 text-center">
            <div className="h-20 w-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center shadow-md">
              <FileText className="h-10 w-10 text-slate-400" />
            </div>
            <h3 className="text-xl font-semibold text-slate-800 mb-2">No requirements found</h3>
            <p className="text-slate-500 mb-6 max-w-md mx-auto">Create your first requirement to start tracking job opportunities and assignments.</p>
            <Button onClick={handleAddRequirement} className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-md hover:shadow-lg transition-all">
              <Plus size={16} className="mr-2" />
              Create New Requirement
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="mt-8 border-slate-200 shadow-lg bg-gradient-to-br from-white to-slate-50">
        <CardHeader className="border-b border-slate-200">
          <CardTitle className="flex items-center space-x-2 text-slate-800">
            <span>📋</span>
            <span>Requirements Management</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-slate-600">
            <p className="mb-6 text-lg font-medium text-slate-700">Feature Highlights:</p>
            <ul className="text-left max-w-md mx-auto space-y-3">
              <li className="flex items-center space-x-3">
                <span className="flex-shrink-0 h-6 w-6 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-semibold text-sm">✓</span>
                <span>Requirements list with advanced filters</span>
              </li>
              <li className="flex items-center space-x-3">
                <span className="flex-shrink-0 h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-sm">✓</span>
                <span>Create/Edit requirement forms</span>
              </li>
              <li className="flex items-center space-x-3">
                <span className="flex-shrink-0 h-6 w-6 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-semibold text-sm">✓</span>
                <span>Marketing comments system</span>
              </li>
              <li className="flex items-center space-x-3">
                <span className="flex-shrink-0 h-6 w-6 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-semibold text-sm">✓</span>
                <span>Multi-entry support</span>
              </li>
              <li className="flex items-center space-x-3">
                <span className="flex-shrink-0 h-6 w-6 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-semibold text-sm">✓</span>
                <span>Real-time status tracking</span>
              </li>
              <li className="flex items-center space-x-3">
                <span className="flex-shrink-0 h-6 w-6 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 font-semibold text-sm">✓</span>
                <span>Consultant assignment workflow</span>
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Requirements Form */}
      {(showRequirementForm || showEditForm) && (
        <AdvancedRequirementsForm
          open={showRequirementForm || showEditForm}
          onClose={handleFormClose}
          onSubmit={handleFormSubmit}
          consultants={consultants}
          initialData={showEditForm ? selectedRequirement : undefined}
          editMode={showEditForm}
          isSubmitting={createMutation.isPending || updateMutation.isPending}
        />
      )}

      {/* View Requirement Dialog */}
      {viewRequirement && (
        <Dialog open={!!viewRequirement} onOpenChange={() => setViewRequirement(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <FileText size={20} />
                <span>{viewRequirement.jobTitle}</span>
              </DialogTitle>
              <DialogDescription>
                View requirement details
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-slate-700">Status</label>
                  <p className="text-slate-600"><Badge className={getStatusColor(viewRequirement.status)}>{viewRequirement.status}</Badge></p>
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
                  <p className="text-slate-600">{new Date(viewRequirement.createdAt).toLocaleDateString()}</p>
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
              <Button variant="outline" onClick={() => setViewRequirement(null)}>Close</Button>
              <Button onClick={() => {
                setViewRequirement(null);
                handleEditRequirement(viewRequirement);
              }}>
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
              <Button variant="outline" onClick={() => setDeleteConfirm(null)} disabled={deleteMutation.isPending}>
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
