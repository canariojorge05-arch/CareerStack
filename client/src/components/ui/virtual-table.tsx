import React, { useMemo, useCallback } from 'react';
import { FixedSizeList as List } from 'react-window';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TableColumn, TableAction } from './enhanced-table';
import { cn } from '@/lib/utils';

interface VirtualTableProps<T = any> {
  data: T[];
  columns: TableColumn<T>[];
  actions?: TableAction<T>[];
  height?: number;
  itemHeight?: number;
  selectable?: boolean;
  selectedItems?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
  getRowId?: (row: T) => string;
  rowClassName?: (row: T) => string;
  loading?: boolean;
}

interface RowProps<T> {
  index: number;
  style: React.CSSProperties;
  data: {
    items: T[];
    columns: TableColumn<T>[];
    actions: TableAction<T>[];
    selectable: boolean;
    selectedItems: string[];
    onSelectionChange?: (selectedIds: string[]) => void;
    getRowId: (row: T) => string;
    rowClassName?: (row: T) => string;
  };
}

function VirtualRow<T extends Record<string, any>>({ index, style, data }: RowProps<T>) {
  const {
    items,
    columns,
    actions,
    selectable,
    selectedItems,
    onSelectionChange,
    getRowId,
    rowClassName,
  } = data;

  const row = items[index];
  const rowId = getRowId(row);
  const isSelected = selectedItems.includes(rowId);

  const handleSelectRow = useCallback((checked: boolean) => {
    if (!onSelectionChange) return;
    
    if (checked) {
      onSelectionChange([...selectedItems, rowId]);
    } else {
      onSelectionChange(selectedItems.filter(id => id !== rowId));
    }
  }, [selectedItems, rowId, onSelectionChange]);

  return (
    <div
      style={style}
      className={cn(
        'flex items-center border-b border-slate-100 hover:bg-slate-50/50 transition-colors',
        isSelected && 'bg-blue-50/50',
        rowClassName?.(row)
      )}
    >
      {selectable && (
        <div className="w-12 px-4 flex items-center justify-center">
          <Checkbox
            checked={isSelected}
            onCheckedChange={handleSelectRow}
            aria-label={`Select row ${rowId}`}
          />
        </div>
      )}
      
      {columns.map((column, colIndex) => (
        <div
          key={column.key}
          className={cn(
            'px-4 py-3 flex items-center',
            column.className
          )}
          style={{ width: column.width || 'auto', minWidth: column.width || 150 }}
        >
          {column.render ? column.render(row[column.key], row) : row[column.key]}
        </div>
      ))}
      
      {actions.length > 0 && (
        <div className="w-24 px-4 flex items-center justify-end space-x-1">
          {actions.slice(0, 2).map((action, actionIndex) => {
            if (action.show && !action.show(row)) return null;
            
            const IconComponent = action.icon;
            return (
              <Button
                key={actionIndex}
                size="sm"
                variant="ghost"
                onClick={() => action.onClick(row)}
                className="h-8 w-8 p-0"
                title={action.label}
              >
                <IconComponent size={14} />
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function VirtualTable<T extends Record<string, any>>({
  data,
  columns,
  actions = [],
  height = 400,
  itemHeight = 60,
  selectable = false,
  selectedItems = [],
  onSelectionChange,
  getRowId = (row) => row.id,
  rowClassName,
  loading = false,
}: VirtualTableProps<T>) {
  const handleSelectAll = useCallback((checked: boolean) => {
    if (!onSelectionChange) return;
    
    if (checked) {
      const allIds = data.map(getRowId);
      onSelectionChange(allIds);
    } else {
      onSelectionChange([]);
    }
  }, [data, getRowId, onSelectionChange]);

  const isAllSelected = data.length > 0 && selectedItems.length === data.length;
  const isIndeterminate = selectedItems.length > 0 && selectedItems.length < data.length;

  const itemData = useMemo(() => ({
    items: data,
    columns,
    actions,
    selectable,
    selectedItems,
    onSelectionChange,
    getRowId,
    rowClassName,
  }), [data, columns, actions, selectable, selectedItems, onSelectionChange, getRowId, rowClassName]);

  if (loading) {
    return (
      <div className="border rounded-lg">
        <div className="flex items-center bg-slate-50/50 border-b border-slate-200 px-4 py-3">
          {selectable && <div className="w-12" />}
          {columns.map((column) => (
            <div
              key={column.key}
              className="font-semibold text-slate-700"
              style={{ width: column.width || 'auto', minWidth: column.width || 150 }}
            >
              {column.label}
            </div>
          ))}
          {actions.length > 0 && <div className="w-24 text-right">Actions</div>}
        </div>
        
        <div className="space-y-2 p-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex items-center space-x-4">
              {selectable && <div className="h-4 w-4 bg-slate-200 rounded animate-pulse" />}
              {columns.map((column) => (
                <div
                  key={column.key}
                  className="h-4 bg-slate-200 rounded animate-pulse"
                  style={{ width: column.width || 150 }}
                />
              ))}
              {actions.length > 0 && (
                <div className="flex space-x-2">
                  <div className="h-8 w-8 bg-slate-200 rounded animate-pulse" />
                  <div className="h-8 w-8 bg-slate-200 rounded animate-pulse" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center bg-slate-50/50 border-b border-slate-200 px-4 py-3">
        {selectable && (
          <div className="w-12 flex items-center justify-center">
            <Checkbox
              checked={isAllSelected}
              ref={(el) => {
                if (el) el.indeterminate = isIndeterminate;
              }}
              onCheckedChange={handleSelectAll}
              aria-label="Select all rows"
            />
          </div>
        )}
        
        {columns.map((column) => (
          <div
            key={column.key}
            className={cn('font-semibold text-slate-700', column.className)}
            style={{ width: column.width || 'auto', minWidth: column.width || 150 }}
          >
            {column.label}
          </div>
        ))}
        
        {actions.length > 0 && (
          <div className="w-24 text-right font-semibold text-slate-700">
            Actions
          </div>
        )}
      </div>

      {/* Virtual List */}
      {data.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          No data available
        </div>
      ) : (
        <List
          height={height}
          itemCount={data.length}
          itemSize={itemHeight}
          itemData={itemData}
          overscanCount={5}
        >
          {VirtualRow}
        </List>
      )}
    </div>
  );
}

// Hook for managing virtual table state
export function useVirtualTable<T>(
  data: T[],
  options: {
    pageSize?: number;
    searchFields?: string[];
    sortField?: string;
    sortDirection?: 'asc' | 'desc';
  } = {}
) {
  const {
    pageSize = 50,
    searchFields = [],
    sortField,
    sortDirection = 'asc',
  } = options;

  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedItems, setSelectedItems] = React.useState<string[]>([]);
  const [currentSortField, setCurrentSortField] = React.useState(sortField);
  const [currentSortDirection, setCurrentSortDirection] = React.useState<'asc' | 'desc'>(sortDirection);

  // Filter data based on search query
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data;
    
    const query = searchQuery.toLowerCase();
    return data.filter((item: any) => {
      return searchFields.some(field => {
        const value = item[field];
        return value && value.toString().toLowerCase().includes(query);
      });
    });
  }, [data, searchQuery, searchFields]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!currentSortField) return filteredData;
    
    return [...filteredData].sort((a: any, b: any) => {
      const aValue = a[currentSortField];
      const bValue = b[currentSortField];
      
      if (aValue < bValue) return currentSortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return currentSortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredData, currentSortField, currentSortDirection]);

  const handleSort = useCallback((field: string) => {
    if (currentSortField === field) {
      setCurrentSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setCurrentSortField(field);
      setCurrentSortDirection('asc');
    }
  }, [currentSortField]);

  return {
    data: sortedData,
    searchQuery,
    setSearchQuery,
    selectedItems,
    setSelectedItems,
    sortField: currentSortField,
    sortDirection: currentSortDirection,
    onSort: handleSort,
    totalCount: data.length,
    filteredCount: filteredData.length,
  };
}
