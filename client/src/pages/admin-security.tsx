import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, AlertTriangle, TrendingUp, XCircle, Loader2, MapPin, Monitor, Globe, RefreshCw, Clock } from 'lucide-react';
import { AppHeader } from '@/components/shared/app-header';
import { LoginHistoryDialog } from '@/components/admin/login-history-dialog';
import { formatDistanceToNow } from 'date-fns';

interface SuspiciousLogin {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  status: string;
  ipAddress: string;
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;
  browser?: string;
  os?: string;
  deviceType?: string;
  suspiciousReasons: string[];
  isNewLocation: boolean;
  isNewDevice: boolean;
  createdAt: string;
}

interface SecurityStats {
  suspiciousLogins24h: number;
  failedLogins24h: number;
  uniqueUsersAffected: number;
  topCountries: Array<{ country: string; count: number }>;
}

export default function AdminSecurityPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserEmail, setSelectedUserEmail] = useState<string>('');
  const [isLoginHistoryOpen, setIsLoginHistoryOpen] = useState(false);

  // Fetch security stats
  const { data: stats, isLoading: statsLoading } = useQuery<SecurityStats>({
    queryKey: ['/api/admin/security/stats'],
    queryFn: async () => {
      // Fallback stats since endpoint might not exist yet
      const res = await fetch('/api/admin/suspicious-logins?page=1&limit=1', { 
        credentials: 'include' 
      });
      if (!res.ok) throw new Error('Failed to fetch stats');
      const data = await res.json();
      
      // Calculate basic stats from suspicious logins
      return {
        suspiciousLogins24h: data.pagination?.total || 0,
        failedLogins24h: 0,
        uniqueUsersAffected: 0,
        topCountries: []
      };
    }
  });

  // Fetch suspicious logins
  const { data: loginsData, isLoading: loginsLoading, refetch } = useQuery({
    queryKey: ['/api/admin/suspicious-logins', { search, status: statusFilter, page }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20'
      });

      const res = await fetch(`/api/admin/suspicious-logins?${params}`, { 
        credentials: 'include' 
      });
      if (!res.ok) throw new Error('Failed to fetch suspicious logins');
      return res.json();
    }
  });

  const getStatusBadge = (status: string) => {
    if (status === 'success') {
      return <Badge variant="outline" className="text-green-600">Success</Badge>;
    }
    if (status === 'failed') {
      return <Badge variant="destructive">Failed</Badge>;
    }
    return <Badge variant="secondary">{status}</Badge>;
  };

  const getCountryFlag = (countryCode?: string) => {
    if (!countryCode) return '🌍';
    const codePoints = countryCode
      .toUpperCase()
      .split('')
      .map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  };

  const getDeviceIcon = (deviceType?: string) => {
    if (deviceType?.toLowerCase() === 'mobile') return '📱';
    if (deviceType?.toLowerCase() === 'tablet') return '📟';
    return '💻';
  };

  const handleViewUserHistory = (userId: string, userEmail: string) => {
    setSelectedUserId(userId);
    setSelectedUserEmail(userEmail);
    setIsLoginHistoryOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader currentPage="admin" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <AlertTriangle className="h-8 w-8 text-red-600" />
            Security Dashboard
          </h1>
          <p className="text-muted-foreground mt-2">Monitor suspicious login attempts and security threats</p>
          <div className="flex gap-2 mt-4">
            <Button onClick={() => window.location.href = '/admin'} variant="outline">
              User Management
            </Button>
            <Button onClick={() => window.location.href = '/admin/approvals'} variant="outline">
              Pending Approvals
            </Button>
            <Button onClick={() => window.location.href = '/admin/security'} variant="default">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Security
            </Button>
          </div>
        </div>

        {/* Security Statistics Cards */}
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Suspicious Logins</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Loader2 className="h-8 w-8 animate-spin" />
              ) : (
                <>
                  <div className="text-2xl font-bold text-red-600">{stats?.suspiciousLogins24h || 0}</div>
                  <p className="text-xs text-muted-foreground">Total suspicious attempts</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Failed Attempts</CardTitle>
              <XCircle className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Loader2 className="h-8 w-8 animate-spin" />
              ) : (
                <>
                  <div className="text-2xl font-bold text-orange-600">{loginsData?.logins?.filter((l: SuspiciousLogin) => l.status === 'failed').length || 0}</div>
                  <p className="text-xs text-muted-foreground">Failed login attempts</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unique Users</CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Loader2 className="h-8 w-8 animate-spin" />
              ) : (
                <>
                  <div className="text-2xl font-bold text-blue-600">
                    {new Set(loginsData?.logins?.map((l: SuspiciousLogin) => l.userId)).size || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">Users affected</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Last Hour</CardTitle>
              <Clock className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Loader2 className="h-8 w-8 animate-spin" />
              ) : (
                <>
                  <div className="text-2xl font-bold text-purple-600">
                    {loginsData?.logins?.filter((l: SuspiciousLogin) => {
                      const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
                      return new Date(l.createdAt) > hourAgo;
                    }).length || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">Recent attempts</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Suspicious Logins Table */}
        <Card>
          <CardHeader>
            <CardTitle>Suspicious Login Attempts</CardTitle>
            <CardDescription>Review and investigate potentially malicious login activity</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by email, IP, or location..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                onClick={() => refetch()}
                disabled={loginsLoading}
              >
                <RefreshCw className={`h-4 w-4 ${loginsLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            {loginsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : loginsData?.logins.length === 0 ? (
              <div className="text-center py-8">
                <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No suspicious logins found</p>
                <p className="text-sm text-muted-foreground mt-2">Your system is secure!</p>
              </div>
            ) : (
              <>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Device</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Reasons</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loginsData?.logins.map((login: SuspiciousLogin) => (
                        <TableRow key={login.id} className="hover:bg-red-50">
                          <TableCell>
                            <div>
                              <div className="font-medium">{login.userEmail}</div>
                              <div className="text-xs text-muted-foreground">{login.userName}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm">
                              <span>{getCountryFlag(login.countryCode)}</span>
                              <span>{login.city || 'Unknown'}, {login.country || 'Unknown'}</span>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                              <Globe className="h-3 w-3" />
                              <span>{login.ipAddress}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm">
                              <span>{getDeviceIcon(login.deviceType)}</span>
                              <span>{login.browser}</span>
                            </div>
                            <div className="text-xs text-muted-foreground">{login.os}</div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {getStatusBadge(login.status)}
                              {login.isNewLocation && (
                                <Badge variant="outline" className="text-xs block w-fit">🆕 New Location</Badge>
                              )}
                              {login.isNewDevice && (
                                <Badge variant="outline" className="text-xs block w-fit">🆕 New Device</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {login.suspiciousReasons.slice(0, 2).map((reason, i) => (
                                <div key={i} className="text-xs text-red-600 flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3" />
                                  {reason}
                                </div>
                              ))}
                              {login.suspiciousReasons.length > 2 && (
                                <div className="text-xs text-muted-foreground">
                                  +{login.suspiciousReasons.length - 2} more
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {formatDistanceToNow(new Date(login.createdAt), { addSuffix: true })}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(login.createdAt).toLocaleString()}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewUserHistory(login.userId, login.userEmail)}
                            >
                              View History
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {loginsData?.pagination && (
                  <div className="flex items-center justify-between mt-4">
                    <div className="text-sm text-muted-foreground">
                      Showing page {loginsData.pagination.page} of {loginsData.pagination.totalPages} 
                      ({loginsData.pagination.total} total suspicious logins)
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => p + 1)}
                        disabled={page >= loginsData.pagination.totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Login History Dialog */}
      {selectedUserId && (
        <LoginHistoryDialog
          userId={selectedUserId}
          userEmail={selectedUserEmail}
          open={isLoginHistoryOpen}
          onOpenChange={setIsLoginHistoryOpen}
        />
      )}
    </div>
  );
}
