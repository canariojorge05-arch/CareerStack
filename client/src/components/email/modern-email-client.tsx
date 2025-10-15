// @ts-nocheck - restart TS Server
import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { apiRequest } from '@/lib/queryClient';
import DOMPurify from 'dompurify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import {
  Search,
  Inbox,
  Send,
  FileText,
  Star,
  Trash2,
  Archive,
  Tag,
  RefreshCw,
  MoreVertical,
  Pencil,
  Mail,
  Circle,
  ChevronLeft,
  Plus,
  Filter,
  Menu,
  Reply,
  ReplyAll,
  Forward,
  Paperclip,
  Download,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { AccountSwitcher } from './account-switcher';
import { EmailEditor, EmailData } from './email-editor';
import { accountSwitchingService, EmailAccount } from '@/services/accountSwitchingService';

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

export default function ModernEmailClient() {
  const { isAuthenticated } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedFolder, setSelectedFolder] = useState('inbox');
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [composeOpen, setComposeOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [replyMode, setReplyMode] = useState<'reply' | 'replyAll' | 'forward' | null>(null);
  const [replyToMessage, setReplyToMessage] = useState<EmailMessage | null>(null);
  const queryClient = useQueryClient();

  const { data: accountsData } = useQuery({
    queryKey: ['/api/email/accounts'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/email/accounts');
      if (!response.ok) return { accounts: [] };
      const data = await response.json();
      return data;
    },
    enabled: isAuthenticated === true,
    staleTime: 5 * 60 * 1000,
  });

  const emailAccounts: EmailAccount[] = accountsData?.accounts || [];

  useEffect(() => {
    if (emailAccounts.length > 0 && !selectedAccountId) {
      const defaultAccount = emailAccounts.find((acc) => acc.isDefault) || emailAccounts[0];
      setSelectedAccountId(defaultAccount.id);
      accountSwitchingService.setSelectedAccount(defaultAccount.id);
    }
  }, [emailAccounts]);

  const {
    data: emailThreadsData,
    isLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['/api/marketing/emails/threads', selectedFolder, searchQuery, selectedAccountId],
    queryFn: async ({ pageParam = 0 }) => {
      const limit = 50;
      let endpoint = searchQuery.trim()
        ? `/api/marketing/emails/search?q=${encodeURIComponent(
            searchQuery
          )}&limit=${limit}&offset=${pageParam}`
        : `/api/marketing/emails/threads?type=${selectedFolder}&limit=${limit}&offset=${pageParam}`;

      if (selectedAccountId) {
        endpoint += `&accountId=${selectedAccountId}`;
      }

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
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: 0,
    enabled: isAuthenticated === true,
    staleTime: 1 * 60 * 1000,
  });

  const emailThreads = useMemo(() => {
    if (!emailThreadsData?.pages) return [];
    return emailThreadsData.pages.flatMap((page) => page.threads || []);
  }, [emailThreadsData]);

  const { data: threadMessages = [], isLoading: messagesLoading } = useQuery<EmailMessage[]>({
    queryKey: ['/api/marketing/emails/threads', selectedThread, 'messages'],
    queryFn: async () => {
      if (!selectedThread) return [];
      const response = await apiRequest(
        'GET',
        `/api/marketing/emails/threads/${selectedThread}/messages`
      );
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!selectedThread && isAuthenticated === true,
  });

  const archiveMutation = useMutation({
    mutationFn: async (threadId: string) => {
      const response = await apiRequest(
        'PATCH',
        `/api/marketing/emails/threads/${threadId}/archive`,
        { isArchived: true }
      );
      if (!response.ok) throw new Error('Failed');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/emails/threads'] });
      setSelectedThread(null);
      toast.success('Conversation archived');
    },
  });

  const starMutation = useMutation({
    mutationFn: async ({ messageId, isStarred }: { messageId: string; isStarred: boolean }) => {
      const response = await apiRequest(
        'PATCH',
        `/api/marketing/emails/messages/${messageId}/star`,
        { isStarred }
      );
      if (!response.ok) throw new Error('Failed');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/emails/threads'] });
    },
  });

  const deleteThreadMutation = useMutation({
    mutationFn: async (threadId: string) => {
      const response = await apiRequest('DELETE', `/api/marketing/emails/threads/${threadId}`);
      if (!response.ok) throw new Error('Failed');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/emails/threads'] });
      setSelectedThread(null);
      toast.success('Conversation deleted');
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const response = await apiRequest(
        'PATCH',
        `/api/marketing/emails/messages/${messageId}/read`,
        { isRead: true }
      );
      if (!response.ok) throw new Error('Failed');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/emails/threads'] });
    },
  });

  const sendEmailMutation = useMutation({
    mutationFn: async (data: EmailData) => {
      if (!selectedAccountId) throw new Error('No account selected');

      const response = await apiRequest('POST', '/api/email/send', {
        accountId: selectedAccountId,
        ...data,
      });

      if (!response.ok) throw new Error('Failed to send');
      return response.json();
    },
    onSuccess: () => {
      toast.success('Email sent!');
      setComposeOpen(false);
      setReplyMode(null);
      setReplyToMessage(null);
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to send email');
    },
  });

  const handleReply = (message: EmailMessage) => {
    setReplyMode('reply');
    setReplyToMessage(message);
    setComposeOpen(true);
  };

  const handleReplyAll = (message: EmailMessage) => {
    setReplyMode('replyAll');
    setReplyToMessage(message);
    setComposeOpen(true);
  };

  const handleForward = (message: EmailMessage) => {
    setReplyMode('forward');
    setReplyToMessage(message);
    setComposeOpen(true);
  };

  const getInitials = (email: string) => {
    const name = email.split('@')[0];
    return name.slice(0, 2).toUpperCase();
  };

  const folders = [
    {
      id: 'inbox',
      label: 'Inbox',
      icon: Inbox,
      count: emailThreads.filter((t) => !t.isArchived).length,
    },
    { id: 'sent', label: 'Sent', icon: Send, count: 0 },
    { id: 'drafts', label: 'Drafts', icon: FileText, count: 0 },
    { id: 'starred', label: 'Starred', icon: Star, count: 0 },
    {
      id: 'archived',
      label: 'Archived',
      icon: Archive,
      count: emailThreads.filter((t) => t.isArchived).length,
    },
    { id: 'trash', label: 'Trash', icon: Trash2, count: 0 },
  ];

  return (
    <div className="flex h-full bg-gray-50">
      {/* Sidebar */}
      <div
        className={cn(
          'flex flex-col bg-white border-r border-gray-200 transition-all duration-300',
          sidebarOpen ? 'w-64' : 'w-0 overflow-hidden'
        )}
      >
        <div className="p-4 border-b">
          <Button
            onClick={() => setComposeOpen(true)}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium"
            size="lg"
          >
            <Pencil className="h-4 w-4 mr-2" />
            Compose
          </Button>
        </div>

        <div className="p-4">
          <AccountSwitcher
            accounts={emailAccounts}
            onAccountSelect={setSelectedAccountId}
            onAddAccount={() => (window.location.href = '/email?add_account=true')}
            onManageAccounts={() => toast.info('Account settings coming soon')}
          />
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2">
            {folders.map((folder) => (
              <button
                key={folder.id}
                onClick={() => setSelectedFolder(folder.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left',
                  selectedFolder === folder.id
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                )}
              >
                <folder.icon className="h-5 w-5 flex-shrink-0" />
                <span className="flex-1">{folder.label}</span>
                {folder.count > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {folder.count}
                  </Badge>
                )}
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 p-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <Menu className="h-5 w-5" />
            </Button>

            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search emails..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-gray-50 border-gray-200"
              />
            </div>

            <Button variant="ghost" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Thread List */}
          <div className="w-96 border-r border-gray-200 bg-white overflow-auto">
            {isLoading ? (
              <div className="p-8 text-center text-gray-500">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
                <p>Loading emails...</p>
              </div>
            ) : emailThreads.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Mail className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p className="font-medium">No emails found</p>
                <p className="text-sm">Your inbox is empty</p>
              </div>
            ) : (
              <div>
                {emailThreads.map((thread) => (
                  <div
                    key={thread.id}
                    onClick={() => setSelectedThread(thread.id)}
                    className={cn(
                      'p-4 border-b border-gray-100 cursor-pointer transition-colors',
                      selectedThread === thread.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10 flex-shrink-0">
                        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-500 text-white text-sm">
                          {getInitials(thread.participantEmails[0] || 'U')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm truncate">
                            {thread.participantEmails[0]?.split('@')[0] || 'Unknown'}
                          </span>
                          <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                            {thread.lastMessageAt
                              ? formatDistanceToNow(new Date(thread.lastMessageAt), {
                                  addSuffix: true,
                                })
                              : 'Unknown'}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-gray-900 truncate mb-1">
                          {thread.subject || '(No subject)'}
                        </p>
                        <p className="text-sm text-gray-600 truncate">
                          {thread.preview || 'No preview available'}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          {thread.messageCount > 1 && (
                            <Badge variant="secondary" className="text-xs">
                              {thread.messageCount} messages
                            </Badge>
                          )}
                          {thread.labels && thread.labels.length > 0 && (
                            <Badge variant="outline" className="text-xs">
                              <Tag className="h-3 w-3 mr-1" />
                              {thread.labels[0]}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {hasNextPage && (
                  <div className="p-4 text-center">
                    <Button
                      variant="ghost"
                      onClick={() => fetchNextPage()}
                      disabled={isFetchingNextPage}
                    >
                      {isFetchingNextPage ? 'Loading...' : 'Load more'}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Message View */}
          <div className="flex-1 bg-white overflow-auto">
            {selectedThread && threadMessages.length > 0 ? (
              <div className="max-w-4xl mx-auto p-6">
                {/* Thread Header */}
                <div className="mb-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                        {threadMessages[0]?.subject || '(No subject)'}
                      </h2>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Badge variant="secondary">
                          {threadMessages.length}{' '}
                          {threadMessages.length === 1 ? 'message' : 'messages'}
                        </Badge>
                        <span>·</span>
                        <span>
                          {threadMessages[0]?.sentAt
                            ? formatDistanceToNow(new Date(threadMessages[0].sentAt), {
                                addSuffix: true,
                              })
                            : 'Unknown time'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => archiveMutation.mutate(selectedThread)}
                      >
                        <Archive className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteThreadMutation.mutate(selectedThread)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedThread(null)}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Messages */}
                <div className="space-y-6">
                  {threadMessages.map((message) => (
                    <div
                      key={message.id}
                      className="border border-gray-200 rounded-lg overflow-hidden"
                    >
                      <div className="bg-gray-50 p-4 border-b border-gray-200">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3 flex-1">
                            <Avatar className="h-10 w-10">
                              <AvatarFallback className="bg-gradient-to-br from-green-500 to-blue-500 text-white">
                                {getInitials(message.fromEmail)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-sm">{message.fromEmail}</span>
                                <span className="text-xs text-gray-500">
                                  {message.sentAt
                                    ? formatDistanceToNow(new Date(message.sentAt), {
                                        addSuffix: true,
                                      })
                                    : 'Unknown'}
                                </span>
                              </div>
                              <p className="text-xs text-gray-600">
                                To: {message.toEmails.join(', ')}
                              </p>
                              {message.ccEmails.length > 0 && (
                                <p className="text-xs text-gray-600">
                                  Cc: {message.ccEmails.join(', ')}
                                </p>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              starMutation.mutate({
                                messageId: message.id,
                                isStarred: !message.isStarred,
                              })
                            }
                          >
                            <Star
                              className={cn(
                                'h-4 w-4',
                                message.isStarred && 'fill-yellow-400 text-yellow-400'
                              )}
                            />
                          </Button>
                        </div>
                      </div>
                      <div
                        className="p-6 prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{
                          __html: DOMPurify.sanitize(message.htmlBody || message.textBody || ''),
                        }}
                      />
                      <div className="bg-gray-50 p-4 border-t border-gray-200">
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleReply(message)}>
                            <Reply className="h-4 w-4 mr-1" />
                            Reply
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReplyAll(message)}
                          >
                            <ReplyAll className="h-4 w-4 mr-1" />
                            Reply All
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleForward(message)}
                          >
                            <Forward className="h-4 w-4 mr-1" />
                            Forward
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <Mail className="h-16 w-16 mx-auto mb-4 opacity-20" />
                  <p className="text-lg font-medium">No message selected</p>
                  <p className="text-sm">Choose an email from the list to read</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Compose Sheet */}
      <Sheet open={composeOpen} onOpenChange={setComposeOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl p-0">
          <EmailEditor
            onClose={() => {
              setComposeOpen(false);
              setReplyMode(null);
              setReplyToMessage(null);
            }}
            onSend={async (data) => {
              await sendEmailMutation.mutateAsync(data);
            }}
            replyTo={replyMode === 'reply' || replyMode === 'replyAll' ? replyToMessage : undefined}
            replyAll={replyMode === 'replyAll'}
            forward={replyMode === 'forward' ? replyToMessage : undefined}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
