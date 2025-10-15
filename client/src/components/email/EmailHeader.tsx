/**
 * EmailHeader Component
 * 
 * Top header with search, settings, and user avatar.
 * Extracted from the monolithic EmailClient to improve performance and maintainability.
 */

import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  ArrowLeft, Menu, Mail, Search, Filter, HelpCircle, Settings, Clock 
} from 'lucide-react';

interface EmailHeaderProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onSearchKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onSearchFocus: () => void;
  onSearchBlur: () => void;
  searchHistory: string[];
  showSearchSuggestions: boolean;
  onSearchSuggestionClick: (query: string) => void;
  onBackClick: () => void;
  onSidebarToggle: () => void;
  onHelpClick: () => void;
  onSettingsClick: () => void;
  userInitials: string;
}

export const EmailHeader = React.memo(({
  searchQuery,
  onSearchChange,
  onSearchKeyDown,
  onSearchFocus,
  onSearchBlur,
  searchHistory,
  showSearchSuggestions,
  onSearchSuggestionClick,
  onBackClick,
  onSidebarToggle,
  onHelpClick,
  onSettingsClick,
  userInitials,
}: EmailHeaderProps) => {
  const searchInputRef = useRef<HTMLInputElement>(null);

  return (
    <header className="flex items-center gap-4 px-4 py-2 border-b border-gray-200 bg-white">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={onBackClick}
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
        onClick={onSidebarToggle}
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div className="flex items-center gap-2">
        <Mail className="h-6 w-6 text-red-500" />
        <span className="text-xl font-normal text-gray-700 hidden sm:inline">Gmail</span>
      </div>

      {/* Search Bar */}
      <div className="flex-1 max-w-3xl relative">
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-gray-600" />
          <Input
            ref={searchInputRef}
            placeholder="Search mail (Press / to focus)"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={onSearchKeyDown}
            onFocus={onSearchFocus}
            onBlur={onSearchBlur}
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
                  onClick={() => onSearchSuggestionClick(query)}
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
              onClick={onHelpClick}
            >
              <HelpCircle className="h-5 w-5 text-gray-600" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Keyboard shortcuts (?)</TooltipContent>
        </Tooltip>
        
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="rounded-full" 
              onClick={onSettingsClick}
            >
              <Settings className="h-5 w-5 text-gray-600" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Settings</TooltipContent>
        </Tooltip>

        <div className="w-px h-6 bg-gray-300 mx-2" />

        <Avatar className="h-8 w-8 cursor-pointer">
          <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white text-xs font-medium">
            {userInitials}
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
});

EmailHeader.displayName = 'EmailHeader';
