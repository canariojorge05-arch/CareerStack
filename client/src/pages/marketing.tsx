import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Calendar, Users, Download, Plus, Filter, BarChart3, type LucideIcon } from 'lucide-react';
import { AppHeader } from '@/components/shared/app-header';
import { BreadcrumbNavigation } from '@/components/shared/breadcrumb-navigation';
import { EnhancedHeader } from '@/components/shared/enhanced-header';
import { MetricCard, StatusDistribution } from '@/components/ui/data-visualization';

// Import Marketing components
import RequirementsSection from '@/components/marketing/requirements-section';
import InterviewsSection from '@/components/marketing/interviews-section';
import ConsultantsSection from '@/components/marketing/consultants-section';
import AdvancedRequirementsForm from '@/components/marketing/advanced-requirements-form';
import InterviewForm from '@/components/marketing/interview-form';
import AdvancedConsultantForm from '@/components/marketing/advanced-consultant-form';
// import DebugConsultants from '../../debug-consultants';

export default function MarketingPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [activeSection, setActiveSection] = useState('requirements');
  const [showRequirementForm, setShowRequirementForm] = useState(false);
  const [showInterviewForm, setShowInterviewForm] = useState(false);
  const [showConsultantForm, setShowConsultantForm] = useState(false);

  // Initialize CSRF token on page load
  useEffect(() => {
    const initializeCSRF = async () => {
      try {
        // Check if CSRF token exists
        const existingToken = document.cookie
          .split('; ')
          .find(row => row.startsWith('csrf_token='))
          ?.split('=')[1];
        
        if (!existingToken) {
          console.log('🔒 Initializing CSRF token for marketing page...');
          // Make a simple GET request to initialize CSRF token
          await apiRequest('GET', '/api/auth/user');
          console.log('🔒 CSRF token initialized successfully');
        } else {
          console.log('🔒 CSRF token already exists');
        }
      } catch (error) {
        console.warn('🔒 Failed to initialize CSRF token:', error);
      }
    };

    initializeCSRF();
  }, []);

  // Define interface for navigation items
  interface NavigationItem {
    id: string;
    label: string;
    icon: LucideIcon;
    description: string;
  }

  const navigationItems: NavigationItem[] = [
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

  const activeComponent = useMemo(() => {
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
  }, [activeSection]);

  // Define type for user object
  interface MarketingUser {
    firstName?: string;
    email?: string;
  }

  const marketingUser = user as MarketingUser;
  
  // Fetch real stats from API
  const { data: stats } = useQuery({
    queryKey: ['/api/stats/marketing/stats'],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', '/api/stats/marketing/stats');
        if (!response.ok) {
          // Return fallback data if API fails
          return {
            activeRequirements: { total: 0, weeklyChange: 0, trend: 'neutral' },
            upcomingInterviews: { total: 0, nextInterview: 'No upcoming' },
            activeConsultants: { total: 0, monthlyChange: 0, trend: 'neutral' },
          };
        }
        return response.json();
      } catch {
        return {
          activeRequirements: { total: 0, weeklyChange: 0, trend: 'neutral' },
          upcomingInterviews: { total: 0, nextInterview: 'No upcoming' },
          activeConsultants: { total: 0, monthlyChange: 0, trend: 'neutral' },
        };
      }
    },
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 15000, // Consider stale after 15 seconds
  });

  // Enhanced header actions
  const headerActions = [
    {
      label: 'Export Data',
      icon: Download,
      onClick: () => {
        // TODO: Implement export functionality
        console.log('Export data');
      },
      variant: 'outline' as const,
    },
    {
      label: 'Quick Add',
      icon: Plus,
      onClick: () => {
        const options = {
          requirements: () => setShowRequirementForm(true),
          interviews: () => setShowInterviewForm(true),
          consultants: () => setShowConsultantForm(true),
        };
        // Call the appropriate function based on active section
        options[activeSection as keyof typeof options]?.();
      },
    },
    {
      label: 'Analytics',
      icon: BarChart3,
      onClick: () => {
        // TODO: Navigate to analytics
        console.log('Analytics');
      },
      variant: 'outline' as const,
    },
  ];

  const headerStats = [
    {
      label: 'Active Requirements',
      value: stats?.activeRequirements?.total || 0,
      variant: 'outline' as const,
    },
    {
      label: 'This Week',
      value: `+${stats?.activeRequirements?.weeklyChange || 0}`,
      variant: 'secondary' as const,
    },
  ];

  const breadcrumbItems = [
    { label: 'Marketing Hub', isActive: false },
    { label: activeSection.charAt(0).toUpperCase() + activeSection.slice(1), isActive: true },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      {/* Shared Header with Auto-hide */}
      <AppHeader currentPage="marketing" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Breadcrumb Navigation */}
        <BreadcrumbNavigation items={breadcrumbItems} />

        {/* Enhanced Page Header */}
        <EnhancedHeader
          title="Marketing Hub"
          description="Manage requirements, interviews, and consultant profiles with advanced analytics and automation"
          stats={headerStats}
          actions={headerActions}
        />

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
                    <IconComponent
                      size={20}
                      className={
                        isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-700'
                      }
                    />
                    <div className="text-left">
                      <div
                        className={`font-semibold text-sm ${
                          isActive ? 'text-white' : 'text-slate-700 group-hover:text-slate-900'
                        }`}
                      >
                        {item.label}
                      </div>
                      <div
                        className={`text-xs ${
                          isActive ? 'text-blue-100' : 'text-slate-500 group-hover:text-slate-600'
                        } hidden sm:block`}
                      >
                        {item.description}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Enhanced Stats Dashboard - Show for all sections */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard
              title="Active Requirements"
              value={stats.activeRequirements?.total || 0}
              previousValue={stats.activeRequirements?.total - (stats.activeRequirements?.weeklyChange || 0)}
              icon={FileText as any} // Type assertion needed for Lucide icon compatibility
              trendValue={stats.activeRequirements?.weeklyChange > 0 
                ? `+${stats.activeRequirements.weeklyChange} this week`
                : 'No new this week'}
              description="Total job requirements being managed"
            />

            <MetricCard
              title="Upcoming Interviews"
              value={stats.upcomingInterviews?.total || 0}
              icon={Calendar as any} // Type assertion needed for Lucide icon compatibility
              description={`Next: ${stats.upcomingInterviews?.nextInterview || 'No upcoming'}`}
            />

            <MetricCard
              title="Active Consultants"
              value={stats.activeConsultants?.total || 0}
              previousValue={stats.activeConsultants?.total - (stats.activeConsultants?.monthlyChange || 0)}
              icon={Users as any} // Type assertion needed for Lucide icon compatibility
              trendValue={stats.activeConsultants?.monthlyChange > 0
                ? `+${stats.activeConsultants.monthlyChange} this month`
                : 'No new this month'}
              description="Consultants available for placement"
            />
          </div>
        )}

        {/* Status Distribution - Show only for requirements section */}
        {activeSection === 'requirements' && stats && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <StatusDistribution
              title="Requirements by Status"
              data={[
                { status: 'New', count: 12, color: '#3b82f6' },
                { status: 'Working', count: 8, color: '#f59e0b' },
                { status: 'Applied', count: 15, color: '#8b5cf6' },
                { status: 'Interviewed', count: 6, color: '#10b981' },
                { status: 'Cancelled', count: 3, color: '#ef4444' },
              ]}
            />
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
                    <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <FileText size={16} className="text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900">New requirement added</p>
                      <p className="text-xs text-slate-500">Senior React Developer at TechCorp</p>
                    </div>
                    <span className="text-xs text-slate-500">2h ago</span>
                  </div>
                  
                  <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
                    <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                      <Calendar size={16} className="text-green-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900">Interview scheduled</p>
                      <p className="text-xs text-slate-500">John Doe - Frontend Position</p>
                    </div>
                    <span className="text-xs text-slate-500">4h ago</span>
                  </div>
                  
                  <div className="flex items-center space-x-3 p-3 bg-purple-50 rounded-lg">
                    <div className="h-8 w-8 bg-purple-100 rounded-full flex items-center justify-center">
                      <Users size={16} className="text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900">Consultant updated</p>
                      <p className="text-xs text-slate-500">Jane Smith - Profile completed</p>
                    </div>
                    <span className="text-xs text-slate-500">6h ago</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Content Area */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="p-6">{activeComponent}</div>
        </div>
      </div>

      {/* Quick Add Forms */}
      {showRequirementForm && (
        <AdvancedRequirementsForm
          open={showRequirementForm}
          onClose={() => setShowRequirementForm(false)}
          onSubmit={async (requirements) => {
            // Handle form submission
            try {
              // You would typically make an API call here
              console.log('Submitting requirements:', requirements);
              setShowRequirementForm(false);
            } catch (error) {
              console.error('Error submitting requirements:', error);
            }
          }}
        />
      )}
      {showInterviewForm && (
        <InterviewForm
          open={showInterviewForm}
          onClose={() => setShowInterviewForm(false)}
          onSubmit={async (interview) => {
            try {
              console.log('Scheduling interview:', interview);
              setShowInterviewForm(false);
            } catch (error) {
              console.error('Error scheduling interview:', error);
            }
          }}
        />
      )}
      {showConsultantForm && (
        <AdvancedConsultantForm
          open={showConsultantForm}
          onClose={() => setShowConsultantForm(false)}
          onSubmit={async (consultant) => {
            try {
              console.log('Adding consultant:', consultant);
              setShowConsultantForm(false);
            } catch (error) {
              console.error('Error adding consultant:', error);
            }
          }}
        />
      )}
    </div>
  );
}
