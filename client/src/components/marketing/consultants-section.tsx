import { useState, useMemo, memo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest, refreshCSRFToken } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Pagination } from '@/components/ui/pagination';
import { useDebounce } from '@/hooks/useDebounce';
import { usePagination } from '@/hooks/usePagination';
import { 
  Users, 
  Plus, 
  Search, 
  Edit, 
  Eye, 
  Trash2, 
  Mail, 
  Phone,
  MapPin,
  Calendar,
  GraduationCap,
  Building,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import AdvancedConsultantForm from './advanced-consultant-form';
import { AdminDeleteButton } from './admin-delete-button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ConsultantProject {
  id: string;
  projectName: string;
  projectDomain: string;
  projectCity: string;
  projectState: string;
  projectStartDate: string;
  projectEndDate: string | null;
  isCurrentlyWorking: boolean;
  projectDescription: string;
}

interface Consultant {
  id: string;
  status: 'Active' | 'Not Active';
  name: string;
  email: string;
  phone: string | null;
  visaStatus: string | null;
  dateOfBirth: Date | null;
  address: string | null;
  timezone: string | null;
  degreeName: string | null;
  university: string | null;
  yearOfPassing: string | null;
  countryOfOrigin: string | null;
  yearCameToUS: string | null;
  createdAt: Date;
  updatedAt: Date;
  projects: ConsultantProject[];
  displayId?: string;
  _count?: {
    requirements: number;
    interviews: number;
  };
}

