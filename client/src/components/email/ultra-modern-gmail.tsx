import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { formatDistanceToNow, format } from 'date-fns';
import { apiRequest } from '@/lib/queryClient';
import DOMPurify from 'dompurify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { 
  Menu, Search, Settings, HelpCircle, Mail, Inbox, Send, FileText, Star, Trash2,
  Archive, Clock, Tag, RefreshCw, ChevronDown, ChevronLeft, ChevronRight,
  MoreVertical, Pencil, Check, X, AlertCircle, Filter, Users, 
  Reply, ReplyAll, Forward, Paperclip, Image, Link2, Smile, AtSign,
  Download, MailOpen, Circle, Square, SquareCheck, ArrowLeft, Plus,
  Maximize2, Minimize2, AlertTriangle, Calendar, Zap, Bookmark
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface EmailAccount {
  id: string;
  accountName: string;
  emailAddress: string;
  provider: string;
  isActive: boolean;
  isDefault: boolean;
}

interface EmailThread {
  id: string;
  subject: string;
  participantEmails: string[];
  lastMessageAt: Date | null;
  messageCount: number;
  isArchived: boolean | null;
  labels: string[];
  messages?: EmailMessage[];
  preview?: string;
}

interface EmailMessage {
  id: string;
  subject: string;
  fromEmail: string;
  toEmails: string[];
  ccEmails: string[];
  htmlBody: string | null;
  textBody: string | null;
  sentAt: Date | null;
  isRead: boolean;
  isStarred: boolean;
  threadId: string;
  attachments?: any[];
}

