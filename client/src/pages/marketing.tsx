import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Calendar, Users } from 'lucide-react';
import { AppHeader } from '@/components/shared/app-header';

// Import Marketing components
import RequirementsSection from '@/components/marketing/requirements-section';
import InterviewsSection from '@/components/marketing/interviews-section';
import ConsultantsSection from '@/components/marketing/consultants-section';

export default function MarketingPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [activeSection, setActiveSection] = useState('requirements');

  const navigationItems = [
    {
      id: 'requirements',
      label: 'Requirements',
      icon: FileText,
      description: 'Manage job requirements',
    },
    {
      id: 'interviews',
      label: 'Interviews',
      icon: Calendar,
      description: 'Schedule and track interviews',
    },
    {
      id: 'consultants',
      label: 'Consultants',
      icon: Users,
      description: 'Manage consultant profiles',
    },
  ];

  const renderActiveSection = () => {
    switch (activeSection) {
      case 'consultants':
        return <ConsultantsSection />;
      case 'requirements':
        return <RequirementsSection />;
      case 'interviews':
        return <InterviewsSection />;
      default:
        return <RequirementsSection />;
    }
  };

  // Define type for user object
  interface MarketingUser {
    firstName?: string;
    email?: string;
  }

  const marketingUser = user as MarketingUser;


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      {/* Shared Header with Auto-hide */}
      <AppHeader currentPage="marketing" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Marketing Hub</h1>
          <p className="text-slate-600">Manage requirements, interviews, and consultant profiles</p>
        </div>

        {/* Navigation Tabs - Modern Horizontal Style */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-1.5">
          <div className="grid grid-cols-3 gap-1.5">
            {navigationItems.map((item) => {
              const IconComponent = item.icon;
              const isActive = activeSection === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`group relative px-4 py-3 rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/30'
                      : 'bg-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-center space-x-2">
                    <IconComponent size={20} className={isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-700'} />
                    <div className="text-left">
                      <div className={`font-semibold text-sm ${isActive ? 'text-white' : 'text-slate-700 group-hover:text-slate-900'}`}>
                        {item.label}
                      </div>
                      <div className={`text-xs ${isActive ? 'text-blue-100' : 'text-slate-500 group-hover:text-slate-600'} hidden sm:block`}>
                        {item.description}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>


        {/* Quick Stats - Only show in Requirements section */}
        {activeSection === 'requirements' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-slate-200 hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 mb-1">Active Requirements</p>
                    <p className="text-3xl font-bold text-slate-900">24</p>
                    <p className="text-xs text-green-600 mt-1 flex items-center">
                      <span className="mr-1">↑</span> +3 this week
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <FileText className="text-blue-600" size={24} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 mb-1">Upcoming Interviews</p>
                    <p className="text-3xl font-bold text-slate-900">8</p>
                    <p className="text-xs text-slate-600 mt-1">Next: Tomorrow</p>
                  </div>
                  <div className="h-12 w-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                    <Calendar className="text-indigo-600" size={24} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 mb-1">Active Consultants</p>
                    <p className="text-3xl font-bold text-slate-900">12</p>
                    <p className="text-xs text-green-600 mt-1 flex items-center">
                      <span className="mr-1">↑</span> 2 new this month
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Users className="text-purple-600" size={24} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Content Area */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="p-6">
            {renderActiveSection()}
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
