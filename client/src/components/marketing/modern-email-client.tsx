import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { formatDistanceToNow, format } from 'date-fns';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Mail, Inbox, Send, FileText, Archive, Star, Search, Plus, Paperclip, Reply, ReplyAll, Forward, Trash2, MoveVertical as MoreVertical, Settings, RefreshCw, Check, X, User, Clock, Tag, Filter, Import as SortAsc, ChevronDown, ChevronRight, AtSign } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import ComposeDialog from './compose-dialog';

interface EmailAccount {
  id: string;
  accountName: string;
  emailAddress: string;
  provider: 'gmail' | 'outlook' | 'smtp';
  isDefault: boolean;
  isActive: boolean;
  syncEnabled: boolean;
  lastSyncAt: Date | null;
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

const FOLDERS = [
  { id: 'inbox', name: 'Inbox', icon: Inbox, count: 0 },
  { id: 'sent', name: 'Sent', icon: Send, count: 0 },
  { id: 'drafts', name: 'Drafts', icon: FileText, count: 0 },
  { id: 'archived', name: 'Archived', icon: Archive, count: 0 },
];

const LABELS = [
  { id: 'important', name: 'Important', color: 'bg-red-500' },
  { id: 'work', name: 'Work', color: 'bg-blue-500' },
  { id: 'personal', name: 'Personal', color: 'bg-green-500' },
  { id: 'follow-up', name: 'Follow-up', color: 'bg-yellow-500' },
];

export default function ModernEmailClient({ accountFilter }: { accountFilter?: string | null } = {}) {
  const [selectedFolder, setSelectedFolder] = useState('inbox');
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [composeOpen, setComposeOpen] = useState(false);
  const [accountsDialogOpen, setAccountsDialogOpen] = useState(false);
  const [selectedThreads, setSelectedThreads] = useState<Set<string>>(new Set());
  const [bulkActionMode, setBulkActionMode] = useState(false);
  const [replyData, setReplyData] = useState<any>(null);
  const [composeMode, setComposeMode] = useState<'compose' | 'reply' | 'reply-all' | 'forward'>('compose');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [autoLoadEnabled, setAutoLoadEnabled] = useState(true);
  
  const queryClient = useQueryClient();

  // Fetch email accounts
  const { data: emailAccounts = [], isLoading: accountsLoading } = useQuery<EmailAccount[]>({
    queryKey: ['/api/marketing/email-accounts'],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', '/api/marketing/email-accounts');
        if (!response.ok) return [];
        return response.json();
      } catch {
        return [] as EmailAccount[];
      }
    },
    retry: false,
  });

  // Fetch email threads with optimized pagination
  const THREADS_LIMIT = 50; // Optimized limit for better performance
  const threadsQuery = useInfiniteQuery({
    queryKey: ['/api/marketing/emails/threads', selectedFolder, searchQuery, accountFilter],
    queryFn: async ({ pageParam = 1 }: { pageParam?: number }) => {
      try {
        if (searchQuery.trim()) {
          const response = await apiRequest('GET', `/api/marketing/emails/search?q=${encodeURIComponent(searchQuery)}&limit=${THREADS_LIMIT}&page=${pageParam}${accountFilter ? `&accountId=${accountFilter}` : ''}`);
          if (!response.ok) {
            console.error('Search failed:', response.status);
            return { threads: [], pagination: { hasMore: false } };
          }
          const data = await response.json();
          return { threads: data.threads || [], pagination: { hasMore: false, total: data.total || 0 } };
        } else {
          const response = await apiRequest('GET', `/api/marketing/emails/threads?type=${selectedFolder}&limit=${THREADS_LIMIT}&page=${pageParam}${accountFilter ? `&accountId=${accountFilter}` : ''}`);
          if (!response.ok) {
            console.error('Fetch threads failed:', response.status);
            return { threads: [], pagination: { hasMore: false } };
          }
          const data = await response.json();
          // Handle both old format (array) and new format (object with threads and pagination)
          if (Array.isArray(data)) {
            return { threads: data, pagination: { hasMore: data.length >= THREADS_LIMIT } };
          }
          return { threads: data.threads || [], pagination: data.pagination || { hasMore: false } };
        }
      } catch (error) {
        console.error('Error fetching threads:', error);
        return { threads: [], pagination: { hasMore: false } };
      }
    },
    getNextPageParam: (lastPage, pages) => {
      // Use pagination metadata from backend
      if (!lastPage?.pagination?.hasMore) return undefined;
      return pages.length + 1;
    },
    initialPageParam: 1,
    refetchInterval: false, // Disable auto-refresh for better performance
    refetchOnWindowFocus: false, // Disable refetch on window focus
    staleTime: 60000, // Data is fresh for 1 minute
    retry: 2,
  });

  const emailThreads: EmailThread[] = threadsQuery.data ? threadsQuery.data.pages.flatMap(page => page.threads || []) : [];
  const threadsLoading = threadsQuery.isLoading;
  const isFetching = threadsQuery.isFetching;
  const refetchThreads = threadsQuery.refetch;
  const hasNextPage = threadsQuery.hasNextPage;
  const fetchNextPage = threadsQuery.fetchNextPage;

  // Debug logging
  useEffect(() => {
    console.log('Email threads data:', {
      totalThreads: emailThreads.length,
      pages: threadsQuery.data?.pages.length || 0,
      hasNextPage: threadsQuery.hasNextPage,
      isLoading: threadsLoading,
      isFetching: isFetching,
      selectedFolder
    });
  }, [emailThreads.length, threadsQuery.data?.pages.length, threadsQuery.hasNextPage, threadsLoading, isFetching, selectedFolder]);

  // Fetch messages for selected thread
  const { data: threadMessages = [], isLoading: threadMessagesLoading, isFetching: threadMessagesFetching, error: threadMessagesError } = useQuery<EmailMessage[]>({
    queryKey: ['/api/marketing/emails/threads', selectedThread, 'messages'],
    queryFn: async () => {
      try {
        if (!selectedThread) return [] as EmailMessage[];
        const response = await apiRequest('GET', `/api/marketing/emails/threads/${selectedThread}/messages`);
        if (!response.ok) {
          throw new Error(`Failed to fetch messages: ${response.status}`);
        }
        return response.json();
      } catch (error) {
        console.error('Error fetching messages:', error);
        throw error;
      }
    },
    enabled: !!selectedThread,
    retry: 2,
    staleTime: 30000,
  });

  // Mark thread as read when viewing messages
  const markThreadAsReadMutation = useMutation({
    mutationFn: async (threadId: string) => {
      const response = await apiRequest('PATCH', `/api/marketing/emails/threads/${threadId}/read`, {});
      if (!response.ok) throw new Error('Failed to mark as read');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/emails/threads'] });
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/emails/unread-count'] });
    },
    onError: (error) => {
      console.error('Failed to mark thread as read:', error);
    }
  });

  // Auto-mark as read when thread is selected
  useEffect(() => {
    if (selectedThread && threadMessages.length > 0) {
      // Mark as read after 1 second of viewing
      const timer = setTimeout(() => {
        markThreadAsReadMutation.mutate(selectedThread);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [selectedThread, threadMessages.length]);

  // Star/unstar mutation
  const starMutation = useMutation({
    mutationFn: async ({ messageId, isStarred }: { messageId: string; isStarred: boolean }) => {
      const response = await apiRequest('PATCH', `/api/marketing/emails/messages/${messageId}/star`, { isStarred });
      if (!response.ok) throw new Error('Failed to update star status');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/emails/threads'] });
      toast.success('Updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update star status');
      console.error(error);
    }
  });

  // Archive mutation
  const archiveMutation = useMutation({
    mutationFn: async ({ threadId, isArchived }: { threadId: string; isArchived: boolean }) => {
      const response = await apiRequest('PATCH', `/api/marketing/emails/threads/${threadId}/archive`, { isArchived });
      if (!response.ok) throw new Error('Failed to archive');
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/emails/threads'] });
      toast.success(variables.isArchived ? 'Thread archived' : 'Thread unarchived');
      setSelectedThread(null);
    },
    onError: (error) => {
      toast.error('Failed to archive thread');
      console.error(error);
    }
  });

  // Component to safely render HTML bodies and handle image loading/fallbacks
  function MessageBody({ html, text }: { html?: string | null; text?: string | null }) {
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;

      // Set the HTML content
      if (html) {
        el.innerHTML = html;
      } else {
        el.textContent = text || '';
      }

      // Find images and attach load/error handlers and lazy loading
      const imgs = Array.from(el.querySelectorAll('img')) as HTMLImageElement[];
      imgs.forEach((img) => {
        // Prefer native lazy loading where available
        img.loading = 'lazy';

        // If image fails, replace with a simple placeholder
        const handleError = () => {
          img.onerror = null;
          img.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><rect width="100%" height="100%" fill="#f3f4f6"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#9ca3af" font-family="Arial" font-size="14">Image failed to load</text></svg>`);
        };

        const handleLoad = () => {
          // remove any placeholder styles if needed
        };

        img.addEventListener('error', handleError);
        img.addEventListener('load', handleLoad);
      });

      return () => {
        imgs.forEach((img) => {
          img.onerror = null;
          img.onload = null;
        });
      };
    }, [html, text]);

    return <div ref={containerRef} className="prose prose-base max-w-none" />;
  }

  // OAuth handlers
  const handleGmailOAuth = async () => {
    try {
      const response = await apiRequest('GET', '/api/marketing/oauth/gmail/auth');
      if (response.ok) {
        const { authUrl } = await response.json();
        const popup = window.open(authUrl, 'gmail-oauth', 'width=500,height=600,scrollbars=yes,resizable=yes');
        
        const handleMessage = async (event: MessageEvent) => {
          if (event.data.type === 'GMAIL_OAUTH_SUCCESS') {
            queryClient.invalidateQueries({ queryKey: ['/api/marketing/email-accounts'] });
            window.removeEventListener('message', handleMessage);
            popup?.close();
            toast.success('Gmail account connected successfully!');
            
            // Auto-sync emails after successful connection
            setTimeout(async () => {
              try {
                const accountsResponse = await apiRequest('GET', '/api/marketing/email-accounts');
                if (accountsResponse.ok) {
                  const accounts = await accountsResponse.json();
                  const newAccount = accounts.find((acc: EmailAccount) => acc.provider === 'gmail');
                  if (newAccount) {
                    toast.info('Syncing emails from Gmail...');
                    syncMutation.mutate(newAccount.id);
                  }
                }
              } catch (error) {
                console.error('Auto-sync failed:', error);
              }
            }, 1000);
          }
        };
        
        window.addEventListener('message', handleMessage);
      }
    } catch (error) {
      toast.error('Failed to connect Gmail account');
    }
  };

  const handleOutlookOAuth = async () => {
    try {
      const response = await apiRequest('GET', '/api/marketing/oauth/outlook/auth');
      if (response.ok) {
        const { authUrl } = await response.json();
        const popup = window.open(authUrl, 'outlook-oauth', 'width=500,height=600,scrollbars=yes,resizable=yes');
        
        const handleMessage = async (event: MessageEvent) => {
          if (event.data.type === 'OUTLOOK_OAUTH_SUCCESS') {
            queryClient.invalidateQueries({ queryKey: ['/api/marketing/email-accounts'] });
            window.removeEventListener('message', handleMessage);
            popup?.close();
            toast.success('Outlook account connected successfully!');
            
            // Auto-sync emails after successful connection
            setTimeout(async () => {
              try {
                const accountsResponse = await apiRequest('GET', '/api/marketing/email-accounts');
                if (accountsResponse.ok) {
                  const accounts = await accountsResponse.json();
                  const newAccount = accounts.find((acc: EmailAccount) => acc.provider === 'outlook');
                  if (newAccount) {
                    toast.info('Syncing emails from Outlook...');
                    syncMutation.mutate(newAccount.id);
                  }
                }
              } catch (error) {
                console.error('Auto-sync failed:', error);
              }
            }, 1000);
          }
        };
        
        window.addEventListener('message', handleMessage);
      }
    } catch (error) {
      toast.error('Failed to connect Outlook account');
    }
  };

  // Sync account
  const syncMutation = useMutation({
    mutationFn: async (accountId: string) => {
      const response = await apiRequest('POST', `/api/marketing/email-accounts/${accountId}/sync`);
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Sync failed' }));
        throw new Error(error.message || 'Sync failed');
      }
      return response.json();
    },
    onMutate: () => {
      toast.info('Syncing emails...', { duration: 2000 });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/emails/threads'] });
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/email-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/emails/unread-count'] });
      const count = data.syncedCount || 0;
      if (count > 0) {
        toast.success(`Synced ${count} new email${count === 1 ? '' : 's'}!`, { duration: 3000 });
      } else {
        toast.info('Already up to date', { duration: 2000 });
      }
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to sync emails', { 
        duration: 4000,
        action: {
          label: 'Retry',
          onClick: () => {
            // Retry will be handled by user clicking sync again
          }
        }
      });
    },
  });

  const getInitials = (email: string) => {
    return email.split('@')[0].slice(0, 2).toUpperCase();
  };

  const formatEmailPreview = (message: EmailMessage) => {
    const text = message.textBody || message.htmlBody?.replace(/<[^>]*>/g, '') || '';
    return text.slice(0, 100) + (text.length > 100 ? '...' : '');
  };

  const handleReply = (mode: 'reply' | 'reply-all' | 'forward') => {
  const selectedThreadData = emailThreads.find((t: EmailThread) => t.id === selectedThread);
    const latestMessage = threadMessages[threadMessages.length - 1];
    
    if (selectedThreadData && latestMessage) {
      setReplyData({
        threadId: selectedThread,
        subject: selectedThreadData.subject,
        fromEmail: latestMessage.fromEmail,
        toEmails: latestMessage.toEmails,
        ccEmails: latestMessage.ccEmails,
      });
      setComposeMode(mode);
      setComposeOpen(true);
    }
  };

  const handleCompose = () => {
    setReplyData(null);
    setComposeMode('compose');
    setComposeOpen(true);
  };

  // Auto-load more emails when scrolling near bottom
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (!autoLoadEnabled || !hasNextPage || isFetching) return;
    
    const target = e.currentTarget;
    const { scrollTop, scrollHeight, clientHeight } = target;
    const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;
    
    // Load more when 80% scrolled
    if (scrollPercentage > 0.8) {
      console.log('Auto-loading more emails...', { scrollPercentage, hasNextPage });
      fetchNextPage();
    }
  }, [autoLoadEnabled, hasNextPage, isFetching, fetchNextPage]);

  return (
    <TooltipProvider>
  <div className="flex h-[800px] bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl overflow-hidden border border-slate-200 shadow-lg">
        {/* Sidebar */}
        <div className={cn(
          "bg-white/95 backdrop-blur-sm border-r border-slate-200 flex flex-col transition-all duration-300 shadow-sm",
          sidebarCollapsed ? "w-16" : "w-64"
        )}>
          {/* Header */}
          <div className={cn("border-b border-slate-200 bg-gradient-to-b from-white to-slate-50", sidebarCollapsed ? "p-2" : "p-4")}>
            <div className={cn("flex items-center justify-between", sidebarCollapsed ? "mb-2" : "mb-4")}>
              {!sidebarCollapsed && <h2 className="text-lg font-semibold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">Mail</h2>}
              <div className="flex gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setSidebarCollapsed((v) => !v)}
                      aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                      className={cn(
                        "transition-all rounded-full p-2 flex items-center justify-center border border-gray-200 bg-gray-100 hover:bg-blue-100 hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400",
                        sidebarCollapsed ? "shadow-md" : "shadow"
                      )}
                      style={{ minWidth: 36, minHeight: 36 }}
                    >
                      {sidebarCollapsed ? <ChevronRight className="h-5 w-5 text-blue-600" /> : <ChevronDown className="h-5 w-5 text-blue-600" />}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        refetchThreads();
                        queryClient.invalidateQueries({ queryKey: ['/api/marketing/email-accounts'] });
                        toast.success('Refreshing emails...', { duration: 1500 });
                      }}
                      disabled={threadsLoading || isFetching}
                      className={cn(
                        "transition-all",
                        (threadsLoading || isFetching) && "cursor-not-allowed opacity-50"
                      )}
                    >
                      <RefreshCw className={cn("h-4 w-4 transition-transform", (threadsLoading || isFetching) && "animate-spin")} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{threadsLoading || isFetching ? 'Refreshing...' : 'Refresh emails'}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setAccountsDialogOpen(true)}
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Account Settings</TooltipContent>
                </Tooltip>
              </div>
            </div>
            
            {!sidebarCollapsed ? (
              <Button
                onClick={handleCompose}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-md hover:shadow-lg transition-all"
              >
                <Plus className="h-4 w-4 mr-2" />
                Compose
              </Button>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={handleCompose}
                    className="w-12 h-12 p-0 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-md hover:shadow-lg transition-all rounded-full mx-auto"
                  >
                    <Plus className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Compose</TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* Folders */}
          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              {/* Folders */}
              <div className={cn("space-y-1 flex flex-col items-stretch", sidebarCollapsed ? "p-1" : "p-2")}> 
                {FOLDERS.map((folder) => (
                  <Tooltip key={folder.id}>
                    <TooltipTrigger asChild>
                      <Button
                        variant={selectedFolder === folder.id ? "secondary" : "ghost"}
                        className={cn(
                          "justify-center h-10 transition-all duration-300 flex items-center",
                          sidebarCollapsed ? "w-12 p-0 mx-auto" : "w-full",
                          selectedFolder === folder.id && "bg-blue-50 text-blue-700 border-r-2 border-blue-600"
                        )}
                        onClick={() => setSelectedFolder(folder.id)}
                      >
                        <folder.icon className="h-5 w-5" />
                        {!sidebarCollapsed && <span className="flex-1 text-left ml-2">{folder.name}</span>}
                        {!sidebarCollapsed && folder.count > 0 && (
                          <Badge variant="secondary" className="ml-auto text-xs">
                            {folder.count}
                          </Badge>
                        )}
                      </Button>
                    </TooltipTrigger>
                    {sidebarCollapsed && <TooltipContent>{folder.name}</TooltipContent>}
                  </Tooltip>
                ))}
              </div>

              <Separator className="my-4" />

              {/* Labels */}
              <div className={cn(sidebarCollapsed ? "flex flex-col items-center gap-3" : "px-2 pb-2")}> 
                {!sidebarCollapsed && <div className="text-xs font-medium text-gray-500 mb-2 px-2">Labels</div>}
                <div className={cn(sidebarCollapsed ? "flex flex-col gap-3" : "space-y-1")}> 
                  {LABELS.map((label) => (
                    <Tooltip key={label.id}>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          className={cn(
                            sidebarCollapsed ? "w-10 h-10 p-0 mx-auto flex items-center justify-center" : "w-full justify-start h-8 text-sm"
                          )}
                        >
                          <div className={cn("w-3 h-3 rounded-full", label.color, sidebarCollapsed ? "mr-0" : "mr-3")} />
                          {!sidebarCollapsed && label.name}
                        </Button>
                      </TooltipTrigger>
                      {sidebarCollapsed && <TooltipContent>{label.name}</TooltipContent>}
                    </Tooltip>
                  ))}
                </div>
              </div>

              <Separator className="my-4" />

              {/* Accounts */}
              <div className={cn(sidebarCollapsed ? "flex flex-col items-center gap-3" : "px-2 pb-2")}> 
                {!sidebarCollapsed && <div className="text-xs font-medium text-gray-500 mb-2 px-2">Accounts ({emailAccounts.length})</div>}
                <div className={cn(sidebarCollapsed ? "flex flex-col gap-3" : "space-y-1")}> 
                  {emailAccounts.map((account) => (
                    <Tooltip key={account.id}>
                      <TooltipTrigger asChild>
                        <div
                          className={cn(
                            "rounded-md hover:bg-gray-50 flex items-center justify-center cursor-pointer",
                            sidebarCollapsed ? "w-10 h-10 mx-auto" : "p-2"
                          )}
                          onClick={() => setAccountsDialogOpen(true)}
                        >
                          {account.provider === 'gmail' ? (
                            <Mail className="h-5 w-5 text-red-500" />
                          ) : (
                            <AtSign className="h-5 w-5 text-blue-500" />
                          )}
                          {!sidebarCollapsed && (
                            <div className="ml-2 min-w-0">
                              <div className="text-xs font-medium text-gray-900 truncate">
                                {account.accountName}
                              </div>
                              <div className="text-xs text-gray-500 truncate">
                                {account.emailAddress}
                              </div>
                            </div>
                          )}
                        </div>
                      </TooltipTrigger>
                      {sidebarCollapsed && <TooltipContent>{account.accountName}<br />{account.emailAddress}</TooltipContent>}
                    </Tooltip>
                  ))}
                  {emailAccounts.length === 0 && !sidebarCollapsed && (
                    <div className="text-center py-4">
                      <p className="text-sm text-gray-500 mb-2">No accounts connected</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAccountsDialogOpen(true)}
                      >
                        Add Account
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          </div>
        </div>

  {/* Main Content */}
  <div className="flex-1 flex flex-col bg-gradient-to-br from-slate-50 to-white">
          {/* Search Bar */}
          <div className="p-4 border-b border-slate-200 bg-white/90 backdrop-blur-sm shadow-sm">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search emails..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4"
              />
            </div>
          </div>

          <div className="flex-1 flex">
            {/* Email List */}
              <div className="w-[36rem] min-w-[30rem] transition-all duration-300 border-r border-slate-200 bg-white/50 backdrop-blur-sm">
              {/* List Header */}
              <div className="p-3 border-b border-slate-200 bg-gradient-to-r from-white to-slate-50">
                <div className="flex items-center gap-2">
                  {bulkActionMode && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedThreads(new Set());
                        setBulkActionMode(false);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                  <h3 className="font-medium capitalize">{selectedFolder}</h3>
                  <Badge variant="secondary" className="text-xs">
                    {emailThreads.length}
                  </Badge>
                  {/* Debug info */}
                  {process.env.NODE_ENV === 'development' && (
                    <Badge variant="outline" className="text-xs ml-2">
                      Pages: {threadsQuery.data?.pages.length || 0}
                    </Badge>
                  )}
                </div>
                
                <div className="flex items-center gap-1">
                  {selectedThreads.size > 0 && (
                    <Button variant="ghost" size="sm">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setAutoLoadEnabled(!autoLoadEnabled)}
                        className={cn(autoLoadEnabled ? "text-blue-600 bg-blue-50" : "text-gray-500")}
                      >
                        <RefreshCw className={cn("h-4 w-4", autoLoadEnabled && "text-blue-600")} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {autoLoadEnabled ? "Disable auto-load" : "Enable auto-load"}
                    </TooltipContent>
                  </Tooltip>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <SortAsc className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>Date (newest first)</DropdownMenuItem>
                      <DropdownMenuItem>Date (oldest first)</DropdownMenuItem>
                      <DropdownMenuItem>Sender</DropdownMenuItem>
                      <DropdownMenuItem>Subject</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Email Threads */}
              <div className="flex-1 overflow-hidden">
                <div 
                  className="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100" 
                  onScroll={handleScroll}
                >
                {threadsLoading ? (
                  <div className="p-8 text-center">
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="h-12 w-12 rounded-full bg-gradient-to-r from-blue-400 to-blue-600 animate-pulse"></div>
                      </div>
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-600 relative z-10" />
                    </div>
                    <p className="text-sm text-slate-600 mt-4 font-medium">Loading emails...</p>
                    <p className="text-xs text-slate-400 mt-2">This may take a moment</p>
                  </div>
                ) : threadsQuery.error ? (
                  <div className="p-8 text-center">
                    <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-red-100 to-red-200 flex items-center justify-center">
                      <X className="h-8 w-8 text-red-600" />
                    </div>
                    <p className="text-sm text-red-600 font-medium mb-2">Failed to load emails</p>
                    <p className="text-xs text-slate-500 mb-4">There was an error loading your emails</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => refetchThreads()}
                      className="bg-white hover:bg-red-50 border-red-200 text-red-700"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Try Again
                    </Button>
                  </div>
                ) : emailThreads.length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                      <Mail className="h-8 w-8 text-slate-400" />
                    </div>
                    <p className="text-sm text-slate-600 font-medium mb-2">
                      {searchQuery ? 'No emails found' : 'No emails in this folder'}
                    </p>
                    <p className="text-xs text-slate-500 mb-4">
                      {searchQuery ? 'Try a different search term' : 'Your mailbox is empty'}
                    </p>
                    {/* Debug info for empty state */}
                    {process.env.NODE_ENV === 'development' && (
                      <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-xs text-left">
                        <p><strong>Debug Info:</strong></p>
                        <p>Loading: {threadsLoading ? 'Yes' : 'No'}</p>
                        <p>Fetching: {isFetching ? 'Yes' : 'No'}</p>
                        <p>Pages: {threadsQuery.data?.pages.length || 0}</p>
                        <p>Has Next: {threadsQuery.hasNextPage ? 'Yes' : 'No'}</p>
                        <p>Error: {threadsQuery.error ? String(threadsQuery.error) : 'None'}</p>
                      </div>
                    )}
                    {!searchQuery && emailAccounts.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs text-gray-400">
                          Connected accounts need to be synced to show emails
                        </p>
                        <div className="flex flex-wrap gap-2 justify-center">
                          {emailAccounts.map((account) => (
                            <Button
                              key={account.id}
                              variant="outline"
                              size="sm"
                              onClick={() => syncMutation.mutate(account.id)}
                              disabled={syncMutation.isPending}
                              className="text-xs"
                            >
                              <RefreshCw className={cn("h-3 w-3 mr-1", syncMutation.isPending && "animate-spin")} />
                              Sync {account.accountName}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 py-2 px-2">
                    {emailThreads.map((thread: EmailThread) => (
                      <div
                        key={thread.id}
                        className={cn(
                          "group flex items-center px-3 py-3 bg-white rounded-xl border cursor-pointer transition-all duration-200",
                          selectedThread === thread.id
                            ? "bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-400 shadow-md ring-2 ring-blue-200"
                            : "border-slate-200 hover:shadow-lg hover:border-blue-300 hover:bg-slate-50"
                        )}
                        style={{ minHeight: 76 }}
                        onClick={() => setSelectedThread(thread.id)}
                        onMouseEnter={() => {
                          // Prefetch messages for quicker preview
                          try {
                            queryClient.prefetchQuery({
                              queryKey: ['/api/marketing/emails/threads', thread.id, 'messages'],
                              queryFn: async () => {
                                const response = await apiRequest('GET', `/api/marketing/emails/threads/${thread.id}/messages`);
                                if (!response.ok) return [] as EmailMessage[];
                                return response.json();
                              },
                            });
                          } catch (e) {}
                        }}
                      >
                        <input
                          type="checkbox"
                          className="mr-3 accent-blue-500 h-4 w-4 mt-1"
                          checked={selectedThreads.has(thread.id)}
                          onChange={(e) => {
                            const newSelected = new Set(selectedThreads);
                            if (e.target.checked) {
                              newSelected.add(thread.id);
                            } else {
                              newSelected.delete(thread.id);
                            }
                            setSelectedThreads(newSelected);
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <button
                          className={cn(
                            "mr-3 focus:outline-none transition-colors",
                            thread.messages?.[0]?.isStarred 
                              ? "text-yellow-400" 
                              : "text-gray-300 group-hover:text-yellow-400"
                          )}
                          tabIndex={-1}
                          onClick={e => {
                            e.stopPropagation();
                            const message = thread.messages?.[0];
                            if (message) {
                              starMutation.mutate({ messageId: message.id, isStarred: !message.isStarred });
                            }
                          }}
                          aria-label={thread.messages?.[0]?.isStarred ? "Unstar" : "Star"}
                        >
                          <Star className={cn("h-5 w-5", thread.messages?.[0]?.isStarred && "fill-yellow-400")} />
                        </button>
                        <Avatar className="h-9 w-9 flex-shrink-0 mr-3">
                          <AvatarFallback className="bg-gray-200 text-gray-600 text-xs">
                            {getInitials(thread.participantEmails[0] || 'U')}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              {thread.messages?.[0]?.isRead === false && (
                                <div className="h-2 w-2 rounded-full bg-blue-600 flex-shrink-0" />
                              )}
                              <span className={cn(
                                "text-sm truncate",
                                thread.messages?.[0]?.isRead === false 
                                  ? "font-bold text-gray-900" 
                                  : "font-semibold text-gray-700"
                              )}>
                                {thread.participantEmails[0]?.split('@')[0] || 'Unknown'}
                              </span>
                            </div>
                            <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                              {thread.lastMessageAt && formatDistanceToNow(new Date(thread.lastMessageAt), { addSuffix: true })}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={cn(
                              "text-sm truncate max-w-[16rem]",
                              thread.messages?.[0]?.isRead === false 
                                ? "font-bold text-gray-900" 
                                : "font-medium text-gray-800"
                            )}>
                              {thread.subject || '(no subject)'}
                            </span>
                            {thread.messageCount > 1 && (
                              <Badge variant="outline" className="text-xs ml-1">
                                {thread.messageCount}
                              </Badge>
                            )}
                          </div>
                          <div className={cn(
                            "text-xs truncate max-w-[24rem] mt-0.5",
                            thread.messages?.[0]?.isRead === false 
                              ? "text-gray-700 font-medium" 
                              : "text-gray-500"
                          )}>
                            {thread.preview || 'No preview available'}
                          </div>
                          {thread.labels && thread.labels.length > 0 && (
                            <div className="flex items-center gap-2 mt-1">
                              {thread.labels.map((label) => (
                                <Badge key={label} variant="secondary" className="text-xs">
                                  {label}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {/* Load more control */}
                    <div className="flex flex-col items-center justify-center p-6 border-t border-slate-200 bg-gradient-to-b from-white to-slate-50">
                      {hasNextPage ? (
                        <div className="text-center space-y-3">
                          <p className="text-sm text-gray-600">
                            Showing {emailThreads.length} email{emailThreads.length === 1 ? '' : 's'}
                            {threadsQuery.data && threadsQuery.data.pages.length > 1 && (
                              <span className="text-gray-500"> (Page {threadsQuery.data.pages.length})</span>
                            )}
                          </p>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="default"
                              onClick={() => fetchNextPage()}
                              disabled={threadsLoading || isFetching}
                              className="bg-white hover:bg-blue-50 border-blue-200 text-blue-700 hover:border-blue-300 shadow-sm"
                            >
                              {threadsLoading || isFetching ? (
                                <>
                                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                  Loading...
                                </>
                              ) : (
                                <>
                                  <Plus className="h-4 w-4 mr-2" />
                                  Load more
                                </>
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="default"
                              onClick={async () => {
                                // Load all remaining pages
                                while (hasNextPage && !isFetching) {
                                  await fetchNextPage();
                                }
                              }}
                              disabled={threadsLoading || isFetching}
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            >
                              Load all
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                console.log('Manual refresh triggered');
                                refetchThreads();
                              }}
                              disabled={threadsLoading || isFetching}
                              className="text-gray-600 hover:text-gray-700"
                            >
                              <RefreshCw className={cn("h-3 w-3 mr-1", (threadsLoading || isFetching) && "animate-spin")} />
                              Refresh
                            </Button>
                          </div>
                        </div>
                      ) : emailThreads.length > 0 ? (
                        <div className="text-center">
                          <div className="h-12 w-12 mx-auto mb-3 rounded-full bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center">
                            <Check className="h-6 w-6 text-green-600" />
                          </div>
                          <p className="text-sm font-medium text-gray-700 mb-1">All emails loaded</p>
                          <p className="text-xs text-gray-500">
                            Showing all {emailThreads.length} email{emailThreads.length === 1 ? '' : 's'} in {selectedFolder}
                          </p>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => refetchThreads()}
                            disabled={isFetching}
                            className="mt-3"
                          >
                            <RefreshCw className={cn("h-3 w-3 mr-1", isFetching && "animate-spin")} />
                            Refresh
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}
                </div>
              </div>
            </div>

            {/* Email Content */}
            <div className="flex-1 bg-gradient-to-br from-white to-slate-50" style={{ minWidth: 0 }}>
              {selectedThread ? (
                <div className="h-full flex flex-col px-0 md:px-8 py-4">
                  {/* Email Header */}
                  <div className="p-6 border-b border-slate-200 bg-white rounded-t-xl shadow-md mb-4 backdrop-blur-sm">
                    <div className="flex items-center justify-between mb-2">
                      <h2 className="text-lg font-semibold text-gray-900">
                        {threadMessages[0]?.subject || '(no subject)'}
                      </h2>
                      <div className="flex items-center gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => {
                              const message = threadMessages[0];
                              if (message) {
                                starMutation.mutate({ messageId: message.id, isStarred: !message.isStarred });
                              }
                            }}
                            disabled={starMutation.isPending}
                          >
                            <Star className={cn("h-4 w-4", threadMessages[0]?.isStarred && "fill-yellow-400 text-yellow-400")} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{threadMessages[0]?.isStarred ? 'Unstar' : 'Star'}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => {
                              if (selectedThread) {
                                archiveMutation.mutate({ threadId: selectedThread, isArchived: true });
                              }
                            }}
                            disabled={archiveMutation.isPending}
                          >
                            <Archive className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Archive</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => {
                              if (selectedThread && confirm('Delete this thread? This cannot be undone.')) {
                                // Delete functionality to be implemented
                                toast.info('Delete functionality coming soon');
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete</TooltipContent>
                      </Tooltip>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>Mark as unread</DropdownMenuItem>
                            <DropdownMenuItem>Add label</DropdownMenuItem>
                            <DropdownMenuItem>Move to folder</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleReply('reply')}
                      >
                        <Reply className="h-4 w-4 mr-2" />
                        Reply
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleReply('reply-all')}
                      >
                        <ReplyAll className="h-4 w-4 mr-2" />
                        Reply All
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleReply('forward')}
                      >
                        <Forward className="h-4 w-4 mr-2" />
                        Forward
                      </Button>
                    </div>
                  </div>

                  {/* Messages */}
                  <ScrollArea className="flex-1">
                    <div className="space-y-6">
                      {(threadMessagesLoading || threadMessagesFetching) ? (
                        <div className="p-8 text-center">
                          <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-600" />
                          <p className="text-sm text-slate-600 mt-2">Loading messages...</p>
                        </div>
                      ) : threadMessagesError ? (
                        <div className="p-8 text-center">
                          <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                            <X className="h-8 w-8 text-red-600" />
                          </div>
                          <p className="text-sm text-red-600 font-medium mb-2">Failed to load messages</p>
                          <p className="text-xs text-slate-500 mb-4">There was an error loading the messages</p>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/marketing/emails/threads', selectedThread, 'messages'] })}
                          >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Try Again
                          </Button>
                        </div>
                      ) : threadMessages.length === 0 ? (
                        <div className="p-8 text-center">
                          <p className="text-sm text-slate-600">No messages in this thread</p>
                        </div>
                      ) : threadMessages.map((message) => (
                        <Card key={message.id} className="border-l-4 border-l-blue-500 bg-white shadow-lg rounded-xl hover:shadow-xl transition-shadow">
                          <CardContent className="p-8">
                            <div className="flex items-start justify-between mb-6">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback className="bg-blue-100 text-blue-600 text-xs">
                                    {getInitials(message.fromEmail)}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="font-medium text-base text-gray-900 mb-1">
                                    {message.fromEmail}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    to {message.toEmails.join(', ')}
                                  </div>
                                </div>
                              </div>
                              <div className="text-xs text-gray-500 whitespace-nowrap ml-4">
                                {message.sentAt && format(new Date(message.sentAt), 'MMM d, yyyy h:mm a')}
                              </div>
                            </div>
                            
                            <div className="bg-gray-50 rounded-lg p-6 my-4">
                              <MessageBody html={message.htmlBody} text={message.textBody} />
                            </div>
                            
                            {message.attachments && message.attachments.length > 0 && (
                              <div className="mt-8 pt-6 border-t border-gray-200">
                                <div className="flex items-center gap-3 mb-3">
                                  <Paperclip className="h-5 w-5 text-gray-400" />
                                  <span className="text-base text-gray-700 font-medium">
                                    {message.attachments.length} attachment(s)
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-4">
                                  {message.attachments.map((attachment, index) => (
                                    <Badge key={index} variant="outline" className="px-4 py-2 text-sm">
                                      {attachment.fileName || `Attachment ${index + 1}`}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center animate-in fade-in duration-500">
                    <div className="h-20 w-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center shadow-md">
                      <Mail className="h-10 w-10 text-slate-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-slate-800 mb-2">Select an email</h3>
                    <p className="text-slate-500 max-w-sm mx-auto">Choose an email from the list to view its content and start a conversation</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Account Management Dialog */}
        <Dialog open={accountsDialogOpen} onOpenChange={setAccountsDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Email Accounts</DialogTitle>
              <DialogDescription className="sr-only">Manage your connected email accounts and sync settings</DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-medium">Connected Accounts</h4>
                <div className="flex flex-col gap-2">
                  {emailAccounts.length === 0 ? (
                    <p className="text-sm text-gray-500">No accounts connected</p>
                  ) : (
                    <div className="space-y-2">
                      {emailAccounts.map((account) => (
                        <div key={account.id} className="flex items-center justify-between p-2 border rounded">
                          <div className="flex items-center gap-2">
                            {account.provider === 'gmail' ? (
                              <Mail className="h-4 w-4 text-red-500" />
                            ) : (
                              <AtSign className="h-4 w-4 text-blue-500" />
                            )}
                            <div>
                              <div className="text-sm font-medium">{account.accountName}</div>
                              <div className="text-xs text-gray-500">{account.emailAddress}</div>
                            </div>
                          </div>
                          <Badge variant={account.isActive ? "default" : "secondary"}>
                            {account.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <h4 className="font-medium">Add New Account</h4>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    onClick={handleGmailOAuth}
                    className="flex items-center gap-2"
                  >
                    <Mail className="h-4 w-4 text-red-500" />
                    Gmail
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleOutlookOAuth}
                    className="flex items-center gap-2"
                  >
                    <AtSign className="h-4 w-4 text-blue-500" />
                    Outlook
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Floating Compose Button (when sidebar collapsed) */}
        {sidebarCollapsed && (
          <div className="fixed bottom-6 right-6 z-50">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleCompose}
                  className="w-14 h-14 rounded-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
                >
                  <Plus className="h-6 w-6" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Compose Email</TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* Compose Dialog */}
        <ComposeDialog
          open={composeOpen}
          onOpenChange={setComposeOpen}
          replyTo={replyData}
          mode={composeMode}
        />
      </div>
    </TooltipProvider>
  );
}
