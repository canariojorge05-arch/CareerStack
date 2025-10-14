import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Monitor, Smartphone, Tablet, Globe, Clock, LogOut, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface ActiveSession {
  id: string;
  deviceName?: string;
  deviceType?: string;
  os?: string;
  browser?: string;
  ipAddress?: string;
  lastActive: string;
  createdAt: string;
  expiresAt: string;
}

interface ActiveSessionsDialogProps {
  userId: string;
  userEmail: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ActiveSessionsDialog({ userId, userEmail, open, onOpenChange }: ActiveSessionsDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: [`/api/admin/users/${userId}/active-sessions`],
    queryFn: async () => {
      const res = await fetch(`/api/admin/users/${userId}/active-sessions`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch active sessions');
      return res.json();
    },
    enabled: open
  });

  // Revoke specific session mutation
  const revokeSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const csrfToken = document.cookie
        .split('; ')
        .find(row => row.startsWith('csrf_token='))
        ?.split('=')[1];

      const res = await fetch(`/api/admin/users/${userId}/revoke-session/${sessionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken || ''
        },
        credentials: 'include'
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to revoke session');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/users/${userId}/active-sessions`] });
      toast({
        title: 'Session revoked',
        description: 'The session has been terminated successfully'
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

  // Force logout all sessions mutation
  const forceLogoutMutation = useMutation({
    mutationFn: async () => {
      const csrfToken = document.cookie
        .split('; ')
        .find(row => row.startsWith('csrf_token='))
        ?.split('=')[1];

      const res = await fetch(`/api/admin/users/${userId}/force-logout`, {
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
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/users/${userId}/active-sessions`] });
      toast({
        title: 'All sessions terminated',
        description: `All active sessions for ${userEmail} have been logged out`
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message
      });
    }
  });

  const getDeviceIcon = (deviceType?: string) => {
    switch (deviceType?.toLowerCase()) {
      case 'mobile':
        return <Smartphone className="h-5 w-5 text-blue-600" />;
      case 'tablet':
        return <Tablet className="h-5 w-5 text-purple-600" />;
      default:
        return <Monitor className="h-5 w-5 text-gray-600" />;
    }
  };

  const handleRevokeSession = (sessionId: string) => {
    if (confirm('Revoke this session? The user will be logged out from this device.')) {
      revokeSessionMutation.mutate(sessionId);
    }
  };

  const handleForceLogoutAll = () => {
    if (confirm(`Force logout ALL sessions for ${userEmail}? This will immediately disconnect the user from all devices.`)) {
      forceLogoutMutation.mutate();
    }
  };

  const isExpiringSoon = (expiresAt: string) => {
    const expiryDate = new Date(expiresAt);
    const now = new Date();
    const hoursUntilExpiry = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    return hoursUntilExpiry < 24 && hoursUntilExpiry > 0;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Active Sessions</DialogTitle>
          <DialogDescription>
            Managing active sessions for {userEmail}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : data?.sessions.length === 0 ? (
          <div className="text-center py-8">
            <Monitor className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No active sessions</p>
            <p className="text-sm text-muted-foreground mt-2">
              User is not currently logged in on any device
            </p>
          </div>
        ) : (
          <>
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {data?.sessions.map((session: ActiveSession, index: number) => (
                  <div
                    key={session.id}
                    className={`border rounded-lg p-4 ${
                      isExpiringSoon(session.expiresAt) ? 'border-amber-300 bg-amber-50' : 'border-border'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {getDeviceIcon(session.deviceType)}
                        <div>
                          <p className="font-medium">
                            {session.deviceName || `${session.deviceType || 'Desktop'} Device`}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {session.browser} on {session.os}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {index === 0 && (
                          <Badge variant="secondary" className="text-xs">Current</Badge>
                        )}
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleRevokeSession(session.id)}
                          disabled={revokeSessionMutation.isPending}
                        >
                          <LogOut className="h-3 w-3 mr-1" />
                          Revoke
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Globe className="h-3 w-3" />
                        <span>{session.ipAddress || 'Unknown IP'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>
                          Active {formatDistanceToNow(new Date(session.lastActive), { addSuffix: true })}
                        </span>
                      </div>
                    </div>

                    <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
                      <div className="flex items-center justify-between">
                        <span>
                          Created: {new Date(session.createdAt).toLocaleDateString()} at {new Date(session.createdAt).toLocaleTimeString()}
                        </span>
                        <span>
                          Expires: {formatDistanceToNow(new Date(session.expiresAt), { addSuffix: true })}
                        </span>
                      </div>
                    </div>

                    {isExpiringSoon(session.expiresAt) && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-amber-700">
                        <AlertCircle className="h-3 w-3" />
                        <span>Session expiring soon</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>

            <DialogFooter className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {data?.sessions.length} active {data?.sessions.length === 1 ? 'session' : 'sessions'}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleForceLogoutAll}
                  disabled={forceLogoutMutation.isPending || data?.sessions.length === 0}
                >
                  {forceLogoutMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  <LogOut className="h-4 w-4 mr-2" />
                  Force Logout All
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
