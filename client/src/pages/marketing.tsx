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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-indigo-50/30 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-40">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-100/20 to-indigo-100/20" />
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(148, 163, 184, 0.15) 1px, transparent 0)`,
          backgroundSize: '20px 20px'
        }} />
      </div>
      <div className="relative z-10">
      {/* Shared Header with Auto-hide */}
      <AppHeader currentPage="marketing" />
  <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation */}
        <div className="mb-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {navigationItems.map((item) => {
              const IconComponent = item.icon;
              const isActive = activeSection === item.id;

              return (
                <Card
                  key={item.id}
                  className={`cursor-pointer transition-all duration-500 group relative overflow-hidden ${
                    isActive
                      ? 'ring-2 ring-blue-400 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 border-blue-300 shadow-xl shadow-blue-500/20 scale-[1.02]'
                      : 'hover:bg-gradient-to-br hover:from-slate-50 hover:to-gray-50 hover:border-slate-400 hover:shadow-xl hover:shadow-slate-500/10 hover:scale-[1.01] border-slate-200'
                  }`}
                  onClick={() => setActiveSection(item.id)}
                >
                  {/* Background Pattern */}
                  <div className={`absolute inset-0 opacity-5 ${
                    isActive ? 'bg-gradient-to-br from-blue-600 to-indigo-600' : 'bg-gradient-to-br from-slate-600 to-gray-600'
                  }`} />
                  
                  <CardContent className="p-6 text-center relative z-10">
                    <div
                      className={`h-16 w-16 mx-auto rounded-2xl flex items-center justify-center mb-5 transition-all duration-500 ${
                        isActive
                          ? 'bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 text-white shadow-2xl shadow-blue-500/50 scale-110 rotate-3'
                          : 'bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600 group-hover:from-slate-200 group-hover:to-slate-300 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-slate-400/30'
                      }`}
                    >
                      <IconComponent size={28} className="drop-shadow-sm" />
                    </div>
                    
                    <h3 className={`font-bold text-base mb-2 transition-colors duration-300 ${
                      isActive ? 'text-blue-900' : 'text-slate-800 group-hover:text-slate-900'
                    }`}>{item.label}</h3>
                    
                    <p className={`text-xs leading-relaxed transition-colors duration-300 ${
                      isActive ? 'text-blue-700' : 'text-slate-500 group-hover:text-slate-600'
                    }`}>{item.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>


        {/* Quick Stats - Only show in Requirements section */}
        {activeSection === 'requirements' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <Card className="border-slate-200 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] bg-gradient-to-br from-green-50 to-emerald-50 border-green-200/50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-700 mb-3">Active Requirements</p>
                    <p className="text-4xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent drop-shadow-sm">24</p>
                    <p className="text-xs text-green-600 mt-1">+3 this week</p>
                  </div>
                  <div className="h-14 w-14 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-green-500/30">
                    <FileText className="text-white drop-shadow-sm" size={26} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200/50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-700 mb-3">Upcoming Interviews</p>
                    <p className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent drop-shadow-sm">8</p>
                    <p className="text-xs text-blue-600 mt-1">Next: Tomorrow</p>
                  </div>
                  <div className="h-14 w-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                    <Calendar className="text-white drop-shadow-sm" size={26} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200/50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-purple-700 mb-3">Active Consultants</p>
                    <p className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent drop-shadow-sm">12</p>
                    <p className="text-xs text-purple-600 mt-1">2 new this month</p>
                  </div>
                  <div className="h-14 w-14 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/30">
                    <Users className="text-white drop-shadow-sm" size={26} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Content Area */}
        <Card className="min-h-[700px] w-full shadow-2xl border-slate-300/50 animate-in fade-in slide-in-from-bottom-4 duration-700 bg-gradient-to-br from-white via-slate-50/30 to-white">
          <CardHeader className="border-b border-slate-300/50 bg-gradient-to-r from-slate-50 via-white to-slate-50 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center space-x-4 text-slate-800">
                {(() => {
                  const activeItem = navigationItems.find((item) => item.id === activeSection);
                  const IconComponent = activeItem?.icon || FileText;
                  return (
                    <>
                      <div className="h-10 w-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                        <IconComponent size={20} className="text-white drop-shadow-sm" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-slate-900">{activeItem?.label || 'Requirements'}</h2>
                        <p className="text-sm text-slate-600 font-normal">{activeItem?.description || 'Manage job requirements'}</p>
                      </div>
                    </>
                  );
                })()}
              </CardTitle>

              {/* Section-specific action buttons removed - they're handled by each section component */}
            </div>
          </CardHeader>

          <CardContent className="p-8 bg-gradient-to-br from-white/50 to-slate-50/50 backdrop-blur-sm">
            {renderActiveSection()}
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  );
}
