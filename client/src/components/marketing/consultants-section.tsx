import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
  _count?: {
    requirements: number;
    interviews: number;
  };
}

export default function ConsultantsSection() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedConsultant, setSelectedConsultant] = useState<Consultant | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [viewConsultant, setViewConsultant] = useState<Consultant | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Fetch consultants
  const { data: consultants = [], isLoading, isError, error } = useQuery({
    queryKey: ['/api/marketing/consultants', statusFilter, searchQuery],
    queryFn: async () => {
      try {
        const params = new URLSearchParams();
        if (statusFilter && statusFilter !== 'All') {
          params.append('status', statusFilter);
        }
        if (searchQuery) {
          params.append('search', searchQuery);
        }
        
        const qs = params.toString();
        const url = qs ? `/api/marketing/consultants?${qs}` : '/api/marketing/consultants';
        const response = await apiRequest('GET', url);
        if (!response.ok) {
          throw new Error('Failed to fetch consultants');
        }
        return response.json() as Promise<Consultant[]>;
      } catch (err) {
        throw new Error('Failed to fetch consultants');
      }
    },
    retry: 1,
  });

  // Create consultant mutation
  const createMutation = useMutation({
    mutationFn: async (data: { consultant: any; projects: any[] }) => {
      const response = await apiRequest('POST', '/api/marketing/consultants', data);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create consultant');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/consultants'] });
      toast.success('Consultant created successfully!');
      handleFormClose();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create consultant');
    },
  });

  // Update consultant mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { consultant: any; projects: any[] } }) => {
      const response = await apiRequest('PATCH', `/api/marketing/consultants/${id}`, data);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update consultant');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/consultants'] });
      toast.success('Consultant updated successfully!');
      handleFormClose();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update consultant');
    },
  });

  // Delete consultant mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/marketing/consultants/${id}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete consultant');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/consultants'] });
      toast.success('Consultant deleted successfully!');
      setDeleteConfirm(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete consultant');
    },
  });

  const statusOptions = ['All', 'Active', 'Not Active'];

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

  const filteredConsultants = consultants.filter(consultant => {
    const matchesSearch = !searchQuery || 
      consultant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      consultant.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      consultant.visaStatus?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      consultant.countryOfOrigin?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'All' || consultant.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

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

  const handleDeleteConsultant = (id: string) => {
    setDeleteConfirm(id);
  };

  const confirmDelete = () => {
    if (deleteConfirm) {
      deleteMutation.mutate(deleteConfirm);
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
      {/* Header with Search and Filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search consultants..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-border rounded-md px-3 py-2 text-sm bg-background"
          >
            {statusOptions.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>

        <Button onClick={handleAddConsultant}>
          <Plus size={16} className="mr-2" />
          Add Consultant
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Consultants</p>
                <p className="text-2xl font-bold text-foreground">{consultants.length}</p>
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Consultants</p>
                <p className="text-2xl font-bold text-green-600">
                  {consultants.filter(c => c.status === 'Active').length}
                </p>
              </div>
              <div className="h-8 w-8 bg-green-100 rounded-lg flex items-center justify-center">
                <Users className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Not Active</p>
                <p className="text-2xl font-bold text-red-600">
                  {consultants.filter(c => c.status === 'Not Active').length}
                </p>
              </div>
              <div className="h-8 w-8 bg-red-100 rounded-lg flex items-center justify-center">
                <Users className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Projects</p>
                <p className="text-2xl font-bold text-purple-600">
                  {consultants.reduce((acc, c) => acc + (c.projects?.length || 0), 0)}
                </p>
              </div>
              <Building className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Consultants List */}
      <div className="space-y-4">
        {filteredConsultants.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No consultants found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery ? 'Try adjusting your search criteria.' : 'Add your first consultant to get started.'}
              </p>
              <Button onClick={handleAddConsultant}>
                <Plus size={16} className="mr-2" />
                Add Consultant
              </Button>
            </CardContent>
          </Card>
        ) : (
          filteredConsultants.map((consultant) => (
            <Card key={consultant.id} className="hover:shadow-md transition-shadow group">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4 flex-1">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="text-lg font-semibold">
                        {consultant.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'CN'}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="font-semibold text-lg">{consultant.name}</h3>
                        <Badge className={getStatusColor(consultant.status)}>
                          {consultant.status}
                        </Badge>
                        {consultant.visaStatus && (
                          <Badge variant="outline">
                            {consultant.visaStatus}
                          </Badge>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm text-muted-foreground">
                        <div className="flex items-center space-x-2">
                          <Mail size={16} />
                          <span className="truncate">{consultant.email}</span>
                        </div>
                        
                        {consultant.phone && (
                          <div className="flex items-center space-x-2">
                            <Phone size={16} />
                            <span>{consultant.phone}</span>
                          </div>
                        )}
                        
                        {consultant.countryOfOrigin && (
                          <div className="flex items-center space-x-2">
                            <MapPin size={16} />
                            <span>{consultant.countryOfOrigin}</span>
                          </div>
                        )}
                        
                        {consultant.university && (
                          <div className="flex items-center space-x-2">
                            <GraduationCap size={16} />
                            <span className="truncate">{consultant.university}</span>
                          </div>
                        )}
                        
                        {consultant.yearCameToUS && (
                          <div className="flex items-center space-x-2">
                            <Calendar size={16} />
                            <span>US Since {consultant.yearCameToUS}</span>
                          </div>
                        )}
                        
                        <div className="flex items-center space-x-2">
                          <Building size={16} />
                          <span>{consultant.projects?.length || 0} Projects</span>
                        </div>
                      </div>
                      
                      {consultant.projects && consultant.projects.length > 0 && (
                        <div className="mt-3">
                          <p className="text-sm font-medium mb-1">Recent Projects:</p>
                          <div className="flex flex-wrap gap-2">
                            {consultant.projects.slice(0, 3).map((project) => (
                              <Badge key={project.id} variant="secondary" className="text-xs">
                                {project.projectName}
                              </Badge>
                            ))}
                            {consultant.projects.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{consultant.projects.length - 3} more
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-1 ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleViewConsultant(consultant)}
                      title="View details"
                    >
                      <Eye size={16} />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleEditConsultant(consultant)}
                      title="Edit consultant"
                    >
                      <Edit size={16} />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleDeleteConsultant(consultant.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      disabled={deleteMutation.isPending}
                      title="Delete consultant"
                    >
                      {deleteMutation.isPending && deleteConfirm === consultant.id ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Trash2 size={16} />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Add/Edit Consultant Form */}
      {(showAddForm || showEditForm) && (
        <AdvancedConsultantForm
          open={showAddForm || showEditForm}
          onClose={handleFormClose}
          onSubmit={handleFormSubmit}
          initialData={showEditForm ? selectedConsultant : undefined}
          editMode={showEditForm}
          isSubmitting={createMutation.isPending || updateMutation.isPending}
        />
      )}

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

      {/* Feature Preview Card */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>👥 Consultant Management Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <p className="mb-4">This section includes:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto text-left">
              <ul className="space-y-2">
                <li>✅ Consultant profiles with detailed info</li>
                <li>✅ Project history tracking</li>
                <li>✅ Status management (Active/Inactive)</li>
                <li>✅ Advanced search and filtering</li>
              </ul>
              <ul className="space-y-2">
                <li>✅ Visa status tracking</li>
                <li>✅ Educational background</li>
                <li>✅ Assignment to requirements</li>
                <li>✅ Interview scheduling</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