function ConsultantsSection() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedConsultant, setSelectedConsultant] = useState<Consultant | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [viewConsultant, setViewConsultant] = useState<Consultant | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  
  // Debounce search query
  const debouncedSearch = useDebounce(searchQuery, 300);
  
  // Pagination state
  const pagination = usePagination(0, {
    initialPageSize: 25,
    pageSizeOptions: [10, 25, 50, 100],
  });

  // Fetch consultants with pagination and filtering
  const { data: consultantsResponse, isLoading, isError, error } = useQuery({
    queryKey: [
      '/api/marketing/consultants',
      pagination.page,
      pagination.pageSize,
      statusFilter,
      debouncedSearch,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(pagination.page),
        limit: String(pagination.pageSize),
      });
      
      if (statusFilter && statusFilter !== 'All') {
        params.append('status', statusFilter);
      }
      
      if (debouncedSearch) {
        params.append('search', debouncedSearch);
      }
      
      try {
        const response = await apiRequest('GET', `/api/marketing/consultants?${params}`);
        if (!response.ok) {
          throw new Error('Failed to fetch consultants');
        }
        const json = await response.json();
        // Handle both old (array) and new (paginated) response formats
        if (Array.isArray(json)) {
          return { data: json, pagination: null };
        }
        return json;
      } catch (err) {
        throw new Error('Failed to fetch consultants');
      }
    },
    retry: 1,
    staleTime: 60000, // 1 minute - data stays fresh longer
    placeholderData: (previousData) => previousData,
  });

  const consultants = consultantsResponse?.data || [];
  const totalItems = consultantsResponse?.pagination?.total || consultants.length;

  // Create consultant mutation with optimistic updates
  const createMutation = useMutation({
    mutationFn: async (data: { consultant: any; projects: any[] }) => {
      const response = await apiRequest('POST', '/api/marketing/consultants', data);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create consultant');
      }
      return response.json();
    },
    onMutate: async (newConsultant) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['/api/marketing/consultants'] });
      
      // Snapshot previous value
      const previousData = queryClient.getQueryData(['/api/marketing/consultants']);
      
      // Optimistically update with placeholder
      queryClient.setQueryData(['/api/marketing/consultants'], (old: any) => {
        if (!old) return old;
        const newData = {
          id: 'temp-' + Date.now(),
          ...newConsultant.consultant,
          projects: newConsultant.projects || [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        return {
          data: [newData, ...(old.data || old)],
          pagination: old.pagination
        };
      });
      
      return { previousData };
    },
    onError: (error: Error, newConsultant, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(['/api/marketing/consultants'], context.previousData);
      }
      toast.error(error.message || 'Failed to create consultant');
    },
    onSuccess: async () => {
      toast.success('Consultant created successfully!');
      handleFormClose();
      // Refresh CSRF token for future operations
      await refreshCSRFToken();
    },
    onSettled: () => {
      // Refetch to get actual data from server
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/consultants'] });
    },
  });

  // Update consultant mutation with optimistic updates
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { consultant: any; projects: any[] } }) => {
      const response = await apiRequest('PATCH', `/api/marketing/consultants/${id}`, data);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update consultant');
      }
      return response.json();
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['/api/marketing/consultants'] });
      const previousData = queryClient.getQueryData(['/api/marketing/consultants']);
      
      // Optimistically update
      queryClient.setQueryData(['/api/marketing/consultants'], (old: any) => {
        if (!old) return old;
        const dataArray = old.data || old;
        const updatedData = dataArray.map((consultant: Consultant) => 
          consultant.id === id 
            ? { ...consultant, ...data.consultant, projects: data.projects || consultant.projects }
            : consultant
        );
        return {
          data: updatedData,
          pagination: old.pagination
        };
      });
      
      return { previousData };
    },
    onError: (error: Error, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['/api/marketing/consultants'], context.previousData);
      }
      toast.error(error.message || 'Failed to update consultant');
    },
    onSuccess: async () => {
      toast.success('Consultant updated successfully!');
      handleFormClose();
      // Refresh CSRF token for future operations
      await refreshCSRFToken();
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/consultants'] });
    },
  });

  // Delete consultant mutation with optimistic updates
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/marketing/consultants/${id}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete consultant');
      }
      return response.json();
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['/api/marketing/consultants'] });
      const previousData = queryClient.getQueryData(['/api/marketing/consultants']);
      
      // Optimistically remove from list
      queryClient.setQueryData(['/api/marketing/consultants'], (old: any) => {
        if (!old) return old;
        const dataArray = old.data || old;
        const filteredData = dataArray.filter((consultant: Consultant) => consultant.id !== id);
        return {
          data: filteredData,
          pagination: old.pagination
        };
      });
      
      return { previousData };
    },
    onError: (error: Error, id, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['/api/marketing/consultants'], context.previousData);
      }
      toast.error(error.message || 'Failed to delete consultant');
    },
    onSuccess: () => {
      toast.success('Consultant deleted successfully!');
      setDeleteConfirm(null);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/consultants'] });
    },
  });

  const statusOptions = ['All', 'Active', 'Not Active'];

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, []);

  const handleStatusChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': 
        return 'bg-green-100 text-green-800 border-green-200';
      case 'Not Active': 
        return 'bg-red-100 text-red-800 border-red-200';
      default: 
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Since we now filter on the backend, use consultants directly
  const filteredConsultants = consultants;

  const handleAddConsultant = () => {
    setSelectedConsultant(null);
    setShowAddForm(true);
  };

  const handleEditConsultant = (consultant: Consultant) => {
    setSelectedConsultant(consultant);
    setShowEditForm(true);
  };

  const handleViewConsultant = (consultant: Consultant) => {
    setViewConsultant(consultant);
  };

  const handleDeleteConsultant = async (id: string) => {
    setDeleteConfirm(id);
    try {
      await deleteMutation.mutateAsync(id);
      setDeleteConfirm(null);
    } catch (error) {
      // Error handling is done in the mutation
      setDeleteConfirm(null);
    }
  };

  const confirmDelete = () => {
    if (deleteConfirm) {
      handleDeleteConsultant(deleteConfirm);
    }
  };

  const handleFormClose = () => {
    setShowAddForm(false);
    setShowEditForm(false);
    setSelectedConsultant(null);
  };

  const handleFormSubmit = async (consultantData: any, projects: any[]) => {
    const data = { consultant: consultantData, projects };
    
    if (showEditForm && selectedConsultant) {
      await updateMutation.mutateAsync({ id: selectedConsultant.id, data });
    } else {
      await createMutation.mutateAsync(data);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-3 text-slate-600">Loading consultants...</span>
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
        <h3 className="text-xl font-semibold text-slate-800 mb-2">Failed to load consultants</h3>
        <p className="text-slate-500 mb-6">{error?.message || 'An error occurred while fetching consultants'}</p>
        <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/marketing/consultants'] })}>
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
          <h2 className="text-2xl font-bold text-slate-900">Consultants</h2>
          <p className="text-sm text-slate-600 mt-1">Manage consultant profiles and projects</p>
        </div>
        <Button onClick={handleAddConsultant} className="bg-blue-600 hover:bg-blue-700">
          <Plus size={16} className="mr-2" />
          Add Consultant
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by name, email, or country..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="pl-10"
          />
        </div>
        
        <select
          value={statusFilter}
          onChange={handleStatusChange}
          className="border border-slate-300 rounded-md px-3 py-2 text-sm bg-white hover:bg-slate-50 focus:ring-2 focus:ring-blue-500"
        >
          {statusOptions.map((status) => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total</p>
                <p className="text-2xl font-bold text-slate-900">{consultants.length}</p>
              </div>
              <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Active</p>
                <p className="text-2xl font-bold text-slate-900">
                  {consultants.filter((c: Consultant) => c.status === 'Active').length}
                </p>
              </div>
              <div className="h-10 w-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Users className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Not Active</p>
                <p className="text-2xl font-bold text-slate-900">
                  {consultants.filter((c: Consultant) => c.status === 'Not Active').length}
                </p>
              </div>
              <div className="h-10 w-10 bg-red-100 rounded-lg flex items-center justify-center">
                <Users className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Projects</p>
                <p className="text-2xl font-bold text-slate-900">
                  {consultants.reduce((acc: number, c: Consultant) => acc + (c.projects?.length || 0), 0)}
                </p>
              </div>
              <div className="h-10 w-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Building className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Consultants List */}
      <div className="space-y-3">
        {filteredConsultants.length === 0 && totalItems === 0 ? (
          <Card className="border-slate-200">
            <CardContent className="p-12 text-center">
              <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-purple-100 flex items-center justify-center">
                <Users className="h-8 w-8 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No consultants found</h3>
              <p className="text-slate-600 mb-4">
                {searchQuery ? 'Try adjusting your search criteria' : 'Add your first consultant to get started'}
              </p>
              <Button onClick={handleAddConsultant} className="bg-blue-600 hover:bg-blue-700">
                <Plus size={16} className="mr-2" />
                Add Consultant
              </Button>
            </CardContent>
          </Card>
        ) : (
          filteredConsultants.map((consultant: Consultant) => (
            <Card key={consultant.id} className="border-slate-200 hover:shadow-md hover:border-slate-300 transition-all group">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <Avatar className="h-12 w-12 shrink-0">
                      <AvatarFallback className="text-base font-semibold bg-blue-100 text-blue-700">
                        {consultant.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || 'CN'}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <h3 className="font-semibold text-base text-slate-900">
                          {consultant.displayId ? `${consultant.displayId} - ` : ''}{consultant.name}
                        </h3>
                        <Badge className={`${getStatusColor(consultant.status)} shrink-0`}>
                          {consultant.status}
                        </Badge>
                        {consultant.visaStatus && (
                          <Badge variant="outline" className="shrink-0">
                            {consultant.visaStatus}
                          </Badge>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 text-sm mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Mail size={14} className="text-slate-400 shrink-0" />
                          <span className="text-slate-600 truncate">{consultant.email}</span>
                        </div>
                        
                        {consultant.phone && (
                          <div className="flex items-center gap-2">
                            <Phone size={14} className="text-slate-400 shrink-0" />
                            <span className="text-slate-600">{consultant.phone}</span>
                          </div>
                        )}
                        
                        {consultant.countryOfOrigin && (
                          <div className="flex items-center gap-2">
                            <MapPin size={14} className="text-slate-400 shrink-0" />
                            <span className="text-slate-600">{consultant.countryOfOrigin}</span>
                          </div>
                        )}
                        
                        {consultant.projects && consultant.projects.length > 0 && (
                          <div className="flex items-center gap-2">
                            <Building size={14} className="text-slate-400 shrink-0" />
                            <span className="text-slate-600">{consultant.projects.length} Projects</span>
                          </div>
                        )}
                      </div>
                      
                      {consultant.projects && consultant.projects.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {consultant.projects.slice(0, 3).map((project: ConsultantProject) => (
                            <Badge key={project.id} variant="secondary" className="text-xs">
                              {project.projectName}
                            </Badge>
                          ))}
                          {consultant.projects.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{consultant.projects.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleViewConsultant(consultant)}
                      className="h-8 w-8 p-0"
                      title="View details"
                    >
                      <Eye size={16} />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleEditConsultant(consultant)}
                      className="h-8 w-8 p-0"
                      title="Edit"
                    >
                      <Edit size={16} />
                    </Button>
                    <AdminDeleteButton
                      onDelete={() => handleDeleteConsultant(consultant.id)}
                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      {deleteMutation.isPending && deleteConfirm === consultant.id ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Trash2 size={16} />
                      )}
                    </AdminDeleteButton>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
      
      {/* Pagination Controls */}
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
      
      {/* No results after search/filter */}
      {filteredConsultants.length === 0 && totalItems > 0 && (
        <Card className="border-slate-200">
          <CardContent className="p-12 text-center">
            <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
              <Search className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No matching consultants</h3>
            <p className="text-slate-600 mb-4">Try adjusting your search or filters</p>
            <Button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('All');
                pagination.reset();
              }}
              variant="outline"
              size="sm"
            >
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Consultant Form */}
      <AdvancedConsultantForm
        open={showAddForm || showEditForm}
        onClose={handleFormClose}
        onSubmit={handleFormSubmit}
        initialData={showEditForm ? selectedConsultant : undefined}
        editMode={showEditForm}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
      />

      {/* View Consultant Dialog */}
      {viewConsultant && (
        <Dialog open={!!viewConsultant} onOpenChange={() => setViewConsultant(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <Users size={20} />
                <span>{viewConsultant.name}</span>
              </DialogTitle>
              <DialogDescription>
                View consultant details
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Basic Information */}
              <div>
                <h4 className="text-md font-semibold mb-3">Basic Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-slate-700">Status</label>
                    <p className="text-slate-600"><Badge className={getStatusColor(viewConsultant.status)}>{viewConsultant.status}</Badge></p>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-700">Email</label>
                    <p className="text-slate-600">{viewConsultant.email}</p>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-700">Phone</label>
                    <p className="text-slate-600">{viewConsultant.phone || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-700">Visa Status</label>
                    <p className="text-slate-600">{viewConsultant.visaStatus || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-700">Country of Origin</label>
                    <p className="text-slate-600">{viewConsultant.countryOfOrigin || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-700">Year Came to US</label>
                    <p className="text-slate-600">{viewConsultant.yearCameToUS || 'N/A'}</p>
                  </div>
                  {viewConsultant.address && (
                    <div className="col-span-2">
                      <label className="text-sm font-semibold text-slate-700">Address</label>
                      <p className="text-slate-600">{viewConsultant.address}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Education */}
              {(viewConsultant.degreeName || viewConsultant.university) && (
                <div>
                  <h4 className="text-md font-semibold mb-3">Education</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {viewConsultant.degreeName && (
                      <div>
                        <label className="text-sm font-semibold text-slate-700">Degree</label>
                        <p className="text-slate-600">{viewConsultant.degreeName}</p>
                      </div>
                    )}
                    {viewConsultant.university && (
                      <div>
                        <label className="text-sm font-semibold text-slate-700">University</label>
                        <p className="text-slate-600">{viewConsultant.university}</p>
                      </div>
                    )}
                    {viewConsultant.yearOfPassing && (
                      <div>
                        <label className="text-sm font-semibold text-slate-700">Year of Passing</label>
                        <p className="text-slate-600">{viewConsultant.yearOfPassing}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Projects */}
              {viewConsultant.projects && viewConsultant.projects.length > 0 && (
                <div>
                  <h4 className="text-md font-semibold mb-3">Project History ({viewConsultant.projects.length})</h4>
                  <div className="space-y-3">
                    {viewConsultant.projects.map((project) => (
                      <Card key={project.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            <h5 className="font-semibold">{project.projectName}</h5>
                            {project.isCurrentlyWorking && (
                              <Badge variant="outline" className="text-green-600 border-green-600">Current</Badge>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm text-slate-600">
                            <div><span className="font-medium">Domain:</span> {project.projectDomain || 'N/A'}</div>
                            <div><span className="font-medium">Location:</span> {project.projectCity}, {project.projectState}</div>
                            <div>
                              <span className="font-medium">Duration:</span> {new Date(project.projectStartDate).toLocaleDateString()} - {project.projectEndDate ? new Date(project.projectEndDate).toLocaleDateString() : 'Present'}
                            </div>
                          </div>
                          {project.projectDescription && (
                            <p className="mt-2 text-sm text-slate-600">{project.projectDescription}</p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setViewConsultant(null)}>Close</Button>
              <Button onClick={() => {
                setViewConsultant(null);
                handleEditConsultant(viewConsultant);
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
              <DialogTitle>Delete Consultant</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this consultant? This action cannot be undone.
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

export default memo(ConsultantsSection);
