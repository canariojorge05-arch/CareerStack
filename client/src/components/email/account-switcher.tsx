// @ts-nocheck - restart TS Server
import React, { useState, useEffect } from 'react';
import { Check, ChevronDown, Mail, Plus, Settings, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { accountSwitchingService, EmailAccount } from '@/services/accountSwitchingService';
import { toast } from 'sonner';

interface AccountSwitcherProps {
  accounts: EmailAccount[];
  onAccountSelect: (accountId: string | null) => void;
  onAddAccount: () => void;
  onManageAccounts: () => void;
  unreadCounts?: Record<string, number>;
  className?: string;
}

export function AccountSwitcher({
  accounts,
  onAccountSelect,
  onAddAccount,
  onManageAccounts,
  unreadCounts = {},
  className,
}: AccountSwitcherProps) {
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    accountSwitchingService.getSelectedAccountId()
  );
  const [syncingAccounts, setSyncingAccounts] = useState<Set<string>>(new Set());

  useEffect(() => {
    const unsubscribe = accountSwitchingService.subscribe(() => {
      setSelectedAccountId(accountSwitchingService.getSelectedAccountId());
    });

    if (!selectedAccountId && accounts.length > 0) {
      const defaultAccount = accounts.find((acc) => acc.isDefault) || accounts[0];
      handleAccountSelect(defaultAccount.id);
    }

    return unsubscribe;
  }, [accounts]);

  const handleAccountSelect = (accountId: string | null) => {
    setSelectedAccountId(accountId);
    accountSwitchingService.setSelectedAccount(accountId);
    onAccountSelect(accountId);
  };

  const handleUnifiedInbox = () => {
    handleAccountSelect(null);
    toast.success('Switched to unified inbox');
  };

  const handleSyncAccount = async (accountId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (syncingAccounts.has(accountId)) return;

    setSyncingAccounts((prev) => new Set(prev).add(accountId));

    try {
      const response = await fetch('/api/email/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`Synced ${data.syncedCount || 0} new emails`);
      } else {
        toast.error('Failed to sync account');
      }
    } catch (error) {
      toast.error('Sync failed');
    } finally {
      setSyncingAccounts((prev) => {
        const next = new Set(prev);
        next.delete(accountId);
        return next;
      });
    }
  };

  const selectedAccount = accounts.find((acc) => acc.id === selectedAccountId);
  const totalUnread = Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);

  const getInitials = (email: string) => {
    const name = email.split('@')[0];
    return name.slice(0, 2).toUpperCase();
  };

  const getProviderColor = (provider: string) => {
    switch (provider.toLowerCase()) {
      case 'gmail':
        return 'bg-red-500';
      case 'outlook':
        return 'bg-blue-500';
      case 'smtp':
      case 'imap':
        return 'bg-gray-500';
      default:
        return 'bg-green-500';
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-full justify-between gap-2 h-12 px-3 border-2 hover:bg-gray-50 transition-all',
            className
          )}
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {selectedAccount ? (
              <>
                <div className="relative">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback
                      className={cn(
                        'text-white text-xs font-medium',
                        getProviderColor(selectedAccount.provider)
                      )}
                    >
                      {getInitials(selectedAccount.emailAddress)}
                    </AvatarFallback>
                  </Avatar>
                  {!selectedAccount.isActive && (
                    <div className="absolute -top-1 -right-1">
                      <AlertCircle className="h-4 w-4 text-red-500 bg-white rounded-full" />
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-start flex-1 min-w-0">
                  <span className="text-sm font-medium truncate max-w-full">
                    {selectedAccount.accountName || selectedAccount.emailAddress}
                  </span>
                  <span className="text-xs text-gray-500 truncate max-w-full">
                    {selectedAccount.emailAddress}
                  </span>
                </div>
                {unreadCounts[selectedAccount.id] > 0 && (
                  <Badge variant="default" className="ml-auto">
                    {unreadCounts[selectedAccount.id]}
                  </Badge>
                )}
              </>
            ) : (
              <>
                <Mail className="h-8 w-8 text-gray-600" />
                <div className="flex flex-col items-start flex-1">
                  <span className="text-sm font-medium">All Inboxes</span>
                  <span className="text-xs text-gray-500">{accounts.length} accounts</span>
                </div>
                {totalUnread > 0 && (
                  <Badge variant="default" className="ml-auto">
                    {totalUnread}
                  </Badge>
                )}
              </>
            )}
          </div>
          <ChevronDown className="h-4 w-4 opacity-50 flex-shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80" align="start">
        <DropdownMenuLabel className="text-xs uppercase text-gray-500">
          Email Accounts
        </DropdownMenuLabel>

        <DropdownMenuItem
          onClick={handleUnifiedInbox}
          className={cn('cursor-pointer py-3 px-3', !selectedAccountId && 'bg-gray-100')}
        >
          <div className="flex items-center gap-3 flex-1">
            <div className="bg-gradient-to-br from-blue-500 to-purple-500 rounded-full p-2">
              <Mail className="h-4 w-4 text-white" />
            </div>
            <div className="flex flex-col flex-1">
              <span className="text-sm font-medium">All Inboxes</span>
              <span className="text-xs text-gray-500">{accounts.length} accounts</span>
            </div>
            {totalUnread > 0 && <Badge variant="secondary">{totalUnread}</Badge>}
            {!selectedAccountId && <Check className="h-4 w-4 text-blue-600" />}
          </div>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <div className="max-h-[300px] overflow-y-auto">
          {accounts.map((account) => (
            <DropdownMenuItem
              key={account.id}
              onClick={() => handleAccountSelect(account.id)}
              className={cn(
                'cursor-pointer py-3 px-3',
                selectedAccountId === account.id && 'bg-gray-100'
              )}
            >
              <div className="flex items-center gap-3 flex-1">
                <div className="relative">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback
                      className={cn('text-white text-xs', getProviderColor(account.provider))}
                    >
                      {getInitials(account.emailAddress)}
                    </AvatarFallback>
                  </Avatar>
                  {!account.isActive && (
                    <div className="absolute -top-1 -right-1">
                      <AlertCircle className="h-3 w-3 text-red-500 bg-white rounded-full" />
                    </div>
                  )}
                </div>
                <div className="flex flex-col flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">
                      {account.accountName || account.emailAddress}
                    </span>
                    {account.isDefault && (
                      <Badge variant="secondary" className="text-xs px-1.5 py-0">
                        Default
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 truncate">{account.emailAddress}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {unreadCounts[account.id] > 0 && (
                    <Badge variant="default" className="text-xs">
                      {unreadCounts[account.id]}
                    </Badge>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={(e) => handleSyncAccount(account.id, e)}
                    disabled={syncingAccounts.has(account.id)}
                  >
                    <RefreshCw
                      className={cn(
                        'h-3.5 w-3.5',
                        syncingAccounts.has(account.id) && 'animate-spin'
                      )}
                    />
                  </Button>
                  {selectedAccountId === account.id && <Check className="h-4 w-4 text-blue-600" />}
                </div>
              </div>
            </DropdownMenuItem>
          ))}
        </div>

        <DropdownMenuSeparator />

        <div className="p-1">
          <DropdownMenuItem
            onClick={onAddAccount}
            className="cursor-pointer py-2 text-blue-600 hover:text-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Email Account
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onManageAccounts} className="cursor-pointer py-2">
            <Settings className="h-4 w-4 mr-2" />
            Manage Accounts
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
