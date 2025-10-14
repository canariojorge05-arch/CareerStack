import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, MapPin, Monitor, Smartphone, Tablet, AlertTriangle, Globe } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface LoginHistoryEntry {
  id: string;
  status: string;
  failureReason?: string;
  ipAddress: string;
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;
  browser?: string;
  browserVersion?: string;
  os?: string;
  deviceType?: string;
  isSuspicious: boolean;
  suspiciousReasons?: string[];
  isNewLocation: boolean;
  isNewDevice: boolean;
  createdAt: string;
}

interface LoginHistoryDialogProps {
  userId: string;
  userEmail: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LoginHistoryDialog({ userId, userEmail, open, onOpenChange }: LoginHistoryDialogProps) {
  const { data, isLoading } = useQuery({
    queryKey: [`/api/admin/users/${userId}/login-history`],
    queryFn: async () => {
      const res = await fetch(`/api/admin/users/${userId}/login-history?limit=100`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch login history');
      return res.json();
    },
    enabled: open
  });

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType?.toLowerCase()) {
      case 'mobile':
        return <Smartphone className="h-4 w-4" />;
      case 'tablet':
        return <Tablet className="h-4 w-4" />;
      default:
        return <Monitor className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string, isSuspicious: boolean) => {
    if (isSuspicious) {
      return <Badge variant="destructive" className="text-xs">⚠️ Suspicious</Badge>;
    }
    if (status === 'success') {
      return <Badge variant="outline" className="text-green-600 text-xs">✓ Success</Badge>;
    }
    if (status === 'failed') {
      return <Badge variant="destructive" className="text-xs">✗ Failed</Badge>;
    }
    return <Badge variant="secondary" className="text-xs">{status}</Badge>;
  };

  const getCountryFlag = (countryCode?: string) => {
    if (!countryCode || countryCode === 'LOCAL') return '🏠';
    // Convert country code to emoji flag
    const codePoints = countryCode
      .toUpperCase()
      .split('')
      .map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Login History</DialogTitle>
          <DialogDescription>
            Viewing login history for {userEmail}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : data?.history.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No login history found
          </div>
        ) : (
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-4">
              {data?.history.map((entry: LoginHistoryEntry, index: number) => (
                <div 
                  key={entry.id} 
                  className={`border rounded-lg p-4 ${
                    entry.isSuspicious ? 'border-red-300 bg-red-50' : 'border-border'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getDeviceIcon(entry.deviceType || 'desktop')}
                      <span className="font-medium">
                        {entry.browser} {entry.browserVersion}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(entry.status, entry.isSuspicious)}
                      {index === 0 && (
                        <Badge variant="secondary" className="text-xs">Latest</Badge>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      <span>
                        {getCountryFlag(entry.countryCode)} {entry.city || 'Unknown'}, {entry.region || 'Unknown'}, {entry.country || 'Unknown'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Globe className="h-3 w-3" />
                      <span>{entry.ipAddress}</span>
                    </div>
                  </div>

                  <div className="mt-2 text-sm text-muted-foreground">
                    <span>{entry.os}</span>
                    {entry.deviceType && entry.deviceType !== 'desktop' && (
                      <span className="ml-2">• {entry.deviceType}</span>
                    )}
                    <span className="ml-2">• {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}</span>
                  </div>

                  {entry.isNewLocation && (
                    <Badge variant="outline" className="mt-2 text-xs">
                      🆕 New Location
                    </Badge>
                  )}
                  
                  {entry.isNewDevice && (
                    <Badge variant="outline" className="mt-2 ml-2 text-xs">
                      🆕 New Device
                    </Badge>
                  )}

                  {entry.isSuspicious && entry.suspiciousReasons && entry.suspiciousReasons.length > 0 && (
                    <div className="mt-3 p-2 bg-red-100 border border-red-200 rounded text-xs">
                      <div className="flex items-center gap-1 font-semibold text-red-800 mb-1">
                        <AlertTriangle className="h-3 w-3" />
                        Suspicious Activity:
                      </div>
                      <ul className="list-disc list-inside text-red-700">
                        {entry.suspiciousReasons.map((reason, i) => (
                          <li key={i}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {entry.status === 'failed' && entry.failureReason && (
                    <div className="mt-2 text-xs text-red-600">
                      Failed: {entry.failureReason}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
