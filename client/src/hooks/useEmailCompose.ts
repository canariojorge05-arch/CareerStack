/**
 * Custom Hook: useEmailCompose
 * 
 * Manages the compose email modal state and auto-save functionality.
 * Extracted from the monolithic EmailClient component.
 */

import { useState, useCallback, useEffect } from 'react';
import { EmailMessage } from '@/types/email';

export interface ComposeState {
  isOpen: boolean;
  to: string;
  subject: string;
  body: string;
  attachments: File[];
}

export interface UseEmailComposeReturn {
  state: ComposeState;
  openCompose: (data?: Partial<ComposeState>) => void;
  closeCompose: () => void;
  updateCompose: (updates: Partial<ComposeState>) => void;
  setTo: (to: string) => void;
  setSubject: (subject: string) => void;
  setBody: (body: string) => void;
  addAttachments: (files: File[]) => void;
  removeAttachment: (index: number) => void;
  openReply: (message: EmailMessage) => void;
  openReplyAll: (message: EmailMessage) => void;
  openForward: (message: EmailMessage) => void;
}

export function useEmailCompose(): UseEmailComposeReturn {
  const [state, setState] = useState<ComposeState>({
    isOpen: false,
    to: '',
    subject: '',
    body: '',
    attachments: [],
  });

  const openCompose = useCallback((data?: Partial<ComposeState>) => {
    setState(prev => ({ 
      ...prev, 
      isOpen: true, 
      ...data 
    }));
  }, []);

  const closeCompose = useCallback(() => {
    setState({
      isOpen: false,
      to: '',
      subject: '',
      body: '',
      attachments: [],
    });
    // Clear draft when closing
    localStorage.removeItem('emailDraft');
  }, []);

  const updateCompose = useCallback((updates: Partial<ComposeState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // Convenience setters
  const setTo = useCallback((to: string) => updateCompose({ to }), [updateCompose]);
  const setSubject = useCallback((subject: string) => updateCompose({ subject }), [updateCompose]);
  const setBody = useCallback((body: string) => updateCompose({ body }), [updateCompose]);
  
  const addAttachments = useCallback((files: File[]) => {
    setState(prev => ({
      ...prev,
      attachments: [...prev.attachments, ...files]
    }));
  }, []);

  const removeAttachment = useCallback((index: number) => {
    setState(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }));
  }, []);

  const openReply = useCallback((message: EmailMessage) => {
    openCompose({
      to: message.fromEmail,
      subject: message.subject.startsWith('Re:') ? message.subject : `Re: ${message.subject}`,
      body: '',
    });
  }, [openCompose]);

  const openReplyAll = useCallback((message: EmailMessage) => {
    const allRecipients = [message.fromEmail, ...message.toEmails].filter((email, index, self) => 
      self.indexOf(email) === index
    );
    openCompose({
      to: allRecipients.join(', '),
      subject: message.subject.startsWith('Re:') ? message.subject : `Re: ${message.subject}`,
      body: '',
    });
  }, [openCompose]);

  const openForward = useCallback((message: EmailMessage) => {
    openCompose({
      to: '',
      subject: message.subject.startsWith('Fwd:') ? message.subject : `Fwd: ${message.subject}`,
      body: message.htmlBody || message.textBody || '',
    });
  }, [openCompose]);

  // Auto-save draft every 30 seconds
  useEffect(() => {
    if (!state.isOpen) return;

    const timer = setInterval(() => {
      if (state.to || state.subject || state.body) {
        localStorage.setItem('emailDraft', JSON.stringify({
          to: state.to,
          subject: state.subject,
          body: state.body,
          attachments: state.attachments.map(f => f.name),
          savedAt: new Date().toISOString(),
        }));
      }
    }, 30000);

    return () => clearInterval(timer);
  }, [state]);

  return {
    state,
    openCompose,
    closeCompose,
    updateCompose,
    setTo,
    setSubject,
    setBody,
    addAttachments,
    removeAttachment,
    openReply,
    openReplyAll,
    openForward,
  };
}
