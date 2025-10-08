import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { 
  Users, 
  Plus, 
  Search, 
  Filter, 
  Edit, 
  Eye, 
  Trash2, 
  Mail, 
  Phone,
  MapPin,
  Calendar,
  GraduationCap,
  Building
} from 'lucide-react';
import { format } from 'date-fns';
import AdvancedConsultantForm from './advanced-consultant-form';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedConsultant, setSelectedConsultant] = useState<Consultant | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);

  // Fetch consultants
  const { data: consultants = [], isLoading, refetch } = useQuery({
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
          return [] as Consultant[];
        }
        const data = await response.json();
        return data as Consultant[];
      } catch {
        return [] as Consultant[];
      }
    },
    retry: false,
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

  const handleFormClose = () => {
    setShowAddForm(false);
    setShowEditForm(false);
    setSelectedConsultant(null);
    refetch();
  };

  const handleFormSubmit = async (consultantData: any, projects: any[]) => {
    console.log('Submitting consultant:', consultantData, projects);
    // The form will handle the actual submission
    return Promise.resolve();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[500px]">
        <LoadingSpinner size="lg" />
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

        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
            <Filter size={16} className="mr-2" />
            More Filters
          </Button>
          <Button onClick={handleAddConsultant}>
            <Plus size={16} className="mr-2" />
            Add Consultant
          </Button>
        </div>
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
            <Card key={consultant.id} className="hover:shadow-md transition-shadow">
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

                  <div className="flex items-center space-x-2 ml-4">
                    <Button variant="ghost" size="sm" onClick={() => setSelectedConsultant(consultant)}>
                      <Eye size={16} />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleEditConsultant(consultant)}>
                      <Edit size={16} />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                      <Trash2 size={16} />
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
        />
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