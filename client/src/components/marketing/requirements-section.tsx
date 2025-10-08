import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { FileText, Plus, Search, Filter, CreditCard as Edit, Eye, Trash2 } from 'lucide-react';
import AdvancedRequirementsForm from './advanced-requirements-form';

export default function RequirementsSection() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showRequirementForm, setShowRequirementForm] = useState(false);
  const [selectedRequirement, setSelectedRequirement] = useState<any>(null);
  const [showEditForm, setShowEditForm] = useState(false);

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

  const mockRequirements = [
    {
      id: '1',
      jobTitle: 'Senior React Developer',
      clientCompany: 'Tech Solutions Inc',
      status: 'New',
      assignedTo: 'John Doe',
      primaryTechStack: 'React, TypeScript, Node.js',
      createdAt: new Date(),
    },
    {
      id: '2',
      jobTitle: 'Full Stack Developer',
      clientCompany: 'StartupCorp',
      status: 'Working',
      assignedTo: 'Jane Smith',
      primaryTechStack: 'Python, Django, React',
      createdAt: new Date(),
    },
  ];

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
    console.log('Submitting requirements:', requirementData);
    // Handle form submission
    return Promise.resolve();
  };

  const getConsultantName = (consultantId: string) => {
    const consultant = consultants.find((c: any) => c.id === consultantId);
    return consultant?.name || 'Unassigned';
  };

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
        {mockRequirements.map((requirement, index) => (
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
                      <span className="font-semibold text-slate-700">Assigned to:</span>
                      <span>{requirement.assignedTo}</span>
                    </div>
                    <div className="flex items-start space-x-2">
                      <span className="font-semibold text-slate-700">Tech Stack:</span>
                      <span>{requirement.primaryTechStack}</span>
                    </div>
                    <div className="flex items-start space-x-2">
                      <span className="font-semibold text-slate-700">Created:</span>
                      <span>{requirement.createdAt.toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="sm" className="hover:bg-blue-50 hover:text-blue-600">
                    <Eye size={16} />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleEditRequirement(requirement)} className="hover:bg-blue-50 hover:text-blue-600">
                    <Edit size={16} />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50">
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {mockRequirements.length === 0 && (
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
        />
      )}
    </div>
  );
}
