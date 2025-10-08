import { useEffect, useState } from 'react';
import { LoadingButton } from '@/components/ui/loading-button';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

function ResendVerification() {
  const [email, setEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

  const onResend = async () => {
    if (!email || !/.+@.+\..+/.test(email)) {
      toast({ variant: 'destructive', title: 'Invalid email', description: 'Please enter a valid email.' });
      return;
    }
    setIsSending(true);
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({ email })
      });
      if (!res.ok) {
        if (res.status === 429) {
          const retryAfter = res.headers.get('Retry-After');
          const seconds = retryAfter ? parseInt(retryAfter, 10) : undefined;
          toast({
            variant: 'destructive',
            title: 'Too many requests',
            description: `Please try again in ${Number.isFinite(seconds) ? seconds + ' seconds' : 'a few seconds'}.`,
          });
          return;
        }
        const data = await res.json().catch(() => ({ message: 'Failed to resend email' }));
        throw new Error(data.message || 'Failed to resend email');
      }
      toast({ title: 'Verification email sent', description: 'Please check your inbox (and spam/junk folder).' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message || 'Failed to resend email' });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="w-full max-w-sm">
      <div className="text-sm text-muted-foreground">Didn’t get the email? Resend verification:</div>
      <div className="mt-2 flex gap-2">
        <input
          className="flex-1 border rounded px-3 py-2"
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <LoadingButton loading={isSending} loadingText="Sending..." onClick={onResend}>
          Resend
        </LoadingButton>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  const [status, setStatus] = useState<'pending' | 'success' | 'error'>('pending');
  const [message, setMessage] = useState<string>('Verifying your email...');
  const { toast } = useToast();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (!token) {
      setStatus('error');
      setMessage('Verification token is missing.');
      return;
    }

    (async () => {
      try {
        const res = await fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`, {
          method: 'GET',
          credentials: 'include',
          headers: { 'X-Requested-With': 'XMLHttpRequest' },
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({ message: 'Verification failed' }));
          throw new Error(data.message || 'Verification failed');
        }
        setStatus('success');
        setMessage('Your email has been verified successfully. You can now log in.');
        toast({ title: 'Email verified', description: 'Your email is now verified. Please log in.' });
      } catch (e: any) {
        setStatus('error');
        setMessage(e.message || 'Verification failed.');
      }
    })();
  }, [toast]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-6 text-center space-y-4">
          <h1 className="text-xl font-semibold">Email Verification</h1>
          {status === 'pending' && <LoadingSpinner size="lg" />}
          <p className={status === 'error' ? 'text-red-600' : 'text-muted-foreground'}>{message}</p>
          <div className="flex flex-col items-center gap-3">
            <div className="flex gap-2">
              <Button onClick={() => (window.location.href = '/login')} variant="default">Go to Login</Button>
              <Button onClick={() => (window.location.href = '/')} variant="outline">Home</Button>
            </div>
            <ResendVerification />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}