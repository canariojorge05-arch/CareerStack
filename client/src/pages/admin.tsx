import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Search, Users, Shield, UserCheck, Loader2, RefreshCw, MoreVertical, History, Monitor, LogOut, AlertTriangle } from 'lucide-react';
import { AppHeader } from '@/components/shared/app-header';
import { LoginHistoryDialog } from '@/components/admin/login-history-dialog';
import { ActiveSessionsDialog } from '@/components/admin/active-sessions-dialog';
import { formatDistanceToNow } from 'date-fns';

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

interface UserStats {
  total: number;
  recentUsers: number;
  byRole: {
    role: string;
    roleName: string;
    count: number;
  }[];
}

interface Role {
  value: string;
  label: string;
  description: string;
}

export default function AdminPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newRole, setNewRole] = useState('');
  const [isChangeRoleOpen, setIsChangeRoleOpen] = useState(false);
  const [loginHistoryUser, setLoginHistoryUser] = useState<User | null>(null);
  const [isLoginHistoryOpen, setIsLoginHistoryOpen] = useState(false);
  const [activeSessionsUser, setActiveSessionsUser] = useState<User | null>(null);
  const [isActiveSessionsOpen, setIsActiveSessionsOpen] = useState(false);

  // Fetch user statistics
  const { data: stats, isLoading: statsLoading } = useQuery<UserStats>({
    queryKey: ['/api/admin/stats'],
    queryFn: async () => {
      const res = await fetch('/api/admin/stats', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    }
  });

  // Fetch users list
  const { data: usersData, isLoading: usersLoading, refetch } = useQuery({
    queryKey: ['/api/admin/users', { search, role: roleFilter, page }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10'
      });
      if (search) params.append('search', search);
      if (roleFilter !== 'all') params.append('role', roleFilter);

      const res = await fetch(`/api/admin/users?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch users');
      return res.json();
    }
  });

  // Fetch available roles
  const { data: roles } = useQuery<Role[]>({
    queryKey: ['/api/admin/roles'],
    queryFn: async () => {
      const res = await fetch('/api/admin/roles', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch roles');
      return res.json();
    }
  });

  // Fetch suspicious logins count for security stats
  const { data: securityData } = useQuery({
    queryKey: ['/api/admin/suspicious-logins', { page: 1, limit: 1 }],
    queryFn: async () => {
      try {
        const res = await fetch('/api/admin/suspicious-logins?page=1&limit=1', { 
          credentials: 'include' 
        });
        if (!res.ok) return { pagination: { total: 0 } };
        return res.json();
      } catch {
        return { pagination: { total: 0 } };
      }
    }
  });

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const csrfToken = document.cookie
        .split('; ')
        .find(row => row.startsWith('csrf_token='))
        ?.split('=')[1];

      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken || ''
        },
        credentials: 'include',
        body: JSON.stringify({ role })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to update role');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
      setIsChangeRoleOpen(false);
      setSelectedUser(null);
      toast({
        title: 'Role updated',
        description: 'User role has been updated successfully'
      });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message
      });
    }
  });

  const handleChangeRole = (user: User) => {
    setSelectedUser(user);
    setNewRole(user.role);
    setIsChangeRoleOpen(true);
  };

  const handleSaveRole = () => {
    if (selectedUser && newRole) {
      updateRoleMutation.mutate({ userId: selectedUser.id, role: newRole });
    }
  };

  const handleViewLoginHistory = (user: User) => {
    setLoginHistoryUser(user);
    setIsLoginHistoryOpen(true);
  };

  const handleViewSessions = (user: User) => {
    setActiveSessionsUser(user);
    setIsActiveSessionsOpen(true);
  };

  const handleForceLogout = async (user: User) => {
    if (confirm(`Force logout all sessions for ${user.email}? This will immediately disconnect the user from all devices.`)) {
      try {
        const csrfToken = document.cookie
          .split('; ')
          .find(row => row.startsWith('csrf_token='))
          ?.split('=')[1];

        const res = await fetch(`/api/admin/users/${user.id}/force-logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken || ''
          },
          credentials: 'include'
        });

        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.message || 'Failed to force logout');
        }

        toast({
          title: 'User logged out',
          description: `All sessions for ${user.email} have been terminated`
        });

        // Refresh sessions if dialog is open
        if (activeSessionsUser?.id === user.id) {
          queryClient.invalidateQueries({ queryKey: [`/api/admin/users/${user.id}/active-sessions`] });
        }
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to force logout'
        });
      }
    }
  };

  const getRoleBadge = (role: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
      admin: 'destructive',
      marketing: 'default',
      user: 'secondary'
    };
    return <Badge variant={variants[role] || 'secondary'}>{role}</Badge>;
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader currentPage="admin" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-2">Manage users and system settings</p>
          <div className="flex gap-2 mt-4">
            <Button onClick={() => window.location.href = '/admin'} variant="default">
              User Management
            </Button>
            <Button onClick={() => window.location.href = '/admin/approvals'} variant="outline">
              Pending Approvals
            </Button>
            <Button onClick={() => window.location.href = '/admin/security'} variant="outline">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Security
            </Button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Loader2 className="h-8 w-8 animate-spin" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{stats?.total || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    +{stats?.recentUsers || 0} in last 7 days
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {stats?.byRole.slice(0, 2).map((roleStats) => (
            <Card key={roleStats.role}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{roleStats.roleName}</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{roleStats.count}</div>
                <p className="text-xs text-muted-foreground">
                  {roleStats.role} users
                </p>
              </CardContent>
            </Card>
          ))}

          {/* Security Stats Card */}
          <Card className="border-red-200 bg-red-50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Suspicious Logins</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {securityData?.pagination?.total || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Requires attention
              </p>
              <Button 
                variant="outline" 
                size="sm"
                className="mt-3 w-full text-xs"
                onClick={() => window.location.href = '/admin/security'}
              >
                View Security Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* User Management Section */}
        <Card>
          <CardHeader>
            <CardTitle>User Management</CardTitle>
            <CardDescription>Manage user roles and permissions</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by email or name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="marketing">Marketing</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                onClick={() => refetch()}
                disabled={usersLoading}
              >
                <RefreshCw className={`h-4 w-4 ${usersLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            {/* Users Table */}
            {usersLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Last Login</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usersData?.users.map((user: User) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.email}</TableCell>
                          <TableCell>
                            {user.firstName || user.lastName
                              ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
                              : '-'}
                          </TableCell>
                          <TableCell>{getRoleBadge(user.role)}</TableCell>
                          <TableCell>
                            {user.emailVerified ? (
                              <Badge variant="outline" className="text-green-600">
                                <UserCheck className="h-3 w-3 mr-1" />
                                Verified
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-amber-600">
                                Pending
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {user.lastLoginAt ? (
                              <div className="text-sm">
                                <div>{formatDistanceToNow(new Date(user.lastLoginAt), { addSuffix: true })}</div>
                                <div className="text-xs text-muted-foreground">
                                  {new Date(user.lastLoginAt).toLocaleDateString()}
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">Never</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleChangeRole(user)}
                              >
                                Change Role
                              </Button>
                              
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button size="sm" variant="ghost">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleViewLoginHistory(user)}>
                                    <History className="h-4 w-4 mr-2" />
                                    Login History
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleViewSessions(user)}>
                                    <Monitor className="h-4 w-4 mr-2" />
                                    Active Sessions
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    onClick={() => handleForceLogout(user)}
                                    className="text-red-600"
                                  >
                                    <LogOut className="h-4 w-4 mr-2" />
                                    Force Logout
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {usersData?.pagination && (
                  <div className="flex items-center justify-between mt-4">
                    <div className="text-sm text-muted-foreground">
                      Showing page {usersData.pagination.page} of {usersData.pagination.totalPages}
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
                        disabled={page >= usersData.pagination.totalPages}
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

      {/* Change Role Dialog */}
      <Dialog open={isChangeRoleOpen} onOpenChange={setIsChangeRoleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change User Role</DialogTitle>
            <DialogDescription>
              Update the role for {selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Current Role</Label>
              <div>{selectedUser && getRoleBadge(selectedUser.role)}</div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-role">New Role</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger id="new-role">
                  <SelectValue placeholder="Select new role" />
                </SelectTrigger>
                <SelectContent>
                  {roles?.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      <div>
                        <div className="font-medium">{role.label}</div>
                        <div className="text-xs text-muted-foreground">{role.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsChangeRoleOpen(false)}
              disabled={updateRoleMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveRole}
              disabled={updateRoleMutation.isPending || newRole === selectedUser?.role}
            >
              {updateRoleMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Login History Dialog */}
      {loginHistoryUser && (
        <LoginHistoryDialog
          userId={loginHistoryUser.id}
          userEmail={loginHistoryUser.email}
          open={isLoginHistoryOpen}
          onOpenChange={setIsLoginHistoryOpen}
        />
      )}

      {/* Active Sessions Dialog */}
      {activeSessionsUser && (
        <ActiveSessionsDialog
          userId={activeSessionsUser.id}
          userEmail={activeSessionsUser.email}
          open={isActiveSessionsOpen}
          onOpenChange={setIsActiveSessionsOpen}
        />
      )}
    </div>
  );
}
