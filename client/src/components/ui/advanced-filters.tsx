import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Search,
  Filter,
  X,
  Calendar as CalendarIcon,
  Save,
  RotateCcw,
  ChevronDown,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export interface FilterField {
  key: string;
  label: string;
  type: 'text' | 'select' | 'date' | 'dateRange' | 'multiSelect';
  options?: { value: string; label: string }[];
  placeholder?: string;
}

export interface FilterValue {
  [key: string]: any;
}

export interface SavedFilter {
  id: string;
  name: string;
  filters: FilterValue;
  isDefault?: boolean;
}

interface AdvancedFiltersProps {
  fields: FilterField[];
  values: FilterValue;
  onChange: (values: FilterValue) => void;
  onReset: () => void;
  savedFilters?: SavedFilter[];
  onSaveFilter?: (name: string, filters: FilterValue) => void;
  onLoadFilter?: (filter: SavedFilter) => void;
  onDeleteFilter?: (filterId: string) => void;
  className?: string;
}

export function AdvancedFilters({
  fields,
  values,
  onChange,
  onReset,
  savedFilters = [],
  onSaveFilter,
  onLoadFilter,
  onDeleteFilter,
  className,
}: AdvancedFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [saveFilterName, setSaveFilterName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  const activeFilterCount = Object.values(values).filter(
    (value) => value !== undefined && value !== '' && value !== null
  ).length;

  const handleFieldChange = (key: string, value: any) => {
    onChange({ ...values, [key]: value });
  };

  const handleSaveFilter = () => {
    if (saveFilterName.trim() && onSaveFilter) {
      onSaveFilter(saveFilterName.trim(), values);
      setSaveFilterName('');
      setShowSaveDialog(false);
    }
  };

  const renderField = (field: FilterField) => {
    const value = values[field.key];

    switch (field.type) {
      case 'text':
        return (
          <div key={field.key} className="space-y-2">
            <Label htmlFor={field.key} className="text-sm font-medium">
              {field.label}
            </Label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-3 text-slate-400" />
              <Input
                id={field.key}
                placeholder={field.placeholder || `Search ${field.label.toLowerCase()}...`}
                value={value || ''}
                onChange={(e) => handleFieldChange(field.key, e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        );

      case 'select':
        return (
          <div key={field.key} className="space-y-2">
            <Label className="text-sm font-medium">{field.label}</Label>
            <Select
              value={value || ''}
              onValueChange={(newValue) => handleFieldChange(field.key, newValue)}
            >
              <SelectTrigger>
                <SelectValue placeholder={field.placeholder || `Select ${field.label.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All {field.label}</SelectItem>
                {field.options?.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      case 'date':
        return (
          <div key={field.key} className="space-y-2">
            <Label className="text-sm font-medium">{field.label}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !value && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {value ? format(new Date(value), 'PPP') : field.placeholder || 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={value ? new Date(value) : undefined}
                  onSelect={(date) => handleFieldChange(field.key, date?.toISOString())}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        );

      case 'dateRange':
        return (
          <div key={field.key} className="space-y-2">
            <Label className="text-sm font-medium">{field.label}</Label>
            <div className="grid grid-cols-2 gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'justify-start text-left font-normal',
                      !value?.from && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {value?.from ? format(new Date(value.from), 'MMM dd') : 'From'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={value?.from ? new Date(value.from) : undefined}
                    onSelect={(date) =>
                      handleFieldChange(field.key, { ...value, from: date?.toISOString() })
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'justify-start text-left font-normal',
                      !value?.to && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {value?.to ? format(new Date(value.to), 'MMM dd') : 'To'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={value?.to ? new Date(value.to) : undefined}
                    onSelect={(date) =>
                      handleFieldChange(field.key, { ...value, to: date?.toISOString() })
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        );

      case 'multiSelect':
        const selectedValues = Array.isArray(value) ? value : [];
        return (
          <div key={field.key} className="space-y-2">
            <Label className="text-sm font-medium">{field.label}</Label>
            <div className="space-y-2">
              {selectedValues.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {selectedValues.map((selectedValue) => {
                    const option = field.options?.find((opt) => opt.value === selectedValue);
                    return (
                      <Badge key={selectedValue} variant="secondary" className="text-xs">
                        {option?.label || selectedValue}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-auto p-0 ml-1"
                          onClick={() =>
                            handleFieldChange(
                              field.key,
                              selectedValues.filter((v) => v !== selectedValue)
                            )
                          }
                        >
                          <X size={12} />
                        </Button>
                      </Badge>
                    );
                  })}
                </div>
              )}
              <Select
                onValueChange={(newValue) => {
                  if (!selectedValues.includes(newValue)) {
                    handleFieldChange(field.key, [...selectedValues, newValue]);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={`Add ${field.label.toLowerCase()}...`} />
                </SelectTrigger>
                <SelectContent>
                  {field.options
                    ?.filter((option) => !selectedValues.includes(option.value))
                    .map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CardTitle className="text-lg">Filters</CardTitle>
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {activeFilterCount} active
              </Badge>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {savedFilters.length > 0 && (
              <Select onValueChange={(filterId) => {
                const filter = savedFilters.find(f => f.id === filterId);
                if (filter && onLoadFilter) {
                  onLoadFilter(filter);
                }
              }}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Saved filters" />
                </SelectTrigger>
                <SelectContent>
                  {savedFilters.map((filter) => (
                    <SelectItem key={filter.id} value={filter.id}>
                      {filter.name}
                      {filter.isDefault && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          Default
                        </Badge>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              <Filter size={16} className="mr-2" />
              {isExpanded ? 'Hide' : 'Show'} Filters
              <ChevronDown
                size={16}
                className={cn('ml-2 transition-transform', isExpanded && 'rotate-180')}
              />
            </Button>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-4">
            {fields.map(renderField)}
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={onReset}>
                <RotateCcw size={16} className="mr-2" />
                Reset Filters
              </Button>
              {onSaveFilter && (
                <Popover open={showSaveDialog} onOpenChange={setShowSaveDialog}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Save size={16} className="mr-2" />
                      Save Filter
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80">
                    <div className="space-y-3">
                      <Label htmlFor="filter-name">Filter Name</Label>
                      <Input
                        id="filter-name"
                        placeholder="Enter filter name..."
                        value={saveFilterName}
                        onChange={(e) => setSaveFilterName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSaveFilter();
                          }
                        }}
                      />
                      <div className="flex justify-end space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowSaveDialog(false)}
                        >
                          Cancel
                        </Button>
                        <Button size="sm" onClick={handleSaveFilter}>
                          Save
                        </Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>

            <div className="text-sm text-slate-500">
              {activeFilterCount > 0 && `${activeFilterCount} filter${activeFilterCount > 1 ? 's' : ''} applied`}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
