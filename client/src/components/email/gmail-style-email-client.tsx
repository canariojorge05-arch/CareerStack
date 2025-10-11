import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow, format } from 'date-fns';
import { apiRequest } from '@/lib/queryClient';
import DOMPurify from 'dompurify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { 
  Menu, Search, Settings, HelpCircle, Mail, Inbox, Send, FileText, Star, Trash2,
  Archive, Clock, Tag, RefreshCw, ChevronDown, ChevronLeft, ChevronRight,
  MoreVertical, Pencil, Check, X, AlertCircle, Filter, Users, 
  Reply, ReplyAll, Forward, Paperclip, Image, Link, Smile, AtSign,
  Download, Flag, Eye, EyeOff, MailOpen, CircleDot, Circle, ArrowLeft
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useLocation } from 'wouter';

interface EmailAccount {
  id: string;
  accountName: string;
  emailAddress: string;
  provider: string;
  isActive: boolean;
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
}

export default function GmailStyleEmailClient() {
  const [, navigate] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedFolder, setSelectedFolder] = useState('inbox');
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [composeOpen, setComposeOpen] = useState(false);
  const [accountsOpen, setAccountsOpen] = useState(false);
  const [selectedThreads, setSelectedThreads] = useState<Set<string>>(new Set());
  
  const queryClient = useQueryClient();

  // Fetch email accounts
  const { data: emailAccountsData, isError: accountsError } = useQuery({
    queryKey: ['/api/email/accounts'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/email/accounts');
      const data = await response.json();
      return data.accounts || [];
    },
  });
  
  const emailAccounts = emailAccountsData || [];

  // Fetch email threads
  const { data: emailThreads = [], isLoading, refetch } = useQuery<EmailThread[]>({
    queryKey: ['/api/marketing/emails/threads', selectedFolder, searchQuery],
    queryFn: async () => {
      try {
        const endpoint = searchQuery.trim()
          ? `/api/marketing/emails/search?q=${encodeURIComponent(searchQuery)}`
          : `/api/marketing/emails/threads?type=${selectedFolder}`;
        
        const response = await apiRequest('GET', endpoint);
        if (!response.ok) return [];
        
        const data = await response.json();
        return Array.isArray(data) ? data : data.threads || [];
      } catch {
        return [];
      }
    },
  });

  // Fetch messages for selected thread
  const { data: threadMessages = [] } = useQuery<EmailMessage[]>({
    queryKey: ['/api/marketing/emails/threads', selectedThread, 'messages'],
    queryFn: async () => {
      if (!selectedThread) return [];
      const response = await apiRequest('GET', `/api/marketing/emails/threads/${selectedThread}/messages`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!selectedThread,
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
      toast.success('Updated');
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
      toast.success('Archived');
      setSelectedThread(null);
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

  // OAuth handlers
  const handleConnectAccount = async (provider: 'gmail' | 'outlook') => {
    try {
      const endpoint = provider === 'gmail' 
        ? '/api/email/gmail/auth-url'
        : '/api/email/outlook/auth-url';
      
      const response = await apiRequest('GET', endpoint);
      if (response.ok) {
        const { authUrl } = await response.json();
        const popup = window.open(authUrl, `${provider}-oauth`, 'width=500,height=600');
        
        const handleMessage = (event: MessageEvent) => {
          if (event.data.type === `${provider.toUpperCase()}_OAUTH_SUCCESS`) {
            queryClient.invalidateQueries({ queryKey: ['/api/email/accounts'] });
            window.removeEventListener('message', handleMessage);
            popup?.close();
            toast.success(`${provider.charAt(0).toUpperCase() + provider.slice(1)} connected!`);
            setAccountsOpen(false);
          }
        };
        
        window.addEventListener('message', handleMessage);
      }
    } catch (error) {
      toast.error('Failed to connect account');
    }
  };

  const handleRemoveAccount = (accountId: string, accountName: string) => {
    if (confirm(`Are you sure you want to remove ${accountName}?`)) {
      deleteAccountMutation.mutate(accountId);
    }
  };

  const getInitials = (email: string) => {
    return email.split('@')[0].slice(0, 2).toUpperCase();
  };

  const folders = [
    { id: 'inbox', name: 'Inbox', icon: Inbox, count: emailThreads.filter((t: EmailThread) => !t.isArchived).length },
    { id: 'starred', name: 'Starred', icon: Star, count: 0 },
    { id: 'snoozed', name: 'Snoozed', icon: Clock, count: 0 },
    { id: 'sent', name: 'Sent', icon: Send, count: 0 },
    { id: 'drafts', name: 'Drafts', icon: FileText, count: 0 },
    { id: 'archived', name: 'Archived', icon: Archive, count: 0 },
    { id: 'trash', name: 'Trash', icon: Trash2, count: 0 },
  ];

  return (
    <TooltipProvider>
      <div className="flex flex-col h-screen bg-white">
        {/* Gmail-style Top Bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate('/dashboard')}
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
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Mail className="h-6 w-6 text-red-500" />
              <span className="text-xl text-gray-700 font-normal">Mail</span>
            </div>
          </div>

          {/* Gmail-style Search */}
          <div className="flex-1 max-w-2xl mx-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                placeholder="Search mail"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-gray-100 border-0 focus:bg-white focus:ring-1 focus:ring-gray-300 rounded-lg"
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2"
              >
                <Filter className="h-4 w-4 text-gray-500" />
              </Button>
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => setAccountsOpen(true)}>
                  <Settings className="h-5 w-5 text-gray-600" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Settings</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon">
                  <HelpCircle className="h-5 w-5 text-gray-600" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Help</TooltipContent>
            </Tooltip>
            <Avatar className="h-8 w-8 ml-2">
              <AvatarFallback className="bg-blue-500 text-white text-xs">
                {emailAccounts[0]?.emailAddress ? getInitials(emailAccounts[0].emailAddress) : 'U'}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Gmail-style Sidebar */}
          <div className={cn(
            "border-r border-gray-200 bg-white transition-all duration-300 flex flex-col",
            sidebarOpen ? "w-64" : "w-0 opacity-0"
          )}>
            {sidebarOpen && (
              <>
                <div className="p-2">
                  <Button
                    onClick={() => setComposeOpen(true)}
                    className="w-full justify-start gap-3 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 shadow-sm rounded-2xl h-14"
                  >
                    <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-2 rounded-full">
                      <Pencil className="h-5 w-5 text-white" />
                    </div>
                    <span className="font-medium">Compose</span>
                  </Button>
                </div>

                <ScrollArea className="flex-1">
                  <div className="p-2 space-y-1">
                    {folders.map((folder) => (
                      <Button
                        key={folder.id}
                        variant="ghost"
                        className={cn(
                          "w-full justify-start gap-3 h-10 rounded-r-full hover:bg-gray-100",
                          selectedFolder === folder.id && "bg-red-50 hover:bg-red-100"
                        )}
                        onClick={() => setSelectedFolder(folder.id)}
                      >
                        <folder.icon className={cn(
                          "h-5 w-5",
                          selectedFolder === folder.id ? "text-red-600" : "text-gray-600"
                        )} />
                        <span className={cn(
                          "flex-1 text-left text-sm",
                          selectedFolder === folder.id ? "font-bold text-gray-900" : "font-normal text-gray-700"
                        )}>
                          {folder.name}
                        </span>
                        {folder.count > 0 && (
                          <span className="text-xs text-gray-600">{folder.count}</span>
                        )}
                      </Button>
                    ))}
                  </div>

                  <div className="px-2 py-4">
                    <div className="text-xs font-medium text-gray-500 px-3 mb-2">Labels</div>
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-3 h-9 text-gray-700 hover:bg-gray-100 rounded-r-full"
                    >
                      <Tag className="h-4 w-4" />
                      <span className="text-sm">Work</span>
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-3 h-9 text-gray-700 hover:bg-gray-100 rounded-r-full"
                    >
                      <Tag className="h-4 w-4" />
                      <span className="text-sm">Personal</span>
                    </Button>
                  </div>

                  {emailAccounts.length > 0 && (
                    <div className="px-2 py-2 border-t border-gray-200">
                      <div className="text-xs font-medium text-gray-500 px-3 mb-2">Accounts</div>
                      {emailAccounts.map((account: EmailAccount) => (
                        <div key={account.id} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700">
                          <div className={cn(
                            "h-2 w-2 rounded-full",
                            account.isActive ? "bg-green-500" : "bg-gray-300"
                          )} />
                          <span className="truncate">{account.emailAddress}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </>
            )}
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => refetch()}
                  disabled={isLoading}
                >
                  <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                </Button>
                {selectedThreads.size > 0 && (
                  <>
                    <Button variant="ghost" size="icon" onClick={() => {
                      selectedThreads.forEach(id => archiveMutation.mutate(id));
                      setSelectedThreads(new Set());
                    }}>
                      <Archive className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon">
                      <MailOpen className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
              <div className="text-sm text-gray-600">
                <span className="font-medium">{emailThreads.length}</span> {selectedFolder === 'inbox' ? 'emails' : 'items'}
              </div>
            </div>

            {/* Email List */}
            <ScrollArea className="flex-1">
              {isLoading ? (
                <div className="flex items-center justify-center h-64">
                  <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
                </div>
              ) : emailThreads.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                  <Inbox className="h-16 w-16 mb-4" />
                  <p className="text-lg">{searchQuery ? 'No emails found' : 'Your inbox is empty'}</p>
                  {emailAccounts.length === 0 && (
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => setAccountsOpen(true)}
                    >
                      Connect Account
                    </Button>
                  )}
                </div>
              ) : (
                <div>
                  {emailThreads.map((thread: EmailThread) => (
                    <div
                      key={thread.id}
                      className={cn(
                        "flex items-center gap-3 px-4 py-2 border-b border-gray-100 cursor-pointer hover:shadow-sm transition-all",
                        selectedThread === thread.id ? "bg-blue-50" : "hover:bg-gray-50",
                        thread.messages?.[0]?.isRead === false && "bg-white font-medium"
                      )}
                      onClick={() => setSelectedThread(thread.id)}
                    >
                      <input
                        type="checkbox"
                        className="accent-blue-600"
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
                          "transition-colors",
                          thread.messages?.[0]?.isStarred ? "text-yellow-400" : "text-gray-300 hover:text-yellow-400"
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          const message = thread.messages?.[0];
                          if (message) {
                            starMutation.mutate({ messageId: message.id, isStarred: !message.isStarred });
                          }
                        }}
                      >
                        <Star className={cn("h-4 w-4", thread.messages?.[0]?.isStarred && "fill-yellow-400")} />
                      </button>
                      <div className="flex-1 min-w-0 flex items-center gap-3">
                        <span className={cn(
                          "w-40 truncate text-sm",
                          thread.messages?.[0]?.isRead === false ? "font-bold" : "font-normal"
                        )}>
                          {thread.participantEmails[0]?.split('@')[0] || 'Unknown'}
                        </span>
                        <div className="flex-1 min-w-0 flex items-baseline gap-2">
                          <span className={cn(
                            "truncate text-sm",
                            thread.messages?.[0]?.isRead === false ? "font-bold" : "font-normal"
                          )}>
                            {thread.subject || '(no subject)'}
                          </span>
                          <span className="flex-shrink-0 text-sm text-gray-500">
                            - {thread.preview?.slice(0, 50)}...
                          </span>
                        </div>
                        <span className="flex-shrink-0 text-xs text-gray-500 ml-auto">
                          {thread.lastMessageAt && format(new Date(thread.lastMessageAt), 'MMM d')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Email Detail Pane */}
          {selectedThread && (
            <div className="w-2/5 border-l border-gray-200 flex flex-col bg-white">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => setSelectedThread(null)}>
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => archiveMutation.mutate(selectedThread)}>
                    <Archive className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon">
                    <MailOpen className="h-4 w-4" />
                  </Button>
                </div>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </div>

              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-normal text-gray-900 mb-1">
                  {threadMessages[0]?.subject || '(no subject)'}
                </h2>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">Inbox</Badge>
                </div>
              </div>

              <ScrollArea className="flex-1 px-6 py-4">
                {threadMessages.map((message, index) => (
                  <div key={message.id} className={cn("mb-6", index > 0 && "border-t border-gray-200 pt-6")}>
                    <div className="flex items-start gap-3 mb-4">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-blue-500 text-white text-sm">
                          {getInitials(message.fromEmail)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-gray-900">{message.fromEmail.split('@')[0]}</div>
                            <div className="text-sm text-gray-500">to {message.toEmails.join(', ')}</div>
                          </div>
                          <div className="text-xs text-gray-500">
                            {message.sentAt && format(new Date(message.sentAt), 'MMM d, yyyy, h:mm a')}
                          </div>
                        </div>
                      </div>
                    </div>
                    <EmailContent htmlBody={message.htmlBody} textBody={message.textBody} />
                    {index === threadMessages.length - 1 && (
                      <div className="flex gap-2 mt-4">
                        <Button variant="outline" size="sm">
                          <Reply className="h-4 w-4 mr-2" />
                          Reply
                        </Button>
                        <Button variant="outline" size="sm">
                          <Forward className="h-4 w-4 mr-2" />
                          Forward
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </ScrollArea>
            </div>
          )}
        </div>

        {/* Accounts Dialog */}
        <Dialog open={accountsOpen} onOpenChange={setAccountsOpen}>
          <DialogContent className="max-w-md">
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold mb-2">Email Accounts</h2>
                <p className="text-sm text-gray-600">Connect your email accounts to get started</p>
              </div>

              {emailAccounts.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Connected Accounts</h3>
                  {emailAccounts.map((account: EmailAccount) => (
                    <div key={account.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Mail className="h-5 w-5 text-red-500" />
                        <div>
                          <div className="font-medium text-sm">{account.accountName}</div>
                          <div className="text-xs text-gray-500">{account.emailAddress}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={account.isActive ? "default" : "secondary"}>
                          {account.isActive ? "Active" : "Inactive"}
                        </Badge>
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
              )}

              <div className="space-y-2">
                <h3 className="text-sm font-medium">Add Account</h3>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleConnectAccount('gmail')}
                    className="flex items-center gap-2"
                  >
                    <Mail className="h-4 w-4 text-red-500" />
                    Gmail
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleConnectAccount('outlook')}
                    className="flex items-center gap-2"
                  >
                    <Mail className="h-4 w-4 text-blue-500" />
                    Outlook
                  </Button>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-900 mb-1">
                      Secure OAuth Connection
                    </p>
                    <p className="text-xs text-blue-700">
                      We use OAuth 2.0 for secure authentication. Your password is never stored.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Compose Dialog - Simplified for now */}
        <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
          <DialogContent className="max-w-2xl">
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">New Message</h2>
              <div className="space-y-3">
                <Input placeholder="To" />
                <Input placeholder="Subject" />
                <textarea
                  className="w-full h-64 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Message"
                />
                <div className="flex justify-between">
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon">
                      <Paperclip className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon">
                      <Image className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon">
                      <Link className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setComposeOpen(false)}>Cancel</Button>
                    <Button className="bg-blue-600 hover:bg-blue-700">Send</Button>
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

// Email Content Component with Sanitization and Proper Styling
interface EmailContentProps {
  htmlBody: string | null;
  textBody: string | null;
}

function EmailContent({ htmlBody, textBody }: EmailContentProps) {
  // Sanitize HTML and configure DOMPurify
  const sanitizedHtml = useMemo(() => {
    if (!htmlBody) return null;

    // Configure DOMPurify to allow images, links and common email tags
    DOMPurify.addHook('afterSanitizeAttributes', (node) => {
      // Make all links open in new tab for security
      if (node.tagName === 'A') {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
      }
    });

    const clean = DOMPurify.sanitize(htmlBody, {
      ADD_TAGS: ['style', 'img', 'a', 'table', 'tbody', 'thead', 'tr', 'td', 'th'],
      ADD_ATTR: ['href', 'target', 'rel', 'style', 'class', 'src', 'alt', 'width', 'height', 'border', 'cellpadding', 'cellspacing', 'align', 'valign', 'bgcolor'],
      ALLOW_DATA_ATTR: true,
      FORCE_BODY: true,
      ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    });

    DOMPurify.removeHook('afterSanitizeAttributes');

    return clean;
  }, [htmlBody]);

  // Inject custom styles for email content
  useEffect(() => {
    if (!htmlBody) return;

    // Add styles for email content
    const style = document.createElement('style');
    style.textContent = `
      .email-content-wrapper {
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
        color: #2563eb !important;
        text-decoration: underline !important;
        cursor: pointer;
        display: inline;
      }

      .email-content-wrapper a:hover {
        color: #1d4ed8 !important;
        text-decoration: underline !important;
      }

      .email-content-wrapper a:visited {
        color: #7c3aed;
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