export default function UltraModernGmailClient() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedFolder, setSelectedFolder] = useState('inbox');
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [composeOpen, setComposeOpen] = useState(false);
  const [accountsOpen, setAccountsOpen] = useState(false);
  const [selectedThreads, setSelectedThreads] = useState<Set<string>>(new Set());
  const [view, setView] = useState<'list' | 'split'>('split');
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  
  const queryClient = useQueryClient();

  // Debounced search to prevent excessive API calls (500ms delay)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch email accounts - cached for 5 minutes
  const { data: accountsData } = useQuery({
    queryKey: ['/api/email/accounts'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/email/accounts');
      if (!response.ok) return { success: false, accounts: [] };
      const data = await response.json();
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - accounts don't change often
    gcTime: 30 * 60 * 1000, // 30 minutes
  });

  const emailAccounts: EmailAccount[] = accountsData?.accounts || accountsData || [];

  // Infinite query with pagination for email threads
  const {
    data: emailThreadsData,
    isLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['/api/marketing/emails/threads', selectedFolder, debouncedSearchQuery],
    queryFn: async ({ pageParam = 0 }): Promise<{ threads: EmailThread[]; nextCursor?: number; total: number }> => {
      try {
        const limit = 50; // Fetch 50 threads per page
        const endpoint = debouncedSearchQuery.trim()
          ? `/api/marketing/emails/search?q=${encodeURIComponent(debouncedSearchQuery)}&limit=${limit}&offset=${pageParam}`
          : `/api/marketing/emails/threads?type=${selectedFolder}&limit=${limit}&offset=${pageParam}`;
        
        const response = await apiRequest('GET', endpoint);
        if (!response.ok) return { threads: [], nextCursor: undefined, total: 0 };
        
        const data = await response.json();
        const threads = Array.isArray(data) ? data : data.threads || [];
        
        return {
          threads,
          nextCursor: threads.length === limit ? (pageParam as number) + limit : undefined,
          total: data.total || threads.length,
        };
      } catch {
        return { threads: [], nextCursor: undefined, total: 0 };
      }
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: 0,
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnMount: false,
  });

  // Flatten threads from all pages
  const emailThreads = useMemo(() => {
    if (!emailThreadsData?.pages) return [];
    return emailThreadsData.pages.flatMap((page) => page.threads || []);
  }, [emailThreadsData]);

  const totalThreadCount = emailThreadsData?.pages?.[0]?.total ?? 0;

  // Fetch messages for selected thread with caching
  const { data: threadMessages = [], isLoading: messagesLoading } = useQuery<EmailMessage[]>({
    queryKey: ['/api/marketing/emails/threads', selectedThread, 'messages'],
    queryFn: async () => {
      if (!selectedThread) return [];
      const response = await apiRequest('GET', `/api/marketing/emails/threads/${selectedThread}/messages`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!selectedThread,
    staleTime: 2 * 60 * 1000, // 2 minutes - messages are fairly static
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Star mutation
  const starMutation = useMutation({
    mutationFn: async ({ messageId, isStarred }: { messageId: string; isStarred: boolean }) => {
      const response = await apiRequest('PATCH', `/api/marketing/emails/messages/${messageId}/star`, { isStarred });
      if (!response.ok) throw new Error('Failed');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/emails/threads'] });
    },
  });

  // Archive mutation
  const archiveMutation = useMutation({
    mutationFn: async (threadId: string) => {
      const response = await apiRequest('PATCH', `/api/marketing/emails/threads/${threadId}/archive`, { isArchived: true });
      if (!response.ok) throw new Error('Failed');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/emails/threads'] });
      toast.success('Conversation archived');
      setSelectedThread(null);
    },
  });

  // Send email mutation
  const sendEmailMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!emailAccounts[0]) throw new Error('No account connected');
      
      const response = await apiRequest('POST', '/api/email/send', {
        accountId: emailAccounts[0].id,
        to: [data.to],
        subject: data.subject,
        htmlBody: `<p>${data.body}</p>`,
        textBody: data.body,
      });
      
      if (!response.ok) throw new Error('Failed to send');
      return response.json();
    },
    onSuccess: () => {
      toast.success('Email sent successfully!');
      setComposeOpen(false);
      setComposeTo('');
      setComposeSubject('');
      setComposeBody('');
    },
    onError: () => {
      toast.error('Failed to send email');
    },
  });

  // OAuth handlers
  const handleConnectAccount = async (provider: 'gmail' | 'outlook') => {
    try {
      const endpoint = `/api/email/${provider}/auth-url`;
      const response = await apiRequest('GET', endpoint);
      
      if (response.ok) {
        const { authUrl } = await response.json();
        window.location.href = authUrl;
      }
    } catch (error) {
      toast.error('Failed to connect account');
    }
  };

  const getInitials = (email: string) => {
    const name = email.split('@')[0];
    return name.slice(0, 2).toUpperCase();
  };

  const handleSend = () => {
    if (!composeTo || !composeSubject || !composeBody) {
      toast.error('Please fill in all fields');
      return;
    }
    
    sendEmailMutation.mutate({
      to: composeTo,
      subject: composeSubject,
      body: composeBody,
    });
  };

  // Prefetch folder data on hover for instant switching
  const handleFolderPrefetch = useCallback((folderId: string) => {
    queryClient.prefetchInfiniteQuery({
      queryKey: ['/api/marketing/emails/threads', folderId, debouncedSearchQuery],
      queryFn: async ({ pageParam = 0 }) => {
        const limit = 50;
        const endpoint = debouncedSearchQuery.trim()
          ? `/api/marketing/emails/search?q=${encodeURIComponent(debouncedSearchQuery)}&limit=${limit}&offset=${pageParam}`
          : `/api/marketing/emails/threads?type=${folderId}&limit=${limit}&offset=${pageParam}`;
        
        const response = await apiRequest('GET', endpoint);
        if (!response.ok) return { threads: [], nextCursor: undefined, total: 0 };
        
        const data = await response.json();
        const threads = Array.isArray(data) ? data : data.threads || [];
        
        return {
          threads,
          nextCursor: threads.length === limit ? (pageParam as number) + limit : undefined,
          total: data.total || threads.length,
        };
      },
      initialPageParam: 0,
      staleTime: 1 * 60 * 1000,
    });
  }, [queryClient, debouncedSearchQuery]);

  const folders = [
    { id: 'inbox', name: 'Inbox', icon: Inbox, color: 'text-blue-600', bgColor: 'bg-blue-50', count: emailThreads.filter((t: EmailThread) => !t.isArchived).length },
    { id: 'starred', name: 'Starred', icon: Star, color: 'text-yellow-600', bgColor: 'bg-yellow-50', count: 0 },
    { id: 'snoozed', name: 'Snoozed', icon: Clock, color: 'text-purple-600', bgColor: 'bg-purple-50', count: 0 },
    { id: 'sent', name: 'Sent', icon: Send, color: 'text-green-600', bgColor: 'bg-green-50', count: 0 },
    { id: 'drafts', name: 'Drafts', icon: FileText, color: 'text-orange-600', bgColor: 'bg-orange-50', count: 0 },
    { id: 'archived', name: 'Archive', icon: Archive, color: 'text-gray-600', bgColor: 'bg-gray-50', count: 0 },
    { id: 'trash', name: 'Trash', icon: Trash2, color: 'text-red-600', bgColor: 'bg-red-50', count: 0 },
  ];

  const currentFolder = folders.find(f => f.id === selectedFolder) || folders[0];

  return (
    <TooltipProvider>
      <div className="flex flex-col h-screen bg-white">
        {/* Gmail Header */}
        <header className="flex items-center gap-4 px-4 py-2 border-b border-gray-200">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex items-center gap-2">
            <Mail className="h-6 w-6 text-red-500" />
            <span className="text-xl font-normal text-gray-700 hidden sm:inline">Gmail</span>
          </div>

          {/* Search Bar - Gmail Style */}
          <div className="flex-1 max-w-3xl">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-gray-600" />
              <Input
                placeholder="Search mail"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-12 bg-gray-100 border-0 focus:bg-white focus:shadow-md focus:ring-0 rounded-full h-12 transition-all"
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full"
              >
                <Filter className="h-4 w-4 text-gray-500" />
              </Button>
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <HelpCircle className="h-5 w-5 text-gray-600" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Help</TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setAccountsOpen(true)}>
                  <Settings className="h-5 w-5 text-gray-600" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Settings</TooltipContent>
            </Tooltip>

            <div className="w-px h-6 bg-gray-300 mx-2" />

            <Avatar className="h-8 w-8 cursor-pointer">
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white text-xs font-medium">
                {emailAccounts[0]?.emailAddress ? getInitials(emailAccounts[0].emailAddress) : 'U'}
              </AvatarFallback>
            </Avatar>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar - Gmail Style */}
          <aside className={cn(
            "border-r border-gray-200 bg-white transition-all duration-300 flex flex-col overflow-hidden",
            sidebarOpen ? "w-64" : "w-0"
          )}>
            {sidebarOpen && (
              <>
                <div className="p-4">
                  <Button
                    onClick={() => setComposeOpen(true)}
                    className="w-full justify-start gap-4 bg-white hover:shadow-md text-gray-800 border-0 shadow-sm rounded-2xl h-14 hover:bg-gray-50 transition-all group"
                  >
                    <div className="bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 p-2.5 rounded-full group-hover:shadow-lg transition-shadow">
                      <Pencil className="h-5 w-5 text-white" />
                    </div>
                    <span className="font-medium text-base">Compose</span>
                  </Button>
                </div>

                <ScrollArea className="flex-1">
                  <nav className="px-2 pb-4 space-y-0.5">
                    {folders.map((folder) => (
                      <Button
                        key={folder.id}
                        variant="ghost"
                        className={cn(
                          "w-full justify-start gap-4 h-10 px-3 rounded-r-full transition-all",
                          selectedFolder === folder.id 
                            ? `${folder.bgColor} ${folder.color} font-bold` 
                            : "text-gray-700 hover:bg-gray-100 font-normal"
                        )}
                        onClick={() => setSelectedFolder(folder.id)}
                        onMouseEnter={() => handleFolderPrefetch(folder.id)}
                      >
                        <folder.icon className={cn(
                          "h-5 w-5",
                          selectedFolder === folder.id ? folder.color : "text-gray-600"
                        )} />
                        <span className="flex-1 text-left text-sm">
                          {folder.name}
                        </span>
                        {folder.count > 0 && (
                          <span className={cn(
                            "text-xs tabular-nums",
                            selectedFolder === folder.id ? folder.color : "text-gray-600"
                          )}>
                            {folder.count}
                          </span>
                        )}
                      </Button>
                    ))}
                  </nav>

                  <Separator className="my-2" />

                  {/* Labels Section */}
                  <div className="px-2 pb-4">
                    <div className="flex items-center justify-between px-3 py-2">
                      <span className="text-xs font-medium text-gray-500">Labels</span>
                      <Button variant="ghost" size="icon" className="h-5 w-5 rounded-full">
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="space-y-0.5">
                      <Button variant="ghost" className="w-full justify-start gap-3 h-9 px-3 text-gray-700 hover:bg-gray-100 rounded-r-full">
                        <div className="h-3 w-3 rounded-full bg-blue-500" />
                        <span className="text-sm">Work</span>
                      </Button>
                      <Button variant="ghost" className="w-full justify-start gap-3 h-9 px-3 text-gray-700 hover:bg-gray-100 rounded-r-full">
                        <div className="h-3 w-3 rounded-full bg-green-500" />
                        <span className="text-sm">Personal</span>
                      </Button>
                      <Button variant="ghost" className="w-full justify-start gap-3 h-9 px-3 text-gray-700 hover:bg-gray-100 rounded-r-full">
                        <div className="h-3 w-3 rounded-full bg-purple-500" />
                        <span className="text-sm">Important</span>
                      </Button>
                    </div>
                  </div>

                  {/* Accounts */}
                  {emailAccounts.length > 0 && (
                    <>
                      <Separator className="my-2" />
                      <div className="px-2 pb-4">
                        <div className="text-xs font-medium text-gray-500 px-3 py-2 mb-1">
                          Connected Accounts ({emailAccounts.length})
                        </div>
                        {emailAccounts.slice(0, 3).map((account) => (
                          <div key={account.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className={cn(
                                "text-[10px] font-medium",
                                account.provider === 'gmail' ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"
                              )}>
                                {getInitials(account.emailAddress)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs text-gray-700 truncate flex-1">{account.emailAddress}</span>
                            {account.isDefault && (
                              <Check className="h-3 w-3 text-green-600" />
                            )}
                          </div>
                        ))}
                        {emailAccounts.length > 3 && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="w-full text-xs text-gray-600 h-8"
                            onClick={() => setAccountsOpen(true)}
                          >
                            + {emailAccounts.length - 3} more
                          </Button>
                        )}
                      </div>
                    </>
                  )}
                </ScrollArea>
              </>
            )}
          </aside>

          {/* Main Content */}
          <main className="flex-1 flex flex-col overflow-hidden bg-gray-50">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200">
              <div className="flex items-center gap-1">
                {selectedThreads.size === 0 ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full"
                    onClick={() => {}}
                  >
                    <Square className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full"
                    onClick={() => setSelectedThreads(new Set())}
                  >
                    <SquareCheck className="h-4 w-4 text-blue-600" />
                  </Button>
                )}

                <Separator orientation="vertical" className="h-6 mx-1" />

                {selectedThreads.size > 0 ? (
                  <>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="rounded-full"
                          onClick={() => {
                            selectedThreads.forEach(id => archiveMutation.mutate(id));
                            setSelectedThreads(new Set());
                          }}
                        >
                          <Archive className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Archive</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="rounded-full">
                          <AlertCircle className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Report spam</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="rounded-full">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Delete</TooltipContent>
                    </Tooltip>

                    <Separator orientation="vertical" className="h-6 mx-1" />

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="rounded-full">
                          <MailOpen className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Mark as read</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="rounded-full">
                          <Clock className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Snooze</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="rounded-full">
                          <Tag className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Add label</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="rounded-full">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>More</TooltipContent>
                    </Tooltip>
                  </>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-full"
                        onClick={() => refetch()}
                        disabled={isLoading}
                      >
                        <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Refresh</TooltipContent>
                  </Tooltip>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600">
                  {emailThreads.length > 0 ? '1' : '0'}-{emailThreads.length} of {totalThreadCount}
                </span>
                {isFetchingNextPage && (
                  <RefreshCw className="h-3 w-3 animate-spin text-gray-400" />
                )}
              </div>
            </div>

            {/* Email List or Split View */}
            <div className="flex-1 flex overflow-hidden">
              {/* Email List with Virtual Scrolling */}
              <div className={cn(
                "bg-white overflow-hidden flex flex-col border-r border-gray-200",
                selectedThread && view === 'split' ? "w-1/2" : "w-full"
              )}>
                {isLoading ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                      <RefreshCw className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">Loading your emails...</p>
                    </div>
                  </div>
                ) : emailThreads.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-96">
                    <currentFolder.icon className="h-20 w-20 text-gray-300 mb-4" />
                    <h3 className="text-xl font-normal text-gray-700 mb-2">
                      {searchQuery ? 'No emails found' : `Your ${currentFolder.name.toLowerCase()} is empty`}
                    </h3>
                    <p className="text-sm text-gray-500 mb-6">
                      {searchQuery ? 'Try a different search term' : emailAccounts.length === 0 ? 'Connect an account to get started' : 'No emails to display'}
                    </p>
                    {emailAccounts.length === 0 && (
                      <Button
                        onClick={() => setAccountsOpen(true)}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        <Mail className="h-4 w-4 mr-2" />
                        Connect Account
                      </Button>
                    )}
                  </div>
                ) : (
                  <VirtualizedThreadList
                    threads={emailThreads}
                    selectedThread={selectedThread}
                    selectedThreads={selectedThreads}
                    onThreadSelect={setSelectedThread}
                    onThreadsSelect={setSelectedThreads}
                    onStarToggle={(messageId, isStarred) => starMutation.mutate({ messageId, isStarred })}
                    hasNextPage={hasNextPage}
                    isFetchingNextPage={isFetchingNextPage}
                    fetchNextPage={fetchNextPage}
                  />
                )}
              </div>

              {/* Email Detail View (Split View) */}
              {selectedThread && view === 'split' && (
                <div className="flex-1 flex flex-col bg-white overflow-hidden">
                  {/* Email Header */}
                  <div className="px-6 py-4 border-b border-gray-200">
                    <div className="flex items-start justify-between mb-3">
                      <h1 className="text-2xl font-normal text-gray-900 flex-1">
                        {threadMessages[0]?.subject || '(no subject)'}
                      </h1>
                      <div className="flex items-center gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="rounded-full">
                              <Archive className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Archive</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="rounded-full">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="rounded-full">
                              <MailOpen className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Mark as unread</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="rounded-full">
                              <Clock className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Snooze</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="rounded-full">
                              <Tag className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Add label</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="rounded-full">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>More</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        <Inbox className="h-3 w-3 mr-1" />
                        Inbox
                      </Badge>
                      {threadMessages.length > 1 && (
                        <span className="text-xs text-gray-500">{threadMessages.length} messages</span>
                      )}
                    </div>
                  </div>

                  {/* Messages */}
                  <ScrollArea className="flex-1 px-6 py-4">
                    {messagesLoading ? (
                      <div className="flex items-center justify-center h-64">
                        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
                      </div>
                    ) : (
                      <div className="space-y-4 max-w-4xl">
                        {threadMessages.map((message, index) => (
                          <div key={message.id} className={cn(
                            "rounded-lg bg-white transition-all border border-gray-200",
                            index === threadMessages.length - 1 && "ring-2 ring-blue-100 border-blue-200 shadow-md"
                          )}>
                            <div className="p-6 bg-gradient-to-b from-white to-gray-50">
                              <div className="flex items-start gap-4 mb-6 pb-4 border-b border-gray-100">
                                <Avatar className="h-12 w-12 ring-2 ring-gray-100">
                                  <AvatarFallback className="bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 text-white text-sm font-semibold">
                                    {getInitials(message.fromEmail)}
                                  </AvatarFallback>
                                </Avatar>

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <span className="font-semibold text-gray-900">
                                          {message.fromEmail.split('@')[0]}
                                        </span>
                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-gray-50">
                                          {message.fromEmail.split('@')[1]}
                                        </Badge>
                                      </div>
                                      <div className="text-xs text-gray-500 mt-0.5">
                                        to {message.toEmails.join(', ')}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-gray-500 mr-2">
                                        {message.sentAt && format(new Date(message.sentAt), 'MMM d, h:mm a')}
                                      </span>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <button
                                            className={cn(
                                              "transition-colors p-1.5 rounded-full hover:bg-gray-100",
                                              message.isStarred ? "text-yellow-500" : "text-gray-400 hover:text-yellow-400"
                                            )}
                                            onClick={() => starMutation.mutate({ messageId: message.id, isStarred: !message.isStarred })}
                                          >
                                            <Star className={cn("h-4 w-4", message.isStarred && "fill-yellow-500")} />
                                          </button>
                                        </TooltipTrigger>
                                        <TooltipContent>Star</TooltipContent>
                                      </Tooltip>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-gray-100">
                                            <Reply className="h-4 w-4" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Reply</TooltipContent>
                                      </Tooltip>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-gray-100">
                                            <MoreVertical className="h-4 w-4" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>More options</TooltipContent>
                                      </Tooltip>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Email Content with proper styling */}
                              <EmailContent
                                htmlBody={message.htmlBody}
                                textBody={message.textBody}
                              />

                              {message.attachments && message.attachments.length > 0 && (
                                <div className="mt-6 pt-6 border-t border-gray-200">
                                  <div className="flex items-center gap-2 mb-4">
                                    <Paperclip className="h-4 w-4 text-blue-600" />
                                    <span className="text-sm font-semibold text-gray-900">
                                      {message.attachments.length} Attachment{message.attachments.length > 1 ? 's' : ''}
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {message.attachments.map((attachment: any, idx: number) => (
                                      <div
                                        key={idx}
                                        className="group flex items-center gap-3 p-3 border-2 border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50/50 cursor-pointer transition-all"
                                      >
                                        <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                                          <FileText className="h-5 w-5 text-white" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="text-sm font-medium truncate text-gray-900 group-hover:text-blue-600">
                                            {attachment.fileName}
                                          </div>
                                          <div className="text-xs text-gray-500 mt-0.5">
                                            {attachment.fileSize ? `${(attachment.fileSize / 1024).toFixed(1)} KB` : 'Unknown size'}
                                          </div>
                                        </div>
                                        <Download className="h-4 w-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {index === threadMessages.length - 1 && (
                                <div className="flex gap-3 mt-8 pt-6 border-t border-gray-200">
                                  <Button
                                    variant="outline"
                                    size="default"
                                    className="rounded-full border-2 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600"
                                    onClick={() => setComposeOpen(true)}
                                  >
                                    <Reply className="h-4 w-4 mr-2" />
                                    Reply
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="default"
                                    className="rounded-full border-2 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600"
                                    onClick={() => setComposeOpen(true)}
                                  >
                                    <ReplyAll className="h-4 w-4 mr-2" />
                                    Reply All
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="default"
                                    className="rounded-full border-2 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600"
                                    onClick={() => setComposeOpen(true)}
                                  >
                                    <Forward className="h-4 w-4 mr-2" />
                                    Forward
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              )}
            </div>
          </main>
        </div>

        {/* Floating Compose Button */}
        <div className="fixed bottom-6 right-6 z-50">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={() => setComposeOpen(true)}
                className="h-14 w-14 rounded-full bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 hover:from-blue-700 hover:via-blue-800 hover:to-indigo-800 shadow-2xl hover:shadow-blue-500/50 transition-all hover:scale-110"
              >
                <Pencil className="h-6 w-6 text-white" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Compose</TooltipContent>
          </Tooltip>
        </div>

        {/* Compose Dialog - Gmail Style */}
        <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
          <DialogContent className="max-w-3xl h-[600px] p-0 gap-0 rounded-2xl overflow-hidden">
            <div className="flex flex-col h-full">
              {/* Compose Header */}
              <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                <h3 className="font-medium text-gray-900">New Message</h3>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                    <Minimize2 className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setComposeOpen(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Compose Fields */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="px-6 py-3 space-y-0 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600 w-12">To</span>
                    <Input
                      placeholder="Recipients"
                      value={composeTo}
                      onChange={(e) => setComposeTo(e.target.value)}
                      className="border-0 focus:ring-0 focus-visible:ring-0 px-0 text-sm"
                    />
                  </div>
                </div>

                <div className="px-6 py-3 space-y-0 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600 w-12">Subject</span>
                    <Input
                      placeholder="Subject"
                      value={composeSubject}
                      onChange={(e) => setComposeSubject(e.target.value)}
                      className="border-0 focus:ring-0 focus-visible:ring-0 px-0 text-sm"
                    />
                  </div>
                </div>

                <div className="flex-1 px-6 py-4 overflow-auto">
                  <textarea
                    placeholder="Message"
                    value={composeBody}
                    onChange={(e) => setComposeBody(e.target.value)}
                    className="w-full h-full resize-none border-0 focus:outline-none focus:ring-0 text-sm text-gray-800 font-normal leading-relaxed"
                    style={{ fontFamily: 'Arial, sans-serif' }}
                  />
                </div>

                {/* Compose Footer */}
                <div className="px-6 py-4 border-t border-gray-200 bg-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Button
                        onClick={handleSend}
                        disabled={sendEmailMutation.isPending || !composeTo || !composeSubject}
                        className="bg-blue-600 hover:bg-blue-700 rounded-full px-8"
                      >
                        {sendEmailMutation.isPending ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            Send
                          </>
                        )}
                      </Button>
                      
                      <Separator orientation="vertical" className="h-6 mx-2" />
                      
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="rounded-full">
                            <Paperclip className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Attach files</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="rounded-full">
                            <Link2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Insert link</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="rounded-full">
                            <Smile className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Insert emoji</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="rounded-full">
                            <Image className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Insert image</TooltipContent>
                      </Tooltip>
                    </div>

                    <div className="flex items-center gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="rounded-full">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>More options</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="rounded-full">
                            <Trash2 className="h-4 w-4 text-gray-400" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Discard draft</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>

                  {/* From Account Selector */}
                  {emailAccounts.length > 1 && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-gray-600">
                      <span>From:</span>
                      <select className="border-0 focus:ring-0 text-xs bg-transparent">
                        {emailAccounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.emailAddress}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Accounts Settings Dialog */}
        <Dialog open={accountsOpen} onOpenChange={setAccountsOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-2xl font-normal">Email Accounts</DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              {/* Security Notice */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                    <Mail className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-blue-900 mb-1">Secure OAuth 2.0 Authentication</h4>
                    <p className="text-sm text-blue-700 leading-relaxed">
                      We use industry-standard OAuth 2.0 for secure authentication. Your password is never stored or accessed by our application.
                    </p>
                  </div>
                </div>
              </div>

              {/* Connected Accounts */}
              {emailAccounts.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Check className="h-5 w-5 text-green-600" />
                    Connected Accounts ({emailAccounts.length})
                  </h3>
                  <div className="space-y-2">
                    {emailAccounts.map((account) => (
                      <div
                        key={account.id}
                        className="flex items-center justify-between p-4 border-2 border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-sm transition-all bg-white"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className={cn(
                              "font-medium",
                              account.provider === 'gmail' 
                                ? "bg-gradient-to-br from-red-500 to-red-600 text-white" 
                                : "bg-gradient-to-br from-blue-500 to-blue-600 text-white"
                            )}>
                              {getInitials(account.emailAddress)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-semibold text-gray-900">{account.accountName}</div>
                            <div className="text-sm text-gray-600">{account.emailAddress}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={account.isActive ? "default" : "secondary"} className="bg-green-100 text-green-700 border-green-300">
                            {account.isActive ? "Active" : "Inactive"}
                          </Badge>
                          {account.isDefault && (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
                              Default
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add Account */}
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-900">Add New Account</h3>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    onClick={() => handleConnectAccount('gmail')}
                    className="h-16 flex flex-col items-center justify-center gap-2 border-2 hover:border-red-300 hover:bg-red-50 transition-all rounded-xl group"
                  >
                    <Mail className="h-6 w-6 text-red-500 group-hover:scale-110 transition-transform" />
                    <span className="font-medium text-gray-900">Gmail</span>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleConnectAccount('outlook')}
                    className="h-16 flex flex-col items-center justify-center gap-2 border-2 hover:border-blue-300 hover:bg-blue-50 transition-all rounded-xl group"
                  >
                    <Mail className="h-6 w-6 text-blue-500 group-hover:scale-110 transition-transform" />
                    <span className="font-medium text-gray-900">Outlook</span>
                  </Button>
                </div>
              </div>

              {/* Features List */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <h4 className="font-semibold text-gray-900 mb-3">What you can do:</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-700">
                    <Check className="h-4 w-4 text-green-600" />
                    Send & receive emails
                  </div>
                  <div className="flex items-center gap-2 text-gray-700">
                    <Check className="h-4 w-4 text-green-600" />
                    Attachments support
                  </div>
                  <div className="flex items-center gap-2 text-gray-700">
                    <Check className="h-4 w-4 text-green-600" />
                    Labels & folders
                  </div>
                  <div className="flex items-center gap-2 text-gray-700">
                    <Check className="h-4 w-4 text-green-600" />
                    Search & filters
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

// Virtualized Thread List Component for Performance
interface VirtualizedThreadListProps {
  threads: EmailThread[];
  selectedThread: string | null;
  selectedThreads: Set<string>;
  onThreadSelect: (threadId: string) => void;
  onThreadsSelect: (threads: Set<string>) => void;
  onStarToggle: (messageId: string, isStarred: boolean) => void;
  hasNextPage?: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
}

function VirtualizedThreadList({
  threads,
  selectedThread,
  selectedThreads,
  onThreadSelect,
  onThreadsSelect,
  onStarToggle,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: VirtualizedThreadListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  // Virtual scrolling configuration
  const rowVirtualizer = useVirtualizer({
    count: threads.length + (hasNextPage ? 1 : 0),
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72, // Estimated height of each thread row
    overscan: 5, // Render 5 extra items above and below viewport
  });

  // Infinite scroll: load more when near bottom
  useEffect(() => {
    const [lastItem] = [...rowVirtualizer.getVirtualItems()].reverse();

    if (!lastItem) return;

    if (
      lastItem.index >= threads.length - 1 &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      fetchNextPage();
    }
  }, [
    hasNextPage,
    fetchNextPage,
    threads.length,
    isFetchingNextPage,
    rowVirtualizer.getVirtualItems(),
  ]);

  return (
    <div
      ref={parentRef}
      className="flex-1 overflow-auto"
      style={{ contain: 'strict' }}
    >
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const isLoaderRow = virtualRow.index > threads.length - 1;
          const thread = threads[virtualRow.index];

          return (
            <div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {isLoaderRow ? (
                hasNextPage ? (
                  <div className="flex items-center justify-center py-4 border-t border-gray-100">
                    <RefreshCw className="h-5 w-5 animate-spin text-gray-400" />
                    <span className="ml-2 text-sm text-gray-600">Loading more...</span>
                  </div>
                ) : null
              ) : (
                <ThreadRow
                  thread={thread}
                  isSelected={selectedThread === thread.id}
                  isChecked={selectedThreads.has(thread.id)}
                  onSelect={() => onThreadSelect(thread.id)}
                  onCheck={(checked) => {
                    const newSet = new Set(selectedThreads);
                    if (checked) newSet.add(thread.id);
                    else newSet.delete(thread.id);
                    onThreadsSelect(newSet);
                  }}
                  onStarToggle={() => {
                    const message = thread.messages?.[0];
                    if (message) {
                      onStarToggle(message.id, !message.isStarred);
                    }
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Thread Row Component (Memoized for performance)
const ThreadRow = React.memo(({
  thread,
  isSelected,
  isChecked,
  onSelect,
  onCheck,
  onStarToggle,
}: {
  thread: EmailThread;
  isSelected: boolean;
  isChecked: boolean;
  onSelect: () => void;
  onCheck: (checked: boolean) => void;
  onStarToggle: () => void;
}) => {
  const isUnread = thread.messages?.[0]?.isRead === false;
  const isStarred = thread.messages?.[0]?.isStarred;

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3 cursor-pointer transition-all group relative border-b border-gray-100",
        isSelected
          ? "bg-blue-50 shadow-sm"
          : isUnread
          ? "bg-white hover:shadow-sm"
          : "bg-gray-50 hover:bg-gray-100",
        isSelected && "border-l-4 border-blue-600"
      )}
      onClick={onSelect}
    >
      <input
        type="checkbox"
        className="accent-blue-600 rounded cursor-pointer"
        checked={isChecked}
        onChange={(e) => onCheck(e.target.checked)}
        onClick={(e) => e.stopPropagation()}
      />

      <button
        className={cn(
          "transition-all focus:outline-none",
          isStarred ? "text-yellow-500" : "text-gray-300 group-hover:text-gray-400"
        )}
        onClick={(e) => {
          e.stopPropagation();
          onStarToggle();
        }}
      >
        <Star className={cn("h-4 w-4", isStarred && "fill-yellow-500")} />
      </button>

      {isUnread && <div className="h-2 w-2 rounded-full bg-blue-600" />}

      <div className="flex-1 min-w-0 grid grid-cols-[200px,1fr,auto] gap-3 items-center">
        <span
          className={cn(
            "truncate text-sm",
            isUnread ? "font-bold text-gray-900" : "font-normal text-gray-800"
          )}
        >
          {thread.participantEmails[0]?.split('@')[0] || 'Unknown'}
        </span>

        <div className="flex items-center gap-2 min-w-0">
          <span
            className={cn(
              "truncate text-sm max-w-xs",
              isUnread ? "font-bold text-gray-900" : "font-normal text-gray-700"
            )}
          >
            {thread.subject || '(no subject)'}
          </span>
          <span className="text-sm text-gray-500 truncate">
            — {thread.preview || 'No preview'}
          </span>
        </div>

        <span className="text-xs text-gray-500 whitespace-nowrap flex-shrink-0">
          {thread.lastMessageAt &&
            (new Date(thread.lastMessageAt).toDateString() ===
            new Date().toDateString()
              ? format(new Date(thread.lastMessageAt), 'h:mm a')
              : format(new Date(thread.lastMessageAt), 'MMM d'))}
        </span>
      </div>

      {thread.labels && thread.labels.length > 0 && (
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {thread.labels.slice(0, 2).map((label) => (
            <Badge
              key={label}
              variant="secondary"
              className="text-[10px] px-1.5 py-0"
            >
              {label}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
});
ThreadRow.displayName = 'ThreadRow';

// Email Content Component with Sanitization and Proper Styling
interface EmailContentProps {
  htmlBody: string | null;
  textBody: string | null;
}

function EmailContent({ htmlBody, textBody }: EmailContentProps) {
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

  // Sanitize HTML and configure DOMPurify
  const sanitizedHtml = useMemo(() => {
    if (!htmlBody) return null;

    // Configure DOMPurify to allow images and common email tags
    const clean = DOMPurify.sanitize(htmlBody, {
      ADD_TAGS: ['style'],
      ADD_ATTR: ['target', 'style', 'class'],
      ALLOW_DATA_ATTR: false,
      FORCE_BODY: true,
    });

    return clean;
  }, [htmlBody]);

  // Inject custom styles for email content
  useEffect(() => {
    if (!htmlBody) return;

    // Add styles for email content
    const style = document.createElement('style');
    style.textContent = `
      .email-content-wrapper {
        /* Base email styling */
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        font-size: 14px;
        line-height: 1.6;
        color: #1f2937;
      }

      .email-content-wrapper img {
        max-width: 100%;
        height: auto;
        display: block;
        margin: 0.5rem 0;
        border-radius: 0.375rem;
      }

      .email-content-wrapper a {
        color: #2563eb;
        text-decoration: none;
      }

      .email-content-wrapper a:hover {
        text-decoration: underline;
      }

      .email-content-wrapper p {
        margin: 0.75rem 0;
      }

      .email-content-wrapper h1,
      .email-content-wrapper h2,
      .email-content-wrapper h3,
      .email-content-wrapper h4,
      .email-content-wrapper h5,
      .email-content-wrapper h6 {
        margin-top: 1.5rem;
        margin-bottom: 0.75rem;
        font-weight: 600;
        line-height: 1.3;
      }

      .email-content-wrapper ul,
      .email-content-wrapper ol {
        margin: 0.75rem 0;
        padding-left: 2rem;
      }

      .email-content-wrapper blockquote {
        margin: 1rem 0;
        padding-left: 1rem;
        border-left: 4px solid #e5e7eb;
        color: #6b7280;
      }

      .email-content-wrapper table {
        border-collapse: collapse;
        width: 100%;
        margin: 1rem 0;
      }

      .email-content-wrapper table td,
      .email-content-wrapper table th {
        border: 1px solid #e5e7eb;
        padding: 0.5rem;
      }

      .email-content-wrapper pre {
        background: #f3f4f6;
        padding: 1rem;
        border-radius: 0.375rem;
        overflow-x: auto;
        margin: 1rem 0;
      }

      .email-content-wrapper code {
        background: #f3f4f6;
        padding: 0.125rem 0.25rem;
        border-radius: 0.25rem;
        font-family: 'Courier New', monospace;
        font-size: 0.875em;
      }

      .email-content-wrapper hr {
        border: none;
        border-top: 1px solid #e5e7eb;
        margin: 1.5rem 0;
      }

      /* Handle email-specific styling */
      .email-content-wrapper div[style*="background"],
      .email-content-wrapper table[style*="background"] {
        border-radius: 0.375rem;
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, [htmlBody]);

  if (!htmlBody && !textBody) {
    return (
      <div className="flex items-center justify-center py-8 text-gray-400">
        <div className="text-center">
          <Mail className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No content to display</p>
        </div>
      </div>
    );
  }

  if (htmlBody && sanitizedHtml) {
    return (
      <div className="email-content-wrapper mt-4 mb-4">
        <div
          dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
          className="prose prose-sm max-w-none"
        />
      </div>
    );
  }

  // Fallback to text body
  return (
    <div className="email-content-wrapper mt-4 mb-4">
      <p className="whitespace-pre-wrap text-gray-800 leading-relaxed">
        {textBody || 'No content available'}
      </p>
    </div>
  );
}
