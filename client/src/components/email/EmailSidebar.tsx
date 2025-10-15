/**
 * EmailSidebar Component
 * 
 * Handles the left sidebar with:
 * - Compose button
 * - Folder navigation
 * - Labels
 * - Connected accounts list
 * 
 * Extracted from the monolithic EmailClient to improve performance and maintainability.
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Pencil, Plus, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EmailAccount, EmailFolder } from '@/types/email';

interface EmailSidebarProps {
  isOpen: boolean;
  folders: EmailFolder[];
  selectedFolder: string;
  onFolderSelect: (folderId: string) => void;
  onFolderHover: (folderId: string) => void;
  onComposeClick: () => void;
  emailAccounts: EmailAccount[];
  onAccountsClick: () => void;
  getInitials: (email: string) => string;
}

export const EmailSidebar = React.memo(({
  isOpen,
  folders,
  selectedFolder,
  onFolderSelect,
  onFolderHover,
  onComposeClick,
  emailAccounts,
  onAccountsClick,
  getInitials,
}: EmailSidebarProps) => {
  if (!isOpen) return null;

  return (
    <>
      <div className="p-4">
        <Button
          onClick={onComposeClick}
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
              onClick={() => onFolderSelect(folder.id)}
              onMouseEnter={() => onFolderHover(folder.id)}
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
                  onClick={onAccountsClick}
                >
                  + {emailAccounts.length - 3} more
                </Button>
              )}
            </div>
          </>
        )}
      </ScrollArea>
    </>
  );
});

EmailSidebar.displayName = 'EmailSidebar';
