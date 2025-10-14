import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Search, UserCheck, UserX, Clock, Loader2, CheckCircle, XCircle, AlertCircle, AlertTriangle } from 'lucide-react';
import { AppHeader } from '@/components/shared/app-header';

interface PendingUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  emailVerified: boolean;
  createdAt: string;
  lastIpAddress?: string;
  approvalStatus: string;
}

interface ApprovalStats {
  byStatus: {
    status: string;
    count: number;
  }[];
  todayPending: number;
}

export default function AdminApprovalsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<PendingUser | null>(null);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  // Fetch approval stats
  const { data: stats, isLoading: statsLoading } = useQuery<ApprovalStats>({
    queryKey: ['/api/admin/approval-stats'],
    queryFn: async () => {
      const res = await fetch('/api/admin/approval-stats', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    }
  });

  // Fetch pending users
  const { data: usersData, isLoading: usersLoading, refetch } = useQuery({
    queryKey: ['/api/admin/pending-approvals', { search, page }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10'
      });
      if (search) params.append('search', search);

      const res = await fetch(`/api/admin/pending-approvals?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch pending users');
      return res.json();
    }
  });

  // Approve user mutation
  const approveMutation = useMutation({
    mutationFn: async (userId: string) => {
      const csrfToken = document.cookie
        .split('; ')
        .find(row => row.startsWith('csrf_token='))
        ?.split('=')[1];

      const res = await fetch(`/api/admin/users/${userId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken || ''
        },
        credentials: 'include'
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to approve user');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/pending-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/approval-stats'] });
      toast({
        title: 'User approved',
        description: 'The user has been approved and notified via email'
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

  // Reject user mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ userId, reason }: { userId: string; reason?: string }) => {
      const csrfToken = document.cookie
        .split('; ')
        .find(row => row.startsWith('csrf_token='))
        ?.split('=')[1];

      const res = await fetch(`/api/admin/users/${userId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken || ''
        },
        credentials: 'include',
        body: JSON.stringify({ reason })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to reject user');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/pending-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/approval-stats'] });
      setIsRejectDialogOpen(false);
      setSelectedUser(null);
      setRejectionReason('');
      toast({
        title: 'User rejected',
        description: 'The user has been rejected and notified via email'
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

  const handleApprove = (user: PendingUser) => {
    if (confirm(`Approve ${user.email}?`)) {
      approveMutation.mutate(user.id);
    }
  };

  const handleReject = (user: PendingUser) => {
    setSelectedUser(user);
    setIsRejectDialogOpen(true);
  };

  const handleConfirmReject = () => {
    if (selectedUser) {
      rejectMutation.mutate({
        userId: selectedUser.id,
        reason: rejectionReason.trim() || undefined
      });
    }
  };

  const pendingCount = stats?.byStatus.find(s => s.status === 'pending_approval')?.count || 0;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader currentPage="admin" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">User Approvals</h1>
          <p className="text-muted-foreground mt-2">Review and approve new user registrations</p>
          <div className="flex gap-2 mt-4">
            <Button onClick={() => window.location.href = '/admin'} variant="outline">
              User Management
            </Button>
            <Button onClick={() => window.location.href = '/admin/approvals'} variant="default">
              Pending Approvals
            </Button>
            <Button onClick={() => window.location.href = '/admin/security'} variant="outline">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Security
            </Button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Loader2 className="h-8 w-8 animate-spin" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{pendingCount}</div>
                  <p className="text-xs text-muted-foreground">
                    Waiting for review
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Today's Signups</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Loader2 className="h-8 w-8 animate-spin" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{stats?.todayPending || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    New today
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Approved Users</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Loader2 className="h-8 w-8 animate-spin" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {stats?.byStatus.find(s => s.status === 'approved')?.count || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Total approved
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Pending Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>Pending User Registrations</CardTitle>
            <CardDescription>Review and approve or reject new user accounts</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Search */}
            <div className="flex gap-4 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button variant="outline" onClick={() => refetch()}>
                Refresh
              </Button>
            </div>

            {usersLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : usersData?.users.length === 0 ? (
              <div className="text-center py-8">
                <UserCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No pending approvals</p>
              </div>
            ) : (
              <>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Verified</TableHead>
                        <TableHead>IP Address</TableHead>
                        <TableHead>Signed Up</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usersData?.users.map((user: PendingUser) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.email}</TableCell>
                          <TableCell>
                            {user.firstName || user.lastName
                              ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
                              : '-'}
                          </TableCell>
                          <TableCell>
                            {user.emailVerified ? (
                              <Badge variant="outline" className="text-green-600">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Yes
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-amber-600">
                                No
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {user.lastIpAddress || '-'}
                          </TableCell>
                          <TableCell>
                            {new Date(user.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="default"
                                className="bg-green-600 hover:bg-green-700"
                                onClick={() => handleApprove(user)}
                                disabled={approveMutation.isPending}
                              >
                                <UserCheck className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleReject(user)}
                                disabled={rejectMutation.isPending}
                              >
                                <UserX className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {usersData?.pagination && usersData.pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <div className="text-sm text-muted-foreground">
                      Page {usersData.pagination.page} of {usersData.pagination.totalPages}
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

      {/* Reject Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject User Registration</DialogTitle>
            <DialogDescription>
              Are you sure you want to reject {selectedUser?.email}?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Reason (Optional)</Label>
              <Textarea
                id="reason"
                placeholder="Provide a reason for rejection..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                This reason will be included in the rejection email sent to the user.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsRejectDialogOpen(false);
                setRejectionReason('');
              }}
              disabled={rejectMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmReject}
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Reject User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
