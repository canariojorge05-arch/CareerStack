import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow, format } from 'date-fns';
import { apiRequest } from '@/lib/queryClient';
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

  // Fetch email threads with optimized caching
  const { data: emailThreads = [], isLoading, refetch } = useQuery<EmailThread[]>({
    queryKey: ['/api/marketing/emails/threads', selectedFolder, debouncedSearchQuery],
    queryFn: async () => {
      try {
        const endpoint = debouncedSearchQuery.trim()
          ? `/api/marketing/emails/search?q=${encodeURIComponent(debouncedSearchQuery)}&limit=100`
          : `/api/marketing/emails/threads?type=${selectedFolder}&limit=100`;
        
        const response = await apiRequest('GET', endpoint);
        if (!response.ok) return [];
        
        const data = await response.json();
        return Array.isArray(data) ? data : data.threads || [];
      } catch {
        return [];
      }
    },
    staleTime: 1 * 60 * 1000, // 1 minute - threads update frequently
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnMount: false, // Prevent unnecessary refetches
  });

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
                  1-{emailThreads.length} of {emailThreads.length}
                </span>
                <Separator orientation="vertical" className="h-6" />
                <div className="flex">
                  <Button variant="ghost" size="icon" className="rounded-full h-8 w-8">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="rounded-full h-8 w-8">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Email List or Split View */}
            <div className="flex-1 flex overflow-hidden">
              {/* Email List */}
              <div className={cn(
                "bg-white overflow-hidden flex flex-col border-r border-gray-200",
                selectedThread && view === 'split' ? "w-1/2" : "w-full"
              )}>
                <ScrollArea className="flex-1">
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
                    <div className="divide-y divide-gray-100">
                      {emailThreads.map((thread: EmailThread) => (
                        <div
                          key={thread.id}
                          className={cn(
                            "flex items-center gap-3 px-4 py-3 cursor-pointer transition-all group relative",
                            selectedThread === thread.id 
                              ? "bg-blue-50 shadow-sm" 
                              : thread.messages?.[0]?.isRead === false
                              ? "bg-white hover:shadow-sm"
                              : "bg-gray-50 hover:bg-gray-100",
                            selectedThread === thread.id && "border-l-4 border-blue-600"
                          )}
                          onClick={() => setSelectedThread(thread.id)}
                        >
                          <input
                            type="checkbox"
                            className="accent-blue-600 rounded cursor-pointer"
                            checked={selectedThreads.has(thread.id)}
                            onChange={(e) => {
                              const newSet = new Set(selectedThreads);
                              if (e.target.checked) newSet.add(thread.id);
                              else newSet.delete(thread.id);
                              setSelectedThreads(newSet);
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />

                          <button
                            className={cn(
                              "transition-all focus:outline-none",
                              thread.messages?.[0]?.isStarred 
                                ? "text-yellow-500" 
                                : "text-gray-300 group-hover:text-gray-400"
                            )}
                            onClick={(e) => {
                              e.stopPropagation();
                              const message = thread.messages?.[0];
                              if (message) {
                                starMutation.mutate({ messageId: message.id, isStarred: !message.isStarred });
                              }
                            }}
                          >
                            <Star className={cn("h-4 w-4", thread.messages?.[0]?.isStarred && "fill-yellow-500")} />
                          </button>

                          {thread.messages?.[0]?.isRead === false && (
                            <div className="h-2 w-2 rounded-full bg-blue-600" />
                          )}

                          <div className="flex-1 min-w-0 grid grid-cols-[200px,1fr,auto] gap-3 items-center">
                            <span className={cn(
                              "truncate text-sm",
                              thread.messages?.[0]?.isRead === false ? "font-bold text-gray-900" : "font-normal text-gray-800"
                            )}>
                              {thread.participantEmails[0]?.split('@')[0] || 'Unknown'}
                            </span>

                            <div className="flex items-center gap-2 min-w-0">
                              <span className={cn(
                                "truncate text-sm max-w-xs",
                                thread.messages?.[0]?.isRead === false ? "font-bold text-gray-900" : "font-normal text-gray-700"
                              )}>
                                {thread.subject || '(no subject)'}
                              </span>
                              <span className="text-sm text-gray-500 truncate">
                                — {thread.preview || 'No preview'}
                              </span>
                            </div>

                            <span className="text-xs text-gray-500 whitespace-nowrap flex-shrink-0">
                              {thread.lastMessageAt && (
                                new Date(thread.lastMessageAt).toDateString() === new Date().toDateString()
                                  ? format(new Date(thread.lastMessageAt), 'h:mm a')
                                  : format(new Date(thread.lastMessageAt), 'MMM d')
                              )}
                            </span>
                          </div>

                          {thread.labels && thread.labels.length > 0 && (
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {thread.labels.slice(0, 2).map((label) => (
                                <Badge key={label} variant="secondary" className="text-[10px] px-1.5 py-0">
                                  {label}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
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
                      <div className="space-y-6 max-w-4xl">
                        {threadMessages.map((message, index) => (
                          <div key={message.id} className={cn(
                            "rounded-2xl bg-white transition-all",
                            index === threadMessages.length - 1 && "border-2 border-gray-200 shadow-sm"
                          )}>
                            <div className="p-6">
                              <div className="flex items-start gap-3 mb-4">
                                <Avatar className="h-10 w-10">
                                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white text-sm font-medium">
                                    {getInitials(message.fromEmail)}
                                  </AvatarFallback>
                                </Avatar>

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between mb-1">
                                    <div>
                                      <span className="font-medium text-gray-900 text-sm">
                                        {message.fromEmail.split('@')[0]}
                                      </span>
                                      <span className="text-xs text-gray-500 ml-2">
                                        &lt;{message.fromEmail}&gt;
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-gray-500">
                                        {message.sentAt && format(new Date(message.sentAt), 'MMM d, yyyy, h:mm a')}
                                      </span>
                                      <button
                                        className={cn(
                                          "transition-colors",
                                          message.isStarred ? "text-yellow-500" : "text-gray-300 hover:text-yellow-400"
                                        )}
                                        onClick={() => starMutation.mutate({ messageId: message.id, isStarred: !message.isStarred })}
                                      >
                                        <Star className={cn("h-4 w-4", message.isStarred && "fill-yellow-500")} />
                                      </button>
                                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                                        <Reply className="h-4 w-4" />
                                      </Button>
                                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                                        <MoreVertical className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    to {message.toEmails.join(', ')}
                                  </div>
                                </div>
                              </div>

                              <div className="prose prose-sm max-w-none text-gray-800 leading-relaxed">
                                {message.htmlBody ? (
                                  <div dangerouslySetInnerHTML={{ __html: message.htmlBody }} />
                                ) : (
                                  <p className="whitespace-pre-wrap">{message.textBody}</p>
                                )}
                              </div>

                              {message.attachments && message.attachments.length > 0 && (
                                <div className="mt-6 pt-4 border-t border-gray-200">
                                  <div className="flex items-center gap-2 mb-3">
                                    <Paperclip className="h-4 w-4 text-gray-400" />
                                    <span className="text-sm font-medium text-gray-700">
                                      {message.attachments.length} attachment{message.attachments.length > 1 ? 's' : ''}
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    {message.attachments.map((attachment: any, idx: number) => (
                                      <div
                                        key={idx}
                                        className="flex items-center gap-2 p-2 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                                      >
                                        <FileText className="h-4 w-4 text-gray-400" />
                                        <div className="flex-1 min-w-0">
                                          <div className="text-xs font-medium truncate">{attachment.fileName}</div>
                                          <div className="text-[10px] text-gray-500">
                                            {attachment.fileSize ? `${(attachment.fileSize / 1024).toFixed(1)} KB` : ''}
                                          </div>
                                        </div>
                                        <Download className="h-3 w-3 text-gray-400" />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {index === threadMessages.length - 1 && (
                                <div className="flex gap-2 mt-6">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="rounded-full"
                                    onClick={() => setComposeOpen(true)}
                                  >
                                    <Reply className="h-4 w-4 mr-2" />
                                    Reply
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="rounded-full"
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
