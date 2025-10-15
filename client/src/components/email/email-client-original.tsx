import React, { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useVirtualizer } from '@tantml:react-virtual';
import { format } from 'date-fns';
import { apiRequest } from '@/lib/queryClient';
import { useHotkeys } from 'react-hotkeys-hook';
import { useDropzone } from 'react-dropzone';
import { EmailData, EmailEditor } from './email-editor';
import { EmailListSkeleton, EmailDetailSkeleton } from './loading-skeleton';
import { EmailContent } from './email-content';
import { EmailErrorBoundary } from './EmailErrorBoundary';
import { VirtualizedEmailMessages } from './VirtualizedEmailMessages';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Menu, Search, Settings, HelpCircle, Mail, Inbox, Send, FileText, Star, Trash2,
  Archive, Clock, RefreshCw, MoreVertical, Pencil, Check, X, Filter,
  Reply, Paperclip, Smile, Download, MailOpen, Square, SquareCheck, ArrowLeft, 
  Plus, Zap, Link2, Image, Forward, ReplyAll
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';

// Lazy load EmojiPicker to reduce initial bundle size (saves ~50-100KB)
const EmojiPicker = lazy(() => import('emoji-picker-react'));

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

function EmailClientInner() {
  const { isAuthenticated, isLoading: isAuthLoading, isAuthChecked } = useAuth();
  const [, navigate] = useLocation();
  // Navigation & selection state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedFolder, setSelectedFolder] = useState('inbox');
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [selectedThreads, setSelectedThreads] = useState<Set<string>>(new Set());
  const [view, setView] = useState<'list' | 'split'>('split');
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  
  // Compose state
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  
  // UI state (modals, pickers, etc.)
  const [composeOpen, setComposeOpen] = useState(false);
  const [accountsOpen, setAccountsOpen] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showScheduler, setShowScheduler] = useState(false);
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  
  const [scheduledDate, setScheduledDate] = useState<Date | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
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
    enabled: isAuthChecked && isAuthenticated === true, // Only run when auth is checked and user is authenticated
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
    enabled: isAuthChecked && isAuthenticated === true, // Only run when auth is checked and user is authenticated
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
    enabled: !!selectedThread && isAuthChecked && isAuthenticated === true,
    staleTime: 2 * 60 * 1000, // 2 minutes - messages are fairly static
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Star mutation - optimized with proper optimistic updates
  const starMutation = useMutation({
    mutationFn: async ({ messageId, isStarred }: { messageId: string; isStarred: boolean }) => {
      const response = await apiRequest('PATCH', `/api/marketing/emails/messages/${messageId}/star`, { isStarred });
      if (!response.ok) throw new Error('Failed');
      return response.json();
    },
    onMutate: async ({ messageId, isStarred }) => {
      // Build exact query key for current view
      const queryKey = ['/api/marketing/emails/threads', selectedFolder, debouncedSearchQuery];
      
      // Cancel outgoing fetches
      await queryClient.cancelQueries({ queryKey });
      
      // Snapshot current data for rollback
      const previousData = queryClient.getQueryData(queryKey);
      
      // Optimistically update ONLY the current query
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            threads: page.threads.map((thread: EmailThread) => {
              if (thread.messages?.some(m => m.id === messageId)) {
                return {
                  ...thread,
                  messages: thread.messages.map(m =>
                    m.id === messageId ? { ...m, isStarred } : m
                  ),
                };
              }
              return thread;
            }),
          })),
        };
      });
      
      // Also update thread messages query if viewing this thread
      if (selectedThread) {
        const messagesKey = ['/api/marketing/emails/threads', selectedThread, 'messages'];
        const previousMessages = queryClient.getQueryData(messagesKey);
        
        queryClient.setQueryData(messagesKey, (old: any) => {
          if (!Array.isArray(old)) return old;
          return old.map((m: EmailMessage) =>
            m.id === messageId ? { ...m, isStarred } : m
          );
        });
        
        return { previousData, previousMessages, queryKey, messagesKey };
      }
      
      return { previousData, queryKey };
    },
    onError: (err, variables, context) => {
      // Proper rollback - restore both queries if they exist
      if (context?.previousData) {
        queryClient.setQueryData(context.queryKey, context.previousData);
      }
      if (context?.previousMessages && context?.messagesKey) {
        queryClient.setQueryData(context.messagesKey, context.previousMessages);
      }
      toast.error('Failed to update star');
    },
    // No invalidation needed - we updated optimistically
  });

  // Archive mutation with undo - optimized
  const archiveMutation = useMutation({
    mutationFn: async (threadId: string) => {
      const response = await apiRequest('PATCH', `/api/marketing/emails/threads/${threadId}/archive`, { isArchived: true });
      if (!response.ok) throw new Error('Failed');
      return response.json();
    },
    onSuccess: (_, threadId) => {
      // Only invalidate EXACT current folder query with current search
      queryClient.invalidateQueries({ 
        queryKey: ['/api/marketing/emails/threads', selectedFolder, debouncedSearchQuery],
        exact: true
      });
      setSelectedThread(null);
      
      toast.success('Conversation archived', {
        duration: 5000,
        action: {
          label: 'Undo',
          onClick: () => {
            unarchiveMutation.mutate(threadId);
          }
        }
      });
    },
    onError: () => {
      toast.error('Failed to archive conversation');
    },
  });

  // Unarchive mutation - optimized
  const unarchiveMutation = useMutation({
    mutationFn: async (threadId: string) => {
      const response = await apiRequest('PATCH', `/api/marketing/emails/threads/${threadId}/archive`, { isArchived: false });
      if (!response.ok) throw new Error('Failed');
      return response.json();
    },
    onSuccess: () => {
      // Only invalidate EXACT current folder query
      queryClient.invalidateQueries({ 
        queryKey: ['/api/marketing/emails/threads', selectedFolder, debouncedSearchQuery],
        exact: true
      });
    },
  });

  // Mark as read mutation - optimized (silent, no toast)
  const markAsReadMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const response = await apiRequest('PATCH', `/api/marketing/emails/messages/${messageId}/read`, { isRead: true });
      if (!response.ok) throw new Error('Failed');
      return response.json();
    },
    onSuccess: () => {
      // Only invalidate specific thread query instead of all
      if (selectedThread) {
        queryClient.invalidateQueries({ 
          queryKey: ['/api/marketing/emails/threads', selectedThread, 'messages'],
          exact: true 
        });
      }
      // Silent update - no toast needed for common action
    },
  });

  // Mark as unread mutation - optimized (silent)
  const markAsUnreadMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const response = await apiRequest('PATCH', `/api/marketing/emails/messages/${messageId}/read`, { isRead: false });
      if (!response.ok) throw new Error('Failed');
      return response.json();
    },
    onSuccess: () => {
      // Only invalidate specific thread query instead of all
      if (selectedThread) {
        queryClient.invalidateQueries({ 
          queryKey: ['/api/marketing/emails/threads', selectedThread, 'messages'],
          exact: true 
        });
      }
      // Silent update - no toast needed
    },
  });

  // Delete thread mutation - optimized
  const deleteThreadMutation = useMutation({
    mutationFn: async (threadId: string) => {
      const response = await apiRequest('DELETE', `/api/marketing/emails/threads/${threadId}`);
      if (!response.ok) throw new Error('Failed');
      return response.json();
    },
    onSuccess: () => {
      // Only invalidate EXACT current folder query
      queryClient.invalidateQueries({ 
        queryKey: ['/api/marketing/emails/threads', selectedFolder, debouncedSearchQuery],
        exact: true
      });
      setSelectedThread(null);
      toast.success('Conversation deleted');
    },
    onError: () => {
      toast.error('Failed to delete conversation');
    },
  });

  // Bulk archive mutation - optimized
  const bulkArchiveMutation = useMutation({
    mutationFn: async (threadIds: string[]) => {
      await Promise.all(
        threadIds.map(id => 
          apiRequest('PATCH', `/api/marketing/emails/threads/${id}/archive`, { isArchived: true })
        )
      );
    },
    onSuccess: (_, threadIds) => {
      // Only invalidate EXACT current folder query
      queryClient.invalidateQueries({ 
        queryKey: ['/api/marketing/emails/threads', selectedFolder, debouncedSearchQuery],
        exact: true
      });
      setSelectedThreads(new Set());
      toast.success(`${threadIds.length} conversations archived`);
    },
  });

  // Bulk delete mutation - optimized
  const bulkDeleteMutation = useMutation({
    mutationFn: async (threadIds: string[]) => {
      await Promise.all(
        threadIds.map(id => 
          apiRequest('DELETE', `/api/marketing/emails/threads/${id}`)
        )
      );
    },
    onSuccess: (_, threadIds) => {
      // Only invalidate EXACT current folder query
      queryClient.invalidateQueries({ 
        queryKey: ['/api/marketing/emails/threads', selectedFolder, debouncedSearchQuery],
        exact: true
      });
      setSelectedThreads(new Set());
      toast.success(`${threadIds.length} conversations deleted`);
    },
  });

  // Send email mutation with undo and attachments - fixed closure issues
  const sendEmailMutation = useMutation({
    mutationFn: async (data: { to: string; subject: string; body: string; attachments: File[]; accountId: string }) => {
      // Use passed data instead of closure variables
      if (!data.accountId) throw new Error('No account connected');
      
      // Convert attachments to base64 - optimized for large files
      const attachmentData = await Promise.all(
        data.attachments.map(async (file) => {
          const buffer = await file.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          
          // Chunked conversion to avoid stack overflow on large files
          let binary = '';
          const chunkSize = 8192; // Process 8KB at a time
          for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
            binary += String.fromCharCode.apply(null, Array.from(chunk));
          }
          const base64 = btoa(binary);
          
          return {
            filename: file.name,
            content: base64,
            contentType: file.type,
          };
        })
      );

      const response = await apiRequest('POST', '/api/email/send', {
        accountId: data.accountId,
        to: data.to.split(',').map((e: string) => e.trim()),
        subject: data.subject,
        htmlBody: data.body,
        textBody: data.body.replace(/<[^>]*>/g, ''),
        attachments: attachmentData.length > 0 ? attachmentData : undefined,
      });
      
      if (!response.ok) throw new Error('Failed to send');
      return response.json();
    },
    onSuccess: () => {
      const toastId = toast.success('Email sent!', {
        duration: 5000,
        action: {
          label: 'Undo',
          onClick: () => {
            toast.info('Undo send is not yet implemented');
          }
        }
      });
      
      setComposeOpen(false);
      setComposeTo('');
      setComposeSubject('');
      setComposeBody('');
      setAttachments([]);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to send email');
    },
  });

  // Delete account mutation
  const deleteAccountMutation = useMutation({
    mutationFn: async (accountId: string) => {
      const response = await apiRequest('DELETE', `/api/email/accounts/${accountId}`);
      if (!response.ok) throw new Error('Failed to delete account');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/email/accounts'] });
      toast.success('Account removed successfully');
    },
    onError: () => {
      toast.error('Failed to remove account');
    },
  });

  // OAuth handlers - memoized
  const handleConnectAccount = useCallback(async (provider: 'gmail' | 'outlook') => {
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
  }, []);

  const handleRemoveAccount = useCallback((accountId: string, accountName: string) => {
    if (confirm(`Are you sure you want to remove ${accountName}?`)) {
      deleteAccountMutation.mutate(accountId);
    }
  }, [deleteAccountMutation]);

  const getInitials = useCallback((email: string) => {
    const name = email.split('@')[0];
    return name.slice(0, 2).toUpperCase();
  }, []);

  // File dropzone configuration - memoized to prevent recreation
  const onDropCallback = useCallback((acceptedFiles: File[]) => {
    setAttachments(prev => [...prev, ...acceptedFiles]);
    toast.success(`${acceptedFiles.length} file(s) attached`);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onDropCallback,
    maxSize: 25 * 1024 * 1024, // 25MB per file
    multiple: true,
  });

  // Draft auto-save every 30 seconds - optimized with ref pattern
  // Avoids recreating interval on every keystroke
  const draftDataRef = useRef({ composeTo, composeSubject, composeBody, attachments });
  // Update ref during render (no useEffect needed)
  draftDataRef.current = { composeTo, composeSubject, composeBody, attachments };

  useEffect(() => {
    const timer = setInterval(() => {
      const { composeTo, composeSubject, composeBody, attachments } = draftDataRef.current;
      
      // Only save if there's actual content
      if (composeTo || composeSubject || composeBody) {
        console.log('Auto-saving draft...');
        localStorage.setItem('emailDraft', JSON.stringify({
          to: composeTo,
          subject: composeSubject,
          body: composeBody,
          attachments: attachments.map(f => f.name),
          savedAt: new Date().toISOString(),
        }));
        // Draft saves silently in background
      }
    }, 30000);

    return () => clearInterval(timer);
  }, []); // No dependencies - stable interval!

  // Load draft on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('emailDraft');
      if (saved) {
        const draft = JSON.parse(saved);
        const savedTime = new Date(draft.savedAt);
        const hoursSince = (Date.now() - savedTime.getTime()) / (1000 * 60 * 60);
        
        if (hoursSince < 24) {
          toast.info('Draft recovered', {
            action: {
              label: 'Restore',
              onClick: () => {
                setComposeTo(draft.to);
                setComposeSubject(draft.subject);
                setComposeBody(draft.body);
                setComposeOpen(true);
              }
            }
          });
        }
      }
    } catch (e) {
      console.error('Failed to load draft:', e);
    }
  }, []);

  // Store latest values in refs to avoid dependencies
  const latestValuesRef = useRef({
    selectedThread,
    threadMessages,
    composeOpen,
    composeTo,
    composeSubject,
    emailThreads,
  });

  // Update ref during render (no useEffect needed - cheaper than effect)
  latestValuesRef.current = {
    selectedThread,
    threadMessages,
    composeOpen,
    composeTo,
    composeSubject,
    emailThreads,
  };

  // Keyboard shortcuts - optimized to have minimal dependencies
  const handleKeyboardShortcut = useCallback((key: string, event?: KeyboardEvent) => {
    const latest = latestValuesRef.current;
    
    switch (key) {
      case 'c':
        event?.preventDefault();
        setComposeOpen(true);
        break;
      case '/':
        event?.preventDefault();
        searchInputRef.current?.focus();
        break;
      case 'r':
        if (latest.selectedThread && latest.threadMessages[0]) {
          handleReply(latest.threadMessages[0]);
        }
        break;
      case 'e':
        if (latest.selectedThread) {
          archiveMutation.mutate(latest.selectedThread);
        }
        break;
      case 'escape':
        if (latest.composeOpen) setComposeOpen(false);
        else if (latest.selectedThread) setSelectedThread(null);
        break;
      case 'ctrl+enter':
        if (latest.composeOpen && latest.composeTo && latest.composeSubject) {
          handleSend();
        }
        break;
      case 'shift+/':
        event?.preventDefault();
        setShowKeyboardShortcuts(true);
        break;
      case 'select-all':
        event?.preventDefault();
        // Optimized: Create Set from IDs without mapping
        const allIds = new Set<string>();
        for (const thread of latest.emailThreads) {
          allIds.add(thread.id);
        }
        setSelectedThreads(allIds);
        toast.success(`Selected ${latest.emailThreads.length} conversations`);
        break;
      case 'select-none':
        event?.preventDefault();
        setSelectedThreads(new Set());
        toast.success('Selection cleared');
        break;
    }
  }, [handleReply, archiveMutation, handleSend]); // Only 3 dependencies now!

  useHotkeys('c', (e) => handleKeyboardShortcut('c', e), { enableOnFormTags: false });
  useHotkeys('/', (e) => handleKeyboardShortcut('/', e), { enableOnFormTags: false });
  useHotkeys('r', () => handleKeyboardShortcut('r'), { enableOnFormTags: false });
  useHotkeys('e', () => handleKeyboardShortcut('e'), { enableOnFormTags: false });
  useHotkeys('escape', () => handleKeyboardShortcut('escape'));
  useHotkeys('ctrl+enter', () => handleKeyboardShortcut('ctrl+enter'), { enableOnFormTags: true });
  useHotkeys('shift+/', (e) => handleKeyboardShortcut('shift+/', e), { enableOnFormTags: false });
  useHotkeys('shift+8,a', (e) => handleKeyboardShortcut('select-all', e), { enableOnFormTags: false });
  useHotkeys('shift+8,n', (e) => handleKeyboardShortcut('select-none', e), { enableOnFormTags: false });

  // Handlers - wrapped in useCallback to prevent unnecessary re-renders
  const handleSend = useCallback(() => {
    if (!composeTo || !composeSubject) {
      toast.error('Please fill in recipient and subject');
      return;
    }
    
    if (!emailAccounts[0]) {
      toast.error('No email account connected');
      return;
    }
    
    sendEmailMutation.mutate({
      to: composeTo,
      subject: composeSubject,
      body: composeBody,
      attachments: attachments,
      accountId: emailAccounts[0].id,
    });

    // Clear draft after sending
    localStorage.removeItem('emailDraft');
  }, [composeTo, composeSubject, composeBody, attachments, emailAccounts, sendEmailMutation]);

  const handleReply = useCallback((message: EmailMessage) => {
    setComposeTo(message.fromEmail);
    setComposeSubject(`Re: ${message.subject}`);
    setComposeBody('');
    setComposeOpen(true);
  }, []);

  const handleDiscardDraft = useCallback(() => {
    setComposeTo('');
    setComposeSubject('');
    setComposeBody('');
    setAttachments([]);
    setComposeOpen(false);
    localStorage.removeItem('emailDraft');
    toast.success('Draft discarded');
  }, []);

  const removeAttachment = useCallback((index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  }, []);

  const insertLink = useCallback(() => {
    const url = prompt('Enter URL:');
    if (url) {
      setComposeBody(prev => `${prev}<a href="${url}">${url}</a>`);
    }
  }, []);

  const insertImage = useCallback(() => {
    const url = prompt('Enter image URL:');
    if (url) {
      setComposeBody(prev => `${prev}<img src="${url}" alt="Image" style="max-width: 100%;" />`);
    }
  }, []);

  // Search history management - memoized
  const addToSearchHistory = useCallback((query: string) => {
    if (!query.trim()) return;
    setSearchHistory(prev => {
      const updated = [query, ...prev.filter(q => q !== query)].slice(0, 10);
      localStorage.setItem('emailSearchHistory', JSON.stringify(updated));
      return updated;
    });
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('emailSearchHistory');
      if (saved) setSearchHistory(JSON.parse(saved));
    } catch (e) {}
  }, []);

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

  // Memoize folder counts to avoid expensive filter operations on every render
  const inboxCount = useMemo(() => 
    emailThreads.filter((t: EmailThread) => !t.isArchived).length, 
    [emailThreads]
  );

  const folders = useMemo(() => [
    { id: 'inbox', name: 'Inbox', icon: Inbox, color: 'text-blue-600', bgColor: 'bg-blue-50', count: inboxCount },
    { id: 'starred', name: 'Starred', icon: Star, color: 'text-yellow-600', bgColor: 'bg-yellow-50', count: 0 },
    { id: 'snoozed', name: 'Snoozed', icon: Clock, color: 'text-purple-600', bgColor: 'bg-purple-50', count: 0 },
    { id: 'sent', name: 'Sent', icon: Send, color: 'text-green-600', bgColor: 'bg-green-50', count: 0 },
    { id: 'drafts', name: 'Drafts', icon: FileText, color: 'text-orange-600', bgColor: 'bg-orange-50', count: 0 },
    { id: 'archived', name: 'Archive', icon: Archive, color: 'text-gray-600', bgColor: 'bg-gray-50', count: 0 },
    { id: 'trash', name: 'Trash', icon: Trash2, color: 'text-red-600', bgColor: 'bg-red-50', count: 0 },
  ], [inboxCount]);

  const currentFolder = useMemo(() => 
    folders.find(f => f.id === selectedFolder) || folders[0],
    [folders, selectedFolder]
  );

  // Optimized checkbox handler - prevents passing entire Set to each row
  const handleThreadCheckToggle = useCallback((threadId: string, checked: boolean) => {
    setSelectedThreads(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(threadId);
      } else {
        newSet.delete(threadId);
      }
      return newSet;
    });
  }, []);

  // Memoized handler for select all/none
  const handleSelectAllToggle = useCallback(() => {
    if (selectedThreads.size === emailThreads.length) {
      setSelectedThreads(new Set());
    } else {
      setSelectedThreads(new Set(emailThreads.map(t => t.id)));
      toast.success(`Selected ${emailThreads.length} conversations`);
    }
  }, [selectedThreads.size, emailThreads]);

  // Memoized handler for mark as read
  const handleMarkSelectedAsRead = useCallback(() => {
    emailThreads
      .filter(t => selectedThreads.has(t.id))
      .forEach(t => {
        const msg = t.messages?.[0];
        if (msg && !msg.isRead) {
          markAsReadMutation.mutate(msg.id);
        }
      });
    setSelectedThreads(new Set());
  }, [emailThreads, selectedThreads, markAsReadMutation]);

  // Memoized handler for bulk archive
  const handleBulkArchive = useCallback(() => {
    bulkArchiveMutation.mutate(Array.from(selectedThreads));
  }, [selectedThreads, bulkArchiveMutation]);

  // Memoized handler for bulk delete
  const handleBulkDelete = useCallback(() => {
    if (confirm(`Delete ${selectedThreads.size} conversations?`)) {
      bulkDeleteMutation.mutate(Array.from(selectedThreads));
    }
  }, [selectedThreads, bulkDeleteMutation]);

  // Memoized handler for clearing selection
  const handleClearSelection = useCallback(() => {
    setSelectedThreads(new Set());
  }, []);

  // Memoized handler for sidebar toggle
  const handleSidebarToggle = useCallback(() => {
    setSidebarOpen(prev => !prev);
  }, []);

  // Memoized handler for navigate back
  const handleNavigateBack = useCallback(() => {
    navigate('/dashboard');
  }, [navigate]);

  // Memoized handler for search query change
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    setShowSearchSuggestions(true);
  }, []);

  // Memoized handler for search query select
  const handleSearchQuerySelect = useCallback((query: string) => {
    setSearchQuery(query);
    setShowSearchSuggestions(false);
  }, []);

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full bg-white">
        {/* Gmail Subheader - Toolbar and Search */}
        <header className="flex items-center gap-4 px-4 py-2 border-b border-gray-200 bg-white">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                onClick={handleNavigateBack}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Back to Dashboard</TooltipContent>
          </Tooltip>

          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={handleSidebarToggle}
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex items-center gap-2">
            <Mail className="h-6 w-6 text-red-500" />
            <span className="text-xl font-normal text-gray-700 hidden sm:inline">Gmail</span>
          </div>

          {/* Search Bar - Gmail Style with Suggestions */}
          <div className="flex-1 max-w-3xl relative">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-gray-600" />
              <Input
                ref={searchInputRef}
                placeholder="Search mail (Press / to focus)"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    addToSearchHistory(searchQuery);
                    setShowSearchSuggestions(false);
                  }
                }}
                onFocus={() => setShowSearchSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSearchSuggestions(false), 200)}
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

            {/* Search Suggestions Dropdown */}
            {showSearchSuggestions && searchHistory.length > 0 && !searchQuery && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-w-3xl">
                <div className="p-2">
                  <div className="px-3 py-2 text-xs text-gray-500 font-medium">Recent searches</div>
                  {searchHistory.map((query, idx) => (
                    <button
                      key={idx}
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 rounded text-left"
                      onClick={() => handleSearchQuerySelect(query)}
                    >
                      <Clock className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-700">{query}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="rounded-full"
                  onClick={() => setShowKeyboardShortcuts(true)}
                >
                  <HelpCircle className="h-5 w-5 text-gray-600" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Keyboard shortcuts (?)</TooltipContent>
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
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-full"
                      onClick={handleSelectAllToggle}
                    >
                      {selectedThreads.size === emailThreads.length ? (
                        <SquareCheck className="h-4 w-4 text-blue-600" />
                      ) : selectedThreads.size > 0 ? (
                        <SquareCheck className="h-4 w-4 text-blue-400" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Select all (*+a)</TooltipContent>
                </Tooltip>

                <Separator orientation="vertical" className="h-6 mx-1" />

                {selectedThreads.size > 0 ? (
                  <>
                    <Badge variant="secondary" className="ml-2">
                      {selectedThreads.size} selected
                    </Badge>
                    
                    <Separator orientation="vertical" className="h-6 mx-1" />

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="rounded-full hover:bg-green-50"
                          onClick={handleBulkArchive}
                          disabled={bulkArchiveMutation.isPending}
                        >
                          <Archive className="h-4 w-4 text-green-600" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Archive selected</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="rounded-full hover:bg-red-50"
                          onClick={handleBulkDelete}
                          disabled={bulkDeleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Delete selected</TooltipContent>
                    </Tooltip>

                    <Separator orientation="vertical" className="h-6 mx-1" />

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="rounded-full"
                          onClick={handleMarkSelectedAsRead}
                        >
                          <MailOpen className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Mark as read</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="rounded-full"
                          onClick={handleClearSelection}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Clear selection</TooltipContent>
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
                  <EmailListSkeleton />
                ) : emailThreads.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-96 p-8">
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-8 rounded-full mb-6">
                      <currentFolder.icon className="h-24 w-24 text-blue-400" />
                    </div>
                    <h3 className="text-2xl font-semibold text-gray-900 mb-3">
                      {searchQuery ? 'No emails found' : `Your ${currentFolder.name.toLowerCase()} is empty`}
                    </h3>
                    <p className="text-base text-gray-600 mb-6 text-center max-w-md">
                      {searchQuery 
                        ? 'Try different keywords or check your spelling' 
                        : emailAccounts.length === 0 
                        ? 'Connect your email account to start receiving messages' 
                        : 'When you receive emails, they\'ll appear here'}
                    </p>
                    {emailAccounts.length === 0 ? (
                      <Button
                        onClick={() => setAccountsOpen(true)}
                        size="lg"
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg"
                      >
                        <Mail className="h-5 w-5 mr-2" />
                        Connect Email Account
                      </Button>
                    ) : searchQuery ? (
                      <Button
                        onClick={() => setSearchQuery('')}
                        variant="outline"
                        size="lg"
                      >
                        Clear search
                      </Button>
                    ) : (
                      <Button
                        onClick={() => setComposeOpen(true)}
                        size="lg"
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg"
                      >
                        <Pencil className="h-5 w-5 mr-2" />
                        Compose your first email
                      </Button>
                    )}
                  </div>
                ) : (
                  <VirtualizedThreadList
                    threads={emailThreads}
                    selectedThread={selectedThread}
                    selectedThreads={selectedThreads}
                    onThreadSelect={setSelectedThread}
                    onThreadCheckToggle={handleThreadCheckToggle}
                    starMutation={starMutation}
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
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="rounded-full hover:bg-green-50"
                              onClick={() => {
                                if (selectedThread) {
                                  archiveMutation.mutate(selectedThread);
                                }
                              }}
                              disabled={archiveMutation.isPending}
                            >
                              <Archive className="h-4 w-4 text-green-600" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Archive (E)</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="rounded-full hover:bg-red-50"
                              onClick={() => {
                                if (selectedThread && confirm('Delete this conversation?')) {
                                  deleteThreadMutation.mutate(selectedThread);
                                }
                              }}
                              disabled={deleteThreadMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="rounded-full"
                              onClick={() => {
                                const firstMessage = threadMessages[0];
                                if (firstMessage) {
                                  if (firstMessage.isRead) {
                                    markAsUnreadMutation.mutate(firstMessage.id);
                                  } else {
                                    markAsReadMutation.mutate(firstMessage.id);
                                  }
                                }
                              }}
                            >
                              <MailOpen className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {threadMessages[0]?.isRead ? 'Mark as unread' : 'Mark as read'}
                          </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="rounded-full"
                              onClick={() => setSelectedThread(null)}
                            >
                              <ArrowLeft className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Back to list</TooltipContent>
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

                  {/* Messages - Now with Virtualization for Better Performance */}
                  {messagesLoading ? (
                    <div className="flex-1 px-6 py-4">
                      <EmailDetailSkeleton />
                    </div>
                  ) : (
                    <VirtualizedEmailMessages
                      messages={threadMessages}
                      onStarToggle={(messageId, isStarred) => starMutation.mutate({ messageId, isStarred })}
                      onReply={handleReply}
                      getInitials={getInitials}
                    />
                  )}
                  
                  {/* Old non-virtualized code - kept as fallback but not rendered
                  <div className="hidden space-y-4 max-w-4xl">
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
                                          <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-8 w-8 rounded-full hover:bg-gray-100"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleReply(message);
                                            }}
                                          >
                                            <Reply className="h-4 w-4" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Reply (R)</TooltipContent>
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
                                    onClick={() => handleReply(message)}
                                  >
                                    <Reply className="h-4 w-4 mr-2" />
                                    Reply
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="default"
                                    className="rounded-full border-2 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600"
                                    onClick={() => {
                                      setComposeTo([message.fromEmail, ...message.toEmails].join(', '));
                                      setComposeSubject(`Re: ${message.subject}`);
                                      setComposeBody('');
                                      setComposeOpen(true);
                                    }}
                                  >
                                    <ReplyAll className="h-4 w-4 mr-2" />
                                    Reply All
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="default"
                                    className="rounded-full border-2 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600"
                                    onClick={() => {
                                      setComposeTo('');
                                      setComposeSubject(`Fwd: ${message.subject}`);
                                      setComposeBody(message.htmlBody || message.textBody || '');
                                      setComposeOpen(true);
                                    }}
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

        {/* Enhanced Compose Dialog with Rich Text Editor */}
        <Dialog open={composeOpen} onOpenChange={(open) => {
          if (!open && (composeTo || composeSubject || composeBody)) {
            if (confirm('Discard unsaved changes?')) {
              handleDiscardDraft();
            }
          } else {
            setComposeOpen(open);
          }
        }}>
          <DialogContent className="max-w-4xl h-[700px] p-0 gap-0 rounded-2xl overflow-hidden">
            <div className="flex flex-col h-full">
              {/* Compose Header */}
              <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-blue-50 via-white to-indigo-50 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900 text-lg">New Message</h3>
                <div className="flex items-center gap-1">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 rounded-full" 
                    onClick={() => setComposeOpen(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Compose Fields */}
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* To Field */}
                <div className="px-6 py-3 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700 w-16">To</span>
                    <Input
                      placeholder="recipient@example.com"
                      value={composeTo}
                      onChange={(e) => setComposeTo(e.target.value)}
                      className="border-0 focus:ring-0 focus-visible:ring-0 px-0 text-sm"
                    />
                  </div>
                </div>

                {/* Subject Field */}
                <div className="px-6 py-3 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700 w-16">Subject</span>
                    <Input
                      placeholder="Email subject"
                      value={composeSubject}
                      onChange={(e) => setComposeSubject(e.target.value)}
                      className="border-0 focus:ring-0 focus-visible:ring-0 px-0 text-sm"
                    />
                  </div>
                </div>

                {/* Attachments Preview */}
                {attachments.length > 0 && (
                  <div className="px-6 py-3 border-b border-gray-200 bg-blue-50/30">
                    <div className="flex items-center gap-2 mb-2">
                      <Paperclip className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium text-gray-700">
                        {attachments.length} attachment{attachments.length > 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {attachments.map((file, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-sm"
                        >
                          <FileText className="h-3 w-3 text-gray-400" />
                          <span className="text-gray-700">{file.name}</span>
                          <span className="text-gray-400 text-xs">
                            ({(file.size / 1024).toFixed(1)}KB)
                          </span>
                          <button
                            onClick={() => removeAttachment(idx)}
                            className="ml-1 hover:bg-gray-100 rounded-full p-0.5"
                          >
                            <X className="h-3 w-3 text-gray-500" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Rich Text Editor */}
                <div className="flex-1 overflow-hidden" {...getRootProps()}>
                  <input {...getInputProps()} />
                  {isDragActive && (
                    <div className="absolute inset-0 bg-blue-50/90 border-2 border-dashed border-blue-400 flex items-center justify-center z-50">
                      <div className="text-center">
                        <Paperclip className="h-12 w-12 text-blue-600 mx-auto mb-2" />
                        <p className="text-lg font-medium text-blue-900">Drop files here to attach</p>
                      </div>
                    </div>
                  )}
                  <EmailEditor 
                    content={composeBody}
                    onChange={setComposeBody}
                    placeholder="Compose your message..."
                  />
                </div>

                {/* Compose Footer */}
                <div className="px-6 py-4 border-t-2 border-gray-200 bg-gradient-to-r from-gray-50 to-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={handleSend}
                        disabled={sendEmailMutation.isPending || !composeTo || !composeSubject}
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-full px-10 font-medium shadow-md"
                      >
                        {sendEmailMutation.isPending ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Send className="h-4 w-4 mr-2" />
                            Send
                          </>
                        )}
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        onClick={() => setShowScheduler(!showScheduler)}
                      >
                        <Clock className="h-4 w-4 mr-2" />
                        Schedule
                      </Button>
                      
                      <Separator orientation="vertical" className="h-6 mx-1" />
                      
                      <div {...getRootProps({ onClick: e => e.stopPropagation() })}>
                        <input {...getInputProps()} />
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="rounded-full hover:bg-blue-50">
                              <Paperclip className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Attach files</TooltipContent>
                        </Tooltip>
                      </div>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="rounded-full"
                            onClick={insertLink}
                          >
                            <Link2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Insert link</TooltipContent>
                      </Tooltip>

                      <div className="relative">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="rounded-full"
                              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                            >
                              <Smile className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Insert emoji</TooltipContent>
                        </Tooltip>
                        
                        {showEmojiPicker && (
                          <div className="absolute bottom-12 left-0 z-50">
                            <EmojiPicker
                              onEmojiClick={(emoji) => {
                                setComposeBody(prev => prev + emoji.emoji);
                                setShowEmojiPicker(false);
                              }}
                            />
                          </div>
                        )}
                      </div>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="rounded-full"
                            onClick={insertImage}
                          >
                            <Image className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Insert image</TooltipContent>
                      </Tooltip>
                    </div>

                    <div className="flex items-center gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="rounded-full hover:bg-red-50"
                            onClick={handleDiscardDraft}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
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
                  
                  {/* Schedule Send Panel */}
                  {showScheduler && (
                    <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Clock className="h-5 w-5 text-blue-600" />
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Schedule send time
                          </label>
                          <Input
                            type="datetime-local"
                            className="text-sm"
                            onChange={(e) => setScheduledDate(e.target.value ? new Date(e.target.value) : null)}
                          />
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowScheduler(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                      <p className="text-xs text-gray-600 mt-2">
                        {scheduledDate && `Email will be sent on ${format(scheduledDate, 'MMM d, yyyy at h:mm a')}`}
                      </p>
                    </div>
                  )}

                  {/* Keyboard Shortcuts Hint */}
                  <div className="mt-3 text-xs text-gray-500 text-center">
                    Press <kbd className="px-1.5 py-0.5 bg-gray-200 rounded">Ctrl+Enter</kbd> to send
                  </div>
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
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleRemoveAccount(account.id, account.accountName)}
                            disabled={deleteAccountMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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

        {/* Keyboard Shortcuts Help Dialog */}
        <Dialog open={showKeyboardShortcuts} onOpenChange={setShowKeyboardShortcuts}>
          <DialogContent className="max-w-2xl max-h-[600px] overflow-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-semibold flex items-center gap-2">
                <Zap className="h-6 w-6 text-blue-600" />
                Keyboard Shortcuts
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              {/* Compose & Actions */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Pencil className="h-4 w-4 text-blue-600" />
                  Compose & Actions
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-700">Compose new message</span>
                    <kbd className="px-3 py-1 bg-gray-100 rounded font-mono text-sm">C</kbd>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-700">Reply to message</span>
                    <kbd className="px-3 py-1 bg-gray-100 rounded font-mono text-sm">R</kbd>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-700">Archive conversation</span>
                    <kbd className="px-3 py-1 bg-gray-100 rounded font-mono text-sm">E</kbd>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-700">Send email</span>
                    <kbd className="px-3 py-1 bg-gray-100 rounded font-mono text-sm">Ctrl+Enter</kbd>
                  </div>
                </div>
              </div>

              {/* Navigation */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <ArrowLeft className="h-4 w-4 text-blue-600" />
                  Navigation
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-700">Focus search</span>
                    <kbd className="px-3 py-1 bg-gray-100 rounded font-mono text-sm">/</kbd>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-700">Close dialog/Go back</span>
                    <kbd className="px-3 py-1 bg-gray-100 rounded font-mono text-sm">Esc</kbd>
                  </div>
                </div>
              </div>

              {/* Selection */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <SquareCheck className="h-4 w-4 text-blue-600" />
                  Selection
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-700">Select all conversations</span>
                    <kbd className="px-3 py-1 bg-gray-100 rounded font-mono text-sm">*+A</kbd>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-700">Clear selection</span>
                    <kbd className="px-3 py-1 bg-gray-100 rounded font-mono text-sm">*+N</kbd>
                  </div>
                </div>
              </div>

              {/* Help */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-blue-600" />
                  Help
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-700">Show keyboard shortcuts</span>
                    <kbd className="px-3 py-1 bg-gray-100 rounded font-mono text-sm">?</kbd>
                  </div>
                </div>
              </div>

              {/* Tips */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Zap className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-blue-900 mb-1">Pro Tip</h4>
                    <p className="text-sm text-blue-700">
                      Combine shortcuts for maximum productivity! Press <kbd className="px-1.5 py-0.5 bg-white rounded text-xs">*+A</kbd> to select all, then <kbd className="px-1.5 py-0.5 bg-white rounded text-xs">E</kbd> to archive them all at once.
                    </p>
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
  onThreadCheckToggle: (threadId: string, checked: boolean) => void;
  starMutation: any; // Pass mutation directly instead of callback
  hasNextPage?: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
}

const VirtualizedThreadList = React.memo(({
  threads,
  selectedThread,
  selectedThreads,
  onThreadSelect,
  onThreadCheckToggle,
  starMutation,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: VirtualizedThreadListProps) => {
  const parentRef = useRef<HTMLDivElement>(null);

  // Virtual scrolling configuration
  const rowVirtualizer = useVirtualizer({
    count: threads.length + (hasNextPage ? 1 : 0),
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72, // Estimated height of each thread row
    overscan: 5, // Render 5 extra items above and below viewport
  });

  // Infinite scroll: load more when near bottom
  // Optimized to avoid running on every virtual item change
  const virtualItems = rowVirtualizer.getVirtualItems();
  
  useEffect(() => {
    const [lastItem] = [...virtualItems].reverse();

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
    virtualItems.length, // Only depend on length, not the array itself
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
                  onSelect={onThreadSelect}
                  onCheckToggle={onThreadCheckToggle}
                  starMutation={starMutation}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});
VirtualizedThreadList.displayName = 'VirtualizedThreadList';

// Thread Row Component (Memoized for performance)
// Optimized to prevent all rows re-rendering when selection changes
const ThreadRow = React.memo(({
  thread,
  isSelected,
  isChecked,
  onSelect,
  onCheckToggle,
  starMutation,
}: {
  thread: EmailThread;
  isSelected: boolean;
  isChecked: boolean;
  onSelect: (threadId: string) => void;
  onCheckToggle: (threadId: string, checked: boolean) => void;
  starMutation: any;
}) => {
  // Memoize handlers to maintain stability
  const handleSelect = useCallback(() => {
    onSelect(thread.id);
  }, [onSelect, thread.id]);

  // Optimized: Pass just ID and state, not the entire Set
  // This prevents re-renders when other checkboxes change
  const handleCheckChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    onCheckToggle(thread.id, e.target.checked);
  }, [onCheckToggle, thread.id]);

  const handleStarToggle = useCallback(() => {
    const message = thread.messages?.[0];
    if (message) {
      starMutation.mutate({ messageId: message.id, isStarred: !message.isStarred });
    }
  }, [starMutation, thread.messages]);
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
      onClick={handleSelect}
    >
      <input
        type="checkbox"
        className="accent-blue-600 rounded cursor-pointer"
        checked={isChecked}
        onChange={handleCheckChange}
      />

      <button
        className={cn(
          "transition-all focus:outline-none",
          isStarred ? "text-yellow-500" : "text-gray-300 group-hover:text-gray-400"
        )}
        onClick={(e) => {
          e.stopPropagation();
          handleStarToggle();
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

// Export with Error Boundary wrapper for resilience
export default function EmailClient() {
  return (
    <EmailErrorBoundary>
      <EmailClientInner />
    </EmailErrorBoundary>
  );
}
