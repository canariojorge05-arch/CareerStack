import React, { useRef, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { format } from 'date-fns';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Star, Reply, MoreVertical, Paperclip, Download, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EmailContent } from './email-content';
import { EmailMessage } from '@/types/email';

interface VirtualizedEmailMessagesProps {
  messages: EmailMessage[];
  onStarToggle: (messageId: string, isStarred: boolean) => void;
  onReply: (message: EmailMessage) => void;
  getInitials: (email: string) => string;
}

export const VirtualizedEmailMessages: React.FC<VirtualizedEmailMessagesProps> = ({
  messages,
  onStarToggle,
  onReply,
  getInitials,
}) => {
  const parentRef = useRef<HTMLDivElement>(null);

  // Virtual scrolling for messages - HIGHLY OPTIMIZED
  const rowVirtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback((index: number) => {
      // Optimized size estimation
      const message = messages[index];
      let estimate = 200; // Base size

      // Add height for HTML content (rough estimate)
      if (message.htmlBody) {
        const contentLength = message.htmlBody.length;
        estimate += Math.min(contentLength / 100, 400); // Cap at 600px total
      } else if (message.textBody) {
        const lineCount = message.textBody.split('\n').length;
        estimate += Math.min(lineCount * 20, 400);
      }

      // Add height for attachments
      if (message.attachments && message.attachments.length > 0) {
        estimate += 120; // Attachment section
      }

      return estimate;
    }, [messages]),
    overscan: 8, // Increased from 5 to 8 for smoother scrolling
    measureElement: typeof window !== 'undefined' && navigator.userAgent.indexOf('Firefox') === -1
      ? element => element?.getBoundingClientRect().height
      : undefined,
  });

  return (
    <div
      ref={parentRef}
      className="flex-1 overflow-auto px-6 py-4"
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
          const message = messages[virtualRow.index];
          const isLastMessage = virtualRow.index === messages.length - 1;

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
              <div
                className={cn(
                  "rounded-lg bg-white transition-all border border-gray-200 mb-4",
                  isLastMessage && "ring-2 ring-blue-100 border-blue-200 shadow-md"
                )}
              >
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
                                onClick={() => onStarToggle(message.id, !message.isStarred)}
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
                                onClick={() => onReply(message)}
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

                  <EmailContent htmlBody={message.htmlBody} textBody={message.textBody} />

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
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
