import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { format, isSameDay } from 'date-fns';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Download, History } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type ChangeEvent = React.ChangeEvent<HTMLInputElement>;
type SelectChangeEvent = string;

interface AuditLog {
  id: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW';
  user_name: string;
  user_email: string;
  created_at: string;
  old_value: any;
  new_value: any;
  ip_address: string;
}

interface AuditLogDialogProps {
  isOpen: boolean;
  onClose: () => void;
  requirementId: string;
}

export function AuditLogDialog({ isOpen, onClose, requirementId }: AuditLogDialogProps) {
  const [logs, setLogs] = React.useState<AuditLog[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [actionFilter, setActionFilter] = React.useState<string>('all');
  const [dateFilter, setDateFilter] = React.useState<'all' | 'today' | 'week' | 'month'>('all');
  const [searchTerm, setSearchTerm] = React.useState('');

  React.useEffect(() => {
    if (isOpen && requirementId) {
      fetchAuditLogs();
    }
  }, [isOpen, requirementId]);

  // Filter logs based on selected filters and search term
  const filteredLogs = React.useMemo(() => {
    return logs.filter(log => {
      // Action filter
      if (actionFilter !== 'all' && log.action.toLowerCase() !== actionFilter) {
        return false;
      }

      // Date filter
      if (dateFilter !== 'all') {
        const logDate = new Date(log.created_at);
        const today = new Date();
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

        if (dateFilter === 'today' && !isSameDay(logDate, today)) {
          return false;
        }
        if (dateFilter === 'week' && logDate < weekAgo) {
          return false;
        }
        if (dateFilter === 'month' && logDate < monthAgo) {
          return false;
        }
      }

      // Search term
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        return (
          log.user_name.toLowerCase().includes(searchLower) ||
          log.user_email.toLowerCase().includes(searchLower) ||
          JSON.stringify(log.old_value)?.toLowerCase().includes(searchLower) ||
          JSON.stringify(log.new_value)?.toLowerCase().includes(searchLower)
        );
      }

      return true;
    });
  }, [logs, actionFilter, dateFilter, searchTerm]);

  // Group logs by date for better organization
  const groupedLogs = React.useMemo(() => {
    const groups: { [key: string]: AuditLog[] } = {};
    filteredLogs.forEach(log => {
      const date = format(new Date(log.created_at), 'MMM d, yyyy');
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(log);
    });
    return groups;
  }, [filteredLogs]);

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/audit-logs/requirements/${requirementId}`);
      if (!response.ok) throw new Error('Failed to fetch audit logs');
      const data = await response.json();
      setLogs(data);
    } catch (error) {
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  const formatChanges = (oldValue: any, newValue: any) => {
    if (!oldValue) return 'Created new requirement';
    if (!newValue) return 'Deleted requirement';

    const changes: string[] = [];
    Object.keys(newValue).forEach(key => {
      if (JSON.stringify(oldValue[key]) !== JSON.stringify(newValue[key])) {
        changes.push(`Changed ${key} from "${oldValue[key]}" to "${newValue[key]}"`);
      }
    });
    return changes.join(', ');
  };

  const handleExport = () => {
    const csv = [
      ['Date', 'Action', 'User', 'Email', 'Changes', 'IP Address'],
      ...filteredLogs.map(log => [
        format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss'),
        log.action,
        log.user_name,
        log.user_email,
        formatChanges(log.old_value, log.new_value),
        log.ip_address
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `requirement-history-${requirementId}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <History className="h-5 w-5" />
            Requirement Change History
          </DialogTitle>
          <DialogDescription>
            Track all changes made to this requirement
          </DialogDescription>
        </DialogHeader>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-4">
          <div className="flex-1 min-w-[200px]">
            <Input
              placeholder="Search changes, users..."
              value={searchTerm}
              onChange={(e: ChangeEvent) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>
          
          <Select 
            value={actionFilter}
            onValueChange={(value: SelectChangeEvent) => setActionFilter(value)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="create">Created</SelectItem>
              <SelectItem value="update">Updated</SelectItem>
              <SelectItem value="delete">Deleted</SelectItem>
              <SelectItem value="view">Viewed</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={dateFilter}
            onValueChange={(value: SelectChangeEvent) => setDateFilter(value as 'all' | 'today' | 'week' | 'month')}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by date" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">Past Week</SelectItem>
              <SelectItem value="month">Past Month</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={handleExport} className="whitespace-nowrap">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        <div className="mt-4 space-y-6">
          {loading ? (
            <div className="flex justify-center items-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-8">
              <History className="h-12 w-12 text-slate-400 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-slate-900 mb-1">No matching records</h3>
              <p className="text-sm text-slate-500">
                Try adjusting your filters or search terms
              </p>
            </div>
          ) : (
            Object.entries(groupedLogs).map(([date, dateLogs]) => (
              <div key={date} className="space-y-2">
                <h3 className="text-sm font-medium text-slate-500 sticky top-0 bg-white py-2">
                  {date}
                </h3>
                <div className="rounded-lg border border-slate-200 divide-y divide-slate-200">
                  {dateLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-4 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium
                              ${log.action === 'CREATE' ? 'bg-green-100 text-green-800' : ''}
                              ${log.action === 'UPDATE' ? 'bg-blue-100 text-blue-800' : ''}
                              ${log.action === 'DELETE' ? 'bg-red-100 text-red-800' : ''}
                              ${log.action === 'VIEW' ? 'bg-gray-100 text-gray-800' : ''}
                            `}>
                              {log.action}
                            </span>
                            <span className="text-sm text-slate-600">
                              {format(new Date(log.created_at), 'HH:mm:ss')}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2 mb-3">
                            <span className="font-medium">{log.user_name}</span>
                            <span className="text-sm text-slate-500">{log.user_email}</span>
                          </div>

                          <div className="space-y-2">
                            {log.action === 'UPDATE' && (
                              <div className="text-sm bg-slate-50 rounded-lg p-3 space-y-2">
                                {Object.keys(log.new_value || {}).map(key => {
                                  const oldVal = log.old_value?.[key];
                                  const newVal = log.new_value?.[key];
                                  if (JSON.stringify(oldVal) === JSON.stringify(newVal)) return null;
                                  
                                  return (
                                    <div key={key} className="grid grid-cols-[120px,1fr] gap-2">
                                      <span className="text-slate-500 font-medium">{key}:</span>
                                      <div>
                                        <div className="line-through text-red-600">
                                          {JSON.stringify(oldVal)}
                                        </div>
                                        <div className="text-green-600">
                                          {JSON.stringify(newVal)}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            
                            {log.action === 'CREATE' && (
                              <div className="text-sm text-green-600">
                                Created new requirement
                              </div>
                            )}
                            
                            {log.action === 'DELETE' && (
                              <div className="text-sm text-red-600">
                                Deleted requirement
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="text-xs text-slate-400">
                          {log.ip_address}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}