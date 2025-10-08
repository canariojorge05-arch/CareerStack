import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Mail, FileText, Calendar, Users, ChartBar as BarChart3, MessageSquare, Inbox, Send, File as FileEdit, Plus, Settings, LogOut, ArrowLeft } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

// Import Marketing components
import ModernEmailClient from '@/components/marketing/modern-email-client';
import RequirementsSection from '@/components/marketing/requirements-section';
import InterviewsSection from '@/components/marketing/interviews-section';
import ConsultantsSection from '@/components/marketing/consultants-section';

export default function MarketingPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [activeSection, setActiveSection] = useState('emails');
  const [selectedEmailAccountId, setSelectedEmailAccountId] = useState<string | null>(null);

  const navigationItems = [
    { id: 'emails', label: 'Emails', icon: Mail, description: 'Gmail-like email management' },
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
      case 'emails':
        return <ModernEmailClient accountFilter={selectedEmailAccountId} />;
      case 'consultants':
        return <ConsultantsSection />;
      case 'requirements':
        return <RequirementsSection />;
      case 'interviews':
        return <InterviewsSection />;
      default:
        return <ModernEmailClient />;
    }
  };

  // Define type for user object
  interface MarketingUser {
    firstName?: string;
    email?: string;
  }

  const marketingUser = user as MarketingUser;

  // Fetch total unread messages count from server (more efficient for large inboxes)
  const { data: unreadData = { unreadCount: 0, perAccount: [] }, isLoading: inboxLoading } = useQuery<{ unreadCount: number; perAccount?: any[] } | undefined>({
    queryKey: ['/api/marketing/emails/unread-count'],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', '/api/marketing/emails/unread-count');
        if (!response.ok) return { unreadCount: 0 } as { unreadCount: number };
        return response.json();
      } catch (e) {
        return { unreadCount: 0 } as { unreadCount: number };
      }
    },
    staleTime: 15_000,
    retry: false,
  });

  const unreadCount = unreadData?.unreadCount || 0;
  const [srMessage, setSrMessage] = useState('');
  const [filterHistory, setFilterHistory] = useState<Array<string | null>>([]);

  // Load persisted filter history and selected account from localStorage
  useEffect(() => {
    try {
      const rawHistory = localStorage.getItem('marketing.filterHistory');
      if (rawHistory) {
        const parsed = JSON.parse(rawHistory) as Array<string | null>;
        setFilterHistory(parsed || []);
      }
      const rawSelected = localStorage.getItem('marketing.selectedEmailAccount');
      if (rawSelected !== null) {
        setSelectedEmailAccountId(rawSelected || null);
      }
    } catch (e) {
      // ignore
    }
  }, []);

  // Persist selectedEmailAccountId to localStorage
  useEffect(() => {
    try {
      if (selectedEmailAccountId) {
        localStorage.setItem('marketing.selectedEmailAccount', selectedEmailAccountId);
      } else {
        localStorage.removeItem('marketing.selectedEmailAccount');
      }
    } catch (e) {}
  }, [selectedEmailAccountId]);

  const pushHistory = (prev: string | null) => {
    setFilterHistory((h) => {
      const next = [...h, prev];
      try { localStorage.setItem('marketing.filterHistory', JSON.stringify(next)); } catch (e) {}
      return next;
    });
  };

  const undoFilter = () => {
    setFilterHistory((h) => {
      if (h.length === 0) return h;
      const last = h[h.length - 1];
      const rest = h.slice(0, -1);
      setSelectedEmailAccountId(last || null);
      setSrMessage(last ? 'Filter restored' : 'Filter cleared');
      try { localStorage.setItem('marketing.filterHistory', JSON.stringify(rest)); } catch (e) {}
      try { if (last) localStorage.setItem('marketing.selectedEmailAccount', last); else localStorage.removeItem('marketing.selectedEmailAccount'); } catch (e) {}
      toast.success('Filter restored', { duration: 1500 });
      return rest;
    });
  };

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
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
            {/* Screen reader live region for filter announcements */}
            <div aria-live="polite" role="status" className="sr-only">
              {srMessage}
            </div>
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="h-10 w-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                <MessageSquare className="text-white" size={20} />
              </div>
              <div>
                <h1 className="text-xl font-semibold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">Marketing Module</h1>
                <p className="text-xs text-slate-500">Resume Customizer Pro</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <Badge variant="outline" className="bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border-blue-200/50 shadow-sm">
                Marketing Team
              </Badge>
              <div className="flex items-center space-x-3">
                <div className="h-8 w-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full flex items-center justify-center shadow-md">
                  <span className="text-sm font-medium text-white">
                    {marketingUser?.firstName?.[0] || marketingUser?.email?.[0] || 'M'}
                  </span>
                </div>
                <span className="text-sm font-medium text-slate-700 hidden sm:inline-block">
                  {marketingUser?.firstName || marketingUser?.email || 'Marketing User'}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setLocation('/dashboard')}
                  className="hover:bg-slate-50 border-slate-200 transition-all hover:shadow-md"
                >
                  <ArrowLeft size={16} className="mr-1.5" />
                  <span>Back</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>
  <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation */}
        <div className="mb-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                    
                    {item.id === 'emails' && (
                      <div className="mt-3 flex justify-center">
                        <Badge className={`transition-all duration-300 ${
                          isActive 
                            ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/30' 
                            : 'bg-gradient-to-r from-orange-600 to-amber-600 text-white group-hover:shadow-lg group-hover:shadow-orange-500/20'
                        }`}>
                          {inboxLoading ? '...' : unreadCount} unread
                        </Badge>
                      </div>
                    )}
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
                  const IconComponent = activeItem?.icon || Mail;
                  return (
                    <>
                      <div className="h-10 w-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                        <IconComponent size={20} className="text-white drop-shadow-sm" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-slate-900">{activeItem?.label || 'Emails'}</h2>
                        <p className="text-sm text-slate-600 font-normal">{activeItem?.description || 'Gmail-like email management'}</p>
                      </div>
                    </>
                  );
                })()}
              </CardTitle>

              {/* Section-specific action buttons */}
              <div className="flex items-center space-x-2">
                {activeSection === 'emails' && (
                  <div className="flex items-center gap-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <div className="h-9 w-auto flex items-center bg-gradient-to-br from-orange-100 to-amber-100 rounded-md px-3 py-1 shadow-sm cursor-pointer">
                          <Inbox className="text-orange-600" size={16} />
                          <span className="ml-2 text-sm font-medium text-slate-700">Unread</span>
                          <Badge className="ml-3 bg-gradient-to-r from-orange-600 to-amber-600 text-white">
                            {inboxLoading ? '...' : unreadCount}
                          </Badge>
                        </div>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <div className="p-2 text-xs text-slate-500">Unread by account</div>
                        <DropdownMenuItem className="text-sm" onClick={() => {
                          const previous = selectedEmailAccountId;
                          setFilterHistory(h => [...h, previous]);
                          setSelectedEmailAccountId(null);
                          setActiveSection('emails');
                          setSrMessage('Showing all accounts');
                          toast.info('Showing all accounts', {
                            duration: 3000,
                            action: {
                              label: 'Undo',
                              onClick: () => {
                                // Pop last history and restore
                                setFilterHistory(h => {
                                  const last = h[h.length - 1];
                                  const rest = h.slice(0, -1);
                                  setSelectedEmailAccountId(last || null);
                                  setSrMessage(last ? `Filter restored` : 'Filter cleared');
                                  toast.success('Filter restored', { duration: 1500 });
                                  return rest;
                                });
                              }
                            }
                          });
                        }}>
                          Show all accounts
                        </DropdownMenuItem>
                        {Array.isArray(unreadData?.perAccount) && unreadData!.perAccount.length > 0 ? (
                          unreadData!.perAccount.map((acc: any) => (
                            <DropdownMenuItem key={acc.accountId || acc.emailAddress} className="flex justify-between items-center" onClick={() => {
                              const previous = selectedEmailAccountId;
                              setFilterHistory(h => [...h, previous]);
                              setSelectedEmailAccountId(acc.accountId || null);
                              setActiveSection('emails');
                              setSrMessage(`Filtering to ${acc.accountName || acc.emailAddress}`);
                              toast.info(`Filtering to ${acc.accountName || acc.emailAddress}`, {
                                duration: 3000,
                                action: {
                                  label: 'Undo',
                                  onClick: () => {
                                    // Restore most recent previous value from history
                                    setFilterHistory(h => {
                                      const last = h[h.length - 1];
                                      const rest = h.slice(0, -1);
                                      setSelectedEmailAccountId(last || null);
                                      setSrMessage(last ? `Filter restored` : 'Filter cleared');
                                      toast.success('Filter restored', { duration: 1500 });
                                      return rest;
                                    });
                                  }
                                }
                              });
                            }}>
                              <div className="text-sm">
                                <div className="font-medium">{acc.accountName || acc.emailAddress || 'Unknown'}</div>
                                {acc.emailAddress && <div className="text-xs text-slate-400">{acc.emailAddress}</div>}
                              </div>
                              <div className="ml-4">
                                <Badge className="bg-gradient-to-r from-orange-600 to-amber-600 text-white">{acc.unreadCount}</Badge>
                              </div>
                            </DropdownMenuItem>
                          ))
                        ) : (
                          <DropdownMenuItem className="text-sm text-slate-500">No unread messages</DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    {filterHistory.length > 0 && (
                      <Button size="sm" variant="outline" onClick={() => undoFilter()} className="ml-2">
                        Undo
                      </Button>
                    )}
                  </div>
                )}
                {activeSection === 'requirements' && (
                  <Button size="sm" className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg shadow-green-500/30 hover:shadow-xl hover:shadow-green-500/40 transition-all duration-300">
                    <Plus size={16} className="mr-2" />
                    New Requirement
                  </Button>
                )}
                {activeSection === 'interviews' && (
                  <Button size="sm" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-all duration-300">
                    <Plus size={16} className="mr-2" />
                    Schedule Interview
                  </Button>
                )}
                {activeSection === 'consultants' && (
                  <Button size="sm" className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40 transition-all duration-300">
                    <Plus size={16} className="mr-2" />
                    Add Consultant
                  </Button>
                )}
              </div>
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
