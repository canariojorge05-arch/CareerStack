import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Paperclip,
  Send,
  X,
  Plus,
  Minimize2,
  Maximize2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface EmailAccount {
  id: string;
  accountName: string;
  emailAddress: string;
  provider: 'gmail' | 'outlook' | 'smtp';
  isDefault: boolean;
  isActive: boolean;
}

interface ComposeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  replyTo?: {
    threadId: string;
    subject: string;
    fromEmail: string;
    toEmails: string[];
    ccEmails?: string[];
  };
  mode?: 'compose' | 'reply' | 'reply-all' | 'forward';
}

export default function ComposeDialog({ 
  open, 
  onOpenChange, 
  replyTo, 
  mode = 'compose' 
}: ComposeDialogProps) {
  const [to, setTo] = useState<string[]>(
    mode === 'reply' || mode === 'reply-all' 
      ? [replyTo?.fromEmail || ''] 
      : []
  );
  const [cc, setCc] = useState<string[]>(
    mode === 'reply-all' ? (replyTo?.toEmails || []) : []
  );
  const [bcc, setBcc] = useState<string[]>([]);
  const [subject, setSubject] = useState(
    replyTo?.subject ? 
      (mode === 'forward' ? `Fwd: ${replyTo.subject}` : `Re: ${replyTo.subject}`) 
      : ''
  );
  const [body, setBody] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [spamScore, setSpamScore] = useState<number | null>(null);
  const [spamWarnings, setSpamWarnings] = useState<string[]>([]);
  const [checkingSpam, setCheckingSpam] = useState(false);
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);
  
  const queryClient = useQueryClient();

  // Fetch rate limits
  const { data: rateLimits } = useQuery<any>({
    queryKey: ['/api/marketing/emails/rate-limits'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/marketing/emails/rate-limits');
      if (!response.ok) return null;
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch email accounts
  const { data: emailAccounts = [] } = useQuery<EmailAccount[]>({
    queryKey: ['/api/marketing/email-accounts'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/marketing/email-accounts');
      if (!response.ok) throw new Error('Failed to fetch email accounts');
      return response.json();
    },
  });

  // Set default account when accounts are loaded
  React.useEffect(() => {
    if (emailAccounts.length > 0 && !selectedAccount) {
      const defaultAccount = emailAccounts.find(acc => acc.isDefault) || emailAccounts[0];
      setSelectedAccount(defaultAccount.id);
    }
  }, [emailAccounts, selectedAccount]);

  // Send email mutation
  const sendMutation = useMutation({
    mutationFn: async (emailData: any) => {
      const formData = new FormData();
      
      // Add email data (append multiple values for array fields)
      to.forEach((addr) => formData.append('to', addr));
      cc.forEach((addr) => formData.append('cc', addr));
      bcc.forEach((addr) => formData.append('bcc', addr));
      formData.append('subject', subject);
      formData.append('textBody', body);
      formData.append('htmlBody', body.replace(/\n/g, '<br>'));
      formData.append('accountId', selectedAccount);
      
      if (replyTo?.threadId) {
        formData.append('threadId', replyTo.threadId);
      }

      // Add attachments
      attachments.forEach((file) => {
        formData.append('attachments', file);
      });

      // CSRF token for state-changing request
      const csrfToken = document.cookie
        .split('; ')
        .find(r => r.startsWith('csrf_token='))
        ?.split('=')[1] || '';

      const response = await fetch('/api/marketing/emails/send', {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers: {
          'X-CSRF-Token': csrfToken,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to send email');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/emails/threads'] });
      onOpenChange(false);
      toast.success('Email sent successfully!');
      
      // Reset form
      setTo([]);
      setCc([]);
      setBcc([]);
      setSubject('');
      setBody('');
      setAttachments([]);
    },
    onError: (error: any) => {
      const errorMessage = error?.message || 'Failed to send email';
      
      // Check if it's a rate limit error
      if (errorMessage.includes('Rate limit') || errorMessage.includes('limit reached')) {
        setRateLimitError(errorMessage);
        toast.error('Rate limit exceeded. Please wait before sending more emails.', { duration: 5000 });
      } else if (errorMessage.includes('spam score')) {
        toast.error('Email blocked due to high spam score. Please review and fix the issues.', { duration: 5000 });
      } else {
        toast.error(errorMessage, { duration: 4000 });
      }
      console.error('Send email error:', error);
    },
  });

  // Check spam score before sending
  const checkSpamScore = async () => {
    if (!selectedAccount || !subject || !body) return;

    setCheckingSpam(true);
    try {
      const account = emailAccounts.find(acc => acc.id === selectedAccount);
      if (!account) return;

      const response = await apiRequest('POST', '/api/marketing/emails/check-deliverability', {
        subject,
        htmlBody: body.replace(/\n/g, '<br>'),
        textBody: body,
        fromEmail: account.emailAddress
      });

      if (response.ok) {
        const data = await response.json();
        setSpamScore(data.spamScore);
        setSpamWarnings(data.issues || []);
        
        if (data.spamScore >= 5) {
          toast.warning(`Spam score: ${data.spamScore}/10 - Your email may be marked as spam`, {
            duration: 5000
          });
        } else if (data.spamScore >= 3) {
          toast.info(`Spam score: ${data.spamScore}/10 - Some improvements recommended`, {
            duration: 3000
          });
        }
      }
    } catch (error) {
      console.error('Failed to check spam score:', error);
    } finally {
      setCheckingSpam(false);
    }
  };

  // Check spam score when content changes (debounced)
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (subject && body && selectedAccount) {
        checkSpamScore();
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [subject, body, selectedAccount]);

  const handleSend = () => {
    if (to.length === 0) {
      toast.error('Please add at least one recipient');
      return;
    }
    if (!subject.trim()) {
      toast.error('Please add a subject');
      return;
    }
    if (!body.trim()) {
      toast.error('Please add a message');
      return;
    }
    if (!selectedAccount) {
      toast.error('Please select an email account');
      return;
    }

    // Warn if spam score is high
    if (spamScore !== null && spamScore >= 6) {
      if (!confirm(`Your email has a high spam score (${spamScore}/10). It may be marked as spam. Send anyway?`)) {
        return;
      }
    }

    sendMutation.mutate({});
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setAttachments(prev => [...prev, ...files]);
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const addRecipient = (type: 'to' | 'cc' | 'bcc', email: string) => {
    if (!email.trim()) return;
    
    const setter = type === 'to' ? setTo : type === 'cc' ? setCc : setBcc;
    setter(prev => [...prev, email.trim()]);
  };

  const removeRecipient = (type: 'to' | 'cc' | 'bcc', index: number) => {
    const setter = type === 'to' ? setTo : type === 'cc' ? setCc : setBcc;
    setter(prev => prev.filter((_, i) => i !== index));
  };

  const RecipientField = ({ 
    label, 
    type, 
    recipients, 
    placeholder 
  }: { 
    label: string; 
    type: 'to' | 'cc' | 'bcc'; 
    recipients: string[]; 
    placeholder: string;
  }) => {
    const [inputValue, setInputValue] = useState('');

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        addRecipient(type, inputValue);
        setInputValue('');
      }
    };

    return (
      <div className="flex items-start gap-2">
        <Label className="text-sm font-medium text-gray-600 w-12 pt-2">{label}:</Label>
        <div className="flex-1">
          <div className="flex flex-wrap gap-1 mb-1">
            {recipients.map((email, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {email}
                <button
                  onClick={() => removeRecipient(type, index)}
                  className="ml-1 hover:text-red-500"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              if (inputValue.trim()) {
                addRecipient(type, inputValue);
                setInputValue('');
              }
            }}
            placeholder={placeholder}
            className="border-none shadow-none p-0 h-8 focus-visible:ring-0"
          />
        </div>
      </div>
    );
  };

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={() => setIsMinimized(false)}
          className="bg-blue-600 hover:bg-blue-700 shadow-lg"
        >
          <Maximize2 className="h-4 w-4 mr-2" />
          Compose
        </Button>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0">
        <div className="flex flex-col h-full">
          {/* Header */}
          <DialogHeader className="px-6 py-4 border-b bg-gray-50">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg font-semibold">
                {mode === 'reply' ? 'Reply' : 
                 mode === 'reply-all' ? 'Reply All' : 
                 mode === 'forward' ? 'Forward' : 'New Message'}
              </DialogTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsMinimized(true)}
                >
                  <Minimize2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <DialogDescription className="sr-only">
              Compose or reply to emails, add recipients, subject, body and attachments
            </DialogDescription>
          </DialogHeader>

          {/* Content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium text-gray-600 w-12">From:</Label>
                <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {emailAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{account.accountName}</span>
                          <span className="text-gray-500">({account.emailAddress})</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Recipients */}
              <div className="space-y-2">
                <RecipientField
                  label="To"
                  type="to"
                  recipients={to}
                  placeholder="Enter email addresses..."
                />
                
                {showCc && (
                  <RecipientField
                    label="Cc"
                    type="cc"
                    recipients={cc}
                    placeholder="Enter CC recipients..."
                  />
                )}
                
                {showBcc && (
                  <RecipientField
                    label="Bcc"
                    type="bcc"
                    recipients={bcc}
                    placeholder="Enter BCC recipients..."
                  />
                )}

                <div className="flex gap-2 ml-14">
                  {!showCc && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowCc(true)}
                      className="text-xs text-blue-600 hover:text-blue-700 p-0 h-auto"
                    >
                      Cc
                    </Button>
                  )}
                  {!showBcc && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowBcc(true)}
                      className="text-xs text-blue-600 hover:text-blue-700 p-0 h-auto"
                    >
                      Bcc
                    </Button>
                  )}
                </div>
              </div>

              {/* Subject */}
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium text-gray-600 w-12">Subject:</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Enter subject..."
                  className="flex-1"
                />
              </div>

              {/* Attachments */}
              {attachments.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-600">Attachments:</Label>
                  <div className="flex flex-wrap gap-2">
                    {attachments.map((file, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        <Paperclip className="h-3 w-3 mr-1" />
                        {file.name}
                        <button
                          onClick={() => removeAttachment(index)}
                          className="ml-1 hover:text-red-500"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Message Body */}
            <div className="flex-1 px-6 pb-4">
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your message..."
                className="h-full min-h-[200px] resize-none"
              />
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t bg-gray-50">
              {/* Rate Limit Warning */}
              {rateLimitError && (
                <div className="mb-3 p-3 rounded-lg text-sm bg-orange-50 border border-orange-200">
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-5 rounded-full bg-orange-600 text-white flex items-center justify-center flex-shrink-0">
                      <X className="h-3 w-3" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-orange-700">Rate Limit Exceeded</p>
                      <p className="text-xs text-orange-600 mt-1">{rateLimitError}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Rate Limit Info */}
              {rateLimits && (
                <div className="mb-3 p-2 rounded-lg text-xs bg-blue-50 border border-blue-200">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-blue-700 font-medium">📊 Email Usage</span>
                    <span className="text-blue-600">
                      🛡️ Spam Protection: Active
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-blue-600">
                      Today: {rateLimits.daily.count}/{rateLimits.daily.limit}
                    </span>
                    <span className="text-blue-600">
                      This hour: {rateLimits.hourly.count}/{rateLimits.hourly.limit}
                    </span>
                  </div>
                </div>
              )}

              {/* Spam Score Indicator */}
              {spamScore !== null && (
                <div className={cn(
                  "mb-3 p-3 rounded-lg text-sm",
                  spamScore < 3 ? "bg-green-50 border border-green-200" :
                  spamScore < 5 ? "bg-yellow-50 border border-yellow-200" :
                  "bg-red-50 border border-red-200"
                )}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={cn(
                      "font-medium",
                      spamScore < 3 ? "text-green-700" :
                      spamScore < 5 ? "text-yellow-700" :
                      "text-red-700"
                    )}>
                      Spam Score: {spamScore.toFixed(1)}/10
                    </span>
                    <span className={cn(
                      "text-xs px-2 py-0.5 rounded",
                      spamScore < 3 ? "bg-green-100 text-green-700" :
                      spamScore < 5 ? "bg-yellow-100 text-yellow-700" :
                      "bg-red-100 text-red-700"
                    )}>
                      {spamScore < 3 ? "Excellent" : spamScore < 5 ? "Good" : "Poor"}
                    </span>
                  </div>
                  {spamWarnings.length > 0 && (
                    <ul className={cn(
                      "text-xs mt-2 space-y-1",
                      spamScore < 3 ? "text-green-600" :
                      spamScore < 5 ? "text-yellow-600" :
                      "text-red-600"
                    )}>
                      {spamWarnings.slice(0, 3).map((warning, idx) => (
                        <li key={idx}>• {warning}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleSend}
                    disabled={sendMutation.isPending || checkingSpam}
                    className={cn(
                      "bg-blue-600 hover:bg-blue-700",
                      spamScore !== null && spamScore >= 6 && "bg-orange-600 hover:bg-orange-700"
                    )}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {sendMutation.isPending ? 'Sending...' : checkingSpam ? 'Checking...' : 'Send'}
                  </Button>
                  
                  <label htmlFor="file-upload">
                    <Button variant="ghost" size="sm" asChild>
                      <span className="cursor-pointer">
                        <Paperclip className="h-4 w-4" />
                      </span>
                    </Button>
                  </label>
                  <input
                    id="file-upload"
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>

                <div className="text-xs text-gray-500">
                  {checkingSpam ? 'Checking deliverability...' : 'Press Ctrl+Enter to send'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
