import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  Edit,
  Trash2,
  MoreHorizontal,
  FileText,
  Calendar,
  User,
} from 'lucide-react';
import { StatusBadge } from './status-badge';
import { cn } from '@/lib/utils';

export interface TableColumn<T = any> {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string;
  render?: (value: any, row: T) => React.ReactNode;
  className?: string;
}

export interface TableAction<T = any> {
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  onClick: (row: T) => void;
  variant?: 'default' | 'destructive' | 'outline';
  show?: (row: T) => boolean;
}

interface EnhancedTableProps<T = any> {
  data: T[];
  columns: TableColumn<T>[];
  actions?: TableAction<T>[];
  selectable?: boolean;
  selectedItems?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (column: string, direction: 'asc' | 'desc') => void;
  loading?: boolean;
  emptyMessage?: string;
  rowClassName?: (row: T) => string;
  getRowId?: (row: T) => string;
  density?: 'compact' | 'normal' | 'comfortable';
}

export function EnhancedTable<T extends Record<string, any>>({
  data,
  columns,
  actions = [],
  selectable = false,
  selectedItems = [],
  onSelectionChange,
  sortBy,
  sortDirection,
  onSort,
  loading = false,
  emptyMessage = 'No data available',
  rowClassName,
  getRowId = (row) => row.id,
  density = 'normal',
}: EnhancedTableProps<T>) {
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  const densityClasses = {
    compact: 'py-2',
    normal: 'py-3',
    comfortable: 'py-4',
  };

  const handleSort = (column: string) => {
    if (!onSort) return;
    
    if (sortBy === column) {
      const newDirection = sortDirection === 'asc' ? 'desc' : 'asc';
      onSort(column, newDirection);
    } else {
      onSort(column, 'asc');
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (!onSelectionChange) return;
    
    if (checked) {
      const allIds = data.map(getRowId);
      onSelectionChange(allIds);
    } else {
      onSelectionChange([]);
    }
  };

  const handleSelectRow = (rowId: string, checked: boolean) => {
    if (!onSelectionChange) return;
    
    if (checked) {
      onSelectionChange([...selectedItems, rowId]);
    } else {
      onSelectionChange(selectedItems.filter(id => id !== rowId));
    }
  };

  const isAllSelected = data.length > 0 && selectedItems.length === data.length;
  const isIndeterminate = selectedItems.length > 0 && selectedItems.length < data.length;

  const primaryActions = actions.slice(0, 2);
  const secondaryActions = actions.slice(2);

  if (loading) {
    return (
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              {selectable && <TableHead className="w-12"></TableHead>}
              {columns.map((column) => (
                <TableHead key={column.key} style={{ width: column.width }}>
                  {column.label}
                </TableHead>
              ))}
              {actions.length > 0 && <TableHead className="w-24">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, index) => (
              <TableRow key={index}>
                {selectable && (
                  <TableCell>
                    <div className="h-4 w-4 bg-slate-200 rounded animate-pulse" />
                  </TableCell>
                )}
                {columns.map((column) => (
                  <TableCell key={column.key}>
                    <div className="h-4 bg-slate-200 rounded animate-pulse" />
                  </TableCell>
                ))}
                {actions.length > 0 && (
                  <TableCell>
                    <div className="flex space-x-2">
                      <div className="h-8 w-8 bg-slate-200 rounded animate-pulse" />
                      <div className="h-8 w-8 bg-slate-200 rounded animate-pulse" />
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50/50">
            {selectable && (
              <TableHead className="w-12">
                <Checkbox
                  checked={isAllSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = isIndeterminate;
                  }}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all rows"
                />
              </TableHead>
            )}
            {columns.map((column) => (
              <TableHead
                key={column.key}
                style={{ width: column.width }}
                className={cn('font-semibold', column.className)}
              >
                {column.sortable ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 font-semibold hover:bg-transparent"
                    onClick={() => handleSort(column.key)}
                  >
                    <span>{column.label}</span>
                    {sortBy === column.key ? (
                      sortDirection === 'asc' ? (
                        <ArrowUp size={14} className="ml-2" />
                      ) : (
                        <ArrowDown size={14} className="ml-2" />
                      )
                    ) : (
                      <ArrowUpDown size={14} className="ml-2 opacity-50" />
                    )}
                  </Button>
                ) : (
                  column.label
                )}
              </TableHead>
            ))}
            {actions.length > 0 && (
              <TableHead className="w-24 text-right">Actions</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length + (selectable ? 1 : 0) + (actions.length > 0 ? 1 : 0)}
                className="text-center py-8 text-slate-500"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            data.map((row) => {
              const rowId = getRowId(row);
              const isSelected = selectedItems.includes(rowId);
              const isHovered = hoveredRow === rowId;

              return (
                <TableRow
                  key={rowId}
                  className={cn(
                    'hover:bg-slate-50/50 transition-colors border-b border-slate-100',
                    isSelected && 'bg-blue-50/50 hover:bg-blue-50',
                    rowClassName?.(row)
                  )}
                  onMouseEnter={() => setHoveredRow(rowId)}
                  onMouseLeave={() => setHoveredRow(null)}
                >
                  {selectable && (
                    <TableCell className={densityClasses[density]}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => handleSelectRow(rowId, !!checked)}
                        aria-label={`Select row ${rowId}`}
                      />
                    </TableCell>
                  )}
                  {columns.map((column) => (
                    <TableCell
                      key={column.key}
                      className={cn(densityClasses[density], column.className)}
                    >
                      {column.render ? column.render(row[column.key], row) : row[column.key]}
                    </TableCell>
                  ))}
                  {actions.length > 0 && (
                    <TableCell className={cn('text-right', densityClasses[density])}>
                      <div className={cn(
                        'flex items-center justify-end space-x-1 transition-opacity',
                        !isHovered && 'opacity-0 group-hover:opacity-100'
                      )}>
                        {primaryActions.map((action, index) => {
                          if (action.show && !action.show(row)) return null;
                          
                          const IconComponent = action.icon;
                          return (
                            <Button
                              key={index}
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
                        
                        {secondaryActions.length > 0 && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                                <MoreHorizontal size={14} />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {secondaryActions.map((action, index) => {
                                if (action.show && !action.show(row)) return null;
                                
                                const IconComponent = action.icon;
                                return (
                                  <DropdownMenuItem
                                    key={index}
                                    onClick={() => action.onClick(row)}
                                    className={action.variant === 'destructive' ? 'text-red-600' : ''}
                                  >
                                    <IconComponent size={14} className="mr-2" />
                                    {action.label}
                                  </DropdownMenuItem>
                                );
                              })}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}

// Helper function to create common table columns
export const createTableColumns = {
  requirement: (): TableColumn[] => [
    {
      key: 'jobTitle',
      label: 'Job Title',
      sortable: true,
      render: (value, row) => (
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            <div className="h-8 w-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <FileText size={16} className="text-blue-600" />
            </div>
          </div>
          <div>
            <div className="font-medium text-slate-900">{value}</div>
            <div className="text-sm text-slate-500">{row.clientCompany}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (value) => <StatusBadge status={value} type="requirement" />,
    },
    {
      key: 'primaryTechStack',
      label: 'Tech Stack',
      render: (value) => (
        <Badge variant="outline" className="text-xs">
          {value}
        </Badge>
      ),
    },
    {
      key: 'createdAt',
      label: 'Created',
      sortable: true,
      render: (value) => new Date(value).toLocaleDateString(),
    },
  ],
  
  consultant: (): TableColumn[] => [
    {
      key: 'name',
      label: 'Consultant',
      sortable: true,
      render: (value, row) => (
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            <div className="h-8 w-8 bg-purple-100 rounded-full flex items-center justify-center">
              <User size={16} className="text-purple-600" />
            </div>
          </div>
          <div>
            <div className="font-medium text-slate-900">{value}</div>
            <div className="text-sm text-slate-500">{row.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (value) => <StatusBadge status={value} type="consultant" />,
    },
    {
      key: 'visaStatus',
      label: 'Visa Status',
      render: (value) => value ? (
        <Badge variant="outline" className="text-xs">
          {value}
        </Badge>
      ) : '-',
    },
    {
      key: 'createdAt',
      label: 'Added',
      sortable: true,
      render: (value) => new Date(value).toLocaleDateString(),
    },
  ],
  
  interview: (): TableColumn[] => [
    {
      key: 'jobTitle',
      label: 'Interview',
      sortable: true,
      render: (value, row) => (
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            <div className="h-8 w-8 bg-green-100 rounded-lg flex items-center justify-center">
              <Calendar size={16} className="text-green-600" />
            </div>
          </div>
          <div>
            <div className="font-medium text-slate-900">{value}</div>
            <div className="text-sm text-slate-500">{row.clientCompany}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (value) => <StatusBadge status={value} type="interview" />,
    },
    {
      key: 'interviewDate',
      label: 'Date & Time',
      sortable: true,
      render: (value) => value ? new Date(value).toLocaleString() : '-',
    },
    {
      key: 'createdAt',
      label: 'Scheduled',
      sortable: true,
      render: (value) => new Date(value).toLocaleDateString(),
    },
  ],
};
